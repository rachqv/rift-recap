import { defaultT } from "@/lib/i18n/en";

// Turns a recap into a personality and a few lines of copy. All heuristics live here so they're easy to tune.


// --- How the archetype is picked
// Every archetype is scored by how unusual the player is at its trait, in standard deviations from a typical player
// (a z-score). Stats that depend on the role are compared with the norms of the roles the player actually played, and
// noisy stats (win rate, kills a game, streaks...) get less extreme the more games there are. Because every trait is
// measured on the same scale, the most standout one wins, instead of whichever has the loosest threshold.
const Z_FULL = 2.5; // a z-score of 2.5 counts as a full score of 1
const fromZ = (z) => Math.max(0, z) / Z_FULL;

// Typical averages for a season in each role: [mean, spread between players]. The spread is the standard deviation
// of a whole-season average, so "5 kills a game" can be ordinary for a mid laner and remarkable for a support.
const ROLE_NORMS = {
  TOP: { kills: [5.6, 1.1], deaths: [5.4, 1.0], assists: [4.6, 1.1], damage: [620, 95], cs: [6.4, 0.85], vision: [0.75, 0.23], kp: [0.52, 0.06], turrets: [3.3, 0.7], firstBlood: [0.07, 0.035] },
  JUNGLE: { kills: [5.4, 1.1], deaths: [5.3, 1.0], assists: [7.6, 1.5], damage: [500, 80], cs: [5.3, 0.7], vision: [1.0, 0.28], kp: [0.68, 0.06], turrets: [2.4, 0.6], firstBlood: [0.16, 0.06] },
  MIDDLE: { kills: [6.6, 1.2], deaths: [5.3, 1.0], assists: [5.8, 1.3], damage: [710, 95], cs: [6.8, 0.85], vision: [0.75, 0.23], kp: [0.6, 0.06], turrets: [3.0, 0.6], firstBlood: [0.12, 0.045] },
  BOTTOM: { kills: [6.7, 1.2], deaths: [5.2, 1.0], assists: [6.2, 1.3], damage: [780, 100], cs: [7.0, 0.9], vision: [0.7, 0.23], kp: [0.62, 0.06], turrets: [3.4, 0.7], firstBlood: [0.09, 0.04] },
  UTILITY: { kills: [1.9, 0.6], deaths: [6.0, 1.0], assists: [11.5, 2.0], damage: [280, 50], cs: [1.4, 0.4], vision: [2.4, 0.7], kp: [0.7, 0.06], turrets: [1.8, 0.5], firstBlood: [0.05, 0.03] },
};
const STATS = Object.keys(ROLE_NORMS.TOP);

// How much a stat wobbles from one game to the next (the standard deviation of a single game), for the sample-size correction.
const GAME_NOISE = { kills: 2.6, deaths: 2.5, assists: 3.5, damage: 150, cs: 0.8, vision: 0.3, kp: 0.1, turrets: 1.6, firstBlood: 0.3 };

/** The norms for the roles a player actually played (blended by how much they played each), or a generic mix. */
function normsFor(recap) {
  const played = Object.entries(recap.roleShares ?? {}).filter(([role, share]) => ROLE_NORMS[role] && share > 0);
  const total = played.reduce((sum, [, share]) => sum + share, 0);
  const blend = total > 0 ? played.map(([role, share]) => [ROLE_NORMS[role], share / total]) : Object.values(ROLE_NORMS).map((norms) => [norms, 1 / 5]);
  return Object.fromEntries(
    STATS.map((stat) => [stat, [0, 1].map((i) => blend.reduce((sum, [norms, weight]) => sum + norms[stat][i] * weight, 0))]),
  );
}

/** How many standard deviations `value` is above a typical player's season average of `stat`, over `r.games` games. */
function zStat(r, stat, value) {
  const [mean, spread] = r.norms[stat];
  return (value - mean) / Math.hypot(spread, GAME_NOISE[stat] / Math.sqrt(r.games));
}

const zWinRate = (r) => (r.winRate - 0.5) / Math.hypot(0.03, 0.5 / Math.sqrt(r.games));

// The longest run of results you would expect by luck alone (and how much it varies), for a given chance of each result.
function zStreak(r, streak, chance) {
  const p = Math.min(0.7, Math.max(0.3, chance));
  const scale = Math.log(1 / p);
  const expected = Math.log(Math.max(r.games * (1 - p), 1.5)) / scale + 0.3;
  return (streak - expected) / (1.28 / scale);
}

// Counting stats (steals, quadrakills) are rare, so their spread mostly comes from luck.
const zCount = (count, expected) => (count - expected) / (1.3 * Math.sqrt(expected) + 0.4);

// Share-based traits: how far above what is usual, for a share of games on one champion, class or role.
const identity = (share, mean, spread) => fromZ((share - mean) / spread);
// Champion classes are not equally common: marksmen are nearly every bot laner's picks, while few players lean
// on assassins or tanks. Each class gets its own mean share (the spread is shared) so that all of them are about equally
// hard to earn, at roughly the top 4% of players for that class.
const CLASS_MEAN = { Assassin: 0.26, Mage: 0.33, Marksman: 0.51, Fighter: 0.35, Tank: 0.25 };
const CLASS_SPREAD = 0.16;
const classIdentity = (r, tag) => identity(r.classes[tag] ?? 0, CLASS_MEAN[tag], CLASS_SPREAD);
const roleShare = (r, key) => (r.role?.key === key ? r.role.share : 0);
const roleValues = (r, t) => ({ share: t.percent(r.role.share), role: t(`common.roles.${r.role.key}`) });
const classValues = (r, tag, t) => ({ share: t.percent(r.classes[tag]) });

// Champion habits. A small sample makes the most-played champion look bigger by chance alone, and a longer season
// means more different champions, so the norms move with the number of games (at 100 games: the top champion is
// about 20% of games, the top two about 40%, and about 20 different champions).
const topShareNorm = (games) => 0.12 + 0.8 / Math.sqrt(games);
const topTwoShareNorm = (games) => 0.28 + 1.2 / Math.sqrt(games);
// A One-Trick plays one champion almost exclusively. Being well above the norm is not enough: the title needs this
// share of games outright, however small the sample.
const ONE_TRICK_MIN_SHARE = 0.8;
const uniqueNorm = (games) => 1.3 * games ** 0.6;

// Each persona's `score` is ~1 when a stat clearly defines the player, and the highest score wins. Personas marked
// `fallback` (champion class, role) are discounted: nearly everyone has a main role, so "you mostly play jungle" is a
// weaker story than what they actually did there, and only wins when it is clearly the more extreme trait.
//
// The words are in the `persona.<id>` messages (`title`, `tagline`, `description`). `values(r, n, t)` gives the numbers the
// description sentence needs, already formatted for the language; `n` holds champion display names: { top, second }.
// A persona with a second wording (`descriptionAlt`) says which one to use with `alt(r)`.
const PERSONAS = [
  // --- Who you are: champion habits
  {
    id: "onetrick",
    accent: "#b06cff",
    score: (r) => {
      const share = r.topChampions[0].games / r.games;
      return share < ONE_TRICK_MIN_SHARE ? 0 : fromZ((share - topShareNorm(r.games)) / 0.12);
    },
    values: (r, n, t) => ({ share: t.percent(r.topChampions[0].games / r.games), top: n.top }),
  },
  {
    id: "specialist",
    accent: "#9d4edd",
    score: (r) => {
      if (r.champions.length < 2 || r.champions[0].games / r.games >= 0.5) return 0;
      const share = (r.champions[0].games + r.champions[1].games) / r.games;
      return fromZ((share - topTwoShareNorm(r.games)) / 0.13);
    },
    values: (r, n, t) => ({ share: t.percent((r.champions[0].games + r.champions[1].games) / r.games), top: n.top, second: n.second }),
  },
  {
    id: "explorer",
    accent: "#3ddc97",
    score: (r) => (r.games >= 15 ? fromZ((r.uniqueChampions - uniqueNorm(r.games)) / (0.3 * uniqueNorm(r.games))) : 0),
    values: (r) => ({ unique: r.uniqueChampions, games: r.games }),
  },
  {
    id: "chameleon",
    accent: "#c77dff",
    // Most players have a main role with 60% or more of their games; a Chameleon has no real home.
    score: (r) => (r.games >= 15 && r.role ? fromZ((0.6 - r.role.share) / 0.12) : 0),
    values: (r) => ({ roles: r.roleCount }),
  },

  // --- How you fight
  {
    id: "showstopper",
    accent: "#ffd60a",
    score: (r) => {
      const { penta, quadra, triple } = r.multikills;
      const pentaScore = penta > 0 ? fromZ(zCount(penta, r.games * 0.003)) : 0;
      // Multikills weighted by how big they are: about 0.15 a game for a typical player, and it varies a lot.
      const perGame = (triple + 3 * quadra + 8 * penta) / r.games;
      return Math.max(pentaScore, fromZ((perGame - 0.15) / 0.14));
    },
    alt: (r) => r.multikills.penta === 0,
    values: (r) => r.multikills,
  },
  {
    id: "thief",
    accent: "#9be564",
    // Steals are rare (mostly by junglers), so a couple is luck and it takes a few to be a signature.
    score: (r) => {
      const stolen = r.objectives?.personal.stolen ?? 0;
      if (stolen < 2) return 0;
      const junglerShare = r.roleShares?.JUNGLE ?? 0;
      return fromZ(zCount(stolen, r.games * (0.004 + 0.011 * junglerShare)));
    },
    values: (r) => ({ count: r.objectives.personal.stolen }),
  },
  {
    id: "slayer",
    accent: "#e84057",
    score: (r) => fromZ(zStat(r, "kills", r.perGame.kills)),
    values: (r, n, t) => ({ kills: r.kills, games: r.games, perGame: t.fixed(r.perGame.kills) }),
  },
  {
    id: "daredevil",
    accent: "#ff7a3d",
    score: (r) => fromZ(zStat(r, "deaths", r.perGame.deaths)),
    values: (r) => ({ deaths: r.deaths }),
  },
  {
    id: "playmaker",
    accent: "#0ac8b9",
    score: (r) => fromZ(zStat(r, "assists", r.perGame.assists)),
    values: (r, n, t) => ({ assists: r.assists, perGame: t.fixed(r.perGame.assists) }),
  },
  {
    id: "unlucky",
    accent: "#90a4ae",
    // Both at once: losing more than luck explains, with a KDA well above what the roles you played usually get.
    score: (r) => {
      const [k, d, a] = [r.norms.kills[0], r.norms.deaths[0], r.norms.assists[0]];
      const typicalKda = (k + a) / d;
      const losing = -zWinRate(r);
      const kda = (r.kda - typicalKda) / (0.18 * typicalKda);
      return Math.min(losing, kda) >= 0.7 ? fromZ((losing + kda) / 2) : 0;
    },
    values: (r, n, t) => ({ kda: t.fixed(r.kda, 2), winRate: t.percent(r.winRate) }),
  },
  {
    id: "phoenix",
    accent: "#ff8c42",
    // A losing streak far longer than luck explains, and still a winning record at the end.
    score: (r) => (r.winRate >= 0.5 ? fromZ(zStreak(r, r.streaks.loss, 1 - r.winRate)) : 0),
    values: (r, n, t) => ({ streak: r.streaks.loss, winRate: t.percent(r.winRate) }),
  },
  {
    id: "risingstar",
    accent: "#58e6a9",
    // The difference between two halves of the season varies by about 1 / sqrt(games) by luck alone.
    score: (r) => (r.trend ? fromZ((r.trend.late - r.trend.early) / Math.hypot(0.03, 1 / Math.sqrt(r.games))) : 0),
    values: (r, n, t) => ({ early: t.percent(r.trend.early), late: t.percent(r.trend.late) }),
  },
  {
    id: "streaker",
    accent: "#ff5e3a",
    score: (r) => fromZ(zStreak(r, r.streaks.win, r.winRate)),
    values: (r) => ({ streak: r.streaks.win }),
  },

  // --- How you play
  {
    id: "scout",
    accent: "#6ea8ff",
    score: (r) => fromZ(zStat(r, "vision", r.visionPerMin)),
    values: (r, n, t) => ({ vision: t.fixed(r.visionPerMin, 2) }),
  },
  {
    id: "farmer",
    accent: "#f0c040",
    score: (r) => fromZ(zStat(r, "cs", r.csPerMin)),
    values: (r, n, t) => ({ cs: t.fixed(r.csPerMin) }),
  },
  {
    id: "heavyhitter",
    accent: "#ff4d6d",
    score: (r) => fromZ(zStat(r, "damage", r.damagePerMin)),
    values: (r, n, t) => ({ damage: t.number(Math.round(r.damagePerMin)) }),
  },
  {
    id: "everpresent",
    accent: "#4cc9f0",
    score: (r) => (r.killParticipation == null ? 0 : fromZ(zStat(r, "kp", r.killParticipation))),
    values: (r, n, t) => ({ kp: t.percent(r.killParticipation) }),
  },
  {
    id: "opener",
    accent: "#f72585",
    score: (r) => fromZ(zStat(r, "firstBlood", r.firstBloods / r.games)),
    values: (r) => ({ count: r.firstBloods }),
  },
  {
    id: "demolisher",
    accent: "#e0a04a",
    // Takedowns include assists, so a strong split-pusher or siege player lands around 4+ a game.
    score: (r) => (r.objectives ? fromZ(zStat(r, "turrets", r.objectives.personal.turrets / r.objectives.games)) : 0),
    values: (r, n, t) => ({ turrets: r.objectives.personal.turrets, games: r.objectives.games, perGame: t.fixed(r.objectives.personal.turrets / r.objectives.games) }),
  },
  {
    id: "untouchable",
    accent: "#c8aa6e",
    score: (r) => fromZ(-zStat(r, "deaths", r.perGame.deaths)),
    alt: (r) => r.deathlessGames === 0,
    values: (r, n, t) => ({ perGame: t.fixed(r.perGame.deaths), deathless: r.deathlessGames }),
  },
  {
    id: "closer",
    accent: "#f4d27a",
    score: (r) => fromZ(zWinRate(r)),
    values: (r, n, t) => ({ winRate: t.percent(r.winRate) }),
  },
  {
    id: "marathoner",
    accent: "#8fa3ff",
    score: (r) => fromZ((r.avgGameMinutes - 28.5) / Math.hypot(1.9, 5.5 / Math.sqrt(r.games))),
    values: (r) => ({ minutes: Math.round(r.avgGameMinutes) }),
  },
  {
    id: "speedrunner",
    accent: "#ffd166",
    score: (r) => fromZ((28.5 - r.avgGameMinutes) / Math.hypot(1.9, 5.5 / Math.sqrt(r.games))),
    values: (r) => ({ minutes: Math.round(r.avgGameMinutes) }),
  },

  // --- What you play: champion class (from Data Dragon tags). Class and role archetypes are the fallback tier (see below).
  { id: "assassin", fallback: true, accent: "#d63a5b", score: (r) => classIdentity(r, "Assassin"), values: (r, n, t) => classValues(r, "Assassin", t) },
  { id: "archmage", fallback: true, accent: "#7a8cff", score: (r) => classIdentity(r, "Mage"), values: (r, n, t) => classValues(r, "Mage", t) },
  { id: "sharpshooter", fallback: true, accent: "#ffb347", score: (r) => classIdentity(r, "Marksman"), values: (r, n, t) => classValues(r, "Marksman", t) },
  { id: "brawler", fallback: true, accent: "#e07a5f", score: (r) => classIdentity(r, "Fighter"), values: (r, n, t) => classValues(r, "Fighter", t) },
  { id: "bulwark", fallback: true, accent: "#7fb3d5", score: (r) => classIdentity(r, "Tank"), values: (r, n, t) => classValues(r, "Tank", t) },

  // --- Where you play: role. Most players have a main role, so it takes about 80% of games to stand out.
  { id: "pathfinder", fallback: true, accent: "#4caf7a", score: (r) => identity(roleShare(r, "JUNGLE"), 0.62, 0.13), values: (r, n, t) => roleValues(r, t) },
  { id: "islander", fallback: true, accent: "#5fb4d9", score: (r) => identity(roleShare(r, "TOP"), 0.62, 0.13), values: (r, n, t) => roleValues(r, t) },
  { id: "centerpiece", fallback: true, accent: "#b39ddb", score: (r) => identity(roleShare(r, "MIDDLE"), 0.62, 0.13), values: (r, n, t) => roleValues(r, t) },
  { id: "carry", fallback: true, accent: "#ffca3a", score: (r) => identity(roleShare(r, "BOTTOM"), 0.62, 0.13), values: (r, n, t) => roleValues(r, t) },
  { id: "guardian", fallback: true, accent: "#7adfd0", score: (r) => identity(roleShare(r, "UTILITY"), 0.62, 0.13), values: (r, n, t) => roleValues(r, t) },
];

// Scores are capped (a z-score of 3), and a trait has to be about 1.1 standard deviations out to count. Ties go to
// whichever trait is listed first: habits beat performance. A player with nothing standing out and no dominant class
// or role gets the Grinder, which is deliberately a fair share of players rather than a rarity.
const MAX_SCORE = 1.2;
const FALLBACK_WEIGHT = 0.8;
const MIN_SCORE = 0.45;

const GRINDER = {
  id: "grinder",
  accent: "#a09b8c",
  values: (r, n, t) => ({ games: r.games, hours: t.fixed(r.hoursPlayed) }),
};

/** Share of games by champion class (Assassin, Mage, ...), using each champion's first Data Dragon tag. */
function classShares(recap, tagsOf) {
  const games = {};
  let known = 0;
  for (const champion of recap.champions) {
    const tag = tagsOf?.(champion.id)?.[0];
    if (!tag) continue;
    games[tag] = (games[tag] ?? 0) + champion.games;
    known += champion.games;
  }
  return Object.fromEntries(Object.entries(games).map(([tag, count]) => [tag, count / known]));
}

/**
 * Picks the persona whose defining stat is strongest, plus up to two runner-up traits.
 * `names` is `{ topName, secondName, tagsOf }`: champion display names, and a function returning a
 * champion id's Data Dragon tags (or undefined). `t` writes the words (English by default).
 */
export function getPersona(recap, { topName, secondName, tagsOf } = {}, t = defaultT) {
  const context = { ...recap, classes: classShares(recap, tagsOf), norms: normsFor(recap) };
  const names = { top: topName, second: secondName };

  // Array.sort is stable, so equal scores keep the priority order above.
  const ranked = PERSONAS.map((persona) => ({ persona, score: Math.min(persona.score(context), MAX_SCORE) * (persona.fallback ? FALLBACK_WEIGHT : 1) })).sort(
    (a, b) => b.score - a.score,
  );

  const winner = ranked[0].score >= MIN_SCORE ? ranked[0].persona : GRINDER;
  const runnersUp = ranked.filter(({ persona, score }) => persona !== winner && score >= MIN_SCORE).slice(0, 2);
  const alsoAn = runnersUp.map(({ persona }) => t(`persona.${persona.id}.title`));

  return {
    id: winner.id,
    title: t(`persona.${winner.id}.title`),
    accent: winner.accent,
    tagline: t(`persona.${winner.id}.tagline`),
    description: t(`persona.${winner.id}.${winner.alt?.(context) ? "descriptionAlt" : "description"}`, winner.values(context, names, t)),
    rarity: rarityOf(winner.id, t),
    alsoAn,
    // The same runners-up by id, for anything that needs to know which other archetypes also fit this player.
    alsoIds: runnersUp.map(({ persona }) => persona.id),
  };
}

export const PERSONA_COUNT = PERSONAS.length + 1;

// How common each archetype is: the estimated percentage of players who get it. These come from simulating tens of
// thousands of 80-game seasons through the scoring above (see the balance check), so they are estimates about a typical
// player pool, not a count of real players, and are shown as "about". Re-run the simulation after changing the scoring.
// The One-Trick needs 80% of games on one champion, which the simulation never produced, so it is set by hand.
const PERSONA_SHARE = {
  explorer: 5.8, showstopper: 5.2, opener: 5.0, grinder: 4.9, daredevil: 4.8, marathoner: 4.5, farmer: 4.4, speedrunner: 4.4,
  demolisher: 4.4, heavyhitter: 4.3, closer: 4.3, everpresent: 4.3, scout: 4.2, slayer: 4.1, playmaker: 4.1, untouchable: 3.9,
  streaker: 3.6, risingstar: 3.5, chameleon: 2.6, unlucky: 2.5, thief: 1.9, phoenix: 1.9, brawler: 1.5, assassin: 1.3,
  archmage: 1.3, bulwark: 1.2, guardian: 1.1, sharpshooter: 1.1, pathfinder: 0.9, islander: 0.9, centerpiece: 0.8, carry: 0.7,
  specialist: 0.7, onetrick: 0.3,
};

/** Every archetype's id, in no particular order (the keys of the table above: each has a title and a share). */
export const PERSONA_IDS = Object.keys(PERSONA_SHARE);

// Rarity tiers, by estimated share. Colors follow the usual trading-card convention.
const RARITY_TIERS = [
  { min: 4, key: "common", color: "#a09b8c" },
  { min: 2, key: "uncommon", color: "#3ddc97" },
  { min: 1, key: "rare", color: "#4cc9f0" },
  { min: 0, key: "legendary", color: "#ffd60a" },
];

/**
 * `{ tier, key, color, share }` for an archetype id: `tier` is the tier's name in the reader's language, `key` is the same
 * in English lower case, and `share` is the estimated percentage of players (null for unknown ids).
 */
export function rarityOf(id, t = defaultT) {
  const share = PERSONA_SHARE[id];
  if (share == null) return null;
  const { key, color } = RARITY_TIERS.find((tier) => share >= tier.min);
  return { tier: t(`persona.rarity.${key}`), key, color, share };
}

/** "about 1%", "about 4%", or "under 1%": whole numbers, since the estimates are not that precise. */
export const rarityShareText = ({ share }, t = defaultT) => (share < 1 ? t("persona.rarity.under", { share: t.percent(0.01) }) : t("persona.rarity.about", { share: t.percent(Math.round(share) / 100) }));

/** Short, stat-aware lines for each slide. `topName` is the top champion's display name. */
export function getInsights(recap, topName, t = defaultT) {
  const top = recap.topChampions[0];
  const share = top.games / recap.games;
  const line = (key, values) => t(`persona.insights.${key}`, values);

  const win = recap.winRate >= 0.6 ? "dominant" : recap.winRate >= 0.52 ? "good" : recap.winRate >= 0.48 ? "balanced" : recap.winRate >= 0.4 ? "challenge" : "rough";
  const kda = recap.perGame.deaths <= 3.5 ? "rarelyDie" : recap.perGame.kills >= 8 ? "everyFight" : recap.perGame.assists > recap.perGame.kills * 1.5 ? "teamFirst" : recap.perGame.deaths >= 7 ? "bold" : "balanced";

  return {
    games:
      recap.hoursPlayed >= 24
        ? line("games.days", { days: t.fixed(recap.hoursPlayed / 24) })
        : line("games.films", { films: Math.max(1, Math.round(recap.hoursPlayed / 2)) }),
    win: line(`win.${win}`),
    streak: recap.streaks.win >= 3 ? line("streak.long", { streak: recap.streaks.win }) : line("streak.short"),
    comeback: recap.streaks.loss >= 3 ? line("comeback", { streak: recap.streaks.loss }) : null,
    champion:
      share >= 0.5
        ? line("champion.oneTrick", { share: t.percent(share), top: topName })
        : recap.uniqueChampions / recap.games >= 0.5
          ? line("champion.variety", { unique: recap.uniqueChampions, top: topName })
          : line("champion.favorite", { games: top.games, top: topName }),
    kda: line(`kda.${kda}`),
  };
}

export function formatDuration(seconds, t = defaultT) {
  return t("persona.duration", { minutes: Math.round(seconds / 60) });
}
