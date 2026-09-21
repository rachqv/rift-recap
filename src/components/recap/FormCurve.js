import { defaultT } from "@/lib/i18n/en";
import { curveShape } from "@/lib/recap/formcurve";
import { boldTags } from "./slides";
import base from "./slides.module.css";
import styles from "./FormCurve.module.css";

// Your rolling win rate as a line, with the best stretch, the worst stretch and the latest one marked. The dots are only
// colored markers: the same three values are written in the chips underneath, with the date each stretch ended, so color is
// never the only way to read it.
const W = 600;
const H = 220;
const PAD = { left: 44, right: 14, top: 14, bottom: 14 };
const DOT = { worst: "#ff6b7d", best: "#3ddc97", now: "#f0d9a0" };

/** `curve` is from `getFormCurve`. */
export default function FormCurve({ curve, t = defaultT }) {
  const { best, worst, now } = curve;
  const shape = curveShape(curve, { width: W, height: H, pad: PAD });
  const date = (at) => t.date(at, { month: "short", day: "numeric", timeZone: "UTC" });
  const pct = (rate) => t.percent(rate);

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={t("recap.formcurve.aria", { best: pct(best.rate), worst: pct(worst.rate), now: pct(now.rate) })}>
        <defs>
          <linearGradient id="formArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ac8b9" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#0ac8b9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {shape.ticks.map((tick) => (
          <g key={tick.percent} aria-hidden="true">
            <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={tick.y} y2={tick.y} />
            <text className={styles.tick} x={PAD.left - 8} y={tick.y} textAnchor="end" dominantBaseline="middle">
              {pct(tick.percent / 100)}
            </text>
          </g>
        ))}
        <path className={styles.area} d={shape.area} aria-hidden="true" />
        <line className={styles.average} x1={PAD.left} x2={W - PAD.right} y1={shape.average} y2={shape.average} aria-hidden="true" />
        <path className={styles.line} data-bar style={{ "--off": 0 }} d={shape.line} pathLength="100" aria-hidden="true" />
        <g className={styles.dots} data-reveal aria-hidden="true">
          {["worst", "best", "now"].map((kind) => (
            <circle key={kind} cx={shape.marks[kind].x} cy={shape.marks[kind].y} r="6.5" fill={DOT[kind]} />
          ))}
        </g>
      </svg>
      <div className={base.chips}>
        <span className={base.chip}>
          <i className={styles.key} style={{ background: DOT.best }} aria-hidden="true" />
          {t.rich("recap.formcurve.best", { rate: pct(best.rate), date: date(best.at), ...boldTags })}
        </span>
        <span className={base.chip}>
          <i className={styles.key} style={{ background: DOT.worst }} aria-hidden="true" />
          {t.rich("recap.formcurve.worst", { rate: pct(worst.rate), date: date(worst.at), ...boldTags })}
        </span>
        <span className={base.chip}>
          <i className={styles.key} style={{ background: DOT.now }} aria-hidden="true" />
          {t.rich("recap.formcurve.now", { rate: pct(now.rate), ...boldTags })}
        </span>
      </div>
    </figure>
  );
}
