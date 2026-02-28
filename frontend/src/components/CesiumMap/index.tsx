import { useEffect, useRef } from "react";
import {
  Viewer,
  Cartesian3,
  Cesium3DTileset,
  OpenStreetMapImageryProvider,
  Math as CesiumMath,
  Color,
} from "cesium";
import { useMapStore } from "../../store/useMapStore";
import { useChoropleth } from "../../hooks/useChoropleth";
import type { TractProperties } from "../../types/tract";

interface CesiumMapProps {
  onViewerReady: (viewer: Viewer) => void;
  viewer: Viewer | null;
  onTractSelect: (geoid: string | null, props: TractProperties | null) => void;
}

// NJ centroid
const NJ_DESTINATION = Cartesian3.fromDegrees(-74.4057, 40.0583, 200000);

export function CesiumMap({ onViewerReady, onTractSelect }: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const { showBuildings, showTracts, activeVariable } = useMapStore();

  // Initialize viewer once
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const creditDiv = document.createElement("div");
    const v = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      creditContainer: creditDiv,
    });

    // imageryProvider was removed from ConstructorOptions in Cesium 1.124
    // Set OSM base layer after construction
    v.imageryLayers.removeAll();
    v.imageryLayers.addImageryProvider(
      new OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/",
        credit: "© OpenStreetMap contributors",
      })
    );

    v.scene.backgroundColor = Color.fromCssColorString("#0a0e1a");
    v.scene.globe.enableLighting = true;
    v.scene.globe.showGroundAtmosphere = true;
    v.scene.fog.enabled = true;

    v.camera.flyTo({
      destination: NJ_DESTINATION,
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: 0,
      },
      duration: 2,
    });

    viewerRef.current = v;
    onViewerReady(v);

    // OSM 3D Buildings — Cesium Ion asset 96188
    Cesium3DTileset.fromIonAssetId(96188)
      .then((tileset) => {
        tilesetRef.current = tileset;
        v.scene.primitives.add(tileset);
        tileset.show = showBuildings;
      })
      .catch((err: unknown) => {
        console.warn("OSM Buildings tileset failed (check Ion token):", err);
      });

    return () => {
      if (!v.isDestroyed()) v.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync building visibility
  useEffect(() => {
    if (tilesetRef.current) {
      tilesetRef.current.show = showBuildings;
    }
  }, [showBuildings]);

  // Choropleth
  useChoropleth({
    viewer: viewerRef.current,
    activeVariable,
    show: showTracts,
    onTractSelect,
  });

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
    />
  );
}
