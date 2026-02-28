import { useMapStore, type VisualMode } from "../store/useMapStore";

const MODES: { value: VisualMode; label: string; key: string }[] = [
    { value: "default", label: "Default", key: "0" },
    { value: "crt", label: "CRT", key: "1" },
    { value: "nightvision", label: "Night Vision", key: "2" },
    { value: "flir", label: "FLIR", key: "3" },
    { value: "noir", label: "Noir", key: "4" },
    { value: "anime", label: "Anime", key: "5" },
    { value: "highcontrast", label: "Hi-Contrast", key: "6" },
];

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01 }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "#64748b" }}>{label}</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{(value * 100).toFixed(0)}%</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#94d2bd", cursor: "pointer" }}
            />
        </div>
    );
}

export function VisualModeSelector() {
    const {
        visualMode, setVisualMode,
        visualIntensity, setVisualIntensity,
        visualNoise, setVisualNoise,
    } = useMapStore();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
            <div>
                <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>
                    VISUAL MODE
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {MODES.map((mode) => {
                        const isActive = visualMode === mode.value;
                        return (
                            <button
                                key={mode.value}
                                onClick={() => setVisualMode(mode.value)}
                                title={`Press ${mode.key}`}
                                style={{
                                    background: isActive ? "rgba(148,210,189,0.15)" : "rgba(255,255,255,0.06)",
                                    border: `1px solid ${isActive ? "rgba(148,210,189,0.4)" : "rgba(255,255,255,0.1)"}`,
                                    color: isActive ? "#94d2bd" : "#94a3b8",
                                    padding: "3px 8px",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontFamily: "'Inter', sans-serif",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                    display: "flex",
                                    gap: 4,
                                    alignItems: "center",
                                }}
                            >
                                {mode.label}
                                <span style={{ fontSize: 9, opacity: 0.5, fontFamily: "monospace" }}>[{mode.key}]</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {visualMode !== "default" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", fontWeight: 700 }}>SHADER PARAMS</div>
                    <Slider label="Intensity" value={visualIntensity} onChange={setVisualIntensity} />
                    {(visualMode === "crt" || visualMode === "nightvision") && (
                        <Slider label="Noise" value={visualNoise} onChange={setVisualNoise} />
                    )}
                </div>
            )}
        </div>
    );
}
