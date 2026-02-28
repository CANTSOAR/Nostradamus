"""
process_certified_biz.py
Count NJ state-certified businesses (MBE/WBE/SBE) by county.

Input:  pipeline/data/NJ_Certified_Businesses_by_Zip_Code_20260228.csv
Output: pipeline/data/nj_certified_biz_by_county.csv

Uses Census 2020 ZCTA-to-county relationship file to map zip codes to counties.
Falls back to a zip-prefix heuristic if the Census download fails.
"""

import pathlib
import io
import requests
import pandas as pd

DATA_DIR = pathlib.Path(__file__).parent / "data"
BIZ_CSV = DATA_DIR / "NJ_Certified_Businesses_by_Zip_Code_20260228.csv"
OUT_CSV = DATA_DIR / "nj_certified_biz_by_county.csv"

ZCTA_COUNTY_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/"
    "tab20_zcta520_county20_natl.txt"
)

# Fallback: NJ 3-char zip prefix → county FIPS (rough approximation)
_PREFIX_FALLBACK = {
    "070": "039", "071": "013", "072": "027", "073": "027",
    "074": "003", "075": "041", "076": "027", "077": "035",
    "078": "035", "079": "021", "080": "005", "081": "023",
    "082": "025", "083": "029", "084": "025", "085": "021",
    "086": "023", "087": "023", "088": "025", "089": "039",
}


def load_zcta_crosswalk() -> dict:
    """Download Census ZCTA-to-county crosswalk and return {zip5: county_fips_3} for NJ."""
    print("Downloading Census ZCTA-to-county crosswalk...")
    try:
        resp = requests.get(ZCTA_COUNTY_URL, timeout=60)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), sep="|", dtype=str)

        # Keep only NJ counties (state FIPS 34)
        df = df[df["GEOID_COUNTY_20"].str.startswith("34")].copy()

        # For ZCTAs that span multiple counties, keep the county with the largest overlap
        df["AREALAND_PART"] = pd.to_numeric(df["AREALAND_PART"], errors="coerce").fillna(0)
        df = df.sort_values("AREALAND_PART", ascending=False)
        df = df.drop_duplicates(subset=["GEOID_ZCTA5_20"], keep="first")

        # 3-digit county FIPS = chars [2:5] of the 5-digit county GEOID
        crosswalk = {
            row["GEOID_ZCTA5_20"]: row["GEOID_COUNTY_20"][2:]
            for _, row in df.iterrows()
        }
        print(f"  Loaded {len(crosswalk)} NJ zip→county mappings")
        return crosswalk
    except Exception as e:
        print(f"  Census download failed ({e}), using prefix fallback")
        return {}


def main():
    print(f"Loading certified businesses from {BIZ_CSV}...")
    biz = pd.read_csv(BIZ_CSV, encoding="latin-1", dtype=str)
    biz.columns = [c.strip() for c in biz.columns]
    print(f"  {len(biz)} total rows")

    # Clean zip codes: keep first 5 digits
    biz["zip5"] = biz["BUSINESS ZIP"].str.strip().str[:5]

    # Keep NJ businesses (07xxx or 08xxx zip codes)
    biz = biz[biz["zip5"].str.match(r"^0[78]\d{3}$", na=False)].copy()
    print(f"  {len(biz)} NJ businesses after zip filter")

    crosswalk = load_zcta_crosswalk()

    def resolve_county(z: str) -> str | None:
        if z in crosswalk:
            return crosswalk[z]
        return _PREFIX_FALLBACK.get(z[:3])

    biz["county_fips"] = biz["zip5"].map(resolve_county)
    mapped = biz["county_fips"].notna().sum()
    print(f"  {mapped}/{len(biz)} businesses mapped to a county")

    result = (
        biz.dropna(subset=["county_fips"])
        .groupby("county_fips")
        .size()
        .reset_index(name="certified_biz_count")
    )

    print(f"\nSaving {len(result)} county rows to {OUT_CSV}")
    result.to_csv(OUT_CSV, index=False)

    print("\nCertified businesses by county:")
    print(result.sort_values("certified_biz_count", ascending=False).to_string(index=False))


if __name__ == "__main__":
    main()
