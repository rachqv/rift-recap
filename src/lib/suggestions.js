// Matching for the search box's suggestion dropdown. Pure functions, no browser APIs.

const MAX_RECENT = 5;
const MAX_SAMPLES = 3;

const labelOf = (player) => `${player.gameName}#${player.tagLine}`;

/** How well a player matches the query: 0 = starts with it, 1 = name contains it, 2 = anywhere, -1 = no match. */
function matchRank(player, query) {
  const name = player.gameName.toLowerCase();
  const full = labelOf(player).toLowerCase();
  if (full.startsWith(query)) return 0;
  if (name.includes(query)) return 1;
  if (full.includes(query)) return 2;
  return -1;
}

function filterAndSort(players, query) {
  return players
    .map((player, order) => ({ player, order, rank: matchRank(player, query) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.order - b.order) // better matches first, then most recent
    .map(({ player }) => player);
}

/**
 * Suggestions for what's been typed so far.
 *  - `recents`: players this browser looked up before (`{ gameName, tagLine, region, pinned? }`), newest first. Pinned
 *    ones come first, and win a tie between equally good matches.
 *  - `samples`: demo players (`{ key, gameName, tagLine }`). Shown when they match the query, and as a
 *    starting point for first-time visitors who have no history yet.
 * Returns a flat list; each item carries its `group` and where selecting it should go.
 */
export function getSuggestions(query, savedRecents, samples) {
  const q = query.trim().toLowerCase();
  const recents = [...savedRecents.filter((p) => p.pinned), ...savedRecents.filter((p) => !p.pinned)];

  const recentMatches = q ? filterAndSort(recents, q) : recents;
  const sampleMatches = q ? filterAndSort(samples, q) : recents.length === 0 ? samples : [];

  return [
    ...recentMatches.slice(0, MAX_RECENT).map((p) => ({
      id: `recent:${p.region}:${labelOf(p)}`,
      group: "recent",
      gameName: p.gameName,
      tagLine: p.tagLine,
      region: p.region,
      pinned: Boolean(p.pinned),
      href: `/recap/${p.region}/${encodeURIComponent(p.gameName)}/${encodeURIComponent(p.tagLine)}`,
    })),
    ...sampleMatches.slice(0, MAX_SAMPLES).map((p) => ({
      id: `sample:${p.key}`,
      group: "sample",
      gameName: p.gameName,
      tagLine: p.tagLine,
      region: null,
      href: `/demo?style=${p.key}`,
    })),
  ];
}

/** Splits `text` around the first case-insensitive occurrence of `query`, for highlighting. */
export function splitMatch(text, query) {
  const q = query.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return { before: text, match: "", after: "" };
  return { before: text.slice(0, at), match: text.slice(at, at + q.length), after: text.slice(at + q.length) };
}
