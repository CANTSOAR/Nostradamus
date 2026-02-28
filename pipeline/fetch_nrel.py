"""
fetch_nrel.py
Fetches EV charging station locations in NJ from the NREL/AFDC API.
Uses NREL_API_KEY from .env (falls back to DEMO_KEY for testing).

Output: pipeline/data/nrel/ev_stations.geojson
"""

import json
import pathlib
import requests
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv("NREL_API_KEY", "DEMO_KEY")
BASE_URL = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json"

OUT_DIR = pathlib.Path(__file__).parent / "data" / "nrel"
OUT_PATH = OUT_DIR / "ev_stations.geojson"

# Map EV level codes → human-readable labels
EV_LEVEL_LABELS = {
    "1": "Level 1",
    "2": "Level 2",
    "dc_fast": "DC Fast Charge",
}


def fetch_stations() -> list[dict]:
    params = {
        "api_key": API_KEY,
        "state": "NJ",
        "fuel_type": "ELEC",
        "status": "E",  # Open
        "limit": "all",
    }

    print(f"Fetching EV stations from NREL AFDC (key={'DEMO_KEY' if API_KEY == 'DEMO_KEY' else '***'})...")
    resp = requests.get(BASE_URL, params=params, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    stations = data.get("fuel_stations", [])
    print(f"  Found {len(stations)} stations")
    return stations


def to_geojson(stations: list[dict]) -> dict:
    features = []
    for s in stations:
        lat = s.get("latitude")
        lon = s.get("longitude")
        if lat is None or lon is None:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "id": s.get("id"),
                "name": s.get("station_name", ""),
                "address": s.get("street_address", ""),
                "city": s.get("city", ""),
                "zip": s.get("zip", ""),
                "access": s.get("access_code", ""),  # public/private
                "ev_level1_evse_num": s.get("ev_level1_evse_num"),
                "ev_level2_evse_num": s.get("ev_level2_evse_num"),
                "ev_dc_fast_num": s.get("ev_dc_fast_num"),
                "network": s.get("ev_network", ""),
                "connector_types": s.get("ev_connector_types", ""),
                "owner_type": s.get("owner_type_code", ""),
            },
        })
    return {"type": "FeatureCollection", "features": features}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stations = fetch_stations()
    geojson = to_geojson(stations)
    with open(OUT_PATH, "w") as f:
        json.dump(geojson, f)
    print(f"  Saved: {OUT_PATH} ({len(geojson['features'])} features)")


if __name__ == "__main__":
    main()
