# 👁️ Nostradamus

> **A Palantir-style geospatial intelligence platform for New Jersey.**

Nostradamus is a high-performance, 3D geospatial intelligence platform built with **CesiumJS** and **React**. It provides a "God-view" of New Jersey, integrating multi-source datasets from the Census Bureau, BLS, and real-time feeds into a unified tactical display.

![Nostradamus Banner](https://placehold.co/1200x400/0a0a0a/00ffcc?text=NOSTRADAMUS+INTELLIGENCE+PLATFORM)
*Placeholder for project banner*

---

## 🚀 Key Features

### 🗺️ Multi-Level Intelligence Drill-down
Seamless navigation across four distinct granularities:
1.  **State Level**: Macro-economic trends and county-wide choropleths.
2.  **County Level**: Detailed census tract analysis within selected regions.
3.  **Tract Level**: High-resolution building footprints and socio-economic profiling.
4.  **Building Level**: Asset-level intelligence and future occupancy simulation.

### 🎭 Tactical Visual Engines
Switch between various post-processing shaders for different operational contexts:
- **Night Vision**: High-gain green phosphor simulation for low-light analysis.
- **FLIR (Thermal)**: Pseudocolor heat mapping based on luminosity.
- **CRT / Retro**: Analog surveillance aesthetic.
- **Noir**: High-contrast, monochromatic intelligence feed.
- **Anime**: Stylized edge-detection and cel-shaded rendering.

### 🛰️ Real-time Entity Tracking
- **Live Flights**: Global ADS-B data from OpenSky Network, refreshing every 15s.
- **Satellite Constellations**: Real-time TLE propagation for active orbital assets.
- **Simulated Military Assets**: Tactical overlays for non-commercial aviation.
- **Live CCTV**: Integration of NJ highway traffic cameras.

### 🚗 Dynamic Urban Simulation
- **Traffic Particles**: Real-time particle simulation of vehicle flow based on OpenStreetMap roadway geometry.
- **Drone Navigation**: WASD-controlled first-person camera for low-altitude reconnaissance.
- **Orbit Mode**: Automated 360-degree point-of-interest surveillance.

---

## 📺 Visuals

### Platform Overview
<!-- slide -->
![State Overview Placeholder](https://placehold.co/800x450/111111/00ffcc?text=State+Level+Choropleth+Overview)
*Macro-level economic intelligence (Median Income, Unemployment, Indexing)*
<!-- slide -->
![Tactical Modes Placeholder](https://placehold.co/800x450/111111/00ffcc?text=Tactical+Visual+Modes+Showcase)
*Showcase of Night Vision, FLIR, and CRT shaders*

### Live Demo (Mock)
[![Video Placeholder](https://placehold.co/800x450/000000/ffffff?text=Click+to+Watch+Demo+Video)](https://example.com)

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework**: React 18 + TypeScript
- **Engine**: CesiumJS (3D Globe & Spatial Analysis)
- **State**: Zustand (Atomic state management)
- **Build Tool**: Vite
- **Styling**: TailwindCSS & Custom GLSL Shaders

### **Data Pipeline**
- **Language**: Python 3.10+
- **Orchestration**: DuckDB & Pandas
- **Geodata**: GeoPandas, Overture Maps, Census API
- **Sources**: Census ACS, BLS QCEW, TIGER/Line, LODES, HUD

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- [Cesium Ion Token](https://cesium.com/ion/) (Required for 3D buildings)

### 1. Data Pipeline Setup
The pipeline fetches and enriches New Jersey geospatial data.
```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add CENSUS_API_KEY
./run_pipeline.sh      # Outputs to ../frontend/public/data/
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env  # Add VITE_CESIUM_ION_TOKEN
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) to view the platform.

---

## 📂 Project Structure

- `/frontend`: React application, Cesium components, and tactical shaders.
- `/pipeline`: Data ingestion scripts for Census, BLS, and Overture data.
- `/docs`: Additional technical documentation (forthcoming).

---

## 📜 License
Internal Development - All Rights Reserved.
