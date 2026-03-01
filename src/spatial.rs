use serde::{Serialize, Deserialize};

// ============================================================================
// COUNTY ENCODING (21 NJ counties → u8, saves ~570MB vs String at 9.5M agents)
// ============================================================================

pub const COUNTIES: [&str; 21] = [
    "ATLANTIC", "BERGEN", "BURLINGTON", "CAMDEN", "CAPE MAY",
    "CUMBERLAND", "ESSEX", "GLOUCESTER", "HUDSON", "HUNTERDON",
    "MERCER", "MIDDLESEX", "MONMOUTH", "MORRIS", "OCEAN",
    "PASSAIC", "SALEM", "SOMERSET", "SUSSEX", "UNION", "WARREN",
];

pub const COUNTY_UNKNOWN: u8 = 255;

pub fn county_to_id(name: &str) -> u8 {
    let upper = name.to_uppercase();
    COUNTIES.iter().position(|&c| c == upper.as_str())
        .map(|i| i as u8)
        .unwrap_or(COUNTY_UNKNOWN)
}

pub fn county_name(id: u8) -> &'static str {
    if (id as usize) < COUNTIES.len() {
        COUNTIES[id as usize]
    } else {
        "UNKNOWN"
    }
}

// ============================================================================
// DESTINY HASH — deterministic procedural randomness
// ============================================================================

/// Deterministic hash: (destiny, tick, event_id) → f32 in [0.0, 1.0)
/// Replaces all rand::random() calls. Zero shared state → no thread contention.
#[inline(always)]
pub fn fate(destiny: u64, tick: u64, event: u16) -> f32 {
    let mut seed = destiny
        ^ tick.wrapping_mul(2654435761)
        ^ (event as u64).wrapping_mul(131);
    // xorshift64* mixing
    seed ^= seed >> 12;
    seed ^= seed << 25;
    seed ^= seed >> 27;
    seed = seed.wrapping_mul(0x2545F4914F6CDD1D);
    // Convert upper 24 bits to f32 in [0, 1)
    (seed >> 40) as f32 / (1u64 << 24) as f32
}

/// Deterministic hash returning a signed f32 in [-1.0, 1.0)
#[inline(always)]
pub fn fate_signed(destiny: u64, tick: u64, event: u16) -> f32 {
    fate(destiny, tick, event) * 2.0 - 1.0
}

// ============================================================================
// COORDINATE (f32 — ~1m precision, saves 8 bytes per coord)
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Coordinate {
    pub lat: f32,
    pub lon: f32,
}

impl Coordinate {
    pub fn new(lat: f32, lon: f32) -> Self {
        Self { lat, lon }
    }
}

/// A spatial grid cell for fast neighbor lookups.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridCell {
    pub id: u32,
    pub top_left: Coordinate,
    pub bottom_right: Coordinate,
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

/// A location struct representing a proper physical entity.
/// Name is None for residential (saves ~80MB across 2.7M homes).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub id: u32,
    /// Name is Some for stores/employers, None for residential
    pub name: Option<String>,
    pub coord: Coordinate,
    pub location_type: LocationType,
    /// Optional org link
    pub organization_id: Option<u32>,
    /// County encoded as u8 index (see COUNTIES array)
    pub county: u8,
    /// Property value ($)
    pub value: f32,
    /// Annual property tax ($)
    pub tax: f32,
    /// Current occupant/worker count
    pub current_count: u16,
    /// Deterministic hash seed for this location
    pub destiny: u64,
}
