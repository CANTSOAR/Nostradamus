export interface TractProperties {
  GEOID: string;
  /** Median household income (dollars), null if unavailable */
  median_income: number | null;
  /** Number of people below poverty line */
  poverty_count: number | null;
  /** Total population */
  population: number | null;
  /** Number of unemployed people */
  unemployed: number | null;
  /** Poverty rate (0–1) */
  poverty_rate: number | null;
  /** Unemployment rate (0–1) */
  unemployment_rate: number | null;
  /** County-level annual average employment level */
  county_employment: number | null;
  /** County FIPS code (3-digit) */
  county_fips: string;
  /** Tract name */
  NAME?: string;
}

export interface EnrichedTract {
  geoid: string;
  properties: TractProperties;
}
