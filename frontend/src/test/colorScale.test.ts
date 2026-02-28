import { describe, it, expect } from "vitest";
import { buildColorScale } from "../lib/colorScale";

describe("buildColorScale", () => {
  it("returns a fallback scale when all values are null", () => {
    const scale = buildColorScale([null, null, null], "median_income");
    expect(scale.getColor(null)).toBe("#333333");
    expect(scale.getColor(50000)).toBe("#333333");
    expect(scale.breakpoints).toHaveLength(0);
    expect(scale.colors).toHaveLength(0);
  });

  it("assigns a color to each non-null value", () => {
    const values = [30000, 50000, 70000, 90000, 110000];
    const scale = buildColorScale(values, "median_income");
    for (const v of values) {
      const color = scale.getColor(v);
      // d3 interpolators return rgb(...) strings
      expect(color).toMatch(/^rgb/);
    }
  });

  it("returns #222831 for null values when scale is valid", () => {
    const values = [30000, 50000, 70000];
    const scale = buildColorScale(values, "median_income");
    expect(scale.getColor(null)).toBe("#222831");
  });

  it("provides NUM_BUCKETS-1 breakpoints", () => {
    const values = Array.from({ length: 100 }, (_, i) => i * 1000);
    const scale = buildColorScale(values, "median_income");
    // scaleQuantile with 7 ranges gives 6 quantile breakpoints
    expect(scale.breakpoints).toHaveLength(6);
  });

  it("poverty_rate uses inverted scale (lower value → better color)", () => {
    const values = [0.05, 0.15, 0.25, 0.35];
    const incomeScale = buildColorScale(values, "median_income");
    const povertyScale = buildColorScale(values, "poverty_rate");
    // Lowest value gets best (green) color for income but worst (red) for poverty
    const incomeColorLow = incomeScale.getColor(0.05);
    const povertyColorLow = povertyScale.getColor(0.05);
    // They should be different (inverted)
    expect(incomeColorLow).not.toBe(povertyColorLow);
  });

  it("colors array has NUM_BUCKETS entries when values are present", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const scale = buildColorScale(values, "county_employment");
    expect(scale.colors).toHaveLength(7);
  });
});
