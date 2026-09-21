import "server-only";
import { riotFetch } from "./client";

// Both endpoints are served from the platform host (euw1, na1, ...), not the regional one.

/** `{ profileIconId, summonerLevel, ... }` */
export function getSummoner(platform, puuid) {
  return riotFetch(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`, { revalidate: 3600 });
}

/** Array of ranked queue entries: `{ queueType, tier, rank, leaguePoints, wins, losses }`. Empty when unranked. Never cached: LP changes after every ranked game. */
export function getRankedEntries(platform, puuid) {
  return riotFetch(platform, `/lol/league/v4/entries/by-puuid/${puuid}`, { revalidate: 0 });
}

/** Champion mastery entries, most points first: `{ championId, championLevel, championPoints, lastPlayTime }`. */
export function getMastery(platform, puuid) {
  return riotFetch(platform, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`, { revalidate: 3600 });
}
