"""
generate_counties.py
Dissolve nj_tracts_enriched.geojson by county_fips to produce county-level polygons.
Aggregates: population (sum), median_income/poverty_rate/unemployment_rate (mean),
            county_employment (first), rent_2br (first)
Writes to frontend/public/data/nj_counties_enriched.geojson (~21 features)
"""

import pathlib
import geopandas as gpd
import pandas as pd

INDUSTRY_CSV = pathlib.Path(__file__).parent / "data" / "nj_industry_by_county.csv"
CERTIFIED_BIZ_CSV = pathlib.Path(__file__).parent / "data" / "nj_certified_biz_by_county.csv"

IN_PATH = (
    pathlib.Path(__file__).parent.parent
    / "frontend"
    / "public"
    / "data"
    / "nj_tracts_enriched.geojson"
)
OUT_PATH = (
    pathlib.Path(__file__).parent.parent
    / "frontend"
    / "public"
    / "data"
    / "nj_counties_enriched.geojson"
)

# NJ county FIPS → name lookup (21 counties)
NJ_COUNTY_NAMES = {
    "001": "Atlantic",
    "003": "Bergen",
    "005": "Burlington",
    "007": "Camden",
    "009": "Cape May",
    "011": "Cumberland",
    "013": "Essex",
    "015": "Gloucester",
    "017": "Hudson",
    "019": "Hunterdon",
    "021": "Mercer",
    "023": "Middlesex",
    "025": "Monmouth",
    "027": "Morris",
    "029": "Ocean",
    "031": "Passaic",
    "033": "Salem",
    "035": "Somerset",
    "037": "Sussex",
    "039": "Union",
    "041": "Warren",
}


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading {IN_PATH}...")
    gdf = gpd.read_file(IN_PATH)
    print(f"  {len(gdf)} tract features")

    # Ensure county_fips is 3-digit string
    gdf["county_fips"] = gdf["county_fips"].astype(str).str.zfill(3)

    # Numeric columns to aggregate
    numeric_cols = [
        "median_income", "poverty_rate", "unemployment_rate",
        "population", "county_employment",
    ]
    # Optional columns that may exist
    optional_cols = ["rent_2br", "local_job_count", "commuter_outflow"]
    for col in optional_cols:
        if col in gdf.columns:
            numeric_cols.append(col)

    for col in numeric_cols:
        if col in gdf.columns:
            gdf[col] = pd.to_numeric(gdf[col], errors="coerce")

    # Build aggregation dict
    agg_dict: dict = {}
    for col in ["median_income", "poverty_rate", "unemployment_rate"]:
        if col in gdf.columns:
            agg_dict[col] = "mean"
    if "population" in gdf.columns:
        agg_dict["population"] = "sum"
    for col in ["county_employment", "rent_2br", "local_job_count", "commuter_outflow"]:
        if col in gdf.columns:
            agg_dict[col] = "first"

    print("Dissolving by county_fips...")
    counties = gdf.dissolve(by="county_fips", aggfunc=agg_dict).reset_index()

    # Add NAME column
    counties["NAME"] = counties["county_fips"].map(NJ_COUNTY_NAMES).fillna("Unknown")

    # --- Join industry data (full detail available at county level) ---
    if INDUSTRY_CSV.exists():
        print("Joining industry-by-county data...")
        industry = pd.read_csv(INDUSTRY_CSV, dtype={"county_fips": str})
        industry["county_fips"] = industry["county_fips"].str.zfill(3)
        counties = counties.merge(industry, on="county_fips", how="left")
        print(f"  Joined industry data for {industry['county_fips'].nunique()} counties")
    else:
        print("(Skipping industry data — run process_industry.py to generate it)")

    if CERTIFIED_BIZ_CSV.exists():
        print("Joining certified business counts...")
        cert_biz = pd.read_csv(CERTIFIED_BIZ_CSV, dtype={"county_fips": str})
        cert_biz["county_fips"] = cert_biz["county_fips"].str.zfill(3)
        counties = counties.merge(cert_biz, on="county_fips", how="left")
        print(f"  Joined certified biz data for {cert_biz['county_fips'].nunique()} counties")
    else:
        print("(Skipping certified biz data — run process_certified_biz.py to generate it)")

    print(f"  {len(counties)} county features")

    print(f"Writing to {OUT_PATH}...")
    counties.to_file(OUT_PATH, driver="GeoJSON")

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"  Done. {len(counties)} counties, {size_kb:.0f} KB")
    print("\nCounties:")
    for _, row in counties.sort_values("county_fips").iterrows():
        name = row.get("NAME", "?")
        fips = row["county_fips"]
        pop = row.get("population", None)
        pop_str = f"{int(pop):,}" if pd.notna(pop) else "N/A"
        print(f"  {fips} {name}: population={pop_str}")


if __name__ == "__main__":
    main()
