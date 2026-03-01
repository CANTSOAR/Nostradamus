import { useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { wsClient } from '../ws';

export function useSimulation() {
    const setSimulationData = useMapStore((s) => s.setSimulationData);
    const setSimulationStatus = useMapStore((s) => s.setSimulationStatus);

    useEffect(() => {
        wsClient.init(setSimulationData, setSimulationStatus);

        return () => {
            if (wsClient.ws) {
                wsClient.ws.close();
            }
        };
    }, [setSimulationData, setSimulationStatus]);
}
