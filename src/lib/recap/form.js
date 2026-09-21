import { defaultT } from "@/lib/i18n/en";

// Three small "how do you play" reads on top of a recap: how a loss changes your next game, which champions lift or
// drag your win rate, and how long you spent waiting to respawn. Each returns null when the data is too thin to say
// anything (win rates over a handful of games are mostly luck), so the story just skips that slide.

// A win rate after a win or a loss needs this many games behind it, and the two have to be this far apart before
// it counts as a real pattern: with ~40 games in each bucket, gaps under about 15 points are what luck produces.
const MIN_AFTER_GAMES = 8;
const TILT_GAP = 0.15;

/**
 * @param recap a `buildRecap` result
 * @returns null, or `{ afterWin, afterLoss, gap, mood, line }` where each side is `{ games, rate }`, `gap` is the win
 * rate after a win minus the win rate after a loss, and `mood` is "tilt" (worse after a loss), "resilient" (better
 * after a loss) or "steady".
 */
export function getTilt(recap, t = defaultT) {
  const { win, loss } = recap.afterResult ?? {};
  if (!win || !loss || win.games < MIN_AFTER_GAMES || loss.games < MIN_AFTER_GAMES) return null;

  const afterWin = { games: win.games, rate: win.wins / win.games };
  const afterLoss = { games: loss.games, rate: loss.wins / loss.games };
  const gap = afterWin.rate - afterLoss.rate;
  const mood = gap >= TILT_GAP ? "tilt" : gap <= -TILT_GAP ? "resilient" : "steady";

  const line = t(`insights.tilt.${mood}`, { afterWin: t.percent(afterWin.rate), afterLoss: t.percent(afterLoss.rate) });

  return { afterWin, afterLoss, gap, mood, line };
}

const MIN_CHAMPION_GAMES = 5;
const COMFORT_ROWS = 4;

/**
 * Your win rate on each champion you know, against your win rate overall.
 * @returns null, or `{ rows, best, worst }`: `rows` are your most played champions (at least 5 games each) with
 * `{ id, games, winRate, delta }`, and `best` / `worst` are the biggest swings up and down among all such champions
 * (`worst` is null unless a champion really costs you wins).
 */
export function getComfort(recap) {
  const known = recap.champions
    .filter((c) => c.games >= MIN_CHAMPION_GAMES)
    .map((c) => ({ id: c.id, games: c.games, winRate: c.winRate, delta: c.winRate - recap.winRate }));
  if (known.length < 2) return null;

  const byDelta = [...known].sort((a, b) => b.delta - a.delta);
  const best = byDelta[0];
  const worst = byDelta.at(-1);
  return { rows: known.slice(0, COMFORT_ROWS), best, worst: worst.delta < 0 && worst.id !== best.id ? worst : null };
}

/** One line about the best and worst pick. `nameOf(id)` is the champion's display name. */
export function comfortLine({ best, worst }, nameOf, t = defaultT) {
  const values = { best: nameOf(best.id), bestRate: t.percent(best.winRate) };
  if (!worst || worst.delta > -0.05) return t("insights.comfort.trust", values);
  return t("insights.comfort.drag", { ...values, worst: nameOf(worst.id), worstRate: t.percent(worst.winRate) });
}

/**
 * Time spent dead, in whole numbers a person can picture.
 * @returns null (no data), or `{ hours, share, perGame, films }`: `share` is of all your time in games and `perGame`
 * is minutes a game.
 */
export function getGrayScreen(recap) {
  const dead = recap.timeDead;
  if (!dead || dead.seconds <= 0) return null;
  const hours = dead.seconds / 3600;
  return { hours, share: dead.share, perGame: dead.seconds / 60 / recap.games, films: hours / 2 };
}

export function grayScreenLine({ share, perGame }, t = defaultT) {
  if (share >= 0.2) return t("insights.gray.heavy", { share: t.percent(share) });
  if (share >= 0.12) return t("insights.gray.some", { minutes: t.fixed(perGame) });
  return t("insights.gray.light", { share: t.percent(share) });
}
