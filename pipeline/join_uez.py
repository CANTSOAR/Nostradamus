"""
join_uez.py
Spatially join UEZ (Urban Enterprise Zone) municipal data to NJ census tracts.

Strategy:
  1. Download NJ municipality (MCD) boundaries from TIGER if not cached
  2. For each tract, find which municipality it belongs to (centroid-in-polygon)
  3. Join UEZ municipal attributes to tracts
  4. Output: pipeline/data/nj_uez_by_tract.csv (joined to GEOID)

The enriched GeoJSON picks this up in join_and_enrich.py (step 6).

Expected input files in pipeline/data/uez/:
  muni_info_yearly.csv    — yearly municipality stats (use most recent year)
  municipality_industrial.csv — industrial employment by municipality
  muni_info_2022.csv      — 2022 snapshot (merged from Excel)
"""

import pathlib
import zipfile
import io
import requests
import geopandas as gpd
import pandas as pd
import numpy as np

DATA_DIR = pathlib.Path(__file__).parent / "data"
UEZ_DIR = DATA_DIR / "uez"
OUT_CSV = DATA_DIR / "nj_uez_by_tract.csv"

# TIGER MCD (municipality) boundaries for NJ (state FIPS 34)
TIGER_MCD_URL = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_34_cousub_500k.zip"
MCD_CACHE = DATA_DIR / "nj_mcd_boundaries.geojson"

# Tract boundaries (already fetched by fetch_boundaries.py)
TRACT_BOUNDARIES = DATA_DIR / "nj_tract_boundaries.geojson"


def load_mcd_boundaries() -> gpd.GeoDataFrame:
    """Load NJ municipality (MCD) boundaries, downloading if needed."""
    if MCD_CACHE.exists():
        print(f"  Using cached MCD boundaries: {MCD_CACHE.name}")
        return gpd.read_file(MCD_CACHE)

    print("  Downloading NJ municipality boundaries from Census TIGER...")
    r = requests.get(TIGER_MCD_URL, timeout=120)
    r.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        z.extractall(DATA_DIR / "_mcd_tmp")

    shp_files = list((DATA_DIR / "_mcd_tmp").glob("*.shp"))
    if not shp_files:
        raise FileNotFoundError("No shapefile found in MCD download")

    gdf = gpd.read_file(shp_files[0])
    gdf = gdf.to_crs(epsg=4326)

    # Clean up
    import shutil
    shutil.rmtree(DATA_DIR / "_mcd_tmp")

    gdf.to_file(MCD_CACHE, driver="GeoJSON")
    print(f"  {len(gdf)} municipalities saved to {MCD_CACHE.name}")
    return gdf


def normalize_muni_name(s: pd.Series) -> pd.Series:
    """Lowercase, strip whitespace, remove common suffixes for fuzzy matching."""
    s = s.astype(str).str.lower().str.strip()
    # Remove common NJ municipality suffixes
    for suffix in [" township", " borough", " city", " town", " village", " cdp"]:
        s = s.str.replace(suffix, "", regex=False)
    return s.str.strip()


def load_uez_data() -> pd.DataFrame | None:
    """Load and merge available UEZ CSV files. Returns None if none available."""
    dfs = []

    yearly_path = UEZ_DIR / "muni_info_yearly.csv"
    if yearly_path.exists():
        print(f"  Loading {yearly_path.name}...")
        df = pd.read_csv(yearly_path, low_memory=False)
        print(f"    Columns: {list(df.columns)}")
        print(f"    Shape: {df.shape}")

        # Detect municipality name column
        muni_col = _find_column(df, ["municipality", "muni_name", "muni", "name", "MuniName",
                                     "municipality_name", "NAME", "MUNI"])
        year_col = _find_column(df, ["year", "Year", "YEAR"])

        if muni_col:
            df = df.rename(columns={muni_col: "muni_name"})
            # Use the most recent year if there are multiple
            if year_col:
                df = df.rename(columns={year_col: "year"})
                latest_year = df["year"].max()
                df = df[df["year"] == latest_year].copy()
                print(f"    Using year: {latest_year}")
            df["_muni_key"] = normalize_muni_name(df["muni_name"])
            dfs.append(df)

    industrial_path = UEZ_DIR / "municipality_industrial.csv"
    if industrial_path.exists():
        print(f"  Loading {industrial_path.name}...")
        df2 = pd.read_csv(industrial_path, low_memory=False)
        print(f"    Columns: {list(df2.columns)}")

        muni_col2 = _find_column(df2, ["municipality", "muni_name", "muni", "name", "MuniName",
                                        "municipality_name", "NAME", "MUNI"])
        if muni_col2:
            df2 = df2.rename(columns={muni_col2: "muni_name"})
            df2["_muni_key"] = normalize_muni_name(df2["muni_name"])
            # Prefix industrial columns to avoid collision
            industrial_cols = [c for c in df2.columns if c not in ["muni_name", "_muni_key"]]
            df2 = df2.rename(columns={c: f"industrial_{c}" for c in industrial_cols})
            dfs.append(df2)

    snapshot_path = UEZ_DIR / "muni_info_2022.csv"
    if snapshot_path.exists() and not yearly_path.exists():
        # Only use snapshot if yearly not available
        print(f"  Loading {snapshot_path.name}...")
        df3 = pd.read_csv(snapshot_path, low_memory=False)
        print(f"    Columns: {list(df3.columns)}")
        muni_col3 = _find_column(df3, ["municipality", "muni_name", "muni", "name", "MuniName",
                                        "municipality_name", "NAME", "MUNI"])
        if muni_col3:
            df3 = df3.rename(columns={muni_col3: "muni_name"})
            df3["_muni_key"] = normalize_muni_name(df3["muni_name"])
            dfs.append(df3)

    if not dfs:
        return None

    # Merge all UEZ dataframes on _muni_key
    result = dfs[0]
    for df_extra in dfs[1:]:
        result = result.merge(df_extra, on="_muni_key", how="outer", suffixes=("", "_dup"))
        # Drop duplicate columns
        result = result[[c for c in result.columns if not c.endswith("_dup")]]

    return result


def _find_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Find first matching column name (case-insensitive)."""
    lower_map = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand in df.columns:
            return cand
        if cand.lower() in lower_map:
            return lower_map[cand.lower()]
    return None


def main():
    # Check for UEZ data
    if not UEZ_DIR.exists() or not any(UEZ_DIR.glob("*.csv")):
        print("ERROR: No UEZ CSV files found in pipeline/data/uez/")
        print("Run: python fetch_uez.py")
        return

    print("Loading tract boundaries...")
    tracts = gpd.read_file(TRACT_BOUNDARIES)
    tracts["GEOID"] = tracts["GEOID"].astype(str).str.zfill(11)
    tracts_wgs = tracts.to_crs(epsg=4326)

    print("Loading municipality boundaries...")
    mcd = load_mcd_boundaries()

    print("Loading UEZ municipal data...")
    uez = load_uez_data()
    if uez is None:
        print("ERROR: Could not parse any UEZ files. Check column names.")
        return
    print(f"  {len(uez)} municipalities in UEZ data")

    # Spatial join: assign each tract centroid to a municipality
    print("Spatially joining tracts → municipalities...")
    tract_centroids = tracts_wgs.copy()
    tract_centroids["geometry"] = tracts_wgs.geometry.centroid

    joined = gpd.sjoin(
        tract_centroids[["GEOID", "geometry"]],
        mcd[["NAMELSAD", "geometry"]].rename(columns={"NAMELSAD": "mcd_name"}),
        how="left",
        predicate="within",
    )
    joined = joined[["GEOID", "mcd_name"]].drop_duplicates(subset="GEOID")
    print(f"  {joined['mcd_name'].notna().sum()} / {len(joined)} tracts matched to a municipality")

    # Normalize MCD names for join
    joined["_muni_key"] = normalize_muni_name(joined["mcd_name"].fillna(""))

    # Join UEZ data
    uez_cols = [c for c in uez.columns if c not in ["muni_name", "mcd_name"]]
    result = joined.merge(uez[uez_cols], on="_muni_key", how="left")

    # Report match rate
    # Find any meaningful UEZ column to check
    data_cols = [c for c in result.columns if c not in ["GEOID", "mcd_name", "_muni_key"]]
    if data_cols:
        first_col = data_cols[0]
        matched = result[first_col].notna().sum()
        print(f"  UEZ data matched for {matched} / {len(result)} tracts ({100*matched/len(result):.0f}%)")

    # Drop join keys, keep GEOID + all UEZ columns
    out_cols = ["GEOID", "mcd_name"] + [c for c in uez_cols if c != "_muni_key"]
    output = result[[c for c in out_cols if c in result.columns]].copy()

    # Numeric conversion
    for col in output.columns:
        if col not in ["GEOID", "mcd_name"]:
            output[col] = pd.to_numeric(output[col], errors="ignore")

    output.to_csv(OUT_CSV, index=False)
    size_kb = OUT_CSV.stat().st_size / 1024
    print(f"\nWrote {OUT_CSV.name} ({size_kb:.0f} KB, {len(output)} rows)")
    print("\nAvailable UEZ columns for frontend:")
    for col in output.columns:
        if col not in ["GEOID", "mcd_name", "_muni_key"]:
            non_null = output[col].notna().sum()
            print(f"  {col}: {non_null} non-null values")


if __name__ == "__main__":
    main()
