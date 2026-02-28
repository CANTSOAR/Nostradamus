import { create } from "zustand";
import type { VariableKey } from "../types/variables";
import type { ViewLevel } from "../types/navigation";
import type { TractProperties } from "../types/tract";
import type { BuildingProperties } from "../types/building";

export type VisualMode = "default" | "crt" | "nightvision" | "flir" | "noir" | "anime" | "highcontrast";

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

  showEarthquakes: boolean;
  toggleEarthquakes: () => void;

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

  // --- Visual Modes ---
  visualMode: VisualMode;
  setVisualMode: (mode: VisualMode) => void;
  visualIntensity: number;    // 0..1
  setVisualIntensity: (v: number) => void;
  visualNoise: number;        // 0..1
  setVisualNoise: (v: number) => void;

  // --- Flythrough ---
  isFlythroughActive: boolean;
  toggleFlythrough: () => void;

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

  showBuildings: true,
  toggleBuildings: () => set((s) => ({ showBuildings: !s.showBuildings })),

  showTracts: true,
  toggleTracts: () => set((s) => ({ showTracts: !s.showTracts })),

  showSatellites: false,
  toggleSatellites: () => set((s) => ({ showSatellites: !s.showSatellites })),

  showFlights: false,
  toggleFlights: () => set((s) => ({ showFlights: !s.showFlights })),

  showMilitaryFlights: false,
  toggleMilitaryFlights: () => set((s) => ({ showMilitaryFlights: !s.showMilitaryFlights })),

  showTraffic: false,
  toggleTraffic: () => set((s) => ({ showTraffic: !s.showTraffic })),

  showEarthquakes: false,
  toggleEarthquakes: () => set((s) => ({ showEarthquakes: !s.showEarthquakes })),

  showCCTV: false,
  toggleCCTV: () => set((s) => ({ showCCTV: !s.showCCTV })),

  detectionMode: "sparse",
  setDetectionMode: (m) => set({ detectionMode: m }),

  trackedSatelliteId: null,
  setTrackedSatelliteId: (id) => set({ trackedSatelliteId: id }),

  trackedFlightIcao: null,
  setTrackedFlightIcao: (id) => set({ trackedFlightIcao: id }),

  visualMode: "default",
  setVisualMode: (mode) => set({ visualMode: mode }),
  visualIntensity: 0.5,
  setVisualIntensity: (v) => set({ visualIntensity: v }),
  visualNoise: 0.15,
  setVisualNoise: (v) => set({ visualNoise: v }),

  isFlythroughActive: false,
  toggleFlythrough: () => set((s) => ({ isFlythroughActive: !s.isFlythroughActive })),
}));

