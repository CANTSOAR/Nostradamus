import { Coordinate } from './parcel';

export interface RoadProperties {
    id: number;
    capacity: number;
    speed_limit_mph: number;
    nodes: Coordinate[];
}
