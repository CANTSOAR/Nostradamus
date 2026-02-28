"""
fetch_njtransit.py
Downloads NJ Transit static GTFS feeds (Bus + Rail) and converts to GeoJSON:
  - stops.geojson    – all transit stop locations
  - routes.geojson   – simplified route line geometries (from shapes.txt)

Outputs:
  pipeline/data/njtransit/stops.geojson
  pipeline/data/njtransit/routes.geojson
"""

import io
import csv
import json
import zipfile
import pathlib
import requests
from collections import defaultdict

FEEDS = {
    # Working public mirrors from Mobility Database (no login required)
    "bus": "https://files.mobilitydatabase.org/mdb-508/mdb-508-202601160105/mdb-508-202601160105.zip",
    "rail": "https://files.mobilitydatabase.org/mdb-509/mdb-509-202602250053/mdb-509-202602250053.zip",
}

OUT_DIR = pathlib.Path(__file__).parent / "data" / "njtransit"

ROUTE_COLORS = {
    "0": "#f97316",   # tram
    "1": "#818cf8",   # subway/metro
    "2": "#60a5fa",   # rail
    "3": "#facc15",   # bus
    "4": "#34d399",   # ferry
}


def download_gtfs(url: str) -> zipfile.ZipFile:
    print(f"  Downloading {url}...")
    resp = requests.get(url, timeout=300, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    print(f"    {len(resp.content) / 1024 / 1024:.1f} MB downloaded")
    return zipfile.ZipFile(io.BytesIO(resp.content))


def read_csv(zf: zipfile.ZipFile, filename: str) -> list[dict]:
    if filename not in zf.namelist():
        return []
    with zf.open(filename) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")))


def parse_stops(zf: zipfile.ZipFile, feed_name: str) -> list[dict]:
    rows = read_csv(zf, "stops.txt")
    features = []
    for row in rows:
        try:
            lat = float(row["stop_lat"])
            lon = float(row["stop_lon"])
        except (KeyError, ValueError):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "stop_id": row.get("stop_id", ""),
                "stop_name": row.get("stop_name", ""),
                "feed": feed_name,
            },
        })
    return features


def parse_shapes(zf: zipfile.ZipFile, feed_name: str) -> list[dict]:
    """Build one LineString per shape_id, then join with route info."""
    shape_rows = read_csv(zf, "shapes.txt")
    trip_rows = read_csv(zf, "trips.txt")
    route_rows = read_csv(zf, "routes.txt")

    # shape_id → sorted list of [lon, lat]
    shape_pts: dict[str, list] = defaultdict(list)
    for row in shape_rows:
        try:
            shape_pts[row["shape_id"]].append((
                int(row.get("shape_pt_sequence", 0)),
                float(row["shape_pt_lon"]),
                float(row["shape_pt_lat"]),
            ))
        except (KeyError, ValueError):
            continue

    # Deduplicate shape_id → route_id (one trip per shape, take first)
    shape_to_route: dict[str, str] = {}
    for row in trip_rows:
        sid = row.get("shape_id", "")
        if sid and sid not in shape_to_route:
            shape_to_route[sid] = row.get("route_id", "")

    # route_id → route meta
    route_meta = {r["route_id"]: r for r in route_rows}

    features = []
    seen_routes: set[str] = set()

    for shape_id, pts in shape_pts.items():
        pts.sort(key=lambda x: x[0])
        coords = [[p[1], p[2]] for p in pts]
        route_id = shape_to_route.get(shape_id, "")

        # One geometry per unique route (skip duplicate shapes)
        if route_id in seen_routes:
            continue
        seen_routes.add(route_id)

        meta = route_meta.get(route_id, {})
        route_type = meta.get("route_type", "3")
        color = f"#{meta.get('route_color', '').strip() or 'facc15'}"

        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "route_id": route_id,
                "route_short_name": meta.get("route_short_name", ""),
                "route_long_name": meta.get("route_long_name", ""),
                "route_type": route_type,
                "color": color,
                "feed": feed_name,
            },
        })

    return features


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    all_stops: list[dict] = []
    all_routes: list[dict] = []

    for feed_name, url in FEEDS.items():
        print(f"\nProcessing {feed_name} feed...")
        try:
            zf = download_gtfs(url)
            stops = parse_stops(zf, feed_name)
            routes = parse_shapes(zf, feed_name)
            print(f"  Stops: {len(stops)}, Routes: {len(routes)}")
            all_stops.extend(stops)
            all_routes.extend(routes)
        except Exception as e:
            print(f"  Error processing {feed_name}: {e}")

    stops_path = OUT_DIR / "stops.geojson"
    routes_path = OUT_DIR / "routes.geojson"

    with open(stops_path, "w") as f:
        json.dump({"type": "FeatureCollection", "features": all_stops}, f)
    with open(routes_path, "w") as f:
        json.dump({"type": "FeatureCollection", "features": all_routes}, f)

    print(f"\nSaved: {stops_path}")
    print(f"Saved: {routes_path}")
    print(f"Total stops: {len(all_stops)}, Total routes: {len(all_routes)}")


if __name__ == "__main__":
    main()
