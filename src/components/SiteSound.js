"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { audioContext } from "@/lib/audio";
import { useT } from "@/lib/i18n/client";
import { DEFAULT_VOLUME, readSound, readSoundOnServer, readVolume, readVolumeOnServer, subscribeSound, subscribeVolume, writeSound, writeVolume } from "@/lib/soundSetting";
import { startAmbient } from "./recap/ambient";
import styles from "./SiteSound.module.css";

/** A speaker icon: waves for how loud it is, or a cross when muted. */
function Speaker({ muted, level }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" />
      ) : (
        <>
          <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
          {level > 0.45 && <path d="M18.5 7a7 7 0 0 1 0 10" />}
        </>
      )}
    </svg>
  );
}

/**
 * The site's sound: the speaker and volume slider in the top bar, and the soundtrack they control. It sits in the root layout, which
 * stays mounted as you move between pages, so the music keeps playing everywhere instead of stopping with the recap it started on.
 * (A full page load, like a reload or following an outside link, starts the page over; the choice is remembered, and the music
 * starts again on the first click or key press.) Sound is off until the speaker is used.
 */
export default function SiteSound() {
  const t = useT();
  const music = useSyncExternalStore(subscribeSound, readSound, readSoundOnServer);
  const volume = useSyncExternalStore(subscribeVolume, readVolume, readVolumeOnServer);
  const muted = !music || volume === 0;
  const volumeRef = useRef(volume);
  const padRef = useRef(null); // the playing pad's controls

  // The soundtrack plays whenever it is switched on. A choice remembered from an earlier visit can't start by itself (browsers
  // block audio until the page has been clicked or a key pressed), so it starts on the first one.
  useEffect(() => {
    if (!music) return;
    let pad = null;
    let cancelled = false;

    async function begin() {
      if (pad) return;
      const ctx = audioContext();
      if (!ctx) return;
      try {
        // While the page has had no click or key press this waits, so the attempt made at load never finishes on its own:
        // every gesture tries again, and whichever resolves first starts the pad (the check below stops a second one).
        await ctx.resume();
      } catch {
        // Still blocked; the next gesture tries again.
      }
      if (!cancelled && !pad && ctx.state === "running") {
        pad = startAmbient(ctx, volumeRef.current);
        padRef.current = pad;
      }
    }

    begin();
    const gestures = ["pointerdown", "keydown", "touchend"];
    gestures.forEach((name) => window.addEventListener(name, begin, { passive: true }));
    return () => {
      cancelled = true;
      gestures.forEach((name) => window.removeEventListener(name, begin));
      pad?.stop();
      padRef.current = null;
    };
  }, [music]);

  // The slider moves the pad while it plays, and the sounds that start later read the same value.
  useEffect(() => {
    volumeRef.current = volume;
    padRef.current?.setVolume(volume);
  }, [volume]);

  return (
    <div className={styles.sound} data-muted={muted}>
      <button
        type="button"
        className={styles.speaker}
        aria-label={t(muted ? "story.unmute" : "story.mute")}
        aria-pressed={muted}
        onClick={() => {
          if (!muted) return writeSound(false);
          writeSound(true);
          if (volume === 0) writeVolume(DEFAULT_VOLUME); // unmuting from a slider at zero would still be silent
        }}
      >
        <Speaker muted={muted} level={volume} />
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={Math.round(volume * 100)}
        aria-label={t("story.volume")}
        aria-valuetext={t.percent(volume)}
        onChange={(event) => {
          const next = Number(event.target.value) / 100;
          writeVolume(next);
          if (next > 0 && !music) writeSound(true); // moving the slider is asking for sound
        }}
      />
    </div>
  );
}
