#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate venv if it exists
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then  # Windows
  source .venv/Scripts/activate
else
  echo "ERROR: .venv not found. Run: python3 -m venv .venv && pip install -r requirements.txt" >&2
  exit 1
fi

# Check .env exists
if [ ! -f ".env" ]; then
  echo "ERROR: .env not found. Run: cp .env.example .env  and add your CENSUS_API_KEY" >&2
  exit 1
fi

echo "=== Step 1/9: Fetch TIGER/Line boundaries ==="
python fetch_boundaries.py

echo ""
echo "=== Step 2/9: Fetch Census ACS data ==="
python fetch_acs.py

echo ""
echo "=== Step 3/9: Fetch BLS QCEW employment data ==="
python fetch_qcew.py

echo ""
echo "=== Step 4/9: Fetch Census LODES mobility data ==="
python fetch_lodes.py

echo ""
echo "=== Step 5/9: Fetch HUD Fair Market Rents ==="
python fetch_hud.py

echo ""
echo "=== Step 6/9: Fetch UEZ municipal data (optional — skips if unavailable) ==="
python fetch_uez.py || echo "  (UEZ download skipped — see above for manual instructions)"

echo ""
echo "=== Step 7/9: Join UEZ data to tracts (optional — skips if no UEZ files) ==="
if ls data/uez/*.csv 1>/dev/null 2>&1; then
  python join_uez.py
else
  echo "  (No UEZ files found in data/uez/ — skipping)"
fi

echo ""
echo "=== Step 8/9: Join and enrich all data ==="
python join_and_enrich.py

echo ""
echo "=== Step 9/9: Generate county-level aggregates ==="
python generate_counties.py

echo ""
echo "Pipeline complete."
echo "  Tract output:  ../frontend/public/data/nj_tracts_enriched.geojson"
echo "  County output: ../frontend/public/data/nj_counties_enriched.geojson"
