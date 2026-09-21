"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TOP_BAR_SLOT } from "@/components/topBar";
import { useT } from "@/lib/i18n/client";
import { existingAudioContext } from "@/lib/audio";
import { readSound, readSoundOnServer, readVolume, readVolumeOnServer, subscribeSound, subscribeVolume } from "@/lib/soundSetting";
import { playSlideChange } from "./ambient";
import { copyText } from "./ShareButtons";
import styles from "./Story.module.css";

// How long the slideshow stays on a slide, in seconds. A slide can ask for more with `<Slide dwell={...}>` (dense ones,
// or ones you play with, like the squad quiz).
const DEFAULT_DWELL = 7;
// How long the slide has to stay put before its sound plays.
const SETTLE_MS = 180;
const dwellOf = (slide) => Number(slide?.dataset.dwell) || DEFAULT_DWELL;
// How long after a step button press the next press still counts from where that one was heading.
const STEP_SETTLE_MS = 900;
// How long the copy button shows whether it worked.
const COPY_FEEDBACK_MS = 2400;
// How long the address bar waits for a slide to stay put before it names it (a jump across the page passes many slides).
const HASH_MS = 200;

/** Slides glide into view, unless the viewer has asked their system for less motion. */
const scrollBehavior = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth");

// The top bar's slot for page controls (see the layout). Not there on the server or outside the app (Storybook).
const subscribeNothing = () => () => {};
const readTopBarSlot = () => document.getElementById(TOP_BAR_SLOT);
const readNoTopBarSlot = () => null;

/** An up or down chevron, for the buttons that step between slides (the slides are stacked, so "next" is down). */
function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "up" ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

/** The copy-link button's icon: a chain, then a tick or a cross for a moment once it has tried. */
function LinkIcon({ state }) {
  const paths = {
    idle: ["M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7", "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"],
    done: ["m5 12.5 5 5L19 7"],
    failed: ["m6 6 12 12", "m18 6-12 12"],
  }[state];
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * Scroll-snap container for the recap slides. Marks the slide in view with `data-active="true"`
 * (which triggers its reveal animations) and renders a progress rail.
 *
 * It also runs a slideshow: a button on the first slide starts it, and it then moves through the slides on its own
 * and stops at the last one. Touching the slides (scroll, tap, keys) or the rail pauses it, so it never fights the viewer.
 *
 * `ids` are the slides' names for deep links: the address bar names the slide in view, and a link with one opens on it. With
 * them, a button copies the link to the slide in view.
 *
 * Keys: Down, Right and Page Down go to the next slide; Up, Left and Page Up to the previous one; Home and End to the
 * first and last; Escape stops the slideshow.
 */
export default function Story({ labels, ids, children }) {
  const t = useT();
  // `ids` names each slide in the address bar (`#champion`); a slide without a plain name just has no link.
  const idsKey = labels.map((_, i) => (/^[\w-]+$/.test(ids?.[i] ?? "") ? ids[i] : "")).join(",");
  const linkable = idsKey.replaceAll(",", "") !== "";
  const [copied, setCopied] = useState("idle"); // idle | done | failed
  const ref = useRef(null);
  // The slide in view and how long a slideshow stays on it. Kept together so a slideshow step updates both at once.
  const [now, setNow] = useState({ index: 0, dwell: DEFAULT_DWELL });
  const [mode, setMode] = useState("off"); // off | playing | paused
  const active = now.index;
  const music = useSyncExternalStore(subscribeSound, readSound, readSoundOnServer);
  const volume = useSyncExternalStore(subscribeVolume, readVolume, readVolumeOnServer);
  const topBar = useSyncExternalStore(subscribeNothing, readTopBarSlot, readNoTopBarSlot);
  const volumeRef = useRef(volume);


  useEffect(() => {
    const root = ref.current;
    const slides = [...root.querySelectorAll("[data-slide]")];

    // Deep links: the address bar names the slide in view, so copying it shares that slide, and a link that has one opens
    // right on it. The first slide has no name: it is the plain link. (`replaceState` does not add history entries.)
    const ids = idsKey.split(",");
    const linked = () => {
      try {
        const name = decodeURIComponent(window.location.hash.slice(1));
        return name ? ids.indexOf(name) : -1;
      } catch {
        return -1; // a malformed escape in the hash
      }
    };
    const target = linked();
    if (target > 0) slides[target]?.scrollIntoView({ behavior: "instant" });

    let nameTimer = 0;
    function nameSlide(index) {
      clearTimeout(nameTimer);
      nameTimer = setTimeout(() => {
        const { pathname, search } = window.location;
        try {
          window.history.replaceState(window.history.state, "", `${pathname}${search}${index > 0 && ids[index] ? `#${ids[index]}` : ""}`);
        } catch {
          // Browsers limit how often the address may change; the next slide tries again.
        }
      }, HASH_MS);
    }

    // The first report only says where the page opened (already named, or the start), so it leaves the address alone.
    let opened = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.dataset.active = String(entry.isIntersecting);
          if (!entry.isIntersecting) continue;
          const index = slides.indexOf(entry.target);
          setNow({ index, dwell: dwellOf(entry.target) });
          if (opened) nameSlide(index);
        }
        opened = true;
      },
      { root, threshold: 0.6 },
    );
    slides.forEach((slide) => observer.observe(slide));

    // Someone edits the address or follows a link to another slide of this page.
    const onHash = () => slides[linked()]?.scrollIntoView({ behavior: scrollBehavior() });
    window.addEventListener("hashchange", onHash);
    return () => {
      clearTimeout(nameTimer);
      window.removeEventListener("hashchange", onHash);
      observer.disconnect();
    };
  }, [idsKey]);

  // The slideshow: wait out the current slide, then scroll to the next one (or finish on the last).
  useEffect(() => {
    if (mode !== "playing") return;
    const timer = setTimeout(() => {
      const slides = ref.current.querySelectorAll("[data-slide]");
      const next = slides[now.index + 1];
      if (!next) {
        setMode("off");
        return;
      }
      next.scrollIntoView({ behavior: scrollBehavior() });
      // Set it here too, so the slideshow keeps going even if the browser never reports the new slide as in view.
      setNow({ index: now.index + 1, dwell: dwellOf(next) });
    }, now.dwell * 1000);
    return () => clearTimeout(timer);
  }, [mode, now]);

  // A soft whoosh when a slide comes to rest (not for the first one on load), if sound is on and the browser allows audio.
  // Waiting a moment matters: jumping several slides at once (Home, End, a click far down the rail) scrolls past every slide
  // in between, and each would otherwise get its own whoosh.
  const heardSlide = useRef(0);
  useEffect(() => {
    if (heardSlide.current === active) return;
    const timer = setTimeout(() => {
      heardSlide.current = active;
      // The soundtrack (see SiteSound) made the context; without it, or while it is muted, there is nothing to play.
      const ctx = existingAudioContext();
      if (music && ctx?.state === "running") playSlideChange(ctx, volumeRef.current);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [active, music]);

  // The sounds that start later (the slide change) read the slider's value from here; the soundtrack itself follows it in SiteSound.
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  function start() {
    // The first slide may want longer than the default.
    const first = ref.current.querySelector("[data-slide]");
    setNow((current) => ({ ...current, dwell: dwellOf(first) }));
    setMode("playing");
  }

  // The link to the slide in view. The first slide is the plain link; the address bar may still be catching up with a slide that
  // has just come into view, so this is built from the slide itself.
  async function copySlideLink() {
    const url = new URL(window.location.href);
    const id = idsKey.split(",")[active];
    url.hash = active > 0 && id ? id : "";
    setCopied((await copyText(url.toString())) ? "done" : "failed");
    setTimeout(() => setCopied("idle"), COPY_FEEDBACK_MS);
  }

  const pause = () => setMode((current) => (current === "playing" ? "paused" : current));

  function goTo(index) {
    pause();
    const slides = ref.current.querySelectorAll("[data-slide]");
    slides[Math.max(0, Math.min(index, slides.length - 1))].scrollIntoView({ behavior: scrollBehavior() });
  }

  // A step counts from the slide the last step was heading for while that scroll is still going, so tapping twice quickly
  // moves two slides (the slide "in view" only changes once the scroll gets far enough).
  const lastStep = useRef({ index: 0, at: 0 });
  function step(direction) {
    const scrolling = Date.now() - lastStep.current.at < STEP_SETTLE_MS;
    const to = Math.max(0, Math.min((scrolling ? lastStep.current.index : active) + direction, labels.length - 1));
    lastStep.current = { index: to, at: Date.now() };
    goTo(to);
  }

  // Keyboard navigation works from anywhere on the page (the moment it loads, with no click or focus needed), so it listens
  // on the window. Form fields keep their own arrow keys, and modifier shortcuts are left to the browser.
  useEffect(() => {
    function onKey(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest("input, select, textarea, [contenteditable]")) return;

      if (event.key === "Escape") {
        setMode("off");
        return;
      }
      const slides = [...ref.current.querySelectorAll("[data-slide]")];
      const current = Math.max(0, slides.findIndex((slide) => slide.dataset.active === "true"));
      // "Forward" points the way the language reads: right in most, left in Arabic.
      const rtl = document.documentElement.dir === "rtl";
      const [forward, back] = rtl ? ["ArrowLeft", "ArrowRight"] : ["ArrowRight", "ArrowLeft"];
      const target = { ArrowDown: current + 1, [forward]: current + 1, PageDown: current + 1, ArrowUp: current - 1, [back]: current - 1, PageUp: current - 1, Home: 0, End: slides.length - 1 }[event.key];
      if (target == null) return;

      event.preventDefault(); // otherwise the browser scrolls the slides its own way as well
      setMode((mode) => (mode === "playing" ? "paused" : mode));
      slides[Math.max(0, Math.min(target, slides.length - 1))].scrollIntoView({ behavior: scrollBehavior() });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Starting the slideshow is always the viewer's choice: the button is on the first slide, and nothing plays before it is pressed.
  // The speaker and volume slider are in the top bar of every page (SiteSound): they are the one control for all sound. Play is only on the first slide.
  const controls = (
    <div className={styles.controls} data-floating={!topBar || undefined} role="group" aria-label={t("story.controls")}>
      {/* Step to the neighbouring slide: for touch, where there is no arrow key. Like the rail, stepping pauses a slideshow. */}
      <button type="button" className={`${styles.control} ${styles.step}`} onClick={() => step(-1)} disabled={active <= 0} aria-label={t("story.previous")}>
        <Chevron direction="up" />
      </button>
      <button type="button" className={`${styles.control} ${styles.step}`} onClick={() => step(1)} disabled={active >= labels.length - 1} aria-label={t("story.next")}>
        <Chevron direction="down" />
      </button>
      {linkable && (
        <button type="button" className={`${styles.control} ${styles.step}`} onClick={copySlideLink} aria-label={t("story.copyLink")} title={t("story.copyLink")} data-state={copied}>
          <LinkIcon state={copied} />
        </button>
      )}
      {mode === "off" ? (
        active === 0 && (
          <button type="button" className={styles.play} onClick={start}>
            <span aria-hidden="true">▶</span> {t("story.play")}
          </button>
        )
      ) : (
        <>
          <button type="button" className={styles.control} onClick={() => setMode(mode === "playing" ? "paused" : "playing")}>
            <span aria-hidden="true">{mode === "playing" ? "❚❚" : "▶"}</span> {t(mode === "playing" ? "story.pause" : "story.resume")}
          </button>
          <button type="button" className={styles.control} onClick={() => setMode("off")} aria-label={t("story.stop")}>
            <span aria-hidden="true">✕</span>
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <nav aria-label="Rift Recap">
        <Link href="/" className={styles.brand}>
          Rift Recap
        </Link>
      </nav>
      <nav className={styles.rail} style={{ "--n": labels.length }} aria-label={t("story.sections")}>
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            className={styles.dot}
            data-current={i === active}
            aria-label={label}
            aria-current={i === active}
            onClick={() => goTo(i)}
          >
            <span className={styles.tip}>{label}</span>
          </button>
        ))}
      </nav>

      {topBar ? createPortal(controls, topBar) : controls}
      {mode === "playing" && (
        <div className={styles.progress} aria-hidden="true">
          {/* A new element for every slide, so the bar restarts and fills over exactly that slide's time. */}
          <span key={active} style={{ animationDuration: `${now.dwell}s` }} />
        </div>
      )}
      <p className={styles.srOnly} role="status">
        {copied === "done" ? t("share.linkCopied") : copied === "failed" ? t("share.copyFailed") : ""}
      </p>
      <p className={styles.srOnly} role="status">
        {mode === "playing" ? t("story.playing") : mode === "paused" ? t("story.paused") : ""}
      </p>

      <main
        ref={ref}
        className={styles.story}
        tabIndex={0}
        onWheel={pause}
        onTouchStart={pause}
        onPointerDown={pause}
        aria-label={t("story.label")}
      >
        {children}
      </main>
    </>
  );
}
