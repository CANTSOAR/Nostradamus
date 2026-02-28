pub mod entities;
pub mod spatial;
pub mod state;

pub mod server;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;

use state::Global;
use spatial::{Building, BuildingType, Coordinate, County, Municipality, Parcel, Road, Tract};
use entities::{Agent, Business, Vehicle, VehicleType, Weather};
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
    pub tracts: HashMap<String, Tract>,
    pub municipalities: HashMap<String, Municipality>,
    pub counties: HashMap<String, County>,
    pub parcels: HashMap<u64, Parcel>,
    pub buildings: HashMap<u64, Building>,
    pub roads: HashMap<u64, Road>,
    pub businesses: HashMap<u64, Business>,
    pub agents: Vec<Agent>,
    pub vehicles: Vec<Vehicle>,
    pub active_weather: Vec<Weather>,
}

impl SimulationEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            global_state: Global::default(),
            tracts: HashMap::new(),
            municipalities: HashMap::new(),
            counties: HashMap::new(),
            parcels: HashMap::new(),
            buildings: HashMap::new(),
            roads: HashMap::new(),
            businesses: HashMap::new(),
            agents: Vec::new(),
            vehicles: Vec::new(),
            active_weather: Vec::new(),
        };

        // Load first 100 locations
        if let Ok(mut rdr) = csv::Reader::from_path("data/locations.csv") {
            let mut id_counter = 1;
            for result in rdr.deserialize().take(100) {
                if let Ok(rec) = result {
                    let rec: CsvLocation = rec;
                    let b_type = match rec.loc_type.as_str() {
                        "Store" => BuildingType::Commercial,
                        "Employer" => BuildingType::Commercial,
                        "Residential" => BuildingType::Residential,
                        "Public" => BuildingType::Public,
                        _ => BuildingType::Mixed,
                    };
                    let org_id = rec.org_id.parse::<u64>().ok();
                    let bld = Building {
                        id: id_counter,
                        coord: Coordinate::new(rec.lat, rec.lon),
                        building_type: b_type,
                        capacity: 100,
                        parcel_id: None,
                        wealth: 0.0,
                    };
                    if let Some(oid) = org_id {
                        engine.businesses.insert(oid, Business {
                            id: oid,
                            name: rec.name.clone(),
                            avg_revenue: 0.0,
                            avg_bills: 0.0,
                        });
                    }
                    engine.buildings.insert(id_counter, bld);
                    id_counter += 1;
                }
            }
        } else {
            println!("Warning: Could not load data/locations.csv");
        }

        // Generate 1000 agents
        for i in 1..=1000 {
            let speed = 5.0 + 55.0 * rand::random::<f64>(); // 5 to 60 mph
            
            let vehicle = Vehicle {
                id: i,
                vehicle_type: VehicleType::Car,
                capacity: 1,
                speed_mph: speed,
                route: Vec::new(),
            };
            engine.vehicles.push(vehicle);
            
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
                current_coord: Coordinate::new(lat, lon),
                home_building_id: 1, 
                employer_business_id: None,
                employer_building_id: None,
                vehicle_id: Some(i),
                family_agent_ids: Vec::new(),
            };
            engine.agents.push(agent);
        }

        engine
    }

    pub fn tick(&mut self) {
        self.global_state.tick += 1;
        
        let mut speeds = HashMap::new();
        for t in &self.vehicles {
            speeds.insert(t.id, t.speed_mph);
        }
        
        let is_daytime = self.global_state.tick % 1000 < 500; // 500 ticks represents day/night cycle
        
        for agent in &mut self.agents {
            let target_id = if is_daytime {
                agent.employer_building_id.unwrap_or(agent.home_building_id)
            } else {
                agent.home_building_id
            };

            if let Some(target_loc) = self.buildings.get(&target_id) {
                let target_coord = target_loc.coord;
                let dx = target_coord.lon - agent.current_coord.lon;
                let dy = target_coord.lat - agent.current_coord.lat;
                let dist = (dx * dx + dy * dy).sqrt();
                
                if dist > 0.001 {
                    if let Some(t_id) = agent.vehicle_id {
                        let speed = *speeds.get(&t_id).unwrap_or(&0.0);
                        let degrees_per_tick = speed / 69.0 / 60.0;
                        
                        let vx = (dx / dist) * degrees_per_tick;
                        let vy = (dy / dist) * degrees_per_tick;
                        
                        if degrees_per_tick >= dist {
                            agent.current_coord = target_coord;
                        } else {
                            agent.current_coord.lon += vx;
                            agent.current_coord.lat += vy;
                        }
                    }
                }
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
    let is_paused = Arc::new(AtomicBool::new(false));
    let server_paused_ref = is_paused.clone();
    
    // Spawn the WebSocket server in the background
    tokio::spawn(async move {
        server::start_websocket_server(server_payload_ref, server_paused_ref).await;
    });
    
    // Infinite simulation loop
    let mut ticker = tokio::time::interval(Duration::from_millis(16)); // ~60 ticks a second
    println!("Simulation Started! Booting async loop...");
    loop {
        ticker.tick().await;
        
        // Skip updating engine if Paused
        if is_paused.load(Ordering::SeqCst) {
            continue;
        }
        
        engine.tick();
        
        // Extract a sub-sample for the visualization to prevent freezing the frontend client
        let agents_sample: Vec<Agent> = engine.agents.iter().take(1000).cloned().collect();
        let buildings_sample: Vec<Building> = engine.buildings.values().take(500).cloned().collect();
        let businesses_sample: Vec<Business> = engine.businesses.values().take(500).cloned().collect();
        let vehicles_sample: Vec<Vehicle> = engine.vehicles.iter().take(500).cloned().collect();
        
        let payload = SimulationPayload {
            tick: engine.global_state.tick,
            global_metrics: engine.global_state.clone(),
            active_agents_subset: agents_sample,
            buildings_subset: buildings_sample,
            businesses_subset: businesses_sample,
            vehicles_subset: vehicles_sample,
        };
        
        // Push the payload to the socket state
        *shared_payload.lock().await = Some(payload);
        
        // Print progress every 1000 ticks heartbeat
        if engine.global_state.tick % 1000 == 0 {
            println!("Engine reached tick {}", engine.global_state.tick);
        }
    }
}
