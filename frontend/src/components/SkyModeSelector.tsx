import { useState } from "react";
import { useMapStore, type SkyMode } from "../store/useMapStore";

const MODES: { value: SkyMode; label: string; icon: string }[] = [
    { value: "sunny", label: "Sunny", icon: "☀️" },
    { value: "cloudy", label: "Cloudy", icon: "☁️" },
    { value: "dusk", label: "Dusk", icon: "🌆" },
    { value: "night", label: "Night", icon: "🌙" },
];

const WEATHER_MODES: { value: "temperature" | "wind" | "clouds"; label: string; icon: string }[] = [
    { value: "temperature", label: "Temp", icon: "🌡️" },
    { value: "wind", label: "Wind", icon: "💨" },
    { value: "clouds", label: "Clouds", icon: "☁️" },
];

export function SkyModeSelector() {
    const [minimized, setMinimized] = useState(false);
    const { skyMode, setSkyMode, showWeatherOverlay, toggleWeatherOverlay, weatherOverlayMode, setWeatherOverlayMode } = useMapStore();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Header with minimize */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}>
                    SKY MODE
                </div>
                <button
                    onClick={() => setMinimized(m => !m)}
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#475569", fontSize: 11, padding: "0 2px", lineHeight: 1,
                        fontFamily: "inherit",
                    }}
                    title={minimized ? "Expand" : "Minimize"}
                >
                    {minimized ? "▲" : "▼"}
                </button>
            </div>

            {!minimized && (
                <>
                    {/* Sky buttons */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {MODES.map((mode) => {
                            const isActive = skyMode === mode.value;
                            return (
                                <button
                                    key={mode.value}
                                    onClick={() => setSkyMode(mode.value)}
                                    style={{
                                        background: isActive ? "rgba(148,210,189,0.15)" : "rgba(255,255,255,0.06)",
                                        border: `1px solid ${isActive ? "rgba(148,210,189,0.4)" : "rgba(255,255,255,0.1)"}`,
                                        color: isActive ? "#94d2bd" : "#94a3b8",
                                        padding: "4px 10px", borderRadius: 4, fontSize: 11,
                                        fontFamily: "'Inter', sans-serif", cursor: "pointer",
                                        transition: "all 0.15s", display: "flex", gap: 6, alignItems: "center",
                                    }}
                                >
                                    <span style={{ fontSize: 12 }}>{mode.icon}</span>
                                    {mode.label}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />

                    {/* Weather overlay */}
                    <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}>
                        WEATHER OVERLAY
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                        {WEATHER_MODES.map((m) => {
                            const isActive = showWeatherOverlay && weatherOverlayMode === m.value;
                            return (
                                <button
                                    key={m.value}
                                    onClick={() => {
                                        if (showWeatherOverlay && weatherOverlayMode === m.value) {
                                            toggleWeatherOverlay();
                                        } else {
                                            setWeatherOverlayMode(m.value);
                                            if (!showWeatherOverlay) toggleWeatherOverlay();
                                        }
                                    }}
                                    style={{
                                        background: isActive ? "rgba(125,211,252,0.18)" : "rgba(255,255,255,0.06)",
                                        border: `1px solid ${isActive ? "rgba(125,211,252,0.5)" : "rgba(255,255,255,0.1)"}`,
                                        color: isActive ? "#7dd3fc" : "#94a3b8",
                                        padding: "4px 8px", borderRadius: 4, fontSize: 10,
                                        fontFamily: "'Inter', sans-serif", cursor: "pointer",
                                        transition: "all 0.15s", display: "flex", gap: 4, alignItems: "center",
                                        flex: 1, justifyContent: "center",
                                    }}
                                    title={`${m.label} overlay`}
                                >
                                    <span>{m.icon}</span> {m.label}
                                </button>
                            );
                        })}
                    </div>
                    {showWeatherOverlay && (
                        <div style={{ fontSize: 9, color: "#475569" }}>
                            Live data · Open-Meteo · 20-cell NJ grid
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
