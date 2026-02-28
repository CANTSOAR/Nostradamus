# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nostradamus** — A Palantir-style geospatial intelligence platform for New Jersey built with CesiumJS + React. Displays choropleth maps of Census/BLS economic data over a 3D globe, with live flight tracking, satellite orbits, and a 4-level drill-down navigation (state → county → census tract → building).

## Commands

### Frontend
```bash
cd frontend
npm run dev        # Dev server at http://localhost:5173
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npm test           # Vitest (run once)
npm run test:watch # Vitest (watch mode)
```

Run a single test file:
```bash
cd frontend && npx vitest run src/test/useMapStore.test.ts
```

### Pipeline (one-time data generation)
```bash
cd pipeline
python3 -m venv .venv && pip install -r requirements.txt
cp .env.example .env  # add CENSUS_API_KEY
./run_pipeline.sh      # runs all 10 steps, outputs to ../frontend/public/data/
```

## Architecture

### Data Flow
```
Census ACS + BLS QCEW + TIGER/Line + LODES + HUD
        ↓ (pipeline/*.py)
pipeline/data/*.{geojson,csv}
        ↓ (join_and_enrich.py + generate_counties.py)
frontend/public/data/nj_tracts_enriched.geojson   (~2.3MB, 2175 tracts)
frontend/public/data/nj_counties_enriched.geojson  (21 counties)
frontend/public/data/nj_roads.geojson
        ↓ (useChoropleth hook)
CesiumJS GeoJsonDataSource → colored polygons
```

### Frontend Structure

**State** — `src/store/useMapStore.ts` (Zustand) is the single source of truth. All navigation, layer toggles, visual modes, and tracked entity state lives here.

**Navigation state machine** — `viewLevel` drives what panels/layers are visible:
- `state` → county choropleth visible, click county → `county`
- `county` → tract choropleth filtered to selected county, click tract → `tract`
- `tract` → 3D buildings visible, TractSidebar shown, click building → `building`
- `building` → SimulationPlaceholder panel shown (future Rust ABM hook-in)

**Map** — `src/components/CesiumMap/index.tsx` owns the `Viewer` ref and orchestrates all Cesium interactions. It calls `useChoropleth` for county and tract layers, `useSatellites`, and `useFlights`. Keyboard shortcuts (WASD drone, Q/E altitude, POI hotkeys) are registered here via `ScreenSpaceEventHandler`.

**Choropleth** — `src/hooks/useChoropleth.ts` is generic: takes `dataUrl`, `filterCountyFips`, `keyField` and returns `entityMapRef` for click-lookup. Loads GeoJSON once, re-colors on variable/filter change.

**App layout** — `src/App.tsx` positions HUD panels absolutely over the full-viewport Cesium globe. Panel content switches on `viewLevel`.

### Key Technical Constraints

- **No deck.gl** — use `GeoJsonDataSource` for choropleth (deck.gl/Cesium integration is unstable)
- **Cesium `imageryProvider`** was removed from `Viewer` constructor options in v1.124 — add imagery via `viewer.imageryLayers.addImageryProvider()` after construction
- **`CESIUM_BASE_URL`** must be in Vite `define` (compile-time), not a runtime env var — see `vite.config.ts`
- **Cesium widgets.css** must be a `<link>` in `index.html`, not a TS/JS import
- **Ion token** set in `main.tsx` via `Ion.defaultAccessToken` before `ReactDOM.createRoot`
- **`useRef` not `useState`** for `GeoJsonDataSource` refs — survives React StrictMode double-mount
- **Vitest** mocks cesium via alias in `vite.config.ts test.alias` pointing to `src/test/__mocks__/cesium.ts`
- **`vite.config.ts`** imports from `vitest/config` (not `vite`) to enable the `test:` block

### Environment Variables
```
frontend/.env:
  VITE_CESIUM_ION_TOKEN=   # required for satellite imagery + 3D buildings
  VITE_GOOGLE_MAPS_API_KEY= # optional, for Google Photorealistic 3D Tiles

pipeline/.env:
  CENSUS_API_KEY=           # optional, fetch_acs.py auto-retries without key
```

### Live Data Sources (frontend, no API key needed)
- **Flights**: OpenSky Network anonymous API, refreshes every 15s, falls back to mock data on CORS/rate-limit
- **Satellites**: TLE data fetched from Celestrak, propagated client-side with `satellite.js`
- **Earthquakes**: USGS earthquake feed

### Future Seam: Rust ABM
The `SimulationPlaceholder` component in `App.tsx` and commented state in `useMapStore.ts` mark where agent-based simulation state and WebSocket connection should be added. Use `PointPrimitiveCollection` in `CesiumMap` for agent rendering.
