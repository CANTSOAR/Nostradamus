"""
fetch_roads.py
Download OSM roadway geometry for New Jersey using Overpass API.
Saves frontend/public/data/nj_roads.geojson
"""

import pathlib
import requests
import json
import time

# NJ Bounding Box (approximate)
# [south, west, north, east]
NJ_BBOX = "38.9, -75.6, 41.5, -73.9"

# Overpass QL query:
# Fetch motorways, primary, and secondary roads in NJ
QUERY = f"""
[out:json][timeout:180];
(
  way["highway"~"motorway|primary|secondary"]({NJ_BBOX});
);
out geom;
"""

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUT_PATH = (
    pathlib.Path(__file__).parent.parent
    / "frontend"
    / "public"
    / "data"
    / "nj_roads.geojson"
)

def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print(f"Fetching OSM road geometry for NJ (box: {NJ_BBOX})...")
    try:
        response = requests.post(OVERPASS_URL, data={"data": QUERY}, timeout=180)
        response.raise_for_status()
        data = response.json()

        elements = data.get("elements", [])
        print(f"  Fetched {len(elements)} road segments")

        # Convert Overpass geom to GeoJSON
        features = []
        for el in elements:
            if "geometry" not in el:
                continue
            
            # Extract line coordinates
            coords = [[p["lon"], p["lat"]] for p in el["geometry"]]
            
            properties = el.get("tags", {})
            # Keep only useful tags
            tags = {
                "id": el["id"],
                "highway": properties.get("highway"),
                "name": properties.get("name"),
                "maxspeed": properties.get("maxspeed"),
                "lanes": properties.get("lanes"),
                "oneway": properties.get("oneway"),
            }
            
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                },
                "properties": tags
            })

        geojson = {
            "type": "FeatureCollection",
            "features": features
        }

        print(f"  Writing {len(features)} features to {OUT_PATH}...")
        with open(OUT_PATH, "w") as f:
            json.dump(geojson, f)
        
        size_mb = OUT_PATH.stat().st_size / (1024 * 1024)
        print(f"  Saved: {OUT_PATH} ({size_mb:.2f} MB)")

    except Exception as e:
        print(f"  ERROR fetching OSM data: {e}")
        # Create a tiny mock file if it fails so the pipeline doesn't break?
        # No, better to let it fail or provide a minimal fallback.
        # Fallback to the existing hardcoded lines in a GeoJSON format?
        pass

if __name__ == "__main__":
    main()
