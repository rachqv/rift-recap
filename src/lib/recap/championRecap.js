import { defaultT } from "@/lib/i18n/en";
import { buildRecap } from "./buildRecap";

const MIN_COMPARE_GAMES = 8; // games on a champion before its win rate is set against your overall one
const MIN_GAP = 0.08; // the least it has to differ by to be called better or worse
const Z = 1.5; // and it has to be this many standard errors of a win rate over that many games

/**
 * A recap of just one champion's games: the same numbers as the main recap, over the Summoner's Rift games you played `champion`
 * (a Data Dragon id, like "Ahri"). Everything the slides read (win rate, KDA, items, runes, matchups, patches...) is in it, so the same
 * slides can tell one champion's story.
 * @param matches match-v5 DTOs
 * @param canonical maps the name a match uses for a champion to Data Dragon's id (a few differ); the identity by default
 * @returns a `buildRecap` result, or null when you have no games on that champion
 */
export function buildChampionRecap(matches, puuid, champion, canonical = (id) => id) {
  const games = matches.filter(
    (match) => match.info?.gameMode === "CLASSIC" && match.info.participants.some((p) => p.puuid === puuid && canonical(p.championName) === champion),
  );
  if (games.length === 0) return null;
  const recap = buildRecap(games, puuid);
  return recap.games > 0 ? recap : null;
}

/**
 * The line under the champion's name: how it compares with your usual. `overall` is your win rate over all your games. A champion
 * with few games has no comparison (it would be luck), just its record.
 */
export function getChampionLine(recap, overall, name, t = defaultT) {
  const values = { name, rate: t.percent(recap.winRate), overall: t.percent(overall) };
  if (recap.games < MIN_COMPARE_GAMES) return t("insights.championPage.few", { ...values, games: t("recap.gamesLabel", { count: recap.games }) });
  const gap = recap.winRate - overall;
  const needed = Math.max(MIN_GAP, Z * Math.sqrt((overall * (1 - overall)) / recap.games));
  return t(`insights.championPage.${gap >= needed ? "better" : gap <= -needed ? "worse" : "level"}`, values);
}
