export type VariableKey =
  | "median_income"
  | "poverty_rate"
  | "unemployment_rate"
  | "county_employment";

export interface VariableConfig {
  key: VariableKey;
  label: string;
  description: string;
  /** d3-scale-chromatic interpolator scheme name */
  colorScheme: string;
  /** True = higher value is better (green end of scale) */
  higherIsBetter: boolean;
  /** Format function for display */
  format: (value: number) => string;
}

export const VARIABLES: VariableConfig[] = [
  {
    key: "median_income",
    label: "Median Income",
    description: "Median household income (ACS 5-year, 2023)",
    colorScheme: "RdYlGn",
    higherIsBetter: true,
    format: (v) =>
      v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
  },
  {
    key: "poverty_rate",
    label: "Poverty Rate",
    description: "Share of population below poverty line (ACS 5-year, 2023)",
    colorScheme: "OrRd",
    higherIsBetter: false,
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: "unemployment_rate",
    label: "Unemployment Rate",
    description: "Share of labor force that is unemployed (ACS 5-year, 2023)",
    colorScheme: "OrRd",
    higherIsBetter: false,
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: "county_employment",
    label: "County Employment",
    description: "Annual average employment level by county (BLS QCEW, 2023)",
    colorScheme: "Blues",
    higherIsBetter: true,
    format: (v) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  },
];

export const VARIABLE_MAP = Object.fromEntries(
  VARIABLES.map((v) => [v.key, v])
) as Record<VariableKey, VariableConfig>;
