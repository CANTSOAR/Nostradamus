"""
fetch_overture.py
Download building footprints for NJ using DuckDB to query Overture Parquet files.
Saves pipeline/data/nj_buildings_overture.geojson
"""

import pathlib
import duckdb

# Bounding box for New Jersey (approximate)
# format: west, south, east, north
NJ_BBOX = {
    "xmin": -75.6,
    "ymin": 38.9,
    "xmax": -73.9,
    "ymax": 41.4
}

OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_buildings_overture.geojson"

def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print(f"Fetching Overture building footprints for NJ using DuckDB...")
    
    try:
        con = duckdb.connect()
        con.execute("INSTALL spatial; LOAD spatial;")
        con.execute("INSTALL httpfs; LOAD httpfs;")
        
        # Overture Maps S3 URL (Publicly accessible via HTTP)
        # Using the latest 2026 release path identified via S3 LS
        query = f"""
        COPY (
            SELECT
                id,
                names.primary as name,
                type,
                ST_AsGeoJSON(geometry) as geometry
            FROM read_parquet('s3://overturemaps-us-west-2/release/2026-02-18.0/theme=buildings/type=building/*.parquet')
            WHERE ST_Within(geometry, ST_MakeEnvelope({NJ_BBOX['xmin']}, {NJ_BBOX['ymin']}, {NJ_BBOX['xmax']}, {NJ_BBOX['ymax']}))
            LIMIT 5000 
        ) TO '{OUT_PATH}' WITH (FORMAT GDAL, DRIVER 'GeoJSON');
        """
        
        print("  Running DuckDB query against Overture S3 data...")
        con.execute(query)
        print(f"  Successfully saved to {OUT_PATH}")
        
    except Exception as e:
        print(f"  ERROR fetching Overture data with DuckDB: {e}")
        # Create a tiny mock file if DuckDB fails
        print("  Creating minimal mock buildings data for development...")
        with open(OUT_PATH, 'w') as f:
            f.write('{"type": "FeatureCollection", "features": []}')

if __name__ == "__main__":
    main()
