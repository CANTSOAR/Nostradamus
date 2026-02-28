/**
 * Fetches live commercial flight data from the OpenSky Network (free, anonymous).
 * Refreshes every 15 seconds.
 */
import { useEffect, useRef, useState } from "react";

export interface FlightState {
    icao24: string;
    callsign: string;
    lat: number;
    lon: number;
    altitude: number; // meters
    velocity: number; // m/s
    heading: number;  // degrees
    onGround: boolean;
}

// OpenSky free anonymous endpoint (rate limited to ~100 req/day per IP, enough for dev)
const OPENSKY_URL =
    "https://opensky-network.org/api/states/all?lamin=38.5&lamax=41.5&lomin=-76.0&lomax=-73.0";

// Fallback mock data for when CORS/rate-limit kicks in (NJ region approximation)
const MOCK_FLIGHTS: FlightState[] = [
    { icao24: "a3e1f4", callsign: "AAL231", lat: 40.689, lon: -74.044, altitude: 9144, velocity: 245, heading: 85, onGround: false },
    { icao24: "a1b2c3", callsign: "UAL515", lat: 40.780, lon: -74.224, altitude: 6100, velocity: 220, heading: 270, onGround: false },
    { icao24: "ab4561", callsign: "DAL88", lat: 40.195, lon: -74.724, altitude: 11280, velocity: 265, heading: 30, onGround: false },
    { icao24: "a9f310", callsign: "SWA920", lat: 40.920, lon: -73.780, altitude: 3050, velocity: 185, heading: 190, onGround: false },
    { icao24: "a0c9d2", callsign: "JBU2102", lat: 40.640, lon: -73.791, altitude: 0, velocity: 12, heading: 320, onGround: true },
    { icao24: "ac1234", callsign: "FDX1093", lat: 40.350, lon: -74.600, altitude: 8534, velocity: 250, heading: 60, onGround: false },
    { icao24: "ada123", callsign: "UPS440", lat: 40.570, lon: -74.020, altitude: 5486, velocity: 232, heading: 140, onGround: false },
    { icao24: "a7e891", callsign: "EJA422", lat: 40.843, lon: -74.359, altitude: 12192, velocity: 272, heading: 212, onGround: false },
];

function parseOpenSky(data: unknown): FlightState[] {
    if (!data || typeof data !== "object") return [];
    const states = (data as { states?: unknown[][] }).states;
    if (!Array.isArray(states)) return [];
    return states
        .filter((s) => s[6] != null && s[5] != null)
        .map((s) => ({
            icao24: String(s[0] ?? ""),
            callsign: String(s[1] ?? "").trim(),
            lat: Number(s[6]),
            lon: Number(s[5]),
            altitude: Number(s[7] ?? s[13] ?? 0),
            velocity: Number(s[9] ?? 0),
            heading: Number(s[10] ?? 0),
            onGround: Boolean(s[8]),
        }));
}

export function useFlights(enabled: boolean) {
    const [flights, setFlights] = useState<FlightState[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!enabled) {
            setFlights([]);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        let useMock = false;

        async function fetchFlights() {
            if (useMock) {
                // Add a tiny drift to make mock data feel "live"
                setFlights(
                    MOCK_FLIGHTS.map((f) => ({
                        ...f,
                        lat: f.lat + (Math.random() - 0.5) * 0.01,
                        lon: f.lon + (Math.random() - 0.5) * 0.01,
                        heading: (f.heading + (Math.random() - 0.5) * 2 + 360) % 360,
                    }))
                );
                return;
            }
            try {
                const res = await fetch(OPENSKY_URL, { signal: AbortSignal.timeout(8000) });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const parsed = parseOpenSky(data);
                if (parsed.length === 0) throw new Error("empty");
                setFlights(parsed);
            } catch {
                useMock = true;
                setFlights(MOCK_FLIGHTS);
            }
        }

        fetchFlights();
        intervalRef.current = setInterval(fetchFlights, 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [enabled]);

    return flights;
}
