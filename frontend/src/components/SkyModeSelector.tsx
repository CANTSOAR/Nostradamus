import { useMapStore, type SkyMode } from "../store/useMapStore";

const MODES: { value: SkyMode; label: string; icon: string }[] = [
    { value: "sunny", label: "Sunny", icon: "☀️" },
    { value: "cloudy", label: "Cloudy", icon: "☁️" },
    { value: "dusk", label: "Dusk", icon: "🌆" },
    { value: "night", label: "Night", icon: "🌙" },
];

export function SkyModeSelector() {
    const { skyMode, setSkyMode, showLiveWeather, toggleLiveWeather } = useMapStore();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 4 }}>
                SKY MODE
            </div>
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
                                padding: "4px 10px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontFamily: "'Inter', sans-serif",
                                cursor: "pointer",
                                transition: "all 0.15s",
                                display: "flex",
                                gap: 6,
                                alignItems: "center",
                            }}
                        >
                            <span style={{ fontSize: 12 }}>{mode.icon}</span>
                            {mode.label}
                        </button>
                    );
                })}
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

            <button
                onClick={toggleLiveWeather}
                style={{
                    background: showLiveWeather ? "rgba(148,210,189,0.15)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${showLiveWeather ? "rgba(148,210,189,0.4)" : "rgba(255,255,255,0.1)"}`,
                    color: showLiveWeather ? "#94d2bd" : "#94a3b8",
                    padding: "6px 10px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontFamily: "'Inter', sans-serif",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 600
                }}
            >
                <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: showLiveWeather ? "#94d2bd" : "#475569",
                    boxShadow: showLiveWeather ? "0 0 8px #94d2bd" : "none"
                }} />
                Live Weather Data
            </button>
        </div>
    );
}
