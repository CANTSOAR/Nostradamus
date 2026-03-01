import { useMapStore } from "../../store/useMapStore";

function Toggle({
  label,
  checked,
  onChange,
  color = "#94d2bd",
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  color?: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <div
        onClick={onChange}
        style={{
          width: 30, height: 16, borderRadius: 8,
          background: checked ? color : "rgba(255,255,255,0.12)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 2, left: checked ? 16 : 2,
          width: 12, height: 12, borderRadius: "50%",
          background: checked ? "#0a0e1a" : "#64748b",
          transition: "left 0.2s",
        }} />
      </div>
      <span style={{ fontSize: 12, color: checked ? "#e2e8f0" : "#64748b" }}>
        {label}
      </span>
    </label>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.12em", fontWeight: 700, marginTop: 10, marginBottom: 4 }}>
      {title}
    </div>
  );
}

import { VARIABLES } from "../../types/variables";

export function LayerControl() {
  const {
    showMunicipalities, toggleMunicipalities,
    activeMunVariable, setActiveMunVariable,
    showBusinesses, toggleBusinesses,
    showBuildings, toggleBuildings,
    showTracts, toggleTracts,
    showSatellites, toggleSatellites,
    showFlights, toggleFlights,
    showMilitaryFlights, toggleMilitaryFlights,
    showTraffic, toggleTraffic,
    showCCTV, toggleCCTV,
    showProperties, toggleProperties,
    detectionMode, setDetectionMode,
    isFlythroughActive, toggleFlythrough,
    isOrbitActive, toggleOrbit,
    trackedSatelliteId, setTrackedSatelliteId,
    trackedFlightIcao, setTrackedFlightIcao,
  } = useMapStore();

  const groups = {
    economic_indicators: "Economics",
    demographic: "Demographics",
    municipality_sector_count: "Business Counts",
    municipality_sector_wage: "Wages",
  };

  const munOptions = VARIABLES.filter(v => v.group && (v.group in groups || v.group.startsWith("municipality_")));

  return (
    <div>
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>
        LAYERS
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Section title="BASE" />
        <Toggle label="3D Buildings" checked={showBuildings} onChange={toggleBuildings} />
        <Toggle label="Census Tracts" checked={showTracts} onChange={toggleTracts} />
        <Toggle label="Municipalities" checked={showMunicipalities} onChange={toggleMunicipalities} color="#7dd3fc" />
        {showMunicipalities && (
          <div style={{ marginLeft: 38, marginTop: -2 }}>
            <select
              value={activeMunVariable}
              onChange={(e) => setActiveMunVariable(e.target.value as any)}
              style={{
                width: "100%", background: "rgba(15,23,42,0.8)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#93c5fd",
                padding: "2px 4px", fontSize: 11, borderRadius: 4, outline: "none",
                cursor: "pointer"
              }}
            >
              {Object.entries(groups).map(([id, label]) => (
                <optgroup key={id} label={label.toUpperCase()} style={{ background: "#0f172a", color: "#64748b", fontSize: 9 }}>
                  {munOptions
                    .filter(v => v.group === id)
                    .map(v => (
                      <option key={v.key} value={v.key} style={{ color: "#e2e8f0", fontSize: 11 }}>
                        {v.label}
                      </option>
                    ))
                  }
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <Section title="SPACE" />
        <Toggle label="🛰 Satellites" checked={showSatellites} onChange={toggleSatellites} color="#00ffcc" />
        {showSatellites && (
          <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
            {(["sparse", "full"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setDetectionMode(m)}
                style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 4, cursor: "pointer",
                  background: detectionMode === m ? "rgba(0,255,200,0.15)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${detectionMode === m ? "rgba(0,255,200,0.4)" : "rgba(255,255,255,0.1)"}`,
                  color: detectionMode === m ? "#00ffcc" : "#64748b",
                }}
              >
                {m}
              </button>
            ))}
            {trackedSatelliteId && (
              <button
                onClick={() => setTrackedSatelliteId(null)}
                style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 4, cursor: "pointer",
                  background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.4)", color: "#fde047",
                }}
              >
                ✕ track
              </button>
            )}
          </div>
        )}

        <Section title="AVIATION" />
        <Toggle label="✈ Flights" checked={showFlights} onChange={toggleFlights} color="#60a5fa" />
        <Toggle label="🟠 Military" checked={showMilitaryFlights} onChange={toggleMilitaryFlights} color="#f97316" />
        {(showFlights || showMilitaryFlights) && trackedFlightIcao && (
          <button
            onClick={() => setTrackedFlightIcao(null)}
            style={{
              fontSize: 10, padding: "2px 6px", borderRadius: 4, cursor: "pointer", marginLeft: 16,
              background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.4)", color: "#fde047",
              alignSelf: "flex-start",
            }}
          >
            ✕ untrack flight
          </button>
        )}

        <Section title="GROUND" />
        <Toggle label="🏢 Business POIs" checked={showBusinesses} onChange={toggleBusinesses} color="#f43f5e" />
        <Toggle label="💎 Property Atlas" checked={showProperties} onChange={toggleProperties} color="#94d2bd" />
        <Toggle label="🚗 NJ Traffic" checked={showTraffic} onChange={toggleTraffic} color="#facc15" />
        <Toggle label="📹 CCTV Cams" checked={showCCTV} onChange={toggleCCTV} color="#a855f7" />

        <Section title="CAMERA" />
        <Toggle label="⟳ Orbit Mode" checked={isOrbitActive} onChange={toggleOrbit} color="#94d2bd" />
        {isOrbitActive && (
          <div style={{ fontSize: 9, color: "#64748b", marginLeft: 16, lineHeight: 1.5 }}>
            Click ground → new pivot<br />
            Scroll → zoom
          </div>
        )}
        <Toggle label="🚁 Drone Flythrough" checked={isFlythroughActive} onChange={toggleFlythrough} color="#818cf8" />
        {isFlythroughActive && (
          <div style={{ fontSize: 9, color: "#64748b", marginLeft: 16, lineHeight: 1.5 }}>
            Click map → capture mouse<br />
            WASD · Space/C · Shift=fast
          </div>
        )}

        <div style={{
          marginTop: 8, padding: "6px 8px", borderRadius: 5,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          fontSize: 9, color: "#475569", lineHeight: 1.6,
        }}>
          POI shortcuts: <span style={{ color: "#64748b" }}>Q W E R T</span><br />
          Reset: <span style={{ color: "#64748b" }}>ESC / 1</span><br />
          Click satellite/plane to track
        </div>
      </div>
    </div>
  );
}
