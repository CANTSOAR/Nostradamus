"""
fetch_municipalities.py
Download NJ county subdivision (municipality) boundaries from Census TIGER/Line 2023.
Output: pipeline/data/nj_municipalities.geojson  (~565 municipalities)
"""

import pathlib
import io
import zipfile
import requests
import geopandas as gpd

URL = "https://www2.census.gov/geo/tiger/TIGER2023/COUSUB/tl_2023_34_cousub.zip"
OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_municipalities.geojson"


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("Downloading NJ municipality boundaries from Census TIGER (2023)...")
    resp = requests.get(URL, timeout=120)
    resp.raise_for_status()

    print(f"  Downloaded {len(resp.content) / 1024:.0f} KB")

    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        # Find the .shp file inside the archive
        shp_names = [n for n in z.namelist() if n.endswith(".shp")]
        if not shp_names:
            raise RuntimeError("No .shp file found in ZIP")
        shp_name = shp_names[0]

        # Extract all shapefile components to a temp location geopandas can read
        import tempfile, os
        with tempfile.TemporaryDirectory() as tmpdir:
            z.extractall(tmpdir)
            shp_path = os.path.join(tmpdir, shp_name)
            gdf = gpd.read_file(shp_path)

    print(f"  Loaded {len(gdf)} features")

    # Reproject to WGS84
    gdf = gdf.to_crs("EPSG:4326")

    # Keep relevant columns; LSAD codes for inhabited places (exclude water bodies)
    # LSAD codes: 20=township, 21=township, 25=city, 43=borough, 47=town, 57=village
    # Code 00 = balance of county (water/unincorporated) — exclude those
    gdf = gdf[gdf["LSAD"] != "00"].copy()

    # Extract the legal suffix type from NAMELSAD (e.g., "Absecon city" → "city")
    gdf["mun_type"] = gdf["NAMELSAD"].str.extract(r"\s+(city|township|borough|town|village|CDP)$",
                                                    expand=False).fillna("municipality")

    gdf = gdf.rename(columns={
        "GEOID": "mun_geoid",
        "NAME": "mun_name",
        "COUNTYFP": "county_fips",
    })

    gdf = gdf[["mun_geoid", "mun_name", "mun_type", "county_fips", "geometry"]].copy()
    gdf["mun_geoid"] = gdf["mun_geoid"].str.zfill(10)
    gdf["county_fips"] = gdf["county_fips"].str.zfill(3)

    print(f"  {len(gdf)} municipalities after filtering")

    # Simplify geometry to reduce file size (~11m tolerance, sufficient for web map)
    gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.0001, preserve_topology=True)
    gdf.to_file(OUT_PATH, driver="GeoJSON")
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"  Saved to {OUT_PATH} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
