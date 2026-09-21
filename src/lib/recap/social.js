// Duo and matchup stats: who you play with, and which lane opponents you beat or lose to.
// These come from the other nine players listed in each match-v5 game.

// A teammate only counts as a duo after this many games together; random teammates rarely repeat.
const MIN_DUO_GAMES = 3;
// A lane opponent only counts after this many meetings. Two is thin, but champions rarely repeat more often.
const MIN_MATCHUP_GAMES = 2;

const kdaOf = (k, d, a) => (k + a) / Math.max(d, 1);

export function createSocialTally() {
  return { teammates: new Map(), matchups: new Map() };
}

const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const topKey = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

function addTeammate(tally, me, p, won) {
  const mate = tally.teammates.get(p.puuid) ?? { games: 0, wins: 0, pairs: new Map() };
  mate.games++;
  if (won) mate.wins++;
  // Later games overwrite earlier ones, so a renamed player shows their current name.
  mate.gameName = p.riotIdGameName || p.summonerName || mate.gameName || null;
  mate.tagLine = p.riotIdTagline || mate.tagLine || null;
  mate.profileIcon = p.profileIcon ?? mate.profileIcon ?? null;
  bump(mate.pairs, `${me.championName}|${p.championName}`);
  tally.teammates.set(p.puuid, mate);
}

/** Lane opponent: the enemy in the same position. Needs a position, so ARAM-style games are skipped. */
function addMatchup(tally, me, participants, won) {
  if (!me.teamPosition) return;
  const opponent = participants.find((p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition);
  if (!opponent) return;
  const entry = tally.matchups.get(opponent.championName) ?? { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, yours: new Map() };
  entry.games++;
  if (won) entry.wins++;
  entry.kills += me.kills;
  entry.deaths += me.deaths;
  entry.assists += me.assists;
  bump(entry.yours, me.championName);
  tally.matchups.set(opponent.championName, entry);
}

/** Records one game. `won` is whether `me` won; `participants` is the game's full player list. */
export function addGameToTally(tally, me, participants, won) {
  for (const p of participants) {
    if (!p.puuid || p.puuid === "BOT" || p.puuid === me.puuid || p.teamId !== me.teamId) continue;
    addTeammate(tally, me, p, won);
  }
  addMatchup(tally, me, participants, won);
}

/** Turns a tally into `{ duo, nemesis, bestMatchup }` (each null when there isn't enough data). */
export function summarizeTally(tally, { games, wins }) {
  // --- Duo: the teammate you've played with most, if it's a real pattern.
  const [duoEntry] = [...tally.teammates.values()]
    .filter((m) => m.games >= MIN_DUO_GAMES && m.gameName)
    .sort((a, b) => b.games - a.games || b.wins - a.wins);

  let duo = null;
  if (duoEntry) {
    const [you, them] = (topKey(duoEntry.pairs) ?? "|").split("|");
    const apart = games - duoEntry.games;
    duo = {
      gameName: duoEntry.gameName,
      tagLine: duoEntry.tagLine,
      profileIcon: duoEntry.profileIcon,
      games: duoEntry.games,
      wins: duoEntry.wins,
      winRate: duoEntry.wins / duoEntry.games,
      // Your win rate in the games without them; null when you never played without them.
      soloWinRate: apart > 0 ? (wins - duoEntry.wins) / apart : null,
      bestPair: { you, them },
    };
  }

  // --- Matchups: lane opponents you keep meeting.
  const matchups = [...tally.matchups.entries()]
    .filter(([, m]) => m.games >= MIN_MATCHUP_GAMES)
    .map(([id, m]) => ({
      id,
      games: m.games,
      wins: m.wins,
      losses: m.games - m.wins,
      winRate: m.wins / m.games,
      kda: kdaOf(m.kills, m.deaths, m.assists),
      yourChampion: topKey(m.yours),
    }));

  // Ranked by net result, not win rate: a champion that beat you 12 times is a nemesis; one you met twice
  // and lost to is bad luck. Win rate breaks ties.
  const net = (m) => m.wins - m.losses;
  const nemesis = matchups.filter((m) => m.winRate < 0.5).sort((a, b) => net(a) - net(b) || a.winRate - b.winRate)[0] ?? null;
  const bestMatchup = matchups.filter((m) => m.winRate > 0.5).sort((a, b) => net(b) - net(a) || b.winRate - a.winRate)[0] ?? null;

  return { duo, nemesis, bestMatchup };
}
