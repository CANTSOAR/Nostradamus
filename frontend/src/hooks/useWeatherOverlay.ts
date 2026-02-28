import { useEffect, useRef } from "react";
import {
    Entity,
    Color,
    Rectangle,
    Cartesian3,
    Cartesian2,
    LabelStyle,
    VerticalOrigin,
    type Viewer,
} from "cesium";

// NJ grid: 4 cols x 5 rows = 20 points
const LAT_MIN = 38.9, LAT_MAX = 41.4;
const LON_MIN = -75.6, LON_MAX = -73.9;
const ROWS = 5, COLS = 4;

interface WeatherCell {
    lat: number;
    lon: number;
    temp: number;        // °C
    windSpeed: number;   // km/h
    windDir: number;     // degrees
    cloudCover: number;  // 0-100 %
}

function latLonGrid(): { lat: number; lon: number }[] {
    const pts: { lat: number; lon: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            pts.push({
                lat: LAT_MIN + ((LAT_MAX - LAT_MIN) / (ROWS - 1)) * r,
                lon: LON_MIN + ((LON_MAX - LON_MIN) / (COLS - 1)) * c,
            });
        }
    }
    return pts;
}

async function fetchWeatherGrid(): Promise<WeatherCell[]> {
    const pts = latLonGrid();
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", pts.map(p => p.lat.toFixed(2)).join(","));
    url.searchParams.set("longitude", pts.map(p => p.lon.toFixed(2)).join(","));
    url.searchParams.set("current", "temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover");
    url.searchParams.set("wind_speed_unit", "kmh");
    url.searchParams.set("timezone", "America/New_York");

    const res = await fetch(url.toString());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // Open-Meteo returns array when multiple lat/lon provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: any[] = Array.isArray(data) ? data : [data];

    return arr.map((d, i) => ({
        lat: pts[i]?.lat ?? 0,
        lon: pts[i]?.lon ?? 0,
        temp: d.current?.temperature_2m ?? 0,
        windSpeed: d.current?.wind_speed_10m ?? 0,
        windDir: d.current?.wind_direction_10m ?? 0,
        cloudCover: d.current?.cloud_cover ?? 0,
    }));
}

// Temp (°C): blue (cold) → green (mild) → red (hot)
function tempColor(t: number, alpha = 0.42): Color {
    const n = Math.max(0, Math.min(1, (t + 10) / 50));
    if (n < 0.33) return Color.fromHsl(0.62, 0.8, 0.45, alpha);
    if (n < 0.66) return Color.fromHsl(0.33, 0.75, 0.45, alpha);
    return Color.fromHsl(0.05, 0.85, 0.5, alpha);
}

function windColor(speed: number, alpha = 0.38): Color {
    const n = Math.min(1, speed / 80);
    return Color.fromHsl(0.58 - n * 0.58, 0.8, 0.52, alpha);
}

function cloudColor(cover: number, alpha = 0.45): Color {
    const n = cover / 100;
    return Color.fromHsl(0.58, 0.1 + n * 0.1, 0.55 + n * 0.25, n * alpha);
}

function windArrow(deg: number): string {
    const dirs = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
    return dirs[Math.round(deg / 45) % 8];
}

export type WeatherOverlayMode = "temperature" | "wind" | "clouds";

const CELL_LAT = (LAT_MAX - LAT_MIN) / (ROWS - 1);
const CELL_LON = (LON_MAX - LON_MIN) / (COLS - 1);

interface OverlayEntry {
    fill: Entity;
    label: Entity;
    cell: WeatherCell;
}

export function useWeatherOverlay({
    viewer,
    mode,
    show,
}: {
    viewer: Viewer | null;
    mode: WeatherOverlayMode;
    show: boolean;
}) {
    const entriesRef = useRef<OverlayEntry[]>([]);
    const loadedRef = useRef(false);

    // Load data and create entities once
    useEffect(() => {
        if (!viewer) return;
        if (loadedRef.current) return;
        loadedRef.current = true;
        let mounted = true;

        fetchWeatherGrid()
            .then((cells) => {
                if (!mounted || viewer.isDestroyed()) return;

                for (const cell of cells) {
                    const west = cell.lon - CELL_LON / 2;
                    const east = cell.lon + CELL_LON / 2;
                    const south = cell.lat - CELL_LAT / 2;
                    const north = cell.lat + CELL_LAT / 2;

                    const fill = viewer.entities.add({
                        show: false,
                        rectangle: {
                            coordinates: Rectangle.fromDegrees(west, south, east, north),
                            material: Color.TRANSPARENT,
                        },
                    });

                    const label = viewer.entities.add({
                        show: false,
                        position: Cartesian3.fromDegrees(cell.lon, cell.lat, 200),
                        label: {
                            text: "",
                            font: "bold 13px Inter, system-ui",
                            fillColor: Color.WHITE,
                            outlineColor: Color.fromCssColorString("#050a14"),
                            outlineWidth: 3,
                            style: LabelStyle.FILL_AND_OUTLINE,
                            verticalOrigin: VerticalOrigin.CENTER,
                            showBackground: true,
                            backgroundColor: Color.fromCssColorString("#050a14").withAlpha(0.65),
                            backgroundPadding: new Cartesian2(6, 4),
                            distanceDisplayCondition: { near: 0, far: 800_000 } as any,
                            scaleByDistance: { near: 5_000, nearValue: 1.3, far: 500_000, farValue: 0.6 } as any,
                        },
                    });

                    entriesRef.current.push({ fill, label, cell });
                }

                // Apply initial visibility
                applyMode(show, mode);
            })
            .catch((e) => console.error("Weather overlay fetch failed:", e));

        return () => {
            mounted = false;
            if (!viewer.isDestroyed()) {
                for (const { fill, label } of entriesRef.current) {
                    viewer.entities.remove(fill);
                    viewer.entities.remove(label);
                }
            }
            entriesRef.current = [];
            loadedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewer]);

    function applyMode(visible: boolean, m: WeatherOverlayMode) {
        for (const { fill, label, cell } of entriesRef.current) {
            fill.show = visible;
            label.show = visible;
            if (!visible) continue;

            // Update rectangle color
            let color: Color;
            let labelText: string;
            switch (m) {
                case "temperature":
                    color = tempColor(cell.temp);
                    labelText = `${cell.temp.toFixed(0)}°C`;
                    break;
                case "wind":
                    color = windColor(cell.windSpeed);
                    labelText = `${cell.windSpeed.toFixed(0)} km/h ${windArrow(cell.windDir)}`;
                    break;
                case "clouds":
                    color = cloudColor(cell.cloudCover);
                    labelText = `${cell.cloudCover.toFixed(0)}%`;
                    break;
            }
            if (fill.rectangle) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (fill.rectangle.material as any) = color;
            }
            if (label.label) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (label.label.text as any) = labelText;
            }
        }
    }

    // Re-apply when show or mode changes
    useEffect(() => {
        if (entriesRef.current.length > 0) applyMode(show, mode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, mode]);
}
