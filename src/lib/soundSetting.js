// The sound settings: one on/off switch and one volume.
//
// The switch: the speaker button (mute and unmute). It covers the slideshow's ambient pad, the soft sound when a slide changes and
// the archetype reveal on the last slide. Off by default, and remembered in this browser. Shaped for useSyncExternalStore.

const KEY = "rift-recap:music";
const EVENT = "rift-recap:music-change";

export function subscribeSound(listener) {
  window.addEventListener("storage", listener); // changes from other tabs
  window.addEventListener(EVENT, listener); // changes from this tab
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}

export function readSound() {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false; // storage blocked: sound simply stays off
  }
}

export const readSoundOnServer = () => false;

export function writeSound(on) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Not remembered; the switch still works for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

// The volume: 0 to 1 as the slider shows it, remembered in this browser. It scales everything the switch turns on.
const VOLUME_KEY = "rift-recap:volume";
const VOLUME_EVENT = "rift-recap:volume-change";
export const DEFAULT_VOLUME = 0.75;

export function subscribeVolume(listener) {
  window.addEventListener("storage", listener);
  window.addEventListener(VOLUME_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(VOLUME_EVENT, listener);
  };
}

export function readVolume() {
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export const readVolumeOnServer = () => DEFAULT_VOLUME;

export function writeVolume(value) {
  const volume = Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * 100) / 100;
  try {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Not remembered; the slider still works for this visit.
  }
  window.dispatchEvent(new Event(VOLUME_EVENT));
}

/** How loud the slider position is. Squared, because ears hear loudness on a curve: halfway on the slider sounds about half as loud. */
export const loudness = (volume) => volume * volume;
