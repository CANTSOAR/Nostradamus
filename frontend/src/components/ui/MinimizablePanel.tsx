import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MinimizablePanelProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    defaultMinimized?: boolean;
}

export function MinimizablePanel({ title, icon, children, defaultMinimized = false }: MinimizablePanelProps) {
    const [isMinimized, setIsMinimized] = useState(defaultMinimized);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: isMinimized ? 0 : 12 }}>
            <div
                className="drag-handle"
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "grab",
                    userSelect: "none"
                }}
                onClick={() => {
                    // Only toggle minimize if they clicked, not dragged (Draggable handles this decently but to be safe)
                    setIsMinimized(!isMinimized)
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {icon}
                    <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", fontWeight: 600 }}>
                        {title.toUpperCase()}
                    </div>
                </div>
                <div style={{ color: "#64748b" }}>
                    {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </div>
            </div>

            {!isMinimized && (
                <div style={{ animation: "fadeIn 0.2s ease-in-out" }}>
                    {children}
                </div>
            )}
        </div>
    );
}
