import { defaultT } from "@/lib/i18n/en";

// Favorite items: which finished items you end games with. Item names and prices come from Data Dragon.

const FINAL_MIN_GOLD = 1000; // finished items cost a lot; components and starters don't

const BOOTS_MIN_GOLD = 900;

/** Whether an item is one you could keep to the end of a game on Summoner's Rift (map 11): not a trinket or a consumable. */
function isKeepable(item) {
  const tags = item.tags ?? [];
  return Boolean(item.maps?.["11"]) && !item.consumed && !tags.includes("Trinket") && !tags.includes("Consumable");
}

/** `"boots"`, `"final"` (a finished, non-boots item) or null for a component or a starter. */
function itemKind(item) {
  const total = item.gold?.total ?? 0;
  if ((item.tags ?? []).includes("Boots") && total >= BOOTS_MIN_GOLD) return "boots";
  const finished = (item.into?.length ?? 0) === 0 && total >= FINAL_MIN_GOLD && item.gold?.purchasable !== false;
  return finished ? "final" : null;
}

/**
 * Compacts Data Dragon's `item.json` (~670 KB) to what this needs, and classifies each item:
 * `boots`, or `final` (a finished, non-boots item you'd build on Summoner's Rift).
 */
export function compactItems(data) {
  const byId = {};
  for (const [id, item] of Object.entries(data ?? {})) {
    const kind = isKeepable(item) ? itemKind(item) : null;
    if (kind) byId[id] = { name: item.name, plaintext: item.plaintext ?? "", boots: kind === "boots" };
  }
  return byId;
}

const winRate = (entry) => entry.wins / entry.games;

/**
 * `items` is `recap.items`: `[{ id, games, wins }]`, the items in your six slots at the end of each game.
 * `itemIndex` is `compactItems` output. Returns `{ favorite, boots, build }` or null when nothing qualifies.
 */
export function pickFavoriteItems(items, itemIndex, { games, wins }) {
  const known = items
    .filter((item) => itemIndex[item.id])
    .map((item) => ({ ...item, ...itemIndex[item.id], winRate: winRate(item), share: item.games / games }));

  const byPopularity = (a, b) => b.games - a.games || b.winRate - a.winRate;
  const finals = known.filter((item) => !item.boots).sort(byPopularity);
  if (finals.length === 0) return null;

  // Win rate in games you built it vs games you didn't (only when both sides have enough games to compare).
  const favorite = finals[0];
  const without = games - favorite.games;
  const winRateWithout = without >= 3 ? (wins - favorite.wins) / without : null;

  return {
    favorite: { ...favorite, winRateWithout },
    boots: known.filter((item) => item.boots).sort(byPopularity)[0] ?? null,
    // The signature build: your most-built finished items, favorite first.
    build: finals.slice(0, 5),
  };
}

/** One personalised line for the item slide. */
export function getItemInsight({ favorite }, t = defaultT) {
  const { name, share, winRate: withIt, winRateWithout: without } = favorite;
  if (without != null && withIt - without >= 0.1) return t("insights.items.better", { name, withIt: t.percent(withIt), without: t.percent(without) });
  if (without != null && without - withIt >= 0.1) return t("insights.items.worse", { name, withIt: t.percent(withIt), without: t.percent(without) });
  if (share >= 0.5) return t("insights.items.habit", { name, share: t.percent(share) });
  return t("insights.items.friend", { name, share: t.percent(share) });
}
