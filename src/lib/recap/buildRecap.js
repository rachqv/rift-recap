import { PING_FIELDS } from "@/lib/pings";
import { addObjectives, createObjectiveTally, summarizeObjectives } from "./objectives";
import { addGameToTally, createSocialTally, summarizeTally } from "./social";

const REMAKE_SECONDS = 300;

const ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "Bot", UTILITY: "Support" };

const kdaOf = (kills, deaths, assists) => (kills + assists) / Math.max(deaths, 1);

/** The patch a match-v5 `gameVersion` ("14.3.556.7432") belongs to: "14.3". Null when there isn't one. */
function patchOf(version) {
  const found = /^(\d+)\.(\d+)/.exec(typeof version === "string" ? version : "");
  return found ? { patch: `${found[1]}.${found[2]}`, major: Number(found[1]), minor: Number(found[2]) } : null;
}

const FLASH = 4; // summoner spell id
const emptyBlame = () => ({ games: 0, damageShare: 0, deathShare: 0, deathGames: 0, top: 0, rank: 0 });

/** How you compare with your own team in one game: your share of its damage and deaths, and your damage rank (1 = most). Null without the data. */
function teamRole(me, participants) {
  const team = participants.filter((p) => p.teamId === me.teamId);
  if (team.length < 3 || !team.every((p) => typeof p.totalDamageDealtToChampions === "number")) return null;
  const damage = team.reduce((total, p) => total + p.totalDamageDealtToChampions, 0);
  if (damage <= 0) return null;
  const deaths = team.reduce((total, p) => total + (p.deaths ?? 0), 0);
  return {
    damageShare: me.totalDamageDealtToChampions / damage,
    deathShare: deaths > 0 ? (me.deaths ?? 0) / deaths : null,
    rank: 1 + team.filter((p) => p.totalDamageDealtToChampions > me.totalDamageDealtToChampions).length,
  };
}

const DAMAGE_TYPE_FIELDS = ["physicalDamageDealtToChampions", "magicDamageDealtToChampions", "trueDamageDealtToChampions"];

/** Jungle and lane minions both count towards CS. */
const creepScore = (p) => (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);

/** Everything `addGame` adds up over a player's games; `summarize` turns it into the recap. */
function createTally() {
  return {
    wins: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    seconds: 0,
    cs: 0,
    vision: 0,
    damage: 0,
    firstBloods: 0,
    deathless: 0,
    dead: 0, // seconds spent waiting to respawn
    deadKnown: false,
    killParticipation: 0,
    kpGames: 0,
    multikills: { penta: 0, quadra: 0, triple: 0 },
    champions: new Map(),
    roles: new Map(),
    streaks: { win: 0, loss: 0 },
    run: 0,
    previous: null, // result of the game before, for "how do you play after a loss"
    afterResult: { win: { games: 0, wins: 0 }, loss: { games: 0, wins: 0 } },
    bestGame: null,
    longestGame: null,
    mostKills: 0,
    killGame: null, // the game with the most kills
    pentaGame: null, // the first game with a pentakill
    damageTypes: { games: 0, physical: 0, magic: 0, true: 0 },
    gold: { games: 0, unspent: 0 },
    lane: { games: 0, cs: 0, gold: 0, damage: 0, kills: 0, ahead: 0 },
    teamGames: [], // who was on each side of every game, for "how do team comps change your results"
    pingTotals: Object.fromEntries(PING_FIELDS.map((field) => [field, 0])),
    pingGames: 0,
    spellPairs: new Map(), // "4-14" -> games
    spellGames: 0,
    flash: { d: 0, f: 0, casts: 0, games: 0 },
    surrender: { known: 0, ended: 0, enemyQuit: 0 },
    blame: { win: emptyBlame(), loss: emptyBlame() },
    social: createSocialTally(),
    objectives: createObjectiveTally(),
    items: new Map(), // item id -> { games, wins }: the items in your six slots when the game ended
    patches: new Map(), // "14.3" -> { patch, major, minor, games, wins }
    keystones: new Map(), // keystone rune id -> { id, games, wins }
  };
}

/** Counts one game (and a win, if it was one) for `key`, starting the entry from `initial` the first time it shows up. */
function countGame(entries, key, initial, won) {
  const entry = entries.get(key) ?? initial;
  entry.games++;
  if (won) entry.wins++;
  entries.set(key, entry);
  return entry;
}

function addKeystone(tally, me, won) {
  // The first rune of the first tree you took is your keystone (match-v5: perks.styles[0].selections[0].perk).
  const keystone = me.perks?.styles?.[0]?.selections?.[0]?.perk;
  if (Number.isInteger(keystone)) countGame(tally.keystones, keystone, { id: keystone, games: 0, wins: 0 }, won);
}

function addPatch(tally, version, won) {
  const patch = patchOf(version);
  if (patch) countGame(tally.patches, patch.patch, { ...patch, games: 0, wins: 0 }, won);
}

function addItems(tally, me, won) {
  // Each item counts once per game, even if you finished with two of the same one.
  for (const id of new Set([me.item0, me.item1, me.item2, me.item3, me.item4, me.item5])) {
    if (id) countGame(tally.items, id, { id, games: 0, wins: 0 }, won);
  }
}

function addTotals(tally, me, duration, won) {
  if (won) tally.wins++;
  tally.kills += me.kills;
  tally.deaths += me.deaths;
  tally.assists += me.assists;
  tally.seconds += duration;
  tally.cs += creepScore(me);
  tally.vision += me.visionScore ?? 0;
  tally.damage += me.totalDamageDealtToChampions ?? 0;
  if (me.firstBloodKill) tally.firstBloods++;
  if (me.deaths === 0) tally.deathless++;
  tally.multikills.penta += me.pentaKills ?? 0;
  tally.multikills.quadra += me.quadraKills ?? 0;
  tally.multikills.triple += me.tripleKills ?? 0;
}

function addDeadTime(tally, me) {
  if (me.totalTimeSpentDead != null) {
    tally.dead += me.totalTimeSpentDead;
    tally.deadKnown = true;
  }
}

function addKillParticipation(tally, me) {
  if (me.challenges?.killParticipation != null) {
    tally.killParticipation += me.challenges.killParticipation;
    tally.kpGames++;
  }
}

/** The memorable games: most kills, first pentakill, best KDA and longest. */
function addHighlights(tally, me, duration, playedAt, won) {
  tally.mostKills = Math.max(tally.mostKills, me.kills);
  const line = { champion: me.championName, kills: me.kills, deaths: me.deaths, assists: me.assists, at: playedAt, win: won };
  if (!tally.killGame || me.kills > tally.killGame.kills) tally.killGame = line;
  if (!tally.pentaGame && (me.pentaKills ?? 0) > 0) tally.pentaGame = line;

  // Ignore quiet 2/0/1 games so "best game" is a proper highlight.
  const kda = kdaOf(me.kills, me.deaths, me.assists);
  if (me.kills + me.assists >= 6 && (!tally.bestGame || kda > tally.bestGame.kda)) {
    tally.bestGame = { champion: me.championName, kills: me.kills, deaths: me.deaths, assists: me.assists, kda, at: playedAt, win: won };
  }
  if (!tally.longestGame || duration > tally.longestGame.seconds) {
    tally.longestGame = { champion: me.championName, seconds: duration, at: playedAt, win: won };
  }
}

function addDamageTypes({ damageTypes }, me) {
  if (!DAMAGE_TYPE_FIELDS.every((field) => typeof me[field] === "number")) return;
  damageTypes.games++;
  damageTypes.physical += me.physicalDamageDealtToChampions;
  damageTypes.magic += me.magicDamageDealtToChampions;
  damageTypes.true += me.trueDamageDealtToChampions;
}

function addGold({ gold }, me) {
  if (typeof me.goldEarned !== "number" || typeof me.goldSpent !== "number") return;
  gold.games++;
  // Everyone starts with 500 gold that `goldEarned` doesn't count, so what is left over is earned + 500 - spent.
  gold.unspent += Math.max(0, me.goldEarned + 500 - me.goldSpent);
}

function addLane({ lane }, me, participants) {
  const opponent = me.teamPosition ? participants.find((p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition) : null;
  if (!opponent || typeof opponent.goldEarned !== "number" || typeof me.goldEarned !== "number") return;
  lane.games++;
  lane.cs += creepScore(me) - creepScore(opponent);
  lane.gold += me.goldEarned - opponent.goldEarned;
  lane.damage += (me.totalDamageDealtToChampions ?? 0) - (opponent.totalDamageDealtToChampions ?? 0);
  lane.kills += me.kills - (opponent.kills ?? 0);
  if (me.goldEarned > opponent.goldEarned) lane.ahead++;
}

function addTeamGame(tally, me, participants, won) {
  const mates = participants.filter((p) => p.teamId === me.teamId && p !== me).map((p) => p.championName);
  if (mates.length === 0) return;
  tally.teamGames.push({ win: won, mates, foes: participants.filter((p) => p.teamId !== me.teamId).map((p) => p.championName) });
}

function addPings(tally, me) {
  if (!PING_FIELDS.some((field) => typeof me[field] === "number")) return;
  tally.pingGames++;
  for (const field of PING_FIELDS) tally.pingTotals[field] += me[field] ?? 0;
}

function addSpells(tally, me) {
  if (!me.summoner1Id || !me.summoner2Id) return;
  const { spellPairs, flash } = tally;
  tally.spellGames++;
  const key = [me.summoner1Id, me.summoner2Id].sort((a, b) => a - b).join("-");
  spellPairs.set(key, (spellPairs.get(key) ?? 0) + 1);
  const slot = me.summoner1Id === FLASH ? 1 : me.summoner2Id === FLASH ? 2 : 0;
  if (slot) {
    flash[slot === 1 ? "d" : "f"]++;
    flash.games++;
    flash.casts += me[`summoner${slot}Casts`] ?? 0;
  }
}

function addSurrender({ surrender }, me, won) {
  if (typeof me.gameEndedInSurrender !== "boolean") return;
  surrender.known++;
  if (!me.gameEndedInSurrender) return;
  surrender.ended++;
  if (won) surrender.enemyQuit++;
}

function addBlame({ blame }, me, participants, won) {
  const role = teamRole(me, participants);
  if (!role) return;
  const bucket = blame[won ? "win" : "loss"];
  bucket.games++;
  bucket.damageShare += role.damageShare;
  bucket.rank += role.rank;
  if (role.rank === 1) bucket.top++;
  if (role.deathShare != null) {
    bucket.deathShare += role.deathShare;
    bucket.deathGames++;
  }
}

/** Streaks, and how the game after a win or a loss went. Games arrive oldest first. */
function addStreaks(tally, won) {
  if (tally.previous != null) {
    const bucket = tally.afterResult[tally.previous ? "win" : "loss"];
    bucket.games++;
    if (won) bucket.wins++;
  }
  tally.previous = won;

  // run > 0 is a win streak, run < 0 a loss streak.
  tally.run = won ? Math.max(tally.run, 0) + 1 : Math.min(tally.run, 0) - 1;
  if (tally.run > 0) tally.streaks.win = Math.max(tally.streaks.win, tally.run);
  else tally.streaks.loss = Math.max(tally.streaks.loss, -tally.run);
}

function addChampion(tally, me, won) {
  const initial = { id: me.championName, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
  const champ = countGame(tally.champions, me.championName, initial, won);
  champ.kills += me.kills;
  champ.deaths += me.deaths;
  champ.assists += me.assists;
}

function addRole({ roles }, me) {
  if (ROLE_LABELS[me.teamPosition]) roles.set(me.teamPosition, (roles.get(me.teamPosition) ?? 0) + 1);
}

function addGame(tally, { me, duration, playedAt, participants, teams, version }) {
  const won = Boolean(me.win);
  addKeystone(tally, me, won);
  addPatch(tally, version, won);
  addGameToTally(tally.social, me, participants, won);
  addObjectives(tally.objectives, me, teams, won);
  addItems(tally, me, won);
  addTotals(tally, me, duration, won);
  addDeadTime(tally, me);
  addKillParticipation(tally, me);
  addHighlights(tally, me, duration, playedAt, won);
  addDamageTypes(tally, me);
  addGold(tally, me);
  addLane(tally, me, participants);
  addTeamGame(tally, me, participants, won);
  addPings(tally, me);
  addSpells(tally, me);
  addSurrender(tally, me, won);
  addBlame(tally, me, participants, won);
  addStreaks(tally, won);
  addChampion(tally, me, won);
  addRole(tally, me);
}

/** The games that count (no remakes, and only those `puuid` played), oldest first so streaks read in the order they happened. */
function collectGames(matches, puuid) {
  const games = [];
  for (const match of matches) {
    const me = match.info.participants.find((p) => p.puuid === puuid);
    if (me && match.info.gameDuration >= REMAKE_SECONDS) {
      games.push({ me, duration: match.info.gameDuration, playedAt: match.info.gameCreation, participants: match.info.participants, teams: match.info.teams, version: match.info.gameVersion });
    }
  }
  return games.sort((a, b) => a.playedAt - b.playedAt);
}

/** Win rate in the first half of the games vs the second half, to spot players who improved (or slumped). */
function winTrend(games) {
  if (games.length < 20) return null;
  const mid = Math.floor(games.length / 2);
  const rate = (from, to) => games.slice(from, to).filter((g) => g.me.win).length / (to - from);
  return { early: rate(0, mid), late: rate(mid, games.length) };
}

function summarizeSpells({ spellGames, spellPairs, flash }) {
  if (spellGames === 0) return null;
  return {
    games: spellGames,
    topPair: [...spellPairs.entries()].map(([key, games]) => ({ ids: key.split("-").map(Number), games })).sort((a, b) => b.games - a.games)[0],
    flash: flash.games > 0 ? { key: flash.d >= flash.f ? "D" : "F", perGame: flash.casts / flash.games, games: flash.games } : null,
  };
}

function summarizeBlame({ blame }) {
  return blame.win.games + blame.loss.games > 0 ? { win: blameAverages(blame.win), loss: blameAverages(blame.loss) } : null;
}

const orNull = (tally) => (tally.games > 0 ? tally : null);

function summarizeCounts(tally, games) {
  const { wins, kills, deaths, assists, seconds } = tally;
  const count = games.length;
  const n = count || 1;
  const minutes = seconds / 60 || 1;
  return {
    games: count,
    wins,
    losses: count - wins,
    winRate: wins / n,
    // Win or loss for each game, oldest first: the season as a strip of dots.
    results: games.map((g) => Boolean(g.me.win)),
    // When each of those games was played (epoch ms), in the same order: `results[i]` was played at `resultTimes[i]`.
    resultTimes: games.map((g) => g.playedAt),
    // Games and wins on each game patch, oldest patch first: `[{ patch: "14.3", major, minor, games, wins }]`. Empty when Riot didn't say.
    patches: [...tally.patches.values()].sort((a, b) => a.major - b.major || a.minor - b.minor),
    // Games and wins with each keystone rune, most played first: `[{ id, games, wins }]`. Empty when Riot didn't say.
    keystones: [...tally.keystones.values()].sort((a, b) => b.games - a.games || b.wins - a.wins),
    kills,
    deaths,
    assists,
    kda: kdaOf(kills, deaths, assists),
    perGame: { kills: kills / n, deaths: deaths / n, assists: assists / n },
    hoursPlayed: seconds / 3600,
    avgGameMinutes: minutes / n,
    trend: winTrend(games),
    csPerMin: tally.cs / minutes,
    visionPerMin: tally.vision / minutes,
    damagePerMin: tally.damage / minutes,
    killParticipation: tally.kpGames ? tally.killParticipation / tally.kpGames : null,
    multikills: tally.multikills,
    firstBloods: tally.firstBloods,
    deathlessGames: tally.deathless,
    // Time spent dead, or null when Riot didn't send it. `share` is of all the time spent in games.
    timeDead: tally.deadKnown ? { seconds: tally.dead, share: tally.dead / (seconds || 1) } : null,
    // How the next game went after a win, and after a loss.
    afterResult: tally.afterResult,
    mostKills: tally.mostKills,
    // Memorable games, each `{ champion, kills, deaths, assists, at, win }` (`at` is when it was played).
    killGame: tally.killGame,
    pentaGame: tally.pentaGame,
  };
}

function summarizeRoles({ roles }, count) {
  const [topRole, topRoleGames] = [...roles.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return {
    role: topRole ? { key: topRole, label: ROLE_LABELS[topRole], share: topRoleGames / count } : null,
    roleCount: roles.size,
    // Share of all games in each role (ARAM and other role-less games count towards the total but not any role).
    roleShares: Object.fromEntries([...roles].map(([key, played]) => [key, played / (count || 1)])),
  };
}

function summarize(tally, games) {
  const count = games.length;
  const rankedChampions = [...tally.champions.values()]
    .sort((a, b) => b.games - a.games)
    .map((c) => ({ ...c, winRate: c.wins / c.games, kda: kdaOf(c.kills, c.deaths, c.assists) }));

  return {
    ...summarizeCounts(tally, games),
    // Damage to champions by type, over the games that report all three (null when none do).
    damageTypes: orNull(tally.damageTypes),
    // Gold left unspent at the end of games: `{ games, unspent }` totals.
    gold: orNull(tally.gold),
    // You against your lane opponent (same position), summed over `games`: cs, gold, damage and kills differences, and games ahead on gold.
    lane: orNull(tally.lane),
    teamGames: tally.teamGames,
    // Pings by type, over the games Riot reported them for. Null when it reported none.
    pings: tally.pingGames > 0 ? { games: tally.pingGames, byType: tally.pingTotals } : null,
    // Summoner spells: `topPair` is `{ ids: [a, b], games }`; `flash` says which key Flash is on and how often you cast it.
    spells: summarizeSpells(tally),
    // Games that ended in a surrender: `enemyQuit` is the ones you won because the other team gave up.
    surrender: tally.surrender.known > 0 ? tally.surrender : null,
    // Your share of the team's damage and deaths in wins and in losses (averages), and how often you dealt the most damage.
    blame: summarizeBlame(tally),
    streaks: tally.streaks,
    ...summarizeRoles(tally, count),
    uniqueChampions: tally.champions.size,
    champions: rankedChampions,
    topChampions: rankedChampions.slice(0, 5),
    bestGame: tally.bestGame,
    longestGame: tally.longestGame,
    ...summarizeTally(tally.social, { games: count, wins: tally.wins }),
    objectives: summarizeObjectives(tally.objectives),
    items: [...tally.items.values()].sort((a, b) => b.games - a.games),
  };
}

/**
 * Pure aggregation: match-v5 DTOs in, display-ready stats out.
 * New "wrapped" slides should be fed from here so they stay easy to test.
 */
export function buildRecap(matches, puuid) {
  const games = collectGames(matches, puuid);
  const tally = createTally();
  for (const game of games) addGame(tally, game);
  return summarize(tally, games);
}

function blameAverages(b) {
  return b.games === 0
    ? null
    : { games: b.games, damageShare: b.damageShare / b.games, deathShare: b.deathGames ? b.deathShare / b.deathGames : null, top: b.top, rank: b.rank / b.games };
}
