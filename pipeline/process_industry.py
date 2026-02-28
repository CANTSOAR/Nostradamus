"""
process_industry.py
Aggregate 2023 NJ industrial sector data (establishment counts + avg wages)
from municipality level to county level.

Inputs:
  pipeline/data/industrial_sector_totals.csv   (establishment counts by sector)
  pipeline/data/industrial_sector_annual_wages.csv (avg annual wage by sector)
Outputs:
  pipeline/data/nj_industry_by_county.csv
"""

import pathlib
import pandas as pd

DATA_DIR = pathlib.Path(__file__).parent / "data"
TOTALS_CSV = DATA_DIR / "industrial_sector_totals.csv"
WAGES_CSV = DATA_DIR / "industrial_sector_annual_wages.csv"
OUT_CSV = DATA_DIR / "nj_industry_by_county.csv"

# Uppercase county name → 3-digit NJ county FIPS
COUNTY_TO_FIPS = {
    "ATLANTIC": "001", "BERGEN": "003", "BURLINGTON": "005",
    "CAMDEN": "007", "CAPE MAY": "009", "CUMBERLAND": "011",
    "ESSEX": "013", "GLOUCESTER": "015", "HUDSON": "017",
    "HUNTERDON": "019", "MERCER": "021", "MIDDLESEX": "023",
    "MONMOUTH": "025", "MORRIS": "027", "OCEAN": "029",
    "PASSAIC": "031", "SALEM": "033", "SOMERSET": "035",
    "SUSSEX": "037", "UNION": "039", "WARREN": "041",
}

# Sector columns present in both CSVs
SECTOR_COLS = [
    "Accomodations/Food", "Admin/Waste Remediation", "Agriculture",
    "Arts/Entertainment", "Construction", "Education", "Finance/Insurance",
    "Health/Social", "Information", "Management", "Manufacturing",
    "Mining", "Other Services", "Professional/Technical", "Real Estate",
    "Retail Trade", "Transp/Warehousing", "Utilities", "Wholesale Trade",
]

# Human-readable short labels for top_sector field
SECTOR_SHORT = {
    "Accomodations/Food": "hospitality",
    "Admin/Waste Remediation": "admin",
    "Agriculture": "agriculture",
    "Arts/Entertainment": "arts",
    "Construction": "construction",
    "Education": "education",
    "Finance/Insurance": "finance",
    "Health/Social": "healthcare",
    "Information": "information",
    "Management": "management",
    "Manufacturing": "manufacturing",
    "Mining": "mining",
    "Other Services": "other services",
    "Professional/Technical": "professional",
    "Real Estate": "real estate",
    "Retail Trade": "retail",
    "Transp/Warehousing": "transport",
    "Utilities": "utilities",
    "Wholesale Trade": "wholesale",
}


def main():
    # --- Load 2023 establishment counts ---
    print("Loading industrial sector totals (2023)...")
    totals = pd.read_csv(TOTALS_CSV)
    totals = totals[totals["YEAR"] == 2023].copy()
    totals = totals[totals["COUNTY"].isin(COUNTY_TO_FIPS)]  # drop UNDISTRIBUTED

    priv_col = "PRIVATE SECTOR TOTALS"
    for col in SECTOR_COLS + [priv_col]:
        if col in totals.columns:
            totals[col] = pd.to_numeric(totals[col], errors="coerce").fillna(0)

    print(f"  {len(totals)} municipality rows")

    # --- Load 2023 average annual wages ---
    print("Loading industrial sector average annual wages (2023)...")
    wages = pd.read_csv(WAGES_CSV)
    wages = wages[wages["YEAR"] == 2023].copy()
    wages = wages[wages["COUNTY"].isin(COUNTY_TO_FIPS)]
    wages[priv_col] = pd.to_numeric(wages[priv_col], errors="coerce")

    # --- Merge to weight wage by establishment count ---
    merged = totals[["COUNTY", "TOWN", priv_col] + SECTOR_COLS].merge(
        wages[["COUNTY", "TOWN", priv_col]].rename(
            columns={priv_col: "avg_wage_town"}
        ),
        on=["COUNTY", "TOWN"],
        how="left",
    )
    merged["wage_weight"] = merged[priv_col] * merged["avg_wage_town"]

    # --- Aggregate to county level ---
    agg = merged.groupby("COUNTY").agg(
        private_establishments=(priv_col, "sum"),
        wage_weight_sum=("wage_weight", "sum"),
        weight_sum=(priv_col, "sum"),
    ).reset_index()

    agg["avg_annual_wage"] = (agg["wage_weight_sum"] / agg["weight_sum"]).round(0)
    agg = agg.drop(columns=["wage_weight_sum", "weight_sum"])

    # Sector establishment sums at county level
    sector_agg = merged.groupby("COUNTY")[SECTOR_COLS].sum().reset_index()
    agg = agg.merge(sector_agg, on="COUNTY", how="left")

    # Rename sector columns
    agg = agg.rename(columns={col: f"sector_{SECTOR_SHORT[col].replace(' ', '_')}"
                               for col in SECTOR_COLS if col in agg.columns})

    # Determine top sector by establishment count
    sector_renamed = [f"sector_{s.replace(' ', '_')}" for s in SECTOR_SHORT.values()]
    sector_renamed = [c for c in sector_renamed if c in agg.columns]

    def top_sector(row):
        vals = {c: row[c] for c in sector_renamed if pd.notna(row[c]) and row[c] > 0}
        if not vals:
            return None
        winner = max(vals, key=vals.get)
        return winner.replace("sector_", "").replace("_", " ")

    agg["top_sector"] = agg.apply(top_sector, axis=1)

    # Map county name → FIPS
    agg["county_fips"] = agg["COUNTY"].map(COUNTY_TO_FIPS)
    agg = agg.drop(columns=["COUNTY"])

    print(f"Saving {len(agg)} county rows to {OUT_CSV}")
    agg.to_csv(OUT_CSV, index=False)

    print("\nSample:")
    print(agg[["county_fips", "private_establishments", "avg_annual_wage", "top_sector"]]
          .sort_values("county_fips")
          .head(8)
          .to_string(index=False))


if __name__ == "__main__":
    main()
