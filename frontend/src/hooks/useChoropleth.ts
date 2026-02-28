import { useEffect, useRef, useCallback, type MutableRefObject } from "react";
import {
  GeoJsonDataSource,
  ColorMaterialProperty,
  Color,
  type Viewer,
  type Entity,
} from "cesium";
import type { VariableKey } from "../types/variables";
import { buildColorScale } from "../lib/colorScale";
import { hexToCesiumColor } from "../lib/cesiumColors";

// Generic feature data attached to each entity
type FeatureData = Record<string, unknown>;

interface EntityWithData extends Entity {
  _featureData?: FeatureData;
}

export interface UseChoroplethOptions {
  viewer: Viewer | null;
  dataUrl: string;
  activeVariable: VariableKey;
  show: boolean;
  /** When set, only show entities whose county_fips matches this value */
  filterCountyFips?: string | null;
  /** Entity map key field — 'GEOID' for tracts, 'county_fips' for counties */
  keyField?: string;
  agentMatchedGeoids?: string[] | null;
}

export interface UseChoroplethResult {
  entityMapRef: MutableRefObject<Map<string, Entity>>;
}

export function useChoropleth({
  viewer,
  dataUrl,
  activeVariable,
  show,
  filterCountyFips,
  keyField = "GEOID",
  agentMatchedGeoids,
}: UseChoroplethOptions): UseChoroplethResult {
  const dsRef = useRef<GeoJsonDataSource | null>(null);
  const loadedRef = useRef(false);
  const entityMapRef = useRef<Map<string, Entity>>(new Map());

  // Load GeoJSON once per dataUrl+viewer combination
  useEffect(() => {
    if (!viewer || loadedRef.current) return;
    loadedRef.current = true;

    const dsName = `choropleth-${dataUrl}`;
    const ds = new GeoJsonDataSource(dsName);
    dsRef.current = ds;

    ds.load(dataUrl, {
      stroke: Color.fromCssColorString("#1a1a2e").withAlpha(0.4),
      strokeWidth: 0.5,
      fill: Color.fromCssColorString("#334155").withAlpha(0.5),
      clampToGround: true,
    })
      .then(() => {
        viewer.dataSources.add(ds);

        // Index entities by key field for fast lookup
        const map = new Map<string, Entity>();
        for (const entity of ds.entities.values) {
          const props = entity.properties?.getValue(
            viewer.clock.currentTime
          ) as FeatureData | undefined;
          if (props) {
            (entity as EntityWithData)._featureData = props;
            const key = props[keyField] as string | undefined;
            if (key) map.set(key, entity);
          }
        }
        entityMapRef.current = map;
      })
      .catch((err: unknown) => {
        console.error(`Failed to load ${dataUrl}:`, err);
      });

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.dataSources.remove(ds, true);
      }
      dsRef.current = null;
      loadedRef.current = false;
      entityMapRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, dataUrl]);

  // Determine visibility for a single entity
  const isEntityVisible = useCallback(
    (entity: EntityWithData): boolean => {
      if (!filterCountyFips) return true;
      const fips = entity._featureData?.county_fips as string | undefined;
      return fips === filterCountyFips;
    },
    [filterCountyFips]
  );

  // Apply choropleth coloring + visibility
  const applyColoring = useCallback(() => {
    const ds = dsRef.current;
    if (!ds || !viewer) return;

    const entities = ds.entities.values;
    if (entities.length === 0) return;

    // Build color scale from visible entities only
    const visibleEntities = entities.filter((e) =>
      isEntityVisible(e as EntityWithData)
    );

    const values = visibleEntities.map((e) => {
      const raw = (e as EntityWithData)._featureData?.[activeVariable];
      return typeof raw === "number" ? raw : null;
    });

    const scale = buildColorScale(values, activeVariable);

    for (const entity of entities) {
      const visible = show && isEntityVisible(entity as EntityWithData);
      if (entity.polygon) {
        entity.show = visible;
        if (visible) {
          const val = (entity as EntityWithData)._featureData?.[activeVariable];
          const colorStr = scale.getColor(typeof val === "number" ? val : null);
          let cesiumColor = hexToCesiumColor(colorStr, 0.72);

          if (agentMatchedGeoids && agentMatchedGeoids.length > 0) {
            const keyVal = (entity as EntityWithData)._featureData?.[keyField] as string | undefined;
            if (keyVal && agentMatchedGeoids.includes(keyVal)) {
              cesiumColor = Color.fromCssColorString("#a855f7").withAlpha(0.95);
              (entity.polygon as any).outlineColor = Color.fromCssColorString("#d8b4fe");
              (entity.polygon as any).outlineWidth = 2.5;
            } else {
              cesiumColor = cesiumColor.withAlpha(0.1);
              (entity.polygon as any).outlineWidth = 0.5;
            }
          } else {
            (entity.polygon as any).outlineColor = Color.fromCssColorString("#1a1a2e").withAlpha(0.4);
            (entity.polygon as any).outlineWidth = 0.5;
          }

          entity.polygon.material = new ColorMaterialProperty(
            cesiumColor
          ) as unknown as import("cesium").MaterialProperty;
        }
      }
    }
  }, [viewer, activeVariable, show, isEntityVisible, agentMatchedGeoids, keyField]);

  // Re-color when variable, show, or filter changes (with retry for initial load)
  useEffect(() => {
    if (!dsRef.current) return;
    applyColoring();
    const t = setTimeout(applyColoring, 1500);
    return () => clearTimeout(t);
  }, [applyColoring]);

  // Show/hide whole datasource when show changes
  useEffect(() => {
    if (dsRef.current) {
      dsRef.current.show = show;
    }
  }, [show]);

  return { entityMapRef };
}
