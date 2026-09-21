import styles from "./SampleCards.module.css";

const BARS = [38, 52, 44, 66, 58, 80, 72, 92];

// Static sample data. These previews are decoration, not real player stats.
export default function SampleCards({ t }) {
  return (
    <div className={styles.fan} aria-label={t("home.sample.label")}>
      <article className={`${styles.card} ${styles.c1}`}>
        <span className={styles.label}>{t("home.sample.games")}</span>
        <strong className={styles.big}>{t.number(1247)}</strong>
        <span className={styles.hint}>{t("home.sample.days", { days: t.number(52) })}</span>
      </article>

      <article className={`${styles.card} ${styles.c2}`}>
        <span className={styles.label}>{t("home.sample.signature")}</span>
        <strong className={styles.big}>Ahri</strong>
        <div className={styles.meter}>
          <span style={{ width: "58%" }} />
        </div>
        <span className={styles.hint}>{t("home.sample.record", { games: t.number(214), winRate: t.number(0.58, { style: "percent" }) })}</span>
      </article>

      <article className={`${styles.card} ${styles.c3}`}>
        <span className={styles.label}>{t("home.sample.kda")}</span>
        <strong className={styles.big}>{t.number(3.84, { minimumFractionDigits: 2 })}</strong>
        <div className={styles.bars}>
          {BARS.map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </article>

      <article className={`${styles.card} ${styles.c4}`}>
        <span className={styles.label}>{t("home.sample.peak")}</span>
        <strong className={styles.big}>{t("home.sample.peakRank")}</strong>
        <span className={styles.hint}>{t("home.sample.climbed", { lp: t.number(312) })}</span>
      </article>
    </div>
  );
}
