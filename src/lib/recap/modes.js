import { defaultT } from "@/lib/i18n/en";
import { buildRecap } from "./buildRecap";

// A mode gets its own slide only when there are enough games for the numbers to mean something.
const MIN_MODE_GAMES = 5;

// Queue ids from Riot's queues.json.
const RANKED = new Set([420, 440]); // Ranked Solo/Duo, Ranked Flex
const NORMAL = new Set([400, 430, 480, 490]); // Draft, Blind, Swiftplay, Quickplay
const ARAM = new Set([450, 2400]); // ARAM, ARAM: Mayhem

/** One `{ t, win }` per game (any mode, remakes excluded), oldest first. The calendar buckets these by the viewer's own time zone. */
function collectActivity(matches, puuid) {
  const activity = [];
  for (const match of matches) {
    const me = match.info.participants.find((p) => p.puuid === puuid);
    if (me && match.info.gameDuration >= 300) activity.push({ t: match.info.gameCreation, win: Boolean(me.win) });
  }
  return activity.sort((a, b) => a.t - b.t);
}

function modeOf(info) {
  if (RANKED.has(info.queueId)) return "ranked";
  if (NORMAL.has(info.queueId)) return "normal";
  if (ARAM.has(info.queueId)) return "aram";
  return "other";
}

/**
 * Splits a match history into the main recap plus per-mode recaps.
 *
 * The main recap covers Summoner's Rift (`gameMode` CLASSIC). ARAM has no roles, short games and
 * little farming, so mixing it in would skew CS, vision, game length and the archetype. If a player
 * has no Rift games at all, the main recap falls back to everything they played.
 */
export function buildRecapSet(matches, puuid) {
  const all = buildRecap(matches, puuid);
  const rift = buildRecap(
    matches.filter((match) => match.info.gameMode === "CLASSIC"),
    puuid,
  );
  const recap = rift.games > 0 ? rift : all;

  const forMode = (mode) =>
    buildRecap(
      matches.filter((match) => modeOf(match.info) === mode),
      puuid,
    );
  const normal = forMode("normal");
  const aram = forMode("aram");
  const ranked = forMode("ranked");

  return {
    recap,
    totalGames: all.games,
    activity: collectActivity(matches, puuid),
    // True when other modes were left out of the main recap, so slides can say "Rift games".
    riftOnly: recap === rift && all.games > rift.games,
    modes: {
      normal: normal.games >= MIN_MODE_GAMES ? normal : null,
      aram: aram.games >= MIN_MODE_GAMES ? aram : null,
      // Only used as a yardstick for the normals slide, so it never gets a slide of its own.
      ranked: ranked.games > 0 ? ranked : null,
    },
  };
}

/** One personalised line for a mode slide, comparing it with the player's Rift and ranked numbers. */
export function getModeInsight(mode, stats, { rift, ranked, topName }, t = defaultT) {
  const { penta } = stats.multikills;

  if (mode === "aram") {
    const gap = rift ? stats.winRate - rift.winRate : 0;
    if (penta > 0) return t("insights.modes.aramPenta", { penta });
    if (stats.perGame.kills >= 11) return t("insights.modes.aramKills", { kills: t.fixed(stats.perGame.kills) });
    if (gap >= 0.06) return t("insights.modes.aramBetter");
    if (gap <= -0.06) return t("insights.modes.aramWorse");
    return t("insights.modes.aramSteady", { top: topName });
  }

  // Normal games: compare against ranked when there is some, since that is what "nothing on the line" means.
  const gap = ranked && ranked.games >= 3 ? stats.winRate - ranked.winRate : 0;
  if (gap >= 0.06) return t("insights.modes.normalBetter");
  if (gap <= -0.06) return t("insights.modes.normalWorse");
  if (stats.uniqueChampions / stats.games >= 0.55) return t("insights.modes.normalExplore", { unique: stats.uniqueChampions, games: stats.games });
  return t("insights.modes.normalMain", { top: topName, winRate: t.percent(stats.topChampions[0].winRate) });
}
