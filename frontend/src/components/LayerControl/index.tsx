import { useState } from "react";
import { useMapStore } from "../../store/useMapStore";
import { VARIABLES } from "../../types/variables";
import type { VariableKey } from "../../types/variables";

function Toggle({
  label, checked, onChange, color = "#94d2bd",
}: { label: string; checked: boolean; onChange: () => void; color?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <div onClick={onChange} style={{ width: 28, height: 15, borderRadius: 8, background: checked ? color : "rgba(255,255,255,0.12)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 1.5, left: checked ? 14 : 1.5, width: 12, height: 12, borderRadius: "50%", background: checked ? "#0a0e1a" : "#64748b", transition: "left 0.2s" }} />
      </div>
      <span style={{ fontSize: 11, color: checked ? "#e2e8f0" : "#64748b" }}>{label}</span>
    </label>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.14em", fontWeight: 700, marginTop: 10, marginBottom: 5, textTransform: "uppercase" }}>
      {title}
    </div>
  );
}

function Chip({ label, active, color = "#94d2bd", onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: active ? `${color}22` : "rgba(255,255,255,0.05)", border: `1px solid ${active ? `${color}77` : "rgba(255,255,255,0.1)"}`, color: active ? color : "#64748b", fontFamily: "inherit" }}>
      {label}
    </button>
  );
}

function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div style={{ marginLeft: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: "#64748b" }}>{label}</span>
        <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#facc15", cursor: "pointer" }} />
    </div>
  );
}

// Variables grouped
const REGIONAL_VARS = VARIABLES.filter(v => v.group === "regional");
const SECTOR_COUNT_VARS = VARIABLES.filter(v => v.group === "municipality_sector_count");
const SECTOR_WAGE_VARS = VARIABLES.filter(v => v.group === "municipality_sector_wage");

function VarRow({ v, active, onClick }: { v: typeof VARIABLES[0]; active: boolean; onClick: () => void }) {
  return (
    <label
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 6,
        padding: "3px 6px", borderRadius: 5,
        background: active ? "rgba(148,210,189,0.08)" : "transparent",
        border: `1px solid ${active ? "rgba(148,210,189,0.2)" : "transparent"}`,
      }}
      title={v.description}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={onClick}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#94d2bd" : "rgba(255,255,255,0.15)", flexShrink: 0, boxShadow: active ? "0 0 5px #94d2bd88" : "none" }} />
        <span style={{ fontSize: 11, color: active ? "#e2e8f0" : "#64748b" }}>{v.label}</span>
      </div>
    </label>
  );
}

// Collapsible sub-group within sector variables (drives munChoroplethVar)
function SectorGroup({ title, vars, activeMunVar, setMunVar }: {
  title: string; vars: typeof VARIABLES; activeMunVar: string | null; setMunVar: (k: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasActive = vars.some(v => v.key === activeMunVar);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer",
        color: hasActive ? "#7dd3fc" : "#475569", fontSize: 10, fontWeight: 600, padding: "2px 0", fontFamily: "inherit",
      }}>
        <span style={{ fontSize: 8 }}>{open ? "▼" : "▶"}</span>
        {title}
        {hasActive && <span style={{ fontSize: 8, color: "#7dd3fc", marginLeft: 2 }}>•</span>}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginLeft: 10, marginTop: 2 }}>
          {vars.map(v => (
            <label key={v.key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "2px 6px", borderRadius: 5, background: activeMunVar === v.key ? "rgba(125,211,252,0.08)" : "transparent", border: `1px solid ${activeMunVar === v.key ? "rgba(125,211,252,0.2)" : "transparent"}` }} title={v.description}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setMunVar(activeMunVar === v.key ? null : v.key)}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: activeMunVar === v.key ? "#7dd3fc" : "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: activeMunVar === v.key ? "#e2e8f0" : "#64748b" }}>{v.label}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function LayerControl() {
  const {
    activeVariable, setActiveVariable,
    showMunicipalities, toggleMunicipalities,
    munChoroplethVar, setMunChoroplethVar,
    showBuildings, toggleBuildings,
    showTracts, toggleTracts,
    showBusinesses, toggleBusinesses,
    showBusinessList, toggleBusinessList,
    showSatellites, toggleSatellites,
    showFlights, toggleFlights,
    showMilitaryFlights, toggleMilitaryFlights,
    showTraffic, toggleTraffic,
    trafficSpeedMult, setTrafficSpeedMult,
    trafficDensityMult, setTrafficDensityMult,
    trafficShowSecondary, toggleTrafficShowSecondary,
    trafficMaxDistance, setTrafficMaxDistance,
    trafficParticleSize, setTrafficParticleSize,
    showCCTV, toggleCCTV,
    detectionMode, setDetectionMode,
    isFlythroughActive, toggleFlythrough,
    isOrbitActive, toggleOrbit,
    trackedSatelliteId, setTrackedSatelliteId,
    trackedFlightIcao, setTrackedFlightIcao,
    // Infrastructure
    showElectricUtilities, toggleElectricUtilities,
    showPowerPlants, togglePowerPlants,
    showSolarGrid, toggleSolarGrid,
    showSewerAreas, toggleSewerAreas,
    showPurveyorAreas, togglePurveyorAreas,
    // Climate & Energy
    showAfvStations, toggleAfvStations,
    showCommunitySolar, toggleCommunitySolar,
    showRggiInvestments, toggleRggiInvestments,
    // FEMA
    showFloodZones, toggleFloodZones,
    // Transit
    showTransitRoutes, toggleTransitRoutes,
    showTransitStops, toggleTransitStops,
    // EV Charging
    showEvStations, toggleEvStations,
  } = useMapStore();

  return (
    <div>
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>LAYERS</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>

        {/* ── REGIONAL ── */}
        <SectionHeader title="Regional" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 2 }}>
          {REGIONAL_VARS.map(v => (
            <VarRow key={v.key} v={v} active={activeVariable === v.key} onClick={() => setActiveVariable(v.key as VariableKey)} />
          ))}
        </div>

        {/* ── BOUNDARIES ── */}
        <SectionHeader title="Boundaries" />
        <Toggle label="Census Tracts" checked={showTracts} onChange={toggleTracts} />
        <Toggle label="Municipalities" checked={showMunicipalities} onChange={toggleMunicipalities} color="#7dd3fc" />

        {showMunicipalities && (
          <div style={{ marginLeft: 20, display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
            {/* Total */}
            <div style={{ fontSize: 9, color: "#475569", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 1 }}>TOTAL</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Chip label="outline" active={munChoroplethVar === null} color="#7dd3fc" onClick={() => setMunChoroplethVar(null)} />
              <Chip label="biz count" active={munChoroplethVar === "private_establishments"} color="#7dd3fc" onClick={() => setMunChoroplethVar("private_establishments")} />
              <Chip label="wages" active={munChoroplethVar === "avg_annual_wage"} color="#7dd3fc" onClick={() => setMunChoroplethVar("avg_annual_wage")} />
            </div>
            {/* Industry breakdown */}
            <div style={{ fontSize: 9, color: "#475569", fontWeight: 600, letterSpacing: "0.05em", marginTop: 4 }}>BY INDUSTRY</div>
            <SectorGroup title="Biz Count" vars={SECTOR_COUNT_VARS} activeMunVar={munChoroplethVar} setMunVar={setMunChoroplethVar} />
            <SectorGroup title="Wages" vars={SECTOR_WAGE_VARS} activeMunVar={munChoroplethVar} setMunVar={setMunChoroplethVar} />
          </div>
        )}

        {/* ── STREET LEVEL ── */}
        <SectionHeader title="Street Level" />
        <Toggle label="3D Buildings" checked={showBuildings} onChange={toggleBuildings} />
        <Toggle label="Business Pins" checked={showBusinesses} onChange={toggleBusinesses} color="#f59e0b" />
        {showBusinesses && (
          <div style={{ fontSize: 9, color: "#64748b", marginLeft: 20, lineHeight: 1.5 }}>
            <span style={{ color: "#f59e0b" }}>●</span> amenity &nbsp;
            <span style={{ color: "#34d399" }}>●</span> shop &nbsp;
            <span style={{ color: "#818cf8" }}>●</span> office<br />
            Click a pin to inspect · visible &lt;20 km
          </div>
        )}

        {/* ── FEMA FLOOD ZONES ── */}
        <SectionHeader title="Hazards" />
        <Toggle label="🌊 FEMA Flood Zones" checked={showFloodZones} onChange={toggleFloodZones} color="#38bdf8" />
        {showFloodZones && (
          <div style={{ fontSize: 9, color: "#64748b", marginLeft: 20, lineHeight: 1.5 }}>
            <span style={{ color: "#ef4444" }}>■</span> High Risk (AE/VE) &nbsp;
            <span style={{ color: "#f97316" }}>■</span> Moderate &nbsp;
            <span style={{ color: "#a3e635" }}>■</span> Minimal (X)
          </div>
        )}

        {/* ── INFRASTRUCTURE: ELECTRIC GRID ── */}
        <SectionHeader title="Electric Grid" />
        <Toggle label="⚡ Utility Territories" checked={showElectricUtilities} onChange={toggleElectricUtilities} color="#facc15" />
        <Toggle label="🏭 Power Plants" checked={showPowerPlants} onChange={togglePowerPlants} color="#fb923c" />
        <Toggle label="☀ Solar Grid Supply" checked={showSolarGrid} onChange={toggleSolarGrid} color="#fde68a" />
        <Toggle label="🔌 EV Charging (NREL)" checked={showEvStations} onChange={toggleEvStations} color="#4ade80" />

        {/* ── INFRASTRUCTURE: WATER ── */}
        <SectionHeader title="Water & Sewage" />
        <Toggle label="💧 Sewer Service Areas" checked={showSewerAreas} onChange={toggleSewerAreas} color="#38bdf8" />
        <Toggle label="🚰 Water Purveyors" checked={showPurveyorAreas} onChange={togglePurveyorAreas} color="#67e8f9" />

        {/* ── CLIMATE & ENERGY ── */}
        <SectionHeader title="Climate & Energy" />
        <Toggle label="🚗 AFV Fuel Stations" checked={showAfvStations} onChange={toggleAfvStations} color="#86efac" />
        <Toggle label="⬡ Community Solar" checked={showCommunitySolar} onChange={toggleCommunitySolar} color="#fde68a" />
        <Toggle label="💰 RGGI Investments" checked={showRggiInvestments} onChange={toggleRggiInvestments} color="#a78bfa" />

        {/* ── NJ TRANSIT ── */}
        <SectionHeader title="Transit" />
        <Toggle label="🚌 Routes" checked={showTransitRoutes} onChange={toggleTransitRoutes} color="#f472b6" />
        <Toggle label="📍 Stops" checked={showTransitStops} onChange={toggleTransitStops} color="#e879f9" />
        {(showTransitRoutes || showTransitStops) && (
          <div style={{ fontSize: 9, color: "#64748b", marginLeft: 20, lineHeight: 1.5 }}>
            <span style={{ color: "#60a5fa" }}>━</span> Rail &nbsp;
            <span style={{ color: "#facc15" }}>━</span> Bus
          </div>
        )}

        {/* ── SPACE ── */}
        <SectionHeader title="Space" />
        <Toggle label="🛰 Satellites" checked={showSatellites} onChange={toggleSatellites} color="#00ffcc" />
        {showSatellites && (
          <div style={{ display: "flex", gap: 4, marginLeft: 20 }}>
            {(["sparse", "full"] as const).map((m) => (
              <Chip key={m} label={m} active={detectionMode === m} color="#00ffcc" onClick={() => setDetectionMode(m)} />
            ))}
            {trackedSatelliteId && (
              <Chip label="✕ track" active={false} onClick={() => setTrackedSatelliteId(null)} />
            )}
          </div>
        )}

        {/* ── AVIATION ── */}
        <SectionHeader title="Aviation" />
        <Toggle label="✈ Flights" checked={showFlights} onChange={toggleFlights} color="#60a5fa" />
        <Toggle label="🟠 Military" checked={showMilitaryFlights} onChange={toggleMilitaryFlights} color="#f97316" />
        {(showFlights || showMilitaryFlights) && trackedFlightIcao && (
          <button onClick={() => setTrackedFlightIcao(null)} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, cursor: "pointer", marginLeft: 20, background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.4)", color: "#fde047", alignSelf: "flex-start", fontFamily: "inherit" }}>
            ✕ untrack flight
          </button>
        )}

        {/* ── GROUND ── */}
        <SectionHeader title="Ground" />
        <Toggle label="🚗 NJ Traffic" checked={showTraffic} onChange={toggleTraffic} color="#facc15" />
        {showTraffic && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <Slider label="Density" value={trafficDensityMult} min={0.25} max={3} step={0.25} fmt={(v) => `${v}×`} onChange={setTrafficDensityMult} />
            <Slider label="Max distance" value={trafficMaxDistance} min={3} max={20} step={1} fmt={(v) => `${v} km`} onChange={setTrafficMaxDistance} />
            <Slider label="Particle size" value={trafficParticleSize} min={2} max={10} step={1} fmt={(v) => `${v} px`} onChange={setTrafficParticleSize} />
            <div style={{ marginLeft: 16 }}>
              <Toggle label="Side streets" checked={trafficShowSecondary} onChange={toggleTrafficShowSecondary} color="#facc15" />
            </div>
          </div>
        )}
        <Toggle label="📹 CCTV Cams" checked={showCCTV} onChange={toggleCCTV} color="#a855f7" />

        {/* ── CAMERA ── */}
        <SectionHeader title="Camera" />
        <Toggle label="⟳ Orbit Mode" checked={isOrbitActive} onChange={toggleOrbit} color="#94d2bd" />
        {isOrbitActive && <div style={{ fontSize: 9, color: "#64748b", marginLeft: 20, lineHeight: 1.5 }}>Click ground → new pivot · Scroll → zoom</div>}
        <Toggle label="🚁 Drone Flythrough" checked={isFlythroughActive} onChange={toggleFlythrough} color="#818cf8" />
        {isFlythroughActive && <div style={{ fontSize: 9, color: "#64748b", marginLeft: 20, lineHeight: 1.5 }}>Click map → capture mouse<br />WASD · Space/C · Shift=fast</div>}

        <div style={{ marginTop: 6, padding: "5px 7px", borderRadius: 5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 9, color: "#475569", lineHeight: 1.6 }}>
          POI shortcuts: <span style={{ color: "#64748b" }}>Q W E R T</span> &nbsp;
          Reset: <span style={{ color: "#64748b" }}>ESC / 1</span>
        </div>
      </div>
    </div>
  );
}
