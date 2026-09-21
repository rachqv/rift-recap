import styles from "./versus.module.css";

/**
 * The cards for a group of head-to-head scenarios (from `pickScenarios`): each player's number on either side, the
 * scenario in the middle, and the one-liner underneath. Player A is gold and B teal, like everywhere else.
 * `label` names the list for screen readers. No server-only imports here: the client-side rhythm slide draws these too.
 */
export default function ScenarioRows({ scenarios, label = "Scenarios" }) {
  return (
    <div className={styles.rows} role="list" aria-label={label}>
      {scenarios.map((s) => (
        <div key={s.id} className={`${styles.row} ${styles.scenario}`} data-winner={s.winner} role="listitem">
          <span className={styles.valueA}>{s.aShow}</span>
          <div className={styles.mid}>
            <span className={styles.scenarioTitle}>
              <span aria-hidden="true">{s.icon}</span> {s.title}
            </span>
            <span className={styles.scenarioTagline}>{s.tagline}</span>
            <div className={styles.bar} aria-hidden="true">
              <span data-side="a" style={{ width: `${Math.round(s.aShare * 100)}%` }} />
              <span data-side="b" />
            </div>
            <span className={styles.scenarioLine}>{s.line}</span>
          </div>
          <span className={styles.valueB}>{s.bShow}</span>
        </div>
      ))}
    </div>
  );
}
