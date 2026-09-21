"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/client";

function format(t, value, decimals, suffix, percent, compact) {
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  const options = percent ? { style: "percent", ...digits } : compact ? { notation: "compact", maximumFractionDigits: decimals } : digits;
  return t.number(value, options) + suffix;
}

/**
 * Counts up to `value` the first time it scrolls into view. Server-renders the final number, so it
 * is correct without JavaScript and for reduced-motion users. The text is updated directly on the
 * DOM node to avoid re-rendering on every animation frame. `percent` shows `value` (a fraction, 0.5) as a percentage
 * the way the language writes one, and `compact` shows 212345 as "212K" (or "21万").
 */
export default function CountUp({ value, decimals = 0, suffix = "", percent = false, compact = false, duration = 1400 }) {
  const t = useT();
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.textContent = format(t, 0, decimals, suffix, percent, compact);
    let frame;
    let started = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        const startedAt = performance.now();
        const tick = (now) => {
          const progress = Math.min((now - startedAt) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = format(t, value * eased, decimals, suffix, percent, compact);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [t, value, decimals, suffix, percent, compact, duration]);

  return <span ref={ref}>{format(t, value, decimals, suffix, percent, compact)}</span>;
}
