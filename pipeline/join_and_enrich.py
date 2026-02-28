"""
join_and_enrich.py
Merge TIGER boundaries + ACS data + QCEW data into one enriched GeoJSON.
Writes to frontend/public/data/nj_tracts_enriched.geojson
"""

import pathlib
import json
import geopandas as gpd
import pandas as pd

BOUNDARIES = pathlib.Path(__file__).parent / "data" / "nj_tract_boundaries.geojson"
ACS_CSV = pathlib.Path(__file__).parent / "data" / "nj_acs.csv"
QCEW_CSV = pathlib.Path(__file__).parent / "data" / "nj_qcew.csv"
OUT_PATH = (
    pathlib.Path(__file__).parent.parent
    / "frontend"
    / "public"
    / "data"
    / "nj_tracts_enriched.geojson"
)


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # --- Load inputs ---
    print("Loading boundaries...")
    gdf = gpd.read_file(BOUNDARIES)
    print(f"  {len(gdf)} tract boundaries")

    print("Loading ACS data...")
    acs = pd.read_csv(ACS_CSV, dtype={"GEOID": str})
    print(f"  {len(acs)} ACS rows")

    print("Loading QCEW data...")
    qcew = pd.read_csv(QCEW_CSV, dtype={"county_fips": str})
    # Pad county FIPS to 3 digits
    qcew["county_fips"] = qcew["county_fips"].str.zfill(3)
    print(f"  {len(qcew)} QCEW rows")

    # --- Join ACS onto boundaries (on 11-digit GEOID) ---
    gdf["GEOID"] = gdf["GEOID"].astype(str).str.zfill(11)
    acs["GEOID"] = acs["GEOID"].astype(str).str.zfill(11)
    merged = gdf.merge(acs, on="GEOID", how="left")
    print(f"  After ACS join: {len(merged)} tracts, {merged['median_income'].notna().sum()} with income data")

    # --- Extract county portion (positions 2–5 of GEOID = county FIPS) ---
    # GEOID format: SS CCC TTTTTT (2-digit state, 3-digit county, 6-digit tract)
    merged["county_fips"] = merged["GEOID"].str[2:5]

    # --- Join QCEW on county portion ---
    merged = merged.merge(qcew, on="county_fips", how="left")
    print(f"  After QCEW join: {merged['county_employment'].notna().sum()} tracts with employment data")

    # --- Ensure consistent types / replace NaN with None ---
    float_cols = [
        "median_income", "poverty_count", "unemployed", "population",
        "poverty_rate", "unemployment_rate", "county_employment",
    ]
    for col in float_cols:
        if col in merged.columns:
            merged[col] = pd.to_numeric(merged[col], errors="coerce")

    # --- Write output ---
    print(f"Writing enriched GeoJSON to {OUT_PATH}...")
    merged.to_file(OUT_PATH, driver="GeoJSON")

    # Verify output
    size_mb = OUT_PATH.stat().st_size / (1024 * 1024)
    print(f"  Done. {len(merged)} tracts, {size_mb:.1f} MB")

    # Quick sanity check: no sentinel values
    for col in float_cols:
        if col in merged.columns:
            bad = (merged[col] == -666666666).sum()
            if bad > 0:
                print(f"  WARNING: {bad} sentinel values remain in {col}")

    print("\nVerification summary:")
    print(merged[["GEOID", "median_income", "poverty_rate", "unemployment_rate", "county_employment"]].head(3).to_string())


if __name__ == "__main__":
    main()
