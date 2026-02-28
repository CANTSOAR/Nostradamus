import { useEffect, useRef, type MutableRefObject } from "react";
import {
  GeoJsonDataSource,
  Color,
  ColorMaterialProperty,
  type Viewer,
  type Entity,
} from "cesium";
import * as chromatic from "d3-scale-chromatic";

type FeatureData = Record<string, unknown>;
interface EntityWithData extends Entity {
  _featureData?: FeatureData;
}

const FILL_DEFAULT = Color.fromCssColorString("#7dd3fc").withAlpha(0.06);
const FILL_SELECTED = Color.fromCssColorString("#22d3ee").withAlpha(0.22);
const OUTLINE_DEFAULT = Color.fromCssColorString("#7dd3fc").withAlpha(0.35);
const OUTLINE_SELECTED = Color.fromCssColorString("#22d3ee").withAlpha(0.9);

export type MunChoroplethVar = string | null;

export interface UseMunicipalitiesOptions {
  viewer: Viewer | null;
  show: boolean;
  selectedMunGeoid: string | null;
  munChoroplethVar: MunChoroplethVar;
}

export interface UseMunicipalitiesResult {
  entityMapRef: MutableRefObject<Map<string, Entity>>;
}

/** Returns sorted non-null values for a field across all entities */
function extractValues(map: Map<string, Entity>, field: string): number[] {
  const vals: number[] = [];
  for (const entity of map.values()) {
    const data = (entity as EntityWithData)._featureData;
    const v = data?.[field];
    if (typeof v === "number" && isFinite(v) && v > 0) vals.push(v);
  }
  return vals.sort((a, b) => a - b);
}

/** Quantile-based 0-1 rank for a value within a sorted array */
function quantileRank(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0.5;
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1; else hi = mid;
  }
  return lo / Math.max(sorted.length - 1, 1);
}

function choroplethColor(t: number): Color {
  // YlOrRd from low (yellow) to high (red)
  const hex = chromatic.interpolateYlOrRd(t);
  return Color.fromCssColorString(hex).withAlpha(0.55);
}

export function useMunicipalities({
  viewer,
  show,
  selectedMunGeoid,
  munChoroplethVar,
}: UseMunicipalitiesOptions): UseMunicipalitiesResult {
  const dsRef = useRef<GeoJsonDataSource | null>(null);
  const loadedRef = useRef(false);
  const entityMapRef = useRef<Map<string, Entity>>(new Map());
  const prevSelectedRef = useRef<string | null>(null);

  // Load GeoJSON once
  useEffect(() => {
    if (!viewer || loadedRef.current) return;
    loadedRef.current = true;

    const ds = new GeoJsonDataSource("municipalities");
    dsRef.current = ds;

    ds.load("/data/nj_municipalities_enriched.geojson", {
      stroke: OUTLINE_DEFAULT,
      strokeWidth: 1.2,
      fill: FILL_DEFAULT,
      clampToGround: true,
    })
      .then(() => {
        viewer.dataSources.add(ds);

        const map = new Map<string, Entity>();
        for (const entity of ds.entities.values) {
          const props = entity.properties?.getValue(
            viewer.clock.currentTime
          ) as FeatureData | undefined;
          if (props) {
            (entity as EntityWithData)._featureData = props;
            const geoid = props["mun_geoid"] as string | undefined;
            if (geoid) map.set(geoid, entity);
          }
        }
        entityMapRef.current = map;
      })
      .catch((err: unknown) => {
        console.error("Failed to load municipalities:", err);
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
  }, [viewer]);

  // Show / hide layer
  useEffect(() => {
    if (dsRef.current) dsRef.current.show = show;
  }, [show]);

  // Apply choropleth coloring when munChoroplethVar changes
  useEffect(() => {
    const map = entityMapRef.current;
    if (map.size === 0) return;

    if (!munChoroplethVar) {
      // Reset all to default fill
      for (const entity of map.values()) {
        if (entity.polygon && entity !== map.get(prevSelectedRef.current ?? "")) {
          entity.polygon.material = new ColorMaterialProperty(
            FILL_DEFAULT
          ) as unknown as import("cesium").MaterialProperty;
          entity.polygon.outlineColor = OUTLINE_DEFAULT as any;
          entity.polygon.outlineWidth = 1.2 as any;
        }
      }
      return;
    }

    const sorted = extractValues(map, munChoroplethVar);

    for (const [geoid, entity] of map.entries()) {
      if (geoid === prevSelectedRef.current) continue; // leave selected styling alone
      const data = (entity as EntityWithData)._featureData;
      const raw = data?.[munChoroplethVar];
      const value = typeof raw === "number" && isFinite(raw) && raw > 0 ? raw : null;

      if (entity.polygon) {
        const fill = value != null
          ? choroplethColor(quantileRank(sorted, value))
          : Color.fromCssColorString("#334155").withAlpha(0.12);
        entity.polygon.material = new ColorMaterialProperty(
          fill
        ) as unknown as import("cesium").MaterialProperty;
        entity.polygon.outlineColor = Color.fromCssColorString("#94a3b8").withAlpha(0.4) as any;
        entity.polygon.outlineWidth = 1.0 as any;
      }
    }
  }, [munChoroplethVar]);

  // Highlight selected municipality
  useEffect(() => {
    const map = entityMapRef.current;

    // Restore previous selection's default style
    if (prevSelectedRef.current && prevSelectedRef.current !== selectedMunGeoid) {
      const prev = map.get(prevSelectedRef.current);
      if (prev?.polygon) {
        if (munChoroplethVar) {
          // Recompute choropleth color for this entity
          const sorted = extractValues(map, munChoroplethVar);
          const data = (prev as EntityWithData)._featureData;
          const raw = data?.[munChoroplethVar];
          const value = typeof raw === "number" && isFinite(raw) && raw > 0 ? raw : null;
          const fill = value != null
            ? choroplethColor(quantileRank(sorted, value))
            : Color.fromCssColorString("#334155").withAlpha(0.12);
          prev.polygon.material = new ColorMaterialProperty(
            fill
          ) as unknown as import("cesium").MaterialProperty;
          prev.polygon.outlineColor = Color.fromCssColorString("#94a3b8").withAlpha(0.4) as any;
          prev.polygon.outlineWidth = 1.0 as any;
        } else {
          prev.polygon.material = new ColorMaterialProperty(
            FILL_DEFAULT
          ) as unknown as import("cesium").MaterialProperty;
          prev.polygon.outlineColor = OUTLINE_DEFAULT as any;
          prev.polygon.outlineWidth = 1.2 as any;
        }
      }
    }

    // Apply selected style
    if (selectedMunGeoid) {
      const sel = map.get(selectedMunGeoid);
      if (sel?.polygon) {
        sel.polygon.material = new ColorMaterialProperty(
          FILL_SELECTED
        ) as unknown as import("cesium").MaterialProperty;
        sel.polygon.outlineColor = OUTLINE_SELECTED as any;
        sel.polygon.outlineWidth = 2.5 as any;
      }
    }

    prevSelectedRef.current = selectedMunGeoid;
  }, [selectedMunGeoid, munChoroplethVar]);

  return { entityMapRef };
}
