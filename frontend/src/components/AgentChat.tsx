import React, { useState, useRef, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { wsClient } from '../ws';

interface Message {
    role: 'user' | 'agent';
    content: string;
    code?: string;
    error?: string;
}

interface AgentChatProps {
    sidebar?: boolean;
}

export function AgentChat({ sidebar = false }: AgentChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const setAgentMatchedGeoids = useMapStore(s => s.setAgentMatchedGeoids);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        // ... (same as before)
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const data = await wsClient.sendCommand('query_agent', { query: userMsg });
            if (!data.ok) throw new Error(data.error || 'Unknown agent error');
            const agentData = data.result;

            setMessages(prev => [...prev, {
                role: 'agent',
                content: agentData.answer_text,
                code: agentData.code_executed,
                error: agentData.error
            }]);

            if (agentData.matched_geoids && agentData.matched_geoids.length > 0) {
                setAgentMatchedGeoids(agentData.matched_geoids);
            } else {
                setAgentMatchedGeoids(null);
            }
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'agent', content: 'Agent Error: ' + (error.message || 'Unknown error'), error: error.message }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!sidebar && !isOpen) {
        return null;
    }

    const containerStyle: React.CSSProperties = sidebar ? {
        display: 'flex', flexDirection: 'column', height: 400, width: '100%',
        background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none'
    } : {
        position: 'absolute', bottom: 24, right: 280,
        width: 350, height: 450,
        background: 'rgba(15, 20, 30, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
    };

    return (
        <div style={containerStyle}>
            {!sidebar && (
                <div style={{
                    background: 'linear-gradient(90deg, rgba(30,27,75,0.8) 0%, rgba(15,23,42,0.8) 100%)',
                    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>✨ NOSTRADAMUS AGENT</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={() => { setMessages([]); setAgentMatchedGeoids(null); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>clear</button>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 20 }}>
                        I can analyze NJ simulation data and suggest policy changes.
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '90%',
                        background: m.role === 'user' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${m.role === 'user' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                        borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', fontSize: 12, lineHeight: 1.4
                    }}>
                        {m.content}
                    </div>
                ))}
                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', color: '#8b5cf6', fontSize: 11 }}>
                        <i>Analyzing...</i>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask agent..."
                    disabled={isLoading}
                    style={{
                        width: '100%', padding: '8px 12px', borderRadius: 4,
                        border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(15,23,42,0.6)',
                        color: 'white', fontSize: 12, outline: 'none'
                    }}
                />
            </form>
        </div>
    );
}
