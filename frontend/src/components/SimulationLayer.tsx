import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useMapStore } from '../store/useMapStore';

export function SimulationLayer() {
    const viewer = useMapStore((s) => s.viewer);
    const simulationData = useMapStore((s) => s.simulationData);
    const showTraffic = useMapStore((s) => s.showTraffic);

    const primitivesRef = useRef<Cesium.PointPrimitiveCollection | null>(null);

    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        const primitives = new Cesium.PointPrimitiveCollection();
        viewer.scene.primitives.add(primitives);
        primitivesRef.current = primitives;

        return () => {
            if (viewer && !viewer.isDestroyed()) {
                viewer.scene.primitives.remove(primitives);
            }
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
        if (simulationData.viewport_agents) {
            simulationData.viewport_agents.forEach((agent: any) => {
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

        // Render locations
        if (simulationData.viewport_locations) {
            simulationData.viewport_locations.forEach((loc: any) => {
                if (!loc.coord) return;
                let color = Cesium.Color.WHITE;
                if (loc.location_type === "Residential") color = Cesium.Color.SLATEGRAY;
                else if (loc.location_type === "Employer") color = Cesium.Color.ORANGE;
                else if (loc.location_type === "Store") color = Cesium.Color.YELLOW;
                else if (loc.location_type === "School") color = Cesium.Color.AQUAMARINE;
                else if (loc.location_type === "Public") color = Cesium.Color.LIGHTGREEN;

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
