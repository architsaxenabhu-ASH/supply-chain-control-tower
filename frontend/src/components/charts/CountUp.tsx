import { useEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "../../motion/motion";

// An animated number that rolls smoothly from its previous figure to the new one
// whenever the value changes — so the headline figures visibly climb (or fall) as
// the business grows during a live walkthrough, instead of snapping. Honours
// prefers-reduced-motion (sets the value instantly) and formats every frame so
// currency/units read correctly throughout the roll.

export function CountUp({
  value,
  format,
  durationMs = 750,
}: {
  value: number;
  format: (value: number) => string;
  durationMs?: number;
}) {
  const reduced = prefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || fromRef.current === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic — fast then settles
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs, reduced]);

  return <span className="countup">{format(Math.round(display))}</span>;
}
