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
INDUSTRY_CSV = pathlib.Path(__file__).parent / "data" / "nj_industry_by_county.csv"
CERTIFIED_BIZ_CSV = pathlib.Path(__file__).parent / "data" / "nj_certified_biz_by_county.csv"
OUT_PATH = (
    pathlib.Path(__file__).parent.parent
    / "frontend"
    / "public"
    / "data"
    / "nj_tracts_enriched.geojson"
)
BUILDINGS_OUT = OUT_PATH.parent / "nj_buildings_highlight.geojson"
PARCELS_OUT = OUT_PATH.parent / "nj_parcels_commercial.geojson"


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
    BUSINESSES_CSV = pathlib.Path(__file__).parent / "data" / "nj_businesses.csv"
    BUILDINGS_GEOJSON = pathlib.Path(__file__).parent / "data" / "nj_buildings_overture.geojson"
    PARCELS_GEOJSON = pathlib.Path(__file__).parent / "data" / "nj_parcels.geojson"

    print("Loading LODES data...")
    lodes = pd.read_csv(LODES_CSV, dtype={"GEOID": str})
    print(f"  {len(lodes)} LODES rows")

    print("Loading HUD data...")
    hud = pd.read_csv(HUD_CSV, dtype={"county_fips": str})
    hud["county_fips"] = hud["county_fips"].str.zfill(3)
    print(f"  {len(hud)} HUD rows")

    print("Loading Business POI data...")
    biz = pd.read_csv(BUSINESSES_CSV)
    biz_gdf = gpd.GeoDataFrame(
        biz, geometry=gpd.points_from_xy(biz.longitude, biz.latitude), crs="EPSG:4326"
    )
    print(f"  {len(biz_gdf)} Business POIs")
    
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

    # --- Join industry and certified business data (optional) ---
    if INDUSTRY_CSV.exists():
        print("Loading industry-by-county data...")
        industry = pd.read_csv(INDUSTRY_CSV, dtype={"county_fips": str})
        industry["county_fips"] = industry["county_fips"].str.zfill(3)
        # Only join scalar columns (skip sector_* detail and top_sector text for tract layer)
        industry_cols = ["county_fips", "private_establishments", "avg_annual_wage"]
        merged = merged.merge(industry[industry_cols], on="county_fips", how="left")
        print(f"  Industry join: {merged['avg_annual_wage'].notna().sum()} tracts with wage data")
    else:
        print("(Skipping industry data — run process_industry.py to add it)")

    if CERTIFIED_BIZ_CSV.exists():
        print("Loading certified business counts...")
        cert_biz = pd.read_csv(CERTIFIED_BIZ_CSV, dtype={"county_fips": str})
        cert_biz["county_fips"] = cert_biz["county_fips"].str.zfill(3)
        merged = merged.merge(cert_biz, on="county_fips", how="left")
        print(f"  Certified biz join: {merged['certified_biz_count'].notna().sum()} tracts with data")
    else:
        print("(Skipping certified biz data — run process_certified_biz.py to add it)")

    print(f"  After county-level joins: {merged['county_employment'].notna().sum()} with emp, {merged['rent_2br'].notna().sum()} with rent")

    # --- Spatial Join: Businesses per Tract ---
    print("Computing business density per tract...")
    # Ensure merged is a GeoDataFrame and in same CRS as biz_gdf
    merged = merged.to_crs(biz_gdf.crs)
    biz_counts = gpd.sjoin(biz_gdf, merged, how="inner", predicate="within")
    biz_counts_series = biz_counts.groupby("index_right").size()
    merged["business_count"] = biz_counts_series
    merged["business_count"] = merged["business_count"].fillna(0)

    # --- Ensure consistent types / replace NaN with None ---
    float_cols = [
        "median_income", "poverty_count", "unemployed", "population",
        "poverty_rate", "unemployment_rate", "county_employment",
        "commuter_outflow", "local_job_count", "rent_2br",
        "median_home_value", "business_count",
        "private_establishments", "avg_annual_wage", "certified_biz_count",
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

    # --- Generate Spatial Layers ---
    print("Generating building highlight layer...")
    if BUILDINGS_GEOJSON.exists():
        buildings = gpd.read_file(BUILDINGS_GEOJSON)
        # Spatial join buildings to tracts that have business_count > 0
        busy_tracts = merged[merged["business_count"] > 0]
        if not busy_tracts.empty and not buildings.empty:
            buildings_highlight = gpd.sjoin(buildings.to_crs(merged.crs), busy_tracts, how="inner", predicate="within")
            buildings_highlight.to_file(BUILDINGS_OUT, driver="GeoJSON")
            print(f"  Saved {len(buildings_highlight)} building footprints to {BUILDINGS_OUT.name}")
    
    print("Generating commercial parcel layer...")
    if PARCELS_GEOJSON.exists():
        parcels = gpd.read_file(PARCELS_GEOJSON)
        # Filter for commercial land use codes if available, or just parcels in busy areas
        if not parcels.empty:
            # Note: Specific PMOD attribute filter would go here
            parcels.to_file(PARCELS_OUT, driver="GeoJSON")
            print(f"  Saved {len(parcels)} parcel boundaries to {PARCELS_OUT.name}")

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
