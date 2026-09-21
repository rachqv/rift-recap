import { defaultT } from "@/lib/i18n/en";
import { clampNumber, encodeSnapshot, readTime, round } from "@/lib/snapshot";

// A head-to-head "rematch": the score and win rates are saved in a link, and opening the pair again with it shows who
// improved. The two Riot IDs are stored too, so a link can't be pasted onto a different pair.

const id = (player) => `${player.account.gameName}#${player.account.tagLine}`.toLowerCase();

/** Link value for a head-to-head. `a` and `b` are loaded players, `comparison` is from `compareRecaps`. */
export function rematchSnapshot(a, b, comparison) {
  return encodeSnapshot({
    v: 1,
    t: Date.now(),
    n: [id(a), id(b)],
    s: [comparison.score.a, comparison.score.b],
    w: [round(a.recap.winRate), round(b.recap.winRate)],
    k: [round(a.recap.kda, 2), round(b.recap.kda, 2)],
  });
}

const pair = (value, low, high) => (Array.isArray(value) && value.length === 2 ? value.map((x) => clampNumber(x, low, high)) : null);

/**
 * Reads a decoded rematch value for the pair `a`, `b`. Returns `{ time, score, winRate }` (`score` and `winRate` are
 * `[a, b]` pairs; `winRate` is null when missing) or null when it is malformed or was saved for two different players.
 */
export function readRematch(raw, a, b) {
  if (!raw || raw.v !== 1 || !Array.isArray(raw.n) || raw.n[0] !== id(a) || raw.n[1] !== id(b)) return null;
  const [time, score, winRate] = [readTime(raw.t), pair(raw.s, 0, 20), pair(raw.w, 0, 1)];
  if (time == null || !score || score.includes(null)) return null;
  return { time, score, winRate: winRate?.includes(null) ? null : winRate };
}

const points = (t, x) => `${x >= 0 ? "+" : "−"}${t.number(Math.abs(Math.round(x * 100)))}`;

/** What changed since the saved rematch: `{ before: [a, b], now: [a, b], winRate: [deltaA, deltaB] | null, line }`. */
export function compareToRematch(saved, comparison, a, b, t = defaultT) {
  const now = [comparison.score.a, comparison.score.b];
  const winRate = saved.winRate ? [a.recap.winRate - saved.winRate[0], b.recap.winRate - saved.winRate[1]] : null;
  const [an, bn] = [a.account.gameName, b.account.gameName];

  const leader = (score) => (score[0] === score[1] ? "tie" : score[0] > score[1] ? "a" : "b");
  const [before, after] = [leader(saved.score), leader(now)];
  let line;
  if (before !== after && after !== "tie") {
    line = t("versus.rematch.changed", { name: after === "a" ? an : bn });
  } else if (winRate && Math.abs(winRate[0] - winRate[1]) >= 0.05) {
    const [name, better, worse] = winRate[0] > winRate[1] ? [an, winRate[0], winRate[1]] : [bn, winRate[1], winRate[0]];
    line = t("versus.rematch.improved", { name, better: points(t, better), worse: points(t, worse) });
  } else {
    line = t("versus.rematch.same");
  }
  return { before: saved.score, now, winRate, line };
}
