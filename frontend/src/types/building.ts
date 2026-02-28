/** Properties extracted from a clicked OSM 3D Buildings tile feature */
export interface BuildingProperties {
  /** OSM building tag (e.g. 'apartments', 'commercial', 'industrial', 'office', 'house') */
  buildingType: string | null;
  /** Number of above-ground floors */
  levels: number | null;
  /** Building material (e.g. 'brick', 'concrete', 'glass', 'metal') */
  material: string | null;
  /** Building name from OSM */
  name: string | null;
  /** Cesium estimated height in meters */
  estimatedHeight: number | null;
  /** WGS84 latitude */
  lat: number | null;
  /** WGS84 longitude */
  lon: number | null;
}
