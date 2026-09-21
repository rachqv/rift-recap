"use client";

import { useSyncExternalStore } from "react";
import { Reveal } from "./Slide";
import styles from "./LiveStreak.module.css";

const subscribe = () => () => {};

/**
 * A note about a losing streak you are on right now. The recap page is drawn on the server and cached, so it cannot know how long
 * ago your last game was; the browser can. The words are written by the server (`children`, `label`); this only decides whether
 * to show them: until `until` (epoch ms), and not at all on the server render.
 */
export default function LiveStreak({ until, stop, label, children }) {
  const live = useSyncExternalStore(subscribe, () => Date.now() <= until, () => false);
  if (!live) return null;
  return (
    <Reveal i={1} as="p" className={styles.live} data-stop={stop}>
      <b>{label}</b> {children}
    </Reveal>
  );
}
