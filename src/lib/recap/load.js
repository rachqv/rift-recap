import "server-only";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getAccountByRiotId } from "@/lib/riot/account";
import { getChampionIndex } from "@/lib/riot/ddragon";
import { getMatchIds, getMatches, getTimelines } from "@/lib/riot/matches";
import { getMastery, getRankedEntries, getSummoner } from "@/lib/riot/summoner";
import { EARLY_TIMELINES, MAX_MATCHES, SEASON_START } from "./config";
import { buildEarlyGame } from "./early";
import { buildRecapSet } from "./modes";
import { splitAt } from "./range";

// Route params can be malformed percent-encoding; fall back to the raw text instead of crashing.
export function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Riot answers 401 for a key it doesn't know (mistyped, or one that has expired and been replaced) and 403 for one it refuses.
const ERROR_KEYS = { 401: "keyRejected", 403: "keyRejected", 404: "notFound", 429: "rateLimit" };

/** The message for a failed Riot lookup: a friendly one for the statuses we know, else the error's own text. */
export const errorMessage = (t, error) => (ERROR_KEYS[error.status] ? t(`errors.${ERROR_KEYS[error.status]}`) : error.message);

/**
 * Everything a recap needs for one player. Throws `RiotApiError` when Riot rejects the lookup.
 * `since` is a Date: only games after it count (the season start by default). `extras` adds what only the solo recap
 * uses: champion mastery, and how you stand against your lane opponent at 15 minutes (`earlyGame`, from timelines).
 * `locale` is the language of the champion names in the result.
 *
 * `previous` (a Date before `since`) also loads the period before, as `before`: the same kind of result as the rest, for the
 * games between `previous` and `since`. It is null when Riot had more games than a recap loads (`maxMatches`): then the
 * oldest of them are missing, so the period before would look quieter than it was.
 */
export async function loadRecap(region, name, tag, { maxMatches = MAX_MATCHES, since = SEASON_START, previous = null, extras = false, locale = DEFAULT_LOCALE } = {}) {
  const account = await getAccountByRiotId(region, name, tag);
  const [matchIds, summoner, rankedEntries, index, mastery] = await Promise.all([
    getMatchIds(region, account.puuid, {
      startTime: Math.floor((previous ?? since).getTime() / 1000),
      count: maxMatches,
    }),
    // Nice-to-have extras: a failure here must not break the recap.
    getSummoner(region, account.puuid).catch(() => null),
    getRankedEntries(region, account.puuid).catch(() => []),
    getChampionIndex(locale),
    extras ? getMastery(region, account.puuid).catch(() => null) : null,
  ]);
  const loaded = await getMatches(region, matchIds);
  const { current: matches, earlier } = previous ? splitAt(loaded, since) : { current: loaded, earlier: [] };
  const earlyGame = extras ? await loadEarlyGame(region, matches, account.puuid) : null;
  // `matches` and `matchIds` let head-to-head find the games two players share.
  const before = previous && matchIds.length < maxMatches ? buildRecapSet(earlier, account.puuid) : null;
  return { region, account, summoner, rankedEntries, index, matches, matchIds, mastery, earlyGame, before, ...buildRecapSet(matches, account.puuid) };
}

/** Timelines of the player's latest lane games, turned into `buildEarlyGame`'s result (null when there aren't enough). */
async function loadEarlyGame(region, matches, puuid) {
  const latest = matches
    .filter((m) => m.info?.gameMode === "CLASSIC" && m.info.gameDuration >= 900 && m.info.participants.find((p) => p.puuid === puuid)?.teamPosition)
    .sort((a, b) => b.info.gameCreation - a.info.gameCreation)
    .slice(0, EARLY_TIMELINES);
  if (latest.length === 0) return null;
  try {
    return buildEarlyGame(latest, await getTimelines(region, latest.map((m) => m.metadata.matchId)), puuid);
  } catch {
    return null; // a bonus: a failure here must not break the recap
  }
}
