import { useState, useEffect, useRef } from "react";
import { useMapStore } from "../../store/useMapStore";
import { useDraggable } from "../../hooks/useDraggable";

interface BizFeature {
    name: string;
    type: string;
    category: string;
    lat: number;
    lon: number;
}

const CAT_COLOR: Record<string, string> = {
    amenity: "#f59e0b",
    shop: "#34d399",
    office: "#818cf8",
};
const CAT_EMOJI: Record<string, string> = {
    amenity: "🍽️",
    shop: "🛍️",
    office: "🏢",
};

let cache: BizFeature[] | null = null;
async function loadAll(): Promise<BizFeature[]> {
    if (cache) return cache;
    const r = await fetch("/data/nj_businesses.geojson");
    const d = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache = (d.features as any[]).map((f: any) => ({
        name: f.properties.name as string,
        type: f.properties.type as string,
        category: f.properties.category as string,
        lat: f.geometry.coordinates[1] as number,
        lon: f.geometry.coordinates[0] as number,
    }));
    return cache!;
}

function getBizInView(all: BizFeature[], camLat: number, camLon: number, altM: number): BizFeature[] {
    const spanDeg = Math.max(0.002, (altM / 111_000) * 1.6);
    return all
        .filter(b => Math.abs(b.lat - camLat) < spanDeg && Math.abs(b.lon - camLon) < spanDeg * 1.4)
        .slice(0, 30);
}

export function BusinessesInFrame() {
    const { showBusinesses, setSelectedBusiness } = useMapStore();
    const [inFrame, setInFrame] = useState<BizFeature[]>([]);
    const [minimized, setMinimized] = useState(false);
    const allRef = useRef<BizFeature[]>([]);
    const rafRef = useRef<number>(0);

    // Start off centered at bottom
    const { pos, onMouseDown } = useDraggable(0, 0);

    useEffect(() => { loadAll().then(d => { allRef.current = d; }); }, []);

    useEffect(() => {
        if (!showBusinesses) { setInFrame([]); return; }
        const poll = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const viewer = (window as any).__cesiumViewer;
            if (!viewer || viewer.isDestroyed() || allRef.current.length === 0) {
                rafRef.current = window.setTimeout(poll, 600); return;
            }
            const cam = viewer.camera;
            const carto = cam.positionCartographic;
            const lat = (carto.latitude * 180) / Math.PI;
            const lon = (carto.longitude * 180) / Math.PI;
            const alt = carto.height;
            if (alt < 8000) setInFrame(getBizInView(allRef.current, lat, lon, alt));
            else setInFrame([]);
            rafRef.current = window.setTimeout(poll, 600);
        };
        poll();
        return () => { window.clearTimeout(rafRef.current); };
    }, [showBusinesses]);

    if (!showBusinesses || inFrame.length === 0) return null;

    return (
        <div
            style={{
                position: "absolute",
                // Anchor: default bottom-center, then offset by drag
                bottom: pos.y === 0 ? 90 : undefined,
                top: pos.y !== 0 ? `calc(50% + ${pos.y}px)` : undefined,
                left: `calc(50% + ${pos.x}px)`,
                transform: "translateX(-50%)",
                zIndex: 300,
                width: 300,
                background: "rgba(8, 12, 22, 0.80)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(148,210,189,0.15)",
                borderRadius: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
                overflow: "hidden",
                fontFamily: "inherit",
                color: "#e2e8f0",
                userSelect: "none",
            }}
        >
            {/* Drag handle / header */}
            <div
                onMouseDown={onMouseDown}
                style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px",
                    borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.06)",
                    cursor: "grab",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#94d2bd", boxShadow: "0 0 6px #94d2bd" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#94d2bd", letterSpacing: "0.1em" }}>
                        IN VIEW · {inFrame.length} BUSINESS{inFrame.length !== 1 ? "ES" : ""}
                    </span>
                </div>
                <button
                    onClick={() => setMinimized(m => !m)}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
                >
                    {minimized ? "▲" : "▼"}
                </button>
            </div>

            {/* List */}
            {!minimized && (
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {inFrame.map((b, i) => {
                        const color = CAT_COLOR[b.category] ?? "#94a3b8";
                        return (
                            <button
                                key={i}
                                onClick={() => {
                                    setSelectedBusiness(b);
                                }}
                                style={{
                                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                                    textAlign: "left", padding: "7px 12px", background: "transparent",
                                    border: "none", borderBottom: i < inFrame.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                                    cursor: "pointer", color: "#e2e8f0", transition: "background 0.1s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(148,210,189,0.05)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                                <span style={{ fontSize: 14, flexShrink: 0 }}>{CAT_EMOJI[b.category] ?? "📌"}</span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                                    <div style={{ fontSize: 9, color, marginTop: 1 }}>{b.type}</div>
                                </div>
                                <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#334155" strokeWidth={2} style={{ flexShrink: 0 }}>
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
