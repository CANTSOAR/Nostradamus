/**
 * Fetches real-time earthquake data from USGS GeoJSON feed (free, no CORS issues).
 * Refreshes every 60 seconds.
 */
import { useEffect, useRef, useState } from "react";

export interface Earthquake {
    id: string;
    lat: number;
    lon: number;
    depth: number; // km
    magnitude: number;
    place: string;
    time: number; // epoch ms
}

// USGS — all earthquakes M1.0+ in last 24 hours
const USGS_URL =
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/1.0_day.geojson";

export function useEarthquakes(enabled: boolean) {
    const [events, setEvents] = useState<Earthquake[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!enabled) {
            setEvents([]);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        async function fetch_() {
            try {
                const res = await fetch(USGS_URL);
                const json = await res.json();
                const quakes: Earthquake[] = (json.features ?? []).map((f: {
                    id: string;
                    properties: { mag: number; place: string; time: number };
                    geometry: { coordinates: [number, number, number] };
                }) => ({
                    id: f.id,
                    lon: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                    depth: f.geometry.coordinates[2],
                    magnitude: f.properties.mag,
                    place: f.properties.place,
                    time: f.properties.time,
                }));
                setEvents(quakes);
            } catch {
                // silently fail — earthquakes are supplementary
            }
        }

        fetch_();
        intervalRef.current = setInterval(fetch_, 60000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [enabled]);

    return events;
}
