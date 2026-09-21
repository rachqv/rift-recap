import "server-only";
import { FACEOFF_TIMELINES, MAX_SHARED_MATCHES, SEASON_START, SQUAD_SCAN, VERSUS_MATCHES } from "@/lib/recap/config";
import { loadRecap } from "@/lib/recap/load";
import { getAccountByRiotId } from "@/lib/riot/account";
import { RiotApiError } from "@/lib/riot/client";
import { getMatchIdsPaged, getMatches, getTimelines } from "@/lib/riot/matches";
import { buildSquadStats } from "./build";
import { buildClash } from "./clash";
import { buildFaceOff, findMeetings } from "./faceoff";
import { samePlayer } from "./parse";
import { apartRecord, buildCarry, buildSynergy } from "./synergy";

// match ids look like "EUW1_7412345678": the number grows over time, so a bigger one is a newer game.
const matchNumber = (id) => Number(String(id).split("_")[1]) || 0;

/**
 * Finds the games a group played together and loads only those.
 *
 * Instead of loading every member's whole history, it takes each member's latest match ids (one cheap request
 * each) and keeps the ids that appear in two or more lists. Players who queue together share matches, so this
 * needs far fewer requests than loading everyone's games, and everyone is compared on the same games.
 *
 * `since` is a Date: only games after it count (the season start by default).
 *
 * Returns `{ missing }` (players Riot doesn't know) or `{ region, members, matches, sharedFound, scanned }`.
 * Riot failures other than "not found" (bad key, rate limit) are thrown as `RiotApiError`.
 */
export async function loadSquad(region, players, { since = SEASON_START } = {}) {
  const lookups = await Promise.allSettled(players.map((p) => getAccountByRiotId(region, p.gameName, p.tagLine)));

  const accounts = [];
  const missing = [];
  lookups.forEach((result, i) => {
    if (result.status === "fulfilled") {
      // Two spellings of the same player would otherwise count twice.
      if (!accounts.some((a) => a.puuid === result.value.puuid)) accounts.push(result.value);
    } else if (result.reason instanceof RiotApiError && result.reason.status === 404) {
      missing.push(players[i]);
    } else {
      throw result.reason;
    }
  });
  if (missing.length > 0) return { missing };

  const idLists = await Promise.all(
    accounts.map((a) => getMatchIdsPaged(region, a.puuid, { startTime: Math.floor(since.getTime() / 1000), count: SQUAD_SCAN })),
  );

  const seenBy = new Map();
  for (const ids of idLists) for (const id of new Set(ids)) seenBy.set(id, (seenBy.get(id) ?? 0) + 1);
  const shared = [...seenBy].filter(([, count]) => count >= 2).map(([id]) => id).sort((a, b) => matchNumber(b) - matchNumber(a));

  const matches = await getMatches(region, shared.slice(0, MAX_SHARED_MATCHES));
  return {
    region,
    members: accounts.map(({ puuid, gameName, tagLine }) => ({ puuid, gameName, tagLine, profileIcon: null })),
    matches,
    sharedFound: shared.length,
    scanned: SQUAD_SCAN,
  };
}

/**
 * Loads two full recaps (a smaller window each) plus the stats of the games they played together, and the record of
 * the games they played against each other. Players on different servers can't share games, so both are empty for them.
 * Returns `{ a, b, together, faceOff, synergy, carry }`, or `{ error: "same" }` when both IDs are the same player.
 */
export async function loadVersus(playerA, playerB, { since = SEASON_START, locale } = {}) {
  if (samePlayer(playerA, playerB)) return { error: "same" };

  const [a, b] = await Promise.all([
    loadRecap(playerA.region, playerA.gameName, playerA.tagLine, { maxMatches: VERSUS_MATCHES, since, locale }),
    loadRecap(playerB.region, playerB.gameName, playerB.tagLine, { maxMatches: VERSUS_MATCHES, since, locale }),
  ]);
  if (a.account.puuid === b.account.puuid) return { error: "same" };

  const together = sharedStats(a, b);
  return { a, b, together, faceOff: await faceOffStats(a, b), synergy: synergyStats(a, b, together), carry: buildCarry(sharedMatches(a, b), a.account.puuid, b.account.puuid) };
}

/** The games both players' loaded windows have in common (any queue, either side). */
function sharedMatches(a, b) {
  if (a.region !== b.region) return [];
  const theirs = new Set(b.matchIds);
  const sharedIds = new Set(a.matchIds.filter((id) => theirs.has(id)));
  return a.matches.filter((m) => sharedIds.has(m.metadata?.matchId));
}

/** Stats over the games the two played on the same team (null when there are none). */
function sharedStats(a, b) {
  const matches = sharedMatches(a, b);
  if (matches.length === 0) return null;
  const stats = buildSquadStats(matches, [a.account, b.account].map(({ puuid, gameName, tagLine }) => ({ puuid, gameName, tagLine })));
  // Games as opponents are skipped by `buildSquadStats`, so shared games can still mean zero games together.
  return stats.squad.games > 0 ? stats : null;
}

/**
 * How the two did in the games they played against each other (null when they never met), including the timeline of
 * the latest few of those games: who was ahead at 15 minutes, and who killed whom.
 */
async function faceOffStats(a, b) {
  const matches = sharedMatches(a, b);
  const [aPuuid, bPuuid] = [a.account.puuid, b.account.puuid];
  const recent = findMeetings(matches, aPuuid, bPuuid).slice(-FACEOFF_TIMELINES);
  const timelines = recent.length > 0 ? await getTimelines(a.region, recent.map((m) => m.matchId)) : undefined;
  return buildFaceOff(matches, aPuuid, bPuuid, timelines);
}

/**
 * How each player's win rate changes between the games they played apart and the games they played together (null when
 * there is too little of either). `together` is `sharedStats(a, b)`.
 */
function synergyStats(a, b, together) {
  if (!together) return null;
  const [aPuuid, bPuuid] = [a.account.puuid, b.account.puuid];
  const teamGameIds = new Set(
    sharedMatches(a, b)
      .filter((match) => {
        const [pa, pb] = [aPuuid, bPuuid].map((puuid) => match.info?.participants.find((p) => p.puuid === puuid));
        return pa && pb && pa.teamId === pb.teamId;
      })
      .map((match) => match.metadata?.matchId),
  );
  const [ma, mb] = together.members;
  return buildSynergy(
    { a: apartRecord(a.matches, aPuuid, teamGameIds), b: apartRecord(b.matches, bPuuid, teamGameIds) },
    { a: { games: ma.games, wins: ma.wins }, b: { games: mb.games, wins: mb.wins } },
  );
}

/**
 * Finds the games two squads played against each other and builds the clash from them. Like `loadSquad`, it reads each player's
 * latest match ids and keeps the ones that both squads share (at least two players of each), so only those games are loaded.
 *
 * Returns `{ missing }` (players Riot doesn't know), `{ overlap }` (spellings of one player on both squads), or
 * `{ region, a, b, clash, scanned }` where `a` and `b` are the squads' members and `clash` is `buildClash`'s result (null when they never met).
 */
export async function loadClash(region, squadA, squadB, { since = SEASON_START } = {}) {
  const players = [...squadA, ...squadB];
  const lookups = await Promise.allSettled(players.map((p) => getAccountByRiotId(region, p.gameName, p.tagLine)));

  const accounts = [];
  const missing = [];
  lookups.forEach((result, i) => {
    if (result.status === "fulfilled") accounts.push(result.value);
    else if (result.reason instanceof RiotApiError && result.reason.status === 404) missing.push(players[i]);
    else throw result.reason;
  });
  if (missing.length > 0) return { missing };

  const members = accounts.map(({ puuid, gameName, tagLine }) => ({ puuid, gameName, tagLine }));
  const [a, b] = [members.slice(0, squadA.length), members.slice(squadA.length)];
  const inA = new Set(a.map((m) => m.puuid));
  const overlap = b.filter((m) => inA.has(m.puuid));
  if (overlap.length > 0) return { overlap };

  const idLists = await Promise.all(
    members.map((m) => getMatchIdsPaged(region, m.puuid, { startTime: Math.floor(since.getTime() / 1000), count: SQUAD_SCAN })),
  );
  const seenBy = (side, from) => {
    const counts = new Map();
    for (const ids of idLists.slice(from, from + side.length)) for (const id of new Set(ids)) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  };
  const [seenA, seenB] = [seenBy(a, 0), seenBy(b, a.length)];
  const both = [...seenA].filter(([id, count]) => count >= 2 && (seenB.get(id) ?? 0) >= 2).map(([id]) => id).sort((x, y) => matchNumber(y) - matchNumber(x));

  const matches = await getMatches(region, both.slice(0, MAX_SHARED_MATCHES));
  return { region, a, b, clash: buildClash(matches, a, b), scanned: SQUAD_SCAN };
}
