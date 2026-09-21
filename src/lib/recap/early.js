import { defaultT } from "@/lib/i18n/en";
import { CHECKPOINT_MINUTE, EVEN_GOLD } from "@/lib/squad/timeline";

// Early game or late game: how you stand against your lane opponent at the 15-minute mark in your recent games, and what
// you do with it. Needs match timelines (an extra request per game), so it covers only the latest few.

const MIN_GAMES = 5;

/** `{ me, opponent }`: the player and the enemy in the same position, or null (no position, as in ARAM, or no such enemy). */
function findLane(match, puuid) {
  const participants = match.info?.participants;
  const me = participants?.find((p) => p.puuid === puuid);
  if (!me?.teamPosition) return null;
  const opponent = participants.find((p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition);
  return opponent ? { me, opponent } : null;
}

/** Both players' gold at the checkpoint as `[mine, theirs]`, or null when the timeline doesn't have it. */
function checkpointGold(timeline, me, opponent) {
  const ids = timeline?.metadata?.participants;
  if (!ids) return null;
  const frame = timeline.info?.frames?.[CHECKPOINT_MINUTE]?.participantFrames;
  const [mine, theirs] = [frame?.[ids.indexOf(me.puuid) + 1], frame?.[ids.indexOf(opponent.puuid) + 1]];
  return mine?.totalGold == null || theirs?.totalGold == null ? null : [mine.totalGold, theirs.totalGold];
}

/** Your gold lead over your lane opponent at the checkpoint, and whether you won: `{ diff, won }`. Null without the lane or the gold. */
function laneGap(match, timeline, puuid) {
  const lane = findLane(match, puuid);
  const gold = lane && checkpointGold(timeline, lane.me, lane.opponent);
  return gold ? { diff: gold[0] - gold[1], won: lane.me.win } : null;
}

function addGap(tally, { diff, won }) {
  tally.games++;
  if (Math.abs(diff) < EVEN_GOLD) {
    tally.even++;
  } else if (diff > 0) {
    tally.ahead++;
    if (won) tally.winsAhead++;
  } else {
    tally.behind++;
    if (won) tally.winsBehind++;
  }
}

function profileOf({ games, ahead, behind }, rateAhead, rateBehind) {
  if (ahead / games >= 0.55 && rateAhead >= 0.6) return "early";
  return behind / games >= 0.4 && behind >= 3 && rateBehind >= 0.4 ? "late" : "steady";
}

/**
 * @param matches match-v5 DTOs
 * @param timelines `Map` of match id -> match-v5 timeline
 * @param puuid the player
 * @returns null with fewer than 5 usable games; otherwise
 *   `{ games, ahead, behind, even, winsAhead, winsBehind, aheadRate, profile, line }` where `ahead`/`behind`/`even` count
 *   games by gold against the lane opponent at 15 minutes, and `winsAhead`/`winsBehind` count wins from each. `profile` is
 *   "early", "late" or "steady". `t` writes the line (English by default).
 */
export function buildEarlyGame(matches, timelines, puuid, t = defaultT) {
  const tally = { games: 0, ahead: 0, behind: 0, even: 0, winsAhead: 0, winsBehind: 0 };

  for (const match of matches) {
    const gap = laneGap(match, timelines.get(match.metadata?.matchId), puuid);
    if (gap) addGap(tally, gap);
  }
  if (tally.games < MIN_GAMES) return null;

  const aheadRate = tally.ahead / tally.games;
  const [rateAhead, rateBehind] = [tally.ahead ? tally.winsAhead / tally.ahead : 0, tally.behind ? tally.winsBehind / tally.behind : 0];
  const result = { ...tally, aheadRate, profile: profileOf(tally, rateAhead, rateBehind), winRateBehind: rateBehind };
  return { ...result, line: earlyLine(result, t) };
}

/** The sentence about an early-game result, written when it is shown (the result itself is language-free data). */
export function earlyLine({ profile, aheadRate, behind, games, winRateBehind }, t = defaultT) {
  return t(`insights.early.${profile}`, { ahead: t.percent(aheadRate), behind: t.percent(behind / games), comeback: t.percent(winRateBehind) });
}
