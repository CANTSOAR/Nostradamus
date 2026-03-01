import { useEffect, useRef } from "react";
import {
    PointPrimitiveCollection,
    LabelCollection,
    Cartesian3,
    Color,
    NearFarScalar,
    LabelStyle,
    VerticalOrigin,
    HorizontalOrigin,
    type Viewer,
} from "cesium";
import { useMapStore } from "../store/useMapStore";

export interface BHProperty {
    address: string;
    net_value: number;
    tax_rate: number;
    tax_amount: number;
    lat: number;
    lon: number;
}

const PIN_ALT = 200; // meters above WGS84 ellipsoid (~120m clearance above Berkeley Heights rooftops)

// Color-code by assessed value bucket
function valueColor(value: number): Color {
    if (value >= 1_000_000) return Color.fromCssColorString("#f43f5e"); // red — top tier
    if (value >= 500_000) return Color.fromCssColorString("#f97316"); // orange
    if (value >= 350_000) return Color.fromCssColorString("#facc15"); // yellow
    return Color.fromCssColorString("#4ade80");                         // green — lower
}

function fmtUSD(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${Math.round(n)}`;
}

export function useBerkeleyHeightsProperties({
    viewer,
}: {
    viewer: Viewer | null;
}) {
    const show = useMapStore(s => s.showProperties);
    const setSelected = useMapStore(s => s.setSelectedProperty);

    const pointsRef = useRef<PointPrimitiveCollection | null>(null);
    const labelsRef = useRef<LabelCollection | null>(null);
    const propsRef = useRef<BHProperty[]>([]);
    const loadedRef = useRef(false);

    // Load CSV + render points once viewer is ready
    useEffect(() => {
        if (!viewer || loadedRef.current) return;
        loadedRef.current = true;

        fetch("/data/berkeley_heights.csv")
            .then(r => r.text())
            .then(text => {
                if (!viewer || viewer.isDestroyed()) return;

                const lines = text.trim().split("\n");
                const properties: BHProperty[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].split(",");
                    if (parts.length < 6) continue;
                    const [address, net_value, tax_rate, tax_amount, lat, lon] = parts;
                    const prop: BHProperty = {
                        address,
                        net_value: parseFloat(net_value),
                        tax_rate: parseFloat(tax_rate),
                        tax_amount: parseFloat(tax_amount),
                        lat: parseFloat(lat),
                        lon: parseFloat(lon),
                    };
                    if (isNaN(prop.lat) || isNaN(prop.lon)) continue;
                    properties.push(prop);
                }

                propsRef.current = properties;

                // --- Build Cesium collections ---
                const points = new PointPrimitiveCollection();
                points.show = show;
                viewer.scene.primitives.add(points);
                pointsRef.current = points;

                const labels = new LabelCollection({ scene: viewer.scene });
                labels.show = show;
                viewer.scene.primitives.add(labels);
                labelsRef.current = labels;

                properties.forEach((p, idx) => {
                    const color = valueColor(p.net_value);
                    const pos = Cartesian3.fromDegrees(p.lon, p.lat, PIN_ALT);

                    points.add({
                        position: pos,
                        pixelSize: 14,
                        color: color.withAlpha(0.95),
                        outlineColor: Color.WHITE.withAlpha(0.8),
                        outlineWidth: 2,
                        scaleByDistance: new NearFarScalar(100, 2.0, 20_000, 0.5),
                        id: { type: "bh_property", index: idx },
                    } as any);

                    labels.add({
                        position: Cartesian3.fromDegrees(p.lon, p.lat, PIN_ALT + 12),
                        text: `${p.address}\n${fmtUSD(p.net_value)} · ${fmtUSD(p.tax_amount)}/yr`,
                        font: "600 11px Inter, system-ui, sans-serif",
                        fillColor: Color.WHITE,
                        outlineColor: Color.fromCssColorString("#0a0e1a"),
                        outlineWidth: 3,
                        style: LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: VerticalOrigin.BOTTOM,
                        horizontalOrigin: HorizontalOrigin.CENTER,
                        pixelOffset: { x: 0, y: -6 } as any,
                        scaleByDistance: new NearFarScalar(50, 1.2, 1200, 0.0),
                        translucencyByDistance: new NearFarScalar(600, 1.0, 1200, 0.0),
                        showBackground: true,
                        backgroundColor: Color.fromCssColorString("#0a0e1a").withAlpha(0.8),
                        backgroundPadding: { x: 5, y: 3 } as any,
                    } as any);
                });

                console.log(`[BerkeleyHeights] Rendered ${properties.length} property points`);
            })
            .catch(e => console.error("[BerkeleyHeights] Failed to load CSV:", e));

        return () => {
            if (viewer && !viewer.isDestroyed()) {
                if (pointsRef.current) viewer.scene.primitives.remove(pointsRef.current);
                if (labelsRef.current) viewer.scene.primitives.remove(labelsRef.current);
            }
            pointsRef.current = null;
            labelsRef.current = null;
            loadedRef.current = false;
            propsRef.current = [];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewer]);

    // Toggle visibility
    useEffect(() => {
        if (pointsRef.current) pointsRef.current.show = show;
        if (labelsRef.current) labelsRef.current.show = show;
    }, [show]);

    // Expose click handler
    const handleClick = (idx: number) => {
        const p = propsRef.current[idx];
        if (!p) return;
        setSelected({
            address: p.address,
            city: "Berkeley Heights",
            county: "Union",
            net_value: p.net_value,
            tax_rate: p.tax_rate,
            tax_amount: p.tax_amount,
            lat: p.lat,
            lon: p.lon,
        });
    };

    return { handleClick };
}
