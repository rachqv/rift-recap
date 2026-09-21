import { defaultT } from "@/lib/i18n/en";

const TIER_COLORS = {
  IRON: "#8a7a72",
  BRONZE: "#b8794b",
  SILVER: "#a9b4bf",
  GOLD: "#e0b458",
  PLATINUM: "#3fc1b6",
  EMERALD: "#2fcf7f",
  DIAMOND: "#6b83e8",
  MASTER: "#c05ad6",
  GRANDMASTER: "#e0525a",
  CHALLENGER: "#f4d27a",
};

// Emblem artwork from Community Dragon (Data Dragon has none): 500x500 transparent PNG per tier.
const tierEmblemUrl = (tier) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${tier.toLowerCase()}.png`;

// Apex tiers have no divisions (a "I" would be misleading).
const APEX = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

const QUEUES = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"];

const TIER_ORDER = Object.keys(TIER_COLORS);
const DIVISIONS = { IV: 0, III: 1, II: 2, I: 3 };

/**
 * One number for where you are on the ladder, so two ranks can be compared: 400 a tier, 100 a division, plus LP.
 * `rank` is a `pickRank` result. Apex tiers have no divisions, so only LP counts inside them.
 */
export const ladderScore = (rank) => TIER_ORDER.indexOf(rank.tier) * 400 + (rank.division ? (DIVISIONS[rank.division] ?? 0) * 100 : 0) + (rank.lp ?? 0);

/** Picks the most relevant ranked entry (solo first, then flex) and shapes it for display, in the language of `t`. */
export function pickRank(entries, t = defaultT) {
  if (!Array.isArray(entries)) return null;
  for (const queueType of QUEUES) {
    const entry = entries.find((e) => e.queueType === queueType);
    if (!entry) continue;
    const games = entry.wins + entry.losses;
    const tierName = t(`common.tiers.${entry.tier}`);
    return {
      queueLabel: t(`common.queues.${queueType}`),
      tier: entry.tier,
      emblem: tierEmblemUrl(entry.tier),
      tierName: tierName,
      division: APEX.has(entry.tier) ? null : entry.rank,
      title: APEX.has(entry.tier) ? tierName : t("common.rankTitle", { tier: tierName, division: entry.rank }),
      lp: entry.leaguePoints,
      wins: entry.wins,
      losses: entry.losses,
      winRate: games ? entry.wins / games : 0,
      color: TIER_COLORS[entry.tier] ?? "#c8aa6e",
    };
  }
  return null;
}
