import { defaultT } from "@/lib/i18n/en";

// Champion mastery from Riot, set against what you actually played this season: the champions you have real history with
// but barely touched lately.

const MIN_POINTS = 20000; // less than this isn't a champion you know
const MAX_RECENT_GAMES = 2; // played this often or less counts as "barely touched"
const MAX_SHOWN = 4;

/**
 * @param mastery Riot's mastery entries: `[{ championId, championLevel, championPoints, lastPlayTime }]`
 * @param recap a `buildRecap` result (for the games each champion has this season)
 * @param keyToId `index.byKey`: numeric champion key (as a string) to Data Dragon id
 * @returns null, or `[{ id, level, points, games, lastPlayed }]`, most points first
 */
export function getOldFlames(mastery, recap, keyToId) {
  if (!Array.isArray(mastery)) return null;
  const played = new Map(recap.champions.map((c) => [c.id, c.games]));

  const flames = mastery
    .map((m) => ({ id: keyToId?.[String(m.championId)], level: m.championLevel, points: m.championPoints, lastPlayed: m.lastPlayTime }))
    .filter((m) => m.id && Number.isFinite(m.points) && m.points >= MIN_POINTS && (played.get(m.id) ?? 0) <= MAX_RECENT_GAMES)
    .map((m) => ({ ...m, games: played.get(m.id) ?? 0 }))
    .sort((a, b) => b.points - a.points)
    .slice(0, MAX_SHOWN);
  return flames.length > 0 ? flames : null;
}

/** "212K" for 212,345 points (in the reader's language: "21万" in Japanese). */
export const pointsText = (points, t = defaultT) => t.number(points, { notation: "compact", maximumFractionDigits: points >= 1000000 ? 1 : 0 });
