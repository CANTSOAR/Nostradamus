import React from 'react';
import { tickToDate } from '../types';

interface Props {
    tick: number;
    isPaused: boolean;
    connected: boolean;
    speed: string;
    onTogglePause: () => void;
    onChangeSpeed: (s: string) => void;
}

const SPEEDS = ['1x', '5x', '10x', '25x', '50x', 'max'];

export default function ControlsBar({ tick, isPaused, connected, speed, onTogglePause, onChangeSpeed }: Props) {
    return (
        <div className="controls-bar">
            <div className="controls-left">
                <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
                <button className="ctrl-btn" onClick={onTogglePause}>
                    {isPaused ? 'Play' : 'Pause'}
                </button>
                <div className="speed-group">
                    {SPEEDS.map(s => (
                        <button key={s} className={`speed-btn ${speed === s ? 'active' : ''}`} onClick={() => onChangeSpeed(s)}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>
            <div className="controls-right">
                <span className="tick-display">Tick {tick.toLocaleString()}</span>
                <span className="date-display">{tickToDate(tick)}</span>
            </div>
        </div>
    );
}
