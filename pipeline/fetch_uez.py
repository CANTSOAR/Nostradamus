"""
fetch_uez.py
Download UEZ (Urban Enterprise Zone) municipal data from the Rutgers Economics Lab
GitHub repo. If the repo is private, prints instructions for manual download.

Data source:
  https://github.com/Rutgers-Economics-Labs/UEZProgramReformS25 (branch: Data)

Files downloaded to: pipeline/data/uez/
"""

import pathlib
import sys
import requests

DATA_DIR = pathlib.Path(__file__).parent / "data" / "uez"

# Raw GitHub URLs — branch is named "Data"
GITHUB_BASE = "https://raw.githubusercontent.com/Rutgers-Economics-Labs/UEZProgramReformS25/Data"

FILES = {
    "muni_info_yearly.csv": f"{GITHUB_BASE}/data/mun_info_sheet/muni_info_yearly.csv",
    "municipality_industrial.csv": f"{GITHUB_BASE}/data/industrial/municipality_industrial_mun.csv",
    "muni_info_2022.csv": f"{GITHUB_BASE}/data/mun_info_sheet/Muniinfo_sheets_2022.xlsx%20-%202022.csv",
}

MANUAL_INSTRUCTIONS = """
─────────────────────────────────────────────────────────────────
  UEZ data repo appears to be private. Please download manually:
─────────────────────────────────────────────────────────────────

  1. Go to: https://github.com/Rutgers-Economics-Labs/UEZProgramReformS25/tree/Data/data

  2. Download these files and place them in: pipeline/data/uez/

       mun_info_sheet/muni_info_yearly.csv     → pipeline/data/uez/muni_info_yearly.csv
       industrial/municipality_industrial_mun.csv → pipeline/data/uez/municipality_industrial.csv
       mun_info_sheet/Muniinfo_sheets_2022.xlsx - 2022.csv → pipeline/data/uez/muni_info_2022.csv

  3. Re-run: python fetch_uez.py

─────────────────────────────────────────────────────────────────
"""


def download_file(url: str, dest: pathlib.Path) -> bool:
    """Returns True on success, False on failure."""
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200 and not r.text.strip().startswith("<!DOCTYPE"):
            dest.write_bytes(r.content)
            size_kb = len(r.content) / 1024
            print(f"  ✓ {dest.name} ({size_kb:.0f} KB, {r.text.count(chr(10))} rows)")
            return True
        else:
            print(f"  ✗ {dest.name}: HTTP {r.status_code} (private repo?)")
            return False
    except Exception as e:
        print(f"  ✗ {dest.name}: {e}")
        return False


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Check which files already exist
    existing = {f for f in FILES if (DATA_DIR / f).exists()}
    if existing:
        print(f"Already have: {', '.join(sorted(existing))}")

    missing = {k: v for k, v in FILES.items() if k not in existing}
    if not missing:
        print("All UEZ files present. Skipping download.")
        _print_column_hints()
        return

    print(f"Downloading {len(missing)} UEZ files from GitHub...")
    failed = {}
    for filename, url in missing.items():
        dest = DATA_DIR / filename
        ok = download_file(url, dest)
        if not ok:
            failed[filename] = url

    if failed:
        print(MANUAL_INSTRUCTIONS)
        print("After placing files manually, re-run this script.")
        sys.exit(1)

    print(f"\nAll UEZ files saved to {DATA_DIR}")
    _print_column_hints()


def _print_column_hints():
    """Print first row of each file so downstream scripts can be configured."""
    for filename in FILES:
        path = DATA_DIR / filename
        if path.exists():
            try:
                first_line = path.read_text(encoding="utf-8", errors="replace").split("\n")[0]
                print(f"\n  Columns in {filename}:")
                for col in first_line.split(","):
                    print(f"    • {col.strip()}")
            except Exception:
                pass


if __name__ == "__main__":
    main()
