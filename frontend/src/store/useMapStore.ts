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

  // --- Municipality inspect ---
  selectedMunicipalityProps: MunicipalityProperties | null;
  setSelectedMunicipality: (props: MunicipalityProperties | null) => void;

  showMunicipalities: boolean;
  toggleMunicipalities: () => void;

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
  // simulationRunning: boolean;
  // agentCount: number;
  // tick: number;
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

  isFlythroughActive: false,
  toggleFlythrough: () => set((s) => ({ isFlythroughActive: !s.isFlythroughActive, isOrbitActive: false })),

  isOrbitActive: false,
  toggleOrbit: () => set((s) => ({ isOrbitActive: !s.isOrbitActive, isFlythroughActive: false })),

  viewPreset: "default",
  setViewPreset: (p) => set({ viewPreset: p }),
}));


