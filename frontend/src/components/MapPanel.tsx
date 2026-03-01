import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { SimulationPayload, CountyStats, PinnedObject, countyName, COUNTIES } from '../types';
import njCounties from '../data/counties';
import njMunicipalities from '../data/municipalities';
interface Props {
    payload: SimulationPayload | null;
    pinnedObjects: PinnedObject[];
    onSelectCounty: (name: string) => void;
    onSelectAgent: (id: number) => void;
    onSelectLocation: (id: number) => void;
    setViewport: (latMin: number, latMax: number, lonMin: number, lonMax: number) => void;
    heatmapMetric: string;
}

const LOC_COLORS: Record<string, string> = {
    Residential: '#c7b092', // Tan
    Store: '#f1e3d0',       // Light
    Employer: '#56738a',    // Slate
    School: '#1f3548',      // Navy
    Mixed: '#8aa2b5',       // Mix
    Public: '#faf7f1',      // White
};

function getCountyColor(stats: CountyStats, metric: string): string {
    let val = 0;
    switch (metric) {
        case 'population': val = Math.min(stats.population / 1200000, 1); break;
        case 'avg_wealth': val = Math.min(stats.avg_wealth / 80000, 1); break;
        case 'total_value': val = Math.min(stats.total_location_value / 5e10, 1); break;
        default: val = Math.min(stats.population / 1200000, 1);
    }
    // Chic gradient: light tan → dark navy
    const r = Math.round(241 - val * 210);
    const g = Math.round(227 - val * 174);
    const b = Math.round(208 - val * 136);
    return `rgb(${r}, ${g}, ${b})`;
}

export default function MapPanel({ payload, pinnedObjects, onSelectCounty, onSelectAgent, onSelectLocation, setViewport, heatmapMetric }: Props) {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const agentLayerRef = useRef<L.LayerGroup | null>(null);
    const locationLayerRef = useRef<L.LayerGroup | null>(null);
    const countyLayerRef = useRef<L.GeoJSON | null>(null);
    const muniLayerRef = useRef<L.LayerGroup | null>(null);
    const pinnedLayerRef = useRef<L.LayerGroup | null>(null);

    // Initialize map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [40.2, -74.65],
            zoom: 8,
            zoomControl: true,
        });

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri',
            maxZoom: 19,
        }).addTo(map);

        agentLayerRef.current = L.layerGroup().addTo(map);
        locationLayerRef.current = L.layerGroup().addTo(map);
        pinnedLayerRef.current = L.layerGroup().addTo(map);

        // County GeoJSON layer
        if (njCounties) {
            countyLayerRef.current = L.geoJSON(njCounties as any, {
                style: () => ({
                    color: '#c7b092',
                    weight: 1.5,
                    fillOpacity: 0.25,
                    fillColor: '#f1e3d0',
                }),
                onEachFeature: (feature, layer) => {
                    const name = feature.properties?.COUNTY || feature.properties?.NAME || '';
                    layer.bindTooltip(name, { sticky: true, className: 'county-tooltip' });
                    layer.on('click', (e) => {
                        onSelectCounty(name.toUpperCase());
                        if ((layer as any).getBounds) {
                            map.flyToBounds((layer as any).getBounds(), { padding: [50, 50], duration: 0.5 });
                        }
                        L.DomEvent.stopPropagation(e as any);
                    });
                },
            }).addTo(map);
        }

        // Municipality GeoJSON layer (shown at mid/high zoom)
        muniLayerRef.current = L.layerGroup();
        if (njMunicipalities) {
            L.geoJSON(njMunicipalities as any, {
                style: () => ({
                    color: '#faf7f1',
                    weight: 0.8,
                    fillOpacity: 0.0,
                    opacity: 0.5,
                }),
                onEachFeature: (feature, layer) => {
                    const name = feature.properties?.NAME || '';
                    layer.bindTooltip(name, { className: 'county-tooltip' });
                    layer.on('click', (e) => {
                        if ((layer as any).getBounds) {
                            map.flyToBounds((layer as any).getBounds(), { padding: [20, 20], duration: 0.5 });
                        }
                        L.DomEvent.stopPropagation(e as any);
                    });
                },
            }).addTo(muniLayerRef.current);
        }

        // Viewport change handler
        const updateViewport = () => {
            const bounds = map.getBounds();
            const zoom = map.getZoom();

            // Only notify backend to render agents/locations if we are zoomed in enough
            if (zoom >= 11) {
                setViewport(
                    bounds.getSouth(), bounds.getNorth(),
                    bounds.getWest(), bounds.getEast()
                );
            } else {
                setViewport(0, 0, 0, 0); // Stops rendering thousands of objects when zoomed out
            }

            // Toggle municipality layer based on zoom
            if (muniLayerRef.current) {
                if (zoom >= 9) {
                    if (!map.hasLayer(muniLayerRef.current)) map.addLayer(muniLayerRef.current);
                } else {
                    if (map.hasLayer(muniLayerRef.current)) map.removeLayer(muniLayerRef.current);
                }
            }
        };
        map.on('moveend', updateViewport);
        updateViewport();

        mapRef.current = map;

        return () => { map.remove(); mapRef.current = null; };
    }, []);

    // Update county choropleth colors
    useEffect(() => {
        if (!countyLayerRef.current || !payload) return;
        countyLayerRef.current.eachLayer((layer: any) => {
            const name = layer.feature?.properties?.COUNTY || layer.feature?.properties?.NAME || '';
            const stats = payload.county_stats.find(s => s.name === name.toUpperCase());
            if (stats) {
                layer.setStyle({
                    fillColor: getCountyColor(stats, heatmapMetric),
                    fillOpacity: 0.5,
                });
                layer.setTooltipContent(
                    `${name}\nPop: ${stats.population.toLocaleString()}\nWealth: $${Math.round(stats.avg_wealth).toLocaleString()}`
                );
            }
        });
    }, [payload?.county_stats, heatmapMetric]);

    // Update agent dots & location markers
    useEffect(() => {
        if (!mapRef.current || !payload) return;
        const zoom = mapRef.current.getZoom();

        // Agents: only render at municipality zoom (≥13)
        const agentLayer = agentLayerRef.current!;
        agentLayer.clearLayers();
        if (zoom >= 13) {
            const maxAgents = Math.min(payload.viewport_agents.length, 3000);
            for (let i = 0; i < maxAgents; i++) {
                const a = payload.viewport_agents[i];
                const marker = L.circleMarker([a.current_coord.lat, a.current_coord.lon], {
                    radius: 3,
                    color: 'transparent',
                    fillColor: a.employer_location_id ? '#56738a' : '#ff1493',
                    fillOpacity: 0.8,
                    weight: 0,
                });
                marker.bindTooltip(`Agent #${a.id} | Age: ${a.age} | $${Math.round(a.wealth).toLocaleString()}`, { className: 'agent-tooltip' });
                marker.on('click', () => onSelectAgent(a.id));
                agentLayer.addLayer(marker);
            }
        }

        // Locations: render non-residential at county+ zoom (≥10)
        const locLayer = locationLayerRef.current!;
        locLayer.clearLayers();
        if (zoom >= 10) {
            const maxLocs = Math.min(payload.viewport_locations.length, 2000);
            for (let i = 0; i < maxLocs; i++) {
                const loc = payload.viewport_locations[i];
                if (loc.location_type === 'Residential' && zoom < 15) continue;
                const color = LOC_COLORS[loc.location_type] || '#6b7280';
                const marker = L.circleMarker([loc.coord.lat, loc.coord.lon], {
                    radius: zoom >= 15 ? 5 : 4,
                    color: 'transparent',
                    fillColor: color,
                    fillOpacity: 0.7,
                    weight: 0,
                });
                const label = loc.name || `${loc.location_type} #${loc.id}`;
                marker.bindTooltip(`${label}\n$${Math.round(loc.value).toLocaleString()}`, { className: 'loc-tooltip' });
                marker.on('click', () => onSelectLocation(loc.id));
                locLayer.addLayer(marker);
            }
        }
    }, [payload]);

    // Pinned objects always visible
    useEffect(() => {
        if (!mapRef.current || !payload) return;
        const pinLayer = pinnedLayerRef.current!;
        pinLayer.clearLayers();
        for (const pin of pinnedObjects) {
            if (pin.type === 'agent') {
                const agent = payload.viewport_agents.find(a => a.id === pin.id);
                if (agent) {
                    L.circleMarker([agent.current_coord.lat, agent.current_coord.lon], {
                        radius: 8, color: pin.color, fillColor: pin.color, fillOpacity: 0.9, weight: 2,
                    }).bindTooltip(pin.label, { permanent: true, className: 'pin-tooltip' }).addTo(pinLayer);
                }
            } else {
                const loc = payload.viewport_locations.find(l => l.id === pin.id);
                if (loc) {
                    L.circleMarker([loc.coord.lat, loc.coord.lon], {
                        radius: 10, color: pin.color, fillColor: pin.color, fillOpacity: 0.3, weight: 3,
                    }).bindTooltip(pin.label, { permanent: true, className: 'pin-tooltip' }).addTo(pinLayer);
                }
            }
        }
    }, [payload, pinnedObjects]);

    return <div ref={containerRef} className="map-container" />;
}
