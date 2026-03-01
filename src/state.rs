use serde::{Serialize, Deserialize};

/// Global simulation state and parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Global {
    /// The current time-step of the simulation
    pub tick: u64,
    /// Offset in seconds from Jan 1, 2010 (1 tick = 1 hour)
    pub time_offset_seconds: u64,
    /// Current internal day of the week (0 = Mon, 6 = Sun)
    pub day_of_week: u8,
    
    // Macro-Economic Parameters
    /// Baseline global tax rate applied to income
    pub base_tax_rate: f64,
    /// The daily cost of living multiplier
    pub inflation_rate: f64,
    /// Standard interest rate for organizations
    pub base_interest_rate: f64,

    // Demographic Parameters
    /// Baseline ambient mortality rate
    pub death_rate: f64,
    /// Baseline birth rate based on healthy, wealthy agents
    pub birth_rate: f64,
    /// Rate at which external agents enter the grid
    pub immigration_rate: f64,
    /// Rate at which agents leave the grid due to poor conditions
    pub emigration_rate: f64,

    /// The spatial grid resolution mapping lat/lon to simulation chunks
    pub grid_resolution: f64,
}

impl Default for Global {
    fn default() -> Self {
        Self {
            tick: 0,
            time_offset_seconds: 0,
            day_of_week: 0,
            base_tax_rate: 0.05,
            inflation_rate: 1.02,
            base_interest_rate: 0.04,
            death_rate: 0.001,
            birth_rate: 0.002,
            immigration_rate: 0.005,
            emigration_rate: 0.003,
            grid_resolution: 0.1,
        }
    }
}

// ==========================================
// CORE MACRO-MECHANICS
// ==========================================
impl Global {
    // ----------------------
    // Economics
    // ----------------------

    /// Calculate the income tax owed by an agent in a given tick
    pub fn calculate_tax(&self, agent_income: f64, local_multiplier: f64) -> f64 {
        agent_income * (self.base_tax_rate * local_multiplier)
    }

    /// Calculate the daily living expenses (food, rent) for an agent, scaled by inflation
    pub fn calculate_living_bills(&self, agent_age: u8, propensity_to_consume: f64) -> f64 {
        // Adults consume more than children; inflation drives baseline costs up
        let age_factor = if agent_age > 18 { 1.5 } else { 0.8 };
        let base_cost = 50.0; 
        
        base_cost * age_factor * self.inflation_rate * propensity_to_consume
    }

    /// Determine how much an organization earns based on local agent wealth and economic velocity
    pub fn calculate_org_revenue(&self, local_agent_spending: f64, organization_bonus: f64) -> f64 {
        local_agent_spending * organization_bonus
    }

    /// Determine how much an organization must pay to maintain its infrastructure and debt
    pub fn calculate_org_bills(&self, location_count: u32, infrastructure_health: f64) -> f64 {
        // Poor infrastructure mathematically costs more to maintain
        let penalty = 1.0 + (1.0 - infrastructure_health); 
        (100.0 * location_count as f64) * penalty * (1.0 + self.base_interest_rate)
    }

    // ----------------------
    // Demographics
    // ----------------------

    /// Determine if an agent should die based on their health, age, and ambient death rate
    pub fn check_death(&self, agent_age: u8, agent_health: f64) -> bool {
        let age_penalty = if agent_age > 70 { (agent_age as f64 - 70.0) * 0.01 } else { 0.0 };
        let health_penalty = 1.0 - agent_health; // Lower health increases chance
        
        let risk = self.death_rate + age_penalty + health_penalty;
        // In reality, you'd use a random float `rand::random::<f64>() < risk` here.
        // Returning deterministic check for boilerplate.
        risk > 0.5 
    }

    /// Check if a family or agent should produce a new child 
    pub fn check_procreate(&self, parent_age: u8, parent_wealth: f64) -> bool {
        // Must be of age and have enough capital to afford a child
        if parent_age >= 18 && parent_age < 50 && parent_wealth > 5000.0 {
            // Random chance using birth_rate
            return self.birth_rate > 0.1; // Placeholder
        }
        false
    }

    /// Calculate how many total new agents will move into the simulation this tick
    pub fn calculate_immigration(&self, average_town_health: f64, total_population: u64) -> u64 {
        // Good town health attracts more immigrants
        let attraction = average_town_health * 1.5; 
        ((total_population as f64) * self.immigration_rate * attraction) as u64
    }

    /// Determine if a specific agent leaves the simulation forever due to zero wealth or low health
    pub fn check_emigration(&self, agent_wealth: f64, agent_health: f64) -> bool {
        if agent_wealth <= 0.0 || agent_health < 0.2 {
            // Emigration rate acts as a base chance
            return self.emigration_rate > 0.1; // Placeholder
        }
        false
    }
}
