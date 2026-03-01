export interface SimulationPayload {
    tick: number;                    // Current tick (1 tick = 1 hour)
    global_metrics: GlobalMetrics;
    viewport_agents: Agent[];        // Max 5000, filtered by viewport
    viewport_locations: Location[];  // Max 2000, filtered by viewport
    county_stats: CountyStats[];     // All 21 counties, always sent
}

export interface GlobalMetrics {
    tick: number;
    time_offset_seconds: number;
    day_of_week: number;             // 0=Mon, 6=Sun
    base_tax_rate: number;
    inflation_rate: number;
    base_interest_rate: number;
    death_rate: number;
    birth_rate: number;
    immigration_rate: number;
    emigration_rate: number;
    grid_resolution: number;
}

export interface Agent {
    id: number;
    age: number;
    county: number;                  // 0-20 index into COUNTIES
    destiny: number;
    wealth: number;
    income: number;
    propensity_to_consume: number;
    health: number;                  // 0.0 - 1.0
    speed: number;
    current_coord: { lat: number; lon: number };
    target_location_id: number | null;
    home_location_id: number;
    employer_location_id: number | null;
    school_location_id: number | null;
    education_level: number;         // 0=none, 1=elem, 2=mid, 3=high, 4=college, 5=grad
    is_homeowner: boolean;
    family_agent_ids: number[];
}

export interface Location {
    id: number;
    name: string | null;             // null for residential
    coord: { lat: number; lon: number };
    location_type: "Residential" | "Store" | "Employer" | "School" | "Mixed" | "Public";
    organization_id: number | null;
    county: number;
    value: number;                   // Property value ($)
    tax: number;                     // Annual tax ($)
    current_count: number;
    destiny: number;
}

export interface CountyStats {
    county_id: number;
    name: string;                    // e.g. "BERGEN"
    population: number;
    avg_wealth: number;
    total_location_value: number;
    num_employers: number;
}

export interface PinnedObject {
    type: "agent" | "location";
    id: number;
    label: string;      // e.g. "Agent #100042" or "Bridgewater HS"
    color: string;       // Unique color for tracking
}

export interface Organization {
    id: number;
    name: string;
    industry: string;
    value: number;
    total_funds: number;
    employee_count?: number;
}
