import styles from "./WinClock.module.css";

/**
 * One row of win-rate bars, one per bucket: a bar as tall as the win rate, with a dashed line at your overall rate, the value
 * above and the name and game count below. A bucket with too few games has no bar, only an outline, and each has a text
 * alternative for screen readers. Used by the time-of-day and weekday charts and by the patch chart; it has no state, so it
 * works in server and client components alike.
 *
 * - `buckets`: `[{ key, games, wins, rate }]` (`rate` null when there are too few games)
 * - `label(bucket)`: the name shown under a bar
 * - `highlight`: `{ best, worst }` (bucket objects from `buckets`) or null, so the extremes get a color
 * - `average`: your overall win rate, 0 to 1
 */
export default function WinBars({ title, buckets, label, highlight, average, t }) {
  return (
    <div className={styles.group}>
      <h3 className={styles.title}>{title}</h3>
      <ul className={styles.bars} style={{ "--count": buckets.length, "--average": average }} aria-label={title}>
        {buckets.map((bucket, i) => {
          const name = label(bucket);
          const tone = highlight?.best === bucket ? "best" : highlight?.worst === bucket ? "worst" : undefined;
          const rated = bucket.rate != null;
          const detail = t("heatmap.dayGames", { games: bucket.games, wins: bucket.wins });
          return (
            <li key={bucket.key} className={styles.column} data-tone={tone} data-rated={rated} style={{ "--rate": bucket.rate ?? 0, "--i": i }}>
              <span className={styles.sr}>
                {rated ? t("heatmap.clock.bar", { label: name, rate: t.percent(bucket.rate), detail }) : t("heatmap.clock.barFew", { label: name, detail })}
              </span>
              <span className={styles.value} aria-hidden="true">
                {rated ? t.percent(bucket.rate) : "·"}
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.bar} />
              </span>
              <span className={styles.name} aria-hidden="true">
                {name}
              </span>
              <small className={styles.games} aria-hidden="true">
                {bucket.games}
              </small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
