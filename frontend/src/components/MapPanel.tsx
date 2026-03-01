import { useState } from 'react';
// @ts-ignore
import Map, { ViewStateChangeEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapStore } from '../store/useMapStore';

// Note: Replace with actual Mapbox access token if you have one, or configure Mapbox locally
const MAPBOX_TOKEN = "pk.eyJ1IjoiZHVtbXkiLCJhIjoiY2xrcmI1c2NwMGMxYjNrbnpweGhwZmE3aiJ9.dummy_token";

export function MapPanel() {
    const { selectedCountyName, selectedMunicipalityProps } = useMapStore();

    const [viewState, setViewState] = useState({
        longitude: -74.4,
        latitude: 40.0,
        zoom: 7,
        pitch: 0,
        bearing: 0
    });

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <Map
                {...viewState}
                onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
            >
                {/* TODO: Add Deck.gl overlays here for counties, municipalities, and agents */}
            </Map>

            {/* Temporary Debug Info Overlay */}
            <div style={{
                position: "absolute", top: 16, left: 16,
                background: "rgba(0,0,0,0.7)", padding: 12, borderRadius: 8,
                color: "#fff", fontSize: 13, pointerEvents: "none"
            }}>
                <div>Zoom Level: (Actual: {viewState.zoom.toFixed(1)})</div>
                <div style={{ color: "#94d2bd" }}>Selected County: {selectedCountyName || "None"}</div>
                <div style={{ color: "#94d2bd" }}>Selected Town: {selectedMunicipalityProps?.mun_name || "None"}</div>
            </div>
        </div>
    );
}
