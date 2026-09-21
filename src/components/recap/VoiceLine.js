"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { loudness, readSound, readSoundOnServer, readVolume, readVolumeOnServer, subscribeSound, subscribeVolume } from "@/lib/soundSetting";

// MediaError code for "the file is missing or isn't audio the browser can play": what a 404 gives.
const MEDIA_SRC_NOT_SUPPORTED = 4;

// Plain helpers for the audio element, kept outside the component (the element lives in a ref).
function makeAudio(src) {
  const audio = new Audio(src);
  audio.preload = "none"; // nothing is downloaded until it is played
  return audio;
}

const volumeOf = (volume) => Math.min(1, 1.25 * loudness(volume)); // 0.7 at the default slider position

function setAudioVolume(audio, volume) {
  audio.volume = volumeOf(volume);
}

function playFromStart(audio, volume) {
  audio.currentTime = 0;
  audio.volume = volumeOf(volume);
  return audio.play();
}

function rewind(audio) {
  audio.pause();
  audio.currentTime = 0;
}

/**
 * A champion's voice line. It has no controls: when sound is on (the speaker button) it plays once as the slide comes into
 * view and stops when you leave. `src` is an audio file URL. Browsers may refuse the play until the page has been clicked
 * or a key pressed, and a file that can't be played (an unsupported format, the network) is simply skipped. Renders nothing;
 * it only marks which slide it belongs to.
 *
 * `fallback` is another URL to try when `src` turns out not to exist or not to be playable: the line in the language of the
 * page is preferred, and the English one is better than silence.
 */
export default function VoiceLine({ src, fallback = null }) {
  const anchorRef = useRef(null);
  const audioRef = useRef(null);

  const sound = useSyncExternalStore(subscribeSound, readSound, readSoundOnServer);
  const volume = useSyncExternalStore(subscribeVolume, readVolume, readVolumeOnServer);
  const soundRef = useRef(sound);
  const volumeRef = useRef(volume);
  useEffect(() => {
    soundRef.current = sound;
    volumeRef.current = volume;
    if (audioRef.current) setAudioVolume(audioRef.current, volume);
    if (!sound && audioRef.current) rewind(audioRef.current);
  }, [sound, volume]);

  useEffect(() => {
    const slide = anchorRef.current?.closest("[data-slide]");
    if (!slide) return;

    function play() {
      const audio = (audioRef.current ??= makeAudio(src));
      playFromStart(audio, volumeRef.current).catch(() => {
        // Only a file that can't be loaded is a reason to switch. The browser wanting a click first, or the slide being
        // left while the file loads, are not: the same line will be fine next time.
        const missing = audio.error?.code === MEDIA_SRC_NOT_SUPPORTED;
        if (!fallback || !missing || audio.getAttribute("src") !== src) return;
        audio.src = fallback;
        if (soundRef.current && slide.dataset.active === "true") playFromStart(audio, volumeRef.current).catch(() => {});
      });
    }
    function stop() {
      if (audioRef.current) rewind(audioRef.current);
    }

    const observer = new MutationObserver(() => {
      if (slide.dataset.active !== "true") stop();
      else if (soundRef.current) play();
    });
    observer.observe(slide, { attributes: true, attributeFilter: ["data-active"] });
    if (slide.dataset.active === "true" && soundRef.current) play();
    return () => {
      observer.disconnect();
      stop();
      audioRef.current = null;
    };
  }, [src, fallback]);

  return <span ref={anchorRef} hidden />;
}
