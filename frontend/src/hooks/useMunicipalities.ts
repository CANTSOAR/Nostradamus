import { useEffect, useRef, type MutableRefObject } from "react";
import {
  GeoJsonDataSource,
  Color,
  ColorMaterialProperty,
  type Viewer,
  type Entity,
} from "cesium";

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
}

export interface UseMunicipalitiesResult {
  entityMapRef: MutableRefObject<Map<string, Entity>>;
}

export function useMunicipalities({
  viewer,
  show,
  selectedMunGeoid,
  agentMatchedGeoids,
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

  // Highlight selected municipality
  useEffect(() => {
    const map = entityMapRef.current;

    // Restore previous selection's default style
    if (prevSelectedRef.current && prevSelectedRef.current !== selectedMunGeoid) {
      const prev = map.get(prevSelectedRef.current);
      if (prev?.polygon) {
        prev.polygon.material = new ColorMaterialProperty(
          FILL_DEFAULT
        ) as unknown as import("cesium").MaterialProperty;
        prev.polygon.outlineColor = OUTLINE_DEFAULT as any;
        prev.polygon.outlineWidth = 1.2 as any;
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
  }, [selectedMunGeoid]);

  // Apply Agent Match highlighting
  useEffect(() => {
    const map = entityMapRef.current;

    for (const [geoid, entity] of map.entries()) {
      if (entity.polygon) {
        if (agentMatchedGeoids && agentMatchedGeoids.length > 0) {
          if (agentMatchedGeoids.includes(geoid)) {
            entity.polygon.material = new ColorMaterialProperty(
              Color.fromCssColorString("#a855f7").withAlpha(0.6)
            ) as unknown as import("cesium").MaterialProperty;
            (entity.polygon as any).outlineColor = Color.fromCssColorString("#d8b4fe");
            (entity.polygon as any).outlineWidth = 2.5;
          } else {
            entity.polygon.material = new ColorMaterialProperty(
              Color.fromCssColorString("#1a1a2e").withAlpha(0.2)
            ) as unknown as import("cesium").MaterialProperty;
            (entity.polygon as any).outlineColor = Color.fromCssColorString("#1a1a2e").withAlpha(0.4);
            (entity.polygon as any).outlineWidth = 0.5;
          }
        } else {
          // Restore to defaults if no active AI filter (and not selected)
          if (geoid !== selectedMunGeoid) {
            entity.polygon.material = new ColorMaterialProperty(FILL_DEFAULT) as unknown as import("cesium").MaterialProperty;
            (entity.polygon as any).outlineColor = OUTLINE_DEFAULT;
            (entity.polygon as any).outlineWidth = 1.2;
          }
        }
      }
    }
  }, [agentMatchedGeoids, selectedMunGeoid]);

  return { entityMapRef };
}
