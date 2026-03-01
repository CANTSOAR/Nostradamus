// ============================================================================
// Simulation data types — mirrors Rust structs exactly
// ============================================================================

export interface Coordinate {
    lat: number;
    lon: number;
}

export interface Agent {
    id: number;
    age: number;
    county: number;
    destiny: number;
    wealth: number;
    income: number;
    propensity_to_consume: number;
    health: number;
    speed: number;
    current_coord: Coordinate;
    target_location_id: number | null;
    home_location_id: number;
    employer_location_id: number | null;
    school_location_id: number | null;
    education_level: number;
    is_homeowner: boolean;
    family_agent_ids: number[];
}

export interface Location {
    id: number;
    name: string | null;
    coord: Coordinate;
    location_type: 'Residential' | 'Store' | 'Employer' | 'School' | 'Mixed' | 'Public';
    organization_id: number | null;
    county: number;
    value: number;
    tax: number;
    current_count: number;
    destiny: number;
}

export interface CountyStats {
    county_id: number;
    name: string;
    population: number;
    avg_wealth: number;
    total_location_value: number;
    num_employers: number;
}

export interface GlobalMetrics {
    tick: number;
    time_offset_seconds: number;
    day_of_week: number;
    base_tax_rate: number;
    inflation_rate: number;
    base_interest_rate: number;
    death_rate: number;
    birth_rate: number;
    immigration_rate: number;
    emigration_rate: number;
    grid_resolution: number;
}

export interface SimulationPayload {
    tick: number;
    global_metrics: GlobalMetrics;
    viewport_agents: Agent[];
    viewport_locations: Location[];
    county_stats: CountyStats[];
}

export interface CommandResponse {
    id: string;
    ok: boolean;
    result?: any;
    error?: string;
}

export interface PinnedObject {
    type: 'agent' | 'location';
    id: number;
    label: string;
    color: string;
}

// County ID ↔ Name mapping
export const COUNTIES: string[] = [
    'ATLANTIC', 'BERGEN', 'BURLINGTON', 'CAMDEN', 'CAPE MAY',
    'CUMBERLAND', 'ESSEX', 'GLOUCESTER', 'HUDSON', 'HUNTERDON',
    'MERCER', 'MIDDLESEX', 'MONMOUTH', 'MORRIS', 'OCEAN',
    'PASSAIC', 'SALEM', 'SOMERSET', 'SUSSEX', 'UNION', 'WARREN',
];

export function countyName(id: number): string {
    return COUNTIES[id] || 'UNKNOWN';
}

export function tickToDate(tick: number): string {
    const base = new Date(2010, 0, 1);
    base.setHours(base.getHours() + tick);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[base.getDay()]} ${months[base.getMonth()]} ${base.getDate()}, ${base.getFullYear()} ${base.getHours()}:00`;
}
