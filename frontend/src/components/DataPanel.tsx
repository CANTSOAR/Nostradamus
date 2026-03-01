import React, { useState, useEffect } from 'react';
import { SimulationPayload, CommandResponse, countyName, COUNTIES } from '../types';
import ObjectCard from './ObjectCard';

interface Props {
    payload: SimulationPayload | null;
    sendCommand: (action: string, params: Record<string, any>) => Promise<CommandResponse>;
    onPinAgent: (id: number) => void;
    onPinLocation: (id: number) => void;
}

type Tab = 'browse' | 'bulk' | 'search';

export default function DataPanel({ payload, sendCommand, onPinAgent, onPinLocation }: Props) {
    const [tab, setTab] = useState<Tab>('browse');
    const [selectedObj, setSelectedObj] = useState<any>(null);
    const [selectedType, setSelectedType] = useState<'agent' | 'location' | 'org' | 'state'>('state');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchType, setSearchType] = useState<'agents' | 'orgs' | 'locations'>('agents');
    const [bulkResult, setBulkResult] = useState<string>('');

    // State data on mount
    useEffect(() => {
        if (tab === 'browse' && selectedType === 'state') {
            sendCommand('get_state', {}).then(r => { if (r.ok) setSelectedObj(r.result); });
        }
    }, [tab, selectedType]);

    const doSearch = async () => {
        let r: CommandResponse;
        switch (searchType) {
            case 'agents':
                r = await sendCommand('search_agents', { county: searchQuery || undefined, limit: 50 });
                break;
            case 'orgs':
                r = await sendCommand('search_orgs', { name_contains: searchQuery, limit: 50 });
                break;
            case 'locations':
                r = await sendCommand('search_locations', { name_contains: searchQuery, limit: 50 });
                break;
        }
        if (r!.ok) setSearchResults(r!.result?.results || []);
    };

    const loadObject = async (type: string, id: number) => {
        let r: CommandResponse;
        switch (type) {
            case 'agent': r = await sendCommand('get_agent', { id }); break;
            case 'location': r = await sendCommand('get_location', { id }); break;
            case 'org': r = await sendCommand('get_org', { org_id: id }); break;
            default: return;
        }
        if (r!.ok) {
            setSelectedObj(r!.result);
            setSelectedType(type as any);
            setTab('browse');
        }
    };

    const handleBulkAction = async (action: string, params: Record<string, any>) => {
        const r = await sendCommand(action, params);
        setBulkResult(JSON.stringify(r, null, 2));
    };

    return (
        <div className="data-panel">
            <div className="data-tabs">
                <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>Browse</button>
                <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>Search</button>
                <button className={tab === 'bulk' ? 'active' : ''} onClick={() => setTab('bulk')}>Bulk Actions</button>
            </div>

            {tab === 'browse' && (
                <div className="data-browse">
                    <div className="browse-nav">
                        <button className={selectedType === 'state' ? 'active' : ''} onClick={() => { setSelectedType('state'); sendCommand('get_state', {}).then(r => { if (r.ok) setSelectedObj(r.result); }); }}>State</button>
                        {payload?.county_stats.map(c => (
                            <button key={c.county_id} className="county-btn" onClick={() => loadObject('county', c.county_id)}>
                                {c.name} ({(c.population / 1000).toFixed(0)}K)
                            </button>
                        ))}
                    </div>
                    {selectedObj && (
                        <ObjectCard
                            data={selectedObj}
                            type={selectedType}
                            onEdit={async (field, value) => {
                                let action = '';
                                const params: any = { value };
                                if (selectedType === 'agent') { action = 'set_agent_field'; params.id = selectedObj.id; params.field = field; }
                                else if (selectedType === 'org') { action = 'set_org_revenue'; params.org_id = selectedObj.id; }
                                else if (selectedType === 'location') { action = 'set_location_field'; params.id = selectedObj.id; params.field = field; }
                                else if (selectedType === 'state') {
                                    if (field === 'state_tax_rate') action = 'set_tax_rate';
                                    else if (field === 'fed_funds_rate') action = 'set_fed_rate';
                                    else { action = 'set_global_param'; params.param = field; }
                                }
                                if (action) {
                                    const r = await sendCommand(action, params);
                                    if (r.ok) setSelectedObj({ ...selectedObj, [field]: value });
                                }
                            }}
                            onNavigate={loadObject}
                            onPin={(type, id) => type === 'agent' ? onPinAgent(id) : onPinLocation(id)}
                        />
                    )}
                </div>
            )}

            {tab === 'search' && (
                <div className="data-search">
                    <div className="search-bar">
                        <select value={searchType} onChange={e => setSearchType(e.target.value as any)}>
                            <option value="agents">Agents</option>
                            <option value="orgs">Organizations</option>
                            <option value="locations">Locations</option>
                        </select>
                        <input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSearch(); }} />
                        <button onClick={doSearch}>Search</button>
                    </div>
                    <div className="search-results">
                        {searchResults.map((r, i) => (
                            <div key={i} className="search-result-item" onClick={() => loadObject(searchType === 'agents' ? 'agent' : searchType === 'orgs' ? 'org' : 'location', r.id)}>
                                <span className="result-id">#{r.id}</span>
                                <span className="result-name">{r.name || `${searchType.slice(0, -1)} #${r.id}`}</span>
                                {r.wealth !== undefined && <span className="result-stat">${Math.round(r.wealth).toLocaleString()}</span>}
                                {r.value !== undefined && <span className="result-stat">${Math.round(r.value).toLocaleString()}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'bulk' && (
                <BulkActionsPanel onAction={handleBulkAction} result={bulkResult} />
            )}
        </div>
    );
}

function BulkActionsPanel({ onAction, result }: { onAction: (action: string, params: any) => void; result: string }) {
    const [action, setAction] = useState('depreciate_homes');
    const [county, setCounty] = useState('');
    const [pct, setPct] = useState('0.10');
    const [amount, setAmount] = useState('1200');
    const [severity, setSeverity] = useState('0.5');
    const [nameFilter, setNameFilter] = useState('');

    const execute = () => {
        const params: any = {};
        if (county) params.county = county;
        switch (action) {
            case 'depreciate_homes':
            case 'appreciate_homes':
                params.pct = parseFloat(pct); break;
            case 'stimulus_check':
                params.amount = parseFloat(amount); break;
            case 'mass_layoff':
                params.pct = parseFloat(pct); break;
            case 'pandemic':
                params.severity = parseFloat(severity); break;
            case 'close_businesses':
                params.name_contains = nameFilter; break;
            case 'set_tax_rate':
            case 'set_fed_rate':
                params.value = parseFloat(pct); break;
            case 'spawn_weather':
                params.type = nameFilter || 'Hurricane';
                params.severity = parseFloat(severity); break;
        }
        onAction(action, params);
    };

    return (
        <div className="bulk-panel">
            <select className="bulk-select" value={action} onChange={e => setAction(e.target.value)}>
                <optgroup label="Housing">
                    <option value="depreciate_homes">Depreciate Homes</option>
                    <option value="appreciate_homes">Appreciate Homes</option>
                </optgroup>
                <optgroup label="Economy">
                    <option value="stimulus_check">Stimulus Check</option>
                    <option value="mass_layoff">Mass Layoff</option>
                    <option value="close_businesses">Close Businesses</option>
                </optgroup>
                <optgroup label="Policy">
                    <option value="set_tax_rate">Set Tax Rate</option>
                    <option value="set_fed_rate">Set Fed Rate</option>
                </optgroup>
                <optgroup label="Events">
                    <option value="pandemic">Pandemic</option>
                    <option value="spawn_weather">Spawn Weather</option>
                </optgroup>
            </select>

            <select className="bulk-county" value={county} onChange={e => setCounty(e.target.value)}>
                <option value="">All Counties</option>
                {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {['depreciate_homes', 'appreciate_homes', 'mass_layoff', 'set_tax_rate', 'set_fed_rate'].includes(action) && (
                <input type="number" step="0.01" value={pct} onChange={e => setPct(e.target.value)} placeholder="Percentage (0.10 = 10%)" />
            )}
            {action === 'stimulus_check' && (
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount ($)" />
            )}
            {['pandemic', 'spawn_weather'].includes(action) && (
                <input type="number" step="0.1" min="0" max="1" value={severity} onChange={e => setSeverity(e.target.value)} placeholder="Severity (0-1)" />
            )}
            {['close_businesses', 'spawn_weather'].includes(action) && (
                <input value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder={action === 'spawn_weather' ? 'Weather type (Hurricane, Snow...)' : 'Name contains...'} />
            )}

            <button className="bulk-execute" onClick={execute}>Execute</button>

            {result && <pre className="bulk-result">{result}</pre>}
        </div>
    );
}
