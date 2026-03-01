
import { useMapStore } from '../../store/useMapStore';
import { wsClient } from '../../ws';
import { Play, Pause, FastForward } from 'lucide-react';

export function ControlsBar() {
    const { simulationData, simulationStatus, activeTab, setActiveTab } = useMapStore();



    const resume = () => wsClient.sendTextCommand("resume");
    const pause = () => wsClient.sendTextCommand("pause");

    // Calculate Date from tick. Jan 1, 2010 + tick hours
    const start = new Date(2010, 0, 1);
    const tick = simulationData?.tick || 0;
    const currentDate = new Date(start.getTime() + tick * 60 * 60 * 1000);

    const dateStr = currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = currentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
        <div style={{ padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={resume}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 6, color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }}>
                        <Play size={16} /> Play
                    </button>
                    <button
                        onClick={pause}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer', fontWeight: 600 }}>
                        <Pause size={16} /> Pause
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                    <FastForward size={16} color="#94a3b8" />
                    <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Speed:</span>
                    {['1x', '5x', '10x', '50x'].map(s => (
                        <button key={s} style={{ background: s === '1x' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: s === '1x' ? '#fff' : '#64748b', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                {/* View Tabs */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                        onClick={() => setActiveTab('map')}
                        style={{
                            padding: '6px 16px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            background: activeTab === 'map' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                            color: activeTab === 'map' ? '#38bdf8' : '#64748b',
                            transition: 'all 0.2s'
                        }}
                    >
                        MAP
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        style={{
                            padding: '6px 16px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            background: activeTab === 'data' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                            color: activeTab === 'data' ? '#38bdf8' : '#64748b',
                            transition: 'all 0.2s'
                        }}
                    >
                        DATA
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: simulationStatus === 'connected' ? '#34d399' : '#f87171' }}>
                        {simulationStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Timeline</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>{dateStr} {timeStr}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Tick</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
                        {tick.toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
}
