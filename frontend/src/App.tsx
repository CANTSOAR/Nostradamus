import { useState } from 'react';
import { useMapStore } from "./store/useMapStore";
import { AgentChat } from "./components/AgentChat";
import CesiumPage from "./pages/CesiumPage";
import { DataPanel } from "./components/mapbox/DataPanel";
import { ControlsBar } from "./components/mapbox/ControlsBar";
import { useSimulation } from "./hooks/useSimulation";

export default function App() {
    const { activeTab } = useMapStore();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    // The useSimulation hook manages the ws connection and state
    useSimulation();

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#020408", color: "#e2e8f0", overflow: "hidden" }}>
            <div style={{ flex: 1, display: "flex", position: "relative", minHeight: 0 }}>

                {/* Left Side: Map or Data Panel */}
                <div style={{ flex: 1, position: "relative" }}>
                    {/* Map View */}
                    <div style={{ width: "100%", height: "100%", position: 'absolute', opacity: activeTab === 'map' ? 1 : 0, pointerEvents: activeTab === 'map' ? 'auto' : 'none' }}>
                        <CesiumPage />
                    </div>

                    {/* Data View */}
                    <div style={{ width: "100%", height: "100%", position: 'absolute', display: activeTab === "data" ? "block" : "none", overflow: "auto", zIndex: 10, background: '#020408' }}>
                        {/* Data Panel fills the screen when active */}
                        <DataPanel />
                    </div>

                    {/* Sidebar Toggle Tab (visible when collapsed) */}
                    {isSidebarCollapsed && (
                        <button
                            onClick={() => setIsSidebarCollapsed(false)}
                            style={{
                                position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
                                background: 'rgba(15,20,30,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRight: 'none', borderRadius: '8px 0 0 8px', color: '#94d2bd',
                                padding: '12px 6px', cursor: 'pointer', zIndex: 60, backdropFilter: 'blur(8px)'
                            }}
                        >
                            ◀
                        </button>
                    )}
                </div>

                {/* Right Side: AI Agent Sidebar */}
                <div style={{
                    width: isSidebarCollapsed ? 0 : 350,
                    transition: 'width 0.3s ease-in-out',
                    borderLeft: isSidebarCollapsed ? 'none' : "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(10,15,25,0.95)",
                    display: "flex",
                    flexDirection: "column",
                    zIndex: 50,
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {!isSidebarCollapsed && (
                        <>
                            <button
                                onClick={() => setIsSidebarCollapsed(true)}
                                style={{
                                    position: 'absolute', top: 16, right: 16,
                                    background: 'transparent', border: 'none', color: '#64748b',
                                    fontSize: 18, cursor: 'pointer', zIndex: 10
                                }}
                            >
                                ✕
                            </button>
                            <AgentChat sidebar />
                        </>
                    )}
                </div>
            </div>

            {/* Bottom: Controls Bar */}
            <div style={{ height: 60, borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,20,30,0.95)", zIndex: 50 }}>
                <ControlsBar />
            </div>
        </div>
    );
}
