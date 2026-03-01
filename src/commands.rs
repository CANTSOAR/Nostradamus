use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::spatial;
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
// DISPATCHER
// ============================================================================

pub fn execute_command(engine: &mut SimulationEngine, cmd: SimCommand) -> CommandResult {
    let id = &cmd.id;
    let p = &cmd.params;
    
    match cmd.action.as_str() {
        // === STATE ===
        "get_state"          => cmd_get_state(id, engine),
        "set_tax_rate"       => cmd_set_tax_rate(id, p, engine),
        "set_fed_rate"       => cmd_set_fed_rate(id, p, engine),
        
        // === COUNTY ===
        "get_county_stats"   => cmd_get_county_stats(id, p, engine),
        "depreciate_homes"   => cmd_depreciate_homes(id, p, engine),
        "appreciate_homes"   => cmd_appreciate_homes(id, p, engine),
        "close_businesses"   => cmd_close_businesses(id, p, engine),
        
        // === ORGANIZATION ===
        "get_org"            => cmd_get_org(id, p, engine),
        "search_orgs"        => cmd_search_orgs(id, p, engine),
        "close_org"          => cmd_close_org(id, p, engine),
        "set_org_revenue"    => cmd_set_org_revenue(id, p, engine),
        
        // === LOCATION ===
        "get_location"       => cmd_get_location(id, p, engine),
        "set_location_value" => cmd_set_location_value(id, p, engine),
        "close_location"     => cmd_close_location(id, p, engine),
        
        // === AGENT ===
        "get_agent"          => cmd_get_agent(id, p, engine),
        "search_agents"      => cmd_search_agents(id, p, engine),
        "set_agent_wealth"   => cmd_set_agent_wealth(id, p, engine),
        "set_agent_income"   => cmd_set_agent_income(id, p, engine),
        "set_agent_health"   => cmd_set_agent_health(id, p, engine),
        "fire_agent"         => cmd_fire_agent(id, p, engine),
        
        // === BULK / SCENARIO ===
        "stimulus_check"     => cmd_stimulus_check(id, p, engine),
        "mass_layoff"        => cmd_mass_layoff(id, p, engine),
        "pandemic"           => cmd_pandemic(id, p, engine),
        
        _ => CommandResult::err(id, &format!("Unknown action: {}", cmd.action)),
    }
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
            let stats = engine.county_stats_cache.iter().find(|s| s.county_id == cid);
            match stats {
                Some(s) => CommandResult::ok(id, json!(s)),
                None => CommandResult::err(id, "County stats not found"),
            }
        }
        None => {
            // Return all counties
            CommandResult::ok(id, json!(engine.county_stats_cache))
        }
    }
}

fn cmd_depreciate_homes(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let pct = match p.get("pct").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'pct' (e.g. 0.10 for 10%)"),
    };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let mult = 1.0 - pct;
    let mut count = 0u32;
    let mut total_old = 0f64;
    let mut total_new = 0f64;
    
    for loc in engine.locations.values_mut() {
        if loc.location_type != spatial::LocationType::Residential { continue; }
        if let Some(cid) = county_filter {
            if loc.county != cid { continue; }
        }
        total_old += loc.value as f64;
        loc.value *= mult;
        total_new += loc.value as f64;
        count += 1;
    }
    
    CommandResult::ok(id, json!({
        "affected": count,
        "avg_old_value": if count > 0 { total_old / count as f64 } else { 0.0 },
        "avg_new_value": if count > 0 { total_new / count as f64 } else { 0.0 },
    }))
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
        if let Some(cid) = county_filter {
            if loc.county != cid { continue; }
        }
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
    
    // Find matching org IDs
    let mut affected_org_ids: Vec<u32> = Vec::new();
    for (&oid, org) in &engine.organizations {
        if !name_lower.is_empty() && !org.name.to_lowercase().contains(&name_lower) {
            continue;
        }
        affected_org_ids.push(oid);
    }
    
    // Close matching locations
    let mut closed_locations = 0u32;
    let mut affected_loc_ids: Vec<u32> = Vec::new();
    for (&lid, loc) in engine.locations.iter_mut() {
        let type_ok = loc.location_type == spatial::LocationType::Store 
            || loc.location_type == spatial::LocationType::Employer;
        if !type_ok { continue; }
        if let Some(cid) = county_filter {
            if loc.county != cid { continue; }
        }
        let org_match = if !name_lower.is_empty() {
            loc.organization_id.map(|oid| affected_org_ids.contains(&oid)).unwrap_or(false)
                || loc.name.as_deref().map(|n| n.to_lowercase().contains(&name_lower)).unwrap_or(false)
        } else {
            true // County-only filter, match all businesses
        };
        if org_match {
            loc.value = 0.0;
            affected_loc_ids.push(lid);
            closed_locations += 1;
        }
    }
    
    // Fire employees at those locations
    let mut fired = 0u32;
    for agent in &mut engine.agents {
        if let Some(eid) = agent.employer_location_id {
            if affected_loc_ids.contains(&eid) {
                agent.employer_location_id = None;
                agent.income *= 0.15; // Unemployment income
                fired += 1;
            }
        }
    }
    
    // Zero org funds
    for oid in &affected_org_ids {
        if let Some(org) = engine.organizations.get_mut(oid) {
            org.total_funds = 0.0;
            org.avg_revenue = 0.0;
        }
    }
    
    CommandResult::ok(id, json!({
        "closed_locations": closed_locations,
        "orgs_affected": affected_org_ids.len(),
        "employees_fired": fired,
    }))
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
        if engine.organizations.contains_key(&oid) {
            target_ids.push(oid);
        }
    } else if let Some(name) = name_filter {
        let nl = name.to_lowercase();
        for (&oid, org) in &engine.organizations {
            if org.name.to_lowercase().contains(&nl) {
                target_ids.push(oid);
            }
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
    
    // Fire employees
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

fn cmd_close_location(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let loc_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    
    if !engine.locations.contains_key(&loc_id) {
        return CommandResult::err(id, "Location not found");
    }
    
    engine.locations.get_mut(&loc_id).unwrap().value = 0.0;
    
    // Evict occupants / fire employees
    let mut affected_agents = 0u32;
    for agent in &mut engine.agents {
        if agent.home_location_id == loc_id {
            // Will trigger home-move check naturally
            affected_agents += 1;
        }
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

fn cmd_set_agent_wealth(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    let value = match p.get("value").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'value'"),
    };
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(agent) => {
            let old = agent.wealth;
            agent.wealth = value;
            CommandResult::ok(id, json!({"old": old, "new": value}))
        }
        None => CommandResult::err(id, "Agent not found"),
    }
}

fn cmd_set_agent_income(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    let value = match p.get("value").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'value'"),
    };
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(agent) => {
            let old = agent.income;
            agent.income = value;
            CommandResult::ok(id, json!({"old": old, "new": value}))
        }
        None => CommandResult::err(id, "Agent not found"),
    }
}

fn cmd_set_agent_health(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    let value = match p.get("value").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'value'"),
    };
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(agent) => {
            let old = agent.health;
            agent.health = value.clamp(0.0, 1.0);
            CommandResult::ok(id, json!({"old": old, "new": agent.health}))
        }
        None => CommandResult::err(id, "Agent not found"),
    }
}

fn cmd_fire_agent(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let agent_id = match p.get("id").and_then(|v| v.as_u64()) {
        Some(id) => id as u32,
        None => return CommandResult::err(id, "Missing 'id'"),
    };
    match engine.agents.iter_mut().find(|a| a.id == agent_id) {
        Some(agent) => {
            let was_employed = agent.employer_location_id.is_some();
            agent.employer_location_id = None;
            agent.income *= 0.15;
            CommandResult::ok(id, json!({"was_employed": was_employed}))
        }
        None => CommandResult::err(id, "Agent not found"),
    }
}

// ============================================================================
// BULK / SCENARIO COMMANDS
// ============================================================================

fn cmd_stimulus_check(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let amount = match p.get("amount").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'amount'"),
    };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let mut count = 0u32;
    
    for agent in &mut engine.agents {
        if let Some(cid) = county_filter {
            if agent.county != cid { continue; }
        }
        agent.wealth += amount;
        count += 1;
    }
    
    engine.state_entity.cash_reserves -= amount as f64 * count as f64;
    
    CommandResult::ok(id, json!({
        "recipients": count,
        "total_distributed": amount as f64 * count as f64,
        "state_reserves_after": engine.state_entity.cash_reserves,
    }))
}

fn cmd_mass_layoff(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let pct = match p.get("pct").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'pct' (e.g. 0.20 for 20%)"),
    };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let org_filter = p.get("org_id").and_then(|v| v.as_u64()).map(|v| v as u32);
    
    let mut fired = 0u32;
    let tick = engine.global_state.tick;
    
    for agent in &mut engine.agents {
        if agent.employer_location_id.is_none() { continue; }
        if let Some(cid) = county_filter {
            if agent.county != cid { continue; }
        }
        if let Some(target_oid) = org_filter {
            let agent_org = agent.employer_location_id
                .and_then(|eid| engine.locations.get(&eid))
                .and_then(|l| l.organization_id);
            if agent_org != Some(target_oid) { continue; }
        }
        // Use destiny hash for deterministic selection
        if spatial::fate(agent.destiny, tick, 5000) < pct {
            agent.employer_location_id = None;
            agent.income *= 0.15;
            fired += 1;
        }
    }
    
    CommandResult::ok(id, json!({"fired": fired, "pct_requested": pct}))
}

fn cmd_pandemic(id: &str, p: &Value, engine: &mut SimulationEngine) -> CommandResult {
    let severity = match p.get("severity").and_then(|v| v.as_f64()) {
        Some(v) => v as f32,
        None => return CommandResult::err(id, "Missing 'severity' (0.0-1.0)"),
    };
    let county_filter = p.get("county").and_then(|v| v.as_str()).map(spatial::county_to_id);
    let tick = engine.global_state.tick;
    
    let mut health_affected = 0u32;
    let mut stores_closed = 0u32;
    let mut fired = 0u32;
    
    // Reduce agent health
    for agent in &mut engine.agents {
        if let Some(cid) = county_filter {
            if agent.county != cid { continue; }
        }
        let hit = spatial::fate(agent.destiny, tick, 6000) < severity;
        if hit {
            let reduction = 0.1 + 0.4 * severity * spatial::fate(agent.destiny, tick, 6001);
            agent.health = (agent.health - reduction).max(0.0);
            health_affected += 1;
        }
    }
    
    // Close stores (proportional to severity)
    for loc in engine.locations.values_mut() {
        if loc.location_type != spatial::LocationType::Store { continue; }
        if let Some(cid) = county_filter {
            if loc.county != cid { continue; }
        }
        if spatial::fate(loc.destiny, tick, 6010) < severity * 0.8 {
            loc.value *= 0.1; // Massive devaluation
            stores_closed += 1;
        }
    }
    
    // Layoffs
    for agent in &mut engine.agents {
        if agent.employer_location_id.is_none() { continue; }
        if let Some(cid) = county_filter {
            if agent.county != cid { continue; }
        }
        if spatial::fate(agent.destiny, tick, 6020) < severity * 0.3 {
            agent.employer_location_id = None;
            agent.income *= 0.15;
            fired += 1;
        }
    }
    
    CommandResult::ok(id, json!({
        "severity": severity,
        "health_affected": health_affected,
        "stores_closed": stores_closed,
        "employees_fired": fired,
    }))
}
