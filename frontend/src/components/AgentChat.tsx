import React, { useState, useRef, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';

interface Message {
    role: 'user' | 'agent';
    content: string;
    code?: string;
    error?: string;
}

export function AgentChat() {
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
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const res = await fetch('http://localhost:8000/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMsg })
            });

            if (!res.ok) {
                throw new Error(`Server responded with ${res.status}`);
            }

            const data = await res.json();

            setMessages(prev => [...prev, {
                role: 'agent',
                content: data.answer_text,
                code: data.code_executed,
                error: data.error
            }]);

            if (data.matched_geoids && data.matched_geoids.length > 0) {
                setAgentMatchedGeoids(data.matched_geoids);
            } else {
                setAgentMatchedGeoids(null);
            }

        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'agent', content: 'Connection Error: Failed to reach agent backend.', error: error.message }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'absolute', bottom: 24, right: 280,
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    color: '#c4b5fd', borderRadius: 24, padding: '10px 20px',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)',
                    display: 'flex', alignItems: 'center', gap: 8
                }}
            >
                <span>✨</span> Nostradamus Agent
            </button>
        );
    }

    return (
        <div style={{
            position: 'absolute', bottom: 24, right: 280,
            width: 350, height: 450,
            background: 'rgba(15, 20, 30, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.3)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
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

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#475569', fontSize: 13, marginTop: 40 }}>
                        Ask me to filter the map or calculate metrics using Python pandas.
                        <br /><br />
                        <i>"Highlight municipalities with median income over 150k"</i>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        background: m.role === 'user' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${m.role === 'user' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, lineHeight: 1.5
                    }}>
                        {m.content}
                        {m.code && (
                            <div style={{ marginTop: 8, padding: 8, background: '#000', borderRadius: 4, fontSize: 11, color: '#a78bfa', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                {m.code}
                            </div>
                        )}
                        {m.error && (
                            <div style={{ marginTop: 8, padding: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, fontSize: 11, color: '#fca5a5', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                {m.error}
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', color: '#8b5cf6', fontSize: 12 }}>
                        <i>Agent is writing code...</i>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask Nostradamus..."
                    disabled={isLoading}
                    style={{
                        width: '100%', padding: '10px 14px', borderRadius: 6,
                        border: '1px solid rgba(139, 92, 246, 0.4)', background: 'rgba(15,23,42,0.8)',
                        color: 'white', fontSize: 13, outline: 'none'
                    }}
                />
            </form>
        </div>
    );
}
