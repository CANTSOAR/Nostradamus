import { useMapStore } from "../../store/useMapStore";
import type { TractProperties } from "../../types/tract";
import { VARIABLES } from "../../types/variables";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "5px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{value}</span>
    </div>
  );
}

function TractStats({ props }: { props: TractProperties }) {
  const fmt = (v: number | null, format: (n: number) => string) =>
    v !== null ? format(v) : "N/A";

  const varMap = Object.fromEntries(VARIABLES.map((v) => [v.key, v]));

  return (
    <div>
      <StatRow
        label="Population"
        value={props.population !== null ? props.population.toLocaleString() : "N/A"}
      />
      <StatRow
        label="Median Income"
        value={fmt(props.median_income, varMap["median_income"].format)}
      />
      <StatRow
        label="Poverty Rate"
        value={fmt(props.poverty_rate, varMap["poverty_rate"].format)}
      />
      <StatRow
        label="Unemployment"
        value={fmt(props.unemployment_rate, varMap["unemployment_rate"].format)}
      />
      <StatRow
        label="County Employment"
        value={fmt(props.county_employment, varMap["county_employment"].format)}
      />
      <StatRow label="County FIPS" value={`NJ-${props.county_fips}`} />
    </div>
  );
}

interface TractSidebarProps {
  geoid: string;
}

export function TractSidebar({ geoid }: TractSidebarProps) {
  const { selectedTractProps, navigateToCounty, selectedCountyFips, selectedCountyName } =
    useMapStore();

  const handleClose = () => {
    if (selectedCountyFips && selectedCountyName) {
      navigateToCounty(selectedCountyFips, selectedCountyName);
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}
          >
            CENSUS TRACT
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#94d2bd", marginTop: 2 }}>
            {geoid}
          </div>
        </div>
        <button
          onClick={handleClose}
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
          aria-label="Back to county"
        >
          ×
        </button>
      </div>

      {/* Stats */}
      {selectedTractProps ? (
        <TractStats props={selectedTractProps} />
      ) : (
        <div style={{ fontSize: 11, color: "#475569", textAlign: "center", padding: "12px 0" }}>
          No data available for this tract
        </div>
      )}

      <div style={{ fontSize: 10, color: "#334155", marginTop: 10, textAlign: "right" }}>
        ACS 2023 · BLS QCEW 2023
      </div>
    </div>
  );
}
