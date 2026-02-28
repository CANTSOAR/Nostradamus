import { useState, useEffect, useRef } from "react";
import { useMapStore } from "../../store/useMapStore";

interface BusinessFeature {
    name: string;
    type: string;
    category: string;
    lat: number;
    lon: number;
}

const CATEGORY_COLOR: Record<string, string> = {
    amenity: "#f59e0b",
    shop: "#34d399",
    office: "#818cf8",
};
const CATEGORY_LABEL: Record<string, string> = {
    amenity: "Amenity",
    shop: "Shop",
    office: "Office",
};

let bizCachePanel: BusinessFeature[] | null = null;

async function loadBizList(): Promise<BusinessFeature[]> {
    if (bizCachePanel) return bizCachePanel;
    const res = await fetch("/data/nj_businesses.geojson");
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bizCachePanel = (data.features as any[]).map((f: any) => ({
        name: f.properties.name as string,
        type: f.properties.type as string,
        category: f.properties.category as string,
        lat: f.geometry.coordinates[1] as number,
        lon: f.geometry.coordinates[0] as number,
    }));
    return bizCachePanel!;
}

export function BusinessListPanel() {
    const { showBusinessList, toggleBusinessList, setSelectedBusiness, showBusinesses, toggleBusinesses } = useMapStore();
    const [all, setAll] = useState<BusinessFeature[]>([]);
    const [filter, setFilter] = useState("");
    const [catFilter, setCatFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [loading, setLoading] = useState(false);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (!showBusinessList || loadedRef.current) return;
        loadedRef.current = true;
        setLoading(true);
        loadBizList().then(d => { setAll(d); setLoading(false); });
    }, [showBusinessList]);

    if (!showBusinessList) return null;

    const types = Array.from(new Set(all.map(b => b.type))).sort();
    const fl = filter.toLowerCase();

    const filtered = all.filter(b => {
        const matchQ = !fl || b.name.toLowerCase().includes(fl) || b.type.toLowerCase().includes(fl);
        const matchCat = catFilter === "all" || b.category === catFilter;
        const matchType = typeFilter === "all" || b.type === typeFilter;
        return matchQ && matchCat && matchType;
    });

    const handleSelect = (b: BusinessFeature) => {
        if (!showBusinesses) toggleBusinesses();
        setSelectedBusiness(b);
    };

    return (
        <div
            className="biz-list-panel"
            style={{
                position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
                zIndex: 500, width: 360, maxHeight: "calc(100vh - 80px)",
                display: "flex", flexDirection: "column",
                background: "rgba(10,15,25,0.94)", backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                color: "#e2e8f0", fontFamily: "inherit", overflow: "hidden",
                boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
            }}
        >
            {/* Header */}
            <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}>ALL BUSINESSES · NJ</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#94d2bd", marginTop: 2 }}>
                            {filtered.length.toLocaleString()} results
                            {all.length > 0 && filtered.length < all.length && ` of ${all.length.toLocaleString()}`}
                        </div>
                    </div>
                    <button
                        onClick={toggleBusinessList}
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 16, padding: "3px 9px", lineHeight: 1.4 }}
                        aria-label="Close business list"
                    >×</button>
                </div>

                {/* Search within list */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", padding: "5px 9px", marginBottom: 8 }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Filter by name or type…"
                        style={{ background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 11, flex: 1, fontFamily: "inherit" }}
                    />
                    {filter && <button onClick={() => setFilter("")} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 0, fontSize: 13 }}>×</button>}
                </div>

                {/* Category + Type filters */}
                <div style={{ display: "flex", gap: 6 }}>
                    {/* Category */}
                    <select
                        value={catFilter}
                        onChange={e => setCatFilter(e.target.value)}
                        style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#e2e8f0", fontSize: 10, padding: "4px 6px", cursor: "pointer" }}
                    >
                        <option value="all">All Categories</option>
                        <option value="amenity">Amenity</option>
                        <option value="shop">Shop</option>
                        <option value="office">Office</option>
                    </select>
                    {/* Type */}
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#e2e8f0", fontSize: 10, padding: "4px 6px", cursor: "pointer" }}
                    >
                        <option value="all">All Types</option>
                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
                {loading && (
                    <div style={{ textAlign: "center", padding: 24, color: "#475569", fontSize: 12 }}>Loading businesses…</div>
                )}
                {!loading && filtered.length === 0 && (
                    <div style={{ textAlign: "center", padding: 24, color: "#475569", fontSize: 12 }}>No businesses match your filters.</div>
                )}
                {filtered.slice(0, 200).map((b, i) => {
                    const color = CATEGORY_COLOR[b.category] ?? "#94a3b8";
                    const catLabel = CATEGORY_LABEL[b.category] ?? "Business";
                    return (
                        <button
                            key={i}
                            onClick={() => handleSelect(b)}
                            style={{
                                display: "flex", alignItems: "center", gap: 9,
                                width: "100%", textAlign: "left", padding: "8px 14px",
                                background: "transparent", border: "none",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                cursor: "pointer", color: "#e2e8f0",
                                transition: "background 0.12s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(148,210,189,0.06)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                            <div style={{
                                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                                background: color + "22", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 13,
                            }}>
                                {b.category === "amenity" ? "🍽️" : b.category === "shop" ? "🛍️" : "🏢"}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                                <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{b.type} · <span style={{ color }}>{catLabel}</span></div>
                            </div>
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#334155" strokeWidth={2} style={{ flexShrink: 0 }}>
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>
                    );
                })}
                {filtered.length > 200 && (
                    <div style={{ textAlign: "center", padding: "10px 0", fontSize: 10, color: "#475569" }}>
                        Showing 200 of {filtered.length.toLocaleString()} — refine filters to see more
                    </div>
                )}
            </div>
        </div>
    );
}
