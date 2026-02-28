import { Coordinate } from './parcel';

export type VehicleType = 'Walking' | 'Bicycle' | 'Car' | 'Bus' | 'Train';

export interface Vehicle {
    id: number;
    vehicle_type: VehicleType;
    capacity: number;
    speed_mph: number;
    route: Coordinate[];
}
