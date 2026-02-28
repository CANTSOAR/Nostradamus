"""
fetch_eia.py
Fetches NJ electricity load/demand data from the EIA API v2.

Data retrieved:
1. Real-time hourly regional demand for the PJM balancing area (covers NJ).
2. NJ net electricity generation by energy source (monthly, latest 24 months).

Uses EIA_API_KEY from .env.
  Free key: https://www.eia.gov/opendata/

Outputs:
  pipeline/data/eia/pjm_demand.json   – hourly demand timeseries
  pipeline/data/eia/nj_generation.json – monthly generation by source
"""

import json
import pathlib
import requests
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta

load_dotenv()

API_KEY = os.getenv("EIA_API_KEY", "")
BASE_URL = "https://api.eia.gov/v2"

OUT_DIR = pathlib.Path(__file__).parent / "data" / "eia"


def eia_get(path: str, params: dict) -> dict:
    if not API_KEY:
        raise ValueError(
            "EIA_API_KEY not set in .env — get a free key at https://www.eia.gov/opendata/"
        )
    params["api_key"] = API_KEY
    url = f"{BASE_URL}/{path}"
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def fetch_pjm_demand() -> dict:
    """
    Hourly demand (D) for PJM balancing authority (BAA), last 72 hours.
    EIA RTO/ISO Hourly Demand endpoint.
    """
    print("Fetching PJM real-time demand (last 72h)...")

    end = datetime.utcnow()
    start = end - timedelta(hours=72)

    data = eia_get("electricity/rto/region-data/data/", {
        "frequency": "hourly",
        "data[0]": "value",
        "facets[respondent][]": "PJM",
        "facets[type][]": "D",
        "start": start.strftime("%Y-%m-%dT%H"),
        "end": end.strftime("%Y-%m-%dT%H"),
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": 500,
        "offset": 0,
    })

    records = data.get("response", {}).get("data", [])
    print(f"  Records: {len(records)}")

    return {
        "source": "EIA v2 RTO regional demand",
        "balancing_authority": "PJM",
        "type": "D",
        "unit": "megawatthours",
        "notes": "PJM covers NJ plus surrounding states; represents regional grid load",
        "data": [
            {"period": r["period"], "value": r.get("value")} for r in records
        ],
    }


def fetch_nj_generation() -> dict:
    """
    Monthly net generation by energy source for NJ, last 24 months.
    """
    print("Fetching NJ net generation by source (last 24 months)...")

    end = datetime.utcnow()
    start = end - timedelta(days=730)

    data = eia_get("electricity/electric-power-operational-data/data/", {
        "frequency": "monthly",
        "data[0]": "generation",
        "facets[location][]": "NJ",
        "facets[sectorid][]": "99",  # All sectors
        "start": start.strftime("%Y-%m"),
        "end": end.strftime("%Y-%m"),
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": 500,
        "offset": 0,
    })

    records = data.get("response", {}).get("data", [])
    print(f"  Records: {len(records)}")

    return {
        "source": "EIA v2 Electric Power Operational Data",
        "state": "NJ",
        "unit": "thousand megawatthours",
        "data": [
            {
                "period": r["period"],
                "fueltypeid": r.get("fueltypeid", ""),
                "fueltype": r.get("fuelTypeDescription", ""),
                "generation": r.get("generation"),
            }
            for r in records
        ],
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if not API_KEY:
        print("WARNING: EIA_API_KEY not set in pipeline/.env")
        print("  Register free at https://www.eia.gov/opendata/ then add EIA_API_KEY=yourkey to .env")
        print("  Skipping EIA data fetch.")
        return

    # Fetch demand timeseries
    demand = fetch_pjm_demand()
    demand_path = OUT_DIR / "pjm_demand.json"
    with open(demand_path, "w") as f:
        json.dump(demand, f)
    print(f"  Saved: {demand_path}")

    # Fetch generation by source
    gen = fetch_nj_generation()
    gen_path = OUT_DIR / "nj_generation.json"
    with open(gen_path, "w") as f:
        json.dump(gen, f)
    print(f"  Saved: {gen_path}")


if __name__ == "__main__":
    main()
