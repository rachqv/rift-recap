"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { loudness, readSound, readSoundOnServer, readVolume, subscribeSound } from "@/lib/soundSetting";

// The hit lands with the flash and shockwave in slides.module.css (seconds after the slide becomes active).
const IMPACT = 0.6;

// Everything sits on a very low root (A1), so there is real sub-bass. Each archetype shifts it up by a few semitones.
const ROOT = 55;

// Inharmonic partials, like a struck gong: [ratio, volume, seconds].
const GONG = [
  [1, 0.18, 3.4],
  [2, 0.12, 2.8],
  [2.76, 0.08, 2.2],
  [5.4, 0.04, 1.5],
  [8.93, 0.02, 1],
];

/**
 * Four sound flavors, one per family of archetypes.
 * - chord: ratios stacked on the root (an octave up).  - brass / pad: volume of the sustained chord.
 * - swell / swellFrom: the build-up into the hit and when it starts.  - drive: bass saturation (harmonics that small
 *   speakers can actually play).  - scoop: how far brass slides up into its note.
 * - hits: [seconds relative to the impact, strength] for each boom.  - gong: volume of the gong.
 */
const FLAVORS = {
  // A victory fanfare: warm brass on a major chord.
  heroic: {
    chord: [1, 5 / 4, 3 / 2, 2, 5 / 2],
    brass: 0.09,
    pad: 0,
    swell: 0.07,
    swellFrom: 0,
    drive: 2.5,
    scoop: 0.05,
    hits: [[0, 1]],
    gong: 1,
  },
  // Aggressive: a minor chord, growling distortion and a double hit.
  fierce: {
    chord: [1, 6 / 5, 3 / 2, 2, 12 / 5],
    brass: 0.1,
    pad: 0,
    swell: 0.09,
    swellFrom: 0.25,
    drive: 9,
    scoop: 0.12,
    hits: [
      [0, 1],
      [0.2, 0.7],
    ],
    gong: 0.6,
  },
  // Mystic: a hovering, choir-like pad on an open chord, with a big ringing gong.
  arcane: {
    chord: [1, 3 / 2, 9 / 4, 3, 4],
    brass: 0,
    pad: 0.1,
    swell: 0.05,
    swellFrom: 0,
    drive: 1.5,
    scoop: 0,
    hits: [[0, 0.85]],
    gong: 1.5,
  },
  // Primal: war drums rolling into the hit.
  primal: {
    chord: [1, 3 / 2, 2],
    brass: 0.07,
    pad: 0,
    swell: 0.03,
    swellFrom: 0.3,
    drive: 4,
    scoop: 0.08,
    hits: [
      [-0.36, 0.5],
      [-0.18, 0.65],
      [0, 1],
    ],
    gong: 0.8,
  },
};

const FLAVOR_OF = {
  fierce: ["slayer", "daredevil", "showstopper", "heavyhitter", "opener", "assassin", "brawler", "streaker", "thief"],
  arcane: ["archmage", "onetrick", "specialist", "chameleon", "centerpiece", "explorer", "scout"],
  primal: ["pathfinder", "islander", "demolisher", "farmer", "marathoner", "speedrunner", "phoenix"],
};

function flavorFor(personaId) {
  const name = Object.keys(FLAVOR_OF).find((key) => FLAVOR_OF[key].includes(personaId)) ?? "heroic";
  return FLAVORS[name];
}

// A stable 0 to 5 semitone shift per archetype, so each one has its own pitch.
function pitchShift(personaId) {
  return [...personaId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Soft clipping: adds the harmonics that make a sub-bass audible on laptop and phone speakers.
function saturation(ctx, amount) {
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(amount * (i / 512 - 1)) / Math.tanh(amount);
  shaper.curve = curve;
  shaper.oversample = "2x";
  return shaper;
}

/**
 * Synthesizes the reveal for an archetype: a brass swell into a heavy, saturated sub-bass hit, a gong and a sustained
 * chord, all shaped by the archetype's flavor. Returns a function that fades it out.
 */
function playReveal(ctx, personaId, volume) {
  const flavor = flavorFor(personaId);
  const root = ROOT * 2 ** (pitchShift(personaId) / 12);

  const t0 = ctx.currentTime + 0.03;
  const master = ctx.createGain();
  master.gain.value = 1.7 * loudness(volume); // 0.95 at the default slider position
  const limiter = ctx.createDynamicsCompressor();
  master.connect(limiter).connect(ctx.destination);
  const bass = saturation(ctx, flavor.drive);
  bass.connect(master);

  // One oscillator through an optional low-pass filter. `attack` is the time to reach `peak`, then it decays until `length`.
  const voice = ({
    type = "sine",
    freq,
    freqEnd,
    at = 0,
    attack = 0.01,
    length,
    peak,
    detune = 0,
    cutoff,
    scoop,
    vibrato,
    to = master,
  }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    if (scoop) {
      osc.frequency.setValueAtTime(freq * (1 - scoop), t0 + at);
      osc.frequency.exponentialRampToValueAtTime(freq, t0 + at + 0.15);
    } else {
      osc.frequency.setValueAtTime(freq, t0 + at);
    }
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + at + length);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = freq * 0.008;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0 + at);
      lfo.stop(t0 + at + length + 0.05);
    }
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + length);
    let out = osc;
    if (cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cutoff[0], t0 + at);
      filter.frequency.exponentialRampToValueAtTime(cutoff[1], t0 + at + length);
      osc.connect(filter);
      out = filter;
    }
    out.connect(gain).connect(to);
    osc.start(t0 + at);
    osc.stop(t0 + at + length + 0.05);
  };

  // Low-passed noise: a rumble that reads as a thud, not a hiss.
  const rumble = (at, level) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, t0 + at);
    filter.frequency.exponentialRampToValueAtTime(60, t0 + at + 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.6 * level, t0 + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.6);
    source.connect(filter).connect(gain).connect(master);
    source.start(t0 + at);
  };

  // The build-up: detuned sawtooths opening up as they rise, cut off by the hit.
  const swellLength = IMPACT - flavor.swellFrom;
  for (const [freq, detune] of [
    [root * 2, -8],
    [root * 2, 8],
    [root * 3, 0],
  ]) {
    voice({
      type: "sawtooth",
      freq,
      detune,
      at: flavor.swellFrom,
      attack: swellLength,
      length: swellLength + 0.06,
      peak: flavor.swell,
      cutoff: [120, 1400],
    });
  }

  // The hit(s): a dropping sub boom and a quick punch, both saturated for extra bass, plus the rumble.
  for (const [offset, level] of flavor.hits) {
    const at = IMPACT + offset;
    voice({
      freq: root * 1.7,
      freqEnd: root * 0.55,
      at,
      length: 1.5,
      peak: 0.9 * level,
      to: bass,
    });
    voice({
      freq: root * 3.2,
      freqEnd: root,
      at,
      attack: 0.005,
      length: 0.3,
      peak: 0.6 * level,
      to: bass,
    });
    rumble(at, level);
  }

  // The gong rings out under everything.
  for (const [ratio, peak, length] of GONG) {
    voice({
      freq: root * 2 * ratio,
      at: IMPACT,
      attack: 0.005,
      length,
      peak: peak * flavor.gong,
    });
  }

  // The sustained chord: brass sliding up into its notes, or a slowly blooming pad with vibrato.
  for (const ratio of flavor.chord) {
    const freq = root * 2 * ratio;
    if (flavor.brass) {
      voice({
        type: "sawtooth",
        freq,
        at: IMPACT + 0.02,
        attack: 0.12,
        length: 2.8,
        peak: flavor.brass,
        cutoff: [1100, 300],
        scoop: flavor.scoop,
      });
    }
    if (flavor.pad) {
      for (const detune of [-6, 6]) {
        voice({
          type: "triangle",
          freq: freq * 2,
          detune,
          at: IMPACT - 0.25,
          attack: 0.6,
          length: 3.2,
          peak: flavor.pad,
          vibrato: true,
        });
      }
    }
  }

  return () => {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0, now, 0.05);
  };
}

/**
 * Plays a synthesized sound as the archetype lands, tuned to `persona` (the archetype id), when sound is on (the speaker
 * button is not muted). Browsers only allow audio after a click, tap or key press on the page, so until then the reveal is silent.
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

    let ctx = null;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;

    const stop = () => {
      stopRef.current?.();
      stopRef.current = null;
    };
    const play = () => {
      stop();
      if (onRef.current && ctx?.state === "running") stopRef.current = playReveal(ctx, persona, readVolume());
    };
    const unlock = () => {
      ctx ??= new Context();
      if (ctx.state === "suspended") ctx.resume();
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
      ctx?.close();
    };
  }, [persona]);

  // Nothing to see: the speaker button is the control. This only marks where the archetype slide is.
  return <span ref={anchorRef} hidden />;
}
