import React, { useState, useRef, useEffect } from 'react';
import { CommandResponse, CountyStats } from '../types';
import { chatWithGroq, extractCommands, cleanResponse, hasGroqApiKey, setGroqApiKey, getGroqApiKey } from '../groq';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Props {
    sendCommand: (action: string, params: Record<string, any>) => Promise<CommandResponse>;
    countyStats: CountyStats[];
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    chart?: ChartData;
}

interface ChartData {
    type: 'bar' | 'line';
    labels: string[];
    values: number[];
    title: string;
}

export default function AgentSidebar({ sendCommand, countyStats }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'system', content: 'Nostradamus AI — Ask me about the simulation, request charts, or describe changes to make.' },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [apiKey, setApiKeyState] = useState(getGroqApiKey() || '');
    const scrollRef = useRef<HTMLDivElement>(null);
    const chatHistory = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

    useEffect(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        chatHistory.current.push({ role: 'user', content: userMsg });
        setLoading(true);

        try {
            let response: ChatMessage;

            if (hasGroqApiKey()) {
                // LLM mode — talk to Groq
                const llmResponse = await chatWithGroq(chatHistory.current);

                // Execute any embedded commands
                const cmds = extractCommands(llmResponse);
                let cmdResults = '';
                for (const cmd of cmds) {
                    try {
                        const result = await sendCommand(cmd.action, cmd.params);
                        cmdResults += `\n[${cmd.action}]: ${JSON.stringify(result.result).slice(0, 200)}`;
                    } catch (e) {
                        cmdResults += `\n[${cmd.action}]: Error - ${e}`;
                    }
                }

                let displayText = cleanResponse(llmResponse);
                if (cmdResults) {
                    displayText += `\n\nCommand results:${cmdResults}`;
                }

                response = { role: 'assistant', content: displayText };
                chatHistory.current.push({ role: 'assistant', content: llmResponse });
            } else {
                // Rule-based fallback
                response = await processUserMessage(userMsg, sendCommand, countyStats);
                chatHistory.current.push({ role: 'assistant', content: response.content });
            }

            setMessages(prev => [...prev, response]);
        } catch (e) {
            const errMsg = `Error: ${e}`;
            setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
        }
        setLoading(false);
    };

    const handleSaveKey = () => {
        setGroqApiKey(apiKey);
        setShowKeyInput(false);
        setMessages(prev => [...prev, { role: 'system', content: 'Groq API key saved! I\'m now powered by Llama 3.3 70B.' }]);
    };

    return (
        <div className="agent-sidebar">
            <div className="agent-header">
                <span className="agent-icon">AI</span>
                <span className="agent-title">Nostradamus AI</span>
                <button
                    className="settings-btn"
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    title="Configure Groq API key"
                >Settings</button>
            </div>

            {showKeyInput && (
                <div className="key-input-panel">
                    <input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKeyState(e.target.value)}
                        placeholder="Groq API key (gsk_...)"
                    />
                    <button onClick={handleSaveKey}>Save</button>
                    <span className="key-status">{hasGroqApiKey() ? 'Key set' : 'No key'}</span>
                </div>
            )}

            <div className="agent-messages" ref={scrollRef}>
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-msg ${msg.role}`}>
                        <div className="msg-content">{msg.content}</div>
                        {msg.chart && (
                            <div className="inline-chart" style={{ height: 220, paddingBottom: 25 }}>
                                <div className="chart-title">{msg.chart.title}</div>
                                <ResponsiveContainer width="100%" height="100%">
                                    {msg.chart.type === 'bar' ? (
                                        <BarChart
                                            data={msg.chart.labels.map((l, idx) => ({ name: l, value: msg.chart!.values[idx] }))}
                                            layout="vertical"
                                            margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
                                        >
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" tick={{ fill: '#56738a', fontSize: 10 }} width={75} axisLine={false} tickLine={false} />
                                            <RechartsTooltip
                                                cursor={{ fill: 'rgba(86, 115, 138, 0.05)' }}
                                                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(86, 115, 138, 0.2)', borderRadius: 8, fontSize: 12, color: '#1f3548', boxShadow: '0 8px 24px rgba(31,53,72,0.1)' }}
                                                itemStyle={{ color: '#1f3548', fontWeight: 600 }}
                                            />
                                            <Bar dataKey="value" fill="url(#colorBar)" radius={[0, 4, 4, 0]} barSize={12} />
                                            <defs>
                                                <linearGradient id="colorBar" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#c7b092" stopOpacity={0.8} />
                                                    <stop offset="100%" stopColor="#56738a" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                        </BarChart>
                                    ) : (
                                        <LineChart
                                            data={msg.chart.labels.map((l, idx) => ({ name: l, value: msg.chart!.values[idx] }))}
                                            margin={{ left: -20, right: 10, top: 5, bottom: 0 }}
                                        >
                                            <XAxis dataKey="name" tick={{ fill: '#56738a', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: '#56738a', fontSize: 10 }} width={50} axisLine={false} tickLine={false} />
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(86, 115, 138, 0.2)', borderRadius: 8, fontSize: 12, color: '#1f3548', boxShadow: '0 8px 24px rgba(31,53,72,0.1)' }}
                                                itemStyle={{ color: '#1f3548', fontWeight: 600 }}
                                            />
                                            <Line type="monotone" dataKey="value" stroke="#1f3548" strokeWidth={2} dot={{ r: 3, fill: '#ffffff', stroke: '#1f3548', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#1f3548' }} />
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                ))}
                {loading && <div className="chat-msg assistant"><div className="msg-content thinking">Thinking...</div></div>}
            </div>
            <div className="agent-input">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder={hasGroqApiKey() ? 'Ask Nostradamus AI...' : 'Ask anything...'} onKeyDown={e => { if (e.key === 'Enter') handleSend(); }} />
                <button onClick={handleSend} disabled={loading}>Send</button>
            </div>
        </div>
    );
}

// Rule-based fallback (used when no Groq API key)
async function processUserMessage(
    msg: string,
    sendCommand: (action: string, params: any) => Promise<CommandResponse>,
    countyStats: CountyStats[],
): Promise<ChatMessage> {
    const lower = msg.toLowerCase();

    if (lower.includes('state') || lower.includes('overview') || lower.includes('economy')) {
        const r = await sendCommand('get_state', {});
        if (r.ok) {
            const s = r.result;
            return {
                role: 'assistant',
                content: `New Jersey Overview\n• Population: ${s.population?.toLocaleString()}\n• Avg Wealth: $${Math.round(s.avg_wealth || 0).toLocaleString()}\n• Economy: $${Math.round(s.total_economy_value || 0).toLocaleString()}\n• Tax Rate: ${((s.state_tax_rate || 0) * 100).toFixed(1)}%\n• Cash Reserves: $${Math.round(s.cash_reserves || 0).toLocaleString()}`,
            };
        }
    }

    if (lower.includes('county') && (lower.includes('population') || lower.includes('chart') || lower.includes('compare'))) {
        const sorted = [...countyStats].sort((a, b) => b.population - a.population);
        return {
            role: 'assistant', content: 'Population by county:',
            chart: { type: 'bar', title: 'Population by County', labels: sorted.map(c => c.name), values: sorted.map(c => c.population) },
        };
    }

    if (lower.includes('wealth') && (lower.includes('chart') || lower.includes('compare') || lower.includes('county'))) {
        const sorted = [...countyStats].sort((a, b) => b.avg_wealth - a.avg_wealth);
        return {
            role: 'assistant', content: 'Average wealth by county:',
            chart: { type: 'bar', title: 'Avg Wealth by County', labels: sorted.map(c => c.name), values: sorted.map(c => Math.round(c.avg_wealth)) },
        };
    }

    if (lower.includes('weaken') && lower.includes('economy')) {
        await sendCommand('set_tax_rate', { value: 0.12 });
        await sendCommand('mass_layoff', { pct: 0.15 });
        await sendCommand('depreciate_homes', { pct: 0.20 });
        return { role: 'assistant', content: 'Recession scenario applied:\n• Tax rate → 12%\n• 15% mass layoff\n• 20% housing depreciation' };
    }

    if (lower.includes('stimulus') || lower.includes('give everyone money')) {
        const r = await sendCommand('stimulus_check', { amount: 1200 });
        if (r.ok) return { role: 'assistant', content: `Stimulus: $1200 → ${r.result.recipients?.toLocaleString()} residents` };
    }

    if (lower.includes('hurricane') || lower.includes('storm')) {
        await sendCommand('spawn_weather', { type: 'Hurricane', severity: 0.8 });
        return { role: 'assistant', content: 'Hurricane spawned (severity 0.8)' };
    }

    if (lower.includes('pandemic') || lower.includes('virus')) {
        const r = await sendCommand('pandemic', { severity: 0.6 });
        if (r.ok) return { role: 'assistant', content: `Pandemic (severity 0.6)\n• Health affected: ${r.result.health_affected?.toLocaleString()}\n• Stores closed: ${r.result.stores_closed?.toLocaleString()}` };
    }

    if (lower.includes('history') || lower.includes('trend') || lower.includes('over time')) {
        const metric = lower.includes('wealth') ? 'avg_wealth' : lower.includes('health') ? 'avg_health' : 'population';
        const r = await sendCommand('get_history', { metric, ticks: 100 });
        if (r.ok && r.result.data?.length > 0) {
            return {
                role: 'assistant', content: `${metric} over time:`,
                chart: { type: 'line', title: `${metric}`, labels: r.result.data.map((p: any) => `T${p.tick}`), values: r.result.data.map((p: any) => p.value) },
            };
        }
    }

    return {
        role: 'assistant',
        content: hasGroqApiKey()
            ? 'I didn\'t understand that. Try asking about the simulation state, economy, or requesting specific changes.'
            : `I can help with:\n• "Show state overview"\n• "Compare county populations"\n• "Weaken the economy"\n• "Send stimulus"\n• "Spawn hurricane"\n• "Show population trend"\n\nAdd a Groq API key for full LLM-powered conversations.`,
    };
}
