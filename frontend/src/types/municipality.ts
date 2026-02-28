export interface MunicipalityProperties {
  mun_geoid: string;
  mun_name: string;
  mun_type: string;       // "city" | "township" | "borough" | "town" | "village" | "municipality"
  county_fips: string;
  county_name: string;

  // 2023 summary
  private_establishments: number | null;
  avg_annual_wage: number | null;
  top_sector: string | null;

  // 2023 establishment counts by sector
  sec_hospitality: number | null;
  sec_healthcare: number | null;
  sec_retail: number | null;
  sec_manufacturing: number | null;
  sec_construction: number | null;
  sec_professional: number | null;
  sec_finance: number | null;
  sec_education: number | null;
  sec_admin: number | null;
  sec_transport: number | null;
  sec_wholesale: number | null;
  sec_other: number | null;

  // 2023 average annual wages by sector
  wage_hospitality: number | null;
  wage_healthcare: number | null;
  wage_retail: number | null;
  wage_manufacturing: number | null;
  wage_construction: number | null;
  wage_professional: number | null;
  wage_finance: number | null;
  wage_education: number | null;
  wage_admin: number | null;
  wage_transport: number | null;
  wage_wholesale: number | null;
  wage_other: number | null;

  // Historical private establishment counts
  priv_est_2018: number | null;
  priv_est_2019: number | null;
  priv_est_2020: number | null;
  priv_est_2021: number | null;
  priv_est_2022: number | null;
  priv_est_2023: number | null;
}

export const SECTOR_META: { key: keyof MunicipalityProperties; label: string; wageKey: keyof MunicipalityProperties }[] = [
  { key: "sec_healthcare",    label: "Healthcare",       wageKey: "wage_healthcare" },
  { key: "sec_retail",        label: "Retail",           wageKey: "wage_retail" },
  { key: "sec_hospitality",   label: "Hospitality",      wageKey: "wage_hospitality" },
  { key: "sec_professional",  label: "Professional",     wageKey: "wage_professional" },
  { key: "sec_construction",  label: "Construction",     wageKey: "wage_construction" },
  { key: "sec_finance",       label: "Finance",          wageKey: "wage_finance" },
  { key: "sec_manufacturing", label: "Manufacturing",    wageKey: "wage_manufacturing" },
  { key: "sec_admin",         label: "Admin/Waste",      wageKey: "wage_admin" },
  { key: "sec_education",     label: "Education",        wageKey: "wage_education" },
  { key: "sec_transport",     label: "Transport",        wageKey: "wage_transport" },
  { key: "sec_wholesale",     label: "Wholesale",        wageKey: "wage_wholesale" },
  { key: "sec_other",         label: "Other Services",   wageKey: "wage_other" },
];
