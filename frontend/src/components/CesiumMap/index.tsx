import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  Cartesian3,
  Cesium3DTileset,
  Math as CesiumMath,
  Color,
  IonImageryProvider,
  OpenStreetMapImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Cesium3DTileFeature,
  HeadingPitchRange,
  createGooglePhotorealistic3DTileset,
  PostProcessStage,
  Ion,
  Entity,
  PointGraphics,
  LabelGraphics,
  VerticalOrigin,
  HorizontalOrigin,
  Cartesian2,
  EllipseGraphics,
  HeightReference,
  NearFarScalar,
} from "cesium";
import type { TractProperties } from "../../types/tract";
import type { BuildingProperties } from "../../types/building";
import { useMapStore } from "../../store/useMapStore";
import { useChoropleth } from "../../hooks/useChoropleth";
import { useSatellites } from "../../hooks/useSatellites";
import { useFlights } from "../../hooks/useFlights";
import { useEarthquakes } from "../../hooks/useEarthquakes";
import CesiumNavigation from "cesium-navigation-es6";

// NJ centroid at state overview altitude
const NJ_DESTINATION = Cartesian3.fromDegrees(-74.4057, 40.0583, 220000);

// NJ Points of Interest, keyed Q-T (5 landmarks)
const NJ_POIS = [
  { key: "q", name: "Liberty State Park", lat: 40.7001, lon: -74.0577, alt: 800 },
  { key: "w", name: "MetLife Stadium", lat: 40.8135, lon: -74.0743, alt: 600 },
  { key: "e", name: "Princeton Univ.", lat: 40.3431, lon: -74.6551, alt: 700 },
  { key: "r", name: "Atlantic City", lat: 39.3644, lon: -74.4229, alt: 3000 },
  { key: "t", name: "High Point Monument", lat: 41.3209, lon: -74.6619, alt: 1200 },
] as const;

// Mock CCTV cameras at key NJ highway/city intersections
const NJ_CCTV = [
  { id: "cam01", label: "NJ Turnpike MP 14E", lat: 40.7484, lon: -74.0600, imgUrl: "https://511nj.org/map/cameras/njt14e.jpg" },
  { id: "cam02", label: "Route 1/9 – Jersey City", lat: 40.7178, lon: -74.0431, imgUrl: "https://511nj.org/map/cameras/rt19jc.jpg" },
  { id: "cam03", label: "I-287 – Edison", lat: 40.5188, lon: -74.4121, imgUrl: "https://511nj.org/map/cameras/i287ed.jpg" },
  { id: "cam04", label: "GSP MP 88 – Toms River", lat: 39.9534, lon: -74.1279, imgUrl: "https://511nj.org/map/cameras/gsp88.jpg" },
  { id: "cam05", label: "AC Expressway – Absecon", lat: 39.4260, lon: -74.5019, imgUrl: "https://511nj.org/map/cameras/ace01.jpg" },
];

// Mock military flights around NJ/PA (ADS-B Exchange scrape simulation)
const MOCK_MILITARY = [
  { icao24: "mil001", callsign: "USAF C17", lat: 40.43, lon: -74.33, altitude: 7620, heading: 270, velocity: 220 },
  { icao24: "mil002", callsign: "USN P-8A", lat: 39.72, lon: -74.09, altitude: 6096, heading: 180, velocity: 185 },
  { icao24: "mil003", callsign: "USAF KC-135", lat: 41.02, lon: -74.72, altitude: 9144, heading: 120, velocity: 240 },
  { icao24: "mil004", callsign: "USMC MV-22", lat: 40.15, lon: -74.85, altitude: 3050, heading: 45, velocity: 140 },
  { icao24: "mil005", callsign: "USCG HC-130", lat: 39.58, lon: -74.45, altitude: 5486, heading: 200, velocity: 165 },
];

// Feature data attached by useChoropleth
type FeatureData = Record<string, unknown>;
interface EntityWithData extends Entity {
  _featureData?: FeatureData;
}

// Custom GlSL Shaders for Visual Modes
const SHADERS = {
  crt: `
    uniform sampler2D colorTexture;
    uniform float u_intensity;
    uniform float u_noise;
    in vec2 v_textureCoordinates;
    void main() {
      vec2 uv = v_textureCoordinates;
      vec2 crt_uv = uv * 2.0 - 1.0;
      vec2 offset = crt_uv.yx / (5.0 + u_intensity * 5.0);
      crt_uv = crt_uv + crt_uv * offset * offset;
      crt_uv = crt_uv * 0.5 + 0.5;
      if (crt_uv.x < 0.0 || crt_uv.x > 1.0 || crt_uv.y < 0.0 || crt_uv.y > 1.0) {
        out_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      vec4 color = texture(colorTexture, crt_uv);
      float scanline = sin(crt_uv.y * (400.0 + u_intensity * 800.0)) * (0.02 + u_noise * 0.06);
      color.r = texture(colorTexture, crt_uv + vec2(0.003, 0.0)).r;
      color.b = texture(colorTexture, crt_uv - vec2(0.003, 0.0)).b;
      color.rgb -= scanline;
      out_FragColor = color;
    }
  `,
  nightvision: `
    uniform sampler2D colorTexture;
    uniform float u_intensity;
    uniform float u_noise;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float lum = dot(color.rgb, vec3(0.3, 0.59, 0.11));
      float noise = fract(sin(dot(v_textureCoordinates, vec2(12.9898, 78.233))) * 43758.5453);
      vec3 nvColor = vec3(0.1, 0.95, 0.2) * (lum * (0.7 + u_intensity * 0.6) + noise * u_noise);
      vec2 uv = v_textureCoordinates * 2.0 - 1.0;
      float vignette = 1.0 - dot(uv, uv) * 0.3;
      out_FragColor = vec4(nvColor * vignette, 1.0);
    }
  `,
  flir: `
    uniform sampler2D colorTexture;
    uniform float u_intensity;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      lum = clamp(lum * (0.5 + u_intensity * 1.5), 0.0, 1.0);
      vec3 heat;
      if (lum < 0.25) heat = mix(vec3(0.0,0.0,0.0), vec3(0.3,0.0,0.5), lum * 4.0);
      else if (lum < 0.5) heat = mix(vec3(0.3,0.0,0.5), vec3(0.9,0.1,0.0), (lum - 0.25) * 4.0);
      else if (lum < 0.75) heat = mix(vec3(0.9,0.1,0.0), vec3(1.0,0.8,0.0), (lum - 0.5) * 4.0);
      else heat = mix(vec3(1.0,0.8,0.0), vec3(1.0,1.0,1.0), (lum - 0.75) * 4.0);
      out_FragColor = vec4(heat, 1.0);
    }
  `,
  noir: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      lum = smoothstep(0.2, 0.8, lum);
      vec2 uv = v_textureCoordinates * 2.0 - 1.0;
      float vignette = smoothstep(1.5, 0.3, length(uv));
      out_FragColor = vec4(vec3(lum) * vignette, 1.0);
    }
  `,
  anime: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float bands = 6.0;
      color.rgb = floor(color.rgb * bands) / bands;
      float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(lum), color.rgb, 1.3);
      out_FragColor = vec4(color.rgb, 1.0);
    }
  `,
  highcontrast: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      color.rgb = (color.rgb - 0.5) * 1.5 + 0.5;
      out_FragColor = vec4(color.rgb, 1.0);
    }
  `
};

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

// Traffic particle positions stored in module scope so they can be driven by a tick
const trafficParticles: Array<{
  id: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
}> = [];

// NJ approximate road segments (lat/lon pairs as simple lines)
const NJ_ROAD_LINES = [
  // NJ Turnpike
  { pts: [[40.18, -74.73], [40.49, -74.46], [40.65, -74.31], [40.75, -74.05], [40.92, -74.14]], arteries: true },
  // Garden State Parkway
  { pts: [[39.36, -74.42], [39.72, -74.24], [40.02, -74.15], [40.28, -74.12], [40.60, -74.10], [40.91, -74.06]], arteries: true },
  // I-287
  { pts: [[40.51, -74.63], [40.52, -74.40], [40.57, -74.28], [40.56, -74.06]], arteries: true },
  // Route 1
  { pts: [[40.31, -74.64], [40.43, -74.49], [40.57, -74.44], [40.74, -74.12]], arteries: false },
  // Route 9
  { pts: [[39.37, -74.43], [39.69, -74.27], [40.01, -74.15], [40.42, -74.30], [40.94, -74.12]], arteries: false },
  // I-78
  { pts: [[40.68, -74.04], [40.69, -74.38], [40.64, -74.71]], arteries: true },
  // I-80
  { pts: [[40.85, -74.04], [40.87, -74.38], [40.88, -74.72]], arteries: true },
];

function lerpPoint(a: number[], b: number[], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function initTrafficParticles() {
  trafficParticles.length = 0;
  let id = 0;
  for (const road of NJ_ROAD_LINES) {
    const count = road.arteries ? 12 : 6;
    for (let i = 0; i < count; i++) {
      const segIdx = Math.floor(Math.random() * (road.pts.length - 1));
      const t = Math.random();
      const p = lerpPoint(road.pts[segIdx], road.pts[segIdx + 1], t);
      const next = lerpPoint(road.pts[segIdx], road.pts[segIdx + 1], Math.min(t + 0.01, 1));
      const heading = Math.atan2(next[1] - p[1], next[0] - p[0]) * (180 / Math.PI);
      trafficParticles.push({
        id: `t${id++}`,
        lat: p[0],
        lon: p[1],
        speed: 0.0003 + Math.random() * 0.0004,
        heading,
      });
    }
  }
}

export function CesiumMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const initDoneRef = useRef(false);
  const [tilesetError, setTilesetError] = useState<string | null>(null);
  const stagesRef = useRef<Record<string, PostProcessStage>>({});
  const satEntitiesRef = useRef<Map<string, Entity>>(new Map());
  const flightEntitiesRef = useRef<Map<string, Entity>>(new Map());
  const milEntitiesRef = useRef<Map<string, Entity>>(new Map());
  const eqEntitiesRef = useRef<Map<string, Entity>>(new Map());
  const cctvEntitiesRef = useRef<Map<string, Entity>>(new Map());
  const trafficEntitiesRef = useRef<Map<string, Entity>>(new Map());
  const trafficTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activePOI, setActivePOI] = useState<string | null>(null);

  const {
    activeVariable, showBuildings, showTracts, viewLevel,
    selectedCountyFips, selectedTractId, visualMode,
    isFlythroughActive,
    navigateToState, navigateToCounty, navigateToTract, navigateToBuilding,
    showSatellites, showFlights, showMilitaryFlights, showTraffic,
    showEarthquakes, showCCTV,
    detectionMode, setTrackedSatelliteId, setTrackedFlightIcao,
    trackedSatelliteId, trackedFlightIcao,
  } = useMapStore();

  // --- Live data hooks ---
  const satellites = useSatellites(showSatellites, detectionMode);
  const flights = useFlights(showFlights);
  const earthquakes = useEarthquakes(showEarthquakes);

  // Initialize Cesium viewer once
  useEffect(() => {
    if (!containerRef.current || initDoneRef.current) return;
    initDoneRef.current = true;

    const creditDiv = document.createElement("div");
    const v = new Viewer(containerRef.current, {
      animation: false, baseLayerPicker: false, fullscreenButton: false,
      geocoder: false, homeButton: false, infoBox: false,
      navigationHelpButton: false, sceneModePicker: false,
      selectionIndicator: false, timeline: false, creditContainer: creditDiv,
    });

    v.scene.screenSpaceCameraController.enableZoom = true;
    v.scene.screenSpaceCameraController.enableRotate = true;
    v.scene.screenSpaceCameraController.enableTilt = true;
    v.scene.screenSpaceCameraController.enableTranslate = true;

    v.scene.backgroundColor = Color.fromCssColorString("#020408");
    if (v.scene.skyAtmosphere) {
      v.scene.skyAtmosphere.hueShift = 0.3;
      v.scene.skyAtmosphere.saturationShift = 0.3;
      v.scene.skyAtmosphere.brightnessShift = -0.3;
    }
    v.scene.globe.enableLighting = true;
    v.scene.globe.showGroundAtmosphere = true;
    v.scene.fog.enabled = true;
    v.scene.globe.depthTestAgainstTerrain = true;
    v.scene.shadowMap.enabled = true;
    v.scene.postProcessStages.fxaa.enabled = true;

    const bloom = v.scene.postProcessStages.bloom;
    bloom.enabled = true;
    // @ts-ignore
    bloom.uniforms.glowOnly = false;
    // @ts-ignore
    bloom.uniforms.contrast = 100;
    // @ts-ignore
    bloom.uniforms.brightness = -0.5;
    // @ts-ignore
    bloom.uniforms.delta = 1.0;
    // @ts-ignore
    bloom.uniforms.sigma = 2.0;

    // Setup visual mode post-process stages with live uniform callbacks
    const stages: Record<string, PostProcessStage> = {};
    for (const [name, shader] of Object.entries(SHADERS)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniforms: any = {
        u_intensity: () => useMapStore.getState().visualIntensity,
        u_noise: () => useMapStore.getState().visualNoise,
      };
      stages[name] = new PostProcessStage({ fragmentShader: shader, uniforms });
      stages[name].enabled = false;
      v.scene.postProcessStages.add(stages[name]);
    }
    stagesRef.current = stages;

    v.imageryLayers.removeAll();
    IonImageryProvider.fromAssetId(2)
      .then((provider) => {
        if (v.isDestroyed()) return;
        v.imageryLayers.removeAll();
        v.imageryLayers.addImageryProvider(provider);
      })
      .catch(() => {
        if (v.isDestroyed()) return;
        v.imageryLayers.addImageryProvider(
          new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/", credit: "© OpenStreetMap" })
        );
      });

    v.camera.flyTo({
      destination: NJ_DESTINATION,
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-45), roll: 0 },
      duration: 2,
    });

    try {
      new CesiumNavigation(v, {
        enableCompass: true, enableZoomControls: true,
        enableDistanceLegend: true, enableCompassOuterRing: true,
      });
    } catch (e) {
      console.warn("CesiumNavigation init failed", e);
    }

    viewerRef.current = v;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
    Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? "";

    createGooglePhotorealistic3DTileset({ key: apiKey })
      .then((tileset) => {
        if (v.isDestroyed() || viewerRef.current !== v) return;
        tilesetRef.current = tileset;
        v.scene.primitives.add(tileset);
        tileset.maximumScreenSpaceError = 16;
        tileset.show = true;
        setTilesetError(null);
      })
      .catch((err: unknown) => {
        if (v.isDestroyed() || viewerRef.current !== v) return;
        const msg = err instanceof Error ? err.message : String(err);
        setTilesetError(
          msg.includes("403") || msg.includes("401")
            ? "Ensure VITE_GOOGLE_MAPS_API_KEY is set in .env with Map Tiles API enabled"
            : `Photorealistic 3D Tiles failed: ${msg}`
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

  // Sync visual modes
  useEffect(() => {
    Object.entries(stagesRef.current).forEach(([name, stage]) => {
      stage.enabled = name === visualMode;
    });
  }, [visualMode]);

  // Sync building visibility
  useEffect(() => {
    if (tilesetRef.current) tilesetRef.current.show = true;
  }, [showBuildings, viewLevel]);

  // Keyboard: POI shortcuts (Q..T) and ESC to go back to state
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const v = viewerRef.current;
      if (!v) return;

      const key = e.key.toLowerCase();

      // POI shortcuts
      const poi = NJ_POIS.find((p) => p.key === key);
      if (poi) {
        setActivePOI(poi.name);
        v.camera.flyTo({
          destination: Cartesian3.fromDegrees(poi.lon, poi.lat, poi.alt),
          orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-30), roll: 0 },
          duration: 2.5,
        });
        return;
      }

      if (key === "escape" || key === "1") {
        setActivePOI(null);
        v.camera.flyTo({
          destination: NJ_DESTINATION,
          orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-45), roll: 0 },
          duration: 1.5,
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Satellite entities
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const existing = satEntitiesRef.current;

    if (!showSatellites) {
      existing.forEach((e) => v.entities.remove(e));
      existing.clear();
      return;
    }

    const incoming = new Set(satellites.map((s) => s.id));

    // Remove stale
    existing.forEach((ent, id) => {
      if (!incoming.has(id)) { v.entities.remove(ent); existing.delete(id); }
    });

    // Add/update
    for (const sat of satellites) {
      const pos = Cartesian3.fromDegrees(sat.lon, sat.lat, sat.alt * 1000);
      const isTracked = sat.id === trackedSatelliteId;
      if (existing.has(sat.id)) {
        const ent = existing.get(sat.id)!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ent.position as any)?.setValue?.(pos);
      } else {
        const ent = v.entities.add({
          id: `sat_${sat.id}`,
          position: pos,
          point: {
            pixelSize: isTracked ? 10 : (detectionMode === "sparse" ? 5 : 3),
            color: isTracked ? Color.YELLOW : Color.fromCssColorString("#00ffcc"),
            outlineColor: Color.BLACK,
            outlineWidth: 1,
            scaleByDistance: new NearFarScalar(1e7, 1.0, 1e9, 0.2),
          } as PointGraphics.ConstructorOptions,
          label: detectionMode === "sparse" ? {
            text: sat.name.substring(0, 14),
            font: "10px monospace",
            fillColor: Color.fromCssColorString("#00ffcc"),
            outlineColor: Color.BLACK,
            outlineWidth: 1,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -8),
            distanceDisplayCondition: { near: 0, far: 5e7 },
            scaleByDistance: new NearFarScalar(1e6, 1.2, 1e8, 0.8),
          } as LabelGraphics.ConstructorOptions : undefined,
        });
        existing.set(sat.id, ent);
      }
    }
  }, [satellites, showSatellites, detectionMode, trackedSatelliteId]);

  // Track satellite camera follow
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !trackedSatelliteId || !showSatellites) return;
    const ent = satEntitiesRef.current.get(trackedSatelliteId);
    if (ent) v.trackedEntity = ent;
    return () => {
      if (v && !v.isDestroyed()) v.trackedEntity = undefined;
    };
  }, [trackedSatelliteId, showSatellites]);

  // Flight entities (commercial)
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const existing = flightEntitiesRef.current;

    if (!showFlights) {
      existing.forEach((e) => v.entities.remove(e));
      existing.clear();
      return;
    }

    const incoming = new Set(flights.map((f) => f.icao24));
    existing.forEach((ent, id) => {
      if (!incoming.has(id)) { v.entities.remove(ent); existing.delete(id); }
    });

    for (const fl of flights) {
      if (fl.onGround) continue;
      const pos = Cartesian3.fromDegrees(fl.lon, fl.lat, fl.altitude);
      const isTracked = fl.icao24 === trackedFlightIcao;
      if (existing.has(fl.icao24)) {
        const ent = existing.get(fl.icao24)!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ent.position as any)?.setValue?.(pos);
      } else {
        const ent = v.entities.add({
          id: `flt_${fl.icao24}`,
          position: pos,
          point: {
            pixelSize: isTracked ? 12 : 8,
            color: isTracked ? Color.YELLOW : Color.fromCssColorString("#60a5fa"),
            outlineColor: Color.BLACK,
            outlineWidth: 1,
            scaleByDistance: new NearFarScalar(1e5, 1.5, 5e6, 0.5),
          } as PointGraphics.ConstructorOptions,
          label: {
            text: fl.callsign || fl.icao24,
            font: "bold 10px monospace",
            fillColor: isTracked ? Color.YELLOW : Color.fromCssColorString("#93c5fd"),
            outlineColor: Color.BLACK,
            outlineWidth: 1,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -10),
            scaleByDistance: new NearFarScalar(1e4, 1.0, 2e6, 0.6),
          } as LabelGraphics.ConstructorOptions,
        });
        existing.set(fl.icao24, ent);
      }
    }
  }, [flights, showFlights, trackedFlightIcao]);

  // Track flight camera follow
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !trackedFlightIcao || !showFlights) return;
    const ent = flightEntitiesRef.current.get(trackedFlightIcao);
    if (ent) v.trackedEntity = ent;
    return () => {
      if (v && !v.isDestroyed()) v.trackedEntity = undefined;
    };
  }, [trackedFlightIcao, showFlights]);

  // Military flights layer
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const existing = milEntitiesRef.current;

    if (!showMilitaryFlights) {
      existing.forEach((e) => v.entities.remove(e));
      existing.clear();
      return;
    }

    if (existing.size > 0) return; // already rendered

    for (const mil of MOCK_MILITARY) {
      const pos = Cartesian3.fromDegrees(mil.lon, mil.lat, mil.altitude);
      const ent = v.entities.add({
        id: `mil_${mil.icao24}`,
        position: pos,
        point: {
          pixelSize: 10,
          color: Color.fromCssColorString("#f97316"),
          outlineColor: Color.YELLOW,
          outlineWidth: 2,
          scaleByDistance: new NearFarScalar(1e5, 1.5, 5e6, 0.5),
        } as PointGraphics.ConstructorOptions,
        label: {
          text: mil.callsign,
          font: "bold 11px monospace",
          fillColor: Color.fromCssColorString("#f97316"),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -12),
          scaleByDistance: new NearFarScalar(1e4, 1.0, 3e6, 0.5),
        } as LabelGraphics.ConstructorOptions,
      });
      existing.set(mil.icao24, ent);
    }
  }, [showMilitaryFlights]);

  // Earthquake entities
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const existing = eqEntitiesRef.current;

    if (!showEarthquakes) {
      existing.forEach((e) => v.entities.remove(e));
      existing.clear();
      return;
    }

    const incoming = new Set(earthquakes.map((q) => q.id));
    existing.forEach((ent, id) => {
      if (!incoming.has(id)) { v.entities.remove(ent); existing.delete(id); }
    });

    for (const eq of earthquakes) {
      if (existing.has(eq.id)) continue;
      const radius = Math.pow(10, eq.magnitude) * 800;
      const ent = v.entities.add({
        id: `eq_${eq.id}`,
        position: Cartesian3.fromDegrees(eq.lon, eq.lat, 0),
        ellipse: {
          semiMinorAxis: radius,
          semiMajorAxis: radius,
          material: Color.fromCssColorString("#ef4444").withAlpha(0.3),
          outline: true,
          outlineColor: Color.fromCssColorString("#f87171"),
          outlineWidth: 1,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        } as EllipseGraphics.ConstructorOptions,
        label: {
          text: `M${eq.magnitude.toFixed(1)} ${eq.place.substring(0, 20)}`,
          font: "10px monospace",
          fillColor: Color.fromCssColorString("#fca5a5"),
          outlineColor: Color.BLACK,
          outlineWidth: 1,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -8),
          scaleByDistance: new NearFarScalar(1e5, 1.5, 1e7, 0.5),
        } as LabelGraphics.ConstructorOptions,
      });
      existing.set(eq.id, ent);
    }
  }, [earthquakes, showEarthquakes]);

  // CCTV camera pins
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const existing = cctvEntitiesRef.current;

    if (!showCCTV) {
      existing.forEach((e) => v.entities.remove(e));
      existing.clear();
      return;
    }
    if (existing.size > 0) return;

    for (const cam of NJ_CCTV) {
      const ent = v.entities.add({
        id: `cctv_${cam.id}`,
        position: Cartesian3.fromDegrees(cam.lon, cam.lat, 20),
        point: {
          pixelSize: 12,
          color: Color.fromCssColorString("#a855f7"),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        } as PointGraphics.ConstructorOptions,
        label: {
          text: `📹 ${cam.label}`,
          font: "bold 11px monospace",
          fillColor: Color.fromCssColorString("#d8b4fe"),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(10, -8),
          scaleByDistance: new NearFarScalar(1e3, 1.2, 5e5, 0.6),
        } as LabelGraphics.ConstructorOptions,
      });
      existing.set(cam.id, ent);
    }
  }, [showCCTV]);

  // Traffic particle boot
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const existing = trafficEntitiesRef.current;

    if (!showTraffic) {
      existing.forEach((e) => v.entities.remove(e));
      existing.clear();
      if (trafficTickRef.current) { clearInterval(trafficTickRef.current); trafficTickRef.current = null; }
      return;
    }

    if (trafficParticles.length === 0) initTrafficParticles();

    // Create entities once
    if (existing.size === 0) {
      for (const p of trafficParticles) {
        const ent = v.entities.add({
          id: `traf_${p.id}`,
          position: Cartesian3.fromDegrees(p.lon, p.lat, 5),
          point: {
            pixelSize: 4,
            color: Color.fromCssColorString("#facc15").withAlpha(0.85),
            outlineColor: Color.fromCssColorString("#78350f"),
            outlineWidth: 0,
            scaleByDistance: new NearFarScalar(500, 2.0, 5e5, 0.3),
          } as PointGraphics.ConstructorOptions,
        });
        existing.set(p.id, ent);
      }
    }

    // Animate particles along their road headings
    trafficTickRef.current = setInterval(() => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
      for (const p of trafficParticles) {
        const headRad = (p.heading * Math.PI) / 180;
        p.lat += Math.sin(headRad) * p.speed * 0.5;
        p.lon += Math.cos(headRad) * p.speed;

        // Keep within rough NJ bounding box
        if (p.lat < 38.9 || p.lat > 41.5 || p.lon < -75.6 || p.lon > -73.9) {
          // Bounce: reset to a new road
          p.lat = 39.0 + Math.random() * 2.5;
          p.lon = -75.5 + Math.random() * 1.5;
          p.heading = Math.random() * 360;
        }

        const ent = trafficEntitiesRef.current.get(p.id);
        if (ent) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ent.position as any)?.setValue?.(Cartesian3.fromDegrees(p.lon, p.lat, 5));
        }
      }
    }, 100);

    return () => {
      if (trafficTickRef.current) { clearInterval(trafficTickRef.current); trafficTickRef.current = null; }
    };
  }, [showTraffic]);

  // Flythrough
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (isFlythroughActive) {
      v.camera.flyTo({
        destination: Cartesian3.fromDegrees(-74.4500, 40.4800, 350),
        orientation: { heading: CesiumMath.toRadians(320), pitch: CesiumMath.toRadians(-15), roll: 0 },
        duration: 3,
        complete: () => {
          if (!useMapStore.getState().isFlythroughActive || v.isDestroyed()) return;
          const tick = () => {
            if (!useMapStore.getState().isFlythroughActive || v.isDestroyed()) {
              v.clock.onTick.removeEventListener(tick);
              return;
            }
            v.camera.moveForward(2.5);
            v.camera.lookRight(CesiumMath.toRadians(0.06));
          };
          v.clock.onTick.addEventListener(tick);
        },
      });
    }
  }, [isFlythroughActive]);

  // County/Tract choropleth
  const { entityMapRef: countyEntityMapRef } = useChoropleth({
    viewer: viewerRef.current,
    dataUrl: "/data/nj_counties_enriched.geojson",
    activeVariable,
    show: showTracts && viewLevel === "state",
    filterCountyFips: null,
    keyField: "county_fips",
  });

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
    if (!v || isFlythroughActive) return;
    v.trackedEntity = undefined;

    if (viewLevel === "state") {
      v.camera.flyTo({
        destination: NJ_DESTINATION,
        orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-45), roll: 0 },
        duration: 1.5,
      });
    } else if (viewLevel === "county" && selectedCountyFips) {
      const entity = countyEntityMapRef.current.get(selectedCountyFips);
      if (entity) v.flyTo(entity, { duration: 1.5, offset: new HeadingPitchRange(0, CesiumMath.toRadians(-50), 0) }).catch(() => { });
    } else if (viewLevel === "tract" && selectedTractId) {
      const entity = tractEntityMapRef.current.get(selectedTractId);
      if (entity) v.flyTo(entity, { duration: 1.5, offset: new HeadingPitchRange(0, CesiumMath.toRadians(-40), 3000) }).catch(() => { });
    } else if (viewLevel === "building" && selectedTractId) {
      const entity = tractEntityMapRef.current.get(selectedTractId);
      if (entity) v.flyTo(entity, { duration: 1.5, offset: new HeadingPitchRange(0, CesiumMath.toRadians(-25), 500) }).catch(() => { });
    }
  }, [viewLevel, selectedCountyFips, selectedTractId, isFlythroughActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click handler
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (handlerRef.current && !handlerRef.current.isDestroyed()) handlerRef.current.destroy();

    const handler = new ScreenSpaceEventHandler(v.canvas);
    handlerRef.current = handler;

    handler.setInputAction((e: ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = v.scene.pick(e.position);
      if (!defined(picked)) return;

      // 3D tile feature
      if (picked instanceof Cesium3DTileFeature) {
        if (viewLevel === "tract" || viewLevel === "county") {
          navigateToBuilding(extractBuildingProps(picked));
        }
        return;
      }

      // Entity click
      const entity = picked?.id as EntityWithData | undefined;
      if (!entity) return;

      const id = entity.id;
      // Satellite click
      if (typeof id === "string" && id.startsWith("sat_")) {
        const satId = id.replace("sat_", "");
        setTrackedSatelliteId(satId);
        return;
      }
      // Flight click (commercial)
      if (typeof id === "string" && id.startsWith("flt_")) {
        const icao = id.replace("flt_", "");
        setTrackedFlightIcao(icao);
        return;
      }

      if (!entity._featureData) return;
      const data = entity._featureData;
      if (viewLevel === "state" && data.county_fips) {
        navigateToCounty(data.county_fips as string, (data.NAME as string) ?? data.county_fips as string);
      } else if (viewLevel === "county" && data.GEOID) {
        navigateToTract(data.GEOID as string, data as unknown as TractProperties);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
      handlerRef.current = null;
    };
  }, [viewLevel, navigateToState, navigateToCounty, navigateToTract, navigateToBuilding, setTrackedSatelliteId, setTrackedFlightIcao]);

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={0}
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, outline: "none" }}
      />
      {/* Active POI badge */}
      {activePOI && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          pointerEvents: "none", fontFamily: "'Inter', monospace",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          color: "#94d2bd", textShadow: "0 0 12px #00ffcc88",
          animation: "poi-fade 2.5s forwards",
        }}>
          ⬡ {activePOI.toUpperCase()}
        </div>
      )}
      {/* Tracking indicators */}
      {trackedSatelliteId && (
        <div style={{
          position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,255,200,0.08)", border: "1px solid rgba(0,255,200,0.3)",
          borderRadius: 6, padding: "4px 12px", fontFamily: "monospace", fontSize: 11,
          color: "#00ffcc", pointerEvents: "none", letterSpacing: "0.08em",
        }}>
          TRACKING SAT {trackedSatelliteId} · ESC to release
        </div>
      )}
      {trackedFlightIcao && (
        <div style={{
          position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)",
          background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)",
          borderRadius: 6, padding: "4px 12px", fontFamily: "monospace", fontSize: 11,
          color: "#93c5fd", pointerEvents: "none", letterSpacing: "0.08em",
        }}>
          TRACKING FLIGHT {trackedFlightIcao.toUpperCase()} · ESC to release
        </div>
      )}
      {tilesetError && (
        <div style={{
          position: "absolute", bottom: 24, right: 16, maxWidth: 340,
          background: "rgba(30,10,10,0.92)", border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 11,
          fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1.5,
          backdropFilter: "blur(8px)", zIndex: 10,
        }}>
          <span style={{ fontWeight: 700, color: "#f87171" }}>3D Buildings: </span>
          {tilesetError}
        </div>
      )}
      <style>{`
        @keyframes poi-fade {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(1.5); }
          15% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}

