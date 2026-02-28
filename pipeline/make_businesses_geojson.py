"""
make_businesses_geojson.py
Convert nj_businesses.csv (OSM POIs) to a GeoJSON for the frontend.
Limits to named businesses and outputs to frontend/public/data/nj_businesses.geojson.
"""
import pathlib, json
import pandas as pd

SRC = pathlib.Path(__file__).parent / "data" / "nj_businesses.csv"
DST = pathlib.Path(__file__).parent.parent / "frontend" / "public" / "data" / "nj_businesses.geojson"
MAX_FEATURES = 8000

def fmt_type(t: str | None) -> str:
    if not t:
        return "Business"
    return t.replace("_", " ").title()

def main():
    if not SRC.exists():
        print(f"ERROR: {SRC} not found — run fetch_businesses.py first")
        return

    df = pd.read_csv(SRC)
    print(f"Loaded {len(df)} rows")

    # Keep only rows with valid coords
    df = df.dropna(subset=["latitude", "longitude"])
    # Prefer named businesses, remove "Unknown" names
    named = df[df["name"] != "Unknown"].copy()
    unnamed = df[df["name"] == "Unknown"].copy()
    print(f"  Named: {len(named)}, Unnamed: {len(unnamed)}")

    # Sample to cap: prioritize named ones
    if len(named) > MAX_FEATURES:
        named = named.sample(MAX_FEATURES, random_state=42)
    df_out = named

    features = []
    for _, row in df_out.iterrows():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(row["longitude"]), float(row["latitude"])]
            },
            "properties": {
                "name": str(row["name"]),
                "type": fmt_type(str(row.get("type", "")) if pd.notna(row.get("type")) else ""),
                "category": str(row.get("category", "")) if pd.notna(row.get("category")) else "",
            }
        })

    geojson = {"type": "FeatureCollection", "features": features}
    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(json.dumps(geojson, separators=(",", ":")))
    print(f"Wrote {len(features)} features → {DST}")
    size_mb = DST.stat().st_size / 1e6
    print(f"File size: {size_mb:.2f} MB")

if __name__ == "__main__":
    main()
