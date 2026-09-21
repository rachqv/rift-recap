import { findMeetings } from "./faceoff";

// Who beats whom when squad members end up on opposite teams. `buildSquadStats` only counts games as teammates, so this
// reads the same loaded games for the times two members faced each other.

/**
 * @param matches match-v5 DTOs (the squad's loaded games)
 * @param members `[{ puuid, ... }]`
 * @returns `{ cells, total, hottest }` where `cells[i][j]` (i !== j) is `{ games, wins }` from member i's side against
 * member j (null when they never met), `total` is how many meetings there were, and `hottest` is the pair with the most
 * meetings: `{ a, b, games, wins: { a, b } }` or null.
 */
export function buildRivalries(matches, members) {
  const cells = members.map(() => members.map(() => null));
  let total = 0;
  let hottest = null;

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const meetings = findMeetings(matches, members[i].puuid, members[j].puuid);
      if (meetings.length === 0) continue;
      const winsI = meetings.filter((m) => m.a.win).length;
      cells[i][j] = { games: meetings.length, wins: winsI };
      cells[j][i] = { games: meetings.length, wins: meetings.length - winsI };
      total += meetings.length;
      if (!hottest || meetings.length > hottest.games) hottest = { a: i, b: j, games: meetings.length, wins: { a: winsI, b: meetings.length - winsI } };
    }
  }
  return { cells, total, hottest };
}
