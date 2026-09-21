"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { copyText } from "./ShareButtons";
import styles from "./ShareButtons.module.css";

/**
 * Copies a link to this page with a saved snapshot in it (`?since=...`), so opening it later shows what changed.
 * `snapshot` is the already-encoded value from the server. The confirmation replaces the button's label for a moment,
 * so the button takes no more room than it already does. `className` swaps in another button look (a chip, say).
 */
export default function SaveSnapshot({ snapshot, label, className }) {
  const t = useT();
  const [state, setState] = useState("idle"); // idle | copied | failed

  async function save() {
    const url = new URL(window.location.href);
    url.searchParams.set("since", snapshot);
    url.hash = ""; // the link opens at the start, not on the slide this was pressed on
    setState((await copyText(url.toString())) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2600);
  }

  return (
    <button type="button" className={className ?? styles.button} style={className ? { fontFamily: "inherit", cursor: "pointer" } : undefined} onClick={save} aria-live="polite">
      {state === "copied" ? t("share.savedOpenLater") : state === "failed" ? t("share.copyFailed") : (label ?? t("share.saveLater"))}
    </button>
  );
}
