import { useRef, useState, useCallback } from "react";

export function useDraggable(initialX = 0, initialY = 0) {
    const [pos, setPos] = useState({ x: initialX, y: initialY });
    const dragging = useRef(false);
    const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        // Only drag on primary button; ignore clicks on interactive children
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest("button, input, select, a")) return;
        e.preventDefault();
        dragging.current = true;
        origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };

        const onMove = (ev: MouseEvent) => {
            if (!dragging.current) return;
            setPos({
                x: origin.current.px + (ev.clientX - origin.current.mx),
                y: origin.current.py + (ev.clientY - origin.current.my),
            });
        };
        const onUp = () => {
            dragging.current = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pos.x, pos.y]);

    return { pos, onMouseDown };
}
