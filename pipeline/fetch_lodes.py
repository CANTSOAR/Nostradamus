"""
fetch_lodes.py
Download and process Census LODES (Origin-Destination) data for NJ.
Saves pipeline/data/nj_lodes_summary.csv (Aggregated commuters by tract).
"""

import pathlib
import requests
import pandas as pd
import gzip
import io

# LODES 8 NJ OD Main Job Type 00 (All) 2021
LODES_URL = "https://lehd.ces.census.gov/data/lodes/LODES8/nj/od/nj_od_main_JT00_2021.csv.gz"
OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_lodes_summary.csv"

def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("Downloading LODES OD data for NJ (2021)...")
    resp = requests.get(LODES_URL, timeout=180)
    resp.raise_for_status()
    print(f"  Downloaded {len(resp.content) / (1024*1024):.1f} MB")

    print("Processing LODES data (this may take a minute)...")
    with gzip.GzipFile(fileobj=io.BytesIO(resp.content)) as f:
        # LODES columns: w_geocode (Work), h_geocode (Home), S000 (Total Jobs)
        # We want to know:
        # 1. How many jobs are IN each Home tract (outflow)
        # 2. How many jobs exist in each Work tract (workplace count)
        df = pd.read_csv(f, dtype={"w_geocode": str, "h_geocode": str})

    # Home tract summary (Commuter Outflow)
    # GEOID in LODES is 15-digit (Block), we need 11-digit (Tract)
    df["h_tract"] = df["h_geocode"].str[:11]
    df["w_tract"] = df["w_geocode"].str[:11]

    # Outflow: Total workers living in tract
    outflow = df.groupby("h_tract")["S000"].sum().reset_index()
    outflow = outflow.rename(columns={"h_tract": "GEOID", "S000": "commuter_outflow"})

    # Inflow: Total jobs located in tract
    inflow = df.groupby("w_tract")["S000"].sum().reset_index()
    inflow = inflow.rename(columns={"w_tract": "GEOID", "S000": "local_job_count"})

    # Merge
    summary = pd.merge(outflow, inflow, on="GEOID", how="outer").fillna(0)

    print(f"  Processed {len(summary)} tracts")
    summary.to_csv(OUT_PATH, index=False)
    print(f"  Saved: {OUT_PATH}")

if __name__ == "__main__":
    main()
