import { defaultT } from "@/lib/i18n/en";
import styles from "./ResultStrip.module.css";

/**
 * One dot per game, oldest first: green for a win, red for a loss. The dots pop in one after another when the slide
 * becomes active (see the CSS), so the season reads like a heartbeat. `results` is `[boolean]`.
 */
export default function ResultStrip({ results, t = defaultT }) {
  const wins = results.filter(Boolean).length;
  return (
    <div className={styles.strip} role="img" aria-label={t("recap.strip", { wins, losses: results.length - wins })}>
      {results.map((win, i) => (
        <span key={i} className={styles.pip} data-win={win} style={{ "--i": i }} aria-hidden="true" />
      ))}
    </div>
  );
}
