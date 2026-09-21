import "server-only";
import { RiotApiError, riotFetch } from "./client";
import { clusterFor } from "./regions";

// Riot dev keys allow 20 req/s and 100 req/2min, so keep the match count modest
// until results are cached somewhere (DB, KV, ...).
const CONCURRENCY = 5;

// Not found (old games), rate limited, or Riot having a bad moment. Anything else (a bad key) is worth surfacing.
const SKIPPABLE = new Set([404, 429, 502, 503, 504]);

/**
 * `startTime` is epoch seconds. Riot caps `count` at 100 per request; `start` skips that many of the newest games.
 *
 * Never cached: this list is how a new game shows up, so it is asked for on every view (one small request). The games
 * themselves are cached below, so only games the app hasn't seen yet cost a request.
 */
export function getMatchIds(platform, puuid, { startTime, start, count = 20, queue } = {}) {
  return riotFetch(clusterFor(platform), `/lol/match/v5/matches/by-puuid/${puuid}/ids`, {
    params: { startTime, start, count, queue },
    revalidate: 0,
  });
}

const ID_PAGE = 100; // Riot's cap per request

/** The latest `count` match ids (newest first), paging past Riot's 100-per-request cap. Stops early when the history ends. */
export async function getMatchIdsPaged(platform, puuid, { startTime, count }) {
  const ids = [];
  while (ids.length < count) {
    const want = Math.min(ID_PAGE, count - ids.length);
    const page = await getMatchIds(platform, puuid, { startTime, start: ids.length, count: want });
    ids.push(...page);
    if (page.length < want) break;
  }
  return ids;
}

// Finished matches never change, so they can be cached for a long time.
function getMatch(platform, matchId) {
  return riotFetch(clusterFor(platform), `/lol/match/v5/matches/${matchId}`, {
    revalidate: 60 * 60 * 24 * 7,
  });
}

// Per-minute gold, XP and kill events. Same story as the match itself: a finished game's timeline never changes.
function getTimeline(platform, matchId) {
  return riotFetch(clusterFor(platform), `/lol/match/v5/matches/${matchId}/timeline`, {
    revalidate: 60 * 60 * 24 * 7,
  });
}

/** Runs `load(item)` over `items`, a few at a time, and returns the results in order. */
async function pooled(items, load) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await load(items[i]);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

export function getMatches(platform, matchIds) {
  return pooled(matchIds, (id) => getMatch(platform, id));
}

/**
 * Timelines are a bonus on top of the match data, so a game whose timeline Riot can't give (too old, rate limited)
 * is left out instead of failing the page. Returns a `Map` of match id -> timeline. A missing key or a network
 * failure still throws.
 */
export async function getTimelines(platform, matchIds) {
  const timelines = await pooled(matchIds, (id) =>
    getTimeline(platform, id).catch((error) => {
      if (error instanceof RiotApiError && SKIPPABLE.has(error.status)) return null;
      throw error;
    }),
  );
  return new Map(matchIds.flatMap((id, i) => (timelines[i] ? [[id, timelines[i]]] : [])));
}
