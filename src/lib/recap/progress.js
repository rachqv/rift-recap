import { defaultT } from "@/lib/i18n/en";
import { clampNumber, encodeSnapshot, readTime, round } from "@/lib/snapshot";
import { ladderScore } from "./rank";

// "Since last time": a recap can be saved as a small snapshot in a link, and opening the recap again with that link
// shows what changed. See `lib/snapshot.js` for how the value travels.

// How a stat is written: "percent", "int" (with separators) or a number of decimals. Done in the reader's language when shown.
const format = (show, value, t) => (show === "percent" ? t.percent(value) : show === "int" ? t.number(Math.round(value)) : t.fixed(value, show));

// `key` is the short name stored in the link (and the name of its label in `insights.progress.rows`). `higher` says whether a bigger number is better. `range` bounds what a
// link is allowed to claim.
const ROWS = [
  { key: "wr", higher: true, get: (r) => r.winRate, show: "percent", range: [0, 1] },
  { key: "kda", higher: true, get: (r) => r.kda, show: 2, range: [0, 100] },
  { key: "k", higher: true, get: (r) => r.perGame.kills, show: 1, range: [0, 50] },
  { key: "d", higher: false, get: (r) => r.perGame.deaths, show: 1, range: [0, 50] },
  { key: "a", higher: true, get: (r) => r.perGame.assists, show: 1, range: [0, 60] },
  { key: "cs", higher: true, get: (r) => r.csPerMin, show: 1, range: [0, 20] },
  { key: "vs", higher: true, get: (r) => r.visionPerMin, show: 2, range: [0, 10] },
  { key: "dm", higher: true, get: (r) => r.damagePerMin, show: "int", range: [0, 5000] },
  { key: "kp", higher: true, get: (r) => r.killParticipation, show: "percent", range: [0, 1] },
];

// A stat has to move by at least this fraction of where it was to count as a change rather than noise. Comparing two
// short periods (a week each) takes a bigger move than comparing a season with itself, since so few games sit behind each.
const FLAT = 0.03;
const FLAT_PERIODS = 0.1;

// Moving less than this on the ladder (about a quarter of a division) isn't a change worth calling.
const RANK_FLAT = 25;

/** The link value for a recap: `{ v, t, g, p, ...stats }`, encoded. `persona` is from `getPersona`, `rank` from `pickRank` (or null). */
export function recapSnapshot(recap, persona, rank = null) {
  const snapshot = { v: 1, t: Date.now(), g: recap.games, p: persona.id ?? persona.title };
  for (const row of ROWS) {
    const value = row.get(recap);
    if (value != null && Number.isFinite(value)) snapshot[row.key] = round(value);
  }
  if (rank) {
    snapshot.rk = ladderScore(rank);
    snapshot.rt = rank.tier ? [rank.tier, rank.division].filter(Boolean).join(" ") : rank.title;
  }
  return encodeSnapshot(snapshot);
}

/** Checks a decoded value and keeps only what is in range. Returns `{ time, games, persona, stats, rank }` (`rank` is `{ score, title }` or null) or null. */
export function readRecapSnapshot(raw) {
  if (!raw || raw.v !== 1) return null;
  const time = readTime(raw.t);
  const games = clampNumber(raw.g, 0, 100000);
  if (time == null || games == null) return null;

  const stats = {};
  for (const row of ROWS) {
    const value = clampNumber(raw[row.key], ...row.range);
    if (value != null) stats[row.key] = value;
  }
  if (Object.keys(stats).length < 3) return null;
  const rankScore = clampNumber(raw.rk, 0, 6000);
  const rank = rankScore != null && typeof raw.rt === "string" ? { score: rankScore, title: raw.rt.slice(0, 24) } : null;
  return { time, games, persona: typeof raw.p === "string" ? raw.p.slice(0, 40) : null, stats, rank };
}

/**
 * Compares a saved snapshot with a recap now. `rank` is today's `pickRank` result; with it (and a saved rank) the last
 * row is your rank.
 * @returns `{ rows, better, worse }` where each row is `{ key, label, before, after, mood }` with `before`/`after` already
 * formatted and `mood` "better", "worse" or "flat"; `better`/`worse` count the rows that moved.
 */
/** A saved archetype (an id, or the English title an older link holds) as words in the reader's language. */
export const savedPersonaTitle = (saved, t = defaultT) => (t.has(`persona.${saved}.title`) ? t(`persona.${saved}.title`) : saved);

/** A saved rank ("GOLD II", or an older link's "Gold II") as words in the reader's language. */
export function savedRankTitle(saved, t = defaultT) {
  const [tier, division] = String(saved).split(" ");
  const key = `common.tiers.${tier.toUpperCase()}`;
  if (!t.has(key)) return saved;
  return division ? t("common.rankTitle", { tier: t(key), division }) : t(key);
}

// One row for each stat we have on both sides, given the earlier stats by their short keys.
function statRows(stats, recap, t, flat) {
  const rows = [];
  for (const row of ROWS) {
    const [before, after] = [stats[row.key], row.get(recap)];
    if (before == null || after == null || !Number.isFinite(after)) continue;
    const moved = Math.abs(after - before) > Math.max(Math.abs(before), 1e-9) * flat;
    const mood = !moved ? "flat" : after > before === row.higher ? "better" : "worse";
    rows.push({ key: row.key, label: t(`insights.progress.rows.${row.key}`), before: format(row.show, before, t), after: format(row.show, after, t), mood });
  }
  return rows;
}

const summarize = (rows) => ({ rows, better: rows.filter((r) => r.mood === "better").length, worse: rows.filter((r) => r.mood === "worse").length });

/**
 * Compares two recaps of two periods (the one before, and the one now), with the same rows and result as `compareToSnapshot`
 * but no rank, and a wider "no change" band.
 */
export function compareRecaps(before, after, t = defaultT) {
  const stats = {};
  for (const row of ROWS) {
    const value = row.get(before);
    if (value != null && Number.isFinite(value)) stats[row.key] = value;
  }
  return summarize(statRows(stats, after, t, FLAT_PERIODS));
}

export function compareToSnapshot(snapshot, recap, rank = null, t = defaultT) {
  const rows = statRows(snapshot.stats, recap, t, FLAT);
  if (snapshot.rank && rank) {
    const moved = ladderScore(rank) - snapshot.rank.score;
    const mood = Math.abs(moved) < RANK_FLAT ? "flat" : moved > 0 ? "better" : "worse";
    rows.push({ key: "rank", label: t("insights.progress.rows.rank"), before: savedRankTitle(snapshot.rank.title, t), after: rank.title, mood });
  }
  return summarize(rows);
}

/** One line on how it went. */
export function progressLine({ better, worse, rows }, t = defaultT) {
  if (better + worse === 0) return t("insights.progress.flat");
  if (worse === 0) return t("insights.progress.allUp", { better, total: rows.length });
  if (better === 0) return t("insights.progress.allDown", { worse, total: rows.length });
  return t(better >= worse ? "insights.progress.moreUp" : "insights.progress.mixed", { better, worse });
}
