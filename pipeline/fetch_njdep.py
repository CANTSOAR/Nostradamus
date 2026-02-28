"""
fetch_njdep.py
Downloads NJDEP datasets (Grid, Water, Climate) from the official
mapsdep.nj.gov MapServer and ArcGIS Open Data.
Paginates in batches of 1000 where needed.

Outputs: pipeline/data/njdep/
"""

import pathlib
import json
import requests

# (name, url or feature_service_base, type)
# type = "mapserver" → append /query params
# type = "geojson"   → direct download
DATASETS = {
    # Electric Grid & Energy  (mapsdep.nj.gov MapServer layers)
    "electric_utilities": {
        "url": "https://mapsdep.nj.gov/arcgis/rest/services/Features/Utilities/MapServer/10",
        "type": "mapserver",
    },
    "power_plants": {
        "url": "https://mapsdep.nj.gov/arcgis/rest/services/Features/Utilities/MapServer/20",
        "type": "mapserver",
    },

    # Water & Sewage
    "sewer_service_areas": {
        "url": "https://mapsdep.nj.gov/arcgis/rest/services/Features/Utilities/MapServer/8",
        "type": "mapserver",
    },

    # Climate Change (direct GeoJSON from opendata.arcgis.com — these worked)
    "community_solar": {
        "url": "https://opendata.arcgis.com/datasets/dfa1235ba73b4ff999cc6500647b45a6_26.geojson",
        "type": "geojson",
    },
    "rggi_investments": {
        "url": "https://opendata.arcgis.com/datasets/af0e6038566743179c397f9b765c0f20_27.geojson",
        "type": "geojson",
    },
    "solar_grid_supply": {
        "url": "https://mapsdep.nj.gov/arcgis/rest/services/Features/Utilities/MapServer/16",
        "type": "mapserver",
    },
}

OUT_DIR = pathlib.Path(__file__).parent / "data" / "njdep"
BATCH = 1000
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; NJ-Infra-Pipeline/1.0)"}


def fetch_mapserver(name: str, base_url: str) -> list[dict]:
    """Paginate ArcGIS MapServer /query endpoint."""
    features: list[dict] = []
    offset = 0
    while True:
        params = {
            "where": "1=1",
            "outFields": "*",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": BATCH,
            "f": "geojson",
        }
        print(f"    offset={offset}...")
        resp = requests.get(f"{base_url}/query", params=params, timeout=180, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("features", [])
        features.extend(batch)
        if len(batch) < BATCH:
            break
        offset += BATCH
    return features


def fetch_geojson(name: str, url: str) -> list[dict]:
    """Direct GeoJSON download."""
    resp = requests.get(url, timeout=180, headers=HEADERS)
    resp.raise_for_status()
    try:
        data = resp.json()
    except Exception as e:
        print(f"  JSON parse error: {e}")
        return []
    return data.get("features", [])


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, cfg in DATASETS.items():
        print(f"Fetching {name}...")
        try:
            if cfg["type"] == "mapserver":
                features = fetch_mapserver(name, cfg["url"])
            else:
                features = fetch_geojson(name, cfg["url"])
            out = {"type": "FeatureCollection", "features": features}
            out_path = OUT_DIR / f"{name}.geojson"
            with open(out_path, "w") as f:
                json.dump(out, f)
            print(f"  Saved {len(features)} features → {out_path}")
        except Exception as e:
            print(f"  Error: {e}")


if __name__ == "__main__":
    main()
