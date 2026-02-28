import { create } from "zustand";
import type { VariableKey } from "../types/variables";
import type { ViewLevel } from "../types/navigation";
import type { TractProperties } from "../types/tract";
import type { BuildingProperties } from "../types/building";
import type { MunicipalityProperties } from "../types/municipality";

export type VisualMode = "default" | "crt" | "nightvision" | "flir" | "noir" | "anime" | "highcontrast";
export type SkyMode = "sunny" | "cloudy" | "dusk" | "night";

export interface TrackedFlightInfo {
  icao24: string;
  callsign: string;
  altitude: number;  // meters
  velocity: number;  // m/s
  heading: number;   // degrees
  onGround: boolean;
  isMilitary: boolean;
}

export interface WeatherData {
  temp: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  precipitation: number; // mm
  condition: string;
}

interface MapStore {
  // --- Navigation ---
  viewLevel: ViewLevel;
  selectedCountyFips: string | null;
  selectedCountyName: string | null;
  selectedTractId: string | null;
  selectedTractProps: TractProperties | null;
  selectedBuildingProps: BuildingProperties | null;

  navigateToState: () => void;
  navigateToCounty: (fips: string, name: string) => void;
  navigateToTract: (geoid: string, props?: TractProperties) => void;
  navigateToBuilding: (props?: BuildingProperties) => void;

  // --- Variable selection ---
  activeVariable: VariableKey;
  setActiveVariable: (v: VariableKey) => void;

  // --- Municipality inspect + choropleth ---
  selectedMunicipalityProps: MunicipalityProperties | null;
  setSelectedMunicipality: (props: MunicipalityProperties | null) => void;

  showMunicipalities: boolean;
  toggleMunicipalities: () => void;

  munChoroplethVar: string | null;
  setMunChoroplethVar: (v: string | null) => void;

  // --- Traffic simulation settings ---
  trafficSpeedMult: number;       // 0.25 – 4.0
  setTrafficSpeedMult: (v: number) => void;
  trafficDensityMult: number;     // 0.25 – 3.0
  setTrafficDensityMult: (v: number) => void;
  trafficShowSecondary: boolean;
  toggleTrafficShowSecondary: () => void;
  trafficMaxDistance: number;     // km, 3 – 20
  setTrafficMaxDistance: (v: number) => void;
  trafficParticleSize: number;    // px, 2 – 10
  setTrafficParticleSize: (v: number) => void;

  // --- Layer toggles ---
  showBuildings: boolean;
  toggleBuildings: () => void;

  showTracts: boolean;
  toggleTracts: () => void;

  showSatellites: boolean;
  toggleSatellites: () => void;

  showFlights: boolean;
  toggleFlights: () => void;

  showMilitaryFlights: boolean;
  toggleMilitaryFlights: () => void;

  showTraffic: boolean;
  toggleTraffic: () => void;

  showCCTV: boolean;
  toggleCCTV: () => void;

  // --- Infrastructure: Electric Grid ---
  showElectricUtilities: boolean;
  toggleElectricUtilities: () => void;
  showPowerPlants: boolean;
  togglePowerPlants: () => void;
  showSolarGrid: boolean;
  toggleSolarGrid: () => void;

  // --- Infrastructure: Water & Sewage ---
  showSewerAreas: boolean;
  toggleSewerAreas: () => void;
  showPurveyorAreas: boolean;
  togglePurveyorAreas: () => void;

  // --- Climate & Energy ---
  showAfvStations: boolean;
  toggleAfvStations: () => void;
  showCommunitySolar: boolean;
  toggleCommunitySolar: () => void;
  showRggiInvestments: boolean;
  toggleRggiInvestments: () => void;

  // --- FEMA Flood Zones ---
  showFloodZones: boolean;
  toggleFloodZones: () => void;

  // --- NJTransit ---
  showTransitRoutes: boolean;
  toggleTransitRoutes: () => void;
  showTransitStops: boolean;
  toggleTransitStops: () => void;

  // --- EV Charging Stations (NREL) ---
  showEvStations: boolean;
  toggleEvStations: () => void;

  // --- Business pins ---
  showBusinesses: boolean;
  toggleBusinesses: () => void;
  selectedBusiness: { name: string; type: string; category: string; lat: number; lon: number } | null;
  setSelectedBusiness: (b: { name: string; type: string; category: string; lat: number; lon: number } | null) => void;

  showBusinessList: boolean;
  toggleBusinessList: () => void;

  // --- Fly-to request (set by SearchBar / BusinessList, consumed by CesiumMap) ---
  flyToRequest: { lat: number; lon: number; alt: number; label: string } | null;
  setFlyToRequest: (req: { lat: number; lon: number; alt: number; label: string } | null) => void;

  // --- Detection mode ---
  detectionMode: "sparse" | "full";
  setDetectionMode: (m: "sparse" | "full") => void;

  // --- Tracked entity ---
  trackedSatelliteId: string | null;
  setTrackedSatelliteId: (id: string | null) => void;

  trackedFlightIcao: string | null;
  setTrackedFlightIcao: (id: string | null) => void;

  trackedFlightData: TrackedFlightInfo | null;
  setTrackedFlightData: (f: TrackedFlightInfo | null) => void;

  // --- Visual Modes ---
  visualMode: VisualMode;
  setVisualMode: (mode: VisualMode) => void;
  visualIntensity: number;    // 0..1
  setVisualIntensity: (v: number) => void;
  visualNoise: number;        // 0..1
  setVisualNoise: (v: number) => void;

  // --- Sky Mode ---
  skyMode: SkyMode;
  setSkyMode: (mode: SkyMode) => void;

  // --- Weather ---
  weatherData: WeatherData | null;
  setWeatherData: (data: WeatherData | null) => void;
  showWeatherOverlay: boolean;
  weatherOverlayMode: "temperature" | "wind" | "clouds";
  setWeatherOverlayMode: (m: "temperature" | "wind" | "clouds") => void;
  toggleWeatherOverlay: () => void;

  // --- Flythrough ---
  isFlythroughActive: boolean;
  toggleFlythrough: () => void;

  // --- Orbit mode ---
  isOrbitActive: boolean;
  toggleOrbit: () => void;

  // --- View Presets ---
  viewPreset: "default" | "panoptic" | "tactical";
  setViewPreset: (p: "default" | "panoptic" | "tactical") => void;

  // Future seam for Rust ABM — add simulation state here
  simulationRunning: boolean;
  agentCount: number;
  tick: number;

  startSimulation: () => void;
  stopSimulation: () => void;
  updateSimulation: (agents: number, tick: number) => void;
}

export const useMapStore = create<MapStore>((set) => ({
  viewLevel: "state",
  selectedCountyFips: null,
  selectedCountyName: null,
  selectedTractId: null,
  selectedTractProps: null,
  selectedBuildingProps: null,

  navigateToState: () =>
    set({
      viewLevel: "state",
      selectedCountyFips: null,
      selectedCountyName: null,
      selectedTractId: null,
      selectedTractProps: null,
      selectedBuildingProps: null,
    }),

  navigateToCounty: (fips, name) =>
    set({
      viewLevel: "county",
      selectedCountyFips: fips,
      selectedCountyName: name,
      selectedTractId: null,
      selectedTractProps: null,
      selectedBuildingProps: null,
    }),

  navigateToTract: (geoid, props) =>
    set({
      viewLevel: "tract",
      selectedTractId: geoid,
      selectedTractProps: props ?? null,
      selectedBuildingProps: null,
    }),

  navigateToBuilding: (props) =>
    set({ viewLevel: "building", selectedBuildingProps: props ?? null }),

  activeVariable: "median_income",
  setActiveVariable: (v) => set({ activeVariable: v }),

  selectedMunicipalityProps: null,
  setSelectedMunicipality: (props) => set({ selectedMunicipalityProps: props }),

  showMunicipalities: true,
  toggleMunicipalities: () => set((s) => ({ showMunicipalities: !s.showMunicipalities })),

  munChoroplethVar: null,
  setMunChoroplethVar: (v) => set({ munChoroplethVar: v }),

  trafficSpeedMult: 1.0,
  setTrafficSpeedMult: (v) => set({ trafficSpeedMult: v }),
  trafficDensityMult: 1.0,
  setTrafficDensityMult: (v) => set({ trafficDensityMult: v }),
  trafficShowSecondary: true,
  toggleTrafficShowSecondary: () => set((s) => ({ trafficShowSecondary: !s.trafficShowSecondary })),
  trafficMaxDistance: 12,
  setTrafficMaxDistance: (v) => set({ trafficMaxDistance: v }),
  trafficParticleSize: 4,
  setTrafficParticleSize: (v) => set({ trafficParticleSize: v }),

  showBuildings: true,
  toggleBuildings: () => set((s) => ({ showBuildings: !s.showBuildings })),

  showTracts: true,
  toggleTracts: () => set((s) => ({ showTracts: !s.showTracts })),

  showSatellites: false,
  toggleSatellites: () => set((s) => ({ showSatellites: !s.showSatellites })),

  showFlights: true,
  toggleFlights: () => set((s) => ({ showFlights: !s.showFlights })),

  showMilitaryFlights: true,
  toggleMilitaryFlights: () => set((s) => ({ showMilitaryFlights: !s.showMilitaryFlights })),

  showTraffic: false,
  toggleTraffic: () => set((s) => ({ showTraffic: !s.showTraffic })),

  showCCTV: false,
  toggleCCTV: () => set((s) => ({ showCCTV: !s.showCCTV })),

  showElectricUtilities: false,
  toggleElectricUtilities: () => set((s) => ({ showElectricUtilities: !s.showElectricUtilities })),
  showPowerPlants: false,
  togglePowerPlants: () => set((s) => ({ showPowerPlants: !s.showPowerPlants })),
  showSolarGrid: false,
  toggleSolarGrid: () => set((s) => ({ showSolarGrid: !s.showSolarGrid })),

  showSewerAreas: false,
  toggleSewerAreas: () => set((s) => ({ showSewerAreas: !s.showSewerAreas })),
  showPurveyorAreas: false,
  togglePurveyorAreas: () => set((s) => ({ showPurveyorAreas: !s.showPurveyorAreas })),

  showAfvStations: false,
  toggleAfvStations: () => set((s) => ({ showAfvStations: !s.showAfvStations })),
  showCommunitySolar: false,
  toggleCommunitySolar: () => set((s) => ({ showCommunitySolar: !s.showCommunitySolar })),
  showRggiInvestments: false,
  toggleRggiInvestments: () => set((s) => ({ showRggiInvestments: !s.showRggiInvestments })),

  showFloodZones: false,
  toggleFloodZones: () => set((s) => ({ showFloodZones: !s.showFloodZones })),

  showTransitRoutes: false,
  toggleTransitRoutes: () => set((s) => ({ showTransitRoutes: !s.showTransitRoutes })),
  showTransitStops: false,
  toggleTransitStops: () => set((s) => ({ showTransitStops: !s.showTransitStops })),

  showEvStations: false,
  toggleEvStations: () => set((s) => ({ showEvStations: !s.showEvStations })),

  showBusinesses: false,
  toggleBusinesses: () => set((s) => ({ showBusinesses: !s.showBusinesses })),
  selectedBusiness: null,
  setSelectedBusiness: (b) => set({ selectedBusiness: b }),

  showBusinessList: false,
  toggleBusinessList: () => set((s) => ({ showBusinessList: !s.showBusinessList })),

  flyToRequest: null,
  setFlyToRequest: (req) => set({ flyToRequest: req }),

  detectionMode: "sparse",
  setDetectionMode: (m) => set({ detectionMode: m }),

  trackedSatelliteId: null,
  setTrackedSatelliteId: (id) => set({ trackedSatelliteId: id }),

  trackedFlightIcao: null,
  setTrackedFlightIcao: (id) => set({ trackedFlightIcao: id }),

  trackedFlightData: null,
  setTrackedFlightData: (f) => set({ trackedFlightData: f }),

  visualMode: "default",
  setVisualMode: (mode) => set({ visualMode: mode }),
  visualIntensity: 0.5,
  setVisualIntensity: (v) => set({ visualIntensity: v }),
  visualNoise: 0.15,
  setVisualNoise: (v) => set({ visualNoise: v }),

  skyMode: "sunny",
  setSkyMode: (mode) => set({ skyMode: mode }),

  weatherData: null,
  setWeatherData: (data) => set({ weatherData: data }),
  showWeatherOverlay: false,
  weatherOverlayMode: "temperature",
  setWeatherOverlayMode: (m) => set({ weatherOverlayMode: m }),
  toggleWeatherOverlay: () => set((s) => ({ showWeatherOverlay: !s.showWeatherOverlay })),

  isFlythroughActive: false,
  toggleFlythrough: () => set((s) => ({ isFlythroughActive: !s.isFlythroughActive, isOrbitActive: false })),

  isOrbitActive: false,
  toggleOrbit: () => set((s) => ({ isOrbitActive: !s.isOrbitActive, isFlythroughActive: false })),

  viewPreset: "default",
  setViewPreset: (p) => set({ viewPreset: p }),

  simulationRunning: false,
  agentCount: 0,
  tick: 0,

  startSimulation: () => set({ simulationRunning: true, tick: 0, agentCount: Math.floor(Math.random() * 50) + 10 }),
  stopSimulation: () => set({ simulationRunning: false, tick: 0, agentCount: 0 }),
  updateSimulation: (agents, tick) => set({ agentCount: agents, tick: tick }),
}));


