import { defaultT } from "@/lib/i18n/en";

// Your runes: the keystone (the big rune that names your whole setup) you take most, and how you do with it. A keystone is the
// first rune of the first tree, which Data Dragon lists as the first slot of each tree; that is how the names and icons are found
// without a list of rune ids to keep up to date.

const MIN_TOTAL = 10; // games with rune data before there is anything to say
const MIN_COMPARE = 6; // games with a keystone before its win rate is set against another's
const MIN_GAP = 0.15; // the least a better keystone has to win more by, however many games there are
const Z = 1.5; // and it must be this many standard errors of the difference between the two
const LOYAL_SHARE = 0.8; // this much of your games on one keystone is a creature of habit
const OTHERS = 3;

/**
 * Data Dragon's `runesReforged.json` as a lookup by rune id: `{ [id]: { id, name, icon, tree, keystone } }`. `icon` is the path
 * under `/cdn/img/`, `tree` is the tree's name, `keystone` is true for the first rune of a tree.
 */
export function compactRunes(trees) {
  const byId = {};
  for (const tree of trees ?? []) {
    tree.slots?.forEach((slot, slotIndex) => {
      for (const rune of slot.runes ?? []) byId[rune.id] = { id: rune.id, name: rune.name, icon: rune.icon, tree: tree.name, keystone: slotIndex === 0 };
    });
  }
  return byId;
}

/**
 * @param keystones `recap.keystones`: `[{ id, games, wins }]`, most played first
 * @param runeIndex from `compactRunes`
 * @returns null without enough games with a known keystone, else `{ favorite, others, best, verdict, total }`. Keystones are
 * `{ id, name, icon, tree, games, wins, winRate, share }`. `favorite` also has `winRateWithout` (null when there are too few
 * other games), `others` are the next three, and `best` is the keystone with the highest win rate among those with enough games.
 * `verdict` is "better" (a keystone other than your favorite wins clearly more), "loyal" (you take one almost every game) or "plain".
 */
export function pickKeystones(keystones, runeIndex) {
  const known = (keystones ?? []).filter((k) => runeIndex[k.id]?.keystone);
  const total = known.reduce((sum, k) => sum + k.games, 0);
  if (total < MIN_TOTAL) return null;

  const rows = known.map((k) => ({ ...runeIndex[k.id], games: k.games, wins: k.wins, winRate: k.wins / k.games, share: k.games / total }));
  const [favorite, ...rest] = rows;
  const wins = rows.reduce((sum, k) => sum + k.wins, 0);
  const otherGames = total - favorite.games;
  favorite.winRateWithout = otherGames >= MIN_COMPARE ? (wins - favorite.wins) / otherGames : null;

  const eligible = rows.filter((k) => k.games >= MIN_COMPARE);
  const best = eligible.reduce((top, k) => (!top || k.winRate > top.winRate ? k : top), null);
  let verdict = favorite.share >= LOYAL_SHARE ? "loyal" : "plain";
  if (best && best !== favorite && favorite.games >= MIN_COMPARE) {
    const overall = wins / total;
    const spread = Math.sqrt(overall * (1 - overall) * (1 / best.games + 1 / favorite.games));
    if (best.winRate - favorite.winRate >= Math.max(MIN_GAP, Z * spread)) verdict = "better";
  }
  return { favorite, others: rest.slice(0, OTHERS), best, verdict, total };
}

/** One sentence on your keystone habits. */
export function getKeystoneInsight({ favorite, best, verdict }, t = defaultT) {
  if (verdict === "better") return t("insights.runes.better", { best: best.name, bestRate: t.percent(best.winRate), favorite: favorite.name, favoriteRate: t.percent(favorite.winRate) });
  if (verdict === "loyal") return t("insights.runes.loyal", { name: favorite.name, share: t.percent(favorite.share) });
  return t("insights.runes.plain", { name: favorite.name, rate: t.percent(favorite.winRate), games: t("recap.gamesLabel", { count: favorite.games }) });
}
