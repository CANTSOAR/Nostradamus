import { useMemo } from "react";
import * as chromatic from "d3-scale-chromatic";
import type { VariableKey } from "../../types/variables";
import { VARIABLE_MAP } from "../../types/variables";

interface LegendProps {
  activeVariable: VariableKey;
}

const NUM_BUCKETS = 7;

type InterpolatorFn = (t: number) => string;

const INTERPOLATORS: Record<string, InterpolatorFn> = {
  RdYlGn: chromatic.interpolateRdYlGn,
  OrRd: chromatic.interpolateOrRd,
  Blues: chromatic.interpolateBlues,
};

export function Legend({ activeVariable }: LegendProps) {
  const config = VARIABLE_MAP[activeVariable];

  const colors = useMemo(() => {
    const interpolator = INTERPOLATORS[config.colorScheme] ?? chromatic.interpolateBlues;
    return Array.from({ length: NUM_BUCKETS }, (_, i) => {
      const raw = i / (NUM_BUCKETS - 1);
      const t = config.higherIsBetter ? raw : 1 - raw;
      return interpolator(t);
    });
  }, [config]);

  return (
    <div style={{ minWidth: 190, paddingTop: 4 }}>
      <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600, marginBottom: 8 }}>
        {config.label}
      </div>

      {/* Color ramp */}
      <div style={{ display: "flex", height: 12, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        {colors.map((color, i) => (
          <div
            key={i}
            style={{ flex: 1, background: color }}
          />
        ))}
      </div>

      {/* Labels */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#64748b" }}>
          {config.higherIsBetter ? "Lower" : "Higher"}
        </span>
        <span style={{ fontSize: 10, color: "#64748b" }}>
          {config.higherIsBetter ? "Higher" : "Lower"}
        </span>
      </div>

      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 12, height: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, flexShrink: 0 }} />
        <span>No data</span>
      </div>

      <div style={{ fontSize: 10, color: "#64748b", marginTop: 8, lineHeight: 1.4 }}>
        {config.description}
      </div>
    </div>
  );
}
