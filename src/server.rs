use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

use crate::state::Global;
use crate::entities::{Agent, Organization, Transport};
use crate::spatial::Location;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationPayload {
    pub tick: u64,
    pub global_metrics: Global,
    pub active_agents_subset: Vec<Agent>,
    pub locations_subset: Vec<Location>,
    pub organizations: std::collections::HashMap<u32, Organization>,
    pub transports: Vec<Transport>,
}

pub async fn start_websocket_server(
    state: Arc<Mutex<Option<SimulationPayload>>>,
    paused_flag: Arc<AtomicBool>
) {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind WebSocket");
    println!("WebSocket server listening on ws://{}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        let state_clone = state.clone();
        let paused_clone = paused_flag.clone();
        
        tokio::spawn(async move {
            if let Ok(ws_stream) = accept_async(stream).await {
                println!("New UI Client Connected!");
                
                let (mut tx, mut rx) = ws_stream.split();
                
                // Spawn a reader task to listen for UI commands
                let paused_rx = paused_clone.clone();
                tokio::spawn(async move {
                    while let Some(msg) = rx.next().await {
                        if let Ok(m) = msg {
                            if let Ok(text) = m.into_text() {
                                if text == "pause" {
                                    paused_rx.store(true, Ordering::SeqCst);
                                    println!("Engine Paused by UI");
                                } else if text == "resume" {
                                    paused_rx.store(false, Ordering::SeqCst);
                                    println!("Engine Resumed by UI");
                                }
                            }
                        }
                    }
                });
                
                let mut interval = tokio::time::interval(std::time::Duration::from_millis(50));
                
                loop {
                    interval.tick().await;
                    
                    let payload_str = {
                        let lock = state_clone.lock().await;
                        if let Some(payload) = &*lock {
                            serde_json::to_string(payload).unwrap_or_default()
                        } else {
                            String::new()
                        }
                    };
                    
                    if !payload_str.is_empty() {
                        if tx.send(tokio_tungstenite::tungstenite::Message::Text(payload_str.into())).await.is_err() {
                            println!("Client Disconnected");
                            break; 
                        }
                    }
                }
            }
        });
    }
}
