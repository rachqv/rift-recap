// Champions to try: for the champions you win with, other champions you have hardly played that are built the same way. Similar means the
// same class tags, close scores for attack, defense, magic and difficulty (Data Dragon rates each 0 to 10) and the same resource.
//
// This says "alike", not "you will win with it": there is no data here on how anyone does with a champion they haven't played.

const MIN_ANCHOR_GAMES = 5; // a champion you have this many games on is one you really know
const MAX_TRIED_GAMES = 2; // a candidate is a champion you have at most this many games on
const ANCHORS = 2;
const PICKS_PER_ANCHOR = 2;
const STAT_SPAN = 40; // the most four 0-10 scores can differ by, in total

/** How alike two champions are: higher is more alike. `a` and `b` are `{ tags, info?, partype? }` from the champion index. */
function similarity(a, b) {
  const sharedTags = a.tags.filter((tag) => b.tags.includes(tag)).length;
  const primary = a.tags[0] === b.tags[0] ? 2 : 0;
  const stats = a.info && b.info ? 1 - ["attack", "defense", "magic", "difficulty"].reduce((sum, key) => sum + Math.abs(a.info[key] - b.info[key]), 0) / STAT_SPAN : 0.5;
  const resource = a.partype && a.partype === b.partype ? 0.5 : 0;
  return primary + sharedTags + 2 * stats + resource;
}

/**
 * @param recap a `buildRecap` result (its `champions` and `winRate`)
 * @param byId the champion index's `byId`: `{ [id]: { tags, info?, partype? } }`
 * @param canonical maps an id from a match to the index's id (a few differ), the identity by default
 * @returns null without a champion to build on, else `[{ anchor: { id, games, winRate }, picks: [{ id, similarity }] }]`: up to two
 * champions you win with (at least as often as you win overall, over at least 5 games), each with up to two champions you have played
 * two games or fewer, most alike first. A champion is suggested once.
 */
export function getPoolAdvice(recap, byId, canonical = (id) => id) {
  const played = new Map();
  for (const champion of recap.champions ?? []) played.set(canonical(champion.id), (played.get(canonical(champion.id)) ?? 0) + champion.games);

  const anchors = (recap.champions ?? [])
    .filter((c) => c.games >= MIN_ANCHOR_GAMES && c.winRate >= recap.winRate && byId[canonical(c.id)]?.tags?.length)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
    .slice(0, ANCHORS);

  const candidates = Object.keys(byId)
    .filter((id) => byId[id].tags?.length && (played.get(id) ?? 0) <= MAX_TRIED_GAMES)
    .sort(); // a fixed order, so ties are always broken the same way

  const taken = new Set();
  const advice = [];
  for (const anchor of anchors) {
    const from = byId[canonical(anchor.id)];
    const picks = candidates
      .filter((id) => !taken.has(id))
      .map((id) => ({ id, similarity: similarity(from, byId[id]) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, PICKS_PER_ANCHOR);
    picks.forEach((pick) => taken.add(pick.id));
    if (picks.length > 0) advice.push({ anchor: { id: anchor.id, games: anchor.games, winRate: anchor.winRate }, picks });
  }
  return advice.length > 0 ? advice : null;
}
