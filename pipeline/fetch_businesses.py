"""
fetch_businesses.py
Download named business POIs for NJ using Overpass API.
Fetches only nodes with a name tag (much faster than full area queries).
Saves pipeline/data/nj_businesses.csv
"""

import pathlib
import requests
import pandas as pd
import time

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# NJ bounding box: [south, west, north, east]
NJ_BBOX = [38.9, -75.6, 41.4, -73.9]
S, W, N, E = NJ_BBOX

# Only fetch NODES with a name (ways add huge volume, unnamed add no value)
# Split into 3 smaller queries to avoid gateway timeout
QUERIES = [
    # Commercial / retail
    f"""[out:json][timeout:60];
(
  node["shop"]["name"]({S},{W},{N},{E});
  node["amenity"~"restaurant|cafe|bar|fast_food|bank|pharmacy|fuel|parking|hotel|hospital|clinic|dentist|gym|school|university|library"]["name"]({S},{W},{N},{E});
);
out body;""",

    # Offices and professional services
    f"""[out:json][timeout:60];
(
  node["office"]["name"]({S},{W},{N},{E});
  node["amenity"~"post_office|police|fire_station|townhall|courthouse|community_centre"]["name"]({S},{W},{N},{E});
);
out body;""",

    # Other amenities
    f"""[out:json][timeout:60];
(
  node["amenity"~"cinema|theatre|museum|arts_centre|nightclub|casino|marketplace"]["name"]({S},{W},{N},{E});
  node["tourism"~"hotel|hostel|motel|attraction|museum"]["name"]({S},{W},{N},{E});
  node["leisure"~"sports_centre|stadium|golf_course"]["name"]({S},{W},{N},{E});
);
out body;""",
]

OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_businesses.csv"


def fetch_query(query: str, attempt: int = 0) -> list[dict]:
    """Fetch a single Overpass query with retry."""
    try:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
        print(f"    Got {len(elements)} elements")
        return elements
    except Exception as e:
        if attempt < 2:
            print(f"    Retry {attempt + 1} after error: {e}")
            time.sleep(5)
            return fetch_query(query, attempt + 1)
        print(f"    Failed: {e}")
        return []


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    print("Fetching NJ business POIs from OpenStreetMap (Overpass API)...")

    all_records: list[dict] = []
    seen_ids: set[int] = set()

    for i, query in enumerate(QUERIES, 1):
        print(f"  Query {i}/{len(QUERIES)}...")
        elements = fetch_query(query)
        time.sleep(2)  # be polite to Overpass

        for el in elements:
            osm_id = el.get("id")
            if osm_id in seen_ids:
                continue
            seen_ids.add(osm_id)

            tags = el.get("tags", {})
            lat = el.get("lat")
            lon = el.get("lon")
            if lat is None or lon is None:
                continue

            name = tags.get("name", "")
            if not name:
                continue

            # Determine primary category
            if "shop" in tags:
                category, btype = "shop", tags["shop"]
            elif "office" in tags:
                category, btype = "office", tags["office"]
            elif "tourism" in tags:
                category, btype = "amenity", tags["tourism"]
            elif "leisure" in tags:
                category, btype = "amenity", tags["leisure"]
            else:
                category, btype = "amenity", tags.get("amenity", "business")

            all_records.append({
                "osm_id": osm_id,
                "name": name,
                "type": btype,
                "category": category,
                "latitude": lat,
                "longitude": lon,
            })

    df = pd.DataFrame(all_records)
    df.to_csv(OUT_PATH, index=False)
    print(f"  Saved {len(df)} named businesses → {OUT_PATH}")


if __name__ == "__main__":
    main()
