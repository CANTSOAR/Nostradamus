import { Coordinate } from './parcel';

export type TransportType = 'Walking' | 'Bicycle' | 'Car' | 'Bus' | 'Train';

export interface Transport {
    id: number;
    transport_type: TransportType;
    capacity: number;
    speed_mph: number;
    route: Coordinate[];
}
