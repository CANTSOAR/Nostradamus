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
    value: Option<f64>,
    tax: Option<f64>,
    county: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CsvOrganization {
    id: u32,
    name: String,
    #[serde(default)]
    value: f64,
    avg_revenue: f64,
    avg_bills: f64,
    industry: String,
}

#[derive(Debug, Deserialize)]
struct CsvMuniPop {
    county: String,
    municipality: String,
    population: u32,
}

#[derive(Debug, Deserialize)]
struct CsvCountyDemographics {
    county: String,
    total_population: u32,
    median_household_income: f64,
    _median_age: f64,
    avg_household_size: f64,
    _pct_under_18: f64,
    pct_18_to_34: f64,
    _pct_35_to_64: f64,
    pct_65_plus: f64,
    vacancy_rate: f64,
    unemployment_rate: f64,
}

/// County-level demographic profile
#[derive(Debug, Clone)]
struct CountyProfile {
    population: u32,
    median_income: f32,
    avg_household_size: f32,
    pct_18_to_34: f32,
    _pct_65_plus: f32,
    vacancy_rate: f32,
    unemployment_rate: f32,
}

impl Default for CountyProfile {
    fn default() -> Self {
        Self {
            population: 100_000,
            median_income: 70_000.0,
            avg_household_size: 2.5,
            pct_18_to_34: 0.18,
            _pct_65_plus: 0.20,
            vacancy_rate: 0.06,
            unemployment_rate: 0.05,
        }
    }
}

/// The core Simulation Engine
#[derive(Debug)]
pub struct SimulationEngine {
    pub global_state: Global,
    pub state_entity: StateEntity,
    pub locations: HashMap<u32, Location>,
    pub organizations: HashMap<u32, Organization>,
    pub agents: Vec<Agent>,
    pub transports: Vec<Transport>,
    pub active_weather: Vec<Weather>,
    pub next_agent_id: u32,
    
    // === CACHED LOOKUP MAPS ===
    pub county_destinations: HashMap<u8, Vec<u32>>,
    pub county_residential: HashMap<u8, Vec<u32>>,
    pub county_employers: HashMap<u8, Vec<u32>>,
    pub all_home_ids: Vec<u32>,
    pub all_workplace_ids: Vec<u32>,
    pub loc_coords: HashMap<u32, (f32, f32)>,
    pub org_sector_cache: HashMap<u32, f32>,
    pub employer_sector_cache: HashMap<u32, f32>,
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

        // ====================================================
        // LOAD ORGANIZATIONS
        // ====================================================
        if let Ok(mut rdr) = csv::Reader::from_path("data/clean/organizations.csv") {
            for result in rdr.deserialize() {
                if let Ok(rec) = result {
                    let rec: CsvOrganization = rec;
                    let org = Organization {
                        id: rec.id,
                        name: rec.name,
                        industry: rec.industry,
                        value: rec.value,
                        avg_revenue: rec.avg_revenue,
                        avg_bills: rec.avg_bills,
                        total_funds: 0.0,
                    };
                    engine.organizations.insert(rec.id, org);
                }
            }
        } else {
            println!("Warning: Could not load data/clean/organizations.csv");
        }

        // ====================================================
        // LOAD LOCATIONS
        // ====================================================
        let mut destiny_seed: u64 = 0xDEAD_BEEF_CAFE_BABE;

        if let Ok(mut rdr) = csv::Reader::from_path("data/clean/locations.csv") {
            let mut id_counter = 1u32;
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
                    let org_id = rec.org_id.parse::<u32>().ok();
                    let county_id = rec.county.as_deref()
                        .map(spatial::county_to_id)
                        .unwrap_or(spatial::COUNTY_UNKNOWN);

                    // Name: None for residential to save ~80MB
                    let name = if l_type == spatial::LocationType::Residential {
                        None
                    } else {
                        Some(rec.name.clone())
                    };

                    // Destiny: unique hash per location
                    destiny_seed = destiny_seed.wrapping_mul(6364136223846793005).wrapping_add(id_counter as u64);

                    let loc = Location {
                        id: id_counter,
                        name,
                        coord: spatial::Coordinate::new(rec.lat as f32, rec.lon as f32),
                        location_type: l_type,
                        organization_id: org_id,
                        county: county_id,
                        value: rec.value.unwrap_or(0.0) as f32,
                        tax: rec.tax.unwrap_or(0.0) as f32,
                        current_count: 0,
                        destiny: destiny_seed,
                    };
                    engine.locations.insert(id_counter, loc);
                    id_counter += 1;
                }
            }
            println!("Loaded {} locations from CSV", id_counter - 1);
        } else {
            println!("Warning: Could not load data/clean/locations.csv");
        }

        // ====================================================
        // COMPUTE ORG VALUES
        // ====================================================
        let mut org_loc_sums: HashMap<u32, f64> = HashMap::new();
        for loc in engine.locations.values() {
            if let Some(org_id) = loc.organization_id {
                *org_loc_sums.entry(org_id).or_default() += loc.value as f64;
            }
        }
        for (org_id, loc_sum) in &org_loc_sums {
            if let Some(org) = engine.organizations.get_mut(org_id) {
                org.value = loc_sum * 1.20 + org.total_funds;
            }
        }

        // ====================================================
        // LOAD DEMOGRAPHICS
        // ====================================================
        let mut county_profiles: HashMap<u8, CountyProfile> = HashMap::new();
        
        if let Ok(mut rdr) = csv::Reader::from_path("data/clean/nj_county_demographics.csv") {
            for result in rdr.deserialize() {
                if let Ok(rec) = result {
                    let rec: CsvCountyDemographics = rec;
                    let cid = spatial::county_to_id(&rec.county);
                    county_profiles.insert(cid, CountyProfile {
                        population: rec.total_population,
                        median_income: rec.median_household_income as f32,
                        avg_household_size: rec.avg_household_size as f32,
                        pct_18_to_34: rec.pct_18_to_34 as f32,
                        _pct_65_plus: rec.pct_65_plus as f32,
                        vacancy_rate: rec.vacancy_rate as f32,
                        unemployment_rate: rec.unemployment_rate as f32,
                    });
                }
            }
            println!("Loaded {} county demographic profiles", county_profiles.len());
        } else {
            println!("Warning: Could not load county demographics, using defaults");
        }

        // Municipality population budgets
        let mut _muni_pop: HashMap<String, u32> = HashMap::new();
        if let Ok(mut rdr) = csv::Reader::from_path("data/clean/nj_muni_population.csv") {
            for result in rdr.deserialize() {
                if let Ok(rec) = result {
                    let rec: CsvMuniPop = rec;
                    _muni_pop.insert(format!("{}|{}", rec.county, rec.municipality), rec.population);
                }
            }
        }

        // ====================================================
        // BUILD SPATIAL CACHES
        // ====================================================
        engine.rebuild_cached_maps();

        // Spatial grid for nearest-workplace (O(1) per home)
        let grid_res: f32 = 0.05;
        let mut workplace_grid: HashMap<(i32, i32), Vec<(u32, f32, f32, f64)>> = HashMap::new();
        for &wid in &engine.all_workplace_ids {
            if let Some(&(lat, lon)) = engine.loc_coords.get(&wid) {
                let org_val = engine.locations.get(&wid)
                    .and_then(|l| l.organization_id)
                    .and_then(|oid| engine.organizations.get(&oid))
                    .map(|o| o.value)
                    .unwrap_or(100_000.0);
                let cell = ((lat / grid_res) as i32, (lon / grid_res) as i32);
                workplace_grid.entry(cell).or_default().push((wid, lat, lon, org_val));
            }
        }

        // Pre-sort homes by value per county
        let mut county_home_values: HashMap<u8, Vec<(u32, f32)>> = HashMap::new();
        for &hid in &engine.all_home_ids {
            if let Some(loc) = engine.locations.get(&hid) {
                county_home_values.entry(loc.county).or_default().push((hid, loc.value));
            }
        }
        for homes in county_home_values.values_mut() {
            homes.sort_unstable_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        }

        // ====================================================
        // POPULATION-DRIVEN AGENT GENERATION WITH DESTINY
        // ====================================================
        let mut agent_id_counter: u32 = 1;
        let mut total_generated: u32 = 0;
        let mut agent_destiny_seed: u64 = 0xCAFE_DEAD_BEEF_1234;

        let county_ids: Vec<u8> = county_home_values.keys().copied().collect();
        
        for &county_id in &county_ids {
            let profile = county_profiles.get(&county_id).cloned().unwrap_or_default();
            let homes = match county_home_values.get(&county_id) {
                Some(h) => h,
                None => continue,
            };
            if homes.is_empty() { continue; }
            
            let county_pop = profile.population;
            let num_homes = homes.len() as f32;
            let occupied_homes = ((1.0 - profile.vacancy_rate) * num_homes) as usize;
            let mut remaining_pop = county_pop as i64;
            
            for (rank, &(home_id, home_value)) in homes.iter().enumerate() {
                if remaining_pop <= 0 || rank >= occupied_homes { break; }
                
                let (home_lat, home_lon) = *engine.loc_coords.get(&home_id).unwrap_or(&(40.0, -74.5));
                let value_pctile = rank as f32 / num_homes;
                
                // Household size from destiny
                agent_destiny_seed = agent_destiny_seed.wrapping_mul(6364136223846793005).wrapping_add(home_id as u64);
                let hh_fate = spatial::fate(agent_destiny_seed, 0, 0);
                let lambda = profile.avg_household_size;
                let raw_size = lambda + (hh_fate - 0.5) * 2.0;
                let hh_size = (raw_size.round() as i64).max(1).min(6).min(remaining_pop) as u8;
                if hh_size == 0 { continue; }
                remaining_pop -= hh_size as i64;
                
                // Family ages
                let ages = generate_family_ages(hh_size, &profile, agent_destiny_seed);
                
                // Income correlation
                let income_mult = 0.4 + 1.2 * value_pctile;
                let base_income = profile.median_income * income_mult;
                
                // Nearby workplaces
                let home_cell = ((home_lat / grid_res) as i32, (home_lon / grid_res) as i32);
                let mut nearby_workplaces: Vec<(u32, f32, f64)> = Vec::new();
                for dx in -1..=1 {
                    for dy in -1..=1 {
                        if let Some(bucket) = workplace_grid.get(&(home_cell.0 + dx, home_cell.1 + dy)) {
                            for &(wid, wlat, wlon, wval) in bucket {
                                let d = (wlat - home_lat).powi(2) + (wlon - home_lon).powi(2);
                                nearby_workplaces.push((wid, d, wval));
                            }
                        }
                    }
                }
                nearby_workplaces.sort_unstable_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
                
                // Transport tier
                let speed_mph = transport_speed_for_percentile(value_pctile);
                let degrees_per_tick = speed_mph / 69.0 / 60.0;
                
                // Generate agents
                let mut family_ids: Vec<u32> = Vec::with_capacity(hh_size as usize);
                let first_id = agent_id_counter;
                
                for i in 0..hh_size as usize {
                    // Unique destiny per agent
                    agent_destiny_seed = agent_destiny_seed.wrapping_mul(2654435761).wrapping_add(agent_id_counter as u64);
                    let destiny = agent_destiny_seed;
                    
                    let age = ages[i];
                    let is_working_age = age >= 18 && age < 65;
                    let employed_fate = spatial::fate(destiny, 0, 10);
                    let is_employed = is_working_age && employed_fate > profile.unemployment_rate;
                    
                    // Value-weighted employer
                    let employer_id = if is_employed {
                        pick_employer(&nearby_workplaces, value_pctile, destiny, &engine.all_workplace_ids)
                    } else { None };
                    
                    let income_fate = spatial::fate(destiny, 0, 11);
                    let agent_income = if !is_working_age {
                        if age >= 65 { base_income * 0.4 } else { 0.0 }
                    } else if is_employed {
                        base_income * (0.8 + 0.4 * income_fate)
                    } else {
                        base_income * 0.15
                    };
                    
                    let wealth_fate = spatial::fate(destiny, 0, 12);
                    let wealth = home_value * 0.05 * (1.0 + age as f32 / 80.0)
                        + agent_income * 0.5 * wealth_fate;
                    
                    family_ids.push(agent_id_counter);
                    
                    let health_fate = spatial::fate(destiny, 0, 13);
                    
                    engine.agents.push(Agent {
                        id: agent_id_counter,
                        age,
                        county: county_id,
                        destiny,
                        wealth,
                        income: agent_income,
                        propensity_to_consume: 0.75 + 0.15 * spatial::fate(destiny, 0, 14),
                        health: if age < 65 { 0.85 + 0.15 * health_fate } else { 0.5 + 0.4 * health_fate },
                        speed: if age >= 16 { degrees_per_tick } else { degrees_per_tick * 0.3 },
                        current_coord: spatial::Coordinate::new(home_lat, home_lon),
                        target_location_id: None,
                        home_location_id: home_id,
                        employer_location_id: employer_id,
                        family_agent_ids: Vec::new(),
                    });
                    
                    agent_id_counter += 1;
                }
                
                // Cross-link family
                for i in 0..hh_size as usize {
                    let my_id = first_id + i as u32;
                    let siblings: Vec<u32> = family_ids.iter().copied().filter(|&fid| fid != my_id).collect();
                    let agent_idx = engine.agents.len() - hh_size as usize + i;
                    engine.agents[agent_idx].family_agent_ids = siblings;
                }
                
                if let Some(loc) = engine.locations.get_mut(&home_id) {
                    loc.current_count = hh_size as u16;
                }
                
                total_generated += hh_size as u32;
            }
            
            println!("  {} — target: {} | generated: {} | homes: {}",
                spatial::county_name(county_id), county_pop, total_generated, homes.len());
        }
        
        engine.next_agent_id = agent_id_counter;
        engine.state_entity.population = total_generated;
        println!("Total agents generated: {}", total_generated);

        engine.rebuild_sector_caches();
        engine
    }

    /// Rebuild all location-derived cached maps.
    fn rebuild_cached_maps(&mut self) {
        self.county_destinations.clear();
        self.county_residential.clear();
        self.county_employers.clear();
        self.all_home_ids.clear();
        self.all_workplace_ids.clear();
        self.loc_coords.clear();
        
        for (&id, loc) in &self.locations {
            self.loc_coords.insert(id, (loc.coord.lat, loc.coord.lon));
            let c = loc.county;
            
            match loc.location_type {
                spatial::LocationType::Residential => {
                    self.county_residential.entry(c).or_default().push(id);
                    self.all_home_ids.push(id);
                }
                spatial::LocationType::Employer | spatial::LocationType::Store => {
                    self.county_destinations.entry(c).or_default().push(id);
                    self.county_employers.entry(c).or_default().push(id);
                    self.all_workplace_ids.push(id);
                }
                _ => {
                    self.county_destinations.entry(c).or_default().push(id);
                }
            }
        }
        self.maps_dirty = false;
    }

    /// Rebuild sector multiplier caches.
    fn rebuild_sector_caches(&mut self) {
        self.org_sector_cache.clear();
        self.employer_sector_cache.clear();
        
        for (&id, org) in &self.organizations {
            let sm = *self.state_entity.sector_favorability
                .get(&org.industry).unwrap_or(&1.0);
            self.org_sector_cache.insert(id, sm);
        }
        
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
        
        if is_monthly_tick {
            crate::updates::update_state_policy(&mut self.state_entity);
            crate::updates::update_industry_favorability(&mut self.state_entity);
            self.rebuild_sector_caches();
        }
        
        if is_daily_tick {
            let day = self.global_state.day_of_week;
            let tick = self.global_state.tick;
            
            let org_cache = &self.org_sector_cache;
            for org in self.organizations.values_mut() {
                let sector_mult = *org_cache.get(&org.id).unwrap_or(&1.0);
                crate::updates::update_org_finances(org, day, sector_mult);
            }
            
            let org_data: HashMap<u32, (f64, f64, f32)> = self.organizations.iter()
                .map(|(&id, org)| {
                    let sm = *self.org_sector_cache.get(&id).unwrap_or(&1.0);
                    (id, (org.avg_revenue, org.avg_bills, sm))
                }).collect();
            
            for loc in self.locations.values_mut() {
                let (base_rev, base_bills, sector_mult) = loc.organization_id
                    .and_then(|oid| org_data.get(&oid).copied())
                    .unwrap_or((15000.0, 10000.0, 1.0));
                crate::updates::update_location_finances(loc, base_rev, base_bills, day, sector_mult, tick);
            }
            
            crate::updates::update_state_cashflow(
                &mut self.state_entity, &self.agents, &self.organizations
            );
            crate::updates::update_weather(&mut self.active_weather);
            crate::updates::apply_extreme_event(
                &mut self.agents, &mut self.organizations,
                &mut self.locations, &mut self.state_entity,
            );
        }
        
        // AGENT LIFECYCLES (Rayon parallel + destiny hash)
        if is_daily_tick {
            let day = self.global_state.day_of_week;
            let tick = self.global_state.tick;
            let employer_sector_cache = &self.employer_sector_cache;
            let state_entity = &self.state_entity;
            
            let removal_flags: Vec<u8> = self.agents.par_iter_mut().map(|agent| {
                let sb = agent.employer_location_id
                    .and_then(|eid| employer_sector_cache.get(&eid))
                    .copied().unwrap_or(1.0);
                crate::updates::update_agent_finances(agent, day, sb, tick);
                crate::updates::update_agent_health(agent, tick);
                if crate::updates::check_agent_death(agent, tick) { return 1; }
                if crate::updates::check_emigration(agent, state_entity, tick) { return 2; }
                0
            }).collect();
            
            let mut flag_idx = 0;
            self.agents.retain(|_| {
                let keep = removal_flags[flag_idx] == 0;
                flag_idx += 1;
                keep
            });
        }
        
        if is_yearly_tick {
            self.agents.par_iter_mut().for_each(|agent| {
                crate::updates::update_agent_age(agent);
            });
        }
        
        // DAILY: Home Moves, Job Changes, Conception, Immigration
        if is_daily_tick {
            let tick = self.global_state.tick;
            let county_res = &self.county_residential;
            let locations = &self.locations;
            let move_results: Vec<Option<u32>> = self.agents.par_iter().map(|agent| {
                let res = county_res.get(&agent.county).map(|v| v.as_slice()).unwrap_or(&[]);
                crate::updates::check_home_move(agent, res, locations, tick)
            }).collect();
            
            for (i, new_home) in move_results.into_iter().enumerate() {
                if let Some(home_id) = new_home {
                    let new_county = self.locations.get(&home_id)
                        .map(|l| l.county)
                        .unwrap_or(spatial::COUNTY_UNKNOWN);
                    self.agents[i].home_location_id = home_id;
                    self.agents[i].county = new_county;
                    self.agents[i].target_location_id = None;
                }
            }
            
            let county_emp = &self.county_employers;
            let job_results: Vec<Option<u32>> = self.agents.par_iter().map(|agent| {
                let emp = county_emp.get(&agent.county).map(|v| v.as_slice()).unwrap_or(&[]);
                crate::updates::check_job_change(agent, emp, tick)
            }).collect();
            
            for (i, new_job) in job_results.into_iter().enumerate() {
                if let Some(job_id) = new_job {
                    self.agents[i].employer_location_id = Some(job_id);
                    let jitter = spatial::fate(self.agents[i].destiny, tick, 50);
                    self.agents[i].income *= 0.7 + 0.6 * jitter;
                }
            }
            
            // Conception
            let mut home_occupancy: HashMap<u32, Vec<usize>> = HashMap::new();
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
                        if crate::updates::check_conception(&occupants, self.global_state.tick) {
                            let home_id = a1.home_location_id;
                            let (lat, lon) = *self.loc_coords.get(&home_id).unwrap_or(&(40.0, -74.5));
                            let county = a1.county;
                            
                            self.next_agent_id += 1;
                            let baby_destiny = a1.destiny.wrapping_mul(a2.destiny).wrapping_add(self.global_state.tick);
                            new_babies.push(Agent {
                                id: self.next_agent_id,
                                age: 0, county, destiny: baby_destiny,
                                wealth: 0.0, income: 0.0, health: 1.0,
                                propensity_to_consume: 0.9,
                                speed: 0.0,
                                current_coord: spatial::Coordinate::new(lat, lon),
                                target_location_id: None,
                                home_location_id: home_id,
                                employer_location_id: None,
                                family_agent_ids: Vec::new(),
                            });
                        }
                    }
                }
            }
            self.agents.extend(new_babies);
            
            // Immigration
            let imm_count = crate::updates::calc_immigration_count(&self.state_entity, self.all_home_ids.len());
            for _ in 0..imm_count {
                if self.all_home_ids.is_empty() { break; }
                self.next_agent_id += 1;
                let imm_destiny = (self.next_agent_id as u64).wrapping_mul(0xBEEF_CAFE_1234_5678);
                let home_idx = (spatial::fate(imm_destiny, 0, 0) * self.all_home_ids.len() as f32) as usize % self.all_home_ids.len();
                let home_id = self.all_home_ids[home_idx];
                let (lat, lon) = *self.loc_coords.get(&home_id).unwrap_or(&(40.0, -74.5));
                let county = self.locations.get(&home_id).map(|l| l.county).unwrap_or(spatial::COUNTY_UNKNOWN);
                
                let employer_id = if self.all_workplace_ids.is_empty() { None }
                    else {
                        let widx = (spatial::fate(imm_destiny, 0, 1) * self.all_workplace_ids.len() as f32) as usize % self.all_workplace_ids.len();
                        Some(self.all_workplace_ids[widx])
                    };
                
                let speed_mph = 30.0 + 40.0 * spatial::fate(imm_destiny, 0, 2);
                self.agents.push(Agent {
                    id: self.next_agent_id,
                    age: (20.0 + 40.0 * spatial::fate(imm_destiny, 0, 3)) as u8,
                    county, destiny: imm_destiny,
                    wealth: 2000.0 + 20000.0 * spatial::fate(imm_destiny, 0, 4),
                    income: if employer_id.is_some() { 25000.0 + 75000.0 * spatial::fate(imm_destiny, 0, 5) } else { 10000.0 },
                    health: 0.7 + 0.3 * spatial::fate(imm_destiny, 0, 6),
                    propensity_to_consume: 0.7 + 0.2 * spatial::fate(imm_destiny, 0, 7),
                    speed: speed_mph / 69.0 / 60.0,
                    current_coord: spatial::Coordinate::new(lat, lon),
                    target_location_id: None,
                    home_location_id: home_id,
                    employer_location_id: employer_id,
                    family_agent_ids: Vec::new(),
                });
            }
        }
        
        // CONTINUOUS: Agent Movement (PARALLEL + destiny)
        let tick = self.global_state.tick;
        let day_of_week = self.global_state.day_of_week;
        let is_bad_weather = !self.active_weather.is_empty();
        let county_dests = &self.county_destinations;
        let loc_coords = &self.loc_coords;
        
        self.agents.par_iter_mut().for_each(|agent| {
            let needs_new_target = match agent.target_location_id {
                None => true,
                Some(tid) => {
                    if let Some(&(tlat, tlon)) = loc_coords.get(&tid) {
                        let dx = tlon - agent.current_coord.lon;
                        let dy = tlat - agent.current_coord.lat;
                        (dx * dx + dy * dy) < 0.000001
                    } else { true }
                }
            };
            
            if needs_new_target {
                let target_id = crate::updates::determine_agent_target(
                    agent, tick, day_of_week, is_bad_weather, county_dests
                );
                agent.target_location_id = Some(target_id);
            }
            
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
        
        if is_daily_tick {
            self.state_entity.population = self.agents.len() as u32;
        }
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn generate_family_ages(hh_size: u8, profile: &CountyProfile, seed: u64) -> Vec<u8> {
    let mut ages = Vec::with_capacity(hh_size as usize);
    match hh_size {
        1 => {
            let r = spatial::fate(seed, 1, 0);
            if r < 0.5 * profile.pct_18_to_34 / 0.18 {
                ages.push((22.0 + 13.0 * spatial::fate(seed, 1, 1)) as u8);
            } else if r < 0.7 {
                ages.push((65.0 + 20.0 * spatial::fate(seed, 1, 1)) as u8);
            } else {
                ages.push((35.0 + 30.0 * spatial::fate(seed, 1, 1)) as u8);
            }
        }
        2 => {
            let base = (25.0 + 35.0 * spatial::fate(seed, 1, 0)) as u8;
            ages.push(base);
            let offset = (-8.0 + 16.0 * spatial::fate(seed, 1, 1)) as i16;
            ages.push(((base as i16 + offset).max(18).min(90)) as u8);
        }
        3 => {
            if spatial::fate(seed, 1, 0) < 0.7 {
                let p = (28.0 + 20.0 * spatial::fate(seed, 1, 1)) as u8;
                ages.push(p);
                let off = (-5.0 + 10.0 * spatial::fate(seed, 1, 2)) as i16;
                ages.push(((p as i16 + off).max(22).min(60)) as u8);
                let c = (p as f32 - 20.0 - 10.0 * spatial::fate(seed, 1, 3)).max(0.0) as u8;
                ages.push(c.min(17));
            } else {
                let p = (30.0 + 18.0 * spatial::fate(seed, 1, 1)) as u8;
                ages.push(p);
                let c1 = (p as f32 - 18.0 - 8.0 * spatial::fate(seed, 1, 2)).max(0.0) as u8;
                let c2 = (c1 as f32 - 1.0 - 4.0 * spatial::fate(seed, 1, 3)).max(0.0) as u8;
                ages.push(c1.min(17));
                ages.push(c2.min(17));
            }
        }
        4 => {
            let p = (30.0 + 22.0 * spatial::fate(seed, 1, 0)) as u8;
            ages.push(p);
            let off = (-5.0 + 10.0 * spatial::fate(seed, 1, 1)) as i16;
            ages.push(((p as i16 + off).max(25).min(65)) as u8);
            let c1 = (p as f32 - 22.0 - 8.0 * spatial::fate(seed, 1, 2)).max(0.0) as u8;
            let c2 = (c1 as f32 - 1.0 - 4.0 * spatial::fate(seed, 1, 3)).max(0.0) as u8;
            ages.push(c1.min(17));
            ages.push(c2.min(17));
        }
        _ => {
            let p = (35.0 + 18.0 * spatial::fate(seed, 1, 0)) as u8;
            ages.push(p);
            let off = (-5.0 + 10.0 * spatial::fate(seed, 1, 1)) as i16;
            ages.push(((p as i16 + off).max(28).min(65)) as u8);
            let num_kids = (hh_size - 2 - if spatial::fate(seed, 1, 2) < 0.4 { 1 } else { 0 }) as u8;
            for k in 0..num_kids {
                let c = (p as f32 - 22.0 - (k as f32 * 3.0) - 5.0 * spatial::fate(seed, 1, 3 + k as u16)).max(0.0) as u8;
                ages.push(c.min(17));
            }
            while (ages.len() as u8) < hh_size {
                ages.push((65.0 + 20.0 * spatial::fate(seed, 1, 10)) as u8);
            }
        }
    }
    ages
}

fn transport_speed_for_percentile(pctile: f32) -> f32 {
    if pctile < 0.10 { 3.0 + 2.0 * pctile * 10.0 }
    else if pctile < 0.20 { 10.0 + 5.0 * (pctile - 0.10) * 10.0 }
    else if pctile < 0.40 { 20.0 + 15.0 * (pctile - 0.20) * 5.0 }
    else if pctile < 0.75 { 35.0 + 20.0 * (pctile - 0.40) * 2.86 }
    else if pctile < 0.95 { 55.0 + 15.0 * (pctile - 0.75) * 5.0 }
    else { 65.0 + 15.0 * (pctile - 0.95) * 20.0 }
}

fn pick_employer(nearby: &[(u32, f32, f64)], pctile: f32, destiny: u64, all_workplaces: &[u32]) -> Option<u32> {
    if nearby.is_empty() {
        return all_workplaces.first().copied();
    }
    let top = nearby.len().min(10);
    let candidates = &nearby[..top];
    let mut best_idx = 0;
    let mut best_score = f32::MIN;
    for (i, &(_wid, dist, val)) in candidates.iter().enumerate() {
        let proximity = 1.0 / (dist.sqrt() + 0.001);
        let value_weight = (val as f32).ln().max(1.0) * pctile;
        let noise = spatial::fate(destiny, 0, 20 + i as u16) * 0.3;
        let score = proximity + value_weight + noise;
        if score > best_score {
            best_score = score;
            best_idx = i;
        }
    }
    Some(candidates[best_idx].0)
}

#[tokio::main]
async fn main() {
    println!("Initializing Nostradamus Engine...");
    let engine = SimulationEngine::new();
    let engine = Arc::new(Mutex::new(engine));
    
    let shared_payload: Arc<Mutex<Option<SimulationPayload>>> = Arc::new(Mutex::new(None));
    let server_payload_ref = shared_payload.clone();
    let is_paused = Arc::new(AtomicBool::new(false));
    let server_paused_ref = is_paused.clone();
    
    tokio::spawn(async move {
        server::start_websocket_server(server_payload_ref, server_paused_ref).await;
    });
    
    let mut ticker = tokio::time::interval(Duration::from_millis(2));
    println!("Simulation Started!");
    
    let mut payload_tick_counter = 0u64;
    
    loop {
        ticker.tick().await;
        
        if is_paused.load(Ordering::SeqCst) { continue; }
        
        let mut eng = engine.lock().await;
        eng.tick();
        
        payload_tick_counter += 1;
        if payload_tick_counter % 5 == 0 {
            let agents_sample: Vec<Agent> = eng.agents.iter().take(1000).cloned().collect();
            let locs_sample: Vec<Location> = eng.locations.values().take(500).cloned().collect();
            
            let payload = SimulationPayload {
                tick: eng.global_state.tick,
                global_metrics: eng.global_state.clone(),
                active_agents_subset: agents_sample,
                locations_subset: locs_sample,
                organizations: eng.organizations.clone(),
                transports: Vec::new(),
            };
            
            *shared_payload.lock().await = Some(payload);
        }
        
        if eng.global_state.tick % 1000 == 0 {
            println!("Tick {} | Pop: {} | Economy: ${:.0}", 
                eng.global_state.tick, eng.agents.len(), eng.state_entity.total_economy_value);
        }
    }
}
