import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';

export function useSimulation() {
    const setSimulationData = useMapStore((s) => s.setSimulationData);
    const setSimulationStatus = useMapStore((s) => s.setSimulationStatus);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        function connect() {
            setSimulationStatus('connecting');
            const ws = new WebSocket('ws://127.0.0.1:8080');

            ws.onopen = () => {
                setSimulationStatus('connected');
                console.log('Simulation Engine Connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setSimulationData(data);
                } catch (e) {
                    console.error('Payload parse error', e);
                }
            };

            ws.onclose = () => {
                setSimulationStatus('disconnected');
                console.log('Simulation Engine Disconnected. Retrying in 2s...');
                setTimeout(connect, 2000);
            };

            ws.onerror = (err) => {
                console.error('WebSocket Error', err);
                ws.close();
            };

            wsRef.current = ws;
        }

        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [setSimulationData, setSimulationStatus]);
}
