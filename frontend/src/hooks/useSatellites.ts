/**
 * Fetches live satellite TLE data from Celestrak (CORS-friendly, no key required).
 * Returns parsed satellite positions (via satellite.js propagation) every 5 seconds.
 */
import { useEffect, useRef, useState } from "react";
// satellite.js ESM exports named functions — use destructured import
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no official type declarations
import {
    twoline2satrec,
    propagate as sgp4propagate,
    gstime,
    eciToGeodetic,
    degreesLat,
    degreesLong,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} from "satellite.js";

export interface SatellitePosition {
    id: string;
    name: string;
    lat: number;
    lon: number;
    alt: number; // km above earth
}

const CELESTRAK_URL =
    "https://celestrak.org/CCTK/query/v2.php?GROUP=active&FORMAT=tle";

// Fallback subset (last resort if CORS fails)
const FALLBACK_TLES = `ISS (ZARYA)             
1 25544U 98067A   24057.50000000  .00021924  00000+0  39583-3 0  9994
2 25544  51.6411 193.7851 0004680  20.9695  17.0000 15.49968641441760
STARLINK-3          
1 48274U 21015C   24057.50000000  .00001234  00000+0  10000-3 0  9993
2 48274  53.0000 120.0000 0001000  10.0000  20.0000 15.00000000000000
NOAA 18             
1 28654U 05018A   24057.50000000  .00000016  00000+0  54970-4 0  9998
2 28654  99.0000  80.0000 0010000   5.0000   1.0000 14.10000000000000`;

function parseTLEs(raw: string): Array<{ name: string; line1: string; line2: string }> {
    const lines = raw.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    const result: Array<{ name: string; line1: string; line2: string }> = [];
    for (let i = 0; i + 2 < lines.length; i += 3) {
        const name = lines[i].trim();
        const line1 = lines[i + 1].trim();
        const line2 = lines[i + 2].trim();
        if (line1.startsWith("1 ") && line2.startsWith("2 ")) {
            result.push({ name, line1, line2 });
        }
    }
    return result;
}

function propagate(
    entries: Array<{ name: string; line1: string; line2: string }>,
    now: Date,
    sparse: boolean
): SatellitePosition[] {
    const list = sparse ? entries.slice(0, 80) : entries.slice(0, 500);
    const positions: SatellitePosition[] = [];
    for (const { name, line1, line2 } of list) {
        try {
            const satrec = twoline2satrec(line1, line2);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pv: any = sgp4propagate(satrec, now);
            if (!pv || !pv.position || pv.position === true || pv.position === false) continue;
            const gst = gstime(now);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const geo = eciToGeodetic(pv.position as any, gst);
            const lat = degreesLat(geo.latitude);
            const lon = degreesLong(geo.longitude);
            const alt = geo.height; // km
            if (!isNaN(lat) && !isNaN(lon)) {
                positions.push({ id: line1.slice(2, 7).trim(), name, lat, lon, alt });
            }
        } catch {
            // skip malformed TLE
        }
    }
    return positions;
}

let cachedTLEText: string | null = null;

export function useSatellites(enabled: boolean, detectionMode: "sparse" | "full") {
    const [positions, setPositions] = useState<SatellitePosition[]>([]);
    const tlesRef = useRef<Array<{ name: string; line1: string; line2: string }>>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!enabled) {
            setPositions([]);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        async function fetchAndStart() {
            if (!cachedTLEText) {
                try {
                    const res = await fetch(CELESTRAK_URL);
                    if (res.ok) {
                        cachedTLEText = await res.text();
                    }
                } catch {
                    // CORS may fail in browser; use fallback
                }
                if (!cachedTLEText) cachedTLEText = FALLBACK_TLES;
            }
            tlesRef.current = parseTLEs(cachedTLEText!);
            const tick = () => {
                setPositions(propagate(tlesRef.current, new Date(), detectionMode === "sparse"));
            };
            tick();
            intervalRef.current = setInterval(tick, 5000);
        }

        fetchAndStart();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [enabled, detectionMode]);

    return positions;
}
