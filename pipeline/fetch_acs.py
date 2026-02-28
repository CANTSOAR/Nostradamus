"""
fetch_acs.py
Pull Census ACS 5-year (2023) economic variables for all NJ tracts.
Saves pipeline/data/nj_acs.csv
"""

import os
import pathlib
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

CENSUS_API_KEY = os.getenv("CENSUS_API_KEY", "")
ACS_URL = "https://api.census.gov/data/2023/acs/acs5"
ACS_SENTINEL = -666666666

# Variables to fetch
VARS = {
    "B19013_001E": "median_income",
    "B17001_002E": "poverty_count",
    "B23025_005E": "unemployed",
    "B01003_001E": "population",
    "B25077_001E": "median_home_value",
}

OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_acs.csv"


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    get_vars = ",".join(["GEO_ID"] + list(VARS.keys()))
    params: dict[str, str] = {
        "get": get_vars,
        "for": "tract:*",
        "in": "state:34",
    }
    if CENSUS_API_KEY:
        params["key"] = CENSUS_API_KEY
    else:
        print("  NOTE: No CENSUS_API_KEY set — proceeding without key (rate-limited).")
        print("  Get a free key at: https://api.census.gov/data/key_signup.html")

    print("Fetching ACS 5-year data for NJ tracts...")
    resp = requests.get(ACS_URL, params=params, timeout=60)
    resp.raise_for_status()

    # Census returns HTML (not JSON) for invalid keys — detect and retry without key
    if resp.headers.get("content-type", "").startswith("text/html"):
        if "key" in params:
            print("  WARNING: API key rejected (got HTML). Retrying without key (rate-limited).")
            params.pop("key")
            resp = requests.get(ACS_URL, params=params, timeout=60)
            resp.raise_for_status()
        if resp.headers.get("content-type", "").startswith("text/html"):
            raise RuntimeError(f"Census API returned HTML instead of JSON:\n{resp.text[:400]}")

    data = resp.json()
    headers, *rows = data
    df = pd.DataFrame(rows, columns=headers)

    # Strip "1400000US" prefix from GEO_ID to get 11-digit GEOID
    df["GEOID"] = df["GEO_ID"].str.replace("1400000US", "", regex=False)

    # Rename ACS variable columns
    df = df.rename(columns=VARS)

    # Convert to numeric, replace sentinel with None
    for col in VARS.values():
        df[col] = pd.to_numeric(df[col], errors="coerce")
        df.loc[df[col] == ACS_SENTINEL, col] = None

    # Compute derived rates (guard against divide-by-zero)
    df["poverty_rate"] = df["poverty_count"] / df["population"]
    df["unemployment_rate"] = df["unemployed"] / df["population"]

    # Clip rates to [0, 1]
    df["poverty_rate"] = df["poverty_rate"].clip(0, 1)
    df["unemployment_rate"] = df["unemployment_rate"].clip(0, 1)

    # Keep only needed columns
    keep = [
        "GEOID",
        "median_income",
        "poverty_count",
        "unemployed",
        "population",
        "poverty_rate",
        "unemployment_rate",
        "median_home_value",
    ]
    df = df[keep]

    print(f"  Tracts fetched: {len(df)}")
    print(f"  Median income sample: {df['median_income'].describe()}")
    df.to_csv(OUT_PATH, index=False)
    print(f"  Saved: {OUT_PATH}")


if __name__ == "__main__":
    main()
