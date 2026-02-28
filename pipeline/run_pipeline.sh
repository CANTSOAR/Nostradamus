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

echo "=== Step 1/6: Fetch TIGER/Line boundaries ==="
python fetch_boundaries.py

echo ""
echo "=== Step 2/6: Fetch Census ACS data ==="
python fetch_acs.py

echo ""
echo "=== Step 3/6: Fetch BLS QCEW employment data ==="
python fetch_qcew.py

echo ""
echo "=== Step 4/6: Fetch Census LODES mobility data ==="
python fetch_lodes.py

echo ""
echo "=== Step 5/6: Fetch HUD Fair Market Rents ==="
python fetch_hud.py

echo ""
echo "=== Step 6/7: Join and enrich ==="
python join_and_enrich.py

echo ""
echo "=== Step 7/7: Generate county-level aggregates ==="
python generate_counties.py

echo ""
echo "Pipeline complete."
echo "  Tract output:  ../frontend/public/data/nj_tracts_enriched.geojson"
echo "  County output: ../frontend/public/data/nj_counties_enriched.geojson"
