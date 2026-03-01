import { Agent } from './agent';
import { Location } from './location';

export interface GlobalMetrics {
    tick: number;
    base_tax_rate: number;
    inflation_rate: number;
    base_interest_rate: number;
    death_rate: number;
    birth_rate: number;
    immigration_rate: number;
    emigration_rate: number;
    grid_resolution: number;
}

export interface CountyStats {
    county_id: number;
    name: string;
    population: number;
    avg_wealth: number;
    total_location_value: number;
    num_employers: number;
}

export interface SimulationPayload {
    tick: number;
    global_metrics: any; // Using any for now to match backend's Global struct flexibility
    viewport_agents: Agent[];
    viewport_locations: Location[];
    county_stats: CountyStats[];
}
