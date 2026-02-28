import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useMapStore } from '../store/useMapStore';

export function SimulationLayer() {
    const viewer = useMapStore((s) => s.viewer);
    const simulationData = useMapStore((s) => s.simulationData);
    const showTraffic = useMapStore((s) => s.showTraffic);

    const primitivesRef = useRef<Cesium.PointPrimitiveCollection | null>(null);

    useEffect(() => {
        if (!viewer) return;

        const primitives = new Cesium.PointPrimitiveCollection();
        viewer.scene.primitives.add(primitives);
        primitivesRef.current = primitives;

        return () => {
            viewer.scene.primitives.remove(primitives);
        };
    }, [viewer]);

    useEffect(() => {
        const primitives = primitivesRef.current;
        if (!primitives || !simulationData || !showTraffic) {
            if (primitives) primitives.removeAll();
            return;
        }

        primitives.removeAll();

        // Render agents
        if (simulationData.active_agents_subset) {
            simulationData.active_agents_subset.forEach((agent: any) => {
                if (!agent.current_coord) return;
                primitives.add({
                    position: Cesium.Cartesian3.fromDegrees(
                        agent.current_coord.lon,
                        agent.current_coord.lat,
                        2.0 // Just above ground
                    ),
                    color: Cesium.Color.RED,
                    pixelSize: 4,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 1,
                });
            });
        }

        // Render locations (simplified for now)
        if (simulationData.locations_subset) {
            simulationData.locations_subset.forEach((loc: any) => {
                if (!loc.coord) return;
                let color = Cesium.Color.WHITE;
                if (loc.location_type === "Store") color = Cesium.Color.ORANGE;
                else if (loc.location_type === "Employer") color = Cesium.Color.AQUAMARINE;
                else if (loc.location_type === "Residential") color = Cesium.Color.SLATEGRAY;

                primitives.add({
                    position: Cesium.Cartesian3.fromDegrees(
                        loc.coord.lon,
                        loc.coord.lat,
                        0.0
                    ),
                    color: color,
                    pixelSize: 6,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1,
                });
            });
        }
    }, [simulationData, showTraffic]);

    return null;
}
