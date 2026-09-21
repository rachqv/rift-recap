"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { audioContext } from "@/lib/audio";
import { readSound, readSoundOnServer, readVolume, subscribeSound } from "@/lib/soundSetting";
import { playReveal } from "./reveal";

/**
 * Plays a synthesized sound as the archetype lands, tuned to `persona` (the archetype id), when sound is on (the speaker
 * button is not muted). It plays through the page's shared audio context, in the soundtrack's key (see reveal.js). Browsers only
 * allow audio after a click, tap or key press on the page, so until then the reveal is silent.
 */
export default function PersonaSound({ persona }) {
  const anchorRef = useRef(null);
  const stopRef = useRef(null);
  // The same switch as the speaker button: this plays only while sound is on.
  const on = useSyncExternalStore(subscribeSound, readSound, readSoundOnServer);
  const onRef = useRef(on);
  useEffect(() => {
    onRef.current = on;
    if (!on) {
      stopRef.current?.();
      stopRef.current = null;
    }
  }, [on]);

  useEffect(() => {
    const slide = anchorRef.current?.closest("[data-slide]");
    if (!slide || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stop = () => {
      stopRef.current?.();
      stopRef.current = null;
    };
    const play = () => {
      stop();
      const ctx = audioContext();
      if (onRef.current && ctx?.state === "running") stopRef.current = playReveal(ctx, persona, readVolume());
    };
    const unlock = () => {
      const ctx = audioContext();
      if (ctx?.state === "suspended") ctx.resume();
    };

    const events = ["pointerdown", "keydown", "touchend"];
    events.forEach((name) => window.addEventListener(name, unlock, { passive: true }));
    const observer = new MutationObserver(() => (slide.dataset.active === "true" ? play() : stop()));
    observer.observe(slide, {
      attributes: true,
      attributeFilter: ["data-active"],
    });
    if (slide.dataset.active === "true") play();

    return () => {
      events.forEach((name) => window.removeEventListener(name, unlock));
      observer.disconnect();
      stop();
    };
  }, [persona]);

  // Nothing to see: the speaker button is the control. This only marks where the archetype slide is.
  return <span ref={anchorRef} hidden />;
}
