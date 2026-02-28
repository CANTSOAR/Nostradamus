"""
fetch_fema.py
Downloads Flood Hazard Zone polygons for NJ from the NJDEP Hydrography MapServer
(Layer 28: Flood Plan Locator). This service is more reliable for NJ-wide
extents than the national FEMA service.

Output: pipeline/data/fema/flood_zones.geojson
"""

import pathlib
import json
import requests

# NJDEP Hydrography MapServer - Layer 28 is Flood Plan Locator
BASE_URL = (
    "https://mapsdep.nj.gov/arcgis/rest/services/Features/Hydrography/MapServer/28/query"
)

OUT_DIR = pathlib.Path(__file__).parent / "data" / "fema"
OUT_PATH = OUT_DIR / "flood_zones.geojson"

BATCH_SIZE = 1000
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; NJ-Infra-Pipeline/1.0)"}


def fetch_all():
    """Paginate through all flood zone features for NJ."""
    features = []
    offset = 0

    while True:
        params = {
            "where": "1=1",
            "outSR": "4326",
            "outFields": "*",
            "resultOffset": offset,
            "resultRecordCount": BATCH_SIZE,
            "f": "geojson",
        }

        print(f"  Fetching records {offset}...")
        resp = requests.get(BASE_URL, params=params, timeout=180, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("features", [])
        features.extend(batch)

        if len(batch) < BATCH_SIZE:
            break
        offset += BATCH_SIZE

    print(f"  Total features: {len(features)}")
    return {
        "type": "FeatureCollection",
        "features": features,
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Fetching Flood Zones from NJDEP Hydrography MapServer...")
    try:
        geojson = fetch_all()
        with open(OUT_PATH, "w") as f:
            json.dump(geojson, f)
        print(f"  Saved: {OUT_PATH}")
    except Exception as e:
        print(f"  Error: {e}")


if __name__ == "__main__":
    main()
