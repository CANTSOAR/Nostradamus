use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::spatial;
use crate::entities::WeatherType;
use crate::SimulationEngine;

// ============================================================================
// COMMAND PROTOCOL
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SimCommand {
    pub id: String,
    pub action: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Serialize)]
pub struct CommandResult {
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl CommandResult {
    fn ok(id: &str, result: Value) -> Self {
        Self { id: id.to_string(), ok: true, result: Some(result), error: None }
    }
    fn err(id: &str, msg: &str) -> Self {
        Self { id: id.to_string(), ok: false, result: None, error: Some(msg.to_string()) }
    }
}

// ============================================================================
// DISPATCHER (34 commands)
// ============================================================================

pub async fn execute_command(
    engine: &mut SimulationEngine,
    cmd: SimCommand,
    tick_delay: &Arc<AtomicU64>,
) -> CommandResult {
    let id = &cmd.id;
    let p = &cmd.params;
    
    match cmd.action.as_str() {
        // === STATE (3) ===
        "get_state"          => cmd_get_state(id, engine),
        "set_tax_rate"       => cmd_set_tax_rate(id, p, engine),
        "set_fed_rate"       => cmd_set_fed_rate(id, p, engine),
        
        // === GLOBAL PARAMS (2) ===
        "get_global_params"  => cmd_get_global_params(id, engine),
        "set_global_param"   => cmd_set_global_param(id, p, engine),
        
        // === SPEED (1) ===
        "set_speed"          => cmd_set_speed(id, p, tick_delay),
        
        // === WEATHER (2) ===
        "spawn_weather"      => cmd_spawn_weather(id, p, engine),
        "clear_weather"      => cmd_clear_weather(id, engine),
        
        // === SECTOR FAVORABILITY (2) ===
        "get_sector_favorability" => cmd_get_sector_favorability(id, engine),
        "set_sector_favorability" => cmd_set_sector_favorability(id, p, engine),
        
        // === COUNTY (4) ===
        "get_county_stats"   => cmd_get_county_stats(id, p, engine),
        "depreciate_homes"   => cmd_depreciate_homes(id, p, engine),
        "appreciate_homes"   => cmd_appreciate_homes(id, p, engine),
        "close_businesses"   => cmd_close_businesses(id, p, engine),
        
        // === ORGANIZATION (4) ===
        "get_org"            => cmd_get_org(id, p, engine),
        "search_orgs"        => cmd_search_orgs(id, p, engine),
        "close_org"          => cmd_close_org(id, p, engine),
        "set_org_revenue"    => cmd_set_org_revenue(id, p, engine),
        
        // === LOCATION (5) ===
        "get_location"       => cmd_get_location(id, p, engine),
        "search_locations"   => cmd_search_locations(id, p, engine),
        "set_location_value" => cmd_set_location_value(id, p, engine),
        "set_location_field" => cmd_set_location_field(id, p, engine),
        "close_location"     => cmd_close_location(id, p, engine),
        
        // === AGENT (8) ===
        "get_agent"          => cmd_get_agent(id, p, engine),
        "search_agents"      => cmd_search_agents(id, p, engine),
        "agents_at_location" => cmd_agents_at_location(id, p, engine),
        "set_agent_wealth"   => cmd_set_agent_wealth(id, p, engine),
        "set_agent_income"   => cmd_set_agent_income(id, p, engine),
        "set_agent_health"   => cmd_set_agent_health(id, p, engine),
        "set_agent_field"    => cmd_set_agent_field(id, p, engine),
        "fire_agent"         => cmd_fire_agent(id, p, engine),
        
        // === BULK / SCENARIO (3) ===
        "stimulus_check"     => cmd_stimulus_check(id, p, engine),
        "mass_layoff"        => cmd_mass_layoff(id, p, engine),
        "pandemic"           => cmd_pandemic(id, p, engine),
        
        // === HISTORY (1) ===
        "get_history"        => cmd_get_history(id, p, engine),
        
        // === AGENT / AI (1) ===
        "query_agent"        => cmd_query_agent(id, p, engine).await,
        
        "get_properties"     => cmd_get_properties(id, p, engine),
        
        _ => CommandResult::err(id, &format!("Unknown action: {}", cmd.action)),
    }
}

fn cmd_get_properties(id: &str, p: &serde_json::Value, engine: &SimulationEngine) -> CommandResult {
    let lat_min = p.get("lat_min").and_then(|v| v.as_f64()).unwrap_or(38.0);
    let lat_max = p.get("lat_max").and_then(|v| v.as_f64()).unwrap_or(42.0);
    let lon_min = p.get("lon_min").and_then(|v| v.as_f64()).unwrap_or(-76.0);
    let lon_max = p.get("lon_max").and_then(|v| v.as_f64()).unwrap_or(-73.0);
    let limit = p.get("limit").and_then(|v| v.as_u64()).unwrap_or(1000) as usize;

    println!("Property request: bbox=[{}, {}, {}, {}], limit={}", lat_min, lon_min, lat_max, lon_max, limit);

    let results: Vec<&crate::entities::Property> = engine.properties.iter()
        .filter(|prop| {
            prop.lat >= lat_min && prop.lat <= lat_max && 
            prop.lon >= lon_min && prop.lon <= lon_max
        })
        .take(limit)
        .collect();

    CommandResult::ok(id, serde_json::json!({
        "count": results.len(),
        "properties": results
    }))
}

// ============================================================================
// STATE COMMANDS
// ============================================================================

fn cmd_get_state(id: &str, engine: &SimulationEngine) -> CommandResult {
    let s = &engine.state_entity;
    CommandResult::ok(id, json!({
        "population": s.population,
        "avg_wealth": s.avg_wealth,
        "wealth_disparity": s.wealth_disparity,
        "total_economy_value": s.total_economy_value,
        "state_tax_rate": s.state_tax_rate,
        "fed_funds_rate": s.fed_funds_rate,
        "cash_reserves": s.cash_reserves,
        "sector_favorability": s.sector_favorability,
        "tick": engine.global_state.tick,
    }))
}

fn cmd_set_tax_rate(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let rate = match p.get("value").and_then(|v| v.as_f64()) {
        Some(r) => r,
        None => return CommandResult::err(id, "Missing 'value' (f64)"),
    };
    let old = engine.state_entity.state_tax_rate;
    engine.state_entity.state_tax_rate = rate as f32;
    CommandResult::ok(id, json!({"old": old, "new": rate}))
}

fn cmd_set_fed_rate(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let rate = match p.get("value").and_then(|v| v.as_f64()) {
        Some(r) => r,
        None => return CommandResult::err(id, "Missing 'value' (f64)"),
    };
    let old = engine.state_entity.fed_funds_rate;
    engine.state_entity.fed_funds_rate = rate as f32;
    CommandResult::ok(id, json!({"old": old, "new": rate}))
}

// ============================================================================
// GLOBAL PARAMS
// ============================================================================

fn cmd_get_global_params(id: &str, engine: &SimulationEngine) -> CommandResult {
    let g = &engine.global_state;
    CommandResult::ok(id, json!({
        "tick": g.tick,
        "day_of_week": g.day_of_week,
        "base_tax_rate": g.base_tax_rate,
        "inflation_rate": g.inflation_rate,
        "base_interest_rate": g.base_interest_rate,
        "death_rate": g.death_rate,
        "birth_rate": g.birth_rate,
        "immigration_rate": g.immigration_rate,
        "emigration_rate": g.emigration_rate,
        "grid_resolution": g.grid_resolution,
    }))
}

fn cmd_set_global_param(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let param = match p.get("param").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => return CommandResult::err(id, "Missing 'param'"),
    };
    let value = match p.get("value").and_then(|v| v.as_f64()) {
        Some(v) => v,
        None => return CommandResult::err(id, "Missing 'value'"),
    };
    let g = &mut engine.global_state;
    let old = match param {
        "base_tax_rate" => { let o = g.base_tax_rate; g.base_tax_rate = value; o }
        "inflation_rate" => { let o = g.inflation_rate; g.inflation_rate = value; o }
        "base_interest_rate" => { let o = g.base_interest_rate; g.base_interest_rate = value; o }
        "death_rate" => { let o = g.death_rate; g.death_rate = value; o }
        "birth_rate" => { let o = g.birth_rate; g.birth_rate = value; o }
        "immigration_rate" => { let o = g.immigration_rate; g.immigration_rate = value; o }
        "emigration_rate" => { let o = g.emigration_rate; g.emigration_rate = value; o }
        _ => return CommandResult::err(id, &format!("Unknown param: {}", param)),
    };
    CommandResult::ok(id, json!({"param": param, "old": old, "new": value}))
}

// ============================================================================
// SPEED CONTROL
// ============================================================================

fn cmd_set_speed(id: &str, p: &Value, tick_delay: &Arc<AtomicU64>) -> CommandResult {
    let speed = p.get("speed").and_then(|v| v.as_str()).unwrap_or("max");
    let old = tick_delay.load(Ordering::SeqCst);
    let new_ms = match speed {
        "1x" => 50,
        "2x" => 25,
        "5x" => 10,
        "10x" => 5,
        "25x" => 2,
        "50x" => 1,
        "max" | "0" => 0,
        other => {
            // Try parsing as number
            match other.parse::<u64>() {
                Ok(ms) => ms,
                Err(_) => return CommandResult::err(id, &format!("Unknown speed: {}", other)),
            }
        }
    };
    tick_delay.store(new_ms, Ordering::SeqCst);
    CommandResult::ok(id, json!({"old_delay_ms": old, "new_delay_ms": new_ms, "speed": speed}))
}

// ============================================================================
// WEATHER
// ============================================================================

fn cmd_spawn_weather(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let wtype_str = p.get("type").and_then(|v| v.as_str()).unwrap_or("Rain");
    let severity = p.get("severity").and_then(|v| v.as_f64()).unwrap_or(0.5) as f32;
    
    let condition = match wtype_str.to_lowercase().as_str() {
        "rain" => WeatherType::Rain,
        "snow" => WeatherType::Snow,
        "heatwave" | "heat" => WeatherType::Heatwave,
        "hurricane" => WeatherType::Hurricane,
        "clear" => WeatherType::Clear,
        _ => return CommandResult::err(id, &format!("Unknown weather type: {}", wtype_str)),
    };
    
    engine.active_weather.push(crate::entities::Weather {
        condition: condition.clone(),
        severity,
    });
    
    CommandResult::ok(id, json!({"type": wtype_str, "severity": severity, "active_weather_count": engine.active_weather.len()}))
}

fn cmd_clear_weather(id: &str, engine: &mut SimulationEngine) -> CommandResult {
    let count = engine.active_weather.len();
    engine.active_weather.clear();
    CommandResult::ok(id, json!({"cleared": count}))
}

// ============================================================================
// SECTOR FAVORABILITY
// ============================================================================

fn cmd_get_sector_favorability(id: &str, engine: &SimulationEngine) -> CommandResult {
    CommandResult::ok(id, json!(engine.state_entity.sector_favorability))
}

fn cmd_set_sector_favorability(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let sector = match p.get("sector").and_then(|v| v.as_str()) {
        Some(s) => s.to_string(),
        None => return CommandResult::err(id, "Missing 'sector'"),
    };
    let value = match p.get("value").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'value'"),
    };
    let old = engine.state_entity.sector_favorability
        .get(&sector).copied().unwrap_or(1.0);
    engine.state_entity.sector_favorability.insert(sector.clone(), value);
    CommandResult::ok(id, json!({"sector": sector, "old": old, "new": value}))
}

// ============================================================================
// COUNTY COMMANDS
// ============================================================================

fn cmd_get_county_stats(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let county_str = p.get("county").and_then(|v| v.as_str());
    match county_str {
        Some(name) => {
            let cid = spatial::county_to_id(name);
            if cid == spatial::COUNTY_UNKNOWN {
                return CommandResult::err(id, &format!("Unknown county: {}", name));
            }
            match engine.county_stats_cache.iter().find(|s| s.county_id == cid) {
                Some(s) => CommandResult::ok(id, json!(s)),
                None => CommandResult::err(id, "County stats not found"),
            }
        }
        None => CommandResult::ok(id, json!(engine.county_stats_cache)),
    }
}

fn cmd_depreciate_homes(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let pct = match p.get("pct").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'pct'"),
    };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let mult = 1.0 - pct;
    let mut count = 0u32;
    let mut total_old = 0f64;
    let mut total_new = 0f64;
    
    for loc in engine.locations.values_mut() {
        if loc.location_type != spatial::LocationType::Residential { continue; }
        if let Some(cid) = county_filter { if loc.county != cid { continue; } }
        total_old += loc.value as f64;
        loc.value *= mult;
        total_new += loc.value as f64;
        count += 1;
    }
    CommandResult::ok(id, json!({"affected": count, "avg_old_value": if count > 0 { total_old / count as f64 } else { 0.0 }, "avg_new_value": if count > 0 { total_new / count as f64 } else { 0.0 }}))
}

fn cmd_appreciate_homes(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let pct = match p.get("pct").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'pct'"),
    };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let mult = 1.0 + pct;
    let mut count = 0u32;
    for loc in engine.locations.values_mut() {
        if loc.location_type != spatial::LocationType::Residential { continue; }
        if let Some(cid) = county_filter { if loc.county != cid { continue; } }
        loc.value *= mult;
        count += 1;
    }
    CommandResult::ok(id, json!({"affected": count, "multiplier": mult}))
}

fn cmd_close_businesses(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let name_filter = p.get("name_contains").and_then(|v| v.as_str()).unwrap_or("");
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    if name_filter.is_empty() && county_filter.is_none() {
        return CommandResult::err(id, "Must specify 'name_contains' and/or 'county'");
    }
    let name_lower = name_filter.to_lowercase();
    
    let mut affected_org_ids: Vec<u32> = Vec::new();
    for (&oid, org) in &engine.organizations {
        if !name_lower.is_empty() && !org.name.to_lowercase().contains(&name_lower) { continue; }
        affected_org_ids.push(oid);
    }
    
    let mut closed_locations = 0u32;
    let mut affected_loc_ids: Vec<u32> = Vec::new();
    for (&lid, loc) in engine.locations.iter_mut() {
        let type_ok = loc.location_type == spatial::LocationType::Store 
            || loc.location_type == spatial::LocationType::Employer;
        if !type_ok { continue; }
        if let Some(cid) = county_filter { if loc.county != cid { continue; } }
        let org_match = if !name_lower.is_empty() {
            loc.organization_id.map(|oid| affected_org_ids.contains(&oid)).unwrap_or(false)
                || loc.name.as_deref().map(|n| n.to_lowercase().contains(&name_lower)).unwrap_or(false)
        } else { true };
        if org_match {
            loc.value = 0.0;
            affected_loc_ids.push(lid);
            closed_locations += 1;
        }
    }
    
    let mut fired = 0u32;
    for agent in &mut engine.agents {
        if let Some(eid) = agent.employer_location_id {
            if affected_loc_ids.contains(&eid) {
                agent.employer_location_id = None;
                agent.income *= 0.15;
                fired += 1;
            }
        }
    }
    for oid in &affected_org_ids {
        if let Some(org) = engine.organizations.get_mut(oid) {
            org.total_funds = 0.0;
            org.avg_revenue = 0.0;
        }
    }
    CommandResult::ok(id, json!({"closed_locations": closed_locations, "orgs_affected": affected_org_ids.len(), "employees_fired": fired}))
}

// ============================================================================
// ORGANIZATION COMMANDS
// ============================================================================

fn cmd_get_org(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let org_id = match p.get("org_id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'org_id'"),
    };
    match engine.organizations.get(&org_id) {
        Some(org) => CommandResult::ok(id, json!(org)),
        None => CommandResult::err(id, "Organization not found"),
    }
}

fn cmd_search_orgs(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let query = p.get("name_contains").and_then(|v| v.as_str()).unwrap_or("");
    let limit = p.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
    let query_lower = query.to_lowercase();
    let results: Vec<Value> = engine.organizations.values()
        .filter(|o| query.is_empty() || o.name.to_lowercase().contains(&query_lower))
        .take(limit)
        .map(|o| json!({"id": o.id, "name": o.name, "industry": o.industry, "value": o.value, "total_funds": o.total_funds}))
        .collect();
    CommandResult::ok(id, json!({"count": results.len(), "results": results}))
}

fn cmd_close_org(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let name_filter = p.get("name_contains").and_then(|v| v.as_str());
    let org_id_filter = p.get("org_id").and_then(|v| v.as_u64()).map(|v| v as u32);
    let mut target_ids: Vec<u32> = Vec::new();
    
    if let Some(oid) = org_id_filter {
        if engine.organizations.contains_key(&oid) { target_ids.push(oid); }
    } else if let Some(name) = name_filter {
        let nl = name.to_lowercase();
        for (&oid, org) in &engine.organizations {
            if org.name.to_lowercase().contains(&nl) { target_ids.push(oid); }
        }
    } else {
        return CommandResult::err(id, "Must specify 'org_id' or 'name_contains'");
    }
    
    for oid in &target_ids {
        if let Some(org) = engine.organizations.get_mut(oid) {
            org.total_funds = 0.0;
            org.avg_revenue = 0.0;
        }
    }
    let mut fired = 0u32;
    for agent in &mut engine.agents {
        if let Some(eid) = agent.employer_location_id {
            let org_match = engine.locations.get(&eid)
                .and_then(|l| l.organization_id)
                .map(|oid| target_ids.contains(&oid))
                .unwrap_or(false);
            if org_match {
                agent.employer_location_id = None;
                agent.income *= 0.15;
                fired += 1;
            }
        }
    }
    CommandResult::ok(id, json!({"orgs_closed": target_ids.len(), "employees_fired": fired}))
}

fn cmd_set_org_revenue(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let org_id = match p.get("org_id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'org_id'"),
    };
    let value = match p.get("value").and_then(|v| v.as_f64()) {
        Some(v) => v,
        None => return CommandResult::err(id, "Missing 'value'"),
    };
    match engine.organizations.get_mut(&org_id) {
        Some(org) => {
            let old = org.avg_revenue;
            org.avg_revenue = value;
            CommandResult::ok(id, json!({"old": old, "new": value}))
        }
        None => CommandResult::err(id, "Organization not found"),
    }
}

// ============================================================================
// LOCATION COMMANDS
// ============================================================================

fn cmd_get_location(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let loc_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    match engine.locations.get(&loc_id) {
        Some(loc) => CommandResult::ok(id, json!(loc)),
        None => CommandResult::err(id, "Location not found"),
    }
}

fn cmd_search_locations(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let type_filter = p.get("type").and_then(|v| v.as_str());
    let name_filter = p.get("name_contains").and_then(|v| v.as_str());
    let limit = p.get("limit").and_then(|v| v.as_u64()).unwrap_or(50) as usize;
    
    let results: Vec<Value> = engine.locations.values()
        .filter(|l| {
            if let Some(cid) = county_filter { if l.county != cid { return false; } }
            if let Some(t) = type_filter {
                let type_str = format!("{:?}", l.location_type);
                if !type_str.eq_ignore_ascii_case(t) { return false; }
            }
            if let Some(name) = name_filter {
                let nl = name.to_lowercase();
                if !l.name.as_deref().map(|n| n.to_lowercase().contains(&nl)).unwrap_or(false) {
                    return false;
                }
            }
            true
        })
        .take(limit)
        .map(|l| json!({
            "id": l.id, "name": l.name, "type": format!("{:?}", l.location_type),
            "county": spatial::county_name(l.county), "value": l.value, "tax": l.tax,
            "coord": {"lat": l.coord.lat, "lon": l.coord.lon},
            "organization_id": l.organization_id, "current_count": l.current_count,
        }))
        .collect();
    
    CommandResult::ok(id, json!({"count": results.len(), "results": results}))
}

fn cmd_set_location_value(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let loc_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    let value = match p.get("value").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'value'"),
    };
    match engine.locations.get_mut(&loc_id) {
        Some(loc) => {
            let old = loc.value;
            loc.value = value;
            CommandResult::ok(id, json!({"old": old, "new": value}))
        }
        None => CommandResult::err(id, "Location not found"),
    }
}

fn cmd_set_location_field(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let loc_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    let field = match p.get("field").and_then(|v| v.as_str()) {
        Some(f) => f,
        None => return CommandResult::err(id, "Missing 'field'"),
    };
    let value = match p.get("value").and_then(|v| v.as_f64()) {
        Some(v) => v,
        None => return CommandResult::err(id, "Missing 'value'"),
    };
    match engine.locations.get_mut(&loc_id) {
        Some(loc) => {
            let old: f64 = match field {
                "value" => { let o = loc.value as f64; loc.value = value as f32; o }
                "tax" => { let o = loc.tax as f64; loc.tax = value as f32; o }
                _ => return CommandResult::err(id, &format!("Unknown location field: {}", field)),
            };
            CommandResult::ok(id, json!({"field": field, "old": old, "new": value}))
        }
        None => CommandResult::err(id, "Location not found"),
    }
}

fn cmd_close_location(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let loc_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    if !engine.locations.contains_key(&loc_id) {
        return CommandResult::err(id, "Location not found");
    }
    engine.locations.get_mut(&loc_id).unwrap().value = 0.0;
    
    let mut affected_agents = 0u32;
    for agent in &mut engine.agents {
        if agent.home_location_id == loc_id { affected_agents += 1; }
        if agent.employer_location_id == Some(loc_id) {
            agent.employer_location_id = None;
            agent.income *= 0.15;
            affected_agents += 1;
        }
        if agent.school_location_id == Some(loc_id) {
            agent.school_location_id = None;
            affected_agents += 1;
        }
    }
    CommandResult::ok(id, json!({"closed": true, "agents_affected": affected_agents}))
}

// ============================================================================
// AGENT COMMANDS
// ============================================================================

fn cmd_get_agent(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    match engine.agents.iter().find(|a| a.id == agent_id) {
        Some(agent) => CommandResult::ok(id, json!(agent)),
        None => CommandResult::err(id, "Agent not found"),
    }
}

fn cmd_search_agents(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let min_wealth = p.get("min_wealth").and_then(|v| v.as_f64()).map(|v| v as f32);
    let max_wealth = p.get("max_wealth").and_then(|v| v.as_f64()).map(|v| v as f32);
    let min_age = p.get("min_age").and_then(|v| v.as_u64()).map(|v| v as u8);
    let max_age = p.get("max_age").and_then(|v| v.as_u64()).map(|v| v as u8);
    let employed = p.get("employed").and_then(|v| v.as_bool());
    let limit = p.get("limit").and_then(|v| v.as_u64()).unwrap_or(50) as usize;
    
    let results: Vec<Value> = engine.agents.iter()
        .filter(|a| {
            if let Some(cid) = county_filter { if a.county != cid { return false; } }
            if let Some(mw) = min_wealth { if a.wealth < mw { return false; } }
            if let Some(mw) = max_wealth { if a.wealth > mw { return false; } }
            if let Some(ma) = min_age { if a.age < ma { return false; } }
            if let Some(ma) = max_age { if a.age > ma { return false; } }
            if let Some(emp) = employed {
                if emp && a.employer_location_id.is_none() { return false; }
                if !emp && a.employer_location_id.is_some() { return false; }
            }
            true
        })
        .take(limit)
        .map(|a| json!({
            "id": a.id, "age": a.age, "county": spatial::county_name(a.county),
            "wealth": a.wealth, "income": a.income, "health": a.health,
            "employed": a.employer_location_id.is_some(),
            "is_homeowner": a.is_homeowner, "education_level": a.education_level,
        }))
        .collect();
    CommandResult::ok(id, json!({"count": results.len(), "results": results}))
}

fn cmd_agents_at_location(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let loc_id = match p.get("location_id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'location_id'"),
    };
    let limit = p.get("limit").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
    
    let mut residents: Vec<Value> = Vec::new();
    let mut workers: Vec<Value> = Vec::new();
    let mut students: Vec<Value> = Vec::new();
    
    for a in &engine.agents {
        if residents.len() + workers.len() + students.len() >= limit { break; }
        if a.home_location_id == loc_id {
            residents.push(json!({"id": a.id, "age": a.age, "role": "resident", "wealth": a.wealth}));
        }
        if a.employer_location_id == Some(loc_id) {
            workers.push(json!({"id": a.id, "age": a.age, "role": "worker", "income": a.income}));
        }
        if a.school_location_id == Some(loc_id) {
            students.push(json!({"id": a.id, "age": a.age, "role": "student", "education_level": a.education_level}));
        }
    }
    let mut all_agents: Vec<Value> = Vec::new();
    all_agents.extend(residents.iter().cloned());
    all_agents.extend(workers.iter().cloned());
    all_agents.extend(students.iter().cloned());
    
    CommandResult::ok(id, json!({
        "residents": residents.len(), "workers": workers.len(), "students": students.len(),
        "agents": all_agents,
    }))
}

fn cmd_set_agent_wealth(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) { Some(id) => id as u32, None => return CommandResult::err(id, "Missing 'id'") };
    let value = match p.get("value").and_then(|v| v.as_f64()) { Some(v) => v as f32, None => return CommandResult::err(id, "Missing 'value'") };
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(a) => { let old = a.wealth; a.wealth = value; CommandResult::ok(id, json!({"old": old, "new": value})) }
        None => CommandResult::err(id, "Agent not found"),
    }
}

fn cmd_set_agent_income(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) { Some(id) => id as u32, None => return CommandResult::err(id, "Missing 'id'") };
    let value = match p.get("value").and_then(|v| v.as_f64()) { Some(v) => v as f32, None => return CommandResult::err(id, "Missing 'value'") };
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(a) => { let old = a.income; a.income = value; CommandResult::ok(id, json!({"old": old, "new": value})) }
        None => CommandResult::err(id, "Agent not found"),
    }
}

fn cmd_set_agent_health(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) { Some(id) => id as u32, None => return CommandResult::err(id, "Missing 'id'") };
    let value = match p.get("value").and_then(|v| v.as_f64()) { Some(v) => v as f32, None => return CommandResult::err(id, "Missing 'value'") };
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(a) => { let old = a.health; a.health = value.clamp(0.0, 1.0); CommandResult::ok(id, json!({"old": old, "new": a.health})) }
        None => CommandResult::err(id, "Agent not found"),
    }
}

fn cmd_set_agent_field(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) { Some(id) => id as u32, None => return CommandResult::err(id, "Missing 'id'") };
    let field = match p.get("field").and_then(|v| v.as_str()) { Some(f) => f, None => return CommandResult::err(id, "Missing 'field'") };
    let value = match p.get("value").and_then(|v| v.as_f64()) { Some(v) => v, None => return CommandResult::err(id, "Missing 'value'") };
    
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(a) => {
            let old: f64 = match field {
                "age" => { let o = a.age as f64; a.age = value as u8; o }
                "wealth" => { let o = a.wealth as f64; a.wealth = value as f32; o }
                "income" => { let o = a.income as f64; a.income = value as f32; o }
                "health" => { let o = a.health as f64; a.health = (value as f32).clamp(0.0, 1.0); o }
                "speed" => { let o = a.speed as f64; a.speed = value as f32; o }
                "propensity_to_consume" => { let o = a.propensity_to_consume as f64; a.propensity_to_consume = value as f32; o }
                "education_level" => { let o = a.education_level as f64; a.education_level = value as u8; o }
                _ => return CommandResult::err(id, &format!("Unknown agent field: {}", field)),
            };
            CommandResult::ok(id, json!({"field": field, "old": old, "new": value}))
        }
        None => CommandResult::err(id, "Agent not found"),
    }
}

fn cmd_fire_agent(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) { Some(id) => id as u32, None => return CommandResult::err(id, "Missing 'id'") };
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(a) => {
            let was = a.employer_location_id.is_some();
            a.employer_location_id = None;
            a.income *= 0.15;
            CommandResult::ok(id, json!({"was_employed": was}))
        }
        None => CommandResult::err(id, "Agent not found"),
    }
}

// ============================================================================
// BULK / SCENARIO COMMANDS
// ============================================================================

fn cmd_stimulus_check(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let amount = match p.get("amount").and_then(|v| v.as_f64()) { Some(v) => v as f32, None => return CommandResult::err(id, "Missing 'amount'") };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let mut count = 0u32;
    for agent in &mut engine.agents {
        if let Some(cid) = county_filter { if agent.county != cid { continue; } }
        agent.wealth += amount;
        count += 1;
    }
    engine.state_entity.cash_reserves -= amount as f64 * count as f64;
    CommandResult::ok(id, json!({"recipients": count, "total_distributed": amount as f64 * count as f64, "state_reserves_after": engine.state_entity.cash_reserves}))
}

fn cmd_mass_layoff(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let pct = match p.get("pct").and_then(|v| v.as_f64()) { Some(v) => v as f32, None => return CommandResult::err(id, "Missing 'pct'") };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let org_filter = p.get("org_id").and_then(|v| v.as_u64()).map(|v| v as u32);
    let mut fired = 0u32;
    let tick = engine.global_state.tick;
    
    for agent in &mut engine.agents {
        if agent.employer_location_id.is_none() { continue; }
        if let Some(cid) = county_filter { if agent.county != cid { continue; } }
        if let Some(target_oid) = org_filter {
            let agent_org = agent.employer_location_id
                .and_then(|eid| engine.locations.get(&eid))
                .and_then(|l| l.organization_id);
            if agent_org != Some(target_oid) { continue; }
        }
        if spatial::fate(agent.destiny, tick, 5000) < pct {
            agent.employer_location_id = None;
            agent.income *= 0.15;
            fired += 1;
        }
    }
    CommandResult::ok(id, json!({"fired": fired, "pct_requested": pct}))
}

// ============================================================================
// AGENT / AI COMMANDS
// ============================================================================

async fn cmd_query_agent(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let query = match p.get("query").and_then(|v| v.as_str()) {
        Some(q) => q,
        None => return CommandResult::err(id, "Missing 'query'"),
    };

    let mut context = String::from("You are Nostradamus, an AI advisor for a digital twin simulation of New Jersey.
The simulation tracks population, wealth, health, and economic activity across 21 counties.
Counties: Atlantic, Bergen, Burlington, Camden, Cape May, Cumberland, Essex, Gloucester, Hudson, Hunterdon, Mercer, Middlesex, Monmouth, Morris, Ocean, Passaic, Salem, Somerset, Sussex, Union, Warren.

Current Global State:
");
    context.push_str(&format!("- Population: {}\n", engine.state_entity.population));
    context.push_str(&format!("- Avg Wealth: {:.2}\n", engine.state_entity.avg_wealth));
    context.push_str(&format!("- Total Economy Value: ${:.0}\n", engine.state_entity.total_economy_value));
    context.push_str(&format!("- State Tax Rate: {:.1}%\n", engine.state_entity.state_tax_rate * 100.0));
    
    context.push_str("\nCounty Data (approx):\n");
    for s in &engine.county_stats_cache {
        context.push_str(&format!("- {}: Pop {}, Avg Wealth {:.0}, Employers {}\n", 
            s.name, s.population, s.avg_wealth, s.num_employers));
    }

    context.push_str("\nRespond in a helpful, analytical tone. If you identify specific counties in your answer, 
please also provide a field 'matched_geoids' containing a JSON array of the 0-indexed county IDs you mentioned.
At the end of your message, if you want to highlight counties, add a line like: MATCHED_GEOIDS: [0, 5, 12]");

    match engine.groq_client.query(query, &context).await {
        Ok(answer) => {
            let mut matched_geoids = Vec::new();
            if let Some(line) = answer.lines().find(|l| l.contains("MATCHED_GEOIDS:")) {
                if let Some(json_start) = line.find('[') {
                    if let Ok(ids) = serde_json::from_str::<Vec<u8>>(&line[json_start..]) {
                        matched_geoids = ids;
                    }
                }
            }

            CommandResult::ok(id, json!({
                "answer_text": answer,
                "matched_geoids": matched_geoids,
                "code_executed": null,
            }))
        },
        Err(e) => CommandResult::err(id, &e),
    }
}

fn cmd_pandemic(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let severity = match p.get("severity").and_then(|v| v.as_f64()) { Some(v) => v as f32, None => return CommandResult::err(id, "Missing 'severity'") };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let tick = engine.global_state.tick;
    let mut health_affected = 0u32;
    let mut stores_closed = 0u32;
    let mut fired = 0u32;
    
    for agent in &mut engine.agents {
        if let Some(cid) = county_filter { if agent.county != cid { continue; } }
        if spatial::fate(agent.destiny, tick, 6000) < severity {
            let r = 0.1 + 0.4 * severity * spatial::fate(agent.destiny, tick, 6001);
            agent.health = (agent.health - r).max(0.0);
            health_affected += 1;
        }
    }
    for loc in engine.locations.values_mut() {
        if loc.location_type != spatial::LocationType::Store { continue; }
        if let Some(cid) = county_filter { if loc.county != cid { continue; } }
        if spatial::fate(loc.destiny, tick, 6010) < severity * 0.8 {
            loc.value *= 0.1;
            stores_closed += 1;
        }
    }
    for agent in &mut engine.agents {
        if agent.employer_location_id.is_none() { continue; }
        if let Some(cid) = county_filter { if agent.county != cid { continue; } }
        if spatial::fate(agent.destiny, tick, 6020) < severity * 0.3 {
            agent.employer_location_id = None;
            agent.income *= 0.15;
            fired += 1;
        }
    }
    CommandResult::ok(id, json!({"severity": severity, "health_affected": health_affected, "stores_closed": stores_closed, "employees_fired": fired}))
}

// ============================================================================
// HISTORY
// ============================================================================

fn cmd_get_history(id: &str, p: &Value, engine: &SimulationEngine) -> CommandResult {
    let metric = p.get("metric").and_then(|v| v.as_str()).unwrap_or("population");
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let limit = p.get("ticks").and_then(|v| v.as_u64()).unwrap_or(500) as usize;
    
    match &engine.metrics {
        Some(m) => {
            let history = m.get_history(metric, county_filter, limit);
            CommandResult::ok(id, json!({
                "metric": metric,
                "points": history.len(),
                "data": history.iter().map(|(t, v)| json!({"tick": t, "value": v})).collect::<Vec<_>>(),
            }))
        }
        None => CommandResult::err(id, "Metrics not initialized"),
    }
}
