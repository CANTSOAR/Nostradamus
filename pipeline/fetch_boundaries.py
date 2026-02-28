"""
fetch_boundaries.py
Download NJ Census TIGER/Line tract shapefile (2023), reproject to WGS84,
and save as GeoJSON to pipeline/data/nj_tract_boundaries.geojson
"""

import io
import zipfile
import pathlib
import requests
import geopandas as gpd

TIGER_URL = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_34_tract_500k.zip"
OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_tract_boundaries.geojson"


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("Downloading TIGER/Line shapefile for NJ tracts (2023)...")
    resp = requests.get(TIGER_URL, timeout=120)
    resp.raise_for_status()
    print(f"  Downloaded {len(resp.content) / 1024:.0f} KB")

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        # Extract to a temp dir in memory via geopandas
        shp_name = next(n for n in zf.namelist() if n.endswith(".shp"))
        # Write all associated files to temp dir
        tmp_dir = pathlib.Path("/tmp/nj_tiger_tract")
        tmp_dir.mkdir(parents=True, exist_ok=True)
        zf.extractall(tmp_dir)

    shp_path = tmp_dir / pathlib.Path(shp_name).name
    print(f"  Reading shapefile: {shp_path}")
    gdf = gpd.read_file(shp_path)

    # TIGER uses NAD83 (EPSG:4269) — must reproject to WGS84
    print(f"  Source CRS: {gdf.crs}")
    gdf = gdf.to_crs(epsg=4326)
    print(f"  Reprojected to: {gdf.crs}")

    # Keep only essential columns
    keep = ["GEOID", "NAME", "geometry"]
    gdf = gdf[[c for c in keep if c in gdf.columns]]

    print(f"  Tracts found: {len(gdf)}")
    gdf.to_file(OUT_PATH, driver="GeoJSON")
    print(f"  Saved: {OUT_PATH}")


if __name__ == "__main__":
    main()
