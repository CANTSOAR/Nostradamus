"""
process_municipalities.py
Join industrial sector data (2018-2023) to NJ municipality boundaries.

Inputs:
  pipeline/data/nj_municipalities.geojson
  pipeline/data/industrial_sector_totals.csv   (establishment counts)
  pipeline/data/industrial_sector_annual_wages.csv (avg annual wages)
Output:
  frontend/public/data/nj_municipalities_enriched.geojson
"""

import pathlib
import re
import geopandas as gpd
import pandas as pd

DATA_DIR = pathlib.Path(__file__).parent / "data"
MUN_GEO = DATA_DIR / "nj_municipalities.geojson"
TOTALS_CSV = DATA_DIR / "industrial_sector_totals.csv"
WAGES_CSV = DATA_DIR / "industrial_sector_annual_wages.csv"
OUT_PATH = (
    pathlib.Path(__file__).parent.parent
    / "frontend" / "public" / "data" / "nj_municipalities_enriched.geojson"
)

COUNTY_TO_FIPS = {
    "ATLANTIC": "001", "BERGEN": "003", "BURLINGTON": "005",
    "CAMDEN": "007", "CAPE MAY": "009", "CUMBERLAND": "011",
    "ESSEX": "013", "GLOUCESTER": "015", "HUDSON": "017",
    "HUNTERDON": "019", "MERCER": "021", "MIDDLESEX": "023",
    "MONMOUTH": "025", "MORRIS": "027", "OCEAN": "029",
    "PASSAIC": "031", "SALEM": "033", "SOMERSET": "035",
    "SUSSEX": "037", "UNION": "039", "WARREN": "041",
}

NJ_COUNTY_NAMES = {v: k.capitalize() for k, v in COUNTY_TO_FIPS.items()}
NJ_COUNTY_NAMES.update({
    "001": "Atlantic", "003": "Bergen", "005": "Burlington",
    "007": "Camden", "009": "Cape May", "011": "Cumberland",
    "013": "Essex", "015": "Gloucester", "017": "Hudson",
    "019": "Hunterdon", "021": "Mercer", "023": "Middlesex",
    "025": "Monmouth", "027": "Morris", "029": "Ocean",
    "031": "Passaic", "033": "Salem", "035": "Somerset",
    "037": "Sussex", "039": "Union", "041": "Warren",
})

# Sectors to surface in the output (column name → short key)
SECTORS = {
    "Accomodations/Food": "hospitality",
    "Health/Social": "healthcare",
    "Retail Trade": "retail",
    "Manufacturing": "manufacturing",
    "Construction": "construction",
    "Professional/Technical": "professional",
    "Finance/Insurance": "finance",
    "Education": "education",
    "Admin/Waste Remediation": "admin",
    "Transp/Warehousing": "transport",
    "Wholesale Trade": "wholesale",
    "Other Services": "other",
}

_SUFFIX_RE = re.compile(
    r"\s+(city|township|borough|town|village|cdp|municipality)$", re.IGNORECASE
)


def normalize(name: str) -> str:
    return _SUFFIX_RE.sub("", name.strip()).lower()


def build_tiger_lookup(gdf: gpd.GeoDataFrame) -> dict:
    """Build {(county_fips, normalized_name): mun_geoid} lookup."""
    lookup = {}
    for _, row in gdf.iterrows():
        key = (row["county_fips"], row["mun_name"].lower())
        lookup[key] = row["mun_geoid"]
    return lookup


def resolve_geoid(tiger_lookup: dict, county_fips: str, csv_town: str):
    # 1. Exact match (handles "Atlantic City" correctly)
    exact = (county_fips, csv_town.lower())
    if exact in tiger_lookup:
        return tiger_lookup[exact]
    # 2. Strip legal suffix from CSV town name
    stripped = (county_fips, normalize(csv_town))
    if stripped in tiger_lookup:
        return tiger_lookup[stripped]
    return None


def main():
    print(f"Loading municipality boundaries from {MUN_GEO}...")
    gdf = gpd.read_file(MUN_GEO)
    print(f"  {len(gdf)} municipalities")

    tiger_lookup = build_tiger_lookup(gdf)
    gdf["county_name"] = gdf["county_fips"].map(NJ_COUNTY_NAMES).fillna("Unknown")

    # --- Load industrial sector data ---
    print("Loading industrial sector totals...")
    totals = pd.read_csv(TOTALS_CSV)
    totals = totals[totals["COUNTY"].isin(COUNTY_TO_FIPS)].copy()

    print("Loading industrial sector annual wages...")
    wages = pd.read_csv(WAGES_CSV)
    wages = wages[wages["COUNTY"].isin(COUNTY_TO_FIPS)].copy()

    priv_col = "PRIVATE SECTOR TOTALS"

    # --- Build historical private establishment counts (2018-2023) ---
    historical = []
    for year in range(2018, 2024):
        yr = totals[totals["YEAR"] == year].copy()
        yr[priv_col] = pd.to_numeric(yr[priv_col], errors="coerce")
        yr["county_fips"] = yr["COUNTY"].map(COUNTY_TO_FIPS)
        yr["mun_geoid"] = yr.apply(
            lambda r: resolve_geoid(tiger_lookup, r["county_fips"], r["TOWN"]), axis=1
        )
        # Groupby to collapse any duplicate mun_geoid matches
        yr_matched = (
            yr.dropna(subset=["mun_geoid"])
            .groupby("mun_geoid")[[priv_col]]
            .sum()
            .rename(columns={priv_col: f"priv_est_{year}"})
            .reset_index()
        )
        historical.append(yr_matched)

    # Merge historical columns
    hist_df = historical[0]
    for df in historical[1:]:
        hist_df = hist_df.merge(df, on="mun_geoid", how="outer")

    # --- Build 2023 sector breakdown ---
    t2023 = totals[totals["YEAR"] == 2023].copy()
    w2023 = wages[wages["YEAR"] == 2023].copy()

    for col in list(SECTORS.keys()) + [priv_col]:
        if col in t2023.columns:
            t2023[col] = pd.to_numeric(t2023[col], errors="coerce").fillna(0)
        if col in w2023.columns:
            w2023[col] = pd.to_numeric(w2023[col], errors="coerce")

    t2023["county_fips"] = t2023["COUNTY"].map(COUNTY_TO_FIPS)
    w2023["county_fips"] = w2023["COUNTY"].map(COUNTY_TO_FIPS)

    t2023["mun_geoid"] = t2023.apply(
        lambda r: resolve_geoid(tiger_lookup, r["county_fips"], r["TOWN"]), axis=1
    )
    w2023["mun_geoid"] = w2023.apply(
        lambda r: resolve_geoid(tiger_lookup, r["county_fips"], r["TOWN"]), axis=1
    )

    # Build sector establishment count columns
    sector_est_cols = {col: f"sec_{short}" for col, short in SECTORS.items() if col in t2023.columns}
    sector_wage_cols = {col: f"wage_{short}" for col, short in SECTORS.items() if col in w2023.columns}

    t2023_agg = (
        t2023.dropna(subset=["mun_geoid"])
        .groupby("mun_geoid")[list(sector_est_cols.keys()) + [priv_col]]
        .sum()
        .rename(columns={**sector_est_cols, priv_col: "private_establishments"})
        .reset_index()
    )

    # Weighted average annual wage (weight = establishment count)
    merged_wages = t2023[["mun_geoid", priv_col]].merge(
        w2023[["mun_geoid"] + list(sector_wage_cols.keys())],
        on="mun_geoid", how="left"
    ).dropna(subset=["mun_geoid"])

    # Simple per-sector wage columns (already per-worker avg from the source)
    w2023_agg = (
        w2023.dropna(subset=["mun_geoid"])
        .groupby("mun_geoid")[list(sector_wage_cols.keys())]
        .mean()  # mean of municipality-level avg wages (approximation for 2023)
        .rename(columns=sector_wage_cols)
        .reset_index()
    )

    # Weighted overall avg wage = sum(establishments * wage) / sum(establishments)
    merged_for_wage = (
        t2023[["mun_geoid", priv_col]].dropna(subset=["mun_geoid"])
        .merge(w2023[["mun_geoid", priv_col]].rename(columns={priv_col: "avg_wage_mun"})
               .dropna(subset=["mun_geoid"]),
               on="mun_geoid", how="left")
    )
    merged_for_wage[priv_col] = pd.to_numeric(merged_for_wage[priv_col], errors="coerce").fillna(0)
    merged_for_wage["wage_weight"] = merged_for_wage[priv_col] * merged_for_wage["avg_wage_mun"]
    wage_agg = (
        merged_for_wage.groupby("mun_geoid")
        .agg(ww=("wage_weight", "sum"), we=(priv_col, "sum"))
        .reset_index()
    )
    wage_agg["avg_annual_wage"] = (wage_agg["ww"] / wage_agg["we"]).round(0)
    wage_agg = wage_agg[["mun_geoid", "avg_annual_wage"]]

    # top sector
    sec_cols = list(sector_est_cols.values())

    def top_sector(row):
        vals = {c: row[c] for c in sec_cols if c in row.index and pd.notna(row[c]) and row[c] > 0}
        if not vals:
            return None
        return max(vals, key=vals.get).replace("sec_", "").replace("_", " ")

    t2023_agg["top_sector"] = t2023_agg.apply(top_sector, axis=1)

    # --- Load ACS Demographics ---
    print("Loading ACS demographics...")
    acs_csv = DATA_DIR / "nj_acs.csv"
    acs = pd.read_csv(acs_csv)
    # Ensure GEOID is stripped/padded correctly to match mun_geoid (10 digits)
    acs["mun_geoid"] = acs["GEOID"].astype(str).str.zfill(10)

    # --- Assemble final DataFrame ---
    econ = (
        t2023_agg
        .merge(w2023_agg, on="mun_geoid", how="left")
        .merge(wage_agg, on="mun_geoid", how="left")
        .merge(hist_df, on="mun_geoid", how="left")
    )
    
    # Merge demographics
    econ = econ.merge(acs.drop(columns=["GEOID"]), on="mun_geoid", how="outer")

    print(f"  Matched {econ['mun_geoid'].nunique()} municipalities with data "
          f"out of {len(gdf)} total")

    # --- Spatial join ---
    result = gdf.merge(econ, on="mun_geoid", how="left")

    # Ensure numeric columns are proper types
    demographics_cols = [
        "median_income", "population", "poverty_rate", "unemployment_rate",
        "median_age", "pct_male", "pct_female", "pct_under_18", "pct_65_plus"
    ]
    num_cols = (
        ["private_establishments", "avg_annual_wage"]
        + [f"priv_est_{y}" for y in range(2018, 2024)]
        + list(sector_est_cols.values())
        + list(sector_wage_cols.values())
        + demographics_cols
    )
    for col in num_cols:
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors="coerce")

    print(f"Writing {len(result)} municipalities to {OUT_PATH}...")
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result.to_file(OUT_PATH, driver="GeoJSON")

    size_mb = OUT_PATH.stat().st_size / (1024 * 1024)
    print(f"  Done. {len(result)} municipalities, {size_mb:.1f} MB")

    matched = result["private_establishments"].notna().sum()
    print(f"  {matched}/{len(result)} municipalities with 2023 economic data")

    print("\nSample (sorted by private establishments):")
    print(result.nlargest(6, "private_establishments")[
        ["mun_name", "county_name", "private_establishments", "avg_annual_wage", "top_sector"]
    ].to_string(index=False))


if __name__ == "__main__":
    main()
