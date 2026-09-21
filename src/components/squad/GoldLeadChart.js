"use client";

import { useId, useState } from "react";
import { useT } from "@/lib/i18n/client";
import styles from "./versus.module.css";

// One curve, one axis: A's gold lead over B, minute by minute. Above the zero line A is ahead (gold), below it B is
// (teal). The two sides' colors match every other slide, and the names sit beside the readout so color is never the only
// way to tell them apart.
const SIDE = { a: "#e0b458", b: "#0ac8b9" };
const W = 600;
const H = 220;
const PAD = { left: 44, right: 14, top: 14, bottom: 26 };

const gold = (t, n) => t.number(Math.abs(Math.round(n)));
const k = (t, n) => (n === 0 ? "0" : `${n > 0 ? "+" : "−"}${t.number(Math.abs(n), { notation: "compact", maximumFractionDigits: 1 })}`);

/** A round step (1k, 2k, 5k...) so the axis has one or two clean ticks either side of zero. */
function niceStep(max) {
  for (const step of [500, 1000, 2000, 5000, 10000]) if (max / step <= 2.2) return step;
  return 10000;
}

/** `points` is `[{ minute, diff }]` from `buildTimelineDuel`'s `curve`; `aName`/`bName` label the two sides. */
export default function GoldLeadChart({ points, aName, bName, aWon }) {
  const t = useT();
  const id = useId();
  const [hover, setHover] = useState(null);

  const step = niceStep(Math.max(...points.map((p) => Math.abs(p.diff)), 500));
  const limit = Math.ceil(Math.max(...points.map((p) => Math.abs(p.diff)), 1) / step) * step;
  const lastMinute = points.at(-1).minute;
  const x = (minute) => PAD.left + (minute / lastMinute) * (W - PAD.left - PAD.right);
  const y = (diff) => PAD.top + ((limit - diff) / (2 * limit)) * (H - PAD.top - PAD.bottom);
  const zero = y(0);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.minute).toFixed(1)} ${y(p.diff).toFixed(1)}`).join(" ");
  const area = `${line} L${x(lastMinute).toFixed(1)} ${zero} L${x(points[0].minute).toFixed(1)} ${zero} Z`;
  const ticks = [-limit, -limit / 2, 0, limit / 2, limit].filter((tick, i, all) => all.indexOf(tick) === i && Math.abs(tick) % (step / 2 || 1) === 0);
  const minuteTicks = Array.from({ length: Math.floor(lastMinute / 5) + 1 }, (_, i) => i * 5);

  const shown = hover != null ? points[hover] : points.at(-1);
  const leader = shown.diff === 0 ? null : shown.diff > 0 ? ["a", aName] : ["b", bName];

  function onMove(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const minute = ((event.clientX - box.left) / box.width) * W;
    const ratio = (minute - PAD.left) / (W - PAD.left - PAD.right);
    setHover(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  }

  return (
    <figure className={styles.goldChart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("chart.aria", { a: aName, b: bName, result: leader ? t("chart.aheadEnd", { name: leader[1], gold: gold(t, shown.diff) }) : t("chart.levelEnd") })} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <clipPath id={`${id}-above`}>
            <rect x="0" y="0" width={W} height={zero} />
          </clipPath>
          <clipPath id={`${id}-below`}>
            <rect x="0" y={zero} width={W} height={H - zero} />
          </clipPath>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? styles.chartZero : styles.chartGrid} />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className={styles.chartTick}>
              {k(t, tick)}
            </text>
          </g>
        ))}
        {minuteTicks.map((m) => (
          <text key={m} x={x(m)} y={H - 6} textAnchor="middle" className={styles.chartTick}>
            {m}
          </text>
        ))}

        <path d={area} fill={SIDE.a} fillOpacity="0.32" clipPath={`url(#${id}-above)`} />
        <path d={area} fill={SIDE.b} fillOpacity="0.32" clipPath={`url(#${id}-below)`} />
        <path d={line} fill="none" stroke="#f0e6d2" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* The marker follows the pointer, or sits on the final minute. Ringed in the surface color so it never melts into the line. */}
        <line x1={x(shown.minute)} x2={x(shown.minute)} y1={PAD.top} y2={H - PAD.bottom} className={styles.chartCursor} data-active={hover != null} />
        <circle cx={x(shown.minute)} cy={y(shown.diff)} r="5" fill={leader ? SIDE[leader[0]] : "#f0e6d2"} stroke="#050b18" strokeWidth="2" />
      </svg>

      <figcaption className={styles.chartReadout}>
        <span>{t.rich("chart.minute", { minute: shown.minute, b: (chunks) => <b>{chunks}</b> })}</span>
        {leader ? (
          <span>
            <i style={{ background: SIDE[leader[0]] }} aria-hidden="true" />
            {t.rich("chart.ahead", { name: leader[1], gold: gold(t, shown.diff), b: (chunks) => <b>{chunks}</b> })}
          </span>
        ) : (
          <span>{t("chart.level")}</span>
        )}
        <span className={styles.chartResult}>{t("chart.won", { name: aWon ? aName : bName })}</span>
      </figcaption>
    </figure>
  );
}
