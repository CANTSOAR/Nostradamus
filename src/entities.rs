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

/// A governing body, corporation, or entity that owns locations and pays agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organization {
    pub id: u64,
    pub name: String,
    pub avg_revenue: f64,
    pub avg_bills: f64,
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
