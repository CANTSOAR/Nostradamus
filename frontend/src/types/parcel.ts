export interface Coordinate {
    lat: number;
    lon: number;
}

export interface ParcelProperties {
    id: number;
    coord_center: Coordinate;
}
