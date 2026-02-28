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

function SimulationPlaceholder() {
  const { navigateToTract, selectedTractId, selectedBuildingProps } = useMapStore();
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

      {/* Simulation placeholder */}
      <div style={{ background: "rgba(120,230,255,0.04)", border: "1px solid rgba(120,230,255,0.15)", borderRadius: 8, padding: "12px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94d2bd", marginBottom: 4 }}>
          Rust ABM — Coming Soon
        </div>
        <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>
          Agent-based simulation via WebSocket
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexDirection: "column" }}>
        <StatRow label="Agents" value={null} />
        <StatRow label="Tick" value={null} />
        <StatRow label="WebSocket" value="disconnected" />
      </div>

      <div style={{ fontSize: 10, color: "#334155", marginTop: 8, textAlign: "right" }}>
        OSM 3D Buildings · Cesium Ion
      </div>
    </div>
  );
}
