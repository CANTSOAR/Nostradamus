import { useMapStore } from "./store/useMapStore";
import { CesiumMap } from "./components/CesiumMap";
import { VariableSelector } from "./components/VariableSelector";
import { TractSidebar } from "./components/TractSidebar";
import { LayerControl } from "./components/LayerControl";
import { Legend } from "./components/Legend";
import { NavigationBreadcrumb } from "./components/NavigationBreadcrumb";

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
  const { activeVariable, viewLevel, selectedTractId } = useMapStore();

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#020408" }}>
      {/* Globe fills entire viewport */}
      <CesiumMap />

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
          PALANTIR AT HOME
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, marginBottom: 8 }}>
          NJ Economic Atlas · ACS 2023 · BLS QCEW 2023
        </div>
        <NavigationBreadcrumb />
      </div>

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
        }}
      >
        <LayerControl />
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

      {/* Right panel — level-specific content */}
      {viewLevel === "building" && (
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
          <SimulationPlaceholder />
        </div>
      )}

      {(viewLevel === "tract") && selectedTractId && (
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
      )}
    </div>
  );
}

function SimulationPlaceholder() {
  const { navigateToTract, selectedTractId } = useMapStore();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}>
            BUILDING SIMULATION
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#94d2bd", marginTop: 2 }}>
            Agent Model
          </div>
        </div>
        {selectedTractId && (
          <button
            onClick={() => navigateToTract(selectedTractId)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 5,
              color: "#64748b",
              cursor: "pointer",
              fontSize: 14,
              padding: "2px 8px",
              lineHeight: 1.5,
            }}
            aria-label="Back to tract"
          >
            ×
          </button>
        )}
      </div>

      <div
        style={{
          background: "rgba(120,230,255,0.04)",
          border: "1px solid rgba(120,230,255,0.15)",
          borderRadius: 8,
          padding: "16px 12px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>⬡</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#94d2bd", marginBottom: 4 }}>
          Rust ABM — Coming Soon
        </div>
        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
          Agent-based simulation will render pedestrian and economic activity patterns for this building
          via WebSocket.
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 10, color: "#1e40af", display: "flex", gap: 6, flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#475569" }}>Agents</span>
          <span style={{ color: "#334155" }}>–</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#475569" }}>Simulation tick</span>
          <span style={{ color: "#334155" }}>–</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#475569" }}>WebSocket</span>
          <span style={{ color: "#334155" }}>disconnected</span>
        </div>
      </div>
    </div>
  );
}
