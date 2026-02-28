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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tract {
    pub geoid: String,
    pub population: Option<f64>,
    pub median_income: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Municipality {
    pub id: String, // geoid
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct County {
    pub fips: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parcel {
    pub id: u64,
    pub coord_center: Coordinate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BuildingType {
    Residential,
    Commercial,
    Mixed,
    Industrial,
    Public,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Building {
    pub id: u64,
    pub coord: Coordinate,
    pub building_type: BuildingType,
    pub capacity: u32,
    pub parcel_id: Option<u64>,
    pub wealth: f64,
}

impl Building {
    /// Evaluated Daily, passing in the Organization's economic averages
    pub fn update_finances(&mut self, base_revenue: f64, base_bills: f64) {
        let daily_rev = base_revenue / 365.0;
        let daily_bills = base_bills / 365.0;
        self.wealth += daily_rev - daily_bills;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Road {
    pub id: u64,
    pub capacity: u32,
    pub speed_limit_mph: f64,
    pub nodes: Vec<Coordinate>,
}
