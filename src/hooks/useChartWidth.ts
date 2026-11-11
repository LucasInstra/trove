import { useEffect, useRef, useState } from "react";

/**
 * The pixel width of a chart box, tracked live. Charts draw in real pixels
 * (crisp strokes) instead of stretching a fixed viewBox.
 */
export function useChartWidth<T extends HTMLElement>(fallback = 600): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const read = () => setWidth(Math.max(1, Math.floor(node.clientWidth)));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
