import { create } from "zustand";
import type { VariableKey } from "../types/variables";

interface MapStore {
  activeVariable: VariableKey;
  setActiveVariable: (v: VariableKey) => void;

  selectedTractId: string | null;
  setSelectedTract: (geoid: string | null) => void;

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
  activeVariable: "median_income",
  setActiveVariable: (v) => set({ activeVariable: v }),

  selectedTractId: null,
  setSelectedTract: (geoid) => set({ selectedTractId: geoid }),

  showBuildings: true,
  toggleBuildings: () => set((s) => ({ showBuildings: !s.showBuildings })),

  showTracts: true,
  toggleTracts: () => set((s) => ({ showTracts: !s.showTracts })),
}));
