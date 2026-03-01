pub mod state;
pub mod spatial;
pub mod entities;
pub mod server;
pub mod updates;

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::sync::Mutex;
use rayon::prelude::*;

use state::Global;
use spatial::Location;
use entities::{Agent, Organization, Transport, Weather, StateEntity};
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
    county: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CsvOrganization {
    id: u64,
    name: String,
    avg_revenue: f64,
    avg_bills: f64,
    industry: String,
}

/// The core Simulation Engine that ticks through time holding all state
#[derive(Debug)]
pub struct SimulationEngine {
    pub global_state: Global,
    pub state_entity: StateEntity,
    pub locations: HashMap<u64, Location>,
    pub organizations: HashMap<u64, Organization>,
    pub agents: Vec<Agent>,
    pub transports: Vec<Transport>,
    pub active_weather: Vec<Weather>,
    pub next_agent_id: u64,
    
    // === CACHED LOOKUP MAPS (rebuilt only when locations change) ===
    /// Non-residential locations bucketed by county
    pub county_destinations: HashMap<String, Vec<u64>>,
    /// Residential locations bucketed by county
    pub county_residential: HashMap<String, Vec<u64>>,
    /// Employer/Store locations bucketed by county  
    pub county_employers: HashMap<String, Vec<u64>>,
    /// All residential location IDs
    pub all_home_ids: Vec<u64>,
    /// All workplace IDs
    pub all_workplace_ids: Vec<u64>,
    /// Location coordinates for fast spatial lookups (id -> (lat, lon))
    pub loc_coords: HashMap<u64, (f64, f64)>,
    /// Org-to-sector-multiplier cache (rebuilt monthly)
    pub org_sector_cache: HashMap<u64, f64>,
    /// Employer location -> org -> sector mult cache
    pub employer_sector_cache: HashMap<u64, f64>,
    /// Flag indicating cached maps need rebuilding
    pub maps_dirty: bool,
}

impl SimulationEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            global_state: Global::default(),
            state_entity: StateEntity::default(),
            locations: HashMap::new(),
            organizations: HashMap::new(),
            agents: Vec::new(),
            transports: Vec::new(),
            active_weather: Vec::new(),
            next_agent_id: 100_000,
            county_destinations: HashMap::new(),
            county_residential: HashMap::new(),
            county_employers: HashMap::new(),
            all_home_ids: Vec::new(),
            all_workplace_ids: Vec::new(),
            loc_coords: HashMap::new(),
            org_sector_cache: HashMap::new(),
            employer_sector_cache: HashMap::new(),
            maps_dirty: true,
        };

        // Load Organizations
        if let Ok(mut rdr) = csv::Reader::from_path("data/organizations.csv") {
            for result in rdr.deserialize() {
                if let Ok(rec) = result {
                    let rec: CsvOrganization = rec;
                    let org = Organization {
                        id: rec.id,
                        name: rec.name,
                        industry: rec.industry,
                        avg_revenue: rec.avg_revenue,
                        avg_bills: rec.avg_bills,
                        total_funds: 0.0,
                    };
                    engine.organizations.insert(rec.id, org);
                }
            }
        } else {
            println!("Warning: Could not load data/organizations.csv");
        }

        // Load ALL locations (remove .take() limit for scalability)
        if let Ok(mut rdr) = csv::Reader::from_path("data/locations.csv") {
            let mut id_counter = 1u64;
            for result in rdr.deserialize() {
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
                        county: rec.county.clone(),
                        capacity: 100,
                        wealth: 10000.0 + 90000.0 * rand::random::<f64>(),
                    };
                    engine.locations.insert(id_counter, loc);
                    id_counter += 1;
                }
            }
            println!("Loaded {} locations from CSV", id_counter - 1);
        } else {
            println!("Warning: Could not load data/locations.csv");
        }

        // Build spatial caches
        engine.rebuild_cached_maps();

        // === SPATIAL GRID for nearest-workplace lookup (O(1) per home instead of O(N)) ===
        let grid_res = 0.05; // ~3.5 mile grid cells
        let mut workplace_grid: HashMap<(i32, i32), Vec<(u64, f64, f64)>> = HashMap::new();
        for &wid in &engine.all_workplace_ids {
            if let Some(&(lat, lon)) = engine.loc_coords.get(&wid) {
                let cell = ((lat / grid_res) as i32, (lon / grid_res) as i32);
                workplace_grid.entry(cell).or_default().push((wid, lat, lon));
            }
        }

        let mut agent_id_counter: u64 = 1;

        // Generate 1-2 agents per home
        for &home_id in &engine.all_home_ids.clone() {
            let occupants = if rand::random::<f64>() < 0.5 { 1 } else { 2 };
            
            let (home_lat, home_lon) = *engine.loc_coords.get(&home_id).unwrap_or(&(38.8, -75.0));
            let home_county = engine.locations.get(&home_id).and_then(|l| l.county.clone());
            
            // Spatial grid lookup: check 3x3 neighborhood for nearest employers
            let home_cell = ((home_lat / grid_res) as i32, (home_lon / grid_res) as i32);
            let mut nearby_workplaces: Vec<(u64, f64)> = Vec::new();
            for dx in -1..=1 {
                for dy in -1..=1 {
                    if let Some(bucket) = workplace_grid.get(&(home_cell.0 + dx, home_cell.1 + dy)) {
                        for &(wid, wlat, wlon) in bucket {
                            let d = (wlat - home_lat).powi(2) + (wlon - home_lon).powi(2);
                            nearby_workplaces.push((wid, d));
                        }
                    }
                }
            }
            nearby_workplaces.sort_unstable_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
            
            let nearest_employer = if nearby_workplaces.is_empty() {
                // Fallback: pick any workplace
                engine.all_workplace_ids.first().copied()
            } else {
                let top = nearby_workplaces.len().min(5);
                let pick = (rand::random::<f64>() * top as f64) as usize;
                Some(nearby_workplaces[pick.min(top - 1)].0)
            };
            
            let work_county = nearest_employer
                .and_then(|eid| engine.locations.get(&eid))
                .and_then(|l| l.county.clone());

            for _ in 0..occupants {
                let speed_mph = 25.0 + 55.0 * rand::random::<f64>();
                let degrees_per_tick = speed_mph / 69.0 / 60.0; // Pre-compute
                
                let transport = Transport {
                    id: agent_id_counter,
                    transport_type: entities::TransportType::Car,
                    capacity: 1,
                    speed_mph,
                    route: Vec::new(),
                };
                engine.transports.push(transport);
                
                let employer_id = if rand::random::<f64>() < 0.8 { nearest_employer } else { None };

                let agent = Agent {
                    id: agent_id_counter,
                    age: (18.0 + 62.0 * rand::random::<f64>()) as u8,
                    wealth: 1000.0 + 9000.0 * rand::random::<f64>(),
                    income: if employer_id.is_some() { 30000.0 + 120000.0 * rand::random::<f64>() } else { 10000.0 },
                    health: 1.0,
                    propensity_to_consume: 0.8,
                    speed: degrees_per_tick,
                    current_coord: spatial::Coordinate::new(home_lat, home_lon),
                    target_location_id: None,
                    home_location_id: home_id, 
                    home_county: home_county.clone(),
                    employer_location_id: employer_id,
                    work_county: work_county.clone(),
                    transport_id: Some(agent_id_counter),
                    family_agent_ids: Vec::new(),
                };
                engine.agents.push(agent);
                agent_id_counter += 1;
            }
        }
        
        engine.next_agent_id = agent_id_counter;
        println!("Generated {} agents across {} homes", engine.agents.len(), engine.all_home_ids.len());

        // Build sector caches
        engine.rebuild_sector_caches();

        engine
    }

    /// Rebuild all location-derived cached maps. Call when locations change.
    fn rebuild_cached_maps(&mut self) {
        self.county_destinations.clear();
        self.county_residential.clear();
        self.county_employers.clear();
        self.all_home_ids.clear();
        self.all_workplace_ids.clear();
        self.loc_coords.clear();
        
        for (&id, loc) in &self.locations {
            self.loc_coords.insert(id, (loc.coord.lat, loc.coord.lon));
            
            if let Some(ref c) = loc.county {
                match loc.location_type {
                    spatial::LocationType::Residential => {
                        self.county_residential.entry(c.clone()).or_default().push(id);
                        self.all_home_ids.push(id);
                    }
                    spatial::LocationType::Employer | spatial::LocationType::Store => {
                        self.county_destinations.entry(c.clone()).or_default().push(id);
                        self.county_employers.entry(c.clone()).or_default().push(id);
                        self.all_workplace_ids.push(id);
                    }
                    _ => {
                        self.county_destinations.entry(c.clone()).or_default().push(id);
                    }
                }
            }
        }
        self.maps_dirty = false;
    }

    /// Rebuild sector multiplier caches. Call when industry favorability changes.
    fn rebuild_sector_caches(&mut self) {
        self.org_sector_cache.clear();
        self.employer_sector_cache.clear();
        
        for (&id, org) in &self.organizations {
            let sm = *self.state_entity.sector_favorability
                .get(&org.industry).unwrap_or(&1.0);
            self.org_sector_cache.insert(id, sm);
        }
        
        // Pre-compute employer_location_id -> sector mult
        for (&loc_id, loc) in &self.locations {
            if let Some(org_id) = loc.organization_id {
                if let Some(&sm) = self.org_sector_cache.get(&org_id) {
                    self.employer_sector_cache.insert(loc_id, sm);
                }
            }
        }
    }

    pub fn tick(&mut self) {
        self.global_state.tick += 1;
        self.global_state.time_offset_seconds += 3600;
        self.global_state.day_of_week = ((self.global_state.tick / 24) % 7) as u8;
        
        let is_daily_tick = self.global_state.tick % 24 == 0;
        let is_yearly_tick = self.global_state.tick % 8760 == 0;
        let is_monthly_tick = self.global_state.tick % 720 == 0;
        
        // ========================================
        // MONTHLY: Policy + Industry Favorability + Cache Rebuild
        // ========================================
        if is_monthly_tick {
            crate::updates::update_state_policy(&mut self.state_entity);
            crate::updates::update_industry_favorability(&mut self.state_entity);
            self.rebuild_sector_caches(); // Refresh after favorability changes
        }
        
        // ========================================
        // DAILY BLOCK
        // ========================================
        if is_daily_tick {
            let day = self.global_state.day_of_week;
            
            // --- Org Finances (with cached sector multipliers) ---
            let org_cache = &self.org_sector_cache;
            for org in self.organizations.values_mut() {
                let sector_mult = *org_cache.get(&org.id).unwrap_or(&1.0);
                crate::updates::update_org_finances(org, day, sector_mult);
            }
            
            // --- Location Finances (parallel-safe using cached lookups) ---
            // Snapshot org data for location finance updates
            let org_data: HashMap<u64, (f64, f64, f64)> = self.organizations.iter()
                .map(|(&id, org)| {
                    let sm = *self.org_sector_cache.get(&id).unwrap_or(&1.0);
                    (id, (org.avg_revenue, org.avg_bills, sm))
                }).collect();
            
            for loc in self.locations.values_mut() {
                let (base_rev, base_bills, sector_mult) = loc.organization_id
                    .and_then(|oid| org_data.get(&oid).copied())
                    .unwrap_or((15000.0, 10000.0, 1.0));
                crate::updates::update_location_finances(loc, base_rev, base_bills, day, sector_mult);
            }
            
            // --- State Cash Flow ---
            crate::updates::update_state_cashflow(
                &mut self.state_entity, &self.agents, &self.organizations
            );
            
            // --- Weather ---
            crate::updates::update_weather(&mut self.active_weather);
            
            // --- Extreme Events ---
            crate::updates::apply_extreme_event(
                &mut self.agents,
                &mut self.organizations,
                &mut self.locations,
                &mut self.state_entity,
            );
        }
        
        // ========================================
        // AGENT LIFECYCLES (Rayon parallel where possible)
        // ========================================
        
        if is_daily_tick {
            let day = self.global_state.day_of_week;
            let employer_sector_cache = &self.employer_sector_cache;
            let _locations = &self.locations;
            let state_entity = &self.state_entity;
            
            // PARALLEL: Update finances, health, and mark for removal in one pass
            // Each agent gets a flag: 0 = alive, 1 = dead, 2 = emigrated
            let removal_flags: Vec<u8> = self.agents.par_iter_mut().map(|agent| {
                let sb = agent.employer_location_id
                    .and_then(|eid| employer_sector_cache.get(&eid))
                    .copied()
                    .unwrap_or(1.0);
                
                crate::updates::update_agent_finances(agent, day, sb);
                crate::updates::update_agent_health(agent);
                
                if crate::updates::check_agent_death(agent) { return 1; }
                if crate::updates::check_emigration(agent, state_entity) { return 2; }
                0
            }).collect();
            
            // FAST REMOVAL: retain only living agents (O(n) scan, no shifting)
            let mut flag_idx = 0;
            self.agents.retain(|_| {
                let keep = removal_flags[flag_idx] == 0;
                flag_idx += 1;
                keep
            });
        }
        
        if is_yearly_tick {
            // PARALLEL: Age all agents
            self.agents.par_iter_mut().for_each(|agent| {
                crate::updates::update_agent_age(agent);
            });
        }
        
        // ========================================
        // DAILY: Home Moves, Job Changes, Conception, Immigration
        // ========================================
        if is_daily_tick {
            // --- Home Moves (parallel read, sequential write for county changes) ---
            let county_res = &self.county_residential;
            let locations = &self.locations;
            let move_results: Vec<Option<u64>> = self.agents.par_iter().map(|agent| {
                if let Some(ref hc) = agent.home_county {
                    let res = county_res.get(hc).map(|v| v.as_slice()).unwrap_or(&[]);
                    crate::updates::check_home_move(agent, res, locations)
                } else { None }
            }).collect();
            
            for (i, new_home) in move_results.into_iter().enumerate() {
                if let Some(home_id) = new_home {
                    self.agents[i].home_location_id = home_id;
                    self.agents[i].home_county = self.locations.get(&home_id)
                        .and_then(|l| l.county.clone());
                    self.agents[i].target_location_id = None; // Reset target
                }
            }
            
            // --- Job Changes (parallel) ---
            let county_emp = &self.county_employers;
            let job_results: Vec<Option<u64>> = self.agents.par_iter().map(|agent| {
                let county = agent.home_county.as_ref().or(agent.work_county.as_ref());
                if let Some(c) = county {
                    let emp = county_emp.get(c).map(|v| v.as_slice()).unwrap_or(&[]);
                    crate::updates::check_job_change(agent, emp)
                } else { None }
            }).collect();
            
            for (i, new_job) in job_results.into_iter().enumerate() {
                if let Some(job_id) = new_job {
                    self.agents[i].employer_location_id = Some(job_id);
                    self.agents[i].work_county = self.locations.get(&job_id)
                        .and_then(|l| l.county.clone());
                    self.agents[i].income *= 0.7 + 0.6 * rand::random::<f64>();
                }
            }
            
            // --- Conception (sequential — needs home_occupancy grouping) ---
            let mut home_occupancy: HashMap<u64, Vec<usize>> = HashMap::new();
            for (i, agent) in self.agents.iter().enumerate() {
                home_occupancy.entry(agent.home_location_id).or_default().push(i);
            }
            
            let mut new_babies = Vec::new();
            for (_home_id, indices) in &home_occupancy {
                if indices.len() == 2 {
                    let a1 = &self.agents[indices[0]];
                    let a2 = &self.agents[indices[1]];
                    if a1.age >= 18 && a2.age >= 18 {
                        let occupants = vec![a1, a2];
                        if crate::updates::check_conception(&occupants) {
                            let home_id = a1.home_location_id;
                            let (lat, lon) = *self.loc_coords.get(&home_id).unwrap_or(&(38.8, -75.0));
                            let hc = self.locations.get(&home_id).and_then(|l| l.county.clone());
                            
                            self.next_agent_id += 1;
                            new_babies.push(Agent {
                                id: self.next_agent_id,
                                age: 0, wealth: 0.0, income: 0.0, health: 1.0,
                                propensity_to_consume: 0.9,
                                speed: 0.0, // Baby has no transport
                                current_coord: spatial::Coordinate::new(lat, lon),
                                target_location_id: None,
                                home_location_id: home_id,
                                home_county: hc,
                                employer_location_id: None, work_county: None,
                                transport_id: None, family_agent_ids: Vec::new(),
                            });
                        }
                    }
                }
            }
            self.agents.extend(new_babies);
            
            // --- Immigration ---
            let imm_count = crate::updates::calc_immigration_count(&self.state_entity, self.all_home_ids.len());
            for _ in 0..imm_count {
                if self.all_home_ids.is_empty() { break; }
                let home_id = self.all_home_ids[(rand::random::<f64>() * self.all_home_ids.len() as f64) as usize % self.all_home_ids.len()];
                let (lat, lon) = *self.loc_coords.get(&home_id).unwrap_or(&(38.8, -75.0));
                let hc = self.locations.get(&home_id).and_then(|l| l.county.clone());
                
                let employer_id = if self.all_workplace_ids.is_empty() { None }
                    else { Some(self.all_workplace_ids[(rand::random::<f64>() * self.all_workplace_ids.len() as f64) as usize % self.all_workplace_ids.len()]) };
                let wc = employer_id.and_then(|eid| self.locations.get(&eid)).and_then(|l| l.county.clone());
                
                let speed_mph = 25.0 + 55.0 * rand::random::<f64>();
                self.next_agent_id += 1;
                self.agents.push(Agent {
                    id: self.next_agent_id,
                    age: (20.0 + 40.0 * rand::random::<f64>()) as u8,
                    wealth: 2000.0 + 20000.0 * rand::random::<f64>(),
                    income: if employer_id.is_some() { 25000.0 + 75000.0 * rand::random::<f64>() } else { 10000.0 },
                    health: 0.7 + 0.3 * rand::random::<f64>(),
                    propensity_to_consume: 0.7 + 0.2 * rand::random::<f64>(),
                    speed: speed_mph / 69.0 / 60.0,
                    current_coord: spatial::Coordinate::new(lat, lon),
                    target_location_id: None,
                    home_location_id: home_id, home_county: hc,
                    employer_location_id: employer_id, work_county: wc,
                    transport_id: None, family_agent_ids: Vec::new(),
                });
            }
        }
        
        // ========================================
        // CONTINUOUS: Agent Movement (PARALLEL + sticky targeting)
        // ========================================
        let tick = self.global_state.tick;
        let day_of_week = self.global_state.day_of_week;
        let is_bad_weather = !self.active_weather.is_empty();
        let county_dests = &self.county_destinations;
        let loc_coords = &self.loc_coords;
        
        self.agents.par_iter_mut().for_each(|agent| {
            // Only pick a new destination if we have none or have arrived
            let needs_new_target = match agent.target_location_id {
                None => true,
                Some(tid) => {
                    if let Some(&(tlat, tlon)) = loc_coords.get(&tid) {
                        let dx = tlon - agent.current_coord.lon;
                        let dy = tlat - agent.current_coord.lat;
                        (dx * dx + dy * dy) < 0.000001 // squared threshold
                    } else { true }
                }
            };
            
            if needs_new_target {
                let target_id = crate::updates::determine_agent_target(
                    agent, tick, day_of_week, is_bad_weather, county_dests
                );
                agent.target_location_id = Some(target_id);
            }
            
            // Move towards the committed target using inlined speed
            if let Some(target_id) = agent.target_location_id {
                if let Some(&(tlat, tlon)) = loc_coords.get(&target_id) {
                    let dx = tlon - agent.current_coord.lon;
                    let dy = tlat - agent.current_coord.lat;
                    let dist_sq = dx * dx + dy * dy;
                    
                    if dist_sq > 0.000001 {
                        let dist = dist_sq.sqrt();
                        let spd = agent.speed;
                        
                        if spd >= dist {
                            agent.current_coord.lat = tlat;
                            agent.current_coord.lon = tlon;
                            agent.target_location_id = None;
                        } else if spd > 0.0 {
                            agent.current_coord.lon += (dx / dist) * spd;
                            agent.current_coord.lat += (dy / dist) * spd;
                        }
                    } else {
                        agent.target_location_id = None;
                    }
                }
            }
        });
    }
}

#[tokio::main]
async fn main() {
    println!("Initializing Nostradamus Engine...");
    let mut engine = SimulationEngine::new();
    
    let shared_payload: Arc<Mutex<Option<SimulationPayload>>> = Arc::new(Mutex::new(None));
    let server_payload_ref = shared_payload.clone();
    let is_paused = Arc::new(AtomicBool::new(false));
    let server_paused_ref = is_paused.clone();
    
    tokio::spawn(async move {
        server::start_websocket_server(server_payload_ref, server_paused_ref).await;
    });
    
    let mut ticker = tokio::time::interval(Duration::from_millis(2));
    println!("Simulation Started! Booting async loop...");
    
    let mut payload_tick_counter = 0u64;
    
    loop {
        ticker.tick().await;
        
        if is_paused.load(Ordering::SeqCst) {
            continue;
        }
        
        engine.tick();
        
        // Only build payload every 5 ticks (reduces serialization overhead)
        payload_tick_counter += 1;
        if payload_tick_counter % 5 == 0 {
            let agents_sample: Vec<Agent> = engine.agents.iter().take(1000).cloned().collect();
            let locs_sample: Vec<Location> = engine.locations.values().take(500).cloned().collect();
            
            let payload = SimulationPayload {
                tick: engine.global_state.tick,
                global_metrics: engine.global_state.clone(),
                active_agents_subset: agents_sample,
                locations_subset: locs_sample,
                organizations: engine.organizations.clone(),
                transports: Vec::new(), // Don't send full transport list (redundant with agent.speed)
            };
            
            *shared_payload.lock().await = Some(payload);
        }
        
        if engine.global_state.tick % 1000 == 0 {
            println!("Tick {} | Agents: {} | State Cash: ${:.0} | Economy: ${:.0}", 
                engine.global_state.tick, 
                engine.agents.len(),
                engine.state_entity.cash_reserves,
                engine.state_entity.total_economy_value
            );
        }
    }
}
