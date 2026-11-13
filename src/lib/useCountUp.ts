import { useLayoutEffect, useRef, useState } from "react";

const DURATION_MS = 650;

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/**
 * Eases a number from where it was to its new value. The first render counts up
 * from zero. Tests and "reduce motion" get the final value straight away.
 */
export function useCountUp(target: number): number {
  const skip = import.meta.env.MODE === "test" || reducedMotion();
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const first = useRef(true);

  useLayoutEffect(() => {
    if (skip) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const from = first.current ? 0 : shownRef.current;
    first.current = false;
    if (from === target) {
      setShown(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.round(from + (target - from) * eased);
      shownRef.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    shownRef.current = from;
    setShown(from);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, skip]);

  return shown;
}
