// When each ranked year began: the day ranks reset (around noon local server time; this uses the start of that day, UTC).
// Riot runs three splits a year (Season 1 to 3) but only resets ranks once, so the "season" recapped here is the whole year.
// Add a year's date when Riot announces it; until then that year falls back to January 1.
const SEASON_STARTS = { 2026: "2026-01-08" };
const YEAR = new Date().getFullYear();
export const SEASON_START = new Date(`${SEASON_STARTS[YEAR] ?? `${YEAR}-01-01`}T00:00:00Z`);

// Riot caps this at 100 per request (going higher needs paging). Each match is one request, and dev keys only allow
// 100 requests / 2 minutes, so a first, uncached load of a full 100 games can hit the limit on a dev key.
// Matches are cached for a week, so repeat views are cheap. A bigger sample also makes the archetype more reliable.
export const MAX_MATCHES = 100;

// Head-to-head loads two full recaps, so each player gets a smaller window than a solo recap. 80 games is enough for
// win rates and per-game averages to settle; the newest games come first, so it is always their latest 80.
export const VERSUS_MATCHES = 80;

// Squad recap: how many of each player's latest games to check for shared ones (paged, 100 ids per request, and only
// ids are fetched, so a deep scan is cheap), and how many of the shared games to load, newest first.
export const SQUAD_SCAN = 300;
export const MAX_SHARED_MATCHES = 80;

// Head-to-head also reads the match timeline of the games the two played against each other: one more request each,
// so only the latest few.
export const FACEOFF_TIMELINES = 10;

// The solo recap also reads the match timeline of your latest games, to see how you stand against your lane opponent at
// 15 minutes. One request each, so only the latest few.
export const EARLY_TIMELINES = 10;

// Time ranges a recap can cover: `since` is when it starts. "season" is the default.
//
// The names of the ranges are the `common.range.<key>` messages.
//
// A "last N days" range starts at midnight UTC, N days ago, so it is a window of whole days rather than one that slides by
// the second (and the Riot request for it stays the same all day).
const DAY = 86400000;
const daysAgo = (days) => new Date(Math.floor((Date.now() - days * DAY) / DAY) * DAY);

// A range with `previous` also has a period before it to compare with: the solo recap then loads back to `previous()` and
// splits the games there (see `loadRecap`). Only the short one has it: a long range would need more games than a recap loads.
export const RANGES = {
  season: { since: () => SEASON_START },
  "90d": { since: () => daysAgo(90) },
  "30d": { since: () => daysAgo(30) },
  "7d": { since: () => daysAgo(7), previous: () => daysAgo(14) },
};

/** The range named by a `?range=` value, falling back to the season for anything unknown. */
export const rangeOf = (value) => {
  const key = Array.isArray(value) ? value[0] : value;
  return Object.hasOwn(RANGES, key) ? key : "season";
};
