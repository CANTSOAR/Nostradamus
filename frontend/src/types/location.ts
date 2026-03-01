import { Coordinate } from './parcel';

export type LocationType =
    | 'Residential'
    | 'Store'
    | 'Employer'
    | 'School'
    | 'Mixed'
    | 'Public';

export interface Location {
    id: number;
    name: string | null;
    coord: Coordinate;
    location_type: LocationType;
    organization_id: number | null;
    county: number;
    value: number;
    tax: number;
    current_count: number;
    destiny: number;
}
