import { scaleQuantile } from "d3-scale";
import * as chromatic from "d3-scale-chromatic";
import type { VariableKey } from "../types/variables";
import { VARIABLE_MAP } from "../types/variables";

const NUM_BUCKETS = 7;

type InterpolatorFn = (t: number) => string;

const INTERPOLATORS: Record<string, InterpolatorFn> = {
  RdYlGn: chromatic.interpolateRdYlGn,
  OrRd: chromatic.interpolateOrRd,
  Blues: chromatic.interpolateBlues,
};

export interface ColorScale {
  getColor: (value: number | null) => string;
  breakpoints: number[];
  colors: string[];
}

export function buildColorScale(
  values: (number | null)[],
  variableKey: VariableKey
): ColorScale {
  const config = VARIABLE_MAP[variableKey];
  const valid = values.filter((v): v is number => v !== null && isFinite(v));

  if (valid.length === 0) {
    return {
      getColor: () => "#333333",
      breakpoints: [],
      colors: [],
    };
  }

  const quantile = scaleQuantile<number>().domain(valid).range(
    Array.from({ length: NUM_BUCKETS }, (_, i) => i)
  );

  const interpolator = INTERPOLATORS[config.colorScheme] ?? chromatic.interpolateBlues;

  // For "higher is worse" (poverty/unemployment), invert the color ramp
  const bucketToT = (bucket: number) => {
    const raw = bucket / (NUM_BUCKETS - 1);
    return config.higherIsBetter ? raw : 1 - raw;
  };

  const colors = Array.from({ length: NUM_BUCKETS }, (_, i) => interpolator(bucketToT(i)));

  const getColor = (value: number | null): string => {
    if (value === null || !isFinite(value)) return "#222831";
    const bucket = quantile(value);
    return colors[bucket] ?? "#222831";
  };

  const breakpoints = quantile.quantiles();

  return { getColor, breakpoints, colors };
}
