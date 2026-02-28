import { useState, useEffect, useRef, useCallback } from "react";
import { useMapStore } from "../../store/useMapStore";

interface Suggestion {
    id: string;
    label: string;
    sublabel?: string;
    lat: number;
    lon: number;
    alt: number;                    // camera altitude in meters
    kind: "place" | "business";
    category?: string;
    type?: string;
}

// NJ bounding box for Nominatim
const NJ_VIEWBOX = "-75.6,38.8,-73.8,41.4";

let bizCache: Suggestion[] | null = null;

async function loadBusinesses(): Promise<Suggestion[]> {
    if (bizCache) return bizCache;
    const res = await fetch("/data/nj_businesses.geojson");
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bizCache = (data.features as any[]).map((f: any, i: number) => ({
        id: `biz-${i}`,
        label: f.properties.name as string,
        sublabel: `${f.properties.type} · ${f.properties.category}`,
        lat: f.geometry.coordinates[1] as number,
        lon: f.geometry.coordinates[0] as number,
        alt: 400,
        kind: "business" as const,
        category: f.properties.category,
        type: f.properties.type,
    }));
    return bizCache!;
}

async function searchNominatim(query: string): Promise<Suggestion[]> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&viewbox=${NJ_VIEWBOX}&bounded=1&countrycodes=us`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await res.json();
    return items.map((item, i) => ({
        id: `nom-${i}`,
        label: item.display_name.split(",").slice(0, 2).join(","),
        sublabel: item.display_name.split(",").slice(2, 4).join(",").trim(),
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        alt: item.type === "city" || item.type === "town" ? 8000 : 600,
        kind: "place" as const,
    }));
}

const CATEGORY_COLOR: Record<string, string> = {
    amenity: "#f59e0b",
    shop: "#34d399",
    office: "#818cf8",
};

export function SearchBar() {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeSuggestion, setActiveSuggestion] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { setFlyToRequest, setSelectedBusiness, showBusinesses, toggleBusinesses } = useMapStore();

    const search = useCallback(async (q: string) => {
        if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
        setLoading(true);
        try {
            const [businesses, places] = await Promise.all([
                loadBusinesses(),
                searchNominatim(q),
            ]);

            const ql = q.toLowerCase();
            const bizMatches = businesses
                .filter(b => b.label.toLowerCase().includes(ql) || b.type?.toLowerCase().includes(ql))
                .slice(0, 5);

            const all = [...bizMatches, ...places].slice(0, 10);
            setSuggestions(all);
            setOpen(all.length > 0);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(query), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, search]);

    const select = (s: Suggestion) => {
        setQuery(s.label);
        setOpen(false);
        setActiveSuggestion(-1);
        setFlyToRequest({ lat: s.lat, lon: s.lon, alt: s.alt, label: s.label });

        if (s.kind === "business") {
            if (!showBusinesses) toggleBusinesses();
            setSelectedBusiness({
                name: s.label,
                type: s.type ?? "Business",
                category: s.category ?? "amenity",
                lat: s.lat,
                lon: s.lon,
            });
        }
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (!open) return;
        if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActiveSuggestion(i => Math.max(i - 1, 0)); }
        if (e.key === "Enter" && activeSuggestion >= 0) { select(suggestions[activeSuggestion]); }
        if (e.key === "Escape") setOpen(false);
    };

    return (
        <div style={{ position: "relative", width: 340 }}>
            {/* Glass panel */}
            <div style={{
                background: "rgba(10, 16, 28, 0.72)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: 12,
                border: "1px solid rgba(148, 210, 189, 0.18)",
                boxShadow: "0 4px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
                padding: "6px 10px",
            }}>
                {/* Input row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94d2bd" strokeWidth={2} style={{ flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setActiveSuggestion(-1); }}
                        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
                        onBlur={() => setTimeout(() => setOpen(false), 150)}
                        onKeyDown={handleKey}
                        placeholder="Search NJ towns, addresses, businesses…"
                        style={{
                            background: "transparent", border: "none", outline: "none",
                            color: "#e2e8f0", fontSize: 13, flex: 1,
                            fontFamily: "inherit", letterSpacing: "0.01em",
                        }}
                        aria-label="Search map"
                        id="map-search-input"
                    />
                    {loading && (
                        <div style={{ width: 12, height: 12, border: "2px solid rgba(148,210,189,0.3)", borderTopColor: "#94d2bd", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
                    )}
                    {query && !loading && (
                        <button onClick={() => { setQuery(""); setSuggestions([]); setOpen(false); inputRef.current?.focus(); }}
                            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 16 }}
                            aria-label="Clear search"
                        >×</button>
                    )}
                </div>
            </div>

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 999,
                    background: "rgba(10,15,25,0.96)", backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                    overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}>
                    {suggestions.map((s, i) => (
                        <button
                            key={s.id}
                            onMouseDown={() => select(s)}
                            onMouseEnter={() => setActiveSuggestion(i)}
                            style={{
                                display: "flex", alignItems: "center", gap: 8,
                                width: "100%", textAlign: "left", padding: "9px 12px",
                                background: i === activeSuggestion ? "rgba(148,210,189,0.08)" : "transparent",
                                border: "none", borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                                cursor: "pointer", color: "#e2e8f0",
                            }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                background: s.kind === "business" ? (CATEGORY_COLOR[s.category ?? ""] ?? "#94a3b8") + "22" : "rgba(100,116,139,0.15)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                            }}>
                                {s.kind === "business" ? "🏪" : "📍"}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                                {s.sublabel && <div style={{ fontSize: 10, color: "#64748b", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sublabel}</div>}
                            </div>
                            <div style={{ marginLeft: "auto", fontSize: 9, color: s.kind === "business" ? (CATEGORY_COLOR[s.category ?? ""] ?? "#94a3b8") : "#475569", flexShrink: 0 }}>
                                {s.kind === "business" ? "BIZ" : "PLACE"}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
