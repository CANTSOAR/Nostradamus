"""
fetch_businesses.py
Download business POIs (amenity, shop, office) for NJ using Overpass API.
Saves pipeline/data/nj_businesses.csv
"""

import pathlib
import requests
import pandas as pd
import io
import time

# Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding box for New Jersey (approximate)
# format: [south, west, north, east]
NJ_BBOX = [38.9, -75.6, 41.4, -73.9]

QUERY = f"""
[out:json][timeout:90];
(
  node["amenity"]({NJ_BBOX[0]},{NJ_BBOX[1]},{NJ_BBOX[2]},{NJ_BBOX[3]});
  node["shop"]({NJ_BBOX[0]},{NJ_BBOX[1]},{NJ_BBOX[2]},{NJ_BBOX[3]});
  node["office"]({NJ_BBOX[0]},{NJ_BBOX[1]},{NJ_BBOX[2]},{NJ_BBOX[3]});
  way["amenity"]({NJ_BBOX[0]},{NJ_BBOX[1]},{NJ_BBOX[2]},{NJ_BBOX[3]});
  way["shop"]({NJ_BBOX[0]},{NJ_BBOX[1]},{NJ_BBOX[2]},{NJ_BBOX[3]});
  way["office"]({NJ_BBOX[0]},{NJ_BBOX[1]},{NJ_BBOX[2]},{NJ_BBOX[3]});
);
out center;
"""

OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_businesses.csv"

def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("Fetching NJ business POIs from OpenStreetMap (Overpass API)...")
    try:
        response = requests.post(OVERPASS_URL, data={"data": QUERY}, timeout=120)
        response.raise_for_status()
        data = response.json()
        
        elements = data.get("elements", [])
        print(f"  Found {len(elements)} elements")
        
        records = []
        for el in elements:
            tags = el.get("tags", {})
            # Use center lat/lon for ways, or direct lat/lon for nodes
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lon = el.get("lon") or el.get("center", {}).get("lon")
            
            if lat is None or lon is None:
                continue
                
            records.append({
                "osm_id": el.get("id"),
                "name": tags.get("name", "Unknown"),
                "type": tags.get("amenity") or tags.get("shop") or tags.get("office"),
                "category": "amenity" if "amenity" in tags else ("shop" if "shop" in tags else "office"),
                "latitude": lat,
                "longitude": lon
            })
            
        df = pd.DataFrame(records)
        df.to_csv(OUT_PATH, index=False)
        print(f"  Saved {len(df)} businesses to {OUT_PATH}")
        
    except Exception as e:
        print(f"  ERROR fetching OSM data: {e}")
        # Create an empty file to avoid breaking the pipeline
        pd.DataFrame(columns=["osm_id", "name", "type", "category", "latitude", "longitude"]).to_csv(OUT_PATH, index=False)
        print(f"  Saved empty CSV to {OUT_PATH}")

if __name__ == "__main__":
    main()
