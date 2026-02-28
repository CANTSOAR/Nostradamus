import { useMapStore, type SkyMode } from "../store/useMapStore";

const MODES: { value: SkyMode; label: string; icon: string }[] = [
    { value: "sunny", label: "Sunny", icon: "☀️" },
    { value: "cloudy", label: "Cloudy", icon: "☁️" },
    { value: "dusk", label: "Dusk", icon: "🌆" },
    { value: "night", label: "Night", icon: "🌙" },
];

export function SkyModeSelector() {
    const { skyMode, setSkyMode } = useMapStore();

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
        </div>
    );
}
