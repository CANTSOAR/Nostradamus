use serde::{Serialize, Deserialize};
use crate::spatial::Coordinate;
use std::collections::HashMap;

/// An individual actor inside the ABM simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: u32,
    pub age: u8,
    /// County encoded as u8 index
    pub county: u8,
    /// Deterministic hash seed — sole source of randomness for this agent
    pub destiny: u64,

    // Economics (f32 — saves 20 bytes per agent vs f64)
    pub wealth: f32,
    pub income: f32,
    pub propensity_to_consume: f32,

    // Physical
    /// 0.0 to 1.0 (dead to healthy)
    pub health: f32,
    /// Inline speed in degrees-per-tick
    pub speed: f32,

    // Dynamic State
    pub current_coord: Coordinate,
    /// The location the agent is currently navigating towards
    pub target_location_id: Option<u32>,
    
    // Relationships
    pub home_location_id: u32,
    pub employer_location_id: Option<u32>,
    pub family_agent_ids: Vec<u32>,
}

/// A governing body, corporation, or entity that owns locations and pays agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organization {
    pub id: u32,
    pub name: String,
    pub industry: String,
    /// Estimated market value of the organization ($)
    pub value: f64,
    pub avg_revenue: f64,
    pub avg_bills: f64,
    
    // Dynamic Cash
    pub total_funds: f64,
}

/// The State-level entity representing New Jersey as a whole
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateEntity {
    pub name: String,
    /// Cash held by the state government
    pub cash_reserves: f64,
    /// Sum of all economic activity
    pub total_economy_value: f64,
    /// Current population count
    pub population: u32,
    /// Average agent wealth
    pub avg_wealth: f32,
    /// Wealth disparity (0.0 = equal, 1.0 = extreme inequality)
    pub wealth_disparity: f32,
    /// Per-sector performance multiplier
    pub sector_favorability: HashMap<String, f32>,
    /// State-level tax rate
    pub state_tax_rate: f32,
    /// Fed funds rate
    pub fed_funds_rate: f32,
}

impl Default for StateEntity {
    fn default() -> Self {
        let mut sectors = HashMap::new();
        for s in &["Retail", "Tech", "Healthcare", "Finance", "Manufacturing", 
                    "Government", "Accommodations/Food", "Education", 
                    "Professional/Technical", "Real Estate", "Arts/Entertainment", 
                    "Other Services", "Construction", "Information", "Health/Social"] {
            sectors.insert(s.to_string(), 1.0f32);
        }
        Self {
            name: "New Jersey".to_string(),
            cash_reserves: 50_000_000.0,
            total_economy_value: 0.0,
            population: 0,
            avg_wealth: 0.0,
            wealth_disparity: 0.3,
            sector_favorability: sectors,
            state_tax_rate: 0.065,
            fed_funds_rate: 0.05,
        }
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
    pub id: u32,
    pub transport_type: TransportType,
    pub capacity: u32,
    pub speed_mph: f64,
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
    pub severity: f32,
}
