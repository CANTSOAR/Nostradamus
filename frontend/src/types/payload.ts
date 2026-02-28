import { Agent } from './agent';
import { BuildingProperties } from './building';
import { BusinessProperties } from './business';
import { Vehicle } from './vehicle';

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

export interface SimulationPayload {
    tick: number;
    global_metrics: GlobalMetrics;
    active_agents_subset: Agent[];
    buildings_subset: BuildingProperties[];
    businesses_subset: BusinessProperties[];
    vehicles_subset: Vehicle[];
}
