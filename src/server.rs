use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::SinkExt;
use serde::{Deserialize, Serialize};

use crate::state::Global;
use crate::entities::{Agent, Business, Vehicle};
use crate::spatial::Building;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationPayload {
    pub tick: u64,
    pub global_metrics: Global,
    /// We sub-sample agents so the web browser doesn't crash trying to render 1.1 million HTML5 elements
    pub active_agents_subset: Vec<Agent>,
    pub buildings_subset: Vec<Building>,
    pub businesses_subset: Vec<Business>,
    pub vehicles_subset: Vec<Vehicle>,
}

pub async fn start_websocket_server(state: Arc<Mutex<Option<SimulationPayload>>>) {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind WebSocket");
    println!("WebSocket server listening on ws://{}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        let state_clone = state.clone();
        tokio::spawn(async move {
            if let Ok(mut ws_stream) = accept_async(stream).await {
                println!("New UI Client Connected!");
                
                // Stream data to the client at ~20 FPS (50ms interval) to avoid network chokes
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
                        if ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(payload_str.into())).await.is_err() {
                            println!("Client Disconnected");
                            break; 
                        }
                    }
                }
            }
        });
    }
}
