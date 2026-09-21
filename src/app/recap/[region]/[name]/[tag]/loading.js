import Background from "@/components/Background";
import { getT } from "@/lib/i18n/server";
import styles from "./loading.module.css";

export default async function Loading() {
  const t = await getT();
  const LINES = [1, 2, 3, 4].map((n) => t(`common.loading.recap${n}`));
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
          {LINES.map((line, i) => (
            <p key={line} className={styles.line} style={{ animationDelay: `${i * 2.5}s` }}>
              {line}
            </p>
          ))}
        </div>
      </main>
    </>
  );
}
