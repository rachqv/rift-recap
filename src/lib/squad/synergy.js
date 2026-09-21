// Two reads on how a pair does as teammates. `synergy` compares each player's win rate in the games they played apart
// with their win rate in the games they played together. `carry` looks at who deals more damage in the shared games and
// whether the team does better when it is them. Pure functions over match-v5 DTOs.

const REMAKE_SECONDS = 300;

// Win rates over fewer games than this are mostly luck.
const MIN_ALONE_GAMES = 8;
const MIN_TOGETHER_GAMES = 3;
// A difference has to be at least this large (in win rate) to be called a lift or a drag.
const SYNERGY_GAP = 0.1;
const CARRY_GAP = 0.15;

/**
 * A player's record in the games where they weren't teammates with the other player.
 * @param matches the player's loaded games (any mix)
 * @param puuid the player
 * @param togetherIds match ids to leave out (the games they played together)
 * @returns `{ games, wins }`
 */
export function apartRecord(matches, puuid, togetherIds) {
  let games = 0;
  let wins = 0;
  for (const match of matches) {
    const info = match.info;
    if (!info || info.gameDuration < REMAKE_SECONDS || togetherIds.has(match.metadata?.matchId)) continue;
    const me = info.participants.find((p) => p.puuid === puuid);
    if (!me) continue;
    games++;
    if (me.win) wins++;
  }
  return { games, wins };
}

/**
 * @param apart `{ a, b }`, each `{ games, wins }` from `apartRecord`
 * @param together `{ a, b }`, each `{ games, wins }`: the same two players' record in their shared games
 * @returns null when neither player has enough games both ways; otherwise `{ a, b, verdict }`. Each side is
 * `{ apart, together, delta }` (win rates and `together - apart`), or null for a player without enough games. `verdict`
 * is "lift" when both improve together, "drag" when both do worse, "mixed" otherwise, and "flat" when nothing moves.
 */
export function buildSynergy(apart, together) {
  const side = (key) => {
    const [alone, team] = [apart[key], together[key]];
    if (alone.games < MIN_ALONE_GAMES || team.games < MIN_TOGETHER_GAMES) return null;
    const [apartRate, togetherRate] = [alone.wins / alone.games, team.wins / team.games];
    return { apart: apartRate, together: togetherRate, apartGames: alone.games, togetherGames: team.games, delta: togetherRate - apartRate };
  };
  const [a, b] = [side("a"), side("b")];
  if (!a && !b) return null;

  const deltas = [a, b].filter(Boolean).map((s) => s.delta);
  const verdict = deltas.every((d) => d >= SYNERGY_GAP) ? "lift" : deltas.every((d) => d <= -SYNERGY_GAP) ? "drag" : deltas.some((d) => Math.abs(d) >= SYNERGY_GAP) ? "mixed" : "flat";
  return { a, b, verdict };
}

/** `{ a, b }`, the two players' participants, when the game counts and they were on the same team; otherwise null. */
function sameTeamPair(info, aPuuid, bPuuid) {
  if (!info || info.gameDuration < REMAKE_SECONDS) return null;
  const a = info.participants.find((p) => p.puuid === aPuuid);
  const b = info.participants.find((p) => p.puuid === bPuuid);
  return a && b && a.teamId === b.teamId ? { a, b } : null;
}

/**
 * Damage lead in the games the two played on the same team.
 * @param matches match-v5 DTOs (only games with both on the same team count)
 * @returns null with no such games; otherwise `{ games, lead: { a, b }, record: { a, b }, better }` where `lead` counts the
 * games each dealt more damage to champions (ties count for neither), and `record[side]` is the team's `{ games, wins }`
 * in games where that player led. `better` is "a" or "b" when the team's win rate is clearly higher with them leading,
 * else null.
 */
export function buildCarry(matches, aPuuid, bPuuid) {
  const lead = { a: 0, b: 0 };
  const record = { a: { games: 0, wins: 0 }, b: { games: 0, wins: 0 } };
  let games = 0;

  for (const match of matches) {
    const pair = sameTeamPair(match.info, aPuuid, bPuuid);
    if (!pair) continue;
    games++;
    const [da, db] = [pair.a.totalDamageDealtToChampions ?? 0, pair.b.totalDamageDealtToChampions ?? 0];
    if (da === db) continue;
    const side = da > db ? "a" : "b";
    lead[side]++;
    record[side].games++;
    if (pair.a.win) record[side].wins++;
  }
  if (games === 0) return null;

  const rate = (r) => (r.games >= MIN_TOGETHER_GAMES ? r.wins / r.games : null);
  const [ra, rb] = [rate(record.a), rate(record.b)];
  const better = ra != null && rb != null && Math.abs(ra - rb) >= CARRY_GAP ? (ra > rb ? "a" : "b") : null;
  return { games, lead, record, better };
}
