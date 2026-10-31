import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Animates a number from its previous value to `target` whenever `target`
 * changes - including the very first render, where it counts up from 0.
 * That first count-up is the point: numbers that just snap into place on
 * load feel static, numbers that visibly arrive feel alive.
 */
export default function useCountUp(target, { duration = 900 } = {}) {
  const [value, setValue] = useState(0);
  // Mirrors the last value actually painted, written only from inside a
  // running tick - never eagerly in the effect body. React 18 StrictMode
  // runs this effect, cleans it up, then runs it again on mount (purely in
  // dev, to catch missing-cleanup bugs); writing the "from" ref eagerly
  // meant the first (discarded) run poisoned it before its frame ever
  // fired, so the second run saw from === target and skipped the animation
  // outright. Keeping the write inside tick means a cancelled run leaves no
  // trace.
  const valueRef = useRef(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      return undefined;
    }

    const from = valueRef.current === null ? 0 : valueRef.current;

    if (from === target) {
      valueRef.current = target;
      setValue(target);
      return undefined;
    }

    const start = performance.now();
    let frame;

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * easeOutCubic(t);
      valueRef.current = next;
      setValue(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        valueRef.current = target;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
