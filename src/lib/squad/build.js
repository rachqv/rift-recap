import { sumPings } from "@/lib/pings";
import { pickAwards } from "./awards";

// Squad statistics over the games a group of players played together.

const MIN_MEMBER_GAMES = 3; // fewer shared games than this and a member is left out of the awards
const MIN_PAIR_GAMES = 3; // ...and a pair needs this many games together to be ranked
const REMAKE_SECONDS = 300;

export { sumPings };
const topKey = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

const emptyTally = () => ({
  games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, damageTaken: 0, cs: 0, vision: 0, cc: 0, dead: 0,
  pings: 0, stolen: 0, objDamage: 0, turrets: 0, firstBloods: 0, kpSum: 0, kpN: 0, seconds: 0, icon: null,
  champions: new Map(), roles: new Map(), roleStats: new Map(), // roleStats: role -> { games, wins }
});

const SUMMED_FIELDS = {
  kills: "kills",
  deaths: "deaths",
  assists: "assists",
  damage: "totalDamageDealtToChampions",
  damageTaken: "totalDamageTaken",
  vision: "visionScore",
  cc: "timeCCingOthers",
  dead: "totalTimeSpentDead",
  stolen: "objectivesStolen",
  objDamage: "damageDealtToObjectives",
}; // tally field -> the participant field it adds up

/** The members on each team of a game, for teams with two or more of them. */
function squadTeamsOf(info, indexOf) {
  const byTeam = new Map();
  for (const p of info.participants) {
    if (!indexOf.has(p.puuid)) continue;
    byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);
  }
  return [...byTeam.values()].filter((group) => group.length >= 2);
}

function addPlayerGame(tally, p, seconds) {
  tally.games++;
  if (p.win) tally.wins++;
  for (const [field, source] of Object.entries(SUMMED_FIELDS)) tally[field] += p[source] ?? 0;
  tally.cs += (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);
  tally.pings += sumPings(p);
  tally.turrets += p.turretTakedowns ?? p.turretKills ?? 0;
  if (p.firstBloodKill) tally.firstBloods++;
  if (p.challenges?.killParticipation != null) {
    tally.kpSum += p.challenges.killParticipation;
    tally.kpN++;
  }
  tally.seconds += seconds;
  if (p.profileIcon != null) tally.icon = p.profileIcon;
  bump(tally.champions, p.championName);
  if (p.teamPosition) {
    bump(tally.roles, p.teamPosition);
    const roleStat = tally.roleStats.get(p.teamPosition) ?? { games: 0, wins: 0 };
    roleStat.games++;
    if (p.win) roleStat.wins++;
    tally.roleStats.set(p.teamPosition, roleStat);
  }
}

/** Every pair of members on the same team shares this result. */
function addPairGames(pairTallies, squadTeams, indexOf) {
  for (const group of squadTeams) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [indexOf.get(group[i].puuid), indexOf.get(group[j].puuid)].sort((x, y) => x - y);
        const key = `${a}-${b}`;
        const pair = pairTallies.get(key) ?? { a, b, games: 0, wins: 0 };
        pair.games++;
        if (group[i].win) pair.wins++;
        pairTallies.set(key, pair);
      }
    }
  }
}

function memberStats(member, index, t) {
  const n = t.games || 1;
  const minutes = t.seconds / 60 || 1;
  return {
    index,
    puuid: member.puuid,
    gameName: member.gameName,
    tagLine: member.tagLine,
    profileIcon: t.icon ?? member.profileIcon ?? null,
    games: t.games,
    wins: t.wins,
    winRate: t.wins / n,
    kills: t.kills,
    deaths: t.deaths,
    assists: t.assists,
    kda: (t.kills + t.assists) / Math.max(t.deaths, 1),
    perGame: { kills: t.kills / n, deaths: t.deaths / n, assists: t.assists / n, pings: t.pings / n, damageTaken: t.damageTaken / n, timeDead: t.dead / n, cc: t.cc / n },
    perMin: { damage: t.damage / minutes, cs: t.cs / minutes, vision: t.vision / minutes, objDamage: t.objDamage / minutes },
    stolen: t.stolen,
    turrets: t.turrets,
    firstBloods: t.firstBloods,
    killParticipation: t.kpN ? t.kpSum / t.kpN : null,
    topChampion: topKey(t.champions),
    role: topKey(t.roles),
    // Games and wins in each role you played with the squad, most played first: `[{ role, games, wins }]`.
    roles: [...t.roleStats.entries()].map(([role, stat]) => ({ role, ...stat })).sort((a, b) => b.games - a.games || b.wins - a.wins),
  };
}

/** The longest win and loss streaks over `games`, which are oldest first. */
function longestStreaks(games) {
  const streaks = { win: 0, loss: 0 };
  let run = 0;
  for (const game of games) {
    run = game.win ? Math.max(run, 0) + 1 : Math.min(run, 0) - 1;
    if (run > 0) streaks.win = Math.max(streaks.win, run);
    else streaks.loss = Math.max(streaks.loss, -run);
  }
  return streaks;
}

/** All pairs by games together, plus the best and worst of those with enough games to rank (worst is null if none is worse than the best). */
function rankPairs(pairTallies) {
  const pairs = [...pairTallies.values()]
    .map((pair) => ({ ...pair, winRate: pair.wins / pair.games }))
    .sort((x, y) => y.games - x.games);
  const ranked = pairs.filter((pair) => pair.games >= MIN_PAIR_GAMES).sort((x, y) => y.winRate - x.winRate || y.games - x.games);
  const bestPair = ranked[0] ?? null;
  const worstPair = ranked.length > 1 && ranked.at(-1).winRate < ranked[0].winRate ? ranked.at(-1) : null;
  return { pairs, bestPair, worstPair };
}

/** MVP: the member holding the most awards (better KDA breaks ties). */
function countAwards(awards, stats) {
  const counts = new Map();
  for (const award of awards) counts.set(award.winner, (counts.get(award.winner) ?? 0) + 1);
  const mvp = [...counts.entries()].sort((a, b) => b[1] - a[1] || stats[b[0]].kda - stats[a[0]].kda)[0]?.[0] ?? null;
  return { counts, mvp };
}

/**
 * @param matches match-v5 DTOs (any mix; only games with 2+ members on one team count)
 * @param members `[{ puuid, gameName, tagLine, profileIcon? }]`
 * @returns `{ members, squad, pairs, awards, mvp }`. `members[i]` lines up with the input; `awards` reference members by index.
 */
export function buildSquadStats(matches, members, t) {
  const indexOf = new Map(members.map((member, i) => [member.puuid, i]));
  const tallies = members.map(emptyTally);
  const pairTallies = new Map();
  const games = [];
  const squadChampions = new Map();

  // Oldest first, so streaks read in order and the latest profile icon wins.
  const ordered = [...matches].sort((a, b) => (a.info?.gameCreation ?? 0) - (b.info?.gameCreation ?? 0));

  for (const match of ordered) {
    const info = match.info;
    if (!info || info.gameDuration < REMAKE_SECONDS) continue;

    const squadTeams = squadTeamsOf(info, indexOf);
    if (squadTeams.length === 0) continue;

    const present = squadTeams.flat();
    const win = Boolean(squadTeams[0][0].win);
    games.push({ id: match.metadata?.matchId ?? null, t: info.gameCreation, seconds: info.gameDuration, win, size: present.length });

    for (const p of present) {
      addPlayerGame(tallies[indexOf.get(p.puuid)], p, info.gameDuration);
      bump(squadChampions, p.championName);
    }
    addPairGames(pairTallies, squadTeams, indexOf);
  }

  const stats = members.map((member, index) => memberStats(member, index, tallies[index]));

  const wins = games.filter((g) => g.win).length;
  const seconds = games.reduce((total, g) => total + g.seconds, 0);
  const awards = pickAwards(stats, { minGames: MIN_MEMBER_GAMES }, t);
  const { counts, mvp } = countAwards(awards, stats);

  return {
    members: stats,
    squad: {
      games: games.length,
      wins,
      losses: games.length - wins,
      winRate: games.length ? wins / games.length : 0,
      hours: seconds / 3600,
      streaks: longestStreaks(games),
      results: games.map((g) => g.win), // oldest first
      allTogether: games.filter((g) => g.size === members.length).length,
      topChampion: topKey(squadChampions),
      firstGame: games[0]?.t ?? null,
      lastGame: games.at(-1)?.t ?? null,
    },
    ...rankPairs(pairTallies),
    awards,
    awardCounts: Object.fromEntries(counts),
    mvp,
  };
}
