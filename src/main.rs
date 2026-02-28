pub mod entities;
pub mod spatial;
pub mod state;

pub mod server;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

use state::Global;
use spatial::Location;
use entities::{Agent, Organization, Transport, Weather};
use server::SimulationPayload;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct CsvLocation {
    lat: f64,
    lon: f64,
    org_id: String,
    #[serde(rename = "type")]
    loc_type: String,
    name: String,
}

/// The core Simulation Engine that ticks through time holding all state
#[derive(Debug)]
pub struct SimulationEngine {
    pub global_state: Global,
    pub locations: HashMap<u64, Location>,
    pub organizations: HashMap<u64, Organization>,
    pub agents: Vec<Agent>,
    pub transports: Vec<Transport>,
    pub active_weather: Vec<Weather>,
}

impl SimulationEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            global_state: Global::default(),
            locations: HashMap::new(),
            organizations: HashMap::new(),
            agents: Vec::new(),
            transports: Vec::new(),
            active_weather: Vec::new(),
        };

        // Load first 100 locations
        if let Ok(mut rdr) = csv::Reader::from_path("data/locations.csv") {
            let mut id_counter = 1;
            for result in rdr.deserialize().take(100) {
                if let Ok(rec) = result {
                    let rec: CsvLocation = rec;
                    let l_type = match rec.loc_type.as_str() {
                        "Store" => spatial::LocationType::Store,
                        "Employer" => spatial::LocationType::Employer,
                        "Residential" => spatial::LocationType::Residential,
                        "Public" => spatial::LocationType::Public,
                        _ => spatial::LocationType::Mixed,
                    };
                    let org_id = rec.org_id.parse::<u64>().ok();
                    let loc = Location {
                        id: id_counter,
                        name: rec.name.clone(),
                        coord: spatial::Coordinate::new(rec.lat, rec.lon),
                        location_type: l_type,
                        organization_id: org_id,
                        capacity: 100,
                    };
                    engine.locations.insert(id_counter, loc);
                    id_counter += 1;
                }
            }
        } else {
            println!("Warning: Could not load data/locations.csv");
        }

        // Generate 1000 agents
        for i in 1..=1000 {
            let speed = 5.0 + 55.0 * rand::random::<f64>(); // 5 to 60 mph
            
            let transport = Transport {
                id: i,
                transport_type: entities::TransportType::Car,
                capacity: 1,
                speed_mph: speed,
                route: Vec::new(),
            };
            engine.transports.push(transport);
            
            // Random start pos within approx bounding box of NJ
            let lat = 38.8 + (41.3 - 38.8) * rand::random::<f64>();
            let lon = -75.6 + (-73.8 + 75.6) * rand::random::<f64>();
            
            let agent = Agent {
                id: i,
                age: (18.0 + 62.0 * rand::random::<f64>()) as u8,
                wealth: 1000.0 + 9000.0 * rand::random::<f64>(),
                income: 10.0 + 90.0 * rand::random::<f64>(),
                health: 1.0,
                propensity_to_consume: 0.8,
                current_coord: spatial::Coordinate::new(lat, lon),
                home_location_id: 1, 
                employer_location_id: None,
                transport_id: Some(i),
                family_agent_ids: Vec::new(),
            };
            engine.agents.push(agent);
        }

        engine
    }

    pub fn tick(&mut self) {
        self.global_state.tick += 1;
        
        let mut speeds = HashMap::new();
        for t in &self.transports {
            speeds.insert(t.id, t.speed_mph);
        }
        
        for agent in &mut self.agents {
            if let Some(t_id) = agent.transport_id {
                let speed = *speeds.get(&t_id).unwrap_or(&0.0);
                // move agent. speed is mph. 1 degree is roughly 69 miles.
                let degrees_per_tick = speed / 69.0 / 60.0; // distance per tick mapped down
                
                let angle = rand::random::<f64>() * std::f64::consts::PI * 2.0;
                agent.current_coord.lat += angle.sin() * degrees_per_tick;
                agent.current_coord.lon += angle.cos() * degrees_per_tick;
            }
        }
    }
}

#[tokio::main]
async fn main() {
    println!("Initializing Nostradamus Engine...");
    let mut engine = SimulationEngine::new();
    
    // Create the shared state payload
    let shared_payload: Arc<Mutex<Option<SimulationPayload>>> = Arc::new(Mutex::new(None));
    let server_payload_ref = shared_payload.clone();
    
    // Spawn the WebSocket server in the background
    tokio::spawn(async move {
        server::start_websocket_server(server_payload_ref).await;
    });
    
    // Infinite simulation loop
    let mut ticker = tokio::time::interval(Duration::from_millis(16)); // ~60 ticks a second
    println!("Simulation Started! Booting async loop...");
    loop {
        ticker.tick().await;
        
        engine.tick();
        
        // Extract a sub-sample for the visualization to prevent freezing the frontend client
        let agents_sample: Vec<Agent> = engine.agents.iter().take(1000).cloned().collect();
        let locs_sample: Vec<Location> = engine.locations.values().take(500).cloned().collect();
        
        let payload = SimulationPayload {
            tick: engine.global_state.tick,
            global_metrics: engine.global_state.clone(),
            active_agents_subset: agents_sample,
            locations_subset: locs_sample,
        };
        
        // Push the payload to the socket state
        *shared_payload.lock().await = Some(payload);
        
        // Print progress every 1000 ticks heartbeat
        if engine.global_state.tick % 1000 == 0 {
            println!("Engine reached tick {}", engine.global_state.tick);
        }
    }
}
