import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavigationBreadcrumb } from "../components/NavigationBreadcrumb";
import { useMapStore } from "../store/useMapStore";

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

describe("NavigationBreadcrumb", () => {
  it("shows only 'New Jersey' at state level", () => {
    render(<NavigationBreadcrumb />);
    expect(screen.getByText("New Jersey")).toBeInTheDocument();
    expect(screen.queryByText(/County/)).toBeNull();
    expect(screen.queryByText(/Tract/)).toBeNull();
  });

  it("shows state + county at county level", () => {
    useMapStore.setState({
      viewLevel: "county",
      selectedCountyFips: "003",
      selectedCountyName: "Bergen",
    });
    render(<NavigationBreadcrumb />);
    expect(screen.getByText("New Jersey")).toBeInTheDocument();
    expect(screen.getByText("Bergen County")).toBeInTheDocument();
    expect(screen.queryByText(/Tract/)).toBeNull();
  });

  it("shows full path at tract level", () => {
    useMapStore.setState({
      viewLevel: "tract",
      selectedCountyFips: "003",
      selectedCountyName: "Bergen",
      selectedTractId: "34003040200",
    });
    render(<NavigationBreadcrumb />);
    expect(screen.getByText("New Jersey")).toBeInTheDocument();
    expect(screen.getByText("Bergen County")).toBeInTheDocument();
    expect(screen.getByText("Tract 34003040200")).toBeInTheDocument();
  });

  it("shows full path at building level", () => {
    useMapStore.setState({
      viewLevel: "building",
      selectedCountyFips: "003",
      selectedCountyName: "Bergen",
      selectedTractId: "34003040200",
    });
    render(<NavigationBreadcrumb />);
    expect(screen.getByText("New Jersey")).toBeInTheDocument();
    expect(screen.getByText("Bergen County")).toBeInTheDocument();
    expect(screen.getByText("Tract 34003040200")).toBeInTheDocument();
    expect(screen.getByText("Building")).toBeInTheDocument();
  });

  it("clicking 'New Jersey' navigates to state", () => {
    useMapStore.setState({
      viewLevel: "county",
      selectedCountyFips: "003",
      selectedCountyName: "Bergen",
    });
    render(<NavigationBreadcrumb />);
    fireEvent.click(screen.getByText("New Jersey"));
    expect(useMapStore.getState().viewLevel).toBe("state");
    expect(useMapStore.getState().selectedCountyFips).toBeNull();
  });

  it("clicking county crumb navigates back to county", () => {
    useMapStore.setState({
      viewLevel: "tract",
      selectedCountyFips: "003",
      selectedCountyName: "Bergen",
      selectedTractId: "34003040200",
    });
    render(<NavigationBreadcrumb />);
    fireEvent.click(screen.getByText("Bergen County"));
    expect(useMapStore.getState().viewLevel).toBe("county");
    expect(useMapStore.getState().selectedTractId).toBeNull();
  });

  it("clicking tract crumb navigates back to tract from building", () => {
    useMapStore.setState({
      viewLevel: "building",
      selectedCountyFips: "003",
      selectedCountyName: "Bergen",
      selectedTractId: "34003040200",
    });
    render(<NavigationBreadcrumb />);
    fireEvent.click(screen.getByText("Tract 34003040200"));
    expect(useMapStore.getState().viewLevel).toBe("tract");
  });

  it("last crumb is disabled (not clickable)", () => {
    useMapStore.setState({
      viewLevel: "county",
      selectedCountyFips: "003",
      selectedCountyName: "Bergen",
    });
    render(<NavigationBreadcrumb />);
    const bergenBtn = screen.getByText("Bergen County").closest("button");
    expect(bergenBtn).toBeDisabled();
  });

  it("non-last crumbs are enabled", () => {
    useMapStore.setState({
      viewLevel: "county",
      selectedCountyFips: "003",
      selectedCountyName: "Bergen",
    });
    render(<NavigationBreadcrumb />);
    const njBtn = screen.getByText("New Jersey").closest("button");
    expect(njBtn).not.toBeDisabled();
  });
});
