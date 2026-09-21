import styles from "./Background.module.css";

// Deterministic "random" positions so server and client render identically.
const STARS = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: 1 + (i % 3),
  delay: (i * 0.37) % 6,
  duration: 3 + (i % 5),
}));

/**
 * The night-sky scene behind every page: glowing orbs, a grid, twinkling stars. `children` are extra layers under it (the home
 * page's champion slides). It has nothing that needs the server, so an error boundary can draw it too.
 */
export default function Backdrop({ children }) {
  return (
    <div className={styles.root} aria-hidden="true">
      {children}
      <div className={`${styles.orb} ${styles.orbGold}`} />
      <div className={`${styles.orb} ${styles.orbTeal}`} />
      <div className={`${styles.orb} ${styles.orbViolet}`} />
      <div className={styles.grid} />
      {STARS.map((s, i) => (
        <span
          key={i}
          className={styles.star}
          style={{
            "--depth": 6 + (i % 4) * 7,
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
      <div className={styles.vignette} />
    </div>
  );
}
