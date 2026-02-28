import { create } from "zustand";
import type { VariableKey } from "../types/variables";
import type { ViewLevel } from "../types/navigation";
import type { TractProperties } from "../types/tract";
import type { BuildingProperties } from "../types/building";

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
}));
