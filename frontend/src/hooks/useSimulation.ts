import { useEffect } from "react";
import { useMapStore } from "../store/useMapStore";

export function useSimulation() {
    const { viewLevel, simulationRunning, tick, agentCount, updateSimulation, stopSimulation } = useMapStore();

    useEffect(() => {
        // If we leave building level, stop the simulation
        if (viewLevel !== "building" && simulationRunning) {
            stopSimulation();
        }
    }, [viewLevel, simulationRunning, stopSimulation]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        if (viewLevel === "building" && simulationRunning) {
            interval = setInterval(() => {
                const nextTick = tick + 1;
                // Randomly fluctuate agent count by -2 to +2, keeping it above 5
                const fluctuation = Math.floor(Math.random() * 5) - 2;
                const nextAgents = Math.max(5, agentCount + fluctuation);

                updateSimulation(nextAgents, nextTick);
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [viewLevel, simulationRunning, tick, agentCount, updateSimulation]);
}
