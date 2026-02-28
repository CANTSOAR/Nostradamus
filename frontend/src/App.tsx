import { useState, useCallback } from "react";
import { useMapStore } from "./store/useMapStore";
import { CesiumMap } from "./components/CesiumMap";
import { VariableSelector } from "./components/VariableSelector";
import { TractSidebar } from "./components/TractSidebar";
import { LayerControl } from "./components/LayerControl";
import { Legend } from "./components/Legend";
import type { TractProperties } from "./types/tract";
import type { Viewer } from "cesium";

const panelStyle: React.CSSProperties = {
  background: "rgba(15,20,30,0.85)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
  fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
};

export default function App() {
  const { setSelectedTract, activeVariable } = useMapStore();
  const [selectedProps, setSelectedProps] = useState<TractProperties | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const handleTractSelect = useCallback(
    (geoid: string | null, props: TractProperties | null) => {
      setSelectedTract(geoid);
      setSelectedProps(props);
    },
    [setSelectedTract]
  );

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#0a0e1a" }}>
      {/* Globe fills entire viewport */}
      <CesiumMap onViewerReady={setViewer} viewer={viewer} onTractSelect={handleTractSelect} />

      {/* Top-left: title */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          top: 16,
          left: 16,
          padding: "10px 18px",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.05em", color: "#94d2bd" }}>
          PALANTIR AT HOME
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          NJ Economic Atlas · ACS 2023 · BLS QCEW 2023
        </div>
      </div>

      {/* Top-center: variable selector */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 16px",
        }}
      >
        <VariableSelector />
      </div>

      {/* Top-right: layer control */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          top: 16,
          right: 16,
          padding: "12px 16px",
          minWidth: 160,
        }}
      >
        <LayerControl />
      </div>

      {/* Bottom-left: legend */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          bottom: 24,
          left: 16,
          padding: "12px 16px",
          minWidth: 200,
        }}
      >
        <Legend activeVariable={activeVariable} />
      </div>

      {/* Right: tract sidebar (only when tract selected) */}
      {selectedProps && (
        <div
          style={{
            ...panelStyle,
            position: "absolute",
            top: 80,
            right: 16,
            padding: "16px",
            width: 260,
          }}
        >
          <TractSidebar
            props={selectedProps}
            onClose={() => handleTractSelect(null, null)}
          />
        </div>
      )}
    </div>
  );
}
