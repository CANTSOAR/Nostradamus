import { useEffect, useRef } from "react";
import {
  PointPrimitiveCollection,
  LabelCollection,
  Cartesian3,
  Color,
  NearFarScalar,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  type Viewer,
} from "cesium";

export interface BusinessFeature {
  name: string;
  type: string;
  category: string;
  lat: number;
  lon: number;
}

function categoryColor(category: string): Color {
  switch (category) {
    case "amenity": return Color.fromCssColorString("#f59e0b");
    case "shop": return Color.fromCssColorString("#34d399");
    case "office": return Color.fromCssColorString("#818cf8");
    default: return Color.fromCssColorString("#94a3b8");
  }
}

export interface UseBusinessesResult {
  getFeatureAt: (pointIndex: number) => BusinessFeature | null;
  hitTest: (lat: number, lon: number, thresholdDeg: number) => BusinessFeature | null;
}

// ~50 ft in meters
const PIN_ALT = 15;

export function useBusinesses({
  viewer,
  show,
}: {
  viewer: Viewer | null;
  show: boolean;
}): UseBusinessesResult {
  const pointsRef = useRef<PointPrimitiveCollection | null>(null);
  const labelsRef = useRef<LabelCollection | null>(null);
  const featuresRef = useRef<BusinessFeature[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!viewer || loadedRef.current) return;
    loadedRef.current = true;

    fetch("/data/nj_businesses.geojson")
      .then((r) => r.json())
      .then((data) => {
        if (!viewer || viewer.isDestroyed()) return;

        // --- Points collection ---
        const points = new PointPrimitiveCollection();
        points.show = show;
        viewer.scene.primitives.add(points);
        pointsRef.current = points;

        // --- Labels collection (shows name near each pin when close) ---
        const labels = new LabelCollection({ scene: viewer.scene });
        labels.show = show;
        viewer.scene.primitives.add(labels);
        labelsRef.current = labels;

        const features: BusinessFeature[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const f of data.features as any[]) {
          const [lon, lat] = f.geometry.coordinates as [number, number];
          const { name, type, category } = f.properties as BusinessFeature;
          features.push({ name, type, category, lat, lon });

          const color = categoryColor(category);
          const pos = Cartesian3.fromDegrees(lon, lat, PIN_ALT);

          // Large glowing dot — no distanceDisplayCondition limit so always shown
          points.add({
            position: pos,
            pixelSize: 14,
            color: color.withAlpha(0.95),
            outlineColor: Color.WHITE.withAlpha(0.8),
            outlineWidth: 2,
            scaleByDistance: new NearFarScalar(100, 2.0, 30_000, 0.5),
          } as any);

          // Floating label — only visible when camera is within ~800 m
          labels.add({
            position: Cartesian3.fromDegrees(lon, lat, PIN_ALT + 12),
            text: name.length > 24 ? name.slice(0, 22) + "…" : name,
            font: "600 11px Inter, system-ui, sans-serif",
            fillColor: Color.WHITE,
            outlineColor: Color.fromCssColorString("#0a0e1a"),
            outlineWidth: 3,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            pixelOffset: { x: 0, y: -6 } as any,
            scaleByDistance: new NearFarScalar(50, 1.2, 800, 0.0),
            translucencyByDistance: new NearFarScalar(400, 1.0, 800, 0.0),
            showBackground: true,
            backgroundColor: Color.fromCssColorString("#0a0e1a").withAlpha(0.75),
            backgroundPadding: { x: 5, y: 3 } as any,
          } as any);
        }

        featuresRef.current = features;
      })
      .catch((e) => console.error("Failed to load businesses:", e));

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        if (pointsRef.current) viewer.scene.primitives.remove(pointsRef.current);
        if (labelsRef.current) viewer.scene.primitives.remove(labelsRef.current);
      }
      pointsRef.current = null;
      labelsRef.current = null;
      loadedRef.current = false;
      featuresRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  useEffect(() => {
    if (pointsRef.current) pointsRef.current.show = show;
    if (labelsRef.current) labelsRef.current.show = show;
  }, [show]);

  const getFeatureAt = (idx: number): BusinessFeature | null =>
    featuresRef.current[idx] ?? null;

  const hitTest = (lat: number, lon: number, thresholdDeg: number): BusinessFeature | null => {
    let best: BusinessFeature | null = null;
    let bestDist = thresholdDeg;
    for (const f of featuresRef.current) {
      const d = Math.hypot(f.lat - lat, f.lon - lon);
      if (d < bestDist) { bestDist = d; best = f; }
    }
    return best;
  };

  return { getFeatureAt, hitTest };
}
