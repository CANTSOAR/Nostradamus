import React, { useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import { CesiumMap } from "../components/CesiumMap";
import { VariableSelector } from "../components/VariableSelector";
import { TractSidebar } from "../components/TractSidebar";
import { LayerControl } from "../components/LayerControl";
import { Legend } from "../components/Legend";
import { NavigationBreadcrumb } from "../components/NavigationBreadcrumb";
import { VisualModeSelector } from "../components/VisualModeSelector";
import { ViewSelector } from "../components/ViewSelector";
import { FlightInfoPanel } from "../components/FlightInfoPanel";
import { MunicipalitySidebar } from "../components/MunicipalitySidebar";
import { SkyModeSelector } from "../components/SkyModeSelector";
import { useSimulation } from "../hooks/useSimulation";
import { SimulationLayer } from "../components/SimulationLayer";
import { BusinessInfoPanel } from "../components/BusinessInfoPanel";
import { BusinessListPanel } from "../components/BusinessListPanel";
import { BusinessesInFrame } from "../components/BusinessesInFrame";
import { PropertySidebar } from "../components/PropertySidebar";
import { Layers, Map as MapIcon, Eye, SlidersHorizontal, Plane, Building, Target } from "lucide-react";
import { SearchBar } from "../components/SearchBar";
import { MinimizablePanel } from "../components/ui/MinimizablePanel";
import Draggable from "react-draggable";

const panelStyle: React.CSSProperties = {
  background: "rgba(15, 20, 30, 0.7)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#e2e8f0",
  fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
};

export default function App() {
  const { activeVariable, viewLevel, selectedTractId, trackedFlightData, selectedMunicipalityProps, showBusinesses, selectedBusiness, showBusinessList } = useMapStore();
  useSimulation();

  // Refs for Draggable to avoid findDOMNode
  const searchBarRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const visualsRef = useRef<HTMLDivElement>(null);
  const buildingSimRef = useRef<HTMLDivElement>(null);
  const tractDataRef = useRef<HTMLDivElement>(null);
  const layerControlRef = useRef<HTMLDivElement>(null);


  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#020408" }}>
      {/* Globe fills entire viewport */}
      <CesiumMap />
      <SimulationLayer />

      {/* Panoptic HUD Overlays removed */}

      {/* Top-left: Unified Header (Title + Breadcrumb + Search) */}
      <Draggable nodeRef={searchBarRef} handle=".drag-handle" bounds="parent">
        <div
          ref={searchBarRef}
          style={{
            ...panelStyle,
            position: "absolute",
            top: 16,
            left: 16,
            padding: "12px 16px",
            width: 380,
            zIndex: 1000,
          }}
        >
          <div className="drag-handle" style={{ cursor: "grab", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", color: "#94d2bd" }}>
                NOSTRADAMUS
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
                NJ Economic Atlas
              </div>
            </div>
            <NavigationBreadcrumb />
          </div>

          <div style={{ marginTop: 8 }}>
            <SearchBar />
          </div>
        </div>
      </Draggable>

      {/* Flight info panel — shown when a flight is tracked */}
      {trackedFlightData && (
        <Draggable handle=".drag-handle" bounds="parent">
          <div
            style={{
              ...panelStyle,
              position: "absolute",
              top: 170,
              left: 16,
              padding: "14px 16px",
              width: 250,
            }}
          >
            <MinimizablePanel title="Flight Data" icon={<Plane size={14} color="#94d2bd" />}>
              <FlightInfoPanel />
            </MinimizablePanel>
          </div>
        </Draggable>
      )}


      {/* Municipality info panel — shown when a municipality is clicked */}
      {selectedMunicipalityProps && (
        <Draggable handle=".drag-handle" bounds="parent">
          <div
            style={{
              ...panelStyle,
              position: "absolute",
              top: trackedFlightData ? 300 : 170,
              left: 16,
              padding: "14px 16px",
              width: 280,
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
            }}
          >
            <MinimizablePanel title="Municipality" icon={<Building size={14} color="#94d2bd" />}>
              <MunicipalitySidebar />
            </MinimizablePanel>
          </div>
        </Draggable>
      )}

      {/* Top-right: Unified Settings Sidebar (Map Data + Layer Control) */}
      <Draggable nodeRef={layerControlRef} handle=".drag-handle" bounds="parent">
        <div
          ref={layerControlRef}
          style={{
            ...panelStyle,
            position: "absolute",
            top: 16,
            right: 16,
            padding: "12px 16px",
            width: 320,
            zIndex: 1000,
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div className="drag-handle" style={{ cursor: "grab", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <SlidersHorizontal size={14} color="#94d2bd" />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#94d2bd" }}>MAP SETTINGS</span>
          </div>

          <MinimizablePanel title="Map Data" icon={<MapIcon size={14} color="#94d2bd" />}>
            <VariableSelector />
          </MinimizablePanel>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
            <MinimizablePanel title="Layer Control" icon={<Layers size={14} color="#94d2bd" />}>
              <LayerControl />
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, marginTop: 12 }}>
                <ViewSelector />
              </div>
            </MinimizablePanel>
          </div>
        </div>
      </Draggable>

      {showBusinesses && <BusinessesInFrame />}

      {showBusinessList && (
        <div style={{ ...panelStyle, position: "absolute", top: 16, right: 340, width: 320, bottom: 16 }}>
          <BusinessListPanel />
        </div>
      )}

      {selectedBusiness && (
        <div style={{ ...panelStyle, position: "absolute", top: 16, right: showBusinessList ? 680 : 340, width: 300, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}>
          <BusinessInfoPanel business={selectedBusiness} />
        </div>
      )}

      {/* Bottom-left: legend */}
      <Draggable nodeRef={legendRef} handle=".drag-handle" bounds="parent">
        <div
          ref={legendRef}
          style={{
            ...panelStyle,
            position: "absolute",
            bottom: 24,
            left: 16,
            padding: "12px 16px",
            minWidth: 200,
          }}
        >
          <MinimizablePanel title="Legend" icon={<SlidersHorizontal size={14} color="#94d2bd" />}>
            <Legend activeVariable={activeVariable} />
          </MinimizablePanel>
        </div>
      </Draggable>

      <Draggable nodeRef={visualsRef} handle=".drag-handle" bounds="parent">
        <div
          ref={visualsRef}
          style={{
            ...panelStyle,
            position: "absolute",
            bottom: 24,
            right: 16,
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <MinimizablePanel title="Visuals & Time" icon={<Eye size={14} color="#94d2bd" />}>
            <SkyModeSelector />
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 12 }}>
              <VisualModeSelector />
            </div>
          </MinimizablePanel>
        </div>
      </Draggable>

      {/* Right panel — level-specific content */}
      {
        viewLevel === "building" && (
          <Draggable nodeRef={buildingSimRef} handle=".drag-handle" bounds="parent">
            <div
              ref={buildingSimRef}
              style={{
                ...panelStyle,
                position: "absolute",
                top: 80,
                right: 16,
                padding: "16px",
                width: 260,
              }}
            >
              <MinimizablePanel title="Building Sim" icon={<Building size={14} color="#94d2bd" />}>
                <SimulationPanel />
              </MinimizablePanel>
            </div>
          </Draggable>
        )
      }

      {
        (viewLevel === "tract") && selectedTractId && (
          <Draggable nodeRef={tractDataRef} handle=".drag-handle" bounds="parent">
            <div
              ref={tractDataRef}
              style={{
                ...panelStyle,
                position: "absolute",
                top: 80,
                right: 16,
                padding: "16px",
                width: 260,
              }}
            >
              <MinimizablePanel title="Tract Data" icon={<Target size={14} color="#94d2bd" />}>
                <TractSidebar geoid={selectedTractId} />
              </MinimizablePanel>
            </div>
          </Draggable>
        )
      }

      <PropertySidebar />
    </div >
  );
}

function StatRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: value ? "#e2e8f0" : "#334155" }}>{value ?? "—"}</span>
    </div>
  );
}

// Human-readable label for OSM building type tags
function formatBuildingType(t: string | null): string | null {
  if (!t) return null;
  const map: Record<string, string> = {
    apartments: "Apartments", house: "House", commercial: "Commercial",
    industrial: "Industrial", office: "Office", retail: "Retail",
    residential: "Residential", school: "School", hospital: "Hospital",
    university: "University", hotel: "Hotel", warehouse: "Warehouse",
    church: "Church", garage: "Garage", yes: "Building",
  };
  return map[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
}

function SimulationPanel() {
  const { navigateToTract, selectedTractId, selectedBuildingProps, simulationData, simulationStatus } = useMapStore();
  const b = selectedBuildingProps;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}>
            BUILDING
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#94d2bd", marginTop: 2 }}>
            {b?.name ?? formatBuildingType(b?.buildingType ?? null) ?? "Selected Building"}
          </div>
        </div>
        {selectedTractId && (
          <button
            onClick={() => navigateToTract(selectedTractId)}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "#64748b", cursor: "pointer", fontSize: 14, padding: "2px 8px", lineHeight: 1.5 }}
            aria-label="Back to tract"
          >
            ×
          </button>
        )}
      </div>

      {/* OSM building properties */}
      {b && (
        <div style={{ marginBottom: 12 }}>
          <StatRow label="Type" value={formatBuildingType(b.buildingType)} />
          <StatRow label="Height" value={b.estimatedHeight != null ? `${b.estimatedHeight} m` : null} />
          <StatRow label="Floors" value={b.levels != null ? String(b.levels) : null} />
          <StatRow label="Material" value={b.material ? b.material.charAt(0).toUpperCase() + b.material.slice(1) : null} />
          {b.lat != null && (
            <StatRow label="Location" value={`${b.lat.toFixed(5)}, ${b.lon?.toFixed(5)}`} />
          )}
        </div>
      )}

      {/* Simulation Real Metrics */}
      <div style={{ background: "rgba(120,230,255,0.06)", border: "1px solid rgba(120,230,255,0.2)", borderRadius: 8, padding: "12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94d2bd", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <span>NOSTRADAMUS ABM</span>
          <span style={{ color: simulationStatus === 'connected' ? '#66fcf1' : '#ff4d4d' }}>
            {simulationStatus.toUpperCase()}
          </span>
        </div>

        <StatRow label="Agents (Viewport)" value={simulationData?.viewport_agents?.length?.toString() ?? "0"} />
        <StatRow label="Tick" value={simulationData?.tick?.toString() ?? "0"} />

        {simulationData?.global_metrics && (
          <>
            <StatRow label="Inflation" value={(simulationData.global_metrics.inflation_rate * 100).toFixed(1) + "%"} />
            <StatRow label="Tax Rate" value={(simulationData.global_metrics.base_tax_rate * 100).toFixed(1) + "%"} />
          </>
        )}
      </div>

      <div style={{ fontSize: 10, color: "#334155", marginTop: 8, textAlign: "right" }}>
        Rust Backend · WebSocket
      </div>
    </div>
  );
}
