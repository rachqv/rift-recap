import { buildTimelineDuel } from "./timeline";

// Head-on games: the times two players were on opposite teams in the same match. `buildSquadStats` only counts games
// where they were teammates, so this covers what it leaves out (customs, ARAM lobbies, plain bad luck in queue).

const REMAKE_SECONDS = 300;

const kdaOf = (p) => ((p.kills ?? 0) + (p.assists ?? 0)) / Math.max(p.deaths ?? 0, 1);
const line = (p) => ({ champion: p.championName, kills: p.kills ?? 0, deaths: p.deaths ?? 0, assists: p.assists ?? 0, win: Boolean(p.win) });

/** Every game where the two were on opposite teams, oldest first: `[{ matchId, playedAt, a, b }]` (a and b are their participants). */
export function findMeetings(matches, aPuuid, bPuuid) {
  const meetings = [];
  for (const match of matches) {
    const info = match.info;
    if (!info || info.gameDuration < REMAKE_SECONDS) continue;
    const a = info.participants.find((p) => p.puuid === aPuuid);
    const b = info.participants.find((p) => p.puuid === bPuuid);
    if (a && b && a.teamId !== b.teamId) meetings.push({ matchId: match.metadata?.matchId, playedAt: info.gameCreation, a, b });
  }
  return meetings.sort((x, y) => x.playedAt - y.playedAt);
}

/**
 * @param matches match-v5 DTOs (any mix; only games with both players on opposite teams count)
 * @param timelines optional `Map` of match id -> match-v5 timeline, for some or all of those games
 * @returns null with no such games; otherwise
 *   `{ games, wins: { a, b }, outplayed: { a, b }, duels: { games, wins: { a, b } }, last, timeline }` where
 *   - `wins` is who's team won each meeting
 *   - `outplayed` is who had the better KDA in each meeting (ties count for neither)
 *   - `duels` are the meetings where they played the same role, so they were lane opponents
 *   - `last` is the most recent meeting: `{ playedAt, role, a, b }` with each side `{ champion, kills, deaths, assists, win }`
 *   - `timeline` is `buildTimelineDuel`'s result over the meetings that have a timeline (null when none do)
 */
export function buildFaceOff(matches, aPuuid, bPuuid, timelines = new Map()) {
  const meetings = findMeetings(matches, aPuuid, bPuuid);
  if (meetings.length === 0) return null;

  const wins = { a: 0, b: 0 };
  const outplayed = { a: 0, b: 0 };
  const duels = { games: 0, wins: { a: 0, b: 0 } };
  for (const { a, b } of meetings) {
    wins[a.win ? "a" : "b"]++;
    const [ka, kb] = [kdaOf(a), kdaOf(b)];
    if (ka !== kb) outplayed[ka > kb ? "a" : "b"]++;
    if (a.teamPosition && a.teamPosition === b.teamPosition) {
      duels.games++;
      duels.wins[a.win ? "a" : "b"]++;
    }
  }

  const { playedAt, a, b } = meetings.at(-1);
  return {
    games: meetings.length,
    wins,
    outplayed,
    duels,
    last: { playedAt, role: a.teamPosition && a.teamPosition === b.teamPosition ? a.teamPosition : null, a: line(a), b: line(b) },
    timeline: buildTimelineDuel(meetings, timelines, { a: aPuuid, b: bPuuid }),
  };
}
