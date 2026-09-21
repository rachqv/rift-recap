"use client";

import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import styles from "./ShareButtons.module.css";

const subscribe = () => () => {};
const hasNativeShare = () => typeof navigator.share === "function";

/**
 * Copies text to the clipboard. `navigator.clipboard` only exists on secure origins (https or localhost), so
 * on plain http, such as opening the dev server from a phone over the LAN, fall back to a hidden textarea.
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(area);
    area.select();
    try {
      return document.execCommand("copy");
    } finally {
      area.remove();
    }
  }
}

// The recap's own link, without the `#slide` the address bar carries: sharing the recap opens it at the start.
const pageUrl = () => window.location.href.split("#")[0];

// The card is drawn in the language of the page it belongs to (a link preview has no cookie to say which).
const withFormat = (url, format, locale) => `${url}${url.includes("?") ? "&" : "?"}format=${format}&lang=${locale}`;

/**
 * Share row for the final slide: share sheet (phones), download the card, copy the page link.
 * `cardUrl` is the path of the card route, without a format. `format` is which card to draw ("story" by default; the trophy
 * slide asks for "bingo") and `filename` is what a download or a shared picture is called.
 */
export default function ShareButtons({ cardUrl, title, format = "story", filename = "rift-recap.png" }) {
  const t = useT();
  const [message, setMessage] = useState("");
  // Whether the browser has a native share sheet; false on the server and on most desktop browsers.
  const nativeShare = useSyncExternalStore(subscribe, hasNativeShare, () => false);

  function flash(text) {
    setMessage(text);
    setTimeout(() => setMessage(""), 2400);
  }

  async function share() {
    const url = pageUrl();
    try {
      // Sharing the picture itself works best on phones; otherwise fall back to sharing the link.
      const response = await fetch(withFormat(cardUrl, format, t.locale));
      if (response.ok) {
        const file = new File([await response.blob()], filename, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title, text: title, url });
          return;
        }
      }
      await navigator.share({ title, text: title, url });
    } catch (error) {
      if (error.name !== "AbortError") flash(t("share.shareFailed"));
    }
  }

  async function copyLink() {
    flash((await copyText(pageUrl())) ? t("share.linkCopied") : t("share.copyFailed"));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {nativeShare && (
          <button type="button" className={styles.primary} onClick={share}>
            {t("share.share")}
          </button>
        )}
        <a className={nativeShare ? styles.button : styles.primary} href={withFormat(cardUrl, format, t.locale)} download={filename}>
          {t("share.download")}
        </a>
        <button type="button" className={styles.button} onClick={copyLink}>
          {t("share.copyLink")}
        </button>
      </div>
      <p className={styles.status} role="status">
        {message}
      </p>
    </div>
  );
}
