/**
 * useGeoJsonLayer
 * Generic hook to load + show/hide a GeoJSON data source in Cesium.
 * It loads the file once and then toggles visibility based on `show`.
 */

import { useEffect, useRef } from "react";
import { GeoJsonDataSource, Color, ColorMaterialProperty, type Viewer } from "cesium";

export interface GeoJsonLayerOptions {
    viewer: Viewer | null;
    show: boolean;
    url: string;
    /** Called after entities are loaded so you can apply custom styling. */
    onLoad?: (ds: GeoJsonDataSource) => void;
    /** Cesium stroke color (default: white 0.6 alpha). */
    stroke?: Color;
    strokeWidth?: number;
    fill?: Color;
    clampToGround?: boolean;
}

export function useGeoJsonLayer({
    viewer,
    show,
    url,
    onLoad,
    stroke = Color.WHITE.withAlpha(0.6),
    strokeWidth = 1,
    fill = Color.WHITE.withAlpha(0.1),
    clampToGround = true,
}: GeoJsonLayerOptions) {
    const dsRef = useRef<GeoJsonDataSource | null>(null);
    const loadedRef = useRef(false);

    // Load once when viewer is ready
    useEffect(() => {
        if (!viewer || loadedRef.current) return;
        loadedRef.current = true;

        const ds = new GeoJsonDataSource();
        dsRef.current = ds;
        ds.load(url, { stroke, strokeWidth, fill, clampToGround })
            .then(() => {
                if (viewer.isDestroyed()) return;
                viewer.dataSources.add(ds);
                ds.show = show;
                onLoad?.(ds);
            })
            .catch((err: unknown) => {
                console.warn(`useGeoJsonLayer: failed to load ${url}`, err);
                loadedRef.current = false;
            });

        return () => {
            if (viewer && !viewer.isDestroyed() && dsRef.current) {
                viewer.dataSources.remove(dsRef.current, true);
            }
            dsRef.current = null;
            loadedRef.current = false;
        };
        // only re-run if viewer instance changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewer]);

    // Toggle visibility
    useEffect(() => {
        if (dsRef.current) dsRef.current.show = show;
    }, [show]);
}
