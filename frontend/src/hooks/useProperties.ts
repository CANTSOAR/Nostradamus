import { useEffect, useRef } from "react";
import {
    PointPrimitiveCollection,
    Cartesian3,
    Color,
    NearFarScalar,
    type Viewer,
} from "cesium";

export interface SystemProperty {
    address: string;
    city: string;
    county: string;
    net_value: number;
    tax_rate: number;
    tax_amount: number;
    lat: number;
    lon: number;
}

// LOD Thresholds
const MIN_VISIBILITY_ALT = 8000; // Only show properties when below this altitude

export function useProperties({
    viewer,
    show,
}: {
    viewer: Viewer | null;
    show: boolean;
}) {
    const pointsRef = useRef<PointPrimitiveCollection | null>(null);
    const propertiesRef = useRef<SystemProperty[]>([]);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (!viewer || loadedRef.current) return;
        loadedRef.current = true;

        // Fetch and decompress the gzipped CSV
        const loadData = async () => {
            try {
                const response = await fetch("/data/nj_properties.csv.gz");
                if (!response.ok) throw new Error("Failed to fetch property data");

                // Decompress the stream
                const ds = new DecompressionStream("gzip");
                const decompressedStream = response.body?.pipeThrough(ds);
                if (!decompressedStream) throw new Error("Failed to decompress stream");

                const reader = decompressedStream.getReader();
                const decoder = new TextDecoder();
                let csvData = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    csvData += decoder.decode(value, { stream: true });
                }
                csvData += decoder.decode();

                const lines = csvData.trim().split("\n");
                const headers = lines[0].split(",");

                const properties: SystemProperty[] = [];
                const points = new PointPrimitiveCollection();
                points.show = show;

                // Configure LOD using translucency by distance
                // We make them transparent at high altitudes to save rendering cost
                points.blendOption = 0; // Opaque

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(",");
                    if (cols.length < 8) continue;

                    const prop: SystemProperty = {
                        county: cols[headers.indexOf("county")],
                        city: cols[headers.indexOf("city")],
                        address: cols[headers.indexOf("address")],
                        net_value: parseFloat(cols[headers.indexOf("net_value")]),
                        tax_rate: parseFloat(cols[headers.indexOf("tax_rate")]),
                        tax_amount: parseFloat(cols[headers.indexOf("tax_amount")]),
                        latitude: parseFloat(cols[headers.indexOf("latitude")]),
                        longitude: parseFloat(cols[headers.indexOf("longitude")]),
                    } as any;

                    // Re-map keys correctly from my specific CSV structure
                    const lat = parseFloat(cols[6]);
                    const lon = parseFloat(cols[7]);

                    if (isNaN(lat) || isNaN(lon)) continue;

                    const p: SystemProperty = {
                        county: cols[0],
                        city: cols[1],
                        address: cols[2],
                        net_value: parseFloat(cols[3]),
                        tax_rate: parseFloat(cols[4]),
                        tax_amount: parseFloat(cols[5]),
                        lat,
                        lon
                    };

                    properties.push(p);

                    // Build point
                    points.add({
                        position: Cartesian3.fromDegrees(lon, lat, 2.0),
                        pixelSize: 6,
                        color: Color.fromCssColorString("#94d2bd").withAlpha(0.8),
                        outlineColor: Color.BLACK.withAlpha(0.5),
                        outlineWidth: 1,
                        // LOD: Fade out as we go higher
                        translucencyByDistance: new NearFarScalar(1000, 1.0, MIN_VISIBILITY_ALT, 0.0),
                        id: { type: "property", index: i - 1 },
                    } as any);
                }

                if (viewer.isDestroyed()) return;
                viewer.scene.primitives.add(points);
                pointsRef.current = points;
                propertiesRef.current = properties;
            } catch (err) {
                console.error("Property loading error:", err);
            }
        };

        loadData();

        return () => {
            if (viewer && !viewer.isDestroyed() && pointsRef.current) {
                viewer.scene.primitives.remove(pointsRef.current);
            }
            pointsRef.current = null;
            loadedRef.current = false;
            propertiesRef.current = [];
        };
    }, [viewer]); // Run once on init

    useEffect(() => {
        if (pointsRef.current) {
            pointsRef.current.show = show;
        }
    }, [show]);

    return {
        getProperty: (index: number) => propertiesRef.current[index] || null,
    };
}
