import { useMapStore } from "../../store/useMapStore";
import { SECTOR_META } from "../../types/municipality";
import type { MunicipalityProperties } from "../../types/municipality";

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023] as const;

function fmt(n: number | null | undefined, style: "currency" | "decimal" = "decimal"): string {
  if (n == null || !isFinite(n)) return "—";
  if (style === "currency") {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function TrendBar({ props }: { props: MunicipalityProperties }) {
  const values = YEARS.map((y) => {
    const v = props[`priv_est_${y}` as keyof MunicipalityProperties] as number | null;
    return v ?? 0;
  });
  const max = Math.max(...values, 1);

  return (
    <div>
      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>
        PRIVATE BUSINESSES 2018–2023
      </div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 40 }}>
        {YEARS.map((y, i) => {
          const v = values[i];
          const height = Math.max(2, Math.round((v / max) * 36));
          return (
            <div key={y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div
                style={{
                  width: "100%",
                  height,
                  background: y === 2023
                    ? "rgba(148,210,189,0.7)"
                    : "rgba(125,211,252,0.35)",
                  borderRadius: "2px 2px 0 0",
                }}
              />
              <span style={{ fontSize: 8, color: "#475569" }}>{String(y).slice(2)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 9, color: "#475569" }}>{fmt(values[0])}</span>
        <span style={{ fontSize: 9, color: "#94d2bd" }}>{fmt(values[5])}</span>
      </div>
    </div>
  );
}

function SectorTable({ props }: { props: MunicipalityProperties }) {
  const rows = SECTOR_META
    .map((m) => ({
      label: m.label,
      count: props[m.key] as number | null,
      wage: props[m.wageKey] as number | null,
    }))
    .filter((r) => r.count != null && r.count > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 8);

  const maxCount = Math.max(...rows.map((r) => r.count ?? 0), 1);

  if (rows.length === 0) return (
    <div style={{ fontSize: 10, color: "#475569" }}>No sector data available.</div>
  );

  return (
    <div>
      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>
        INDUSTRY BREAKDOWN (2023)
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{ marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{r.label}</span>
            <span style={{ fontSize: 10, color: "#e2e8f0", fontWeight: 600 }}>
              {fmt(r.count)} biz
              {r.wage != null && (
                <span style={{ color: "#64748b", fontWeight: 400 }}>
                  {" · "}{fmt(r.wage, "currency")}
                </span>
              )}
            </span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.round(((r.count ?? 0) / maxCount) * 100)}%`,
                background: "rgba(125,211,252,0.5)",
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MunicipalitySidebar() {
  const { selectedMunicipalityProps, setSelectedMunicipality } = useMapStore();
  const m = selectedMunicipalityProps;
  if (!m) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}>
            {capitalize(m.mun_type).toUpperCase()}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#7dd3fc", marginTop: 1 }}>
            {m.mun_name}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
            {m.county_name} County
          </div>
        </div>
        <button
          onClick={() => setSelectedMunicipality(null)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 5, color: "#64748b", cursor: "pointer",
            fontSize: 14, padding: "2px 8px", lineHeight: 1.5,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Key stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
      }}>
        {[
          { label: "Businesses", value: fmt(m.private_establishments) },
          { label: "Avg Annual Wage", value: fmt(m.avg_annual_wage, "currency") },
          { label: "Top Sector", value: m.top_sector ? capitalize(m.top_sector) : "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.04)", borderRadius: 6,
              padding: "7px 9px", gridColumn: label === "Top Sector" ? "1 / -1" : undefined,
            }}
          >
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* Sector breakdown */}
      <SectorTable props={m} />

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* Historical trend */}
      <TrendBar props={m} />

      <div style={{ fontSize: 9, color: "#334155", textAlign: "right" }}>
        NJ DOL — Industry Data 2018–2023
      </div>
    </div>
  );
}
