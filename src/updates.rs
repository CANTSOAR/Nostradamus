use crate::entities::{Agent, Organization, StateEntity};
use crate::spatial::Location;
use std::collections::HashMap;

// ============================================================================
// AGENT DAILY UPDATES
// ============================================================================

/// Runs every 24 ticks (Daily). Processes income, consumption, and wealth accumulation.
pub fn update_agent_finances(agent: &mut Agent, day_of_week: u8, sector_boost: f64) {
    let is_weekend = day_of_week == 5 || day_of_week == 6;
    let daily_income = agent.income / 365.0;
    
    // Income is affected by industry favorability
    let income_variance = 0.9 + 0.2 * rand::random::<f64>();
    let actual_income = daily_income * income_variance * sector_boost;

    let mut consumption_multiplier = 0.8 + 0.4 * rand::random::<f64>();
    if is_weekend {
        consumption_multiplier += 0.5 * rand::random::<f64>();
    }
    
    // Rare big expenses (medical, car repair) - 0.5% chance per day
    if rand::random::<f64>() < 0.005 {
        consumption_multiplier += 5.0 + 15.0 * rand::random::<f64>(); 
    }

    let consumed = agent.propensity_to_consume * daily_income * consumption_multiplier;
    agent.wealth += actual_income - consumed;
}

/// Runs every 24 ticks. Decays health if bankrupt, otherwise slowly regenerates.
pub fn update_agent_health(agent: &mut Agent) {
    let mut delta = 0.0;
    let age_factor = (agent.age as f64 - 30.0).max(0.0) / 100.0;

    if agent.wealth <= 0.0 {
        delta -= 0.02 + 0.04 * rand::random::<f64>(); 
    } else {
        delta += 0.005 + 0.01 * rand::random::<f64>();
    }
    
    delta -= age_factor * 0.005 * rand::random::<f64>();

    // Random illness (1% chance per day)
    if rand::random::<f64>() < 0.01 {
        delta -= 0.05 + 0.15 * rand::random::<f64>();
    }
    
    agent.health += delta;
    if agent.health > 1.0 { agent.health = 1.0; }
    if agent.health < 0.0 { agent.health = 0.0; }
}

/// Runs exactly once per 8760 ticks (Yearly)
pub fn update_agent_age(agent: &mut Agent) {
    agent.age += 1;
}

// ============================================================================
// HOME MOVING & JOB CHANGING
// ============================================================================

/// ~0.02% per day (~7% per year). Agents move to homes matching their wealth bracket.
/// Returns Some(new_home_id) if moving, None if staying.
pub fn check_home_move(
    agent: &Agent,
    residential_in_county: &[u64],
    location_map: &HashMap<u64, Location>,
) -> Option<u64> {
    // Base probability: 0.02%/day
    let mut move_prob = 0.0002;
    
    // Young adults (18-30) move more frequently
    if agent.age >= 18 && agent.age <= 30 { move_prob *= 2.5; }
    
    // Very wealthy agents in cheap areas want to upgrade
    if agent.wealth > 100_000.0 { move_prob *= 1.5; }
    
    // Negative wealth: desperate to find cheaper housing
    if agent.wealth < 0.0 { move_prob *= 3.0; }
    
    // No kids -> more mobile
    if agent.family_agent_ids.is_empty() { move_prob *= 1.3; }
    
    if rand::random::<f64>() >= move_prob { return None; }
    
    // Filter to homes with appropriate wealth bracket (±2x of agent's wealth)
    let candidates: Vec<u64> = residential_in_county.iter()
        .copied()
        .filter(|&id| {
            if id == agent.home_location_id { return false; }
            if let Some(loc) = location_map.get(&id) {
                // Wealth-appropriate: location wealth within 3x of agent wealth
                let ratio = loc.wealth / (agent.wealth.abs() + 1.0);
                ratio > 0.1 && ratio < 10.0
            } else { false }
        })
        .collect();
    
    if candidates.is_empty() { return None; }
    let idx = (rand::random::<f64>() * candidates.len() as f64) as usize;
    Some(candidates[idx.min(candidates.len() - 1)])
}

/// ~0.01% per day (~3.5% per year). Agents switch to jobs near their income.
/// Returns Some(new_employer_id) if switching, None if staying.
pub fn check_job_change(
    agent: &Agent,
    employers_in_county: &[u64],
) -> Option<u64> {
    // Base probability: 0.01%/day
    let mut change_prob = 0.0001;
    
    // Young workers (18-35) change jobs more
    if agent.age >= 18 && agent.age <= 35 { change_prob *= 2.0; }
    
    // Unhealthy workers more likely to lose/leave jobs
    if agent.health < 0.5 { change_prob *= 2.0; }
    
    // Low income relative to potential -> looking for better
    if agent.income < 40000.0 && agent.age > 25 { change_prob *= 1.5; }
    
    // Unemployed agents actively seek work
    if agent.employer_location_id.is_none() && agent.age >= 18 {
        change_prob = 0.05; // 5% chance per day to find work
    }
    
    if rand::random::<f64>() >= change_prob { return None; }
    
    // Filter to employers that aren't current employer
    let candidates: Vec<u64> = employers_in_county.iter()
        .copied()
        .filter(|&id| Some(id) != agent.employer_location_id)
        .collect();
    
    if candidates.is_empty() { return None; }
    let idx = (rand::random::<f64>() * candidates.len() as f64) as usize;
    Some(candidates[idx.min(candidates.len() - 1)])
}

// ============================================================================
// IMMIGRATION & EMIGRATION
// ============================================================================

/// Agents leave when conditions are terrible. ~0.005% per day for baseline.
pub fn check_emigration(agent: &Agent, state: &StateEntity) -> bool {
    let mut emigrate_prob = 0.00005;
    
    // Negative wealth is a strong driver
    if agent.wealth < -5000.0 { emigrate_prob += 0.001; }
    
    // Health below 30% pushes people away
    if agent.health < 0.3 { emigrate_prob += 0.0005; }
    
    // Bad state economy (high disparity, low cash) increases emigration
    if state.wealth_disparity > 0.6 { emigrate_prob *= 2.0; }
    if state.cash_reserves < 0.0 { emigrate_prob *= 1.5; }
    
    // Young adults with no job leave faster
    if agent.age >= 18 && agent.age <= 35 && agent.employer_location_id.is_none() {
        emigrate_prob *= 3.0;
    }
    
    rand::random::<f64>() < emigrate_prob
}

/// Determines how many immigrants arrive today. Returns count.
pub fn calc_immigration_count(state: &StateEntity, available_homes: usize) -> usize {
    if available_homes == 0 { return 0; }
    
    // Base: 1-2 per day for a small simulation
    let mut base_rate = 1.0 + rand::random::<f64>();
    
    // Good economy attracts more people
    if state.total_economy_value > 0.0 && state.cash_reserves > 10_000_000.0 {
        base_rate *= 1.5;
    }
    
    // Low disparity is attractive
    if state.wealth_disparity < 0.3 {
        base_rate *= 1.3;
    }
    
    // Cap by available housing
    let count = base_rate as usize;
    count.min(available_homes).min(5) // Max 5 per day in small sim
}

// ============================================================================
// ORGANIZATION & LOCATION FINANCES
// ============================================================================

/// Evaluated Daily. Revenue scaled by industry favorability.
pub fn update_org_finances(org: &mut Organization, day_of_week: u8, sector_mult: f64) {
    let is_weekend = day_of_week == 5 || day_of_week == 6;
    let base_daily_rev = org.avg_revenue / 365.0;
    let base_daily_bills = org.avg_bills / 365.0;
    
    let mut rev_multiplier = 0.8 + 0.4 * rand::random::<f64>();
    if is_weekend {
        rev_multiplier = 0.5 + 1.0 * rand::random::<f64>();
    }
    
    // Apply industry favorability from StateEntity
    rev_multiplier *= sector_mult;
    
    let mut bill_multiplier = 0.95 + 0.1 * rand::random::<f64>();
    if rand::random::<f64>() < 0.01 {
        bill_multiplier += 1.0 + 3.0 * rand::random::<f64>();
    }

    let daily_rev = base_daily_rev * rev_multiplier;
    let daily_bills = base_daily_bills * bill_multiplier;
    
    org.total_funds += daily_rev - daily_bills;
}

/// Evaluated Daily. Location inherits industry boost from parent org.
pub fn update_location_finances(loc: &mut Location, base_revenue: f64, base_bills: f64, day_of_week: u8, sector_mult: f64) {
    let is_weekend = day_of_week == 5 || day_of_week == 6;
    let mut rev_mult = 0.7 + 0.6 * rand::random::<f64>();
    
    if loc.location_type == crate::spatial::LocationType::Store && is_weekend {
        rev_mult += 0.4 + 0.6 * rand::random::<f64>(); 
    }
    
    // Apply sector multiplier
    rev_mult *= sector_mult;
    
    let mut bill_mult = 0.9 + 0.2 * rand::random::<f64>();
    if rand::random::<f64>() < 0.005 {
        bill_mult += 2.0 + 5.0 * rand::random::<f64>();
    }

    let daily_rev = (base_revenue / 365.0) * rev_mult;
    let daily_bills = (base_bills / 365.0) * bill_mult;
    loc.wealth += daily_rev - daily_bills;
}

// ============================================================================
// STATE-LEVEL UPDATES
// ============================================================================

/// Updates state cash reserves based on tax revenue and expenses (Daily)
pub fn update_state_cashflow(
    state: &mut StateEntity,
    agents: &[Agent],
    orgs: &HashMap<u64, Organization>,
) {
    // TAX REVENUE: sum of daily income * state tax rate
    let total_daily_income: f64 = agents.iter()
        .map(|a| a.income / 365.0)
        .sum();
    let tax_revenue = total_daily_income * state.state_tax_rate;
    
    // CORPORATE TAX: 2% of positive org daily revenue
    let corp_tax: f64 = orgs.values()
        .filter(|o| o.total_funds > 0.0)
        .map(|o| (o.avg_revenue / 365.0) * 0.02)
        .sum();
    
    // EXTERNAL FEDERAL AID: small random inflow
    let federal_aid = 5000.0 + 10000.0 * rand::random::<f64>();
    
    // EXPENSES: Infrastructure proportional to population
    let infra_cost = state.population as f64 * 0.5;
    let services_cost = state.population as f64 * 0.3;
    
    // Random emergency spending (0.5% chance of expensive event)
    let mut emergency = 0.0;
    if rand::random::<f64>() < 0.005 {
        emergency = 50000.0 + 200000.0 * rand::random::<f64>();
    }
    
    state.cash_reserves += tax_revenue + corp_tax + federal_aid - infra_cost - services_cost - emergency;
    
    // Update aggregate metrics
    state.population = agents.len() as u64;
    if !agents.is_empty() {
        let total_wealth: f64 = agents.iter().map(|a| a.wealth).sum();
        state.avg_wealth = total_wealth / agents.len() as f64;
        
        // Gini-like disparity: std_dev / mean ratio, clamped 0-1
        let variance: f64 = agents.iter()
            .map(|a| (a.wealth - state.avg_wealth).powi(2))
            .sum::<f64>() / agents.len() as f64;
        let std_dev = variance.sqrt();
        state.wealth_disparity = (std_dev / (state.avg_wealth.abs() + 1.0)).min(1.0).max(0.0);
    }
    
    // Total economy value: state cash + all org funds + all agent wealth + all location wealth
    let org_total: f64 = orgs.values().map(|o| o.total_funds).sum();
    let agent_total: f64 = agents.iter().map(|a| a.wealth).sum();
    state.total_economy_value = state.cash_reserves + org_total + agent_total;
}

/// Monthly policy adjustment (every 720 ticks). Small perturbations based on economy.
pub fn update_state_policy(state: &mut StateEntity) {
    // If wealth disparity is high → raise taxes slightly to redistribute
    if state.wealth_disparity > 0.5 {
        state.state_tax_rate += 0.001 + 0.004 * rand::random::<f64>();
    } else if state.wealth_disparity < 0.2 {
        // Very equal society → can afford to lower taxes
        state.state_tax_rate -= 0.001 + 0.002 * rand::random::<f64>();
    }
    
    // If state is running out of money → raise taxes
    if state.cash_reserves < 1_000_000.0 {
        state.state_tax_rate += 0.002;
    }
    
    // If economy shrinking → lower interest rates (stimulus)
    if state.total_economy_value < 0.0 || state.avg_wealth < 1000.0 {
        state.fed_funds_rate -= 0.0025 + 0.005 * rand::random::<f64>();
    } else if state.avg_wealth > 50000.0 {
        // Hot economy → raise rates to cool inflation
        state.fed_funds_rate += 0.001 + 0.004 * rand::random::<f64>();
    }
    
    // Clamp rates to realistic bounds
    state.state_tax_rate = state.state_tax_rate.clamp(0.01, 0.15);
    state.fed_funds_rate = state.fed_funds_rate.clamp(0.0, 0.12);
}

/// Monthly industry favorability random walk. Each sector drifts ±10% and clamps [0.5, 1.5].
pub fn update_industry_favorability(state: &mut StateEntity) {
    for (_sector, fav) in state.sector_favorability.iter_mut() {
        let drift = -0.1 + 0.2 * rand::random::<f64>(); // -0.1 to +0.1
        *fav += drift;
        *fav = fav.clamp(0.5, 1.5);
    }
}

// ============================================================================
// EXTREME / SHOCK EVENTS
// ============================================================================

/// ~0.1% chance per day. Randomly shocks a financial metric at any level.
pub fn apply_extreme_event(
    agents: &mut [Agent],
    orgs: &mut HashMap<u64, Organization>,
    locations: &mut HashMap<u64, Location>,
    state: &mut StateEntity,
) {
    if rand::random::<f64>() >= 0.001 { return; } // 99.9% of days: nothing happens
    
    let target_level = (rand::random::<f64>() * 4.0) as u32;
    let shock_mult = 0.2 + 2.8 * rand::random::<f64>(); // 0.2x to 3.0x
    
    match target_level {
        0 => {
            // AGENT SHOCK: random agent hit
            if !agents.is_empty() {
                let idx = (rand::random::<f64>() * agents.len() as f64) as usize;
                let idx = idx.min(agents.len() - 1);
                let roll = rand::random::<f64>();
                if roll < 0.5 {
                    agents[idx].wealth *= shock_mult;
                } else {
                    agents[idx].health = (agents[idx].health * shock_mult).clamp(0.0, 1.0);
                }
            }
        },
        1 => {
            // ORGANIZATION SHOCK: random org hit
            let keys: Vec<u64> = orgs.keys().copied().collect();
            if !keys.is_empty() {
                let idx = (rand::random::<f64>() * keys.len() as f64) as usize;
                let key = keys[idx.min(keys.len() - 1)];
                if let Some(org) = orgs.get_mut(&key) {
                    let roll = rand::random::<f64>();
                    if roll < 0.33 {
                        org.total_funds *= shock_mult;
                    } else if roll < 0.66 {
                        org.avg_revenue *= shock_mult;
                    } else {
                        org.avg_bills *= shock_mult;
                    }
                }
            }
        },
        2 => {
            // LOCATION SHOCK: random location hit
            let keys: Vec<u64> = locations.keys().copied().collect();
            if !keys.is_empty() {
                let idx = (rand::random::<f64>() * keys.len() as f64) as usize;
                let key = keys[idx.min(keys.len() - 1)];
                if let Some(loc) = locations.get_mut(&key) {
                    loc.wealth *= shock_mult;
                }
            }
        },
        _ => {
            // STATE SHOCK: affects state directly
            let roll = rand::random::<f64>();
            if roll < 0.33 {
                state.cash_reserves *= shock_mult;
            } else if roll < 0.66 {
                state.state_tax_rate = (state.state_tax_rate * shock_mult).clamp(0.01, 0.15);
            } else {
                state.fed_funds_rate = (state.fed_funds_rate * shock_mult).clamp(0.0, 0.12);
            }
        },
    }
}

// ============================================================================
// EXISTING: DEATH, CONCEPTION, WEATHER, MOVEMENT
// ============================================================================

pub fn check_agent_death(agent: &Agent) -> bool {
    if agent.health <= 0.0 { return true; }

    let mut death_prob = 0.000001;
    if agent.age > 60 {
        let age_factor = (agent.age as f64 - 60.0) / 10.0;
        death_prob += 0.0001 * (2.0f64).powf(age_factor); 
    }
    if agent.health < 0.2 {
        death_prob += 0.05 * (1.0 - agent.health);
    }
    if agent.age >= 120 { return true; }

    rand::random::<f64>() < death_prob
}

pub fn check_conception(occupants: &[&Agent]) -> bool {
    if occupants.len() != 2 { return false; }
    let a1 = occupants[0];
    let a2 = occupants[1];
    if a1.age < 18 || a2.age < 18 { return false; }
    if a1.age > 60 || a2.age > 60 { return false; }
    
    let mut conception_prob = 0.0001;
    let avg_age = (a1.age as f64 + a2.age as f64) / 2.0;
    if avg_age > 25.0 && avg_age < 35.0 { conception_prob *= 2.0; }
    
    let combined_wealth = a1.wealth + a2.wealth;
    if combined_wealth > 50000.0 { conception_prob *= 1.5; }
    else if combined_wealth < 0.0 { conception_prob *= 0.1; }
    
    let avg_health = (a1.health + a2.health) / 2.0;
    if avg_health < 0.5 { conception_prob *= 0.2; }

    rand::random::<f64>() < conception_prob
}

pub fn update_weather(active_weather: &mut Vec<crate::entities::Weather>) {
    if rand::random::<f64>() < 0.20 { active_weather.clear(); }
    
    if active_weather.is_empty() {
        let spawn_roll = rand::random::<f64>();
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
                severity: 0.2 + 0.8 * rand::random::<f64>(),
            });
        }
    }
}

pub fn determine_agent_target(
    agent: &Agent, 
    tick: u64, 
    day_of_week: u8,
    is_bad_weather: bool,
    county_destinations: &HashMap<String, Vec<u64>>
) -> u64 {
    let hour = tick % 24;
    let is_weekend = day_of_week == 5 || day_of_week == 6;
    
    let mut p_home: f64 = 1.0;
    let mut p_work: f64 = 1.0;
    let mut p_other: f64 = 1.0;
    
    if hour >= 5 && hour <= 10 { p_work += 50.0; }
    else if hour >= 18 || hour <= 4 { p_home += 80.0; }
    else { p_work += 20.0; p_other += 10.0; }
    
    if is_weekend { p_work = 0.0; p_home += 30.0; p_other += 40.0; }
    else { p_work += 40.0; }
    
    if agent.age >= 75 { p_work = 0.0; p_home += 50.0; p_other += 10.0; }
    
    let has_kids = !agent.family_agent_ids.is_empty() || (agent.age > 25 && agent.age < 50 && agent.id % 3 == 0);
    if has_kids { p_home += 30.0; p_other -= 5.0; }
    else { p_other += 20.0; }
    
    if is_bad_weather { p_home += 100.0; p_other -= 50.0; }
    else { p_other += 20.0; }
    
    if p_other < 0.0 { p_other = 0.0; }
    
    let total = p_home + p_work + p_other;
    let roll = rand::random::<f64>() * total;
    
    if roll < p_home {
        agent.home_location_id
    } else if roll < p_home + p_work {
        agent.employer_location_id.unwrap_or(agent.home_location_id)
    } else {
        let mut eligible = Vec::new();
        if let Some(ref hc) = agent.home_county { if let Some(locs) = county_destinations.get(hc) { eligible.extend_from_slice(locs); } }
        if let Some(ref wc) = agent.work_county { if let Some(locs) = county_destinations.get(wc) { eligible.extend_from_slice(locs); } }
        eligible.retain(|&id| id != agent.home_location_id && Some(id) != agent.employer_location_id);
        
        if eligible.is_empty() { agent.home_location_id }
        else {
            let idx = (rand::random::<f64>() * eligible.len() as f64) as usize;
            eligible[idx.min(eligible.len() - 1)]
        }
    }
}
