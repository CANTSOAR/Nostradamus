import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  Cartesian3,
  Cesium3DTileset,
  Cesium3DTileStyle,
  Math as CesiumMath,
  Color,
  IonImageryProvider,
  OpenStreetMapImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Cesium3DTileFeature,
  HeadingPitchRange,
  createOsmBuildingsAsync,
  type Entity,
} from "cesium";
import type { TractProperties } from "../../types/tract";
import type { BuildingProperties } from "../../types/building";
import { useMapStore } from "../../store/useMapStore";
import { useChoropleth } from "../../hooks/useChoropleth";

// NJ centroid at state overview altitude
const NJ_DESTINATION = Cartesian3.fromDegrees(-74.4057, 40.0583, 220000);

// Feature data attached by useChoropleth
type FeatureData = Record<string, unknown>;
interface EntityWithData extends Entity {
  _featureData?: FeatureData;
}

// Buildings visible at county zoom level and closer
function buildingsVisible(viewLevel: string, showBuildings: boolean) {
  return showBuildings && viewLevel !== "state";
}

// Extract typed building properties from a picked 3D tile feature
function extractBuildingProps(feature: Cesium3DTileFeature): BuildingProperties {
  const get = (key: string) => feature.getProperty(key);
  const height = get("cesium#estimatedHeight");
  return {
    buildingType: get("building") ?? null,
    levels: get("building:levels") != null ? Number(get("building:levels")) : null,
    material: get("building:material") ?? null,
    name: get("name") ?? null,
    estimatedHeight: height != null ? Math.round(Number(height)) : null,
    lat: get("cesium#latitude") != null ? Number(get("cesium#latitude")) : null,
    lon: get("cesium#longitude") != null ? Number(get("cesium#longitude")) : null,
  };
}

export function CesiumMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const initDoneRef = useRef(false);
  const [tilesetError, setTilesetError] = useState<string | null>(null);

  const {
    activeVariable,
    showBuildings,
    showTracts,
    viewLevel,
    selectedCountyFips,
    selectedTractId,
    navigateToState,
    navigateToCounty,
    navigateToTract,
    navigateToBuilding,
  } = useMapStore();

  // Initialize viewer once
  useEffect(() => {
    if (!containerRef.current || initDoneRef.current) return;
    initDoneRef.current = true;

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

    // Ensure all camera controls work
    v.scene.screenSpaceCameraController.enableZoom = true;
    v.scene.screenSpaceCameraController.enableRotate = true;
    v.scene.screenSpaceCameraController.enableTilt = true;
    v.scene.screenSpaceCameraController.enableTranslate = true;

    v.scene.backgroundColor = Color.fromCssColorString("#020408");
    v.scene.skyAtmosphere.hueShift = 0.3;
    v.scene.skyAtmosphere.saturationShift = 0.3;
    v.scene.skyAtmosphere.brightnessShift = -0.3;
    v.scene.globe.enableLighting = true;
    v.scene.globe.showGroundAtmosphere = true;
    v.scene.fog.enabled = true;

    v.scene.postProcessStages.fxaa.enabled = true;
    const bloom = v.scene.postProcessStages.bloom;
    bloom.enabled = true;
    // @ts-expect-error — uniforms typed as unknown in older typedefs
    bloom.uniforms.glowOnly = false;
    // @ts-expect-error
    bloom.uniforms.contrast = 100;
    // @ts-expect-error
    bloom.uniforms.brightness = -0.5;
    // @ts-expect-error
    bloom.uniforms.delta = 1.0;
    // @ts-expect-error
    bloom.uniforms.sigma = 2.0;
    // @ts-expect-error
    bloom.uniforms.stepSize = 1.0;

    // Remove default Bing Maps layer synchronously so first frame doesn't crash
    v.imageryLayers.removeAll();

    // Satellite imagery — Ion asset 2 (Cesium World Imagery)
    IonImageryProvider.fromAssetId(2)
      .then((provider) => {
        if (v.isDestroyed()) return;
        v.imageryLayers.removeAll();
        v.imageryLayers.addImageryProvider(provider);
      })
      .catch(() => {
        if (v.isDestroyed()) return;
        v.imageryLayers.addImageryProvider(
          new OpenStreetMapImageryProvider({
            url: "https://tile.openstreetmap.org/",
            credit: "© OpenStreetMap contributors",
          })
        );
      });

    // Fly to NJ
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

    // OSM 3D Buildings via createOsmBuildingsAsync (Cesium-recommended API)
    // Requires asset 96188 in your Ion account at ion.cesium.com
    createOsmBuildingsAsync()
      .then((tileset) => {
        // Guard: viewer may have been destroyed by React StrictMode cleanup
        if (v.isDestroyed() || viewerRef.current !== v) {
          return;
        }

        tilesetRef.current = tileset;
        v.scene.primitives.add(tileset);
        tileset.maximumScreenSpaceError = 16;

        // Dark cyberpunk style: color by height
        tileset.style = new Cesium3DTileStyle({
          color: {
            conditions: [
              ["${feature['cesium#estimatedHeight']} > 150", "color('rgba(120,230,255,0.95)')"],
              ["${feature['cesium#estimatedHeight']} > 60",  "color('rgba(70,170,225,0.9)')"],
              ["${feature['cesium#estimatedHeight']} > 20",  "color('rgba(45,110,180,0.85)')"],
              ["true",                                        "color('rgba(28,65,120,0.8)')"],
            ],
          },
        });

        // Use live store state (not stale closure) for initial visibility
        const { showBuildings: sb, viewLevel: vl } = useMapStore.getState();
        tileset.show = buildingsVisible(vl, sb);
        setTilesetError(null);
      })
      .catch((err: unknown) => {
        if (v.isDestroyed() || viewerRef.current !== v) return;
        console.error("OSM Buildings tileset failed:", err);
        const msg = err instanceof Error ? err.message : String(err);
        setTilesetError(
          msg.includes("403") || msg.includes("401")
            ? "Go to ion.cesium.com → My Assets → search 'OSM Buildings' → Add to my assets"
            : `3D Buildings failed: ${msg}`
        );
      });

    return () => {
      if (!v.isDestroyed()) v.destroy();
      viewerRef.current = null;
      tilesetRef.current = null;
      initDoneRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync building visibility when viewLevel or toggle changes
  useEffect(() => {
    if (tilesetRef.current) {
      tilesetRef.current.show = buildingsVisible(viewLevel, showBuildings);
    }
  }, [showBuildings, viewLevel]);

  // County choropleth — state view
  const { entityMapRef: countyEntityMapRef } = useChoropleth({
    viewer: viewerRef.current,
    dataUrl: "/data/nj_counties_enriched.geojson",
    activeVariable,
    show: viewLevel === "state",
    filterCountyFips: null,
    keyField: "county_fips",
  });

  // Tract choropleth — county + tract view
  const { entityMapRef: tractEntityMapRef } = useChoropleth({
    viewer: viewerRef.current,
    dataUrl: "/data/nj_tracts_enriched.geojson",
    activeVariable,
    show: showTracts && viewLevel !== "state",
    filterCountyFips: selectedCountyFips,
    keyField: "GEOID",
  });

  // Camera fly-to on navigation changes
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    if (viewLevel === "state") {
      v.camera.flyTo({
        destination: NJ_DESTINATION,
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-45),
          roll: 0,
        },
        duration: 1.5,
      });
    } else if (viewLevel === "county" && selectedCountyFips) {
      const entity = countyEntityMapRef.current.get(selectedCountyFips);
      if (entity) {
        v.flyTo(entity, {
          duration: 1.5,
          offset: new HeadingPitchRange(0, CesiumMath.toRadians(-50), 0),
        }).catch(() => {});
      }
    } else if (viewLevel === "tract" && selectedTractId) {
      const entity = tractEntityMapRef.current.get(selectedTractId);
      if (entity) {
        v.flyTo(entity, {
          duration: 1.5,
          offset: new HeadingPitchRange(0, CesiumMath.toRadians(-40), 3000),
        }).catch(() => {});
      }
    } else if (viewLevel === "building" && selectedTractId) {
      const entity = tractEntityMapRef.current.get(selectedTractId);
      if (entity) {
        v.flyTo(entity, {
          duration: 1.5,
          offset: new HeadingPitchRange(0, CesiumMath.toRadians(-25), 500),
        }).catch(() => {});
      }
    }
  }, [viewLevel, selectedCountyFips, selectedTractId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unified click handler — recreated when viewLevel changes
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    if (handlerRef.current && !handlerRef.current.isDestroyed()) {
      handlerRef.current.destroy();
    }

    const handler = new ScreenSpaceEventHandler(v.canvas);
    handlerRef.current = handler;

    handler.setInputAction((e: ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = v.scene.pick(e.position);
      if (!defined(picked)) return;

      // 3D tile feature click — extract OSM building properties
      if (picked instanceof Cesium3DTileFeature) {
        if (viewLevel === "tract" || viewLevel === "county") {
          const props = extractBuildingProps(picked);
          navigateToBuilding(props);
        }
        return;
      }

      // GeoJSON entity click
      const entity = picked?.id as EntityWithData | undefined;
      if (!entity?._featureData) return;
      const data = entity._featureData;

      if (viewLevel === "state" && data.county_fips) {
        navigateToCounty(data.county_fips as string, (data.NAME as string | undefined) ?? data.county_fips as string);
      } else if (viewLevel === "county" && data.GEOID) {
        navigateToTract(data.GEOID as string, data as unknown as TractProperties);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
      handlerRef.current = null;
    };
  }, [viewLevel, navigateToState, navigateToCounty, navigateToTract, navigateToBuilding]);

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={0}
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, outline: "none" }}
      />
      {tilesetError && (
        <div style={{
          position: "absolute",
          bottom: 24,
          right: 16,
          maxWidth: 340,
          background: "rgba(30,10,10,0.92)",
          border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 8,
          padding: "10px 14px",
          color: "#fca5a5",
          fontSize: 11,
          fontFamily: "'Inter', system-ui, sans-serif",
          lineHeight: 1.5,
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}>
          <span style={{ fontWeight: 700, color: "#f87171" }}>3D Buildings: </span>
          {tilesetError}
        </div>
      )}
    </>
  );
}
