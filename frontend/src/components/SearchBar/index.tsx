import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Building, X, Loader2 } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { Cartesian3, Math as CesiumMath } from 'cesium';

interface SearchResult {
    type: 'location' | 'business';
    label: string;
    description: string;
    lat: number;
    lon: number;
    original?: any;
}

export function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [localBusinesses, setLocalBusinesses] = useState<any[]>([]);
    const { viewer, setSelectedBusiness } = useMapStore();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load local businesses once
    useEffect(() => {
        fetch("/data/nj_businesses.geojson")
            .then(r => r.json())
            .then(data => setLocalBusinesses(data.features))
            .catch(e => console.error("Failed to load businesses for search", e));
    }, []);

    // Handle clicks outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const searchLocations = async (val: string) => {
        if (val.length < 2) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        setIsOpen(true);

        try {
            // 1. Search OpenStreetMap (Nominatim)
            const osmPromise = fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=us&viewbox=-75.56,41.36,-73.89,38.92&bounded=1`)
                .then(r => r.json())
                .then(data => data.map((item: any) => ({
                    type: 'location',
                    label: item.display_name.split(',')[0],
                    description: item.display_name.split(',').slice(1).join(',').trim(),
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon)
                })));

            // 2. Search local businesses
            const searchVal = val.toLowerCase();
            const filteredBusinesses: SearchResult[] = localBusinesses
                .filter(f => f.properties.name?.toLowerCase().includes(searchVal))
                .slice(0, 5)
                .map(f => ({
                    type: 'business',
                    label: f.properties.name,
                    description: `${f.properties.category || ''} ${f.properties.type || ''}`.trim(),
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0],
                    original: f.properties
                }));

            const osmResults = await osmPromise;
            setResults([...filteredBusinesses, ...osmResults]);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query) searchLocations(query);
            else {
                setResults([]);
                setIsOpen(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        if (!viewer) return;

        viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(result.lon, result.lat, 1000),
            orientation: {
                heading: CesiumMath.toRadians(0),
                pitch: CesiumMath.toRadians(-45)
            },
            duration: 2
        });

        if (result.type === 'business' && result.original) {
            setSelectedBusiness(result.original);
        }

        setIsOpen(false);
        setQuery(result.label);
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 20, 30, 0.85)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 10,
                padding: '8px 14px',
                gap: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
                <Search size={18} color="#94d2bd" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search locations or businesses..."
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        fontSize: 14,
                        outline: 'none',
                    }}
                />
                {isLoading ? (
                    <Loader2 size={16} color="#64748b" className="animate-spin" />
                ) : query && (
                    <X
                        size={16}
                        color="#64748b"
                        style={{ cursor: 'pointer' }}
                        onClick={() => { setQuery(''); setResults([]); }}
                    />
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '120%',
                    left: 0,
                    right: 0,
                    background: 'rgba(15, 20, 30, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    zIndex: 1000,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                    {results.map((res, i) => (
                        <div
                            key={i}
                            onClick={() => handleSelect(res)}
                            style={{
                                padding: '12px 16px',
                                borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            {res.type === 'location' ? (
                                <MapPin size={16} color="#38bdf8" />
                            ) : (
                                <Building size={16} color="#f59e0b" />
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>{res.label}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {res.description}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
