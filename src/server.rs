use std::sync::Arc;
use std::sync::atomic::{AtomicU8, Ordering};
use tokio::sync::Mutex;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

use crate::state::Global;
use crate::entities::Agent;
use crate::spatial::{self, Location};

/// Per-county aggregate stats sent every frame so frontend can show overview panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CountyStats {
    pub county_id: u8,
    pub name: String,
    pub population: u32,
    pub avg_wealth: f32,
    pub total_location_value: f64,
    pub num_employers: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationPayload {
    pub tick: u64,
    pub global_metrics: Global,
    pub viewport_agents: Vec<Agent>,
    pub viewport_locations: Vec<Location>,
    pub county_stats: Vec<CountyStats>,
}

/// Viewport filter state shared between WebSocket reader and payload builder
#[derive(Debug)]
pub struct ViewportFilter {
    pub county: AtomicU8,
    pub bbox: Mutex<(f32, f32, f32, f32)>, // lat_min, lat_max, lon_min, lon_max
}

impl Default for ViewportFilter {
    fn default() -> Self {
        Self {
            county: AtomicU8::new(spatial::COUNTY_UNKNOWN),
            bbox: Mutex::new((38.9, 41.4, -75.6, -73.8)),
        }
    }
}

/// Pending command waiting for engine to execute
pub struct PendingCommand {
    pub json_text: String,
    pub response_tx: tokio::sync::oneshot::Sender<String>,
}

/// Channel for routing commands from WebSocket → engine
pub type CommandQueue = Arc<Mutex<Vec<PendingCommand>>>;

pub fn new_command_queue() -> CommandQueue {
    Arc::new(Mutex::new(Vec::new()))
}

pub async fn start_websocket_server(
    state: Arc<Mutex<Option<SimulationPayload>>>,
    paused_flag: Arc<std::sync::atomic::AtomicBool>,
    viewport_filter: Arc<ViewportFilter>,
    command_queue: CommandQueue,
) {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind WebSocket");
    println!("WebSocket server listening on ws://{}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        let state_clone = state.clone();
        let paused_clone = paused_flag.clone();
        let vf_clone = viewport_filter.clone();
        let cmd_queue = command_queue.clone();
        
        tokio::spawn(async move {
            if let Ok(ws_stream) = accept_async(stream).await {
                println!("New UI Client Connected!");
                
                let (tx, mut rx) = ws_stream.split();
                let tx = Arc::new(Mutex::new(tx));
                
                // Reader task: handles UI commands and API calls
                let tx_reader = tx.clone();
                let paused_rx = paused_clone.clone();
                let vf_rx = vf_clone.clone();
                let cmd_q_reader = cmd_queue.clone();
                tokio::spawn(async move {
                    while let Some(msg) = rx.next().await {
                        if let Ok(m) = msg {
                            if let Ok(text) = m.into_text() {
                                let text = text.trim().to_string();
                                
                                // Try JSON command first
                                if text.starts_with('{') {
                                    // Queue for engine execution
                                    let (resp_tx, resp_rx) = tokio::sync::oneshot::channel();
                                    {
                                        let mut q = cmd_q_reader.lock().await;
                                        q.push(PendingCommand {
                                            json_text: text,
                                            response_tx: resp_tx,
                                        });
                                    }
                                    // Wait for response and send back
                                    if let Ok(response) = resp_rx.await {
                                        let mut sink = tx_reader.lock().await;
                                        let _ = sink.send(
                                            tokio_tungstenite::tungstenite::Message::Text(response.into())
                                        ).await;
                                    }
                                    continue;
                                }
                                
                                // Legacy text commands
                                if text == "pause" {
                                    paused_rx.store(true, Ordering::SeqCst);
                                    println!("Engine Paused by UI");
                                } else if text == "resume" {
                                    paused_rx.store(false, Ordering::SeqCst);
                                    println!("Engine Resumed by UI");
                                } else if let Some(county_name) = text.strip_prefix("county:") {
                                    let cid = spatial::county_to_id(county_name.trim());
                                    vf_rx.county.store(cid, Ordering::SeqCst);
                                    println!("County filter set to: {} ({})", county_name.trim(), cid);
                                } else if let Some(bbox_str) = text.strip_prefix("viewport:") {
                                    let parts: Vec<f32> = bbox_str.split(',')
                                        .filter_map(|s| s.trim().parse().ok())
                                        .collect();
                                    if parts.len() == 4 {
                                        let mut bbox = vf_rx.bbox.lock().await;
                                        *bbox = (parts[0], parts[1], parts[2], parts[3]);
                                    }
                                }
                            }
                        }
                    }
                });
                
                // Sender task: broadcasts payload at 20Hz
                let tx_sender = tx.clone();
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
                        let mut sink = tx_sender.lock().await;
                        if sink.send(tokio_tungstenite::tungstenite::Message::Text(payload_str.into())).await.is_err() {
                            println!("Client Disconnected");
                            break; 
                        }
                    }
                }
            }
        });
    }
}
