import { PING_FIELDS } from "@/lib/pings";
import { hashString, seededRandom } from "@/lib/random";
import { SEASON_START } from "./config";
import { buildEarlyGame } from "./early";
import { buildRecapSet } from "./modes";

// Sample players for previewing the recap without a Riot API key. Matches are generated in the
// match-v5 shape and run through the real `buildRecap`, so the demo exercises the same code.
// Each player is tuned to bring out one archetype; everything else stays fairly ordinary.

const BASE = {
  level: 200,
  icon: 12,
  role: "MIDDLE",
  kills: [6, 2.5], // [mean, spread] per game
  deaths: [5, 2],
  assists: [7, 3],
  csPerMin: 6.4,
  visionPerMin: 0.9,
  dmg: [450, 200], // [base, spread] damage per minute
  minutes: [22, 34], // game length range
  winRate: 0.5,
  kp: [0.45, 0.6], // kill participation range
  quadraChance: 0.04,
  tripleChance: 0.12,
  firstBloodChance: 0.06,
  pentaAt: [], // game indexes with a pentakill
  queues: [[420, 0.8], [400, 0.2]], // [queueId, weight]: 420 ranked, 400 normal, 450 ARAM
  nemesis: "Fizz", // lane opponent that beats you most often
  bestMatchup: "Garen", // lane opponent you beat most often
  duo: null, // { gameName, tagLine, icon, champions, chance, position }: a teammate you queue with
  turrets: [1.6, 1.2], // [mean, spread] turret takedowns per game
  stealChance: 0.006, // chance per game of stealing an objective
  itemSet: "ad", // which builds to draw from: ad, ap, tank, support or marksman
  favoriteItem: null, // an item id to build far more often than the rest
  spanDays: 75, // games are spread over roughly this many days
  activeDays: null, // number of distinct days with games (default: about 40% of the games)
  hours: [17, 23.5], // local hours of day when games start
  rank: { queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "III", leaguePoints: 55, wins: 60, losses: 55 },
};

const ranked = (tier, rank, leaguePoints, wins, losses) => ({ queueType: "RANKED_SOLO_5x5", tier, rank, leaguePoints, wins, losses });

const duoWith = (gameName, tagLine, champions, position, chance = 0.5, icon = 7) => ({ gameName, tagLine, champions, position, chance, icon });

const player = (label, gameName, tagLine, overrides) => ({ ...BASE, label, account: { gameName, tagLine }, ...overrides });

const PLAYERS = {
  // --- Who you are
  onetrick: player("One-Trick", "AhriOnly", "1234", {
    itemSet: "ap",
    duo: duoWith("SupportMe", "1234", ["Lulu", "Nami"], "UTILITY", 0.5, 9),
    champions: [["Ahri", 0.85], ["Syndra", 0.09], ["Orianna", 0.06]],
    kills: [6.8, 2.5], deaths: [3.1, 1.5], assists: [8.4, 3], csPerMin: 8.1, visionPerMin: 1.1, winRate: 0.6, rank: null,
  }),
  specialist: player("Specialist", "YasuoYone", "EUW", {
    champions: [["Yasuo", 0.36], ["Yone", 0.36], ["Zed", 0.28]],
    rank: ranked("PLATINUM", "IV", 30, 80, 72),
  }),
  explorer: player("Explorer", "Wanderer", "NA1", {
    champions: ["Ahri", "Lux", "Jinx", "Ashe", "Zed", "Darius", "Garen", "Leona", "Thresh", "Lulu", "Ezreal", "Vi", "Elise", "Sett", "Yasuo", "Ekko", "Kayn", "Nami", "Morgana", "Sylas", "Fizz", "Annie", "Brand", "Braum", "Nasus", "Teemo", "Sona", "Zyra", "Jayce", "Riven", "Volibear", "Rell", "Xayah", "Varus", "Zoe", "Jhin"].map((c, _, all) => [c, 1 / all.length]),
    roles: [["TOP", 0.34], ["MIDDLE", 0.33], ["BOTTOM", 0.33]],
  }),
  chameleon: player("Chameleon", "FillMaster", "0001", {
    champions: [["Garen", 0.15], ["LeeSin", 0.15], ["Ahri", 0.15], ["Jinx", 0.15], ["Lulu", 0.15], ["Yasuo", 0.15], ["Ezreal", 0.1]],
    roles: [["TOP", 0.2], ["JUNGLE", 0.2], ["MIDDLE", 0.2], ["BOTTOM", 0.2], ["UTILITY", 0.2]],
  }),

  // --- How you fight
  showstopper: player("Showstopper", "Highlight", "REEL", {
    champions: [["Katarina", 0.3], ["Jinx", 0.25], ["Yasuo", 0.25], ["Ahri", 0.2]],
    pentaAt: [6, 19, 31], quadraChance: 0.1, tripleChance: 0.25, rank: ranked("DIAMOND", "IV", 12, 110, 97),
  }),
  slayer: player("Slayer", "Nightblade", "EUW", {
    duo: duoWith("ShadowSync", "EUW", ["LeeSin", "Elise"], "JUNGLE", 0.55, 21),
    champions: [["Zed", 0.42], ["Yasuo", 0.26], ["Katarina", 0.2], ["Akali", 0.12]],
    kills: [10.4, 3], deaths: [6.4, 2], assists: [5.1, 2.5], csPerMin: 7.1, winRate: 0.53, pentaAt: [21],
    rank: ranked("EMERALD", "II", 47, 88, 71),
  }),
  daredevil: player("Daredevil", "NoFear", "YOLO", {
    champions: [["Renekton", 0.3], ["Pyke", 0.3], ["Draven", 0.2], ["Yasuo", 0.2]],
    kills: [6.5, 3], deaths: [8.6, 2.5], assists: [6, 3], winRate: 0.44,
  }),
  support: player("Playmaker", "Wardmother", "NA1", {
    itemSet: "support",
    duo: duoWith("CarryMe", "NA1", ["Jinx", "Kaisa"], "BOTTOM", 0.6, 4),
    champions: [["Thresh", 0.22], ["Nautilus", 0.16], ["Lux", 0.14], ["Karma", 0.12], ["Leona", 0.12], ["Braum", 0.12], ["Morgana", 0.12]],
    role: "UTILITY", kills: [1.6, 1.2], deaths: [4.6, 2], assists: [19.5, 4], csPerMin: 1.3, visionPerMin: 2.0, dmg: [300, 100], winRate: 0.57,
    rank: ranked("PLATINUM", "I", 12, 64, 49),
  }),
  unlucky: player("Unlucky Hero", "TeamDiff", "0000", {
    champions: [["Ahri", 0.3], ["Jinx", 0.3], ["LeeSin", 0.2], ["Leona", 0.2]],
    kills: [7, 2.5], deaths: [3.2, 1.5], assists: [8, 3], winRate: 0.36, rank: ranked("SILVER", "II", 8, 70, 82),
  }),
  phoenix: player("Phoenix", "Reborn", "ASH", {
    itemSet: "ap",
    champions: [["Sett", 0.3], ["Ahri", 0.3], ["Ezreal", 0.2], ["Lulu", 0.2]],
    winRate: 0.72, cold: [8, 14], rank: ranked("GOLD", "I", 71, 92, 84),
  }),
  risingstar: player("Rising Star", "Climber", "UP", {
    itemSet: "ap",
    champions: [["Ahri", 0.25], ["Lux", 0.2], ["Ezreal", 0.2], ["Caitlyn", 0.15], ["Garen", 0.2]],
    roles: [["MIDDLE", 0.4], ["BOTTOM", 0.3], ["TOP", 0.3]], winCurve: [0.2, 0.85], rank: ranked("GOLD", "IV", 3, 40, 39),
  }),
  streaker: player("Hot Streak", "OnFire", "WIN", {
    duo: duoWith("Sidekick", "WIN", ["Sett", "Nautilus"], "TOP", 0.5, 30),
    champions: [["Sett", 0.3], ["Ahri", 0.25], ["Ezreal", 0.25], ["Nami", 0.2]],
    hot: [10, 22], roles: [["TOP", 0.3], ["MIDDLE", 0.4], ["BOTTOM", 0.3]],
  }),

  // --- How you play
  scout: player("Scout", "EyesOnU", "WARD", {
    itemSet: "support",
    champions: [["Lulu", 0.25], ["Nami", 0.25], ["Karma", 0.25], ["Yuumi", 0.25]],
    role: "UTILITY", kills: [1.2, 1], deaths: [5, 2], assists: [8.4, 3], csPerMin: 1.2, visionPerMin: 4.3, dmg: [300, 100],
  }),
  farmer: player("Farmer", "CSKing", "GOLD", {
    duo: duoWith("GoldPal", "GOLD", ["LeeSin", "Vi"], "JUNGLE", 0.5, 18),
    champions: [["Nasus", 0.3], ["Kayle", 0.25], ["Ahri", 0.25], ["Azir", 0.2]],
    roles: [["TOP", 0.5], ["MIDDLE", 0.5]], csPerMin: 9.4,
  }),
  heavyhitter: player("Heavy Hitter", "Boom", "DMG", {
    itemSet: "marksman",
    champions: [["Ahri", 0.25], ["Jinx", 0.25], ["Zed", 0.25], ["Garen", 0.25]],
    roles: [["MIDDLE", 0.4], ["BOTTOM", 0.3], ["TOP", 0.3]], dmg: [820, 250],
  }),
  everpresent: player("Ever-Present", "AlwaysThere", "TEAM", {
    champions: [["Ahri", 0.25], ["Lux", 0.25], ["Ezreal", 0.25], ["Leona", 0.25]],
    roles: [["MIDDLE", 0.4], ["BOTTOM", 0.3], ["UTILITY", 0.3]], kp: [0.68, 0.85],
  }),
  opener: player("Opener", "FirstBlood", "GG", {
    champions: [["Ahri", 0.25], ["Lux", 0.25], ["Ezreal", 0.25], ["Leona", 0.25]],
    roles: [["MIDDLE", 0.4], ["BOTTOM", 0.3], ["UTILITY", 0.3]], firstBloodChance: 0.36,
  }),
  untouchable: player("Untouchable", "Ghost", "NOPE", {
    champions: [["Ahri", 0.25], ["Ezreal", 0.25], ["Lux", 0.25], ["Garen", 0.25]],
    roles: [["MIDDLE", 0.4], ["BOTTOM", 0.3], ["TOP", 0.3]], kills: [5, 2], deaths: [2.1, 1.1], assists: [8, 3], winRate: 0.54,
  }),
  closer: player("Closer", "Winner", "W", {
    itemSet: "ap",
    duo: duoWith("WinBuddy", "W", ["Leona", "Thresh"], "UTILITY", 0.55, 15),
    champions: [["Ahri", 0.25], ["Ezreal", 0.25], ["Lux", 0.25], ["Garen", 0.25]],
    roles: [["MIDDLE", 0.4], ["BOTTOM", 0.3], ["TOP", 0.3]], winRate: 0.7, rank: ranked("DIAMOND", "II", 66, 130, 84),
  }),
  marathoner: player("Marathoner", "LongGame", "40MIN", {
    itemSet: "ap",
    champions: [["Ahri", 0.25], ["Ezreal", 0.25], ["Lux", 0.25], ["Garen", 0.25]],
    roles: [["MIDDLE", 0.4], ["BOTTOM", 0.3], ["TOP", 0.3]], minutes: [34, 47],
  }),
  speedrunner: player("Speedrunner", "Ffs", "15", {
    champions: [["Ahri", 0.25], ["Ezreal", 0.25], ["Lux", 0.25], ["Garen", 0.25]],
    roles: [["MIDDLE", 0.4], ["BOTTOM", 0.3], ["TOP", 0.3]], minutes: [15, 25], winRate: 0.5,
  }),

  // --- What you play (champion class)
  assassin: player("Assassin", "Backstab", "ZED", {
    champions: [["Zed", 0.3], ["Talon", 0.25], ["Khazix", 0.25], ["Qiyana", 0.2]],
    kills: [5.5, 2], deaths: [5, 2],
  }),
  archmage: player("Archmage", "SpellSlinger", "AP", {
    itemSet: "ap",
    champions: [["Syndra", 0.3], ["Orianna", 0.25], ["Viktor", 0.25], ["Xerath", 0.2]],
  }),
  sharpshooter: player("Sharpshooter", "LongRange", "ADC", {
    itemSet: "marksman",
    champions: [["Jinx", 0.3], ["Caitlyn", 0.25], ["Ashe", 0.2], ["Jhin", 0.25]],
    role: "BOTTOM",
  }),
  brawler: player("Brawler", "Fistfight", "TOP", {
    champions: [["Darius", 0.3], ["Garen", 0.3], ["Renekton", 0.2], ["Jax", 0.2]],
    role: "TOP",
  }),
  bulwark: player("Bulwark", "Unmovable", "TANK", {
    itemSet: "tank",
    champions: [["Malphite", 0.3], ["Ornn", 0.25], ["Sion", 0.25], ["Maokai", 0.2]],
    role: "TOP", kills: [3, 1.5], deaths: [5, 2], assists: [5, 2],
  }),

  // --- Game modes: these two spend a lot of time outside ranked
  aramfan: player("ARAM Fan", "PoroKing", "ARAM", {
    duo: duoWith("PoroPal", "ARAM", ["Lux", "Sona"], "UTILITY", 0.5, 25),
    champions: [["Ashe", 0.25], ["Ziggs", 0.2], ["Lux", 0.2], ["Jinx", 0.2], ["Sona", 0.15]],
    queues: [[450, 0.55], [420, 0.25], [400, 0.2]], kills: [7, 3], deaths: [5.5, 2], assists: [9, 3], winRate: 0.55,
  }),
  casual: player("Casual", "JustForFun", "NORM", {
    itemSet: "ap",
    duo: duoWith("Bestie", "NORM", ["Thresh", "Soraka"], "UTILITY", 0.45, 3),
    champions: ["Ahri", "Lux", "Jinx", "Ashe", "Zed", "Darius", "Garen", "Leona", "Thresh", "Lulu", "Ezreal", "Vi", "Elise", "Sett", "Yasuo", "Ekko", "Kayn", "Nami", "Morgana", "Sylas", "Fizz", "Annie", "Brand", "Teemo"].map((c, _, all) => [c, 1 / all.length]),
    roles: [["TOP", 0.25], ["MIDDLE", 0.25], ["BOTTOM", 0.25], ["JUNGLE", 0.25]],
    queues: [[400, 0.55], [430, 0.15], [420, 0.3]], winRate: 0.6, rank: null,
  }),

  // --- Objectives
  demolisher: player("Demolisher", "TowerDiver", "TOP", {
    champions: [["Renekton", 0.3], ["Jax", 0.25], ["Fiora", 0.25], ["Camille", 0.2]],
    role: "TOP", turrets: [9, 1], itemSet: "ad", favoriteItem: 3078,
  }),
  thief: player("Thief", "SmiteStealer", "KS", {
    champions: [["Graves", 0.3], ["Kayn", 0.25], ["Viego", 0.25], ["Elise", 0.2]],
    role: "JUNGLE", stealChance: 0.14, itemSet: "ad", hours: [0.5, 4.5], activeDays: 20,
  }),

  // --- Nothing stands out: the fallback
  grinder: player("Grinder", "Steady", "REPS", {
    duo: duoWith("Regular", "REPS", ["Ashe", "Lux"], "BOTTOM", 0.5, 11),
    champions: [["Ahri", 0.2], ["Ezreal", 0.2], ["Garen", 0.2], ["Lux", 0.2], ["Leona", 0.2]],
    roles: [["MIDDLE", 0.58], ["TOP", 0.22], ["BOTTOM", 0.2]],
    kills: [4.4, 2], deaths: [5, 2], assists: [6, 2.5], csPerMin: 4.8, dmg: [330, 100], kp: [0.4, 0.5],
    quadraChance: 0, tripleChance: 0.04,
  }),

  // --- Where you play (role)
  pathfinder: player("Pathfinder", "JungleDiff", "JGL", {
    champions: [["LeeSin", 0.3], ["Viego", 0.25], ["Graves", 0.2], ["Elise", 0.15], ["Vi", 0.1]],
    role: "JUNGLE", kills: [5, 2], deaths: [4.5, 2], assists: [8, 3], csPerMin: 5.4, minutes: [24, 36],
  }),
  islander: player("Islander", "TopAlone", "ISLE", {
    itemSet: "tank",
    champions: [["Darius", 0.25], ["Malphite", 0.25], ["Teemo", 0.2], ["Kennen", 0.15], ["Fiora", 0.15]],
    role: "TOP", kills: [5.5, 2], deaths: [4.8, 2], assists: [4.5, 2],
  }),
  centerpiece: player("Centerpiece", "MidOrFeed", "MID", {
    itemSet: "ap",
    champions: [["Ahri", 0.25], ["Zed", 0.25], ["Yasuo", 0.25], ["Vex", 0.25]],
  }),
  carry: player("Carry", "HardCarry", "BOT", {
    itemSet: "marksman",
    champions: [["Ashe", 0.25], ["Lux", 0.25], ["Seraphine", 0.2], ["Swain", 0.15], ["Samira", 0.15]],
    role: "BOTTOM",
  }),
  guardian: player("Guardian", "ShieldMe", "SUP", {
    itemSet: "tank",
    champions: [["Lulu", 0.3], ["Janna", 0.25], ["Soraka", 0.25], ["Nami", 0.2]],
    role: "UTILITY", kills: [1.4, 1], deaths: [4.6, 2], assists: [8.6, 3], csPerMin: 1.3, visionPerMin: 1.4, dmg: [300, 100],
  }),
};

export const DEMO_STYLES = Object.keys(PLAYERS);
export const DEMO_PLAYERS = DEMO_STYLES.map((key) => ({
  key,
  label: PLAYERS[key].label,
  gameName: PLAYERS[key].account.gameName,
  tagLine: PLAYERS[key].account.tagLine,
}));

// Small seeded PRNG so a given style always renders the same games.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

const GAMES = 40;

// Keystone runes the samples pick from, with the id of their tree (match-v5 puts both in `perks`). Each player has a favorite, from their name.
const KEYSTONES = [
  { id: 8112, style: 8100 }, // Electrocute
  { id: 8010, style: 8000 }, // Conqueror
  { id: 8214, style: 8200 }, // Summon Aery
  { id: 8437, style: 8400 }, // Grasp of the Undying
  { id: 8005, style: 8000 }, // Press the Attack
  { id: 8369, style: 8300 }, // First Strike
  { id: 8229, style: 8200 }, // Arcane Comet
  { id: 8465, style: 8400 }, // Guardian
];

// Sample games say which patch they were played on, the way Riot's do ("16.4.123.4567"). A patch lasts two weeks, counted from the
// day the season started, so the sample's games fall on a few different patches. Worked out from the game's time alone, so it
// uses no random draws and changes nothing else in the sample.
const PATCH_DAYS = 14;
const demoGameVersion = (at) => `16.${1 + Math.max(0, Math.floor((at - SEASON_START.getTime()) / (PATCH_DAYS * 86400000)))}.100.1000`;

const DAY = 86400000;

/**
 * Game start times, oldest first: games cluster on a set of active days (weekends a little more likely), and
 * each game starts in the given hour range. Uses its own random stream so it never changes any other stat.
 */
function playTimes(rand, count, config, now) {
  const span = config.spanDays;
  const wanted = Math.min(count, config.activeDays ?? Math.round(count * 0.4));

  // Weighted sampling without replacement (Efraimidis-Spirakis): heavier days get smaller keys.
  const candidates = Array.from({ length: span - 1 }, (_, i) => i + 1); // 1..span-1 days ago
  const weightOf = (daysAgo) => {
    const day = new Date(now - daysAgo * DAY).getDay();
    return day === 0 || day === 6 ? 1.8 : 1;
  };
  const days = candidates
    .map((daysAgo) => ({ daysAgo, key: -Math.log(rand() || 1e-9) / weightOf(daysAgo) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, wanted)
    .map((d) => d.daysAgo);

  // Every active day gets a game; the rest land on random active days.
  const perDay = new Map(days.map((d) => [d, 1]));
  for (let extra = count - days.length; extra > 0; extra--) {
    const d = days[Math.floor(rand() * days.length)];
    perDay.set(d, perDay.get(d) + 1);
  }

  const [from, to] = config.hours;
  const times = [];
  for (const [daysAgo, games] of perDay) {
    const midnight = new Date(now - daysAgo * DAY);
    midnight.setHours(0, 0, 0, 0);
    const hours = Array.from({ length: games }, () => from + rand() * (to - from)).sort((a, b) => a - b);
    for (const hour of hours) times.push(midnight.getTime() + Math.round(hour * 3600000));
  }
  return times.sort((a, b) => a - b);
}

const ITEM_SETS = {
  ad: { items: [3078, 3031, 3072, 3053, 3026, 3071, 3033, 3036], boots: [3006, 3047] },
  ap: { items: [3089, 3157, 3135, 6653, 6655, 3116, 3100, 3102], boots: [3020, 3158] },
  tank: { items: [3068, 3075, 3083, 3143, 3110, 3065, 3742, 3026], boots: [3047, 3111] },
  support: { items: [3190, 3107, 3222, 3109, 3504, 6616, 3050, 3165], boots: [3158, 3117] },
  marksman: { items: [3031, 3046, 3085, 3087, 3072, 3026, 6672, 3036], boots: [3006, 3047] },
};

/** Six slots for one game: boots plus finished items, with the favorite far more likely than the others. */
function buildItems(rand, config) {
  const set = ITEM_SETS[config.itemSet] ?? ITEM_SETS.ad;
  const chosen = [];
  if (config.favoriteItem && rand() < 0.93) chosen.push(config.favoriteItem);
  const pool = set.items.filter((id) => id !== config.favoriteItem);
  // Earlier items in a set are more popular, so a few clearly dominate.
  while (chosen.length < 4 + Math.floor(rand() * 2) && pool.length) {
    const at = Math.min(pool.length - 1, Math.floor(rand() * rand() * pool.length * 1.4));
    chosen.push(pool.splice(at, 1)[0]);
  }
  return [set.boots[rand() < 0.7 ? 0 : 1], ...chosen].slice(0, 6);
}

/** Team objectives for both sides. The winners take more of everything, but nothing is absolute. */
function teamObjectives(rand, won) {
  const count = (winnerMean, loserMean, spread) => {
    const mean = won ? winnerMean : loserMean;
    return Math.max(0, Math.round(mean + (rand() + rand() - 1) * spread * 1.6));
  };
  return {
    dragon: { kills: count(2.6, 1.2, 1.1), first: rand() < (won ? 0.68 : 0.32) },
    baron: { kills: count(0.9, 0.2, 0.6), first: rand() < (won ? 0.55 : 0.2) },
    riftHerald: { kills: count(1.2, 0.6, 0.7), first: rand() < (won ? 0.62 : 0.38) },
    horde: { kills: count(2.6, 1.4, 1.2) },
    tower: { kills: count(8, 3, 2), first: rand() < (won ? 0.7 : 0.3) },
    inhibitor: { kills: count(1.8, 0.3, 0.8) },
  };
}

const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const CHAMPION_POOL = ["Ahri", "Yasuo", "Lux", "Jinx", "Leona", "Thresh", "Darius", "Zed", "Ezreal", "Vi", "Elise", "Sett", "Ekko", "Kayn", "Nami", "Morgana", "Sylas", "Annie", "Brand", "Braum", "Nasus", "Teemo", "Sona", "Zyra", "Jayce", "Riven", "Volibear", "Rell", "Xayah", "Varus"];

/** The other nine players of a demo game: four teammates and five opponents, with the lane opponent designed. */
/** Numbers for an enemy player, around `me`'s own (from a stream of their own, so nothing else in the sample moves). */
function opponentStats(me, x) {
  const cs = (me.totalMinionsKilled ?? 0) + (me.neutralMinionsKilled ?? 0);
  return {
    kills: Math.round(me.kills * (0.5 + x())),
    deaths: Math.round(me.deaths * (0.6 + x() * 0.9)),
    assists: Math.round(me.assists * (0.5 + x())),
    totalMinionsKilled: Math.round(cs * (0.75 + x() * 0.5)),
    neutralMinionsKilled: 0,
    goldEarned: Math.round((me.goldEarned ?? 0) * (0.8 + x() * 0.4)),
    totalDamageDealtToChampions: Math.round((me.totalDamageDealtToChampions ?? 0) * (0.6 + x() * 0.8)),
  };
}

function otherPlayers({ game, me, aram, config, rand }) {
  const pool = CHAMPION_POOL.filter((c) => c !== config.nemesis && c !== config.bestMatchup);
  const anyChampion = () => pool[Math.floor(rand() * pool.length)];
  const positions = aram ? ["", "", "", "", ""] : POSITIONS;

  const mates = positions
    .filter((position) => aram || position !== me.teamPosition)
    .slice(0, 4)
    .map((position, slot) => ({
      puuid: "ally-" + game + "-" + slot,
      riotIdGameName: "Ally" + game + "x" + slot,
      riotIdTagline: "NA1",
      profileIcon: 1 + Math.floor(rand() * 20),
      teamId: me.teamId,
      teamPosition: position,
      championName: anyChampion(),
    }))
    .map((mate, slot) => {
      // Around your own numbers, from a stream of their own so the rest of the sample doesn't move.
      const x = seededRandom(`mate-stats:${game}:${slot}`);
      return {
        ...mate,
        totalDamageDealtToChampions: Math.round((me.totalDamageDealtToChampions ?? 0) * (0.45 + x() * 0.85)),
        deaths: Math.round(me.deaths * (0.6 + x() * 0.9)),
        kills: Math.round(me.kills * (0.5 + x())),
        assists: Math.round(me.assists * (0.5 + x())),
      };
    });

  if (config.duo && rand() < config.duo.chance) {
    // Slot the duo into their usual position when it is free, otherwise the first teammate.
    const at = Math.max(0, mates.findIndex((m) => m.teamPosition === config.duo.position));
    mates[at] = {
      ...mates[at],
      puuid: "duo",
      riotIdGameName: config.duo.gameName,
      riotIdTagline: config.duo.tagLine,
      profileIcon: config.duo.icon,
      championName: config.duo.champions[Math.floor(rand() * config.duo.champions.length)],
    };
  }

  const opponents = positions.map((position, slot) => {
    let championName = anyChampion();
    // In your own lane, losses skew towards the nemesis and wins towards the best matchup, but neither is
    // absolute: you occasionally beat your nemesis and lose to your best matchup.
    if (!aram && position === me.teamPosition) {
      const roll = rand();
      if (!me.win) championName = roll < 0.45 ? config.nemesis : roll < 0.52 ? config.bestMatchup : championName;
      else championName = roll < 0.07 ? config.nemesis : roll < 0.47 ? config.bestMatchup : championName;
    }
    return {
      puuid: "foe-" + game + "-" + slot,
      riotIdGameName: "Foe" + game + "x" + slot,
      riotIdTagline: "EUW",
      profileIcon: 1,
      teamId: 200,
      teamPosition: position,
      championName,
      ...opponentStats(me, seededRandom(`opp-stats:${game}:${slot}`)),
    };
  });

  return [...mates, ...opponents];
}

/**
 * Win/loss results that land on `rate` with short streaks. Purely random results over 40 games drift
 * a lot (a "50%" player easily ends up at 65% with a 9-game streak), which would fake an archetype.
 */
function pacedResults(rand, count, rate) {
  let wins = 0;
  return Array.from({ length: count }, (_, i) => {
    const behind = rate * (i + 1) - wins;
    const win = behind + (rand() - 0.5) > 0.5;
    if (win) wins++;
    return win;
  });
}

/** The chance of winning game `i`: a steady rate, a curve from the first game to the last, or a designed hot or cold streak. */
function winChanceAt(p, i) {
  if (p.cold && i >= p.cold[0] && i <= p.cold[1]) return 0.04; // a cold streak wins if the two ever overlap
  if (p.hot && i >= p.hot[0] && i <= p.hot[1]) return 0.96;
  if (!p.winCurve) return p.winRate;
  return p.winCurve[0] + (p.winCurve[1] - p.winCurve[0]) * (i / (GAMES - 1));
}

/** An ARAM game's length in minutes (14 to 24), at the same point in the range of normal game lengths as `baseMinutes`. */
function aramMinutes(baseMinutes, [shortest, longest]) {
  return 14 + ((baseMinutes - shortest) / (longest - shortest || 1)) * 10;
}

/**
 * Pings, summoner spells, surrenders, damage by type and gold for one game. Each player has a favourite ping and a usual spell
 * setup, picked from their name, and the per-game numbers come from a stream of their own so nothing else in the sample changes.
 */
function addExtras(me, { p, i, minutes, aram }) {
  const extra = seededRandom(`${p.account.gameName}#${p.account.tagLine}:extras:${i}`);
  const nameHash = hashString(p.account.gameName);
  const favoritePing = PING_FIELDS[nameHash % PING_FIELDS.length];
  for (const field of PING_FIELDS) me[field] = Math.round((field === favoritePing ? 9 : 1.2) * (0.5 + extra()));
  const flashOnD = hashString(p.account.tagLine) % 2 === 0;
  const otherSpell = [14, 12, 7, 3][nameHash % 4]; // Ignite, Teleport, Heal, Exhaust
  [me.summoner1Id, me.summoner2Id] = flashOnD ? [4, otherSpell] : [otherSpell, 4];
  me[`summoner${flashOnD ? 1 : 2}Casts`] = Math.round(1 + extra() * 3);
  me[`summoner${flashOnD ? 2 : 1}Casts`] = Math.round(extra() * 2);
  me.gameEndedInSurrender = extra() < (aram ? 0.05 : 0.22);
  // Damage by type (each player leans one way) and gold, on the same separate streams.
  const magicShare = 0.15 + (nameHash % 7) * 0.1;
  const trueShare = 0.02 + extra() * 0.04;
  me.magicDamageDealtToChampions = Math.round(me.totalDamageDealtToChampions * magicShare);
  me.trueDamageDealtToChampions = Math.round(me.totalDamageDealtToChampions * trueShare);
  me.physicalDamageDealtToChampions = me.totalDamageDealtToChampions - me.magicDamageDealtToChampions - me.trueDamageDealtToChampions;
  me.goldEarned = Math.round(minutes * (280 + p.csPerMin * 32 + me.kills * 10));
  me.goldSpent = Math.max(0, me.goldEarned + 500 - Math.round((250 + (nameHash % 5) * 350) * (0.5 + extra())));
}

/**
 * Objective numbers and final items for one game. The teams' totals are correlated with the result; yours are a share of your
 * team's. Returns both teams' objectives, `{ ours, theirs }`.
 */
function addObjectives(me, { p, role, minutes, aram, sideRand }) {
  const ours = teamObjectives(sideRand, me.win);
  const theirs = teamObjectives(sideRand, !me.win);
  const share = (mean, spread) => Math.max(0, Math.round(mean + (sideRand() + sideRand() - 1) * spread * 1.6));
  const junglerLike = role === "JUNGLE" && !aram;
  me.turretTakedowns = Math.min(share(...p.turrets), ours.tower.kills);
  me.inhibitorTakedowns = Math.min(ours.inhibitor.kills, sideRand() < 0.4 ? 1 : 0);
  me.dragonKills = Math.min(ours.dragon.kills, sideRand() < (junglerLike ? 0.55 : 0.12) ? 1 : 0);
  me.baronKills = Math.min(ours.baron.kills, sideRand() < (junglerLike ? 0.4 : 0.15) ? 1 : 0);
  me.objectivesStolen = sideRand() < p.stealChance ? 1 : 0;
  me.damageDealtToObjectives = Math.round(minutes * (150 + sideRand() * 250));
  [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5] = [...buildItems(sideRand, p), 0, 0, 0, 0, 0, 0].slice(0, 6);
  me.item6 = 3340;
  return { ours, theirs };
}

/** Runes: mostly the player's favorite keystone. Drawn from a stream of its own, so nothing else in the sample changes. */
function addKeystone(me, p, i) {
  const runeRand = seededRandom(`${p.account.gameName}#${p.account.tagLine}:runes:${i}`);
  const favorite = hashString(p.account.gameName) % KEYSTONES.length;
  const keystone = runeRand() < 0.65 ? KEYSTONES[favorite] : KEYSTONES[Math.floor(runeRand() * KEYSTONES.length)];
  me.perks = { styles: [{ style: keystone.style, selections: [{ perk: keystone.id }] }, { style: 8300, selections: [] }] };
}

export function getDemoData(style) {
  const key = PLAYERS[style] ? style : DEMO_STYLES[0];
  const p = PLAYERS[key];
  const rand = seeded(hash(key));

  const around = ([mean, spread]) => Math.max(0, Math.round(mean + (rand() + rand() - 1) * spread * 1.6));
  const between = ([low, high]) => low + rand() * (high - low);
  const pick = (weighted) => {
    let roll = rand();
    for (const [value, weight] of weighted) {
      if ((roll -= weight) <= 0) return value;
    }
    return weighted[0][0];
  };
  const queueRand = seeded(hash(key) ^ 0x9e3779b9);
  const pickQueue = () => {
    let roll = queueRand();
    for (const [queue, weight] of p.queues) {
      if ((roll -= weight) <= 0) return queue;
    }
    return p.queues[0][0];
  };
  const sideRand = seeded(hash(key) ^ 0x51ed270b); // for the other players, so adding them changes no existing stat
  const champions = p.champions;
  const roles = p.roles ?? [[p.role, 1]];

  // Players with a designed streak or trend use random results; everyone else gets paced ones.
  const paced = p.winCurve || p.hot || p.cold ? null : pacedResults(rand, GAMES, p.winRate);

  const now = Date.now();
  const times = playTimes(sideRand, GAMES, p, now);
  const matches = Array.from({ length: GAMES }, (_, i) => {
    const winChance = winChanceAt(p, i);

    const queue = pickQueue();
    const aram = queue === 450;
    const role = pick(roles);
    const baseMinutes = between(p.minutes);
    // ARAM: shorter games, no roles, little farming and a lot more fighting. Derived from the same
    // random draws, so ARAM games never change what the other games look like.
    const minutes = aram ? aramMinutes(baseMinutes, p.minutes) : baseMinutes;
    const cs = Math.round(p.csPerMin * minutes * (0.9 + rand() * 0.2) * (aram ? 0.4 : 1));
    const jungle = role === "JUNGLE" && !aram;
    const fightier = (n, factor) => (aram ? Math.round(n * factor) : n);

    const me = {
      puuid: "demo",
      teamId: 100,
      championName: pick(champions),
      kills: fightier(around(p.kills), 1.4),
      deaths: fightier(around(p.deaths), 1.2),
      assists: fightier(around(p.assists), 1.5),
      win: paced ? paced[i] : rand() < winChance,
      teamPosition: aram ? "" : role,
      totalMinionsKilled: jungle ? Math.round(cs * 0.35) : cs,
      neutralMinionsKilled: jungle ? Math.round(cs * 0.65) : 0,
      visionScore: Math.round(p.visionPerMin * minutes * (0.8 + rand() * 0.4)),
      totalDamageDealtToChampions: Math.round(minutes * (p.dmg[0] + rand() * p.dmg[1])),
      pentaKills: p.pentaAt.includes(i) ? 1 : 0,
      quadraKills: rand() < p.quadraChance ? 1 : 0,
      tripleKills: rand() < p.tripleChance ? 1 : 0,
      firstBloodKill: rand() < p.firstBloodChance,
      challenges: { killParticipation: between(p.kp) },
    };

    // Respawn timers grow with the game clock. No random draws, so nothing else in the sample changes.
    me.totalTimeSpentDead = Math.round(me.deaths * (12 + minutes * 0.9));

    addExtras(me, { p, i, minutes, aram });
    const { ours, theirs } = addObjectives(me, { p, role, minutes, aram, sideRand });
    addKeystone(me, p, i);

    return {
      info: {
        gameDuration: Math.round(minutes * 60),
        gameCreation: times[i],
        gameVersion: demoGameVersion(times[i]),
        queueId: queue,
        gameMode: aram ? "ARAM" : "CLASSIC",
        participants: [me, ...otherPlayers({ game: i, me, aram, config: p, rand: sideRand })],
        // ARAM has no dragons or barons, so it carries no team objectives here.
        teams: aram
          ? []
          : [
              { teamId: 100, win: me.win, objectives: ours },
              { teamId: 200, win: !me.win, objectives: theirs },
            ],
      },
    };
  });

  return {
    account: p.account,
    summoner: { profileIconId: p.icon, summonerLevel: p.level },
    rankedEntries: p.rank ? [p.rank] : [],
    matches,
    mastery: DEMO_MASTERY,
    earlyGame: demoEarlyGame(matches),
    ...buildRecapSet(matches, "demo"),
  };
}

// Mastery for the demo: champions with real history that the sample players rarely touch. `championId` is Riot's numeric key.
const DEMO_MASTERY = [
  { championId: 157, championLevel: 7, championPoints: 241300, lastPlayTime: Date.now() - 140 * 86400000 }, // Yasuo
  { championId: 238, championLevel: 7, championPoints: 132800, lastPlayTime: Date.now() - 200 * 86400000 }, // Zed
  { championId: 412, championLevel: 6, championPoints: 61500, lastPlayTime: Date.now() - 90 * 86400000 }, // Thresh
  { championId: 25, championLevel: 5, championPoints: 33200, lastPlayTime: Date.now() - 300 * 86400000 }, // Morgana
];

/** Timelines for the sample's latest lane games (gold at 15 minutes for you and your lane opponent), read like the real ones. */
function demoEarlyGame(matches) {
  const latest = matches
    .filter((m) => m.info.gameMode === "CLASSIC" && m.info.gameDuration >= 900)
    .sort((a, b) => b.info.gameCreation - a.info.gameCreation)
    .slice(0, 10);
  const timelines = new Map();
  for (const match of latest) {
    const { participants, gameDuration } = match.info;
    const rand = seededRandom(`early:${gameDuration}:${match.info.gameCreation}`);
    const minutes = Math.floor(gameDuration / 60);
    const frames = Array.from({ length: minutes + 1 }, (_, m) => ({
      participantFrames: Object.fromEntries(participants.map((p, i) => [i + 1, { totalGold: Math.round(500 + ((p.goldEarned ?? 10000) - 500) * (m / minutes) ** 1.15 + (rand() - 0.5) * 900 * (m / minutes)) }])),
      events: [],
    }));
    timelines.set(match.metadata?.matchId ?? `demo-${match.info.gameCreation}`, { metadata: { participants: participants.map((p) => p.puuid) }, info: { frames } });
  }
  return buildEarlyGame(latest.map((m) => ({ ...m, metadata: { matchId: m.metadata?.matchId ?? `demo-${m.info.gameCreation}` } })), timelines, "demo");
}
