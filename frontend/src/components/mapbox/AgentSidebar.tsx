import { useState } from 'react';
import { Send } from 'lucide-react';

export function AgentSidebar() {
    const [messages, setMessages] = useState<{ role: 'user' | 'agent', text: string }[]>([
        { role: 'agent', text: 'Hello! I am Nostradamus AI. I can analyze the simulation, run queries, or execute scenarios. How can I assist you today?' }
    ]);
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages(prev => [...prev, { role: 'user', text: input }]);

        // Simulate thinking and response
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'agent', text: 'I received your command. Interpreting semantics and mapping to API calls...' }]);
        }, 1000);

        setInput('');
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: '#38bdf8', color: '#0f172a', padding: 2, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: 28, height: 28 }}>
                    <img src="/nostradamus.webp" alt="Nostradamus AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                </div>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>Nostradamus AI</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Agentic Simulation Assistant</div>
                </div>
            </div>

            {/* Chat History */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                            maxWidth: '85%',
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: msg.role === 'user' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${msg.role === 'user' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                            color: '#e2e8f0',
                            fontSize: 14,
                            lineHeight: 1.5
                        }}>
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,20,30,0.5)' }}>
                <div style={{ position: 'relative' }}>
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about employment, run scenarios..."
                        style={{
                            width: '100%',
                            padding: '12px 40px 12px 16px',
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 8,
                            color: 'white',
                            fontSize: 14,
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        style={{
                            position: 'absolute',
                            right: 8,
                            top: 8,
                            background: 'transparent',
                            border: 'none',
                            color: input.trim() ? '#38bdf8' : '#64748b',
                            cursor: input.trim() ? 'pointer' : 'default'
                        }}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
