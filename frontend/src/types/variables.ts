export type VariableKey =
  | "median_income"
  | "poverty_rate"
  | "unemployment_rate"
  | "county_employment"
  | "avg_annual_wage"
  | "certified_biz_count"
  | "sec_healthcare"
  | "sec_retail"
  | "sec_hospitality"
  | "sec_professional"
  | "sec_construction"
  | "sec_finance"
  | "sec_manufacturing"
  | "sec_admin"
  | "sec_education"
  | "sec_transport"
  | "sec_wholesale"
  | "sec_other"
  | "wage_healthcare"
  | "wage_retail"
  | "wage_hospitality"
  | "wage_professional"
  | "wage_construction"
  | "wage_finance"
  | "wage_manufacturing"
  | "wage_admin"
  | "wage_education"
  | "wage_transport"
  | "wage_wholesale"
  | "wage_other"
  | "private_establishments";

export interface VariableConfig {
  key: VariableKey;
  label: string;
  description: string;
  /** Group for UI organization */
  group?: "economic_indicators" | "municipality_sector_count" | "municipality_sector_wage";
  /** d3-scale-chromatic interpolator scheme name */
  colorScheme: string;
  /** True = higher value is better (green end of scale) */
  higherIsBetter: boolean;
  /** Format function for display */
  format: (value: number) => string;
}

const fmtCurrency = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const fmtInt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

export const VARIABLES: VariableConfig[] = [
  {
    key: "median_income",
    label: "Median Income",
    description: "Median household income (ACS 5-year, 2023)",
    group: "economic_indicators",
    colorScheme: "RdYlGn",
    higherIsBetter: true,
    format: fmtCurrency,
  },
  {
    key: "poverty_rate",
    label: "Poverty Rate",
    description: "Share of population below poverty line (ACS 5-year, 2023)",
    group: "economic_indicators",
    colorScheme: "OrRd",
    higherIsBetter: false,
    format: fmtPct,
  },
  {
    key: "unemployment_rate",
    label: "Unemployment Rate",
    description: "Share of labor force that is unemployed (ACS 5-year, 2023)",
    group: "economic_indicators",
    colorScheme: "OrRd",
    higherIsBetter: false,
    format: fmtPct,
  },
  {
    key: "county_employment",
    label: "County Employment",
    description: "Annual average employment level by county (BLS QCEW, 2023)",
    group: "economic_indicators",
    colorScheme: "Blues",
    higherIsBetter: true,
    format: fmtInt,
  },
  {
    key: "avg_annual_wage",
    label: "Avg Annual Wage",
    description: "Average annual wage",
    group: "economic_indicators",
    colorScheme: "YlGnBu",
    higherIsBetter: true,
    format: fmtCurrency,
  },
  {
    key: "certified_biz_count",
    label: "Certified Businesses",
    description: "Number of NJ state-certified businesses (MBE/WBE/SBE) per county",
    group: "economic_indicators",
    colorScheme: "Purples",
    higherIsBetter: true,
    format: fmtInt,
  },
  { key: "private_establishments", label: "Total Businesses", group: "economic_indicators", description: "Total private establishments", colorScheme: "Blues", higherIsBetter: true, format: fmtInt },

  // Sector counts
  { key: "sec_healthcare", label: "Healthcare Biz", group: "municipality_sector_count", description: "Healthcare & social assistance establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_retail", label: "Retail Biz", group: "municipality_sector_count", description: "Retail trade establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_hospitality", label: "Hospitality Biz", group: "municipality_sector_count", description: "Accommodation & food services establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_professional", label: "Professional Biz", group: "municipality_sector_count", description: "Professional, scientific, & technical establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_construction", label: "Construction Biz", group: "municipality_sector_count", description: "Construction establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_finance", label: "Finance Biz", group: "municipality_sector_count", description: "Finance & insurance establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_manufacturing", label: "Manufacturing Biz", group: "municipality_sector_count", description: "Manufacturing establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_admin", label: "Admin/Waste Biz", group: "municipality_sector_count", description: "Admin & waste services establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_education", label: "Education Biz", group: "municipality_sector_count", description: "Education establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_transport", label: "Transport Biz", group: "municipality_sector_count", description: "Transportation & warehousing establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_wholesale", label: "Wholesale Biz", group: "municipality_sector_count", description: "Wholesale trade establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },
  { key: "sec_other", label: "Other Services Biz", group: "municipality_sector_count", description: "Other services establishment count", colorScheme: "Greens", higherIsBetter: true, format: fmtInt },

  // Sector wages
  { key: "wage_healthcare", label: "Healthcare Wages", group: "municipality_sector_wage", description: "Avg annual wage — Healthcare", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_retail", label: "Retail Wages", group: "municipality_sector_wage", description: "Avg annual wage — Retail", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_hospitality", label: "Hospitality Wages", group: "municipality_sector_wage", description: "Avg annual wage — Hospitality", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_professional", label: "Professional Wages", group: "municipality_sector_wage", description: "Avg annual wage — Professional", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_construction", label: "Construction Wages", group: "municipality_sector_wage", description: "Avg annual wage — Construction", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_finance", label: "Finance Wages", group: "municipality_sector_wage", description: "Avg annual wage — Finance", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_manufacturing", label: "Manufacturing Wages", group: "municipality_sector_wage", description: "Avg annual wage — Manufacturing", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_admin", label: "Admin/Waste Wages", group: "municipality_sector_wage", description: "Avg annual wage — Admin/Waste", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_education", label: "Education Wages", group: "municipality_sector_wage", description: "Avg annual wage — Education", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_transport", label: "Transport Wages", group: "municipality_sector_wage", description: "Avg annual wage — Transport", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_wholesale", label: "Wholesale Wages", group: "municipality_sector_wage", description: "Avg annual wage — Wholesale", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
  { key: "wage_other", label: "Other Services Wages", group: "municipality_sector_wage", description: "Avg annual wage — Other Services", colorScheme: "YlGnBu", higherIsBetter: true, format: fmtCurrency },
];

export const VARIABLE_MAP = Object.fromEntries(
  VARIABLES.map((v) => [v.key, v])
) as Record<VariableKey, VariableConfig>;
