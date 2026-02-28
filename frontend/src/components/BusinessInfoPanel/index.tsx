import { useMapStore } from "../../store/useMapStore";

const CATEGORY_LABEL: Record<string, string> = {
  amenity: "Amenity",
  shop: "Shop",
  office: "Office",
};

const CATEGORY_COLOR: Record<string, string> = {
  amenity: "#f59e0b",
  shop: "#34d399",
  office: "#818cf8",
};

interface BusinessInfoPanelProps {
  business: {
    name: string;
    type: string;
    category: string;
    lat: number;
    lon: number;
  };
}

export function BusinessInfoPanel({ business }: BusinessInfoPanelProps) {
  const { setSelectedBusiness } = useMapStore();
  const b = business;

  const color = CATEGORY_COLOR[b.category] ?? "#94a3b8";
  const catLabel = CATEGORY_LABEL[b.category] ?? "Business";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, color, letterSpacing: "0.1em", fontWeight: 600 }}>
            {catLabel.toUpperCase()} · {b.type.toUpperCase()}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginTop: 3, lineHeight: 1.3 }}>
            {b.name}
          </div>
        </div>
        <button
          onClick={() => setSelectedBusiness(null)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 5, color: "#64748b", cursor: "pointer",
            fontSize: 14, padding: "2px 8px", lineHeight: 1.5, flexShrink: 0,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "7px 9px" }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>CATEGORY</div>
          <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 2 }}>{catLabel}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "7px 9px" }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>TYPE</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginTop: 2 }}>{b.type}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "7px 9px", gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>LOCATION</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            {b.lat.toFixed(5)}, {b.lon.toFixed(5)}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: "#334155", textAlign: "right" }}>
        OpenStreetMap contributors
      </div>
    </div>
  );
}
