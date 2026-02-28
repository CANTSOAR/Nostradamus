use serde::{Serialize, Deserialize};

/// Represents a physical location using unscaled latitude and longitude.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Coordinate {
    pub lat: f64,
    pub lon: f64,
}

impl Coordinate {
    pub fn new(lat: f64, lon: f64) -> Self {
        Self { lat, lon }
    }
}

/// A spatial grid cell for fast neighbor lookups.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridCell {
    pub id: u64,
    pub top_left: Coordinate,
    pub bottom_right: Coordinate,
    // Future: List of entities or references currently in this cell for spatial partitioning
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LocationType {
    Residential,
    Store,
    Employer,
    /// Multi-purpose (e.g. mixed-use zoning)
    Mixed,
    /// Public infrastructure like parks or gov buildings
    Public,
}

/// A location struct representing a proper physical entity (home, business, public space).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub id: u64,
    /// The proper name of the location
    pub name: String,
    pub coord: Coordinate,
    pub location_type: LocationType,
    
    /// Optional ID linking this physical location to an Organization (Company, Gov, etc.)
    pub organization_id: Option<u64>,
    
    // Future expansion points
    pub capacity: u32,
}
