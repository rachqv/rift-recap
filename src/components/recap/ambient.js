import { loudness } from "@/lib/soundSetting";

// The page's sounds, all synthesized with the Web Audio API (no audio files). The soundtrack is a slow, quiet pad: a few sine and
// triangle voices on a minor-add9 chord, with a low drone under them and a slow filter sweep so it breathes.

const ROOT = 110; // A2
// Semitone offsets from the root: root, fifth, octave, minor third, ninth. Each becomes one voice.
const VOICES = [
  { ratio: 1, gain: 0.07, type: "sine" },
  { ratio: 3 / 2, gain: 0.05, type: "sine" },
  { ratio: 2, gain: 0.05, type: "triangle" },
  { ratio: 12 / 5, gain: 0.03, type: "sine" },
  { ratio: 3, gain: 0.025, type: "triangle" },
];
// The pad's level at full volume. Well up from the first version, which was too quiet to hear over a speaker; the default
// slider position (0.75) plays it at about 56% of this, and there is headroom above that.
const PAD_LEVEL = 2.1;
const FADE = 1.6; // seconds

/**
 * Starts the pad on an `AudioContext` at `volume` (the slider, 0 to 1). Returns `{ stop, setVolume }`: `stop()` fades it out
 * and cleans up, and `setVolume(v)` follows the slider while it plays. The context must already be running (browsers only
 * start audio after a click, tap or key press).
 */
export function startAmbient(ctx, volume) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(PAD_LEVEL * loudness(volume), now + FADE);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  filter.connect(master);
  master.connect(ctx.destination);

  // The filter opens and closes slowly, so the pad swells instead of sitting still.
  const sweep = ctx.createOscillator();
  const sweepDepth = ctx.createGain();
  sweep.frequency.value = 0.07;
  sweepDepth.gain.value = 380;
  sweep.connect(sweepDepth);
  sweepDepth.connect(filter.frequency);
  sweep.start(now);

  const oscillators = [sweep];
  for (const [i, voice] of VOICES.entries()) {
    // Two slightly detuned copies of every voice make a soft chorus instead of a pure tone.
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = voice.type;
      osc.frequency.value = ROOT * voice.ratio;
      osc.detune.value = detune;
      gain.gain.value = voice.gain / 2;
      // Each voice drifts in and out on its own slow cycle.
      const tremolo = ctx.createOscillator();
      const tremoloDepth = ctx.createGain();
      tremolo.frequency.value = 0.05 + i * 0.023;
      tremoloDepth.gain.value = voice.gain / 3;
      tremolo.connect(tremoloDepth);
      tremoloDepth.connect(gain.gain);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      tremolo.start(now);
      oscillators.push(osc, tremolo);
    }
  }

  function setVolume(next) {
    const at = ctx.currentTime;
    master.gain.cancelScheduledValues(at);
    master.gain.setValueAtTime(master.gain.value, at);
    master.gain.linearRampToValueAtTime(PAD_LEVEL * loudness(next), at + 0.1);
  }

  function stop() {
    const at = ctx.currentTime;
    master.gain.cancelScheduledValues(at);
    master.gain.setValueAtTime(master.gain.value, at);
    master.gain.linearRampToValueAtTime(0, at + FADE);
    for (const osc of oscillators) {
      try {
        osc.stop(at + FADE + 0.1);
      } catch {
        // Already stopped.
      }
    }
  }

  return { stop, setVolume };
}

/**
 * A soft "turning the page" sound for a slide change: a short, filtered breath of noise that sweeps upward, with a faint
 * tone under it. Kept soft, since it can happen every few seconds. Plays once and cleans itself up.
 */
export function playSlideChange(ctx, volume) {
  const level = loudness(volume);
  if (level < 0.01) return; // the slider is all the way down
  const now = ctx.currentTime;
  const length = 0.38;

  const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = noise;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(420, now);
  filter.frequency.exponentialRampToValueAtTime(2600, now + length * 0.7);

  const breath = ctx.createGain();
  breath.gain.setValueAtTime(0.0001, now);
  breath.gain.exponentialRampToValueAtTime(0.2 * level, now + 0.09);
  breath.gain.exponentialRampToValueAtTime(0.0001, now + length);
  source.connect(filter);
  filter.connect(breath);
  breath.connect(ctx.destination);

  const tone = ctx.createOscillator();
  const toneGain = ctx.createGain();
  tone.type = "sine";
  tone.frequency.setValueAtTime(392, now);
  tone.frequency.exponentialRampToValueAtTime(587, now + 0.22);
  toneGain.gain.setValueAtTime(0.0001, now);
  toneGain.gain.exponentialRampToValueAtTime(0.08 * level, now + 0.05);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  tone.connect(toneGain);
  toneGain.connect(ctx.destination);

  source.start(now);
  tone.start(now);
  tone.stop(now + 0.32);
}
