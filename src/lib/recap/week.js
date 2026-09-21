import { defaultT } from "@/lib/i18n/en";
import { compareRecaps } from "./progress";

// "This week vs last week": the last 7 days of a recap against the 7 days before them. Each week needs a few games behind it,
// or the comparison is mostly luck.
const MIN_GAMES = 5;

/**
 * @param recap the recap for the last 7 days
 * @param before the recap for the 7 days before, or null when there isn't one (a partial one is not passed: see `loadRecap`)
 * @returns null without a fair comparison, else `{ progress, games }`: `progress` is `compareRecaps`' result (with `rows`,
 * `better` and `worse`) and `games` is `{ now, before }`
 */
export function getWeekCompare(recap, before, t = defaultT) {
  if (!before || recap.games < MIN_GAMES || before.games < MIN_GAMES) return null;
  const progress = compareRecaps(before, recap, t);
  return progress.rows.length > 0 ? { progress, games: { now: recap.games, before: before.games } } : null;
}
