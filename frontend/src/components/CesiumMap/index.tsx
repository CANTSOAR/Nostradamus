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
  SampledPositionProperty,
  JulianDate,
  NearFarScalar,
  ExtrapolationType,
  Rectangle,
  Cartographic,
  Matrix4,
} from "cesium";
import type { TractProperties } from "../../types/tract";
import type { BuildingProperties } from "../../types/building";
import type { MunicipalityProperties } from "../../types/municipality";
import { useMunicipalities } from "../../hooks/useMunicipalities";
import { useMapStore } from "../../store/useMapStore";
import { useChoropleth } from "../../hooks/useChoropleth";
import { useSatellites } from "../../hooks/useSatellites";
import { useFlights } from "../../hooks/useFlights";
import type { FlightState } from "../../hooks/useFlights";
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

const PLANE_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIwLjUiPjxwYXRoIGQ9Ik0yMSAxNnYtMmwtOC01VjMuNWMwLS44My0uNjctMS41LTEuNS0xLjVTMTAgMi42NyAxMCAzLjVWOWwtOCA1djJsOC0yLjVWMTlsLTIgMS41VjIybDMuNS0xIDMuNSAxdi0xLjVMMTMgMTl2LTUuNWw4IDIuNXoiLz48L3N2Zz4=";

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
  `,
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
  segment: number[][]; // [lat, lon][]
  t: number; // progress along segment [0, 1]
}> = [];

interface RoadSegment {
  pts: number[][]; // [lat, lon][]
  type: string;
}

const roadSegments: RoadSegment[] = [];

// Remove hardcoded NJ_ROAD_LINES

function lerpPoint(a: number[], b: number[], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function initTrafficParticles(roads: RoadSegment[]) {
  trafficParticles.length = 0;
  if (roads.length === 0) return;

  // Use major roads only (motorway, primary)
  const majorRoads = roads.filter(r => r.type === "motorway" || r.type === "primary");
  if (majorRoads.length === 0) return;

  let id = 0;
  const densityMap: Record<string, number> = {
    motorway: 0.5,  // ~4x more than before
    primary: 0.25,
  };
  const capMap: Record<string, number> = {
    motorway: 20,
    primary: 10,
  };

  majorRoads.forEach((road) => {
    const density = densityMap[road.type] || 0.1;
    const cap = capMap[road.type] || 6;
    // Length approximation (sum of segment distances in degrees)
    let length = 0;
    for (let i = 0; i < road.pts.length - 1; i++) {
      const dLat = road.pts[i + 1][0] - road.pts[i][0];
      const dLon = road.pts[i + 1][1] - road.pts[i][1];
      length += Math.sqrt(dLat * dLat + dLon * dLon);
    }

    const count = Math.ceil(length * 1000 * density);
    for (let i = 0; i < Math.min(count, cap); i++) {
      const t = Math.random();
      const segIdx = Math.floor(Math.random() * (road.pts.length - 1));
      const p1 = road.pts[segIdx];
      const p2 = road.pts[segIdx + 1];
      const pos = lerpPoint(p1, p2, t);
      const heading = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);

      trafficParticles.push({
        id: `t${id++}`,
        lat: pos[0],
        lon: pos[1],
        speed: (0.0002 + Math.random() * 0.0003) * (road.type === "motorway" ? 1.8 : 1.0),
        heading,
        segment: road.pts,
        t,
      });
    }
  });
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
  const cctvEntitiesRef = useRef<Map<string, Entity>>(new Map());
  const trafficEntitiesRef = useRef<Map<string, Entity>>(new Map());
  const trafficTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roadsLoadedRef = useRef(false);
  const [activePOI, setActivePOI] = useState<string | null>(null);
  const flightSampledPositionsRef = useRef<Map<string, SampledPositionProperty>>(new Map());
  const flightsRef = useRef<FlightState[]>([]);
  const orbitTargetRef = useRef<Cartesian3>(Cartesian3.fromDegrees(-74.4057, 40.0583, 0));
  const orbitStateRef = useRef({ heading: 0, pitch: CesiumMath.toRadians(-25), range: 5000 });
  const orbitTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flythroughCleanupRef = useRef<(() => void) | null>(null);

  const {
    activeVariable, showBuildings, showTracts, viewLevel,
    selectedCountyFips, selectedTractId, visualMode,
    selectedMunicipalityProps,
    isFlythroughActive,
    navigateToState, navigateToCounty, navigateToTract, navigateToBuilding,
    showSatellites, showFlights, showMilitaryFlights, showTraffic,
    showCCTV,
    detectionMode, setTrackedSatelliteId, setTrackedFlightIcao, setTrackedFlightData,
    trackedSatelliteId, trackedFlightIcao,
    viewPreset,
    isOrbitActive,
    skyMode,
    showMunicipalities, setSelectedMunicipality,
  } = useMapStore();


  // --- Live data hooks ---
  const satellites = useSatellites(showSatellites, detectionMode);
  const flights = useFlights(showFlights);
  // Earthquakes removed

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
    v.scene.globe.enableLighting = true;
    v.scene.globe.showGroundAtmosphere = true;
    v.scene.fog.enabled = true;
    v.scene.globe.depthTestAgainstTerrain = false;
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
        // Hide the default globe to avoid clipping and Z-fighting with Google 3D Tiles
        v.scene.globe.show = false;
        setTilesetError(null);
      })
      .catch((err: unknown) => {
        if (v.isDestroyed() || viewerRef.current !== v) return;

        // Show globe fallback if tileset fails
        v.scene.globe.show = true;

        const msg = err instanceof Error ? err.message : String(err);
        setTilesetError(
          msg.includes("403") || msg.includes("401")
            ? "Ensure VITE_GOOGLE_MAPS_API_KEY is set in .env with Map Tiles API enabled"
            : `Photorealistic 3D Tiles failed: ${msg} `
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

  // Sync Sky Mode
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    const { scene } = v;
    const { skyAtmosphere, fog, globe } = scene;

    // Reset defaults
    scene.backgroundColor = Color.fromCssColorString("#020408");
    if (skyAtmosphere) {
      skyAtmosphere.hueShift = 0.0;
      skyAtmosphere.saturationShift = 0.0;
      skyAtmosphere.brightnessShift = 0.0;
    }
    fog.enabled = true;
    fog.density = 0.0002;
    globe.showGroundAtmosphere = true;

    switch (skyMode) {
      case "sunny":
        // Default clean look
        break;
      case "cloudy":
        fog.density = 0.0008;
        if (skyAtmosphere) skyAtmosphere.saturationShift = -0.5;
        break;
      case "dusk":
        if (skyAtmosphere) {
          skyAtmosphere.hueShift = 0.3;
          skyAtmosphere.saturationShift = 0.3;
          skyAtmosphere.brightnessShift = -0.2;
        }
        break;
      case "night":
        scene.backgroundColor = Color.BLACK;
        if (skyAtmosphere) {
          skyAtmosphere.brightnessShift = -0.8;
          skyAtmosphere.saturationShift = -0.8;
        }
        fog.enabled = false;
        break;
    }
  }, [skyMode]);


  // Keyboard: POI shortcuts (Q..T) and ESC to go back to state
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const v = viewerRef.current;
      if (!v) return;

      const key = e.key.toLowerCase();
      const { isFlythroughActive, isOrbitActive, toggleFlythrough: stopFlythrough, toggleOrbit: stopOrbit } = useMapStore.getState();

      // In flythrough or orbit mode, only ESC is processed here (WASD handled elsewhere)
      if (isFlythroughActive || isOrbitActive) {
        if (key === "escape") {
          if (isFlythroughActive) stopFlythrough();
          if (isOrbitActive) stopOrbit();
        }
        return;
      }

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

  // Keep flightsRef current and refresh tracked flight data on each poll
  useEffect(() => {
    flightsRef.current = flights;
    const { trackedFlightIcao: icao } = useMapStore.getState();
    if (icao) {
      const found = flights.find((f) => f.icao24 === icao);
      if (found) setTrackedFlightData({ ...found, isMilitary: false });
    }
  }, [flights, setTrackedFlightData]);

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
          id: `sat_${sat.id} `,
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
      const pos = Cartesian3.fromDegrees(fl.lon, fl.lat, fl.altitude || 5000);
      const now = JulianDate.now();

      let sampled = flightSampledPositionsRef.current.get(fl.icao24);
      if (!sampled) {
        sampled = new SampledPositionProperty();
        sampled.forwardExtrapolationType = ExtrapolationType.HOLD;
        sampled.backwardExtrapolationType = ExtrapolationType.HOLD;
        flightSampledPositionsRef.current.set(fl.icao24, sampled);
      }
      sampled.addSample(now, pos);

      if (existing.has(fl.icao24)) {
        // Position updated via sampled property
      } else {
        const ent = v.entities.add({
          id: `flt_${fl.icao24} `,
          position: sampled,
          billboard: {
            image: PLANE_ICON,
            width: 24,
            height: 24,
            color: Color.fromCssColorString("#60a5fa"),
            rotation: CesiumMath.toRadians(fl.heading + 90),
            alignedAxis: Cartesian3.UNIT_Z,
            scaleByDistance: new NearFarScalar(1e4, 1.2, 5e6, 0.4),
          },
          label: {
            text: fl.callsign || fl.icao24,
            font: "bold 10px monospace",
            fillColor: Color.fromCssColorString("#93c5fd"),
            outlineColor: Color.BLACK,
            outlineWidth: 1,
            verticalOrigin: VerticalOrigin.TOP,
            pixelOffset: new Cartesian2(0, 15),
            scaleByDistance: new NearFarScalar(1e4, 1.0, 5e5, 0.0),
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

    for (const mil of MOCK_MILITARY) {
      if (existing.has(mil.icao24)) continue;
      const pos = Cartesian3.fromDegrees(mil.lon, mil.lat, mil.altitude);
      const ent = v.entities.add({
        id: `mil_${mil.icao24} `,
        position: pos,
        billboard: {
          image: PLANE_ICON,
          width: 24,
          height: 24,
          color: Color.fromCssColorString("#f97316"),
          rotation: CesiumMath.toRadians(mil.heading + 90),
          alignedAxis: Cartesian3.UNIT_Z,
          scaleByDistance: new NearFarScalar(1e4, 1.2, 5e6, 0.4),
        },
        label: {
          text: mil.callsign,
          font: "bold 11px monospace",
          fillColor: Color.fromCssColorString("#f97316"),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset: new Cartesian2(0, 15),
          scaleByDistance: new NearFarScalar(1e4, 1.0, 1e6, 0.0),
        } as LabelGraphics.ConstructorOptions,
      });
      existing.set(mil.icao24, ent);
    }
  }, [showMilitaryFlights]);

  // Earthquakes removed

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
        id: `cctv_${cam.id} `,
        position: Cartesian3.fromDegrees(cam.lon, cam.lat, 20),
        point: {
          pixelSize: 12,
          color: Color.fromCssColorString("#a855f7"),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        } as PointGraphics.ConstructorOptions,
        label: {
          text: `📹 ${cam.label} `,
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

    const loadAndInit = async () => {
      if (!roadsLoadedRef.current) {
        try {
          const resp = await fetch("/data/nj_roads.geojson");
          const data = await resp.json();
          roadSegments.length = 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.features.forEach((f: any) => {
            if (f.geometry.type === "LineString") {
              roadSegments.push({
                pts: f.geometry.coordinates.map((c: number[]) => [c[1], c[0]]), // lon/lat -> lat/lon
                type: f.properties.highway
              });
            }
          });
          roadsLoadedRef.current = true;
          initTrafficParticles(roadSegments);
        } catch (e) {
          console.error("Failed to load roads", e);
        }
      } else if (trafficParticles.length === 0) {
        initTrafficParticles(roadSegments);
      }

      // Create entities once
      if (existing.size === 0) {
        for (const p of trafficParticles) {
          const ent = v.entities.add({
            id: `traf_${p.id} `,
            position: Cartesian3.fromDegrees(p.lon, p.lat, 2),
            point: {
              pixelSize: 4,
              color: Color.fromCssColorString("#facc15").withAlpha(0.9),
              outlineColor: Color.fromCssColorString("#000000"),
              outlineWidth: 1,
              scaleByDistance: new NearFarScalar(100, 2.0, 8000, 0.4),
              distanceDisplayCondition: { near: 0, far: 12000 },
            } as PointGraphics.ConstructorOptions,
          });
          existing.set(p.id, ent);
        }
      }

      // Animate particles along their road paths
      if (!trafficTickRef.current) {
        trafficTickRef.current = setInterval(() => {
          const vv = viewerRef.current;
          if (!vv || vv.isDestroyed()) return;

          // Optimization: Check camera height
          const camHeight = vv.camera.positionCartographic.height;
          if (camHeight > 30000) return; // Stop updates if too high

          const camPos = vv.camera.position;

          // Compute camera view rectangle once per tick for despawn logic
          const viewRect = vv.camera.computeViewRectangle(vv.scene.globe.ellipsoid);

          for (const p of trafficParticles) {
            const pPos = Cartesian3.fromDegrees(p.lon, p.lat, 2);

            // Only update particles within 12km of camera
            const dist = Cartesian3.distance(camPos, pPos);
            if (dist > 12000) continue;

            p.t += p.speed * 4; // Move along segment

            if (p.t >= 1) {
              p.t = 0;
              // Only teleport to a new road when particle has left the camera view
              if (viewRect) {
                const carto = Cartographic.fromDegrees(p.lon, p.lat);
                if (!Rectangle.contains(viewRect, carto)) {
                  // Off-screen: find a visible road segment to respawn on
                  let found = false;
                  for (let attempt = 0; attempt < 40; attempt++) {
                    const r = roadSegments[Math.floor(Math.random() * roadSegments.length)];
                    if (r.pts.length < 2) continue;
                    const mid = r.pts[Math.floor(r.pts.length / 2)];
                    if (Rectangle.contains(viewRect, Cartographic.fromDegrees(mid[1], mid[0]))) {
                      p.segment = r.pts;
                      p.t = Math.random();
                      found = true;
                      break;
                    }
                  }
                  if (!found) {
                    // Fallback: any random road
                    p.segment = roadSegments[Math.floor(Math.random() * roadSegments.length)].pts;
                  }
                }
                // In-view: loop same segment from t=0 (already reset above)
              } else {
                // Can't compute view rect — old behaviour
                p.segment = roadSegments[Math.floor(Math.random() * roadSegments.length)].pts;
              }
            }

            // Find current and next point in segment based on t
            const segmentCount = p.segment.length - 1;
            const floatIdx = p.t * segmentCount;
            const idx = Math.floor(floatIdx);
            const subT = floatIdx - idx;

            if (idx < segmentCount) {
              const p1 = p.segment[idx];
              const p2 = p.segment[idx + 1];
              const pos = lerpPoint(p1, p2, subT);
              p.lat = pos[0];
              p.lon = pos[1];
            }

            const ent = trafficEntitiesRef.current.get(p.id);
            if (ent) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (ent.position as any)?.setValue?.(Cartesian3.fromDegrees(p.lon, p.lat, 2));
            }
          }
        }, 60);
      }
    };

    loadAndInit();

    return () => {
      if (trafficTickRef.current) { clearInterval(trafficTickRef.current); trafficTickRef.current = null; }
    };
  }, [showTraffic]);

  // Orbit mode — auto-rotate around a pivot point
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    if (!isOrbitActive) {
      if (orbitTickRef.current) { clearInterval(orbitTickRef.current); orbitTickRef.current = null; }
      if (!v.isDestroyed()) {
        v.camera.lookAtTransform(Matrix4.IDENTITY);
        v.scene.screenSpaceCameraController.enableRotate = true;
        v.scene.screenSpaceCameraController.enableTranslate = true;
        v.scene.screenSpaceCameraController.enableZoom = true;
        v.scene.screenSpaceCameraController.enableTilt = true;
      }
      return;
    }

    // Compute initial pivot from screen centre (where camera looks at the ground)
    const scrCenter = new Cartesian2(v.canvas.clientWidth / 2, v.canvas.clientHeight / 2);
    const picked = v.camera.pickEllipsoid(scrCenter, v.scene.globe.ellipsoid);
    orbitTargetRef.current = picked ?? Cartesian3.fromDegrees(-74.4057, 40.0583, 0);

    const range = Math.max(100, Cartesian3.distance(v.camera.position, orbitTargetRef.current));
    const pitch = Math.max(CesiumMath.toRadians(-85), Math.min(CesiumMath.toRadians(-5), v.camera.pitch));
    orbitStateRef.current = { heading: v.camera.heading, pitch, range };

    // Disable Cesium's built-in controls while orbiting
    v.scene.screenSpaceCameraController.enableRotate = false;
    v.scene.screenSpaceCameraController.enableTranslate = false;
    v.scene.screenSpaceCameraController.enableZoom = false;
    v.scene.screenSpaceCameraController.enableTilt = false;

    orbitTickRef.current = setInterval(() => {
      if (!v || v.isDestroyed()) return;
      const s = orbitStateRef.current;
      s.heading += CesiumMath.toRadians(0.25); // ~23 s / revolution
      v.camera.lookAt(orbitTargetRef.current, new HeadingPitchRange(s.heading, s.pitch, s.range));
    }, 16);

    // Scroll wheel → zoom (change orbit radius)
    const onWheel = (e: WheelEvent) => {
      orbitStateRef.current.range = Math.max(50, orbitStateRef.current.range * (e.deltaY > 0 ? 1.12 : 0.89));
      e.preventDefault();
    };
    v.canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      if (orbitTickRef.current) { clearInterval(orbitTickRef.current); orbitTickRef.current = null; }
      v.canvas.removeEventListener("wheel", onWheel);
      if (!v.isDestroyed()) {
        v.camera.lookAtTransform(Matrix4.IDENTITY);
        v.scene.screenSpaceCameraController.enableRotate = true;
        v.scene.screenSpaceCameraController.enableTranslate = true;
        v.scene.screenSpaceCameraController.enableZoom = true;
        v.scene.screenSpaceCameraController.enableTilt = true;
      }
    };
  }, [isOrbitActive]);

  // Drone Flythrough — WASD + mouse free-fly
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    if (!isFlythroughActive) {
      v.camera.cancelFlight?.();
      flythroughCleanupRef.current?.();
      flythroughCleanupRef.current = null;
      if (!v.isDestroyed()) {
        v.scene.screenSpaceCameraController.enableRotate = true;
        v.scene.screenSpaceCameraController.enableTranslate = true;
        v.scene.screenSpaceCameraController.enableZoom = true;
        v.scene.screenSpaceCameraController.enableTilt = true;
      }
      return;
    }

    // Disable Cesium's built-in controls — WASD takes over
    v.scene.screenSpaceCameraController.enableRotate = false;
    v.scene.screenSpaceCameraController.enableTranslate = false;
    v.scene.screenSpaceCameraController.enableZoom = false;
    v.scene.screenSpaceCameraController.enableTilt = false;

    v.camera.flyTo({
      destination: Cartesian3.fromDegrees(-74.4500, 40.4800, 350),
      orientation: { heading: CesiumMath.toRadians(320), pitch: CesiumMath.toRadians(-15), roll: 0 },
      duration: 2,
      complete: () => {
        if (!useMapStore.getState().isFlythroughActive || v.isDestroyed()) return;

        const keysHeld = new Set<string>();
        const mouseAccum = { dx: 0, dy: 0 };
        let pointerLocked = false;

        const onKeyDown = (e: KeyboardEvent) => { keysHeld.add(e.key.toLowerCase()); };
        const onKeyUp = (e: KeyboardEvent) => { keysHeld.delete(e.key.toLowerCase()); };
        // capture=true so WASD fires before bubble-phase POI handler
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("keyup", onKeyUp, true);

        const canvas = v.canvas;
        const onPLChange = () => { pointerLocked = document.pointerLockElement === canvas; };
        document.addEventListener("pointerlockchange", onPLChange);

        const onMouseMove = (e: MouseEvent) => {
          if (!pointerLocked) return;
          mouseAccum.dx += e.movementX;
          mouseAccum.dy += e.movementY;
        };
        document.addEventListener("mousemove", onMouseMove);

        // Click canvas to capture pointer lock
        const onCanvasClick = () => { if (!pointerLocked) canvas.requestPointerLock(); };
        canvas.addEventListener("click", onCanvasClick);

        const LOOK_SENS = 0.003;
        const ROLL_SENS = 0.02;
        const SPEED_NORMAL = 3;  // m/frame
        const SPEED_FAST = 15;   // m/frame with Shift

        const tick = () => {
          if (!useMapStore.getState().isFlythroughActive || v.isDestroyed()) {
            v.clock.onTick.removeEventListener(tick);
            return;
          }
          const speed = keysHeld.has("shift") ? SPEED_FAST : SPEED_NORMAL;
          if (keysHeld.has("w")) v.camera.moveForward(speed);
          if (keysHeld.has("s")) v.camera.moveBackward(speed);
          if (keysHeld.has("a")) v.camera.moveLeft(speed);
          if (keysHeld.has("d")) v.camera.moveRight(speed);
          if (keysHeld.has(" ")) v.camera.moveUp(speed);
          if (keysHeld.has("c")) v.camera.moveDown(speed);
          if (keysHeld.has("q")) v.camera.twistLeft(ROLL_SENS);
          if (keysHeld.has("e")) v.camera.twistRight(ROLL_SENS);

          if (mouseAccum.dx !== 0 || mouseAccum.dy !== 0) {
            v.camera.lookRight(mouseAccum.dx * LOOK_SENS);
            v.camera.lookUp(-mouseAccum.dy * LOOK_SENS);
            mouseAccum.dx = 0;
            mouseAccum.dy = 0;
          }
        };
        v.clock.onTick.addEventListener(tick);

        flythroughCleanupRef.current = () => {
          v.clock.onTick.removeEventListener(tick);
          window.removeEventListener("keydown", onKeyDown, true);
          window.removeEventListener("keyup", onKeyUp, true);
          document.removeEventListener("pointerlockchange", onPLChange);
          document.removeEventListener("mousemove", onMouseMove);
          canvas.removeEventListener("click", onCanvasClick);
          if (document.exitPointerLock) document.exitPointerLock();
        };
      },
    });

    return () => {
      v.camera.cancelFlight?.();
      flythroughCleanupRef.current?.();
      flythroughCleanupRef.current = null;
      if (!v.isDestroyed()) {
        v.scene.screenSpaceCameraController.enableRotate = true;
        v.scene.screenSpaceCameraController.enableTranslate = true;
        v.scene.screenSpaceCameraController.enableZoom = true;
        v.scene.screenSpaceCameraController.enableTilt = true;
      }
    };
  }, [isFlythroughActive]);

  // View presets — drive camera when preset changes
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || isFlythroughActive) return;

    // Stop any active flythrough tick listeners first
    if (viewPreset === "panoptic") {
      // Dead overhead — straight down over NJ centroid
      v.camera.flyTo({
        destination: Cartesian3.fromDegrees(-74.4057, 40.0583, 280000),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-90),
          roll: 0,
        },
        duration: 2.5,
      });
    } else if (viewPreset === "tactical") {
      // Low angled recon look — NW NJ at 15° pitch
      v.camera.flyTo({
        destination: Cartesian3.fromDegrees(-74.7, 40.5, 35000),
        orientation: {
          heading: CesiumMath.toRadians(135),
          pitch: CesiumMath.toRadians(-20),
          roll: 0,
        },
        duration: 2.5,
      });
    } else {
      // Default — back to NJ state overview
      v.camera.flyTo({
        destination: NJ_DESTINATION,
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-45),
          roll: 0,
        },
        duration: 1.5,
      });
    }
  }, [viewPreset, isFlythroughActive]);

  // Municipality overlay
  const { entityMapRef: munEntityMapRef } = useMunicipalities({
    viewer: viewerRef.current,
    show: showMunicipalities,
    selectedMunGeoid: selectedMunicipalityProps?.mun_geoid ?? null,
  });

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
      // Orbit mode: left-click repositions the pivot
      if (useMapStore.getState().isOrbitActive) {
        const pos = v.scene.pickPosition(e.position)
          ?? v.camera.pickEllipsoid(e.position, v.scene.globe.ellipsoid);
        if (pos) {
          orbitTargetRef.current = pos;
          orbitStateRef.current.range = Math.max(50, Cartesian3.distance(v.camera.position, pos));
        }
        return;
      }

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
        const found = flightsRef.current.find((f) => f.icao24 === icao);
        if (found) setTrackedFlightData({ ...found, isMilitary: false });
        return;
      }
      // Military flight click
      if (typeof id === "string" && id.startsWith("mil_")) {
        const icao = id.replace("mil_", "");
        const mil = MOCK_MILITARY.find((m) => m.icao24 === icao);
        if (mil) {
          setTrackedFlightData({
            icao24: mil.icao24, callsign: mil.callsign,
            altitude: mil.altitude, velocity: mil.velocity,
            heading: mil.heading, onGround: false, isMilitary: true,
          });
        }
        return;
      }

      if (!entity._featureData) return;
      const data = entity._featureData;

      // Municipality click — show sidebar, don't change navigation level
      if (data.mun_geoid && munEntityMapRef.current.has(data.mun_geoid as string)) {
        setSelectedMunicipality(data as unknown as MunicipalityProperties);
        return;
      }

      // County / tract navigation
      if (viewLevel === "state" && data.county_fips && !data.GEOID) {
        navigateToCounty(data.county_fips as string, (data.NAME as string) ?? data.county_fips as string);
      } else if (viewLevel === "county" && data.GEOID) {
        navigateToTract(data.GEOID as string, data as unknown as TractProperties);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
      handlerRef.current = null;
    };
  }, [viewLevel, navigateToState, navigateToCounty, navigateToTract, navigateToBuilding, setTrackedSatelliteId, setTrackedFlightIcao, setTrackedFlightData, setSelectedMunicipality]);

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
      {/* Orbit mode HUD */}
      {isOrbitActive && (
        <div style={{
          position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)",
          background: "rgba(148,210,189,0.08)", border: "1px solid rgba(148,210,189,0.3)",
          borderRadius: 6, padding: "4px 14px", fontFamily: "monospace", fontSize: 11,
          color: "#94d2bd", pointerEvents: "none", letterSpacing: "0.08em",
          display: "flex", gap: 14, alignItems: "center",
        }}>
          <span>⟳ ORBIT MODE</span>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: "#64748b" }}>Click ground = new pivot</span>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: "#64748b" }}>Scroll = zoom</span>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: "#64748b" }}>ESC to exit</span>
        </div>
      )}
      {/* Flythrough WASD HUD */}
      {isFlythroughActive && (
        <div style={{
          position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)",
          background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.3)",
          borderRadius: 6, padding: "4px 14px", fontFamily: "monospace", fontSize: 11,
          color: "#818cf8", pointerEvents: "none", letterSpacing: "0.08em",
          display: "flex", gap: 14, alignItems: "center",
        }}>
          <span>🚁 DRONE CAM</span>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: "#64748b" }}>Click map = capture mouse</span>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: "#64748b" }}>WASD = move · Q/E = roll · Space/C = up/down · Shift = fast</span>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: "#64748b" }}>ESC = exit</span>
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
@keyframes poi - fade {
  0 % { opacity: 0; transform: translate(-50 %, -50 %) scale(1.5); }
  15 % { opacity: 1; transform: translate(-50 %, -50 %) scale(1); }
  70 % { opacity: 1; }
  100 % { opacity: 0; }
}
`}</style>
    </>
  );
}

