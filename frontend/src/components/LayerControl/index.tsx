import { useMapStore } from "../../store/useMapStore";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div
        onClick={onChange}
        style={{
          width: 30,
          height: 16,
          borderRadius: 8,
          background: checked ? "#94d2bd" : "rgba(255,255,255,0.12)",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 16 : 2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: checked ? "#0a0e1a" : "#64748b",
            transition: "left 0.2s",
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: checked ? "#e2e8f0" : "#64748b", userSelect: "none" }}>
        {label}
      </span>
    </label>
  );
}

export function LayerControl() {
  const { showBuildings, toggleBuildings, showTracts, toggleTracts } = useMapStore();

  return (
    <div>
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 10 }}>
        LAYERS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Toggle label="3D Buildings" checked={showBuildings} onChange={toggleBuildings} />
        <Toggle label="Census Tracts" checked={showTracts} onChange={toggleTracts} />
      </div>
    </div>
  );
}
