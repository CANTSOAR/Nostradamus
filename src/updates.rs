use crate::entities::{Agent, Organization, StateEntity};
use crate::spatial::{self, Location, fate};
use std::collections::HashMap;

// ============================================================================
// AGENT DAILY UPDATES (all randomness from destiny hash)
// ============================================================================

/// Daily income, consumption, wealth. Uses fate() instead of rand.
pub fn update_agent_finances(agent: &mut Agent, day_of_week: u8, sector_boost: f32, tick: u64) {
    let d = agent.destiny;
    let is_weekend = day_of_week == 5 || day_of_week == 6;
    let daily_income = agent.income / 365.0;
    
    let income_variance = 0.9 + 0.2 * fate(d, tick, 100);
    let actual_income = daily_income * income_variance * sector_boost;

    let mut consumption_mult = 0.8 + 0.4 * fate(d, tick, 101);
    if is_weekend {
        consumption_mult += 0.5 * fate(d, tick, 102);
    }
    
    // Rare big expenses (0.5% chance per day)
    if fate(d, tick, 103) < 0.005 {
        consumption_mult += 5.0 + 15.0 * fate(d, tick, 104);
    }

    let consumed = agent.propensity_to_consume * daily_income * consumption_mult;
    agent.wealth += actual_income - consumed;
}

/// Daily health update. Decay if bankrupt, regenerate otherwise.
pub fn update_agent_health(agent: &mut Agent, tick: u64) {
    let d = agent.destiny;
    let mut delta: f32 = 0.0;
    let age_factor = (agent.age as f32 - 30.0).max(0.0) / 100.0;

    if agent.wealth <= 0.0 {
        delta -= 0.02 + 0.04 * fate(d, tick, 110);
    } else {
        delta += 0.005 + 0.01 * fate(d, tick, 111);
    }
    
    delta -= age_factor * 0.005 * fate(d, tick, 112);

    // Random illness (1% chance)
    if fate(d, tick, 113) < 0.01 {
        delta -= 0.05 + 0.15 * fate(d, tick, 114);
    }
    
    agent.health = (agent.health + delta).clamp(0.0, 1.0);
}

/// Yearly age increment.
pub fn update_agent_age(agent: &mut Agent) {
    agent.age += 1;
}

/// Monthly housing cost deduction. Renters pay ~8% of home value/year, owners ~4%.
pub fn update_agent_housing(agent: &mut Agent, home_value: f32) {
    agent.is_homeowner = agent.wealth > home_value * 0.2 && agent.age >= 18;
    let annual_rate: f32 = if agent.is_homeowner { 0.04 } else { 0.08 };
    let monthly_cost = home_value * annual_rate / 12.0;
    agent.wealth -= monthly_cost;
}

/// Yearly age transition: school reassignment, workforce entry, retirement.
/// Called after update_agent_age() increments age.
pub fn handle_age_transition(
    agent: &mut Agent,
    elem: &HashMap<u8, Vec<u32>>,
    middle: &HashMap<u8, Vec<u32>>,
    high: &HashMap<u8, Vec<u32>>,
    college: &HashMap<u8, Vec<u32>>,
    all_workplaces: &[u32],
    tick: u64,
) {
    let d = agent.destiny;
    
    match agent.age {
        5 => {
            // Enter elementary school
            agent.school_location_id = pick_school(elem, agent.county, d);
            agent.education_level = 1;
        }
        11 => {
            // Enter middle school
            agent.school_location_id = pick_school(middle, agent.county, d);
            agent.education_level = 2;
        }
        14 => {
            // Enter high school
            agent.school_location_id = pick_school(high, agent.county, d);
            agent.education_level = 3;
        }
        18 => {
            // Graduate high school, ~60% go to college
            let goes_to_college = fate(d, tick, 2000) < 0.6;
            if goes_to_college {
                agent.school_location_id = pick_school(college, agent.county, d);
                agent.education_level = 4; // In college
            } else {
                // Enter workforce
                agent.school_location_id = None;
                agent.education_level = 3; // High school grad
                agent.employer_location_id = pick_random_workplace(all_workplaces, d, tick);
                if agent.employer_location_id.is_some() {
                    agent.income = agent.income.max(25000.0); // Min entry-level wage
                }
            }
        }
        22 => {
            // Graduate college if enrolled
            if agent.education_level == 4 {
                agent.school_location_id = None;
                agent.education_level = 5; // College grad
                agent.employer_location_id = pick_random_workplace(all_workplaces, d, tick);
                if agent.employer_location_id.is_some() {
                    agent.income = agent.income.max(25000.0) * 1.5; // College premium
                }
            }
        }
        65 => {
            // Retirement
            agent.employer_location_id = None;
            agent.income *= 0.4; // Retirement income
        }
        _ => {}
    }
}

/// Pick a random school from tier pool in agent's county.
fn pick_school(pool: &HashMap<u8, Vec<u32>>, county: u8, destiny: u64) -> Option<u32> {
    pool.get(&county).and_then(|schools| {
        if schools.is_empty() { return None; }
        let idx = (fate(destiny, 0, 33) * schools.len() as f32) as usize % schools.len();
        Some(schools[idx])
    })
}

/// Pick a random workplace from global list.
fn pick_random_workplace(all_workplaces: &[u32], destiny: u64, tick: u64) -> Option<u32> {
    if all_workplaces.is_empty() { return None; }
    let idx = (fate(destiny, tick, 34) * all_workplaces.len() as f32) as usize % all_workplaces.len();
    Some(all_workplaces[idx])
}

// ============================================================================
// HOME MOVING & JOB CHANGING
// ============================================================================

/// Returns Some(new_home_id) if agent moves, None otherwise.
pub fn check_home_move(
    agent: &Agent,
    residential_in_county: &[u32],
    location_map: &HashMap<u32, Location>,
    tick: u64,
) -> Option<u32> {
    let d = agent.destiny;
    let mut move_prob: f32 = 0.0002;
    
    if agent.age >= 18 && agent.age <= 30 { move_prob *= 2.5; }
    if agent.wealth > 100_000.0 { move_prob *= 1.5; }
    if agent.wealth < 0.0 { move_prob *= 3.0; }
    if agent.family_agent_ids.is_empty() { move_prob *= 1.3; }
    
    if fate(d, tick, 200) >= move_prob { return None; }
    
    // Filter to value-appropriate homes

    let mut best: Option<u32> = None;
    let mut best_dist = f32::MAX;
    
    // Sample up to 20 random candidates instead of iterating all
    let n = residential_in_county.len();
    if n == 0 { return None; }
    
    for i in 0..20u16 {
        let idx = (fate(d, tick, 210 + i) * n as f32) as usize % n;
        let id = residential_in_county[idx];
        if id == agent.home_location_id { continue; }
        if let Some(loc) = location_map.get(&id) {
            let ratio = loc.value / (agent.wealth.abs() + 1.0);
            if ratio > 0.1 && ratio < 10.0 {
                let dist = (ratio - 1.0).abs();
                if dist < best_dist {
                    best_dist = dist;
                    best = Some(id);
                }
            }
        }
    }
    
    best
}

/// Returns Some(new_employer_id) if agent changes jobs.
pub fn check_job_change(
    agent: &Agent,
    employers_in_county: &[u32],
    tick: u64,
) -> Option<u32> {
    let d = agent.destiny;
    let mut change_prob: f32 = 0.0001;
    
    if agent.age >= 18 && agent.age <= 35 { change_prob *= 2.0; }
    if agent.health < 0.5 { change_prob *= 2.0; }
    if agent.income < 40000.0 && agent.age > 25 { change_prob *= 1.5; }
    if agent.employer_location_id.is_none() && agent.age >= 18 {
        change_prob = 0.05;
    }
    
    if fate(d, tick, 300) >= change_prob { return None; }
    
    let n = employers_in_county.len();
    if n == 0 { return None; }
    let idx = (fate(d, tick, 301) * n as f32) as usize % n;
    let candidate = employers_in_county[idx];
    if Some(candidate) == agent.employer_location_id { return None; }
    Some(candidate)
}

// ============================================================================
// IMMIGRATION & EMIGRATION
// ============================================================================

pub fn check_emigration(agent: &Agent, state: &StateEntity, tick: u64) -> bool {
    let mut emigrate_prob: f32 = 0.00005;
    
    if agent.wealth < -5000.0 { emigrate_prob += 0.001; }
    if agent.health < 0.3 { emigrate_prob += 0.0005; }
    if state.wealth_disparity > 0.6 { emigrate_prob *= 2.0; }
    if state.cash_reserves < 0.0 { emigrate_prob *= 1.5; }
    if agent.age >= 18 && agent.age <= 35 && agent.employer_location_id.is_none() {
        emigrate_prob *= 3.0;
    }
    
    fate(agent.destiny, tick, 400) < emigrate_prob
}

pub fn calc_immigration_count(state: &StateEntity, available_homes: usize) -> usize {
    if available_homes == 0 { return 0; }
    
    let mut base_rate: f32 = 1.5;
    if state.total_economy_value > 0.0 && state.cash_reserves > 10_000_000.0 {
        base_rate *= 1.5;
    }
    if state.wealth_disparity < 0.3 {
        base_rate *= 1.3;
    }
    
    let count = base_rate as usize;
    count.min(available_homes).min(5)
}

// ============================================================================
// ORGANIZATION & LOCATION FINANCES
// ============================================================================

pub fn update_org_finances(org: &mut Organization, day_of_week: u8, sector_mult: f32) {
    let is_weekend = day_of_week == 5 || day_of_week == 6;
    let base_daily_rev = org.avg_revenue / 365.0;
    let base_daily_bills = org.avg_bills / 365.0;
    
    // Use org id as pseudo-destiny for deterministic-ish behavior
    let d = org.id as u64 * 2654435761;
    let tick = 0u64; // Orgs use a simpler approach
    
    let mut rev_mult = 0.8 + 0.4 * fate(d, tick, 500) as f64;
    if is_weekend {
        rev_mult = 0.5 + 1.0 * fate(d, tick, 501) as f64;
    }
    rev_mult *= sector_mult as f64;
    
    let mut bill_mult = 0.95 + 0.1 * fate(d, tick, 502) as f64;
    if fate(d, tick, 503) < 0.01 {
        bill_mult += 1.0 + 3.0 * fate(d, tick, 504) as f64;
    }

    org.total_funds += base_daily_rev * rev_mult - base_daily_bills * bill_mult;
}

pub fn update_location_finances(loc: &mut Location, base_revenue: f64, base_bills: f64, day_of_week: u8, sector_mult: f32, tick: u64) {
    let d = loc.destiny;
    let is_weekend = day_of_week == 5 || day_of_week == 6;
    let mut rev_mult = 0.7 + 0.6 * fate(d, tick, 600);
    
    if loc.location_type == spatial::LocationType::Store && is_weekend {
        rev_mult += 0.4 + 0.6 * fate(d, tick, 601);
    }
    rev_mult *= sector_mult;
    
    let mut bill_mult = 0.9 + 0.2 * fate(d, tick, 602);
    if fate(d, tick, 603) < 0.005 {
        bill_mult += 2.0 + 5.0 * fate(d, tick, 604);
    }

    let daily_rev = (base_revenue / 365.0) as f32 * rev_mult;
    let daily_bills = (base_bills / 365.0) as f32 * bill_mult;
    loc.value += daily_rev - daily_bills;
}

// ============================================================================
// STATE-LEVEL UPDATES
// ============================================================================

pub fn update_state_cashflow(
    state: &mut StateEntity,
    agents: &[Agent],
    orgs: &HashMap<u32, Organization>,
) {
    let total_daily_income: f64 = agents.iter()
        .map(|a| a.income as f64 / 365.0)
        .sum();
    let tax_revenue = total_daily_income * state.state_tax_rate as f64;
    
    let corp_tax: f64 = orgs.values()
        .filter(|o| o.total_funds > 0.0)
        .map(|o| (o.avg_revenue / 365.0) * 0.02)
        .sum();
    
    let federal_aid = 7500.0; // Deterministic daily baseline
    
    let infra_cost = state.population as f64 * 0.5;
    let services_cost = state.population as f64 * 0.3;
    
    state.cash_reserves += tax_revenue + corp_tax + federal_aid - infra_cost - services_cost;
    
    state.population = agents.len() as u32;
    if !agents.is_empty() {
        let total_wealth: f32 = agents.iter().map(|a| a.wealth).sum();
        state.avg_wealth = total_wealth / agents.len() as f32;
        
        let variance: f32 = agents.iter()
            .map(|a| (a.wealth - state.avg_wealth).powi(2))
            .sum::<f32>() / agents.len() as f32;
        let std_dev = variance.sqrt();
        state.wealth_disparity = (std_dev / (state.avg_wealth.abs() + 1.0)).clamp(0.0, 1.0);
    }
    
    let org_total: f64 = orgs.values().map(|o| o.total_funds).sum();
    let agent_total: f64 = agents.iter().map(|a| a.wealth as f64).sum();
    state.total_economy_value = state.cash_reserves + org_total + agent_total;
}

pub fn update_state_policy(state: &mut StateEntity) {
    if state.wealth_disparity > 0.5 {
        state.state_tax_rate += 0.002;
    } else if state.wealth_disparity < 0.2 {
        state.state_tax_rate -= 0.001;
    }
    
    if state.cash_reserves < 1_000_000.0 {
        state.state_tax_rate += 0.002;
    }
    
    if state.total_economy_value < 0.0 || (state.avg_wealth as f64) < 1000.0 {
        state.fed_funds_rate -= 0.003;
    } else if state.avg_wealth > 50000.0 {
        state.fed_funds_rate += 0.002;
    }
    
    state.state_tax_rate = state.state_tax_rate.clamp(0.01, 0.15);
    state.fed_funds_rate = state.fed_funds_rate.clamp(0.0, 0.12);
}

pub fn update_industry_favorability(state: &mut StateEntity) {
    // Deterministic drift based on current value
    for (_sector, fav) in state.sector_favorability.iter_mut() {
        let drift = (*fav - 1.0) * -0.05; // Mean-reversion toward 1.0
        *fav += drift;
        *fav = fav.clamp(0.5, 1.5);
    }
}

// ============================================================================
// EXTREME / SHOCK EVENTS
// ============================================================================

pub fn apply_extreme_event(
    agents: &mut [Agent],
    orgs: &mut HashMap<u32, Organization>,
    locations: &mut HashMap<u32, Location>,
    state: &mut StateEntity,
) {
    // Use state tick as seed for extreme events (global, not per-entity)
    let tick_seed = state.population as u64 * 2654435761;
    if fate(tick_seed, 0, 900) >= 0.001 { return; }
    
    let target_level = (fate(tick_seed, 0, 901) * 4.0) as u32;
    let shock_mult = 0.2 + 2.8 * fate(tick_seed, 0, 902);
    
    match target_level {
        0 => {
            if !agents.is_empty() {
                let idx = (fate(tick_seed, 0, 903) * agents.len() as f32) as usize % agents.len();
                if fate(tick_seed, 0, 904) < 0.5 {
                    agents[idx].wealth *= shock_mult;
                } else {
                    agents[idx].health = (agents[idx].health * shock_mult).clamp(0.0, 1.0);
                }
            }
        },
        1 => {
            let keys: Vec<u32> = orgs.keys().copied().collect();
            if !keys.is_empty() {
                let idx = (fate(tick_seed, 0, 905) * keys.len() as f32) as usize % keys.len();
                let key = keys[idx];
                if let Some(org) = orgs.get_mut(&key) {
                    let roll = fate(tick_seed, 0, 906);
                    if roll < 0.33 {
                        org.total_funds *= shock_mult as f64;
                    } else if roll < 0.66 {
                        org.avg_revenue *= shock_mult as f64;
                    } else {
                        org.avg_bills *= shock_mult as f64;
                    }
                }
            }
        },
        2 => {
            let keys: Vec<u32> = locations.keys().copied().collect();
            if !keys.is_empty() {
                let idx = (fate(tick_seed, 0, 907) * keys.len() as f32) as usize % keys.len();
                let key = keys[idx];
                if let Some(loc) = locations.get_mut(&key) {
                    loc.value *= shock_mult;
                }
            }
        },
        _ => {
            let roll = fate(tick_seed, 0, 908);
            if roll < 0.33 {
                state.cash_reserves *= shock_mult as f64;
            } else if roll < 0.66 {
                state.state_tax_rate = (state.state_tax_rate * shock_mult).clamp(0.01, 0.15);
            } else {
                state.fed_funds_rate = (state.fed_funds_rate * shock_mult).clamp(0.0, 0.12);
            }
        },
    }
}

// ============================================================================
// DEATH, CONCEPTION, WEATHER, MOVEMENT
// ============================================================================

pub fn check_agent_death(agent: &Agent, tick: u64) -> bool {
    if agent.health <= 0.0 { return true; }
    if agent.age >= 120 { return true; }

    let mut death_prob: f32 = 0.000001;
    if agent.age > 60 {
        let age_factor = (agent.age as f32 - 60.0) / 10.0;
        death_prob += 0.0001 * (2.0f32).powf(age_factor);
    }
    if agent.health < 0.2 {
        death_prob += 0.05 * (1.0 - agent.health);
    }

    fate(agent.destiny, tick, 700) < death_prob
}

pub fn check_conception(occupants: &[&Agent], tick: u64) -> bool {
    if occupants.len() != 2 { return false; }
    let a1 = occupants[0];
    let a2 = occupants[1];
    if a1.age < 18 || a2.age < 18 || a1.age > 60 || a2.age > 60 { return false; }
    
    let mut conception_prob: f32 = 0.0001;
    let avg_age = (a1.age as f32 + a2.age as f32) / 2.0;
    if avg_age > 25.0 && avg_age < 35.0 { conception_prob *= 2.0; }
    
    let combined_wealth = a1.wealth + a2.wealth;
    if combined_wealth > 50000.0 { conception_prob *= 1.5; }
    else if combined_wealth < 0.0 { conception_prob *= 0.1; }
    
    let avg_health = (a1.health + a2.health) / 2.0;
    if avg_health < 0.5 { conception_prob *= 0.2; }

    fate(a1.destiny ^ a2.destiny, tick, 800) < conception_prob
}

pub fn update_weather(active_weather: &mut Vec<crate::entities::Weather>) {
    // Weather uses a simple state machine, no per-entity destiny needed
    // Clear existing weather 20% of the time
    if active_weather.len() > 0 {
        active_weather.retain(|w| w.severity > 0.1);
        for w in active_weather.iter_mut() {
            w.severity *= 0.95; // Weather naturally decays
        }
    }
    
    // Spawn new weather rarely (deterministic based on simple clock)
    if active_weather.is_empty() {
        // Use a simple hash of current instant
        let now_seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let spawn_roll = fate(now_seed, 0, 850);
        
        let condition = if spawn_roll < 0.001 {
            Some(crate::entities::WeatherType::Hurricane)
        } else if spawn_roll < 0.010 {
            Some(crate::entities::WeatherType::Snow)
        } else if spawn_roll < 0.020 {
            Some(crate::entities::WeatherType::Heatwave)
        } else if spawn_roll < 0.150 {
            Some(crate::entities::WeatherType::Rain)
        } else { None };
        
        if let Some(c) = condition {
            active_weather.push(crate::entities::Weather {
                condition: c,
                severity: 0.6,
            });
        }
    }
}

pub fn determine_agent_target(
    agent: &Agent, 
    tick: u64, 
    day_of_week: u8,
    is_bad_weather: bool,
    county_destinations: &HashMap<u8, Vec<u32>>
) -> u32 {
    let d = agent.destiny;
    let hour = tick % 24;
    let is_weekend = day_of_week == 5 || day_of_week == 6;
    
    // === TODDLERS (0-4): always home ===
    if agent.age < 5 {
        return agent.home_location_id;
    }
    
    // === SCHOOL-AGE (5-17) or COLLEGE (education_level == 4): school on weekdays ===
    if agent.school_location_id.is_some() && (agent.age <= 17 || agent.education_level == 4) {
        if !is_weekend && hour >= 7 && hour <= 15 {
            // School hours: 7am-3pm
            if is_bad_weather && fate(d, tick, 1010) < 0.3 {
                return agent.home_location_id; // Snow day!
            }
            return agent.school_location_id.unwrap();
        }
        // After school hours or weekends: home or other
        if hour >= 15 && hour <= 20 && !is_weekend && fate(d, tick, 1011) < 0.3 {
            // After-school activities
            if let Some(locs) = county_destinations.get(&agent.county) {
                if !locs.is_empty() {
                    let idx = (fate(d, tick, 1012) * locs.len() as f32) as usize % locs.len();
                    return locs[idx];
                }
            }
        }
        return agent.home_location_id;
    }
    
    // === ADULTS: existing work/home/other logic ===
    let mut p_home: f32 = 1.0;
    let mut p_work: f32 = 1.0;
    let mut p_other: f32 = 1.0;
    
    if hour >= 5 && hour <= 10 { p_work += 50.0; }
    else if hour >= 18 || hour <= 4 { p_home += 80.0; }
    else { p_work += 20.0; p_other += 10.0; }
    
    if is_weekend { p_work = 0.0; p_home += 30.0; p_other += 40.0; }
    else { p_work += 40.0; }
    
    if agent.age >= 65 { p_work = 0.0; p_home += 50.0; p_other += 10.0; }
    
    let has_kids = !agent.family_agent_ids.is_empty();
    if has_kids { p_home += 30.0; p_other -= 5.0; }
    else { p_other += 20.0; }
    
    if is_bad_weather { p_home += 100.0; p_other -= 50.0; }
    else { p_other += 20.0; }
    
    if p_other < 0.0 { p_other = 0.0; }
    
    let total = p_home + p_work + p_other;
    let roll = fate(d, tick, 1000) * total;
    
    if roll < p_home {
        agent.home_location_id
    } else if roll < p_home + p_work {
        agent.employer_location_id.unwrap_or(agent.home_location_id)
    } else {
        if let Some(locs) = county_destinations.get(&agent.county) {
            if locs.is_empty() { return agent.home_location_id; }
            let idx = (fate(d, tick, 1001) * locs.len() as f32) as usize % locs.len();
            let pick = locs[idx];
            if pick != agent.home_location_id && Some(pick) != agent.employer_location_id {
                pick
            } else {
                agent.home_location_id
            }
        } else {
            agent.home_location_id
        }
    }
}
