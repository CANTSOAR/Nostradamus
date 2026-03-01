import React, { useState, useCallback } from 'react';
import { useSimulation } from './hooks/useSimulation';
import MapPanel from './components/MapPanel';
import DataPanel from './components/DataPanel';
import ControlsBar from './components/ControlsBar';
import AgentSidebar from './components/AgentSidebar';
import { PinnedObject } from './types';

type ActiveTab = 'map' | 'data';

const PIN_COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#6366f1'];

export default function App() {
    const {
        payload, isPaused, connected, speed, pinnedObjects,
        togglePause, changeSpeed, sendCommand, pinObject, unpinObject,
        setViewport, setCounty,
    } = useSimulation();

    const [activeTab, setActiveTab] = useState<ActiveTab>('map');
    const [heatmapMetric, setHeatmapMetric] = useState('population');
    const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

    const handleSelectCounty = useCallback((name: string) => {
        setCounty(name);
    }, [setCounty]);

    const handlePinAgent = useCallback((id: number) => {
        const color = PIN_COLORS[pinnedObjects.length % PIN_COLORS.length];
        pinObject({ type: 'agent', id, label: `Agent #${id}`, color });
    }, [pinObject, pinnedObjects]);

    const handlePinLocation = useCallback((id: number) => {
        const color = PIN_COLORS[pinnedObjects.length % PIN_COLORS.length];
        pinObject({ type: 'location', id, label: `Location #${id}`, color });
    }, [pinObject, pinnedObjects]);

    const switchToData = useCallback(() => {
        if (!isPaused) togglePause();
        setActiveTab('data');
    }, [isPaused, togglePause]);

    return (
        <div className="app-root">
            {/* Main Panel */}
            <div className="main-panel">
                {/* Tab Bar */}
                <div className="tab-bar">
                    <button className={`tab ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
                        Map
                    </button>
                    <button className={`tab ${activeTab === 'data' ? 'active' : ''}`} onClick={switchToData}>
                        Data
                    </button>
                    {activeTab === 'map' && (
                        <div className="heatmap-selector">
                            <select value={heatmapMetric} onChange={e => setHeatmapMetric(e.target.value)}>
                                <option value="population">Population</option>
                                <option value="avg_wealth">Avg Wealth</option>
                                <option value="total_value">Total Value</option>
                            </select>
                        </div>
                    )}
                    {/* Pinned objects */}
                    {pinnedObjects.length > 0 && (
                        <div className="pinned-list">
                            {pinnedObjects.map(p => (
                                <span key={`${p.type}-${p.id}`} className="pin-badge" style={{ borderColor: p.color }}>
                                    {p.label}
                                    <button onClick={() => unpinObject(p.type, p.id)}>×</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="main-content">
                    {activeTab === 'map' ? (
                        <MapPanel
                            payload={payload}
                            pinnedObjects={pinnedObjects}
                            onSelectCounty={handleSelectCounty}
                            onSelectAgent={(id) => { setSelectedAgentId(id); switchToData(); }}
                            onSelectLocation={(id) => { setSelectedLocationId(id); switchToData(); }}
                            setViewport={setViewport}
                            heatmapMetric={heatmapMetric}
                        />
                    ) : (
                        <DataPanel
                            payload={payload}
                            sendCommand={sendCommand}
                            onPinAgent={handlePinAgent}
                            onPinLocation={handlePinLocation}
                        />
                    )}
                </div>

                {/* Controls */}
                <ControlsBar
                    tick={payload?.tick || 0}
                    isPaused={isPaused}
                    connected={connected}
                    speed={speed}
                    onTogglePause={togglePause}
                    onChangeSpeed={changeSpeed}
                />
            </div>

            {/* Agent Sidebar */}
            <AgentSidebar
                sendCommand={sendCommand}
                countyStats={payload?.county_stats || []}
            />
        </div>
    );
}
