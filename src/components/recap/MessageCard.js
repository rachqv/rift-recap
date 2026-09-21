import Link from "next/link";
import { defaultT } from "@/lib/i18n/en";
import styles from "./RecapMessage.module.css";

/**
 * The card itself: a title, some text, optional `actions` (anything that belongs between the text and the button, such as a
 * way to try another time range), an optional `retry` (`{ label, onClick }`, for a failure that may pass) and a way back to
 * the search.
 */
export function MessageCard({ title, children, actions, retry, t = defaultT }) {
  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.text}>{children}</p>
      {actions}
      {retry && (
        <button type="button" className={styles.retry} onClick={retry.onClick}>
          {retry.label}
        </button>
      )}
      <Link href="/" className={styles.button}>
        {t("common.message.tryAnother")}
      </Link>
    </div>
  );
}

/** The card centred on a full screen, over a `backdrop`. */
export function MessageScreen({ backdrop, ...card }) {
  return (
    <>
      {backdrop}
      <main className={styles.main}>
        <MessageCard {...card} />
      </main>
    </>
  );
}
