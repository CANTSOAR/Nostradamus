import { useMapStore } from "../store/useMapStore";

export function WeatherHUD() {
    const { weatherData, showLiveWeather } = useMapStore();

    if (!showLiveWeather || !weatherData) return null;

    return (
        <div style={{
            position: "absolute",
            top: 80,
            right: 20,
            background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(148, 210, 189, 0.3)",
            borderRadius: 8,
            padding: "12px 16px",
            color: "#f8fafc",
            fontFamily: "'Inter', sans-serif",
            pointerEvents: "none",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 160,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94d2bd", fontWeight: 700, letterSpacing: "0.1em" }}>ENVIRONMENT</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>LIVE</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 32 }}>{getWeatherIcon(weatherData.condition)}</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 24, fontWeight: 300 }}>{Math.round(weatherData.temp)}°C</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{weatherData.condition}</span>
                </div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />

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

            <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 9, color: "#64748b" }}>PRECIPITATION</span>
                <span style={{ fontSize: 12 }}>{weatherData.precipitation} <span style={{ fontSize: 10, color: "#64748b" }}>mm</span></span>
            </div>

            {/* Wind direction indicator */}
            <div style={{
                position: "absolute",
                bottom: 12,
                right: 16,
                width: 24,
                height: 24,
                border: "1px solid rgba(148, 210, 189, 0.4)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}>
                <div style={{
                    width: 2,
                    height: 12,
                    background: "#94d2bd",
                    transform: `rotate(${weatherData.windDirection}deg)`,
                    transformOrigin: "bottom center",
                    position: "relative",
                    top: -6
                }}>
                    <div style={{
                        width: 0,
                        height: 0,
                        borderLeft: "3px solid transparent",
                        borderRight: "3px solid transparent",
                        borderBottom: "5px solid #94d2bd",
                        position: "absolute",
                        top: -4,
                        left: -2
                    }} />
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
