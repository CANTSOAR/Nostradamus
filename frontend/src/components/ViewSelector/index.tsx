import { useMapStore } from "../../store/useMapStore";

type ViewPreset = "default" | "panoptic" | "tactical";

const PRESETS: { value: ViewPreset; label: string; icon: string; desc: string }[] = [
    { value: "default", label: "Overview", icon: "🌐", desc: "NJ state view" },
    { value: "panoptic", label: "Panoptic", icon: "👁", desc: "Straight-down overhead" },
    { value: "tactical", label: "Tactical", icon: "🎯", desc: "Low-angle recon" },
];

export function ViewSelector() {
    const {
        viewPreset, setViewPreset,
    } = useMapStore();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
                fontSize: 10, color: "#64748b", letterSpacing: "0.1em",
                fontWeight: 600, marginBottom: 2,
            }}>
                CAMERA VIEW
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {PRESETS.map((p) => {
                    const active = viewPreset === p.value;
                    return (
                        <button
                            key={p.value}
                            onClick={() => setViewPreset(p.value)}
                            title={p.desc}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: active
                                    ? "rgba(148,210,189,0.15)"
                                    : "rgba(255,255,255,0.05)",
                                border: `1px solid ${active ? "rgba(148,210,189,0.45)" : "rgba(255,255,255,0.08)"}`,
                                borderRadius: 6,
                                padding: "6px 10px",
                                cursor: "pointer",
                                transition: "all 0.15s",
                                textAlign: "left",
                                width: "100%",
                            }}
                        >
                            <span style={{ fontSize: 16, lineHeight: 1 }}>{p.icon}</span>
                            <div>
                                <div style={{
                                    fontSize: 12, fontWeight: active ? 700 : 500,
                                    color: active ? "#94d2bd" : "#94a3b8",
                                    fontFamily: "'Inter', sans-serif",
                                }}>
                                    {p.label}
                                </div>
                                <div style={{ fontSize: 9, color: "#475569" }}>{p.desc}</div>
                            </div>
                            {active && (
                                <div style={{
                                    marginLeft: "auto",
                                    width: 6, height: 6,
                                    borderRadius: "50%",
                                    background: "#94d2bd",
                                    boxShadow: "0 0 6px #94d2bd",
                                    flexShrink: 0,
                                }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
