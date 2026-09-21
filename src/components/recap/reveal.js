import { loudness } from "@/lib/soundSetting";
import { ROOT } from "./ambient";

// The archetype reveal, synthesized with the Web Audio API. It is written to sit inside the soundtrack (ambient.js), not on top of it:
// every note is a just-intonation ratio on the pad's own root (A2) taken from its scale, the tones are the same soft sines and triangles
// the pad is made of, and it plays through the same context. So it reads as the pad blooming, whatever archetype it is for.

// The hit lands with the flash and shockwave in slides.module.css (seconds after the slide becomes active).
export const IMPACT = 0.6;

// The bells' base note, an octave over the pad's root (A3).
const BELL = ROOT * 2;

/**
 * The notes every motif is made of, as ratios on the root inside one octave: A, C, D, E, G (A minor pentatonic). The pad plays A, C
 * and E, and D and G are the two notes of the scale that sound right over that drone. Nothing outside these can clash with it.
 */
export const SCALE = [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5];

/**
 * Four flavors, one per family of archetypes.
 * - motifs: the notes of the phrase, as ratios on the bell note (any octave). One is picked per archetype. The last note is where
 *   the phrase resolves, so it is always the root or the fifth.
 * - gap: seconds between the notes.  - forward: the phrase starts at the hit instead of leading into it.
 * - bell: how loud the bells are.  - thump: the low hit under the impact (0 for none).
 * - bloom: how loud the chord that swells in under the hit is.  - whoosh: the breath of noise leading in.
 * - wet: how much of the sound goes through the reverb.  - drums: [seconds relative to the hit, strength, pitch ratio on the root].
 */
const FLAVORS = {
  // A rising, open phrase that lands high: the victory.
  heroic: { motifs: [[1, 3 / 2, 2, 3], [6 / 5, 3 / 2, 2, 3], [1, 6 / 5, 3 / 2, 2]], gap: 0.15, bell: 0.16, thump: 0.55, bloom: 0.07, whoosh: 0.05, wet: 0.3 },
  // Tighter and lower, with a heavier hit.
  fierce: { motifs: [[1, 6 / 5, 3 / 2], [1, 4 / 3, 3 / 2], [3 / 2, 6 / 5, 1]], gap: 0.1, bell: 0.14, thump: 1, bloom: 0.05, whoosh: 0.07, wet: 0.2 },
  // High, slow and shimmering, with a lot of room.
  arcane: { motifs: [[2, 3, 4], [2, 12 / 5, 3], [3, 4, 6]], gap: 0.2, bell: 0.12, thump: 0.3, bloom: 0.09, whoosh: 0.04, wet: 0.65 },
  // Drums rolling into the hit, then the bells.
  primal: { motifs: [[1, 3 / 2], [3 / 2, 2], [1, 2]], gap: 0.13, forward: true, bell: 0.15, thump: 0.8, bloom: 0.06, whoosh: 0, wet: 0.25, drums: [[-0.36, 0.5, 1], [-0.18, 0.65, 3 / 4], [0, 1, 1 / 2]] },
};

const FLAVOR_OF = {
  fierce: ["slayer", "daredevil", "showstopper", "heavyhitter", "opener", "assassin", "brawler", "streaker", "thief"],
  arcane: ["archmage", "onetrick", "specialist", "chameleon", "centerpiece", "explorer", "scout"],
  primal: ["pathfinder", "islander", "demolisher", "farmer", "marathoner", "speedrunner", "phoenix"],
};

export function flavorFor(personaId) {
  const name = Object.keys(FLAVOR_OF).find((key) => FLAVOR_OF[key].includes(personaId)) ?? "heroic";
  return FLAVORS[name];
}

/** The phrase for an archetype: one of its flavor's motifs, always the same one for the same archetype. */
export function motifFor(personaId) {
  const { motifs } = flavorFor(personaId);
  return motifs[[...personaId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % motifs.length];
}

// A bell is a soft fundamental with two quieter harmonics that die away sooner: [multiple of the pitch, volume, share of the length].
const PARTIALS = [[1, 1, 1], [2, 0.32, 0.55], [3, 0.1, 0.3]];

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// A room: noise that dies away, which turns any sound sent through it into that sound ringing in a hall.
function reverb(ctx, seconds) {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const room = ctx.createConvolver();
  room.buffer = buffer;
  return room;
}

/**
 * Plays the reveal for an archetype: a short phrase of bells that leads into the hit, a low note on the pad's root under it, and a chord that
 * blooms out of the pad and fades back into it. Returns a function that fades it out.
 */
export function playReveal(ctx, personaId, volume) {
  const flavor = flavorFor(personaId);
  const motif = motifFor(personaId);

  const t0 = ctx.currentTime + 0.03;
  const master = ctx.createGain();
  master.gain.value = 1.2 * loudness(volume);
  const limiter = ctx.createDynamicsCompressor();
  master.connect(limiter).connect(ctx.destination);

  const room = reverb(ctx, 2.4);
  const send = ctx.createGain();
  send.gain.value = flavor.wet;
  send.connect(room).connect(master);

  // One tone: it rises to `peak` in `attack` seconds and dies away over `length`. `wet` sends it through the room as well.
  const tone = ({ type = "sine", freq, freqEnd, at = 0, attack = 0.006, length, peak, detune = 0, cutoff, wet = true }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t0 + at);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + at + Math.min(length, 0.5));
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + length);
    let out = osc;
    if (cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      osc.connect(filter);
      out = filter;
    }
    out.connect(gain);
    gain.connect(master);
    if (wet) gain.connect(send);
    osc.start(t0 + at);
    osc.stop(t0 + at + length + 0.05);
  };

  const bell = (freq, at, peak, length) => {
    for (const [multiple, level, share] of PARTIALS) tone({ freq: freq * multiple, at, peak: peak * level, length: length * share });
  };

  // The phrase. Each note is a little louder than the one before, and the last one rings on.
  motif.forEach((ratio, i) => {
    const last = i === motif.length - 1;
    const at = flavor.forward ? IMPACT + flavor.gap * i : IMPACT - flavor.gap * (motif.length - 1 - i);
    bell(BELL * ratio, at, flavor.bell * (0.55 + 0.45 * (i / Math.max(1, motif.length - 1))), last ? 2.8 : 1.4);
  });

  // Drums (primal): sine toms that drop a little in pitch, tuned to notes of the pad's chord.
  for (const [offset, level, ratio] of flavor.drums ?? []) {
    tone({ freq: ROOT * ratio * 1.5, freqEnd: ROOT * ratio, at: IMPACT + offset, attack: 0.004, length: 0.55, peak: 0.55 * level, wet: false });
  }

  // The hit: the pad's own root, an octave down and dropping to the octave below, so it lands on the drone's note.
  if (flavor.thump > 0) tone({ freq: ROOT, freqEnd: ROOT / 2, at: IMPACT, attack: 0.008, length: 1.3, peak: 0.5 * flavor.thump, wet: false });
  // A low pedal on the root that rings under the whole thing.
  tone({ freq: ROOT, at: IMPACT, attack: 0.02, length: 3.2, peak: 0.16, wet: false });

  // The breath leading in, like the slide-change sound but longer: noise that sweeps up and is cut off by the hit.
  if (flavor.whoosh > 0) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, IMPACT);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(300, t0);
    filter.frequency.exponentialRampToValueAtTime(2600, t0 + IMPACT);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(flavor.whoosh, t0 + IMPACT * 0.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + IMPACT + 0.05);
    source.connect(filter).connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  // The bloom: the chord the pad is already playing (A, E, A, C), swelling up to the hit and fading back into the pad.
  for (const ratio of [1, 3 / 2, 2, 12 / 5]) {
    for (const detune of [-5, 5]) {
      tone({ type: "triangle", freq: BELL * ratio, detune, at: IMPACT - 0.45, attack: 0.5, length: 3.4, peak: flavor.bloom / 2, cutoff: 1800 });
    }
  }

  return () => {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0, now, 0.05);
  };
}
