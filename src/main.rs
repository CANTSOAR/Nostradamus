pub mod entities;
pub mod spatial;
pub mod state;

pub mod server;

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
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
                        wealth: 10000.0 + 90000.0 * rand::random::<f64>(),
                    };
                    engine.locations.insert(id_counter, loc);
                    id_counter += 1;
                }
            }
        } else {
            println!("Warning: Could not load data/locations.csv");
        }

        // Pre-fetch available locations for assignment
        let homes: Vec<u64> = engine.locations.iter()
            .filter(|(_, l)| l.location_type == spatial::LocationType::Residential)
            .map(|(id, _)| *id).collect();
            
        let workplaces: Vec<u64> = engine.locations.iter()
            .filter(|(_, l)| l.location_type == spatial::LocationType::Employer || l.location_type == spatial::LocationType::Store)
            .map(|(id, _)| *id).collect();

        let mut home_counts: HashMap<u64, usize> = HashMap::new();

        let num_agents = homes.len() as u64 * 2; // 2 agents per house max

        // Generate agents based on housing capacity
        for i in 1..=num_agents {
            let speed = 25.0 + 55.0 * rand::random::<f64>(); 
            
            let transport = Transport {
                id: i,
                transport_type: entities::TransportType::Car,
                capacity: 1,
                speed_mph: speed,
                route: Vec::new(),
            };
            engine.transports.push(transport);
            
            // Assign matched Home with Max capacity of 2
            let assigned_home = if homes.is_empty() {
                1
            } else {
                let h_id = homes.iter().copied().find(|&id| {
                    *home_counts.entry(id).or_insert(0) < 2
                }).unwrap_or(homes[0]);
                *home_counts.entry(h_id).or_insert(0) += 1;
                h_id
            };
            
            // Assign a random Workplace
            let assigned_work = if workplaces.is_empty() {
                None
            } else {
                Some(workplaces[i as usize % workplaces.len()])
            };

            // Start agent at their home coordinates
            let mut start_lat = 38.8;
            let mut start_lon = -75.0;
            if let Some(h_loc) = engine.locations.get(&assigned_home) {
                start_lat = h_loc.coord.lat;
                start_lon = h_loc.coord.lon;
            }
            
            let agent = Agent {
                id: i,
                age: (18.0 + 62.0 * rand::random::<f64>()) as u8,
                wealth: 1000.0 + 9000.0 * rand::random::<f64>(),
                income: 10.0 + 90.0 * rand::random::<f64>(),
                health: 1.0,
                propensity_to_consume: 0.8,
                current_coord: spatial::Coordinate::new(start_lat, start_lon),
                home_location_id: assigned_home, 
                employer_location_id: assigned_work,
                transport_id: Some(i),
                family_agent_ids: Vec::new(),
            };
            engine.agents.push(agent);
        }

        engine
    }

    pub fn tick(&mut self) {
        self.global_state.tick += 1;
        self.global_state.time_offset_seconds += 3600;
        
        // 1 Tick = 1 Hour
        let is_daily_tick = self.global_state.tick % 24 == 0;
        let is_yearly_tick = self.global_state.tick % 8760 == 0;
        
        // Process Organizational Finances (Daily)
        if is_daily_tick {
            for org in self.organizations.values_mut() {
                org.update_finances();
            }
            // Update physical location wealth based on Organization economy params
            for loc in self.locations.values_mut() {
                let mut base_rev = 15000.0; // Baseline independent economy
                let mut base_bills = 10000.0;
                
                if let Some(org_id) = loc.organization_id {
                    if let Some(org) = self.organizations.get(&org_id) {
                        base_rev = org.avg_revenue;
                        base_bills = org.avg_bills;
                    }
                }
                loc.update_finances(base_rev, base_bills);
            }
        }
        
        // Process Agent Lifecycles
        let mut deceased_agent_indices = Vec::new();
        
        for (idx, agent) in self.agents.iter_mut().enumerate() {
            if is_daily_tick {
                agent.update_finances();
                agent.update_health();
                
                // Death Check
                let is_starved = agent.health <= 0.0;
                let is_old = agent.age > 75 && rand::random::<f64>() < 0.01; // 1% chance per day over 75
                if is_starved || is_old {
                    deceased_agent_indices.push(idx);
                }
            }
            if is_yearly_tick {
                agent.update_age();
            }
        }
        
        // Reap the dead (iterate backwards to avoid index shifting bugs)
        for idx in deceased_agent_indices.into_iter().rev() {
            self.agents.remove(idx);
        }
        
        // Process Conception / Births (Daily)
        if is_daily_tick {
            let mut homes_with_two_adults = Vec::new();
            
            // Map home capacities for living agents
            let mut home_occupancy: HashMap<u64, Vec<&Agent>> = HashMap::new();
            for agent in &self.agents {
                home_occupancy.entry(agent.home_location_id).or_default().push(agent);
            }
            
            for (home_id, occupants) in home_occupancy {
                if occupants.len() == 2 && occupants[0].age >= 18 && occupants[1].age >= 18 {
                    homes_with_two_adults.push(home_id);
                }
            }
            
            let mut new_babies = Vec::new();
            for home_id in homes_with_two_adults {
                // 0.05% chance of a baby per eligible household per day
                if rand::random::<f64>() < 0.0005 {
                    let mut start_lat = 38.8;
                    let mut start_lon = -75.0;
                    if let Some(h_loc) = self.locations.get(&home_id) {
                        start_lat = h_loc.coord.lat;
                        start_lon = h_loc.coord.lon;
                    }
                    
                    let baby_id = self.global_state.tick + rand::random::<u64>(); // unique ID
                    let baby = Agent {
                        id: baby_id,
                        age: 0,
                        wealth: 0.0,
                        income: 0.0,
                        health: 1.0,
                        propensity_to_consume: 0.9,
                        current_coord: spatial::Coordinate::new(start_lat, start_lon),
                        home_location_id: home_id,
                        employer_location_id: None,
                        transport_id: None,
                        family_agent_ids: Vec::new(),
                    };
                    new_babies.push(baby);
                }
            }
            
            self.agents.extend(new_babies);
        }
        
        // Process Continuous Agent Movement
        let mut speeds = HashMap::new();
        for t in &self.transports {
            speeds.insert(t.id, t.speed_mph);
        }
        
        let is_daytime = self.global_state.tick % 1000 < 500; // 500 ticks represents day/night cycle
        
        for agent in &mut self.agents {
            let target_id = if is_daytime {
                agent.employer_location_id.unwrap_or(agent.home_location_id)
            } else {
                agent.home_location_id
            };

            if let Some(target_loc) = self.locations.get(&target_id) {
                let target_coord = target_loc.coord;
                let dx = target_coord.lon - agent.current_coord.lon;
                let dy = target_coord.lat - agent.current_coord.lat;
                let dist = (dx * dx + dy * dy).sqrt();
                
                if dist > 0.001 {
                    if let Some(t_id) = agent.transport_id {
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
    
    // Create the shared state payload and pause flag
    let shared_payload: Arc<Mutex<Option<SimulationPayload>>> = Arc::new(Mutex::new(None));
    let server_payload_ref = shared_payload.clone();
    let is_paused = Arc::new(AtomicBool::new(false));
    let server_paused_ref = is_paused.clone();
    
    // Spawn the WebSocket server in the background
    tokio::spawn(async move {
        server::start_websocket_server(server_payload_ref, server_paused_ref).await;
    });
    
    // Infinite simulation loop - highly optimized to 2ms delays
    let mut ticker = tokio::time::interval(Duration::from_millis(2));
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
        let locs_sample: Vec<Location> = engine.locations.values().take(500).cloned().collect();
        
        let payload = SimulationPayload {
            tick: engine.global_state.tick,
            global_metrics: engine.global_state.clone(),
            active_agents_subset: agents_sample,
            locations_subset: locs_sample,
            organizations: engine.organizations.clone(),
            transports: engine.transports.clone(),
        };
        
        // Push the payload to the socket state
        *shared_payload.lock().await = Some(payload);
        
        // Print progress every 1000 ticks heartbeat
        if engine.global_state.tick % 1000 == 0 {
            println!("Engine reached tick {}", engine.global_state.tick);
        }
    }
}
