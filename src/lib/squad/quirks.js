import { sumPings } from "./build";

// Per-player numbers from the raw match-v5 participants that `buildRecap` doesn't aggregate: Flash presses, time spent
// dead, pings, wards, gold, healing and a few one-off records. They feed the head-to-head scenarios.

const REMAKE_SECONDS = 300;
const FLASH = 4; // summoner spell id

const max = (best, value) => Math.max(best, value ?? 0);
// Adds a value to a running `{ total, games }`, only when the game actually had it.
const record = (bucket, value) => {
  if (value == null) return;
  bucket.total += value;
  bucket.games++;
};
const average = ({ total, games }) => (games > 0 ? total / games : null);

/** The games that count (no remakes, and only those `puuid` played), as `{ me, info }`. */
function collectGames(matches, puuid) {
  const mine = [];
  for (const match of matches) {
    const info = match.info;
    if (!info || info.gameDuration < REMAKE_SECONDS) continue;
    const me = info.participants.find((p) => p.puuid === puuid);
    if (me) mine.push({ me, info });
  }
  // The recap covers Summoner's Rift when there is any (ARAM has no wards or lanes to speak of), so this does too.
  const rift = mine.filter(({ info }) => info.gameMode === "CLASSIC");
  return rift.length > 0 ? rift : mine;
}

function createTally() {
  return {
    seconds: 0,
    gold: 0,
    dead: 0,
    pings: 0,
    controlWards: 0,
    wardsCleared: 0,
    damageTaken: 0,
    allySupport: 0, // healing and shielding on teammates
    cc: 0,
    flashCasts: 0,
    flashGames: 0,
    losses: 0,
    surrenderedLosses: 0,
    biggestSpree: 0,
    biggestCrit: 0,
    longestLife: 0,
    solo: { total: 0, games: 0 },
    dodged: { total: 0, games: 0 },
    share: { total: 0, games: 0 },
  };
}

function addTotals(tally, me, info) {
  tally.seconds += info.gameDuration;
  tally.gold += me.goldEarned ?? 0;
  tally.dead += me.totalTimeSpentDead ?? 0;
  tally.pings += sumPings(me);
  tally.controlWards += me.detectorWardsPlaced ?? me.visionWardsBoughtInGame ?? 0;
  tally.wardsCleared += me.wardsKilled ?? 0;
  tally.damageTaken += me.totalDamageTaken ?? 0;
  tally.allySupport += (me.totalHealsOnTeammates ?? 0) + (me.totalDamageShieldedOnTeammates ?? 0);
  tally.cc += me.timeCCingOthers ?? 0;
  tally.biggestSpree = max(tally.biggestSpree, me.largestKillingSpree);
  tally.biggestCrit = max(tally.biggestCrit, me.largestCriticalStrike);
  tally.longestLife = max(tally.longestLife, me.longestTimeSpentLiving);
}

function addFlash(tally, me) {
  if (me.summoner1Id !== FLASH && me.summoner2Id !== FLASH) return;
  tally.flashGames++;
  tally.flashCasts += (me.summoner1Id === FLASH ? me.summoner1Casts : me.summoner2Casts) ?? 0;
}

function addLoss(tally, me) {
  if (me.win) return;
  tally.losses++;
  // The flag is set on both teams; on a loss it means your own team gave up.
  if (me.gameEndedInSurrender || me.gameEndedInEarlySurrender) tally.surrenderedLosses++;
}

function addChallenges(tally, me) {
  const c = me.challenges;
  record(tally.solo, c?.soloKills);
  record(tally.dodged, c?.skillshotsDodged);
  record(tally.share, c?.teamDamagePercentage);
}

/**
 * @param matches match-v5 DTOs
 * @param puuid whose numbers to build
 * @returns null with no games; otherwise per-game and per-minute figures. Numbers that depend on optional fields
 * (`challenges.*`, Flash) are null when no game carried them, so a scenario can skip them instead of showing a zero.
 */
export function buildQuirks(matches, puuid) {
  const games = collectGames(matches, puuid);
  if (games.length === 0) return null;

  const tally = createTally();
  for (const { me, info } of games) {
    addTotals(tally, me, info);
    addFlash(tally, me);
    addLoss(tally, me);
    addChallenges(tally, me);
  }

  const n = games.length;
  const minutes = tally.seconds / 60 || 1;
  return {
    games: n,
    goldPerMin: tally.gold / minutes,
    deadShare: tally.dead / (tally.seconds || 1),
    pingsPerGame: tally.pings / n,
    controlWardsPerGame: tally.controlWards / n,
    wardsClearedPerGame: tally.wardsCleared / n,
    damageTakenPerGame: tally.damageTaken / n,
    allySupportPerGame: tally.allySupport / n,
    ccPerGame: tally.cc / n,
    flashPerGame: tally.flashGames > 0 ? tally.flashCasts / tally.flashGames : null,
    // Share of losses that ended with the player's own team surrendering; needs a few losses to mean anything.
    surrenderRate: tally.losses >= 3 ? tally.surrenderedLosses / tally.losses : null,
    losses: tally.losses,
    biggestSpree: tally.biggestSpree,
    biggestCrit: tally.biggestCrit,
    longestLife: tally.longestLife,
    soloKillsPerGame: average(tally.solo),
    dodgedPerGame: average(tally.dodged),
    teamDamageShare: average(tally.share),
  };
}
