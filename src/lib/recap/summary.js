import { defaultT } from "@/lib/i18n/en";
import { championId, championName } from "@/lib/riot/ddragon";
import { getInsights, getPersona } from "./persona";
import { pickRank } from "./rank";

/** The words behind a recap: top champion, per-slide copy, archetype and rank. Shared by the slides and the share card. */
export function buildSummary({ recap, rankedEntries, index }, t = defaultT) {
  const topName = championName(index, recap.topChampions[0].id);
  return {
    topName,
    insights: getInsights(recap, topName, t),
    persona: getPersona(recap, {
      topName,
      secondName: recap.champions[1] ? championName(index, recap.champions[1].id) : undefined,
      tagsOf: (id) => index.byId[championId(id)]?.tags,
    }, t),
    rank: pickRank(rankedEntries, t),
  };
}
