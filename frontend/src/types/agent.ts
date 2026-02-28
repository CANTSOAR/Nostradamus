import { Coordinate } from './parcel';

export interface Agent {
    id: number;
    age: number;
    wealth: number;
    income: number;
    health: number;
    propensity_to_consume: number;
    current_coord: Coordinate;
    home_building_id: number;
    employer_business_id: number | null;
    employer_building_id: number | null;
    vehicle_id: number | null;
    family_agent_ids: number[];
}
