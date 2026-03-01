import { Coordinate } from './parcel';

export interface Agent {
    id: number;
    age: number;
    /** County index (u8) */
    county: number;
    /** Deterministic hash seed */
    destiny: number;

    // Economics
    wealth: number;
    income: number;
    propensity_to_consume: number;

    // Physical
    /** 0.0 to 1.0 (dead to healthy) */
    health: number;
    /** Inline speed in degrees-per-tick */
    speed: number;

    // Dynamic State
    current_coord: Coordinate;
    target_location_id: number | null;

    // Relationships
    home_location_id: number;
    employer_location_id: number | null;
    school_location_id: number | null;
    /** 0=none, 1=elementary, 2=middle, 3=high, 4=in_college, 5=college_grad */
    education_level: number;
    is_homeowner: boolean;
    family_agent_ids: number[];
}
