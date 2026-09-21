import { defaultT } from "@/lib/i18n/en";

// Squad vs squad: the games where two groups were on opposite teams (a 5v5 custom between two friend groups, or two duos that met
// in queue). It is the head-to-head's `findMeetings`, for groups.

const REMAKE_SECONDS = 300;
const MIN_SIDE = 2; // members of each side who have to be in the game, on the same team, for it to count
const MIN_VERDICT_GAMES = 3; // games before a lead is called (two games say nothing)
const Z = 1.5; // and the lead has to be this many standard errors of a coin flip over that many games
const MIN_STAR_GAMES = 3; // games a member needs to be named the standout

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

const sum = (list, pick) => list.reduce((total, item) => total + (pick(item) ?? 0), 0);

/**
 * The games where members of `a` and members of `b` played against each other, oldest first. `a` and `b` are lists of puuids.
 * A game counts when at least two of each side were in it, each side all on one team, and the teams were opposite.
 * Returns `[{ matchId, playedAt, a, b, aWon }]` where `a` and `b` are that side's participants.
 */
export function findClashes(matches, a, b) {
  const clashes = [];
  for (const match of matches) {
    const info = match.info;
    if (!info || info.gameDuration < REMAKE_SECONDS) continue;
    const [sideA, sideB] = [a, b].map((side) => info.participants.filter((p) => side.includes(p.puuid)));
    if (sideA.length < MIN_SIDE || sideB.length < MIN_SIDE) continue;
    const teamA = sideA[0].teamId;
    if (sideA.some((p) => p.teamId !== teamA) || sideB.some((p) => p.teamId !== sideB[0].teamId) || sideB[0].teamId === teamA) continue;
    clashes.push({ matchId: match.metadata?.matchId, playedAt: info.gameCreation, a: sideA, b: sideB, aWon: Boolean(sideA[0].win) });
  }
  return clashes.sort((x, y) => x.playedAt - y.playedAt);
}

/** Per player and game averages of one side over its participants (all their clash games together). */
function averages(participants) {
  const games = participants.length;
  return {
    kda: (sum(participants, (p) => p.kills) + sum(participants, (p) => p.assists)) / Math.max(sum(participants, (p) => p.deaths), 1),
    damage: sum(participants, (p) => p.totalDamageDealtToChampions) / games,
    gold: sum(participants, (p) => p.goldEarned) / games,
    vision: sum(participants, (p) => p.visionScore) / games,
  };
}

/** Each member's record over the clashes, and the standout (best KDA over enough games) or null. */
function membersOf(clashes, side, members) {
  const players = members
    .map(({ puuid, gameName, tagLine }) => {
      const games = clashes.flatMap((clash) => clash[side].filter((p) => p.puuid === puuid));
      return games.length === 0 ? null : { puuid, gameName, tagLine, games: games.length, wins: games.filter((p) => p.win).length, ...averages(games) };
    })
    .filter(Boolean);
  const eligible = players.filter((p) => p.games >= MIN_STAR_GAMES);
  const star = eligible.length > 0 ? eligible.reduce((best, p) => (p.kda > best.kda ? p : best)) : null;
  return { players, star };
}

/** The most frequent of a side's players in a role, over the games where they played it. */
function usualIn(role, clashes, side) {
  const counts = new Map();
  for (const clash of clashes) for (const p of clash[side]) if (p.teamPosition === role) counts.set(p.puuid, (counts.get(p.puuid) ?? 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
}

const kdaOf = (p) => ((p.kills ?? 0) + (p.assists ?? 0)) / Math.max(p.deaths ?? 0, 1);

/**
 * Role against role: in the games where each side had someone in that lane, whose laner had the better KDA (a tie goes to
 * neither). The game's winner is not used: it is the same for every lane, so it would only repeat the score.
 */
function lanesOf(clashes, membersByPuuid) {
  const lanes = [];
  for (const role of ROLES) {
    let games = 0;
    const outplayed = { a: 0, b: 0 };
    for (const clash of clashes) {
      const [a, b] = [clash.a, clash.b].map((side) => side.find((p) => p.teamPosition === role));
      if (!a || !b) continue;
      games++;
      const [ka, kb] = [kdaOf(a), kdaOf(b)];
      if (ka !== kb) outplayed[ka > kb ? "a" : "b"]++;
    }
    if (games === 0) continue;
    const [a, b] = ["a", "b"].map((side) => membersByPuuid.get(usualIn(role, clashes, side)));
    lanes.push({ role, games, outplayed, a, b });
  }
  return lanes;
}

/**
 * How the win record between the two sides reads: `{ kind: "few" }` with too few games to say, `{ kind: "level" }` when the gap is
 * no bigger than luck would make it, or `{ kind: "lead", side }` for the side that is ahead by more than that.
 */
export function seriesVerdict(games, wins) {
  if (games < MIN_VERDICT_GAMES) return { kind: "few" };
  const rate = wins.a / games;
  if (Math.abs(rate - 0.5) < (Z * 0.5) / Math.sqrt(games)) return { kind: "level" };
  return { kind: "lead", side: rate > 0.5 ? "a" : "b" };
}

/**
 * @param matches match-v5 DTOs (any mix)
 * @param a, b each side's members as `{ puuid, gameName, tagLine }`
 * @returns null when the two never met; otherwise
 *   `{ games, wins: { a, b }, verdict, sides: { a, b }, lanes, players: { a, b }, stars: { a, b }, last }` where
 *   - `sides` holds each side's `{ kda, damage, gold, vision }` per player per game
 *   - `lanes` are `{ role, games, outplayed: { a, b }, a, b }` for each role both sides had (a, b: the member who usually played it there;
 *     `outplayed` counts the games where that side's laner had the better KDA)
 *   - `players` are the members' records and `stars` the standout of each side (null when nobody has enough games)
 *   - `last` is `{ playedAt, winner: "a" | "b" }`
 */
export function buildClash(matches, a, b) {
  const clashes = findClashes(matches, a.map((m) => m.puuid), b.map((m) => m.puuid));
  if (clashes.length === 0) return null;

  const wins = { a: clashes.filter((c) => c.aWon).length, b: clashes.filter((c) => !c.aWon).length };
  const [sideA, sideB] = [membersOf(clashes, "a", a), membersOf(clashes, "b", b)];
  const byPuuid = new Map([...sideA.players, ...sideB.players].map((p) => [p.puuid, p]));
  const last = clashes.at(-1);
  return {
    games: clashes.length,
    wins,
    verdict: seriesVerdict(clashes.length, wins),
    sides: { a: averages(clashes.flatMap((c) => c.a)), b: averages(clashes.flatMap((c) => c.b)) },
    lanes: lanesOf(clashes, byPuuid),
    players: { a: sideA.players, b: sideB.players },
    stars: { a: sideA.star, b: sideB.star },
    last: { playedAt: last.playedAt, winner: last.aWon ? "a" : "b" },
  };
}

/** A side's name: its first member's, since a side has no name of its own. */
export const teamName = (members, t = defaultT) => t("clash.team", { name: members[0]?.gameName ?? "" });

/** The sentence under the score: who leads, or that it is level, or that there are too few games to say. `names` is `{ a, b }`. */
export function clashLine(clash, names, t = defaultT) {
  const { verdict, wins, games } = clash;
  if (verdict.kind === "few") return t("clash.line.few", { games: t("recap.gamesLabel", { count: games }) });
  if (verdict.kind === "level") return t("clash.line.level", { a: wins.a, b: wins.b });
  const [win, lose] = verdict.side === "a" ? [wins.a, wins.b] : [wins.b, wins.a];
  return t("clash.line.lead", { name: names[verdict.side], win, lose });
}

const ROWS = [
  ["kda", (t, v) => t.fixed(v, 2)],
  ["damage", (t, v) => t.number(Math.round(v))],
  ["gold", (t, v) => t.number(Math.round(v))],
  ["vision", (t, v) => t.fixed(v, 1)],
];

/** The stat rows for the numbers slide: `{ key, label, aShow, bShow, aShare, winner }` with the higher number winning ("a", "b", or null for a tie). */
export function clashRows(clash, t = defaultT) {
  return ROWS.map(([key, show]) => {
    const [a, b] = [clash.sides.a[key], clash.sides.b[key]];
    return {
      key,
      label: t(`clash.slides.numbers.${key}`),
      aShow: show(t, a),
      bShow: show(t, b),
      aShare: a + b > 0 ? a / (a + b) : 0.5,
      winner: a === b ? null : a > b ? "a" : "b",
    };
  });
}

/** How many games a member needs between the squads to be named the standout. */
export const STAR_GAMES = MIN_STAR_GAMES;
