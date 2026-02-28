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
echo "=== Step 9/12: Process industrial sector data to county level ==="
python process_industry.py

echo ""
echo "=== Step 10/12: Process certified businesses to county level ==="
python process_certified_biz.py

echo ""
echo "=== Step 11/14: Generate county-level aggregates ==="
python generate_counties.py

echo ""
echo "=== Step 12/14: Fetch municipality boundaries ==="
python fetch_municipalities.py

echo ""
echo "=== Step 13/14: Join industrial data to municipalities ==="
python process_municipalities.py

echo ""
echo "=== Step 14/14: Fetch OSM road geometry ==="
python fetch_roads.py

echo ""
echo "Pipeline complete."
echo "  Tract output:  ../frontend/public/data/nj_tracts_enriched.geojson"
echo "  County output: ../frontend/public/data/nj_counties_enriched.geojson"
echo "  Roads output:  ../frontend/public/data/nj_roads.geojson"

echo ""
echo "=== Fetch NJDEP Infrastructure Data (Grid, Water, Climate) ==="
python fetch_njdep.py

echo ""
echo "=== Fetch FEMA Flood Zones ==="
python fetch_fema.py

echo ""
echo "=== Fetch NREL EV Charging Stations ==="
python fetch_nrel.py

echo ""
echo "=== Fetch NJTransit GTFS (Bus + Rail) ==="
python fetch_njtransit.py

echo ""
echo "=== Fetch EIA Electricity Load/Generation ==="
python fetch_eia.py

echo ""
echo "Infrastructure pipeline complete."
echo "  Copy to frontend: rsync -av data/njdep/ ../frontend/public/data/njdep/"
echo "                    rsync -av data/fema/  ../frontend/public/data/fema/"
echo "                    rsync -av data/nrel/  ../frontend/public/data/nrel/"
echo "                    rsync -av data/njtransit/ ../frontend/public/data/njtransit/"
