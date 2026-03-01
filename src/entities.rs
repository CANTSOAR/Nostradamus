use serde::{Serialize, Deserialize};
use crate::spatial::Coordinate;
use std::collections::HashMap;

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
    /// Inline speed in degrees-per-tick (eliminates transport HashMap lookup)
    pub speed: f64,

    // Dynamic State
    pub current_coord: Coordinate,
    /// The location the agent is currently navigating towards (sticky until arrival)
    pub target_location_id: Option<u64>,
    
    // Relationships
    pub home_location_id: u64,
    pub home_county: Option<String>,
    pub employer_location_id: Option<u64>,
    pub work_county: Option<String>,
    pub transport_id: Option<u64>,
    pub family_agent_ids: Vec<u64>,
}

/// A governing body, corporation, or entity that owns locations and pays agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organization {
    pub id: u64,
    pub name: String,
    pub industry: String,
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
    /// Sum of all economic activity (orgs + locations + agents)
    pub total_economy_value: f64,
    /// Current population count
    pub population: u64,
    /// Average agent wealth
    pub avg_wealth: f64,
    /// Wealth disparity (0.0 = equal, 1.0 = extreme inequality)
    pub wealth_disparity: f64,
    /// Per-sector performance multiplier (1.0 = neutral, >1 = boom, <1 = bust)
    pub sector_favorability: HashMap<String, f64>,
    /// State-level tax rate (separate from federal)
    pub state_tax_rate: f64,
    /// Fed funds rate (affects borrowing costs)
    pub fed_funds_rate: f64,
}

impl Default for StateEntity {
    fn default() -> Self {
        let mut sectors = HashMap::new();
        for s in &["Retail", "Tech", "Healthcare", "Finance", "Manufacturing", "Government"] {
            sectors.insert(s.to_string(), 1.0);
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
