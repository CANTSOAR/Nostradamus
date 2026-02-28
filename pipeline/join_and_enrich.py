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

    # --- Load New Data ---
    LODES_CSV = pathlib.Path(__file__).parent / "data" / "nj_lodes_summary.csv"
    HUD_CSV = pathlib.Path(__file__).parent / "data" / "nj_hud_rents.csv"

    print("Loading LODES data...")
    lodes = pd.read_csv(LODES_CSV, dtype={"GEOID": str})
    print(f"  {len(lodes)} LODES rows")

    print("Loading HUD data...")
    hud = pd.read_csv(HUD_CSV, dtype={"county_fips": str})
    hud["county_fips"] = hud["county_fips"].str.zfill(3)
    print(f"  {len(hud)} HUD rows")

    # --- Join ACS onto boundaries (on 11-digit GEOID) ---
    gdf["GEOID"] = gdf["GEOID"].astype(str).str.zfill(11)
    acs["GEOID"] = acs["GEOID"].astype(str).str.zfill(11)
    merged = gdf.merge(acs, on="GEOID", how="left")
    
    # --- Join LODES (on 11-digit GEOID) ---
    lodes["GEOID"] = lodes["GEOID"].astype(str).str.zfill(11)
    merged = merged.merge(lodes, on="GEOID", how="left")
    
    print(f"  After ACS/LODES join: {len(merged)} tracts")

    # --- Extract county portion (positions 2–5 of GEOID = county FIPS) ---
    # GEOID format: SS CCC TTTTTT (2-digit state, 3-digit county, 6-digit tract)
    merged["county_fips"] = merged["GEOID"].str[2:5]

    # --- Join QCEW and HUD on county portion ---
    merged = merged.merge(qcew, on="county_fips", how="left")
    merged = merged.merge(hud, on="county_fips", how="left")
    
    print(f"  After county-level joins: {merged['county_employment'].notna().sum()} with emp, {merged['rent_2br'].notna().sum()} with rent")

    # --- Ensure consistent types / replace NaN with None ---
    float_cols = [
        "median_income", "poverty_count", "unemployed", "population",
        "poverty_rate", "unemployment_rate", "county_employment",
        "commuter_outflow", "local_job_count", "rent_2br",
    ]
    # Also coerce any UEZ-sourced numeric columns
    uez_numeric_prefixes = ("industrial_", "uez_")
    for col in merged.columns:
        if any(col.startswith(p) for p in uez_numeric_prefixes):
            float_cols.append(col)
    for col in float_cols:
        if col in merged.columns:
            merged[col] = pd.to_numeric(merged[col], errors="coerce")

    # --- Join UEZ municipal data (optional — only if join_uez.py has been run) ---
    UEZ_BY_TRACT = pathlib.Path(__file__).parent / "data" / "nj_uez_by_tract.csv"
    if UEZ_BY_TRACT.exists():
        print("Loading UEZ municipal data...")
        uez = pd.read_csv(UEZ_BY_TRACT, dtype={"GEOID": str})
        uez["GEOID"] = uez["GEOID"].astype(str).str.zfill(11)
        # Exclude mcd_name if it duplicates existing columns
        merge_cols = [c for c in uez.columns if c == "GEOID" or c not in merged.columns]
        merged = merged.merge(uez[merge_cols], on="GEOID", how="left")
        print(f"  UEZ join: {len(merged)} tracts after merge")
    else:
        print("(Skipping UEZ data — run fetch_uez.py + join_uez.py to add it)")

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
