// Your champion pool as a classic tier list. A champion's score is mostly its win rate, with KDA as the tiebreaker, so
// a 75% win rate with an average KDA still beats a lucky-looking KDA on a losing champion.

import { defaultT } from "@/lib/i18n/en";

const TIERS = [
  { key: "S", min: 0.7, color: "#ff7a7a" },
  { key: "A", min: 0.6, color: "#ffb86b" },
  { key: "B", min: 0.5, color: "#f1e27a" },
  { key: "C", min: 0.42, color: "#8fdc8a" },
  { key: "D", min: 0, color: "#8fb4e8" },
];

const MIN_GAMES = 4; // a champion needs this many games to be rated
const MIN_CHAMPIONS = 3; // and a tier list needs this many champions to be worth drawing
const MAX_CHAMPIONS = 12;
const KDA_CAP = 5; // a huge KDA over a few games shouldn't outweigh the results

/** Score in [0, 1]: 70% win rate, 30% KDA (capped). */
export const tierScore = ({ winRate, kda }) => 0.7 * winRate + 0.3 * (Math.min(kda, KDA_CAP) / KDA_CAP);

/**
 * @param recap a `buildRecap` result
 * @returns null with too few rated champions; otherwise `{ tiers: [{ key, color, champions: [{ id, games, winRate, kda, score }] }], best, worst }`
 * where empty tiers are kept (so the list always reads S to D) and champions inside a tier are ordered by score.
 */
export function getTierList(recap) {
  const rated = recap.champions
    .filter((c) => c.games >= MIN_GAMES)
    .slice(0, MAX_CHAMPIONS)
    .map((c) => ({ id: c.id, games: c.games, winRate: c.winRate, kda: c.kda, score: tierScore(c) }));
  if (rated.length < MIN_CHAMPIONS) return null;

  const tiers = TIERS.map((tier, i) => ({
    key: tier.key,
    color: tier.color,
    champions: rated.filter((c) => c.score >= tier.min && (i === 0 || c.score < TIERS[i - 1].min)).sort((a, b) => b.score - a.score),
  }));
  const byScore = [...rated].sort((a, b) => b.score - a.score);
  return { tiers, best: byScore[0], worst: byScore.at(-1) };
}

/** The tier letter a champion sits in. */
const tierOf = (list, id) => list.tiers.find((tier) => tier.champions.some((c) => c.id === id))?.key;

/**
 * One sentence about the top and bottom of the list, built from where those champions actually are: the best pick is only
 * called S tier when it is in the S row. `nameOf(id)` is a champion's display name.
 */
export function tierListLine(list, nameOf, t = defaultT) {
  const { best, worst } = list;
  const [top, bottom] = [tierOf(list, best.id), tierOf(list, worst.id)];
  const [bestName, worstName] = [nameOf(best.id), nameOf(worst.id)];

  if (best.id === worst.id) return t("insights.tierlist.solo", { best: bestName });
  if (top === bottom) return t("insights.tierlist.uniform", { tier: top, best: bestName, winRate: t.percent(best.winRate) });

  const lead =
    top === "S"
      ? t("insights.tierlist.leadS", { best: bestName, winRate: t.percent(best.winRate) })
      : t("insights.tierlist.leadOther", { best: bestName, tier: top, winRate: t.percent(best.winRate) });
  const last =
    bottom === "D"
      ? t("insights.tierlist.lastD", { worst: worstName, winRate: t.percent(worst.winRate) })
      : t("insights.tierlist.lastOther", { worst: worstName, tier: bottom, winRate: t.percent(worst.winRate) });
  return t("insights.tierlist.both", { lead, last });
}
