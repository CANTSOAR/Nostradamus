import { useMapStore } from "./store/useMapStore";
import { CesiumMap } from "./components/CesiumMap";
import { VariableSelector } from "./components/VariableSelector";
import { TractSidebar } from "./components/TractSidebar";
import { LayerControl } from "./components/LayerControl";
import { Legend } from "./components/Legend";
import { NavigationBreadcrumb } from "./components/NavigationBreadcrumb";
import { VisualModeSelector } from "./components/VisualModeSelector";
import { ViewSelector } from "./components/ViewSelector";
import { FlightInfoPanel } from "./components/FlightInfoPanel";
import { MunicipalitySidebar } from "./components/MunicipalitySidebar";
import { SkyModeSelector } from "./components/SkyModeSelector";
import { useSimulation } from "./hooks/useSimulation";
import { SimulationLayer } from "./components/SimulationLayer";

const panelStyle: React.CSSProperties = {
  background: "rgba(15,20,30,0.85)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
  fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
};

export default function App() {
  const { activeVariable, viewLevel, selectedTractId, trackedFlightData, selectedMunicipalityProps } = useMapStore();
  useSimulation();


  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#020408" }}>
      {/* Globe fills entire viewport */}
      <CesiumMap />
      <SimulationLayer />

      {/* Panoptic HUD Overlays removed */}

      {/* Top-left: title + breadcrumb */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          top: 16,
          left: 16,
          padding: "10px 18px",
          maxWidth: 420,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.05em", color: "#94d2bd" }}>
          NOSTRADAMUS
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, marginBottom: 8 }}>
          NJ Economic Atlas · ACS 2023 · BLS QCEW 2023
        </div>
        <NavigationBreadcrumb />
      </div>

      {/* Flight info panel — shown when a flight is tracked */}
      {trackedFlightData && (
        <div
          style={{
            ...panelStyle,
            position: "absolute",
            top: 130,
            left: 16,
            padding: "14px 16px",
            width: 250,
          }}
        >
          <FlightInfoPanel />
        </div>
      )}


      {/* Municipality info panel — shown when a municipality is clicked */}
      {selectedMunicipalityProps && (
        <div
          style={{
            ...panelStyle,
            position: "absolute",
            top: trackedFlightData ? 260 : 130,
            left: 16,
            padding: "14px 16px",
            width: 280,
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
          }}
        >
          <MunicipalitySidebar />
        </div>
      )}

      {/* Top-center: variable selector */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 16px",
        }}
      >
        <VariableSelector />
      </div>

      {/* Top-right: layer control */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          top: 16,
          right: 16,
          padding: "12px 16px",
          minWidth: 160,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxHeight: "calc(100vh - 120px)",
          overflowY: "auto",
        }}
      >
        <LayerControl />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <ViewSelector />
        </div>
      </div>

      {/* Bottom-left: legend */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          bottom: 24,
          left: 16,
          padding: "12px 16px",
          minWidth: 200,
        }}
      >
        <Legend activeVariable={activeVariable} />
      </div>

      <div
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
        <SkyModeSelector />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
          <VisualModeSelector />
        </div>
      </div>

      {/* Right panel — level-specific content */}
      {
        viewLevel === "building" && (
          <div
            style={{
              ...panelStyle,
              position: "absolute",
              top: 80,
              right: 16,
              padding: "16px",
              width: 260,
            }}
          >
            <SimulationPanel />
          </div>
        )
      }

      {
        (viewLevel === "tract") && selectedTractId && (
          <div
            style={{
              ...panelStyle,
              position: "absolute",
              top: 80,
              right: 16,
              padding: "16px",
              width: 260,
            }}
          >
            <TractSidebar geoid={selectedTractId} />
          </div>
        )
      }
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

        <StatRow label="Agents (Sample)" value={simulationData?.active_agents_subset?.length?.toString() ?? "0"} />
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
