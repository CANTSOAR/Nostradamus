import { useState, useEffect, useCallback, useRef } from 'react';
import { SimulationPayload, PinnedObject, CommandResponse } from '../types';
import { ws } from '../ws';

export function useSimulation() {
    const [payload, setPayload] = useState<SimulationPayload | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [connected, setConnected] = useState(false);
    const [speed, setSpeed] = useState('max');
    const [pinnedObjects, setPinnedObjects] = useState<PinnedObject[]>([]);
    const payloadRef = useRef<SimulationPayload | null>(null);

    useEffect(() => {
        ws.connect();
        const unsub = ws.onPayload((p) => {
            payloadRef.current = p;
            setPayload(p);
            setConnected(true);
        });
        const interval = setInterval(() => {
            setConnected(ws.connected);
        }, 1000);
        return () => { unsub(); clearInterval(interval); ws.disconnect(); };
    }, []);

    const togglePause = useCallback(() => {
        if (isPaused) {
            ws.resume();
            setIsPaused(false);
        } else {
            ws.pause();
            setIsPaused(true);
        }
    }, [isPaused]);

    const changeSpeed = useCallback(async (s: string) => {
        await ws.sendCommand('set_speed', { speed: s });
        setSpeed(s);
    }, []);

    const sendCommand = useCallback(async (action: string, params: Record<string, any> = {}): Promise<CommandResponse> => {
        return ws.sendCommand(action, params);
    }, []);

    const pinObject = useCallback((obj: PinnedObject) => {
        setPinnedObjects(prev => {
            if (prev.find(p => p.type === obj.type && p.id === obj.id)) return prev;
            return [...prev, obj];
        });
    }, []);

    const unpinObject = useCallback((type: string, id: number) => {
        setPinnedObjects(prev => prev.filter(p => !(p.type === type && p.id === id)));
    }, []);

    return {
        payload, isPaused, connected, speed, pinnedObjects,
        togglePause, changeSpeed, sendCommand, pinObject, unpinObject,
        setViewport: ws.setViewport.bind(ws),
        setCounty: ws.setCounty.bind(ws),
    };
}
