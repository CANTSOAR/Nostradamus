import { useEffect, useRef, useCallback, type MutableRefObject } from "react";
import {
  GeoJsonDataSource,
  Color,
  ColorMaterialProperty,
  type Viewer,
  type Entity,
} from "cesium";
import type { VariableKey } from "../types/variables";
import { buildColorScale } from "../lib/colorScale";
import { hexToCesiumColor } from "../lib/cesiumColors";

type FeatureData = Record<string, unknown>;
interface EntityWithData extends Entity {
  _featureData?: FeatureData;
}

const FILL_DEFAULT = Color.fromCssColorString("#7dd3fc").withAlpha(0.06);
const FILL_SELECTED = Color.fromCssColorString("#22d3ee").withAlpha(0.22);
const OUTLINE_DEFAULT = Color.fromCssColorString("#7dd3fc").withAlpha(0.35);
const OUTLINE_SELECTED = Color.fromCssColorString("#22d3ee").withAlpha(0.9);

export interface UseMunicipalitiesOptions {
  viewer: Viewer | null;
  show: boolean;
  selectedMunGeoid: string | null;
  agentMatchedGeoids?: string[] | null;
  activeMunVariable: VariableKey;
}

export interface UseMunicipalitiesResult {
  entityMapRef: MutableRefObject<Map<string, Entity>>;
}

export function useMunicipalities({
  viewer,
  show,
  selectedMunGeoid,
  agentMatchedGeoids,
  activeMunVariable,
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

  // Apply choropleth coloring + visibility
  const applyColoring = useCallback(() => {
    const ds = dsRef.current;
    if (!ds || !viewer) return;

    const entities = ds.entities.values as EntityWithData[];
    if (entities.length === 0) return;

    const values = entities.map((e) => {
      const raw = e._featureData?.[activeMunVariable];
      return typeof raw === "number" ? raw : null;
    });

    const scale = buildColorScale(values, activeMunVariable);

    for (const entity of entities) {
      if (entity.polygon) {
        entity.show = show;
        if (show) {
          const val = entity._featureData?.[activeMunVariable];
          const colorStr = scale.getColor(typeof val === "number" ? val : null);
          let cesiumColor = hexToCesiumColor(colorStr, 0.72);
          const geoid = entity._featureData?.["mun_geoid"] as string | undefined;

          let outlineColor = OUTLINE_DEFAULT;
          let outlineWidth = 1.2;

          if (agentMatchedGeoids && agentMatchedGeoids.length > 0) {
            if (geoid && agentMatchedGeoids.includes(geoid)) {
              cesiumColor = Color.fromCssColorString("#a855f7").withAlpha(0.6);
              outlineColor = Color.fromCssColorString("#d8b4fe");
              outlineWidth = 2.5;
            } else {
              cesiumColor = cesiumColor.withAlpha(0.2);
              outlineColor = Color.fromCssColorString("#1a1a2e").withAlpha(0.4);
              outlineWidth = 0.5;
            }
          } else if (geoid === selectedMunGeoid) {
            // Apply selected style
            outlineColor = OUTLINE_SELECTED;
            outlineWidth = 2.5;
            cesiumColor = FILL_SELECTED;
          } else {
            // Default outline, choropleth fill
            outlineColor = OUTLINE_DEFAULT;
            outlineWidth = 1.2;
          }

          entity.polygon.material = new ColorMaterialProperty(cesiumColor) as unknown as import("cesium").MaterialProperty;
          (entity.polygon as any).outlineColor = outlineColor;
          (entity.polygon as any).outlineWidth = outlineWidth;
        }
      }
    }
    prevSelectedRef.current = selectedMunGeoid;
  }, [viewer, activeMunVariable, show, agentMatchedGeoids, selectedMunGeoid]);

  // Re-color when variable, show, selection or filter changes (with retry for initial load)
  useEffect(() => {
    if (!dsRef.current) return;
    applyColoring();
    const t = setTimeout(applyColoring, 1500);
    return () => clearTimeout(t);
  }, [applyColoring]);

  return { entityMapRef };
}
