import { useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { Search, Map as MapIcon, Users, Building2, Landmark, ChevronRight, ChevronDown } from 'lucide-react';

export function DataPanel() {
    const simulationData = useMapStore(s => s.simulationData);
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
        'state': true,
        'counties': false,
        'search': true
    });

    const toggleNode = (node: string) => {
        setExpandedNodes(prev => ({ ...prev, [node]: !prev[node] }));
    };

    const TreeNode = ({ id, label, icon: Icon, children, isLeaf = false, details = null }: any) => {
        const isExpanded = expandedNodes[id];
        return (
            <div style={{ marginBottom: 4 }}>
                <div
                    onClick={() => !isLeaf && toggleNode(id)}
                    style={{
                        display: 'flex', alignItems: 'center', padding: '6px 8px',
                        background: isLeaf ? 'rgba(255,255,255,0.03)' : 'transparent',
                        borderRadius: 4, cursor: isLeaf ? 'default' : 'pointer',
                        transition: 'background 0.2s'
                    }}
                >
                    <span style={{ width: 20, display: 'flex', justifyContent: 'center', color: '#64748b' }}>
                        {!isLeaf && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                    </span>
                    <span style={{ color: '#94a3b8', marginRight: 8 }}><Icon size={14} /></span>
                    <span style={{ fontSize: 13, fontWeight: isLeaf ? 400 : 500, color: '#e2e8f0', flex: 1 }}>{label}</span>
                    {details && <span style={{ fontSize: 11, color: '#64748b' }}>{details}</span>}
                </div>
                {!isLeaf && isExpanded && (
                    <div style={{ paddingLeft: 24, marginTop: 4 }}>
                        {children}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ padding: '24px 20px', height: '100%', overflowY: 'auto' }}>
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Search size={18} color="#38bdf8" /> Object Browser
                </h2>
            </div>

            <div style={{ background: 'rgba(15,20,30,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}>

                {/* State Node */}
                <TreeNode id="state" label="State: New Jersey" icon={Landmark}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '4px 0 12px 12px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Tax Rate</div>
                            <div style={{ fontSize: 14, color: '#38bdf8', fontWeight: 600 }}>
                                {simulationData?.global_metrics ? (simulationData.global_metrics.base_tax_rate * 100).toFixed(1) + '%' : '---'}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Inflation Rate</div>
                            <div style={{ fontSize: 14, color: '#f472b6', fontWeight: 600 }}>
                                {simulationData?.global_metrics ? (simulationData.global_metrics.inflation_rate * 100).toFixed(1) + '%' : '---'}
                            </div>
                        </div>
                    </div>
                </TreeNode>

                {/* Counties Node */}
                <TreeNode id="counties" label={`Counties (${simulationData?.county_stats?.length || 21})`} icon={MapIcon}>
                    {simulationData?.county_stats?.slice(0, 5).map((c: any) => (
                        <TreeNode
                            key={c.county_id}
                            id={`county-${c.county_id}`}
                            label={c.name}
                            icon={MapIcon}
                            isLeaf
                            details={`Pop: ${(c.population / 1000).toFixed(0)}K`}
                        />
                    ))}
                    {simulationData?.county_stats && simulationData.county_stats.length > 5 && (
                        <div style={{ fontSize: 12, color: '#64748b', padding: '4px 8px' }}>+ {simulationData.county_stats.length - 5} more...</div>
                    )}
                </TreeNode>

                {/* Search Node */}
                <TreeNode id="search" label="Search Database" icon={Search}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button style={{ textAlign: 'left', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 4, color: '#38bdf8', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Users size={14} /> Search Agents
                        </button>
                        <button style={{ textAlign: 'left', padding: '8px 12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 4, color: '#4ade80', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Building2 size={14} /> Search Organizations
                        </button>
                    </div>
                </TreeNode>

            </div>

            <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 700 }}>Economy Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div style={{ background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Total Economy Value</div>
                        <div style={{ fontSize: 18, color: '#38bdf8', fontWeight: 700 }}>
                            ${simulationData?.state_entity?.total_economy_value ? (simulationData.state_entity.total_economy_value / 1e9).toFixed(2) + 'B' : '---'}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(34, 197, 94, 0.03)', border: '1px solid rgba(34, 197, 94, 0.1)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Cash Reserves</div>
                        <div style={{ fontSize: 18, color: '#4ade80', fontWeight: 700 }}>
                            ${simulationData?.state_entity?.cash_reserves ? (simulationData.state_entity.cash_reserves / 1e6).toFixed(1) + 'M' : '---'}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(168, 85, 247, 0.03)', border: '1px solid rgba(168, 85, 247, 0.1)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Population</div>
                        <div style={{ fontSize: 18, color: '#c084fc', fontWeight: 700 }}>
                            {simulationData?.state_entity?.population ? (simulationData.state_entity.population / 1e6).toFixed(2) + 'M' : '---'}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(251, 191, 36, 0.03)', border: '1px solid rgba(251, 191, 36, 0.1)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Avg Wealth</div>
                        <div style={{ fontSize: 18, color: '#fbbf24', fontWeight: 700 }}>
                            ${simulationData?.state_entity?.avg_wealth ? Math.round(simulationData.state_entity.avg_wealth).toLocaleString() : '---'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Placeholder Bulk Actions */}
            <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, fontWeight: 700 }}>Bulk Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 150px)', gap: 12 }}>
                    <button style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>Stimulus Check</button>
                    <button style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>Mass Layoff</button>
                    <button style={{ padding: '10px', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.15)', borderRadius: 6, color: '#c084fc', fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>Pandemic</button>
                    <button style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>Change Tax Rate</button>
                </div>
            </div>
        </div>
    );
}
