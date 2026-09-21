import Background from "@/components/Background";
import styles from "./LoadingScreen.module.css";

/** Full-screen loading state: a spinning hextech ring and a few lines of copy that take turns. Up to 4 lines. */
export default function LoadingScreen({ lines }) {
  return (
    <>
      <Background />
      <main className={styles.main} role="status" aria-live="polite">
        <div className={styles.loader}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <polygon className={styles.hexOuter} points="50,4 90,27 90,73 50,96 10,73 10,27" />
            <polygon className={styles.hexInner} points="50,22 74,36 74,64 50,78 26,64 26,36" />
          </svg>
        </div>
        <div className={styles.lines}>
          {lines.slice(0, 4).map((line, i) => (
            <p key={line} className={styles.line} style={{ animationDelay: `${i * 2.5}s` }}>
              {line}
            </p>
          ))}
        </div>
      </main>
    </>
  );
}
