// What the match timeline adds to a head-on meeting: who was ahead early, who turned a lead into a win, and who killed
// whom. Pure functions over match-v5 timeline DTOs; `load.js` fetches them.

/** The minute the "who was ahead" snapshot is taken at. Timeline frames are one per minute, so this indexes `frames`. */
export const CHECKPOINT_MINUTE = 15;

// A gold gap smaller than this at the checkpoint is a level game, not a lead.
export const EVEN_GOLD = 150;

const SIDES = ["a", "b"];
const sides = () => ({ a: 0, b: 0 });
const other = (side) => (side === "a" ? "b" : "a");

// Timeline participant ids are 1-based positions in `metadata.participants` (a list of puuids).
function participantIdOf(timeline, puuid) {
  const index = timeline.metadata?.participants?.indexOf(puuid);
  return index >= 0 ? index + 1 : null;
}

/** Notes the first dragon of a game (which team took it) as `first.dragon`. */
function noteDragon(first, event, at) {
  const isDragon = event.type === "ELITE_MONSTER_KILL" && event.monsterType === "DRAGON" && event.killerTeamId;
  if (isDragon && (!first.dragon || at < first.dragon.at)) first.dragon = { at, team: event.killerTeamId };
}

/** Counts a kill between the two players (and whether it was solo) into `duel`, and notes which of them died first as `first.died`. */
function noteKill(duel, first, ids, event, at) {
  for (const side of SIDES) {
    if (event.victimId === ids[side] && (!first.died || at < first.died.at)) first.died = { at, side };
    if (event.killerId !== ids[side] || event.victimId !== ids[other(side)]) continue;
    duel.kills[side]++;
    if (!event.assistingParticipantIds?.length) duel.solo[side]++;
  }
}

/** Walks every event of a game once: kills go into `duel`; returns the first dragon `{ at, team }` and the first of the two to die `{ at, side }`. */
function scanEvents(duel, frames, ids) {
  const first = { dragon: null, died: null };
  for (const frame of frames) {
    for (const event of frame.events ?? []) {
      const at = event.timestamp ?? 0;
      noteDragon(first, event, at);
      if (event.type === "CHAMPION_KILL") noteKill(duel, first, ids, event, at);
    }
  }
  return first;
}

/** A's total gold minus B's at each minute that has both, or an empty list. */
function goldPoints(frames, ids) {
  return frames.flatMap((frame, minute) => {
    const [fa, fb] = [frame.participantFrames?.[ids.a], frame.participantFrames?.[ids.b]];
    return fa?.totalGold != null && fb?.totalGold != null ? [{ minute, diff: fa.totalGold - fb.totalGold }] : [];
  });
}

/** Who was ahead at the checkpoint, and whether they won. `players` is `{ a, b }`, the two participants. */
function addCheckpoint(duel, frames, ids, players) {
  const at = frames[CHECKPOINT_MINUTE]?.participantFrames;
  const [fa, fb] = [at?.[ids.a], at?.[ids.b]];
  if (!fa || !fb || fa.totalGold == null || fb.totalGold == null) return;
  const early = duel.early;
  early.games++;
  const gold = fa.totalGold - fb.totalGold;
  early.goldDiff += gold;
  early.xpDiff += (fa.xp ?? 0) - (fb.xp ?? 0);

  if (Math.abs(gold) < EVEN_GOLD) {
    early.ahead.even++;
    return;
  }
  const leader = gold > 0 ? "a" : "b";
  early.ahead[leader]++;
  early.converted[leader].ahead++;
  if (players[leader].win) early.converted[leader].won++;
  else early.comebacks[other(leader)]++;
}

function addMeeting(duel, { matchId, a, b }, timelines, puuids) {
  const timeline = timelines.get(matchId);
  const frames = timeline?.info?.frames;
  if (!frames?.length) return;
  const ids = { a: participantIdOf(timeline, puuids.a), b: participantIdOf(timeline, puuids.b) };
  if (!ids.a || !ids.b) return;
  duel.games++;

  const players = { a, b };
  const first = scanEvents(duel, frames, ids);
  if (first.died) duel.firstDeath[first.died.side]++;
  if (first.dragon) {
    for (const side of SIDES) if (players[side].teamId === first.dragon.team) duel.dragons[side]++;
  }

  // Meetings come oldest first, so the last one with gold frames is the latest.
  const points = goldPoints(frames, ids);
  if (points.length > 1) duel.curve = { points, aWon: Boolean(a.win) };

  addCheckpoint(duel, frames, ids, players);
}

/**
 * @param meetings `[{ matchId, a, b }]` where a and b are the two players' match-v5 participants, on opposite teams
 * @param timelines `Map` of match id -> match-v5 timeline. Meetings without one are skipped.
 * @param puuids `{ a, b }`
 * @returns null when no meeting has a usable timeline; otherwise
 *   `{ games, kills, solo, firstDeath, dragons, curve, early }` where
 *   - `kills` is how often each killed the other, and `solo` how many of those had no assists
 *   - `firstDeath` counts, per side, the games where that player was the first of the two to die
 *   - `dragons` counts, per side, the games where that player's team took the first dragon
 *   - `curve` is the gold lead over time in the latest game with a timeline: `{ points: [{ minute, diff }], aWon }` where
 *     `diff` is A's total gold minus B's (negative when B leads); null when that game has no gold frames
 *   - `early` is null when no game reached the checkpoint, else `{ games, ahead: { a, b, even }, goldDiff, xpDiff,
 *     converted, comebacks }`: `goldDiff` and `xpDiff` are A's average lead over B at the checkpoint (negative when
 *     B leads), `converted[side]` is `{ ahead, won }` (games that side led at the checkpoint, and won), and
 *     `comebacks` counts wins from behind.
 */
export function buildTimelineDuel(meetings, timelines, puuids) {
  const duel = {
    games: 0,
    kills: sides(),
    solo: sides(),
    firstDeath: sides(),
    dragons: sides(),
    curve: null,
    early: { games: 0, ahead: { a: 0, b: 0, even: 0 }, goldDiff: 0, xpDiff: 0, converted: { a: { ahead: 0, won: 0 }, b: { ahead: 0, won: 0 } }, comebacks: sides() },
  };
  for (const meeting of meetings) addMeeting(duel, meeting, timelines, puuids);

  if (duel.games === 0) return null;
  const { early } = duel;
  return {
    games: duel.games,
    kills: duel.kills,
    solo: duel.solo,
    firstDeath: duel.firstDeath,
    dragons: duel.dragons,
    curve: duel.curve,
    early:
      early.games === 0
        ? null
        : { games: early.games, ahead: early.ahead, goldDiff: early.goldDiff / early.games, xpDiff: early.xpDiff / early.games, converted: early.converted, comebacks: early.comebacks },
  };
}
