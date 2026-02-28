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
    <div style={{ minWidth: 190 }}>
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>
        {config.label.toUpperCase()}
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

      <div style={{ fontSize: 10, color: "#334155", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 10, height: 10, background: "#222831", borderRadius: 2, flexShrink: 0 }} />
        <span>No data</span>
      </div>

      <div style={{ fontSize: 9, color: "#1e293b", marginTop: 4 }}>
        {config.description}
      </div>
    </div>
  );
}
