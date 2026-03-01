import React from "react";
import { useMapStore } from "../store/useMapStore";

const panelStyle: React.CSSProperties = {
    background: "rgba(15,20,30,0.9)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: 12,
    border: "1px solid rgba(148,210,189,0.3)",
    color: "#e2e8f0",
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: "16px",
    width: 300,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

export function PropertySidebar() {
    const { selectedProperty, setSelectedProperty } = useMapStore();

    if (!selectedProperty) return null;

    const p = selectedProperty;

    return (
        <div style={{ ...panelStyle, position: "absolute", top: 130, left: 16, zIndex: 1000 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: 10, color: "#94d2bd", letterSpacing: "0.1em", fontWeight: 700 }}>
                        PROPERTY RECORD
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                        {p.address}
                    </div>
                </div>
                <button
                    onClick={() => setSelectedProperty(null)}
                    style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "none",
                        borderRadius: "50%",
                        color: "#64748b",
                        cursor: "pointer",
                        width: 24,
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                    }}
                >
                    ×
                </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <StatItem label="City" value={p.city} />
                <StatItem label="County" value={p.county} />
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
                <StatItem
                    label="Net Value"
                    value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.net_value)}
                    highlight
                />
                <StatItem label="Tax Rate" value={`${p.tax_rate.toFixed(3)}%`} />
                <StatItem
                    label="Annual Tax"
                    value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.tax_amount)}
                    highlight
                />
            </div>

            <div style={{ marginTop: 16, fontSize: 10, color: "#475569", fontStyle: "italic" }}>
                Source: NJ MOD-IV Tax Records 2024
            </div>
        </div>
    );
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{label}</span>
            <span style={{
                fontSize: highlight ? 14 : 12,
                fontWeight: highlight ? 700 : 600,
                color: highlight ? "#94d2bd" : "#e2e8f0"
            }}>
                {value}
            </span>
        </div>
    );
}
