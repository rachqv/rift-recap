import { defaultT } from "@/lib/i18n/en";

// Patch by patch: your win rate on each game patch (a two-week balance update), and which one suited you best and worst.
//
// A patch only gets a win rate with a few games behind it, and the best and worst are only called out when they are further
// apart than luck alone would put them: the more games on the two patches, the smaller that gap can be.

const MIN_PATCH_GAMES = 6; // games on a patch before its win rate is shown
const MIN_PATCHES = 3; // patches with a win rate before there is anything to compare
const MAX_SHOWN = 10; // the most recent this many
const MIN_GAP = 0.2; // the least a swing can be, however many games there are
const Z = 1.5; // and it must be this many standard errors of the difference between the two

/**
 * @param recap a `buildRecap` result: it needs `patches`, `[{ patch, games, wins }]` oldest first
 * @returns null without at least three patches to compare, else `{ patches, overall, best, worst, gap, mood }`:
 * - `patches`: the most recent patches with enough games, oldest first, each `{ patch, key, games, wins, rate }`
 * - `overall`: your win rate over those games
 * - `best`, `worst`: the patches with your highest and lowest win rate (the first one if two are level)
 * - `mood`: "swing" when they are far enough apart to be more than luck, else "steady"
 */
export function getPatchForm(recap) {
  const patches = (recap.patches ?? [])
    .filter((p) => p.games >= MIN_PATCH_GAMES)
    .slice(-MAX_SHOWN)
    .map((p) => ({ patch: p.patch, key: p.patch, games: p.games, wins: p.wins, rate: p.wins / p.games }));
  if (patches.length < MIN_PATCHES) return null;

  const overall = patches.reduce((total, p) => total + p.wins, 0) / patches.reduce((total, p) => total + p.games, 0);
  const best = patches.reduce((top, p) => (p.rate > top.rate ? p : top));
  const worst = patches.reduce((low, p) => (p.rate < low.rate ? p : low));
  const gap = best.rate - worst.rate;
  const spread = Math.sqrt(overall * (1 - overall) * (1 / best.games + 1 / worst.games));
  return { patches, overall, best, worst, gap, mood: gap >= Math.max(MIN_GAP, Z * spread) ? "swing" : "steady" };
}

/** One sentence on how your best and worst patch compare. */
export function patchLine(form, t = defaultT) {
  return t(`insights.patches.${form.mood}`, {
    best: form.best.patch,
    bestRate: t.percent(form.best.rate),
    worst: form.worst.patch,
    worstRate: t.percent(form.worst.rate),
  });
}
