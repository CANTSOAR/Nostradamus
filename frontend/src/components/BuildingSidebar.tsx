import React from "react";
import { useMapStore } from "../store/useMapStore";

const StatRow = ({ label, value, highlight = false }: { label: string; value: string | number | null; highlight?: boolean }) => (
    <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "6px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)"
    }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
        <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: highlight ? "#94d2bd" : (value ? "#e2e8f0" : "#334155"),
            fontFamily: highlight ? "monospace" : "inherit"
        }}>
            {value ?? "—"}
        </span>
    </div>
);

function formatBuildingType(t: string | null): string | null {
    if (!t) return null;
    const map: Record<string, string> = {
        apartments: "Apartments", house: "House", commercial: "Commercial",
        industrial: "Industrial", office: "Office", retail: "Retail",
        residential: "Residential", school: "School", hospital: "Hospital",
        university: "University", hotel: "Hotel", warehouse: "Warehouse",
        church: "Church", garage: "Garage", yes: "Building",
    };
    return map[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
}

export function BuildingSidebar() {
    const {
        selectedBuildingProps,
        selectedTractId,
        navigateToTract,
        simulationRunning,
        startSimulation,
        stopSimulation,
        tick,
        agentCount
    } = useMapStore();

    const b = selectedBuildingProps;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.15em", fontWeight: 700, textTransform: "uppercase" }}>
                        Asset Intelligence
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#94d2bd", marginTop: 4 }}>
                        {b?.name ?? formatBuildingType(b?.buildingType ?? null) ?? "Selected Asset"}
                    </div>
                </div>
                {selectedTractId && (
                    <button
                        onClick={() => navigateToTract(selectedTractId)}
                        style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "50%",
                            color: "#64748b",
                            cursor: "pointer",
                            width: 24,
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            transition: "all 0.2s"
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#e2e8f0"; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#64748b"; }}
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Basic Metrics */}
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "8px 12px" }}>
                <StatRow label="Classification" value={formatBuildingType(b?.buildingType ?? null)} />
                <StatRow label="Verticality" value={b?.levels ? `${b.levels} Floors (${b.estimatedHeight?.toFixed(1)}m)` : null} />
                <StatRow label="Materiality" value={b?.material ? b.material.charAt(0).toUpperCase() + b.material.slice(1) : null} />
                <StatRow label="Coordinates" value={b?.lat ? `${b.lat.toFixed(5)}, ${b.lon?.toFixed(5)}` : null} />
            </div>

            {/* Tactical Simulation HUD */}
            <div style={{
                background: simulationRunning ? "rgba(148,210,189,0.05)" : "rgba(15,23,42,0.3)",
                border: `1px solid ${simulationRunning ? "rgba(148,210,189,0.2)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10,
                padding: 16,
                position: "relative",
                overflow: "hidden"
            }}>
                {/* Scanning effect when running */}
                {simulationRunning && (
                    <div style={{
                        position: "absolute",
                        top: 0, left: 0, right: 0, height: 2,
                        background: "linear-gradient(to right, transparent, #94d2bd, transparent)",
                        animation: "scan 2s linear infinite",
                        zIndex: 1
                    }} />
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: simulationRunning ? "#94d2bd" : "#64748b", letterSpacing: "0.05em" }}>
                        {simulationRunning ? "● SIMULATION ACTIVE" : "○ SIMULATION IDLE"}
                    </div>
                    <button
                        onClick={simulationRunning ? stopSimulation : startSimulation}
                        style={{
                            background: simulationRunning ? "rgba(239, 68, 68, 0.1)" : "rgba(148, 210, 189, 0.1)",
                            border: `1px solid ${simulationRunning ? "rgba(239, 68, 68, 0.3)" : "rgba(148, 210, 189, 0.3)"}`,
                            borderRadius: 4,
                            color: simulationRunning ? "#f87171" : "#94d2bd",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "4px 10px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        {simulationRunning ? "TERMINATE" : "INITIALIZE"}
                    </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ textAlign: "center", padding: 8, background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#64748b", marginBottom: 4 }}>TICK</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", fontFamily: "monospace" }}>
                            {tick.toString().padStart(6, '0')}
                        </div>
                    </div>
                    <div style={{ textAlign: "center", padding: 8, background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#64748b", marginBottom: 4 }}>AGENTS</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: simulationRunning ? "#94d2bd" : "#e2e8f0", fontFamily: "monospace" }}>
                            {agentCount.toString().padStart(3, '0')}
                        </div>
                    </div>
                </div>

                <div style={{ fontSize: 9, color: "#475569", lineHeight: 1.4 }}>
                    {simulationRunning
                        ? "Real-time trajectory propagation and agent interaction active via mocked Rust kernel."
                        : "Simulation ready for initialization. Awaiting signal from operational control."}
                </div>
            </div>

            {/* Footer / Meta */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#334155" }}>
                <span>OSM 3D Buildings</span>
                <span>SYSTEM: NOMINAL</span>
            </div>

            <style>{`
        @keyframes scan {
          0% { transform: translateY(-20px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(120px); opacity: 0; }
        }
      `}</style>
        </div>
    );
}
