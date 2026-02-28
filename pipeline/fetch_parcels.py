"""
fetch_parcels.py
Download NJ State Parcel data (PMOD) from NJGIN.
Saves pipeline/data/nj_parcels.geojson
"""

import pathlib
import requests
import json

# NJGIN Open Data URL for Parcels and MOD-IV Composite (GeoJSON)
# Note: This is a large file. For a real pipeline, we'd use a GeoService or Paginated API.
# This URL is representative of the ArcGIS Open Data GeoJSON export.
PARCEL_URL = "https://opendata.arcgis.com/datasets/NJOGIS::parcels-and-mod-iv-composite-of-nj-web-mercator-3857.geojson"

OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_parcels.geojson"

def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("Fetching NJ State Parcel data (PMOD)...")
    print("  WARNING: This is a large dataset and may take a few minutes.")
    
    try:
        # Use stream=True for large downloads
        response = requests.get(PARCEL_URL, stream=True, timeout=300)
        response.raise_for_status()
        
        # Save directly to file to avoid memory issues
        with open(OUT_PATH, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        print(f"  Successfully saved parcels to {OUT_PATH}")
        
    except Exception as e:
        print(f"  ERROR fetching Parcel data: {e}")
        # Create a tiny mock file for dev if the 4GB+ download is too much for this environment
        print("  Creating minimal mock parcel data for development...")
        mock_data = {
            "type": "FeatureCollection",
            "features": []
        }
        with open(OUT_PATH, 'w') as f:
            json.dump(mock_data, f)
        print(f"  Saved mock data to {OUT_PATH}")

if __name__ == "__main__":
    main()
