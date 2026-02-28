import { useEffect, useRef } from "react";
import {
  Viewer,
  Cartesian3,
  Cesium3DTileset,
  Cesium3DTileStyle,
  Math as CesiumMath,
  Color,
  IonWorldImageryStyle,
  createWorldImageryAsync,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Cesium3DTileFeature,
  HeadingPitchRange,
  type Entity,
} from "cesium";
import type { TractProperties } from "../../types/tract";
import { useMapStore } from "../../store/useMapStore";
import { useChoropleth } from "../../hooks/useChoropleth";

// NJ centroid at state overview altitude
const NJ_DESTINATION = Cartesian3.fromDegrees(-74.4057, 40.0583, 220000);

// Feature data attached by useChoropleth
type FeatureData = Record<string, unknown>;
interface EntityWithData extends Entity {
  _featureData?: FeatureData;
}

export function CesiumMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const initDoneRef = useRef(false);

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

    // Fix zoom/pan — explicitly enable all camera controls
    v.scene.screenSpaceCameraController.enableZoom = true;
    v.scene.screenSpaceCameraController.enableRotate = true;
    v.scene.screenSpaceCameraController.enableTilt = true;
    v.scene.screenSpaceCameraController.enableTranslate = true;

    // Dark background
    v.scene.backgroundColor = Color.fromCssColorString("#020408");

    // Atmosphere — blue-shifted dark look
    v.scene.skyAtmosphere.hueShift = 0.3;
    v.scene.skyAtmosphere.saturationShift = 0.3;
    v.scene.skyAtmosphere.brightnessShift = -0.3;

    v.scene.globe.enableLighting = true;
    v.scene.globe.showGroundAtmosphere = true;
    v.scene.fog.enabled = true;

    // Post-processing — subtle cyberpunk glow
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

    // Satellite imagery with labels
    createWorldImageryAsync({ style: IonWorldImageryStyle.AERIAL_WITH_LABELS })
      .then((layer) => {
        v.imageryLayers.removeAll();
        v.imageryLayers.add(layer);
      })
      .catch(() => {
        // Fallback: keep default imagery if Ion fails
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

    // OSM 3D Buildings — Cesium Ion asset 96188
    Cesium3DTileset.fromIonAssetId(96188)
      .then((tileset) => {
        tilesetRef.current = tileset;
        v.scene.primitives.add(tileset);

        // Dark cyberpunk building style
        tileset.style = new Cesium3DTileStyle({
          color: {
            conditions: [
              [
                "${feature['cesium#estimatedHeight']} > 150",
                "color('rgba(120,230,255,0.95)')",
              ],
              [
                "${feature['cesium#estimatedHeight']} > 60",
                "color('rgba(70,170,225,0.9)')",
              ],
              [
                "${feature['cesium#estimatedHeight']} > 20",
                "color('rgba(45,110,180,0.85)')",
              ],
              ["true", "color('rgba(28,65,120,0.8)')"],
            ],
          },
        });

        tileset.show = showBuildings && (viewLevel === "tract" || viewLevel === "building");
      })
      .catch((err: unknown) => {
        console.warn("OSM Buildings tileset failed (check Ion token):", err);
      });

    return () => {
      if (!v.isDestroyed()) v.destroy();
      viewerRef.current = null;
      initDoneRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync building visibility based on viewLevel + showBuildings toggle
  useEffect(() => {
    if (tilesetRef.current) {
      tilesetRef.current.show =
        showBuildings && (viewLevel === "tract" || viewLevel === "building");
    }
  }, [showBuildings, viewLevel]);

  // County choropleth (visible at state level)
  const { entityMapRef: countyEntityMapRef } = useChoropleth({
    viewer: viewerRef.current,
    dataUrl: "/data/nj_counties_enriched.geojson",
    activeVariable,
    show: viewLevel === "state",
    filterCountyFips: null,
    keyField: "county_fips",
  });

  // Tract choropleth (visible at county + tract level)
  const { entityMapRef: tractEntityMapRef } = useChoropleth({
    viewer: viewerRef.current,
    dataUrl: "/data/nj_tracts_enriched.geojson",
    activeVariable,
    show: showTracts && viewLevel !== "state",
    filterCountyFips: selectedCountyFips,
    keyField: "GEOID",
  });

  // Camera fly-to on navigation state change
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

  // Unified click handler — re-created when viewLevel changes
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    // Destroy previous handler
    if (handlerRef.current && !handlerRef.current.isDestroyed()) {
      handlerRef.current.destroy();
    }

    const handler = new ScreenSpaceEventHandler(v.canvas);
    handlerRef.current = handler;

    handler.setInputAction((e: ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = v.scene.pick(e.position);

      if (!defined(picked)) return;

      // Building click (3D tile feature) — only act at tract level
      if (picked instanceof Cesium3DTileFeature && viewLevel === "tract") {
        navigateToBuilding();
        return;
      }

      // Entity click
      const entity = picked?.id as EntityWithData | undefined;
      if (!entity?._featureData) return;

      const data = entity._featureData;

      if (viewLevel === "state" && data.county_fips) {
        // Clicked a county polygon
        const fips = data.county_fips as string;
        const name = (data.NAME as string | undefined) ?? fips;
        navigateToCounty(fips, name);
      } else if (viewLevel === "county" && data.GEOID) {
        // Clicked a tract polygon — pass feature props to the store
        navigateToTract(data.GEOID as string, data as unknown as TractProperties);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
      handlerRef.current = null;
    };
  }, [viewLevel, navigateToState, navigateToCounty, navigateToTract, navigateToBuilding]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        outline: "none",
      }}
    />
  );
}
