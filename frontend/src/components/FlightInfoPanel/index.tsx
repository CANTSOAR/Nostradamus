import { useMapStore } from "../../store/useMapStore";

function StatRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: value ? "#e2e8f0" : "#334155" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function headingToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function FlightInfoPanel() {
  const { trackedFlightData, setTrackedFlightData, setTrackedFlightIcao } = useMapStore();

  if (!trackedFlightData) return null;

  const f = trackedFlightData;
  const altFt = Math.round(f.altitude * 3.28084);
  const speedKts = Math.round(f.velocity * 1.94384);
  const compass = headingToCompass(f.heading);
  const accentColor = f.isMilitary ? "#f97316" : "#60a5fa";
  const accentColorLight = f.isMilitary ? "#fb923c" : "#93c5fd";

  const handleClose = () => {
    setTrackedFlightData(null);
    setTrackedFlightIcao(null);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: accentColor, letterSpacing: "0.12em", fontWeight: 700 }}>
            {f.isMilitary ? "MILITARY AIRCRAFT" : "COMMERCIAL FLIGHT"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: accentColorLight, marginTop: 3, fontFamily: "monospace", letterSpacing: "0.06em" }}>
            {f.callsign || f.icao24.toUpperCase()}
          </div>
        </div>
        <button
          onClick={handleClose}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 5, color: "#64748b", cursor: "pointer", fontSize: 14,
            padding: "2px 8px", lineHeight: 1.5,
          }}
          aria-label="Stop tracking"
        >
          ×
        </button>
      </div>

      {/* Live indicator */}
      {!f.isMilitary && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
          <span style={{
            display: "inline-block", width: 6, height: 6, borderRadius: "50%",
            background: "#22c55e", boxShadow: "0 0 6px #22c55e",
            animation: "live-pulse 1.4s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 600, letterSpacing: "0.1em" }}>
            LIVE · OPENSKY NETWORK
          </span>
        </div>
      )}

      {/* Stats */}
      <StatRow label="ICAO24" value={f.icao24.toUpperCase()} />
      <StatRow
        label="Altitude"
        value={f.onGround ? "On Ground" : `${Math.round(f.altitude).toLocaleString()} m / ${altFt.toLocaleString()} ft`}
      />
      <StatRow
        label="Speed"
        value={f.velocity > 0 ? `${Math.round(f.velocity)} m/s · ${speedKts} kts` : null}
      />
      <StatRow
        label="Heading"
        value={`${Math.round(f.heading)}° ${compass}`}
      />
      <StatRow
        label="Status"
        value={f.onGround ? "On Ground" : "Airborne"}
      />

      {/* Heading compass arc */}
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <svg width="80" height="44" viewBox="-40 -40 80 4" style={{ overflow: "visible", display: "block", margin: "0 auto" }}>
          <circle cx="0" cy="0" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
          {/* Tick marks at N/E/S/W */}
          {[0, 90, 180, 270].map((deg) => {
            const r = Math.PI * deg / 180;
            return (
              <line
                key={deg}
                x1={Math.sin(r) * 33} y1={-Math.cos(r) * 33}
                x2={Math.sin(r) * 38} y2={-Math.cos(r) * 38}
                stroke="rgba(255,255,255,0.25)" strokeWidth="1"
              />
            );
          })}
          {/* Heading arrow */}
          <line
            x1="0" y1="0"
            x2={Math.sin(Math.PI * f.heading / 180) * 30}
            y2={-Math.cos(Math.PI * f.heading / 180) * 30}
            stroke={accentColor} strokeWidth="2" strokeLinecap="round"
          />
          <circle
            cx={Math.sin(Math.PI * f.heading / 180) * 30}
            cy={-Math.cos(Math.PI * f.heading / 180) * 30}
            r="2.5" fill={accentColor}
          />
          {/* Center dot */}
          <circle cx="0" cy="0" r="2" fill="rgba(255,255,255,0.4)" />
          {/* Cardinal labels */}
          <text x="0" y="-41" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.4)">N</text>
          <text x="41" y="2" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.4)">E</text>
          <text x="0" y="47" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.4)">S</text>
          <text x="-41" y="2" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.4)">W</text>
        </svg>
      </div>

      <div style={{ fontSize: 10, color: "#334155", marginTop: 8, textAlign: "right" }}>
        {f.isMilitary ? "ADS-B Exchange · Classified" : "ACS 2023 · OpenSky Network"}
      </div>

      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
