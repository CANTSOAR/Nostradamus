use serde::{Serialize, Deserialize};
use crate::spatial::Coordinate;

/// An individual actor inside the ABM simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: u64,
    pub age: u8,
    pub wealth: f64,
    pub income: f64,
    /// 0.0 to 1.0 (dead to healthy)
    pub health: f64,
    pub propensity_to_consume: f64,

    // Dynamic State
    pub current_coord: Coordinate,
    
    // Relationships (Stored as IDs to avoid recursive memory loops)
    pub home_location_id: u64,
    pub employer_location_id: Option<u64>, // Option because they might be unemployed
    pub transport_id: Option<u64>,         // Option if they don't own a car/transit pass
    pub family_agent_ids: Vec<u64>,        // List of other Agent IDs they are related to
}

impl Agent {
    /// Runs every 24 ticks (Daily). Processes income, consumption, and wealth accumulation.
    pub fn update_finances(&mut self) {
        let daily_income = self.income / 365.0;
        let consumed = self.propensity_to_consume * daily_income;
        self.wealth += daily_income - consumed;
    }

    /// Runs every 24 ticks. Decays health if bankrupt, otherwise slowly regenerates.
    pub fn update_health(&mut self) {
        if self.wealth <= 0.0 {
            // Take a brutal 5% compounding health hit per day if completely broke
            self.health -= 0.05;
        } else {
            // Slowly recover if they have money to eat
            self.health += 0.01;
        }
        
        // Clamp bounds securely
        if self.health > 1.0 { self.health = 1.0; }
        if self.health < 0.0 { self.health = 0.0; }
    }

    /// Runs exactly once per 8760 ticks (Yearly)
    pub fn update_age(&mut self) {
        self.age += 1;
    }
}

/// A governing body, corporation, or entity that owns locations and pays agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organization {
    pub id: u64,
    pub name: String,
    pub avg_revenue: f64,
    pub avg_bills: f64,
    
    // Dynamic Cash
    pub total_funds: f64,
}

impl Organization {
    /// Evaluated Daily
    pub fn update_finances(&mut self) {
        // Apportion annual numbers down to daily
        let daily_rev = self.avg_revenue / 365.0;
        let daily_bills = self.avg_bills / 365.0;
        
        self.total_funds += daily_rev - daily_bills;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TransportType {
    Walking,
    Bicycle,
    Car,
    Bus,
    Train,
}

/// A unit of transport moving across the map
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transport {
    pub id: u64,
    pub transport_type: TransportType,
    pub capacity: u32,
    /// Units of distance to move per hour
    pub speed_mph: f64,
    /// The path the transport takes
    pub route: Vec<Coordinate>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WeatherType {
    Clear,
    Rain,
    Snow,
    Heatwave,
    Hurricane,
}

/// A global or regional weather phenomenon
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Weather {
    pub condition: WeatherType,
    /// 0.0 to 1.0 representing how severe the weather impact is
    pub severity: f64,
}
