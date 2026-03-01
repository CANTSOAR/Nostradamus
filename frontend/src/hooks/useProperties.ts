import { useEffect, useRef } from "react";
import { wsClient } from "../ws";
import {
    PointPrimitiveCollection,
    LabelCollection,
    Cartesian3,
    Color,
    NearFarScalar,
    LabelStyle,
    VerticalOrigin,
    HorizontalOrigin,
    Math as CesiumMath,
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

const MAX_VISIBLE_PROPERTIES = 400;
const MIN_ALTITUDE_FOR_PROPERTIES = 10000;
const CELL_SIZE = 0.01; // ~1km grid size

export function useProperties({
    viewer,
    show,
}: {
    viewer: Viewer | null;
    show: boolean;
}) {
    const propertiesRef = useRef<SystemProperty[]>([]);
    const gridRef = useRef<Map<string, number[]>>(new Map());
    const pointsRef = useRef<PointPrimitiveCollection | null>(null);
    const labelsRef = useRef<LabelCollection | null>(null);
    const loadedRef = useRef(false);
    const lastUpdatePos = useRef<Cartesian3 | null>(null);
    const lastBBox = useRef<string>("");

    const getCellKey = (lat: number, lon: number) =>
        `${Math.floor(lat / CELL_SIZE)}_${Math.floor(lon / CELL_SIZE)}`;

    const loadStaticBerkeleyHeights = async () => {
        if (propertiesRef.current.length > 0) return; // already loaded
        try {
            const res = await fetch('/data/berkeley_heights.csv');
            if (!res.ok) return;
            const text = await res.text();
            const lines = text.trim().split('\n');
            // skip header
            const props: SystemProperty[] = [];
            for (let i = 1; i < lines.length; i++) {
                const [address, net_value, tax_rate, tax_amount, lat, lon] = lines[i].split(',');
                if (!lat || !lon) continue;
                props.push({
                    address,
                    city: 'Berkeley Heights',
                    county: 'Union',
                    net_value: parseFloat(net_value),
                    tax_rate: parseFloat(tax_rate),
                    tax_amount: parseFloat(tax_amount),
                    lat: parseFloat(lat),
                    lon: parseFloat(lon),
                });
            }
            if (props.length > 0) {
                propertiesRef.current = props;
                console.log(`[useProperties] Loaded ${props.length} Berkeley Heights properties from static CSV`);
            }
        } catch (e) {
            console.warn('[useProperties] Static CSV load failed:', e);
        }
    };

    const updateVisibleProperties = async () => {
        if (!viewer || !show) return;

        const camera = viewer.camera;
        const altitude = viewportAltitude(viewer);

        // Don't render if too high
        if (altitude > MIN_ALTITUDE_FOR_PROPERTIES) {
            if (pointsRef.current) pointsRef.current.removeAll();
            if (labelsRef.current) labelsRef.current.removeAll();
            return;
        }

        // Get viewport bbox for fetching
        const rectangle = camera.computeViewRectangle();
        if (!rectangle) return;

        const west = CesiumMath.toDegrees(rectangle.west);
        const south = CesiumMath.toDegrees(rectangle.south);
        const east = CesiumMath.toDegrees(rectangle.east);
        const north = CesiumMath.toDegrees(rectangle.north);

        const bboxKey = `${west.toFixed(2)}_${south.toFixed(2)}_${east.toFixed(2)}_${north.toFixed(2)}`;

        // Fetch new data if moved significantly or first time
        if (bboxKey !== lastBBox.current) {
            lastBBox.current = bboxKey;
            // Try backend first, fall back to static CSV
            let fetched = false;
            try {
                const response = await wsClient.sendCommand("get_properties", {
                    lat_min: south,
                    lat_max: north,
                    lon_min: west,
                    lon_max: east,
                    limit: 1000,
                });

                if (response && response.ok && response.result) {
                    const props = response.result.properties as SystemProperty[];
                    if (props.length > 0) {
                        propertiesRef.current = props;
                        fetched = true;
                    }
                }
            } catch (_err) {
                // backend offline — fall through to static CSV
            }

            // Fall back: load static Berkeley Heights CSV if viewport overlaps BH bbox
            if (!fetched) {
                const BH_BBOX = { n: 40.70, s: 40.66, e: -74.42, w: -74.47 };
                const overlaps = south < BH_BBOX.n && north > BH_BBOX.s && west < BH_BBOX.e && east > BH_BBOX.w;
                if (overlaps) {
                    await loadStaticBerkeleyHeights();
                }
            }
        }


        if (propertiesRef.current.length === 0) return;

        // Proximity sorting
        const center = camera.positionWC;
        lastUpdatePos.current = Cartesian3.clone(center);
        const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(center);
        const centerLat = CesiumMath.toDegrees(cartographic.latitude);
        const centerLon = CesiumMath.toDegrees(cartographic.longitude);

        const filtered = propertiesRef.current
            .map((p, idx) => ({ idx, dist: fastDist(centerLat, centerLon, p.lat, p.lon) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, MAX_VISIBLE_PROPERTIES);

        if (pointsRef.current) pointsRef.current.removeAll();
        if (labelsRef.current) labelsRef.current.removeAll();

        filtered.forEach(({ idx }) => {
            const p = propertiesRef.current[idx];
            const pos = Cartesian3.fromDegrees(p.lon, p.lat, 2.0);

            pointsRef.current?.add({
                position: pos,
                pixelSize: 10,
                color: Color.fromCssColorString("#94d2bd"),
                outlineColor: Color.WHITE.withAlpha(0.8),
                outlineWidth: 2,
                scaleByDistance: new NearFarScalar(100, 1.5, 5000, 0.5),
                id: { type: "property", index: idx },
            } as any);

            const valueStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.net_value);
            const taxStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.tax_amount);

            labelsRef.current?.add({
                position: Cartesian3.fromDegrees(p.lon, p.lat, 15.0),
                text: `${p.address}\n${valueStr} | ${taxStr} Tax`,
                font: "600 12px Inter, system-ui, sans-serif",
                fillColor: Color.WHITE,
                outlineColor: Color.fromCssColorString("#0a0e1a"),
                outlineWidth: 4,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                horizontalOrigin: HorizontalOrigin.CENTER,
                pixelOffset: { x: 0, y: -8 } as any,
                scaleByDistance: new NearFarScalar(50, 1.2, 5000, 0.0),
                translucencyByDistance: new NearFarScalar(1000, 1.0, 5000, 0.0),
                showBackground: true,
                backgroundColor: Color.fromCssColorString("#0a0e1a").withAlpha(0.85),
                id: { type: "property", index: idx },
            } as any);
        });
    };

    useEffect(() => {
        if (!viewer || loadedRef.current) return;
        loadedRef.current = true;

        const points = new PointPrimitiveCollection();
        const labels = new LabelCollection();
        viewer.scene.primitives.add(points);
        viewer.scene.primitives.add(labels);
        pointsRef.current = points;
        labelsRef.current = labels;

        // Pre-load Berkeley Heights static CSV immediately (works even when backend is offline)
        loadStaticBerkeleyHeights().then(() => {
            // Initial update after data is ready
            updateVisibleProperties();
        });


        // Listen for camera movement
        const removeListener = viewer.camera.moveEnd.addEventListener(updateVisibleProperties);

        return () => {
            removeListener();
            if (viewer && !viewer.isDestroyed()) {
                if (pointsRef.current) viewer.scene.primitives.remove(pointsRef.current);
                if (labelsRef.current) viewer.scene.primitives.remove(labelsRef.current);
            }
            pointsRef.current = null;
            labelsRef.current = null;
            loadedRef.current = false;
            propertiesRef.current = [];
            gridRef.current.clear();
        };
    }, [viewer]);

    useEffect(() => {
        if (pointsRef.current) pointsRef.current.show = show;
        if (labelsRef.current) labelsRef.current.show = show;
        updateVisibleProperties();
    }, [show]);

    return {
        getProperty: (index: number) => propertiesRef.current[index] || null,
    };
}

function viewportAltitude(viewer: Viewer) {
    const scene = viewer.scene;
    const camera = scene.camera;
    const mag = Cartesian3.magnitude(camera.positionWC);
    return mag - 6378137.0; // Subtract Earth radius
}

function fastDist(lat1: number, lon1: number, lat2: number, lon2: number) {
    const dy = lat1 - lat2;
    const dx = (lon1 - lon2) * Math.cos(lat1 * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
}
