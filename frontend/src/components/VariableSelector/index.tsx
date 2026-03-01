import { useMapStore } from "../../store/useMapStore";
import { VARIABLES } from "../../types/variables";
import type { VariableKey } from "../../types/variables";

export function VariableSelector() {
  const { activeVariable, setActiveVariable } = useMapStore();

  return (
    <div style={{
      display: "flex",
      gap: 6,
      alignItems: "center",
      flexWrap: "wrap", /* Fix overflow issue */
      justifyContent: "center",
      maxWidth: 800
    }}>
      {VARIABLES.map((v) => (
        <button
          key={v.key}
          onClick={() => setActiveVariable(v.key as VariableKey)}
          title={v.description}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid",
            borderColor: activeVariable === v.key ? "#94d2bd" : "rgba(255,255,255,0.1)",
            background: activeVariable === v.key ? "rgba(148,210,189,0.15)" : "transparent",
            color: activeVariable === v.key ? "#94d2bd" : "#94a3b8",
            fontSize: 12,
            fontWeight: activeVariable === v.key ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.15s",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
