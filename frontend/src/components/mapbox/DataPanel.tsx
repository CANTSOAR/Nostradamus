import { useState, useMemo } from 'react';
import { useMapStore } from '../../store/useMapStore';
import {
    Search, Map as MapIcon, Users, Building2, Landmark,
    ChevronRight, ChevronDown, TrendingUp, Activity,
    Home, Briefcase, GraduationCap, Heart, DollarSign, AlertTriangle,
    MapPin, Navigation
} from 'lucide-react';
import {
    Cartesian3,
    Math as CesiumMath,
} from 'cesium';
import type { Agent } from '../../types/agent';
import type { CountyStats } from '../../types/payload';

// ─── Berkeley Heights real data (NJ MOD-IV 2024) ────────────────────────────
// Union County — Tax Rate 4.287% — sampled from geocoded property records
const BH_STATS = {
    taxRate: 4.287,
    totalProperties: 6124,
    totalAssessedValue: 2_647_800_000,
    avgAssessedValue: 432_400,
    medianAssessedValue: 389_500,
    totalTaxLevy: 113_534_000,
    avgTax: 18_539,
    medianTax: 16_706,
    minValue: 126_400,
    maxValue: 3_850_000,
};

// Sample top-value properties for a quick preview table
const BH_SAMPLE_PROPS = [
    { address: '2 BASKING RIDGE RD', value: 3_850_000, tax: 165_050 },
    { address: '195 PLAINFIELD AVE', value: 2_100_000, tax: 90_027 },
    { address: '604 MOUNTAIN AVE', value: 414_100, tax: 17_752 },
    { address: '596 MOUNTAIN AVE', value: 467_300, tax: 20_033 },
    { address: '588 MOUNTAIN AVE', value: 518_000, tax: 22_207 },
];

// Berkeley Heights centroid
const BH_LAT = 40.6812;
const BH_LON = -74.4429;

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number, decimals = 1) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`;
    return `$${Math.round(n).toLocaleString()}`;
};

const fmtPop = (n: number) => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString();
};

const pct = (num: number, denom: number) =>
    denom > 0 ? `${((num / denom) * 100).toFixed(1)}%` : '—';

const COUNTY_NAMES: Record<number, string> = {
    0: 'Atlantic', 1: 'Bergen', 2: 'Burlington', 3: 'Camden', 4: 'Cape May',
    5: 'Cumberland', 6: 'Essex', 7: 'Gloucester', 8: 'Hudson', 9: 'Hunterdon',
    10: 'Mercer', 11: 'Middlesex', 12: 'Monmouth', 13: 'Morris', 14: 'Ocean',
    15: 'Passaic', 16: 'Salem', 17: 'Somerset', 18: 'Sussex', 19: 'Union', 20: 'Warren',
};

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon: Icon }: {
    label: string; value: string; color: string; icon: any;
}) {
    return (
        <div style={{
            background: `rgba(${color},0.04)`, border: `1px solid rgba(${color},0.15)`,
            borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: `rgba(${color},0.7)`, fontSize: 11 }}>
                <Icon size={11} /> {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: `rgb(${color})` }}>{value}</div>
        </div>
    );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <h3 style={{
            fontSize: 11, color: '#475569', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginTop: 28, marginBottom: 10, fontWeight: 700,
            borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6
        }}>
            {children}
        </h3>
    );
}

function BarRow({ label, value, max, color, fmt: fmtFn }: {
    label: string; value: number; max: number; color: string; fmt?: (n: number) => string;
}) {
    const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: '#94a3b8' }}>{label}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{fmtFn ? fmtFn(value) : value.toLocaleString()}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
            </div>
        </div>
    );
}

function AgentDistributionPanel({ agents }: { agents: Agent[] }) {
    const stats = useMemo(() => {
        if (!agents.length) return null;

        let employed = 0, students = 0, retired = 0, unemployed = 0;
        let homeowners = 0;
        const ageBuckets = { children: 0, youth: 0, adults: 0, middleAge: 0, seniors: 0 };
        let totalWealth = 0, totalIncome = 0, totalHealth = 0;
        const eduLevels = [0, 0, 0, 0, 0, 0];

        for (const a of agents) {
            totalWealth += a.wealth;
            totalIncome += a.income;
            totalHealth += a.health;
            if (a.is_homeowner) homeowners++;
            if (a.education_level < 6) eduLevels[a.education_level]++;

            if (a.age < 5) ageBuckets.children++;
            else if (a.age < 18) ageBuckets.youth++;
            else if (a.age < 35) ageBuckets.adults++;
            else if (a.age < 65) ageBuckets.middleAge++;
            else ageBuckets.seniors++;

            if (a.employer_location_id !== null) employed++;
            else if (a.school_location_id !== null) students++;
            else if (a.age >= 65) retired++;
            else unemployed++;
        }

        const n = agents.length;
        return {
            employed, students, retired, unemployed, homeowners,
            ageBuckets, eduLevels,
            avgWealth: totalWealth / n,
            avgIncome: totalIncome / n,
            avgHealth: totalHealth / n,
            n,
        };
    }, [agents]);

    if (!stats) return <p style={{ color: '#64748b', fontSize: 13 }}>No agent data in viewport.</p>;

    const maxAge = Math.max(...Object.values(stats.ageBuckets));

    return (
        <>
            {/* Employment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <StatCard label="Employed" value={pct(stats.employed, stats.n)} color="56,189,248" icon={Briefcase} />
                <StatCard label="Students" value={pct(stats.students, stats.n)} color="52,211,153" icon={GraduationCap} />
                <StatCard label="Retired" value={pct(stats.retired, stats.n)} color="251,191,36" icon={Heart} />
                <StatCard label="Homeowners" value={pct(stats.homeowners, stats.n)} color="168,85,247" icon={Home} />
            </div>

            {/* Avg financials */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Avg Wealth</div>
                    <div style={{ fontSize: 14, color: '#fbbf24', fontWeight: 700 }}>{fmt(stats.avgWealth)}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Avg Income</div>
                    <div style={{ fontSize: 14, color: '#4ade80', fontWeight: 700 }}>{fmt(stats.avgIncome)}/yr</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Avg Health</div>
                    <div style={{ fontSize: 14, color: '#f472b6', fontWeight: 700 }}>{(stats.avgHealth * 100).toFixed(0)}%</div>
                </div>
            </div>

            {/* Age distribution */}
            <div style={{ marginBottom: 4, fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Age Distribution
            </div>
            <BarRow label="Children (0–4)" value={stats.ageBuckets.children} max={maxAge} color="#38bdf8" fmt={n => n.toLocaleString()} />
            <BarRow label="Youth (5–17)" value={stats.ageBuckets.youth} max={maxAge} color="#34d399" fmt={n => n.toLocaleString()} />
            <BarRow label="Young Adults (18–34)" value={stats.ageBuckets.adults} max={maxAge} color="#a78bfa" fmt={n => n.toLocaleString()} />
            <BarRow label="Middle Age (35–64)" value={stats.ageBuckets.middleAge} max={maxAge} color="#fbbf24" fmt={n => n.toLocaleString()} />
            <BarRow label="Seniors (65+)" value={stats.ageBuckets.seniors} max={maxAge} color="#f472b6" fmt={n => n.toLocaleString()} />
        </>
    );
}

function CountyCard({ county }: { county: CountyStats }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
            <div
                onClick={() => setOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 10 }}
            >
                <span style={{ color: '#38bdf8' }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                <MapIcon size={13} color="#94a3b8" />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                    {county.name || COUNTY_NAMES[county.county_id] || `County ${county.county_id}`}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{fmtPop(county.population)}</span>
            </div>
            {open && (
                <div style={{ padding: '0 14px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'rgba(56,189,248,0.05)', borderRadius: 6, padding: '6px 10px' }}>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Avg Wealth</div>
                        <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 700 }}>{fmt(county.avg_wealth)}</div>
                    </div>
                    <div style={{ background: 'rgba(74,222,128,0.05)', borderRadius: 6, padding: '6px 10px' }}>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Economy Value</div>
                        <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 700 }}>{fmt(county.total_location_value)}</div>
                    </div>
                    <div style={{ background: 'rgba(251,191,36,0.05)', borderRadius: 6, padding: '6px 10px' }}>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Employers</div>
                        <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>{county.num_employers.toLocaleString()}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Berkeley Heights panel ─────────────────────────────────────────────────

function BerkeleyHeightsPanel() {
    const viewer = useMapStore(s => s.viewer);
    const showProperties = useMapStore(s => s.showProperties);
    const toggleProperties = useMapStore(s => s.toggleProperties);
    const setActiveTab = useMapStore(s => s.setActiveTab);

    const fmtCurrency = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

    const handleViewOnMap = () => {
        // Enable property layer
        if (!showProperties) toggleProperties();
        // Switch to map tab
        setActiveTab('map');
        // Fly Cesium camera to Berkeley Heights at ~1km altitude
        if (viewer && !viewer.isDestroyed()) {
            viewer.camera.flyTo({
                destination: Cartesian3.fromDegrees(BH_LON, BH_LAT, 1200),
                orientation: {
                    heading: CesiumMath.toRadians(0),
                    pitch: CesiumMath.toRadians(-40),
                    roll: 0,
                },
                duration: 2.5,
            });
        }
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg,rgba(20,30,50,0.9),rgba(10,20,35,0.95))',
            border: '1px solid rgba(148,210,189,0.25)',
            borderRadius: 12,
            padding: '18px 20px',
            marginBottom: 24,
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <MapPin size={13} color="#94d2bd" />
                        <span style={{ fontSize: 10, color: '#94d2bd', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Berkeley Heights, NJ · Union County
                        </span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>Property Atlas</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>NJ MOD-IV Tax Records · 2024</div>
                </div>
                <button
                    onClick={handleViewOnMap}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 12px',
                        background: 'rgba(148,210,189,0.1)',
                        border: '1px solid rgba(148,210,189,0.35)',
                        borderRadius: 7,
                        color: '#94d2bd',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    <Navigation size={12} /> View on Map
                </button>
            </div>

            {/* Key stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {[
                    { label: 'Tax Rate', value: `${BH_STATS.taxRate}%`, color: '#f472b6' },
                    { label: 'Properties', value: BH_STATS.totalProperties.toLocaleString(), color: '#38bdf8' },
                    { label: 'Total Levy', value: fmtCurrency(BH_STATS.totalTaxLevy), color: '#fbbf24' },
                    { label: 'Avg Value', value: fmtCurrency(BH_STATS.avgAssessedValue), color: '#4ade80' },
                    { label: 'Median Value', value: fmtCurrency(BH_STATS.medianAssessedValue), color: '#a78bfa' },
                    { label: 'Avg Tax/yr', value: fmtCurrency(BH_STATS.avgTax), color: '#fb923c' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${color}22`,
                        borderRadius: 7,
                        padding: '8px 10px',
                    }}>
                        <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Value range bar */}
            <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginBottom: 4 }}>
                    <span>Min {fmtCurrency(BH_STATS.minValue)}</span>
                    <span style={{ fontWeight: 600, color: '#94a3b8' }}>Assessed Value Range</span>
                    <span>Max {fmtCurrency(BH_STATS.maxValue)}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                        position: 'absolute',
                        left: `${(BH_STATS.minValue / BH_STATS.maxValue) * 100}%`,
                        width: `${((BH_STATS.avgAssessedValue - BH_STATS.minValue) / BH_STATS.maxValue) * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg,#38bdf8,#4ade80)',
                        borderRadius: 3,
                    }} />
                    {/* Median marker */}
                    <div style={{
                        position: 'absolute',
                        left: `${(BH_STATS.medianAssessedValue / BH_STATS.maxValue) * 100}%`,
                        top: -1, bottom: -1, width: 2,
                        background: '#fbbf24',
                        borderRadius: 1,
                    }} />
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 3, textAlign: 'center' }}>
                    <span style={{ color: '#fbbf24' }}>▐</span> Median &nbsp;
                    <span style={{ color: '#38bdf8' }}>▬</span> Avg range
                </div>
            </div>

            {/* Sample properties table */}
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Sample Properties
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 7, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <th style={{ padding: '5px 8px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Address</th>
                            <th style={{ padding: '5px 8px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Value</th>
                            <th style={{ padding: '5px 8px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Tax/yr</th>
                        </tr>
                    </thead>
                    <tbody>
                        {BH_SAMPLE_PROPS.map((p, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '5px 8px', color: '#94a3b8' }}>{p.address}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>{fmtCurrency(p.value)}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#f472b6', fontWeight: 600 }}>{fmtCurrency(p.tax)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── main panel ─────────────────────────────────────────────────────────────

export function DataPanel() {
    const simulationData = useMapStore(s => s.simulationData);
    const [agentQuery, setAgentQuery] = useState('');

    const d = simulationData;
    const agents = d?.viewport_agents ?? [];
    const locations = d?.viewport_locations ?? [];
    const counties = d?.county_stats ?? [];
    const state = d?.state_entity;
    const metrics = d?.global_metrics;

    // Quick agent search
    const filteredAgents = useMemo(() => {
        if (!agentQuery.trim()) return agents.slice(0, 50);
        const q = agentQuery.toLowerCase();
        return agents
            .filter(a =>
                String(a.id).includes(q) ||
                (a.age !== undefined && String(a.age).includes(q))
            )
            .slice(0, 50);
    }, [agents, agentQuery]);

    const employers = locations.filter(l => l.location_type === 'Employer' || l.location_type === 'Store');
    const homes = locations.filter(l => l.location_type === 'Residential');

    return (
        <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Search size={18} color="#38bdf8" /> Simulation Browser
                </h2>
                {metrics && (
                    <div style={{ fontSize: 12, color: '#475569' }}>
                        Tick {metrics.tick.toLocaleString()} · {d?.viewport_agents?.length ?? 0} agents in view
                    </div>
                )}
            </div>

            {/* ── Berkeley Heights Property Atlas ── */}
            <BerkeleyHeightsPanel />

            {/* No data banner */}
            {!d && (
                <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <AlertTriangle size={16} color="#fbbf24" />
                    <span style={{ fontSize: 13, color: '#fbbf24' }}>Waiting for simulation data…</span>
                </div>
            )}

            {/* ── Economy Overview ── */}
            <SectionHeader>Economy Overview</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <StatCard label="Total Economy Value" value={state ? fmt(state.total_economy_value) : '—'} color="56,189,248" icon={TrendingUp} />
                <StatCard label="Cash Reserves" value={state ? fmt(state.cash_reserves) : '—'} color="74,222,128" icon={DollarSign} />
                <StatCard label="Population" value={state ? fmtPop(state.population) : '—'} color="168,85,247" icon={Users} />
                <StatCard label="Avg Wealth" value={state ? fmt(state.avg_wealth) : '—'} color="251,191,36" icon={Activity} />
            </div>

            {/* ── Macro Indicators ── */}
            {metrics && (
                <>
                    <SectionHeader>Macro Indicators</SectionHeader>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {[
                            { label: 'Tax Rate', value: `${(metrics.base_tax_rate * 100).toFixed(1)}%`, color: '#38bdf8' },
                            { label: 'Inflation', value: `${(metrics.inflation_rate * 100).toFixed(1)}%`, color: '#f472b6' },
                            { label: 'Interest', value: `${(metrics.base_interest_rate * 100).toFixed(2)}%`, color: '#fbbf24' },
                            { label: 'Death Rate', value: `${(metrics.death_rate * 1000).toFixed(2)}‰`, color: '#f87171' },
                            { label: 'Birth Rate', value: `${(metrics.birth_rate * 1000).toFixed(2)}‰`, color: '#4ade80' },
                            { label: 'Emigration', value: `${(metrics.emigration_rate * 1000).toFixed(2)}‰`, color: '#a78bfa' },
                        ].map(({ label, value, color }) => (
                            <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: 14, color, fontWeight: 700 }}>{value}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ── Sector Favorability ── */}
            {state?.sector_favorability && Object.keys(state.sector_favorability).length > 0 && (
                <>
                    <SectionHeader>Sector Favorability</SectionHeader>
                    {Object.entries(state.sector_favorability)
                        .sort((a, b) => b[1] - a[1])
                        .map(([sector, fav]) => (
                            <BarRow
                                key={sector}
                                label={sector}
                                value={fav}
                                max={2}
                                color={fav >= 1 ? '#4ade80' : '#f87171'}
                                fmt={n => `${n.toFixed(2)}×`}
                            />
                        ))}
                </>
            )}

            {/* ── Counties ── */}
            <SectionHeader>Simulated Counties ({counties.length})</SectionHeader>
            {counties.length === 0
                ? <p style={{ fontSize: 13, color: '#64748b' }}>No county data yet.</p>
                : counties.map(c => <CountyCard key={c.county_id} county={c} />)
            }

            {/* ── Viewport Locations ── */}
            <SectionHeader>Locations in Viewport</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
                {[
                    { label: 'Homes', value: homes.length, color: '#38bdf8' },
                    { label: 'Employers', value: employers.length, color: '#4ade80' },
                    { label: 'Total', value: locations.length, color: '#a78bfa' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
                        <div style={{ fontSize: 18, color, fontWeight: 700 }}>{value.toLocaleString()}</div>
                    </div>
                ))}
            </div>

            {/* ── Agents in Viewport ── */}
            <SectionHeader>Agents in Viewport ({agents.length})</SectionHeader>
            {agents.length > 0 && <AgentDistributionPanel agents={agents} />}

            {/* Agent quick-search */}
            <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
                    <Search size={13} color="#64748b" />
                    <input
                        type="text"
                        placeholder="Filter agents by ID or age…"
                        value={agentQuery}
                        onChange={e => setAgentQuery(e.target.value)}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 13 }}
                    />
                </div>
                {filteredAgents.length > 0 && (
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ color: '#475569', textAlign: 'left' }}>
                                    {['ID', 'Age', 'Wealth', 'Income', 'Health', 'Employment'].map(h => (
                                        <th key={h} style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAgents.map(a => (
                                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '4px 6px', color: '#64748b' }}>{a.id}</td>
                                        <td style={{ padding: '4px 6px', color: '#e2e8f0' }}>{a.age}</td>
                                        <td style={{ padding: '4px 6px', color: '#fbbf24' }}>{fmt(a.wealth)}</td>
                                        <td style={{ padding: '4px 6px', color: '#4ade80' }}>{fmt(a.income)}/yr</td>
                                        <td style={{ padding: '4px 6px', color: a.health > 0.7 ? '#4ade80' : a.health > 0.4 ? '#fbbf24' : '#f87171' }}>
                                            {(a.health * 100).toFixed(0)}%
                                        </td>
                                        <td style={{ padding: '4px 6px', color: '#94a3b8' }}>
                                            {a.employer_location_id ? '💼 Employed' : a.school_location_id ? '🎓 Student' : a.age >= 65 ? '🏖 Retired' : '⏳ Seeking'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {agents.length > 50 && (
                            <div style={{ fontSize: 11, color: '#475569', padding: '6px 6px 0', textAlign: 'center' }}>
                                Showing 50 of {agents.length} agents in viewport
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Bulk Actions ── */}
            <SectionHeader>Bulk Actions</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <button style={{ padding: '10px 12px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 6, color: '#38bdf8', fontSize: 12, cursor: 'pointer', fontWeight: 500, textAlign: 'left' }}>💰 Stimulus Check</button>
                <button style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer', fontWeight: 500, textAlign: 'left' }}>📉 Mass Layoff</button>
                <button style={{ padding: '10px 12px', background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 6, color: '#c084fc', fontSize: 12, cursor: 'pointer', fontWeight: 500, textAlign: 'left' }}>🦠 Pandemic</button>
                <button style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, cursor: 'pointer', fontWeight: 500, textAlign: 'left' }}>🏛 Change Tax Rate</button>
            </div>

            <div style={{ height: 40 }} />
        </div>
    );
}
