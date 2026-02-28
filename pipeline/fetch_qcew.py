"""
fetch_qcew.py
Download BLS QCEW 2023 annual county employment data for all 21 NJ counties.
Saves pipeline/data/nj_qcew.csv
"""

import pathlib
import requests
import pandas as pd
import io

# NJ FIPS 34 + 21 county codes (001, 003, ..., 041)
# BLS area codes use state FIPS + county FIPS: e.g. "US34001" for Atlantic County
NJ_COUNTY_FIPS = [
    "001", "003", "005", "007", "009", "011", "013", "015",
    "017", "019", "021", "023", "025", "027", "029", "031",
    "033", "035", "037", "039", "041",
]

BLS_URL = "https://data.bls.gov/cew/data/api/2023/a/area/34{county_fips}.csv"
OUT_PATH = pathlib.Path(__file__).parent / "data" / "nj_qcew.csv"

HEADERS = {
    "User-Agent": "palantir-at-home/0.1 (educational project)",
}


def fetch_county(fips: str) -> pd.DataFrame | None:
    url = BLS_URL.format(county_fips=fips)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text))
        # Filter: own_code==0 (all ownerships), industry_code=="10" (total, all industries)
        mask = (df["own_code"] == 0) & (df["industry_code"].astype(str).str.strip() == "10")
        filtered = df[mask].copy()
        if filtered.empty:
            print(f"  WARNING: No matching rows for county {fips}")
            return None
        filtered["county_fips"] = fips
        return filtered[["county_fips", "annual_avg_emplvl"]].head(1)
    except Exception as e:
        print(f"  ERROR fetching county {fips}: {e}")
        return None


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("Fetching BLS QCEW 2023 for 21 NJ counties...")
    records = []
    for fips in NJ_COUNTY_FIPS:
        result = fetch_county(fips)
        if result is not None:
            records.append(result)
            print(f"  County {fips}: {result['annual_avg_emplvl'].values[0]:,} avg employed")
        else:
            # Insert null row so join still works
            records.append(pd.DataFrame([{"county_fips": fips, "annual_avg_emplvl": None}]))

    df = pd.concat(records, ignore_index=True)
    df = df.rename(columns={"annual_avg_emplvl": "county_employment"})
    df["county_employment"] = pd.to_numeric(df["county_employment"], errors="coerce")

    print(f"\n  Counties fetched: {len(df)}")
    df.to_csv(OUT_PATH, index=False)
    print(f"  Saved: {OUT_PATH}")


if __name__ == "__main__":
    main()
