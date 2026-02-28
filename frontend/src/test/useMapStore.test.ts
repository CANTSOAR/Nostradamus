import { describe, it, expect, beforeEach } from "vitest";
import { useMapStore } from "../store/useMapStore";

// Reset store state before each test
beforeEach(() => {
  useMapStore.setState({
    viewLevel: "state",
    selectedCountyFips: null,
    selectedCountyName: null,
    selectedTractId: null,
    selectedTractProps: null,
    activeVariable: "median_income",
    showBuildings: true,
    showTracts: true,
  });
});

describe("useMapStore — navigation", () => {
  it("starts at state level with all selections null", () => {
    const s = useMapStore.getState();
    expect(s.viewLevel).toBe("state");
    expect(s.selectedCountyFips).toBeNull();
    expect(s.selectedCountyName).toBeNull();
    expect(s.selectedTractId).toBeNull();
    expect(s.selectedTractProps).toBeNull();
  });

  it("navigateToCounty sets county fips, name, and view level", () => {
    useMapStore.getState().navigateToCounty("003", "Bergen");
    const s = useMapStore.getState();
    expect(s.viewLevel).toBe("county");
    expect(s.selectedCountyFips).toBe("003");
    expect(s.selectedCountyName).toBe("Bergen");
    expect(s.selectedTractId).toBeNull();
  });

  it("navigateToTract sets tract id, props, and view level", () => {
    const fakeProps = {
      GEOID: "34003040200",
      median_income: 80000,
      poverty_rate: 0.1,
      unemployment_rate: 0.05,
      poverty_count: null,
      population: 5000,
      unemployed: null,
      county_employment: 200000,
      county_fips: "003",
    };
    useMapStore.getState().navigateToCounty("003", "Bergen");
    useMapStore.getState().navigateToTract("34003040200", fakeProps);
    const s = useMapStore.getState();
    expect(s.viewLevel).toBe("tract");
    expect(s.selectedTractId).toBe("34003040200");
    expect(s.selectedTractProps?.median_income).toBe(80000);
    // County info preserved
    expect(s.selectedCountyFips).toBe("003");
  });

  it("navigateToTract without props stores null props", () => {
    useMapStore.getState().navigateToTract("34003040200");
    const s = useMapStore.getState();
    expect(s.viewLevel).toBe("tract");
    expect(s.selectedTractProps).toBeNull();
  });

  it("navigateToBuilding advances to building level", () => {
    useMapStore.getState().navigateToCounty("003", "Bergen");
    useMapStore.getState().navigateToTract("34003040200");
    useMapStore.getState().navigateToBuilding();
    expect(useMapStore.getState().viewLevel).toBe("building");
    // Preserves tract selection
    expect(useMapStore.getState().selectedTractId).toBe("34003040200");
  });

  it("navigateToState resets all selections", () => {
    useMapStore.getState().navigateToCounty("003", "Bergen");
    useMapStore.getState().navigateToTract("34003040200");
    useMapStore.getState().navigateToBuilding();
    useMapStore.getState().navigateToState();
    const s = useMapStore.getState();
    expect(s.viewLevel).toBe("state");
    expect(s.selectedCountyFips).toBeNull();
    expect(s.selectedCountyName).toBeNull();
    expect(s.selectedTractId).toBeNull();
    expect(s.selectedTractProps).toBeNull();
  });
});

describe("useMapStore — variables", () => {
  it("setActiveVariable updates activeVariable", () => {
    useMapStore.getState().setActiveVariable("poverty_rate");
    expect(useMapStore.getState().activeVariable).toBe("poverty_rate");
  });
});

describe("useMapStore — layer toggles", () => {
  it("toggleBuildings flips showBuildings", () => {
    expect(useMapStore.getState().showBuildings).toBe(true);
    useMapStore.getState().toggleBuildings();
    expect(useMapStore.getState().showBuildings).toBe(false);
    useMapStore.getState().toggleBuildings();
    expect(useMapStore.getState().showBuildings).toBe(true);
  });

  it("toggleTracts flips showTracts", () => {
    expect(useMapStore.getState().showTracts).toBe(true);
    useMapStore.getState().toggleTracts();
    expect(useMapStore.getState().showTracts).toBe(false);
  });
});
