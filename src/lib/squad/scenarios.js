import { defaultT } from "@/lib/i18n/en";
import { buildQuirks } from "./quirks";
import { clock, fixed, pct, pickScenarios, tallyScenarios, thousands } from "./scenarioCore";

// Head-to-head scenarios drawn from a full recap (`buildRecap`), the raw games (`buildQuirks`), rank and level.
// Each group becomes one slide showing the scenarios where the two players differ most, so every matchup gets its own mix.
// `view` is what `playerView` builds; `ctx` is `{ t, nameOf(championId) }`.
//
// A definition has `id`, `icon` and `value`/`show`/`values` (see `compareScenario`); its title, tagline and punchline are the
// `versus.scenarios.<id>` messages.

const signed = (t, x) => (Math.round(x * 100) === 0 ? t.percent(0) : `${x > 0 ? "+" : "-"}${t.percent(Math.abs(x))}`);
const orNull = (x) => (x ? x : null); // "0" from a missing field shouldn't beat a real number

// ============================================================ big moments: highlights and objectives

const multiScore = (m) => m.penta * 10 + m.quadra * 4 + m.triple;
const multiShort = (m, t) =>
  [m.penta && t("versus.short.penta", { count: m.penta }), m.quadra && t("versus.short.quadra", { count: m.quadra }), m.triple && t("versus.short.triple", { count: m.triple })].filter(Boolean).join(" ") ||
  t("versus.short.noneLower");
const multiWords = (m, t) =>
  t.list([m.penta && t("versus.multi.penta", { count: m.penta }), m.quadra && t("versus.multi.quadra", { count: m.quadra }), m.triple && t("versus.multi.triple", { count: m.triple })].filter(Boolean));

const MOMENTS = [
  {
    id: "multikills",
    icon: "🔥",
    value: (v) => multiScore(v.recap.multikills),
    show: (_, v, { t }) => multiShort(v.recap.multikills, t),
    values: (w, _l, { t }) => ({ list: multiWords(w.recap.multikills, t) }),
  },
  {
    id: "firstBlood",
    icon: "🩸",
    value: (v) => v.recap.firstBloods / v.recap.games,
    show: (x, v, { t }) => `${t.number(v.recap.firstBloods)} · ${pct(t, x)}`,
    values: (_w, _l, { t }, x) => ({ rate: pct(t, x.win) }),
  },
  {
    id: "flawless",
    icon: "✨",
    value: (v) => v.recap.deathlessGames / v.recap.games,
    show: (_, v) => String(v.recap.deathlessGames),
    values: (w) => ({ count: w.recap.deathlessGames }),
  },
  {
    id: "careerGame",
    icon: "⭐",
    value: (v) => v.recap.bestGame?.kda ?? null,
    show: (_, v) => `${v.recap.bestGame.kills}/${v.recap.bestGame.deaths}/${v.recap.bestGame.assists}`,
    variant: (w) => (w.recap.bestGame.win ? "line" : "lineLost"),
    values: (w, _l, ctx) => {
      const g = w.recap.bestGame;
      return { kills: g.kills, deaths: g.deaths, assists: g.assists, champion: ctx.nameOf(g.champion) };
    },
  },
  {
    id: "spree",
    icon: "🔪",
    value: (v) => orNull(v.quirks?.biggestSpree),
    show: (x) => String(x),
    values: (_w, _l, _c, x) => ({ count: x.win }),
  },
  {
    id: "lifespan",
    icon: "🧟",
    scored: false,
    value: (v) => orNull(v.quirks?.longestLife),
    show: (x) => clock(x),
    values: (_w, _l, _c, x) => ({ time: clock(x.win) }),
  },
  {
    id: "soloKills",
    icon: "🗡️",
    value: (v) => v.quirks?.soloKillsPerGame ?? null,
    show: (x, _v, { t }) => fixed(t, 2, x),
    values: (_w, _l, { t }, x) => ({ value: fixed(t, 2, x.win) }),
  },
  {
    id: "dodge",
    icon: "🕺",
    value: (v) => v.quirks?.dodgedPerGame ?? null,
    show: (x, _v, { t }) => fixed(t, 1, x),
    values: (_w, _l, { t }, x) => ({ value: fixed(t, 1, x.win) }),
  },
  {
    id: "thief",
    icon: "🥷",
    value: (v) => v.recap.objectives?.personal.stolen ?? null,
    show: (x) => String(x),
    values: (_w, _l, _c, x) => ({ count: x.win }),
  },
  {
    id: "epic",
    icon: "🐉",
    value: (v) => (v.recap.objectives ? v.recap.objectives.personal.dragons + v.recap.objectives.personal.barons * 2 : null),
    show: (_, v, { t }) => t("versus.short.epic", { dragons: v.recap.objectives.personal.dragons, barons: v.recap.objectives.personal.barons }),
    values: (w) => ({ dragons: w.recap.objectives.personal.dragons, barons: w.recap.objectives.personal.barons }),
  },
  {
    id: "siege",
    icon: "🏰",
    value: (v) => v.recap.objectives?.share.turrets ?? null,
    show: (x, _v, { t }) => pct(t, x),
    values: (_w, _l, { t }, x) => ({ share: pct(t, x.win) }),
  },
  {
    id: "objDamage",
    icon: "🎯",
    value: (v) => (v.recap.objectives ? v.recap.objectives.personal.damageToObjectives / v.recap.objectives.games : null),
    show: (x, _v, { t }) => thousands(t, x),
    values: (_w, _l, { t }, x) => ({ value: thousands(t, x.win) }),
  },
];

// ============================================================ Rift habits: the little things

const HABITS = [
  {
    id: "flash",
    icon: "⚡",
    scored: false,
    value: (v) => v.quirks?.flashPerGame ?? null,
    show: (x, _v, { t }) => fixed(t, 1, x),
    values: (_w, _l, { t }, x) => ({ value: fixed(t, 1, x.win) }),
  },
  {
    id: "grayScreen",
    icon: "👻",
    higher: false,
    value: (v) => v.quirks?.deadShare ?? null,
    show: (x, _v, { t }) => pct(t, x),
    values: (_w, _l, { t }, x) => ({ share: pct(t, x.win), otherShare: pct(t, x.lose) }),
  },
  {
    id: "pings",
    icon: "📍",
    scored: false,
    value: (v) => v.quirks?.pingsPerGame ?? null,
    show: (x, _v, { t }) => fixed(t, 0, x),
    values: (_w, _l, { t }, x) => ({ value: fixed(t, 0, x.win) }),
  },
  {
    id: "pinks",
    icon: "🩷",
    value: (v) => v.quirks?.controlWardsPerGame ?? null,
    show: (x, _v, { t }) => fixed(t, 1, x),
    values: (_w, _l, { t }, x) => ({ value: fixed(t, 1, x.win) }),
  },
  {
    id: "sweeper",
    icon: "🧹",
    value: (v) => v.quirks?.wardsClearedPerGame ?? null,
    show: (x, _v, { t }) => fixed(t, 1, x),
    values: (_w, _l, { t }, x) => ({ value: fixed(t, 1, x.win) }),
  },
  {
    id: "gold",
    icon: "💰",
    value: (v) => v.quirks?.goldPerMin ?? null,
    show: (x, _v, { t }) => thousands(t, x),
    values: (_w, _l, { t }, x) => ({ value: thousands(t, x.win), otherValue: thousands(t, x.lose) }),
  },
  {
    id: "tank",
    icon: "🛡️",
    scored: false,
    value: (v) => v.quirks?.damageTakenPerGame ?? null,
    show: (x, _v, { t }) => thousands(t, x),
    values: (_w, _l, { t }, x) => ({ value: thousands(t, x.win) }),
  },
  {
    id: "medic",
    icon: "💚",
    scored: false,
    value: (v) => v.quirks?.allySupportPerGame ?? null,
    show: (x, _v, { t }) => thousands(t, x),
    values: (_w, _l, { t }, x) => ({ value: thousands(t, x.win) }),
  },
  {
    id: "cc",
    icon: "⛓️",
    scored: false,
    value: (v) => v.quirks?.ccPerGame ?? null,
    show: (x, _v, { t }) => t("versus.short.seconds", { value: Math.round(x) }),
    values: (_w, _l, _c, x) => ({ value: Math.round(x.win) }),
  },
  {
    id: "whiteFlag",
    icon: "🏳️",
    scored: false,
    value: (v) => v.quirks?.surrenderRate ?? null,
    show: (x, _v, { t }) => pct(t, x),
    values: (_w, _l, { t }, x) => ({ share: pct(t, x.win) }),
  },
  {
    id: "crit",
    icon: "💢",
    scored: false,
    value: (v) => orNull(v.quirks?.biggestCrit),
    show: (x, _v, { t }) => thousands(t, x),
    values: (_w, _l, { t }, x) => ({ value: thousands(t, x.win) }),
  },
  {
    id: "teamDamage",
    icon: "🧨",
    scored: false,
    value: (v) => v.quirks?.teamDamageShare ?? null,
    show: (x, _v, { t }) => pct(t, x),
    values: (_w, _l, { t }, x) => ({ share: pct(t, x.win) }),
  },
];

// ============================================================ form and grit

// Win rates over a few dozen games swing by several points on a single result, so a scenario needs a clear gap.
const WIN_RATE_GAP = 0.08;

const trendWords = ({ name, recap: { trend } }, t) =>
  Math.abs(trend.late - trend.early) < 0.03
    ? t("versus.trend.steady", { name, rate: pct(t, trend.late) })
    : t("versus.trend.change", { name, early: pct(t, trend.early), late: pct(t, trend.late) });
const winRateOf = (stats, min) => (stats && stats.games >= min ? stats.winRate : null);
const record = (stats, t) => t("versus.short.record", { rate: pct(t, stats.winRate), games: stats.games });

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const DIVISIONS = { IV: 0, III: 1, II: 2, I: 3 };
// One number for "how high on the ladder": tier, then division (100 points each), then LP. The base keeps Iron IV from being a flat zero.
const ladderScore = (rank) => (rank ? 1000 + Math.max(0, TIERS.indexOf(rank.tier)) * 400 + (DIVISIONS[rank.division] ?? 0) * 100 + rank.lp : null);

const FORM = [
  {
    id: "hotStreak",
    icon: "🔥",
    value: (v) => v.recap.streaks.win,
    show: (x, _v, { t }) => t("versus.short.win", { value: x }),
    values: (_w, _l, _c, x) => ({ win: x.win, lose: x.lose }),
  },
  {
    id: "tilt",
    icon: "🧊",
    higher: false,
    value: (v) => v.recap.streaks.loss,
    show: (x, _v, { t }) => t("versus.short.loss", { value: x }),
    values: (_w, _l, _c, x) => ({ win: x.win, lose: x.lose }),
  },
  {
    id: "momentum",
    icon: "📈",
    minDiff: WIN_RATE_GAP,
    value: (v) => (v.recap.trend ? v.recap.trend.late - v.recap.trend.early : null),
    show: (x, _v, { t }) => signed(t, x),
    values: (w, l, { t }) => ({ first: trendWords(w, t), second: trendWords(l, t) }),
  },
  {
    id: "ladder",
    icon: "🎖️",
    margin: 0.02, // the score carries a 1000 base, so 2% is already a division
    value: (v) => ladderScore(v.rank),
    show: (_, v) => v.rank.title,
    values: (w, l) => ({ title: w.rank.title, otherTitle: l.rank.title }),
  },
  {
    id: "seasonRanked",
    icon: "📜",
    minDiff: WIN_RATE_GAP,
    value: (v) => (v.rank && v.rank.wins + v.rank.losses >= 10 ? v.rank.winRate : null),
    show: (_, v, { t }) => t("versus.short.record", { rate: pct(t, v.rank.winRate), games: v.rank.wins + v.rank.losses }),
    values: (w, l, { t }) => ({ rate: pct(t, w.rank.winRate), otherRate: pct(t, l.rank.winRate) }),
  },
  {
    id: "rankedForm",
    icon: "🏆",
    minDiff: WIN_RATE_GAP,
    value: (v) => winRateOf(v.modes?.ranked, 5),
    show: (_, v, { t }) => record(v.modes.ranked, t),
    values: (w, l, { t }) => ({ rate: pct(t, w.modes.ranked.winRate), otherRate: pct(t, l.modes.ranked.winRate) }),
  },
  {
    id: "normals",
    icon: "🎈",
    minDiff: WIN_RATE_GAP,
    value: (v) => winRateOf(v.modes?.normal, 5),
    show: (_, v, { t }) => record(v.modes.normal, t),
    values: (w, l, { t }) => ({ rate: pct(t, w.modes.normal.winRate), otherRate: pct(t, l.modes.normal.winRate) }),
  },
  {
    id: "aram",
    icon: "🌉",
    minDiff: WIN_RATE_GAP,
    value: (v) => winRateOf(v.modes?.aram, 5),
    show: (_, v, { t }) => record(v.modes.aram, t),
    values: (w, l, { t }) => ({ rate: pct(t, w.modes.aram.winRate), otherRate: pct(t, l.modes.aram.winRate) }),
  },
  {
    id: "signature",
    icon: "🎭",
    minDiff: WIN_RATE_GAP,
    value: (v) => {
      const top = v.recap.topChampions[0];
      return top && top.games >= 3 ? top.winRate : null;
    },
    show: (_, v, { t }) => pct(t, v.recap.topChampions[0].winRate),
    values: (w, l, ctx) => {
      const [mine, theirs] = [w.recap.topChampions[0], l.recap.topChampions[0]];
      return { rate: pct(ctx.t, mine.winRate), champion: ctx.nameOf(mine.id), otherRate: pct(ctx.t, theirs.winRate), otherChampion: ctx.nameOf(theirs.id) };
    },
  },
];

// ============================================================ who's who: play style and character

const versus = (m) => `${m.wins}-${m.losses}`;

const IDENTITY = [
  {
    id: "pool",
    icon: "🎲",
    scored: false,
    // Both players are loaded over the same window, so the counts are comparable as they are.
    value: (v) => v.recap.uniqueChampions,
    show: (x, _v, { t }) => t("versus.short.champs", { count: x }),
    values: (w, l) => ({ count: w.recap.uniqueChampions, otherCount: l.recap.uniqueChampions }),
  },
  {
    id: "roleLoyalty",
    icon: "🧭",
    scored: false,
    value: (v) => v.recap.role?.share ?? null,
    show: (_, v, { t }) => `${t(`common.roles.${v.recap.role.key}`)} ${pct(t, v.recap.role.share)}`,
    values: (w, _l, { t }) => ({ role: t(`common.roles.${w.recap.role.key}`), share: pct(t, w.recap.role.share) }),
  },
  {
    id: "closer",
    icon: "⏱️",
    scored: false,
    higher: false,
    value: (v) => v.recap.avgGameMinutes,
    show: (x, _v, { t }) => t("versus.short.minutes", { value: fixed(t, 1, x) }),
    values: (_w, _l, { t }, x) => ({ value: fixed(t, 1, x.win), otherValue: fixed(t, 1, x.lose) }),
  },
  {
    id: "marathon",
    icon: "🏃",
    scored: false,
    value: (v) => v.recap.longestGame?.seconds ?? null,
    show: (x) => clock(x),
    variant: (w) => (w.recap.longestGame.win ? "line" : "lineLost"),
    values: (w, _l, ctx, x) => ({ time: clock(x.win), champion: ctx.nameOf(w.recap.longestGame.champion) }),
  },
  {
    id: "hours",
    icon: "⌛",
    scored: false,
    value: (v) => v.recap.hoursPlayed,
    show: (x, _v, { t }) => t("versus.short.hours", { value: fixed(t, 1, x) }),
    values: (_w, _l, { t }, x) => ({ value: fixed(t, 1, x.win), otherValue: fixed(t, 1, x.lose) }),
  },
  {
    id: "level",
    icon: "🎂",
    scored: false,
    value: (v) => v.level,
    show: (x, _v, { t }) => t("versus.short.level", { value: x }),
    values: (w, l) => ({ level: w.level, otherLevel: l.level }),
  },
  {
    id: "kryptonite",
    icon: "😈",
    // No nemesis counts as the best case, 100%, so having one is what loses. (If neither has one it's a tie and is skipped.)
    value: (v) => v.recap.nemesis?.winRate ?? 1,
    show: (_, v, { t, nameOf }) => (v.recap.nemesis ? `${nameOf(v.recap.nemesis.id)} ${versus(v.recap.nemesis)}` : t("versus.short.none")),
    variant: (w) => (w.recap.nemesis ? "line" : "lineNone"),
    values: (w, l, ctx) => {
      const n = l.recap.nemesis;
      return { enemy: ctx.nameOf(n.id), record: versus(n), theirEnemy: w.recap.nemesis ? ctx.nameOf(w.recap.nemesis.id) : "" };
    },
  },
  {
    id: "bully",
    icon: "😎",
    // Nobody to bully counts as 0, so a player with a victim always beats one without (and two without is skipped).
    value: (v) => v.recap.bestMatchup?.winRate ?? 0,
    show: (_, v, { t, nameOf }) => (v.recap.bestMatchup ? `${nameOf(v.recap.bestMatchup.id)} ${versus(v.recap.bestMatchup)}` : t("versus.short.none")),
    values: (w, _l, ctx) => ({ record: versus(w.recap.bestMatchup), champion: ctx.nameOf(w.recap.bestMatchup.id) }),
  },
];

// ============================================================

// `id` names the group's label and eyebrow in the `versus.groups` messages.
const SCENARIO_GROUPS = [
  { id: "moments", defs: MOMENTS },
  { id: "habits", defs: HABITS },
  { id: "form", defs: FORM },
  { id: "identity", defs: IDENTITY },
];

/** What every definition reads for one player. `p` is a loaded recap with `account`, `summoner`, `rank`, `modes`, `matches`. */
function playerView(p) {
  return {
    name: p.account.gameName,
    recap: p.recap,
    modes: p.modes,
    rank: p.rank,
    level: p.summoner?.summonerLevel ?? null,
    quirks: buildQuirks(p.matches, p.account.puuid),
  };
}

/**
 * The side bets worth a slide of their own for a matchup: the `limit` scenarios where the two differ most, biggest gap
 * first. No group supplies more than `perGroup`, so one theme (say, pings) can't crowd out the rest. `ctx` is
 * `{ t, nameOf }`: the translator and a champion id to name function.
 * @returns `{ scenarios, sideBets: { a, b } }`. Each scenario is a `compareScenario` result plus `group`, the eyebrow of the
 * group it came from. `sideBets` counts the scored scenarios each player won among the ones returned.
 */
export function buildScenarios(a, b, ctx, { limit = 8, perGroup = 3 } = {}) {
  const [va, vb] = [playerView(a), playerView(b)];
  const t = ctx.t ?? defaultT;
  const scoped = { ...ctx, t, scope: "versus.scenarios" };
  const scenarios = SCENARIO_GROUPS.flatMap(({ id, defs }) =>
    pickScenarios(defs, va, vb, scoped, perGroup).map((s) => ({ ...s, group: t(`versus.groups.${id}.eyebrow`) })),
  )
    .sort((x, y) => y.gap - x.gap)
    .slice(0, limit);
  return { scenarios, sideBets: tallyScenarios(scenarios) };
}
