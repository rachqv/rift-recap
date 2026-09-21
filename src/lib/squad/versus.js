import { defaultT } from "@/lib/i18n/en";
import { buildSummary } from "@/lib/recap/summary";

// Head-to-head: two players' recaps compared row by row.

// How a value reads: "percent", "int" (with separators), or a number of decimals. Done in the reader's language.
const format = (show, value, t) => (show === "percent" ? t.percent(value) : show === "int" ? t.number(Math.round(value)) : t.fixed(value, show));

// A row is a tie when the two values are within this relative distance: 40.1 vs 40.4 isn't a real difference.
const TIE_MARGIN = 0.03;

// `key` is also the name of the row's label in `versus.rows`. `higher` is true when a bigger number is better. `null` values (missing data) are skipped.
const ROWS = [
  { key: "winRate", higher: true, value: (r) => r.winRate, show: "percent" },
  { key: "kda", higher: true, value: (r) => r.kda, show: 2 },
  { key: "kills", higher: true, value: (r) => r.perGame.kills, show: 1 },
  { key: "deaths", higher: false, value: (r) => r.perGame.deaths, show: 1 },
  { key: "assists", higher: true, value: (r) => r.perGame.assists, show: 1 },
  { key: "cs", higher: true, value: (r) => r.csPerMin, show: 1 },
  { key: "vision", higher: true, value: (r) => r.visionPerMin, show: 2 },
  { key: "damage", higher: true, value: (r) => r.damagePerMin, show: "int" },
  { key: "kp", higher: true, value: (r) => r.killParticipation, show: "percent" },
];

/** One row of the comparison for values `x` (A) and `y` (B), or null when either is missing. */
function compareRow(def, x, y, t) {
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  const spread = Math.max(Math.abs(x), Math.abs(y));
  const close = spread === 0 || Math.abs(x - y) / spread < TIE_MARGIN;
  const better = def.higher ? x > y : x < y;
  return {
    key: def.key,
    label: t(`versus.rows.${def.key}`),
    a: x,
    b: y,
    aShow: format(def.show, x, t),
    bShow: format(def.show, y, t),
    // Bars compare the two values directly; for "lower is better" rows the smaller number gets the longer bar.
    aShare: x + y === 0 ? 0.5 : def.higher ? x / (x + y) : y / (x + y),
    winner: close ? "tie" : better ? "a" : "b",
  };
}

/**
 * @param a, b recaps from `buildRecap`
 * @returns `{ rows, score, winner }`. Each row: `{ key, label, a, b, aShow, bShow, aShare, winner: "a" | "b" | "tie" }`
 * where `aShare` (0-1) sizes the bars. `winner` overall is whoever takes more rows.
 */
export function compareRecaps(a, b, t = defaultT) {
  const rows = ROWS.map((def) => compareRow(def, def.value(a), def.value(b), t)).filter(Boolean);

  const score = { a: 0, b: 0, ties: 0 };
  for (const row of rows) {
    if (row.winner === "tie") score.ties++;
    else score[row.winner]++;
  }
  return { rows, score, winner: score.a === score.b ? "tie" : score.a > score.b ? "a" : "b" };
}

/** A squad member's stats (from `buildSquadStats`) in the shape of a recap, so both can share `compareRecaps`. */
export function memberAsRecap(m) {
  return {
    winRate: m.winRate,
    kda: m.kda,
    perGame: { kills: m.perGame.kills, deaths: m.perGame.deaths, assists: m.perGame.assists },
    csPerMin: m.perMin.cs,
    visionPerMin: m.perMin.vision,
    damagePerMin: m.perMin.damage,
    killParticipation: m.killParticipation,
  };
}

/** One line summing up the result. `an` and `bn` are the players' names. */
export function verdictLine(comparison, an, bn, t = defaultT) {
  const { score, winner } = comparison;
  if (winner === "tie") return t("versus.verdict.tie", { score: score.a });
  const [win, lose] = winner === "a" ? [an, bn] : [bn, an];
  const [hi, lo] = winner === "a" ? [score.a, score.b] : [score.b, score.a];
  if (lo === 0) return t("versus.verdict.sweep", { name: win, other: lose });
  if (hi - lo >= 5) return t("versus.verdict.clear", { name: win, hi, lo });
  return t("versus.verdict.edge", { name: win, other: lose, hi, lo });
}

/** A loaded player (from `loadVersus`) plus the persona and rank the head-to-head slides and cards show. */
export function withSummary(loaded, index, t = defaultT) {
  const summary = buildSummary({ recap: loaded.recap, rankedEntries: loaded.rankedEntries, index }, t);
  return { ...loaded, persona: summary.persona, rank: summary.rank, games: loaded.recap.games };
}
