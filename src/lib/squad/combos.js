// Who should queue together: every duo and trio of squad members, by how they do when they are all on the same team.

const REMAKE_SECONDS = 300;
const MIN_GAMES = 4; // a combination needs this many games together to be ranked
const PRIOR_GAMES = 4; // as if it had this many extra 50/50 games, so a 3-0 start isn't a perfect record

const shrunk = (wins, games) => (wins + PRIOR_GAMES / 2) / (games + PRIOR_GAMES);

/** Every subset of `items` with exactly `size` elements. */
function subsets(items, size) {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...subsets(rest, size - 1).map((s) => [first, ...s]), ...subsets(rest, size)];
}

/** The squad members on each team of a game, as lists of participants. */
function membersByTeam(info, indexOf) {
  const byTeam = new Map();
  for (const p of info.participants) {
    if (!indexOf.has(p.puuid)) continue;
    byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);
  }
  return [...byTeam.values()];
}

/** Counts this game (a win if the team won) for every duo and trio in `group`, the members of one team. */
function addGroup(tallies, group, indexOf) {
  const ids = group.map((p) => indexOf.get(p.puuid)).sort((a, b) => a - b);
  for (const size of [2, 3]) {
    for (const combo of subsets(ids, size)) {
      const key = combo.join("-");
      const entry = tallies.get(key) ?? { members: combo, games: 0, wins: 0 };
      entry.games++;
      if (group[0].win) entry.wins++;
      tallies.set(key, entry);
    }
  }
}

/**
 * @param matches match-v5 DTOs
 * @param members `[{ puuid }]`
 * @returns `{ duos, trios, pick }`. `duos` and `trios` list the ranked combinations (`{ members: [index...], games, wins,
 * winRate, score }`, best first, only those with at least 4 games together). `pick` is the recommendation: the best trio when
 * it beats the best duo, else the best duo (null when there is nothing to recommend).
 */
export function bestCombos(matches, members) {
  const indexOf = new Map(members.map((m, i) => [m.puuid, i]));
  const tallies = new Map();

  for (const match of matches) {
    const info = match.info;
    if (!info || info.gameDuration < REMAKE_SECONDS) continue;
    for (const group of membersByTeam(info, indexOf)) addGroup(tallies, group, indexOf);
  }

  const ranked = [...tallies.values()]
    .filter((c) => c.games >= MIN_GAMES)
    .map((c) => ({ ...c, winRate: c.wins / c.games, score: shrunk(c.wins, c.games) }))
    .sort((a, b) => b.score - a.score || b.games - a.games);
  const duos = ranked.filter((c) => c.members.length === 2);
  const trios = ranked.filter((c) => c.members.length === 3);
  const pick = trios[0] && (!duos[0] || trios[0].score >= duos[0].score) ? trios[0] : (duos[0] ?? null);
  return { duos, trios, pick };
}
