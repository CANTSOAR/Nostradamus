import { useMapStore } from "../store/useMapStore";
import { useDraggable } from "../hooks/useDraggable";

export function WeatherHUD() {
    const { weatherData } = useMapStore();
    // Initial position: top-right area (will be overridden by drag)
    // We use position absolute with explicit left so dragging works cleanly
    const { pos, onMouseDown } = useDraggable(0, 0);

    if (!weatherData) return null;

    return (
        <div
            style={{
                position: "absolute",
                top: 80 + pos.y,
                right: 20 - pos.x,
                background: "rgba(8, 12, 22, 0.80)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(148, 210, 189, 0.25)",
                borderRadius: 10,
                color: "#f8fafc",
                fontFamily: "'Inter', sans-serif",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                userSelect: "none",
            }}
        >
            {/* Drag handle header */}
            <div
                onMouseDown={onMouseDown}
                style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px 6px",
                    cursor: "grab",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                <span style={{ fontSize: 10, color: "#94d2bd", fontWeight: 700, letterSpacing: "0.1em" }}>ENVIRONMENT</span>
                <span style={{ fontSize: 9, color: "#475569" }}>NJ · LIVE</span>
            </div>

            <div style={{ padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 28 }}>{getWeatherIcon(weatherData.condition)}</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 22, fontWeight: 300 }}>{Math.round(weatherData.temp)}°C</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{weatherData.condition}</span>
                    </div>
                </div>

                <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 9, color: "#64748b" }}>WIND</span>
                        <span style={{ fontSize: 12 }}>{weatherData.windSpeed} <span style={{ fontSize: 10, color: "#64748b" }}>km/h</span></span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 9, color: "#64748b" }}>CLOUDS</span>
                        <span style={{ fontSize: 12 }}>{weatherData.cloudCover}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getWeatherIcon(condition: string): string {
    if (condition.includes("Clear")) return "☀️";
    if (condition.includes("Cloudy")) return "☁️";
    if (condition.includes("Rain") || condition.includes("Drizzle")) return "🌧️";
    if (condition.includes("Snow")) return "❄️";
    if (condition.includes("Thunderstorm")) return "⛈️";
    if (condition.includes("Fog")) return "🌫️";
    return "🌤️";
}
