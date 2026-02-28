import { useEffect, useRef, useCallback } from "react";
import {
  GeoJsonDataSource,
  ColorMaterialProperty,
  Color,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  type Viewer,
  type Entity,
} from "cesium";
import type { TractProperties } from "../types/tract";
import type { VariableKey } from "../types/variables";
import { buildColorScale } from "../lib/colorScale";
import { hexToCesiumColor } from "../lib/cesiumColors";

interface EntityWithProps extends Entity {
  _tractProps?: TractProperties;
}

interface UseChoroplethOptions {
  viewer: Viewer | null;
  activeVariable: VariableKey;
  show: boolean;
  onTractSelect: (geoid: string | null, props: TractProperties | null) => void;
}

export function useChoropleth({
  viewer,
  activeVariable,
  show,
  onTractSelect,
}: UseChoroplethOptions) {
  // useRef survives React StrictMode double-mount
  const dsRef = useRef<GeoJsonDataSource | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const loadedRef = useRef(false);

  // Load GeoJSON once
  useEffect(() => {
    if (!viewer || loadedRef.current) return;
    loadedRef.current = true;

    const ds = new GeoJsonDataSource("nj-tracts");
    dsRef.current = ds;

    ds.load("/data/nj_tracts_enriched.geojson", {
      stroke: Color.fromCssColorString("#1a1a2e").withAlpha(0.4),
      strokeWidth: 0.5,
      fill: Color.fromCssColorString("#334155").withAlpha(0.5),
      clampToGround: true,
    }).then(() => {
      viewer.dataSources.add(ds);

      // Attach props to each entity for fast access
      for (const entity of ds.entities.values) {
        const props = entity.properties?.getValue(
          viewer.clock.currentTime
        ) as TractProperties | undefined;
        if (props) {
          (entity as EntityWithProps)._tractProps = props;
        }
      }
    }).catch((err: unknown) => {
      console.error("Failed to load nj_tracts_enriched.geojson:", err);
    });

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.dataSources.remove(ds, true);
      }
      dsRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  // Apply choropleth coloring
  const applyColoring = useCallback(() => {
    const ds = dsRef.current;
    if (!ds || !viewer) return;

    const entities = ds.entities.values;
    if (entities.length === 0) return;

    const values = entities.map((e) => {
      const raw = (e as EntityWithProps)._tractProps?.[activeVariable];
      return typeof raw === "number" ? raw : null;
    });

    const scale = buildColorScale(values, activeVariable);

    for (const entity of entities) {
      if (!entity.polygon) continue;
      const val = (entity as EntityWithProps)._tractProps?.[activeVariable];
      const colorStr = scale.getColor(typeof val === "number" ? val : null);
      const cesiumColor = hexToCesiumColor(colorStr, 0.72);
      entity.polygon.material = new ColorMaterialProperty(cesiumColor) as unknown as import("cesium").MaterialProperty;
    }
  }, [viewer, activeVariable]);

  // Re-color when variable changes (with retry for initial load)
  useEffect(() => {
    if (!dsRef.current) return;
    applyColoring();
    const t = setTimeout(applyColoring, 1500);
    return () => clearTimeout(t);
  }, [applyColoring]);

  // Show/hide tracts
  useEffect(() => {
    if (dsRef.current) {
      dsRef.current.show = show;
    }
  }, [show]);

  // Click handler — pick entity and fire onTractSelect
  useEffect(() => {
    if (!viewer) return;

    const handler = new ScreenSpaceEventHandler(viewer.canvas);
    handlerRef.current = handler;

    handler.setInputAction((e: ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(e.position);
      if (defined(picked) && picked.id) {
        const entity = picked.id as EntityWithProps;
        const props = entity._tractProps;
        if (props?.GEOID) {
          onTractSelect(props.GEOID, props);
          // Yellow highlight for selected tract
          if (entity.polygon) {
            entity.polygon.material = new ColorMaterialProperty(
              Color.YELLOW.withAlpha(0.6)
            ) as unknown as import("cesium").MaterialProperty;
          }
          return;
        }
      }
      onTractSelect(null, null);
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
      handlerRef.current = null;
    };
  }, [viewer, onTractSelect]);
}
