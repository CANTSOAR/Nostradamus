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
    "B01001_001E": "population",
    "B19013_001E": "median_income",
    "B17001_002E": "poverty_count",
    "B23025_005E": "unemployed",
    "B01002_001E": "median_age",
    "B01001_002E": "pop_male",
    "B01001_026E": "pop_female",
    "B09001_001E": "pop_under_18",
}

# 65+ age buckets to sum
OLD_AGE_VARS = [
    f"B01001_0{i}E" for i in range(20, 26)
] + [
    f"B01001_0{i}E" for i in range(44, 50)
]

OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_acs.csv"


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # confirmed syntax: for=county subdivision:*&in=state:34&in=county:*
    # Use a set to ensure no duplicate variables in the 'get' parameter
    unique_vars = sorted(list(set(["NAME", "B01001_001E"] + list(VARS.keys()) + OLD_AGE_VARS)))
    get_vars = ",".join(unique_vars)
    params_list = [
        ("get", get_vars),
        ("for", "county subdivision:*"),
        ("in", "state:34"),
        ("in", "county:*"),
    ]
    if CENSUS_API_KEY:
        params_list.append(("key", CENSUS_API_KEY))

    print("Fetching ACS 5-year data for NJ municipalities (MCDs)...")
    resp = requests.get(ACS_URL, params=params_list, timeout=60)
    print(f"  Response Status: {resp.status_code}")
    
    # Census returns HTML (not JSON) for invalid keys — detect and retry without key
    if resp.headers.get("content-type", "").startswith("text/html"):
        print(f"Error Content:\n{resp.text[:500]}")
        raise RuntimeError("Census API returned HTML instead of JSON.")

    try:
        data = resp.json()
    except Exception as e:
        print(f"Failed to decode JSON. Response text:\n{resp.text[:1000]}")
        raise e

    headers, *rows = data
    df = pd.DataFrame(rows, columns=headers)

    # Filter out "County subdivisions not defined" (MCD 00000)
    if "county subdivision" in df.columns:
        df = df[df["county subdivision"] != "00000"].copy()

    # Construct 10-digit GEOID from state + county + county subdivision
    df["GEOID"] = df["state"] + df["county"] + df["county subdivision"]

    # Rename ACS variable columns
    df = df.rename(columns=VARS)

    # Convert to numeric, replace sentinel with None
    # We want to convert all columns that were originally in VARS.values() or OLD_AGE_VARS
    numeric_targets = sorted(list(set(list(VARS.values()) + OLD_AGE_VARS + ["population"])))
    for col in numeric_targets:
        if col in df.columns:
            # If multiple columns have same name, take first
            if isinstance(df[col], pd.DataFrame):
                df[col] = df[col].iloc[:, 0]
            df[col] = pd.to_numeric(df[col], errors="coerce")
            df.loc[df[col] == ACS_SENTINEL, col] = None

    # Sum 65+ population
    # Filter OLD_AGE_VARS to only those present in columns
    exist_old = [v for v in OLD_AGE_VARS if v in df.columns]
    df["pop_65_plus"] = df[exist_old].sum(axis=1) if exist_old else 0

    # Compute derived rates (guard against divide-by-zero)
    pop = df["population"].replace(0, float("nan"))
    df["poverty_rate"] = df["poverty_count"] / pop
    df["unemployment_rate"] = df["unemployed"] / pop
    df["pct_male"] = df["pop_male"] / pop
    df["pct_female"] = df["pop_female"] / pop
    df["pct_under_18"] = df["pop_under_18"] / pop
    df["pct_65_plus"] = df["pop_65_plus"] / pop

    # Clip rates to [0, 1]
    rate_cols = ["poverty_rate", "unemployment_rate", "pct_male", "pct_female", "pct_under_18", "pct_65_plus"]
    for col in rate_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").clip(0, 1)

    # Keep only needed columns
    keep = [
        "GEOID",
        "median_income",
        "population",
        "poverty_rate",
        "unemployment_rate",
        "median_age",
        "pct_male",
        "pct_female",
        "pct_under_18",
        "pct_65_plus",
    ]
    df = df[keep]

    print(f"  Municipalities fetched: {len(df)}")
    print(f"  Population sample:\n{df['population'].describe()}")
    df.to_csv(OUT_PATH, index=False)
    print(f"  Saved: {OUT_PATH}")


if __name__ == "__main__":
    main()
