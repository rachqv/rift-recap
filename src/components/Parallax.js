"use client";

import { useEffect } from "react";

/**
 * Publishes the pointer position as `--px` and `--py` (each -1 to 1, 0 at the center of the window) on the
 * root element, eased so movement feels weighty. Renders nothing; CSS turns the variables into depth by
 * shifting layers by different amounts, e.g. `translate: calc(var(--px, 0) * -14px) ...`.
 *
 * Off for people who ask for reduced motion, and on devices without a precise hovering pointer (touch).
 */
export default function Parallax() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    const root = document.documentElement;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;

    function tick() {
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      root.style.setProperty("--px", x.toFixed(3));
      root.style.setProperty("--py", y.toFixed(3));
      // Keep animating until the eased value catches up with the target, then stop to save work.
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.002 ? requestAnimationFrame(tick) : 0;
    }
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    function onMove(event) {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      wake();
    }
    function onLeave() {
      targetX = 0;
      targetY = 0;
      wake();
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(frame);
      root.style.removeProperty("--px");
      root.style.removeProperty("--py");
    };
  }, []);

  return null;
}
