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

echo "=== Step 1/4: Fetch TIGER/Line boundaries ==="
python fetch_boundaries.py

echo ""
echo "=== Step 2/4: Fetch Census ACS data ==="
python fetch_acs.py

echo ""
echo "=== Step 3/4: Fetch BLS QCEW employment data ==="
python fetch_qcew.py

echo ""
echo "=== Step 4/4: Join and enrich ==="
python join_and_enrich.py

echo ""
echo "Pipeline complete. Output: ../frontend/public/data/nj_tracts_enriched.geojson"
