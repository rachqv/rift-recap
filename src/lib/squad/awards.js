import { defaultT } from "@/lib/i18n/en";

// Squad awards: "Most deaths", "Most likely to steal the objective", ... Each award goes to the member who leads a
// stat over the games the squad played together. The words of each are the `squad.awards.<key>` messages (`title`,
// `tagline`, `label` and `line`); `values` gives the numbers the line needs.

// Order matters: it is the running order of the slides, so the punchiest categories come first.
const AWARDS = [
  {
    id: "objective",
    variants: [
      {
        key: "objectiveSteal",
        icon: "🥷",
        // Steals are rare, so this variant only applies if somebody actually stole something.
        valid: (members) => members.some((m) => m.stolen > 0),
        value: (m) => m.stolen,
        show: (v) => String(v),
        values: (m) => ({ count: m.stolen }),
      },
      {
        key: "objectiveTake",
        icon: "🐉",
        valid: () => true,
        value: (m) => m.perMin.objDamage,
        show: (v, t) => t.number(Math.round(v)),
        values: (m, v, t) => ({ value: t.number(Math.round(m.perMin.objDamage)) }),
      },
    ],
  },
  { id: "deaths", key: "deaths", icon: "💀", value: (m) => m.perGame.deaths, show: (v, t) => t.fixed(v), values: (m, v, t) => ({ minutes: t.fixed(m.perGame.timeDead / 60) }) },
  { id: "pings", key: "pings", icon: "📍", value: (m) => m.perGame.pings, show: (v, t) => t.fixed(v, 0), values: (m, v, t) => ({ value: t.fixed(m.perGame.pings, 0) }) },
  { id: "vision", key: "vision", icon: "💡", value: (m) => m.perMin.vision, show: (v, t) => t.fixed(v, 2), values: (m, v, t) => ({ value: t.fixed(m.perMin.vision, 2) }) },
  { id: "tank", key: "tank", icon: "🛡️", value: (m) => m.perGame.damageTaken, show: (v, t) => t.number(Math.round(v)), values: (m, v, t) => ({ value: t.number(Math.round(m.perGame.damageTaken)) }) },
  { id: "assists", key: "assists", icon: "🤝", value: (m) => m.perGame.assists, show: (v, t) => t.fixed(v), values: (m, v, t) => ({ value: t.fixed(m.perGame.assists) }) },
  { id: "carry", key: "carry", icon: "👑", value: (m) => m.kda, show: (v, t) => t.fixed(v, 2), values: (m, v, t) => ({ value: t.fixed(m.kda, 2) }) },
  { id: "damage", key: "damage", icon: "💥", value: (m) => m.perMin.damage, show: (v, t) => t.number(Math.round(v)), values: (m, v, t) => ({ value: t.number(Math.round(m.perMin.damage)) }) },
  { id: "farm", key: "farm", icon: "🌾", value: (m) => m.perMin.cs, show: (v, t) => t.fixed(v), values: (m, v, t) => ({ value: t.fixed(m.perMin.cs) }) },
  {
    id: "present",
    key: "present",
    icon: "⚔️",
    valid: (members) => members.some((m) => m.killParticipation != null),
    value: (m) => (m.killParticipation == null ? null : m.killParticipation * 100),
    show: (v, t) => t.percent(v / 100),
    values: (m, v, t) => ({ value: t.percent(m.killParticipation) }),
  },
  { id: "cc", key: "cc", icon: "⛓️", value: (m) => m.perGame.cc, show: (v, t) => t.fixed(v, 0), values: (m) => ({ value: Math.round(m.perGame.cc) }) },
];

/**
 * Picks the winner of each award among members with enough games. A category is skipped when its winner already
 * holds `perMemberCap` awards, so the trophies spread across the squad instead of one player sweeping them.
 * Returns `[{ id, title, tagline, icon, label, winner, value, display, line, ranking }]` where `winner` and each
 * ranking entry's `member` are indexes into `members`.
 */
export function pickAwards(members, { minGames = 3, perMemberCap = 3 } = {}, t = defaultT) {
  const qualified = members.filter((m) => m.games >= minGames);
  if (qualified.length < 2) return [];

  const held = new Map();
  const awards = [];
  for (const def of AWARDS) {
    const variant = variantFor(def, qualified);
    const ranking = variant && rankMembers(qualified, variant);
    if (!ranking) continue;

    const winner = ranking[0].member;
    if ((held.get(winner.index) ?? 0) >= perMemberCap) continue;
    held.set(winner.index, (held.get(winner.index) ?? 0) + 1);
    awards.push(buildAward(def, variant, ranking, t));
  }
  return awards;
}

/** The variant of an award that applies to these members (the award itself when it has none), or undefined when it doesn't apply. */
function variantFor(def, qualified) {
  const variant = def.variants ? def.variants.find((v) => v.valid(qualified)) : def;
  return variant && (!variant.valid || variant.valid(qualified)) ? variant : undefined;
}

/** Everyone with a value, best first (lower index wins a tie), or null when there is nothing to compete over. */
function rankMembers(qualified, variant) {
  const ranking = qualified
    .map((member) => ({ member, value: variant.value(member) }))
    .filter((entry) => entry.value != null && Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value || a.member.index - b.member.index);
  return ranking.length < 2 || ranking[0].value <= 0 ? null : ranking;
}

function buildAward(def, variant, ranking, t) {
  const winner = ranking[0].member;
  const words = (part) => t(`squad.awards.${variant.key ?? def.key}.${part}`);
  return {
    id: def.id,
    title: words("title"),
    tagline: words("tagline"),
    icon: variant.icon ?? def.icon,
    label: words("label"),
    winner: winner.index,
    value: ranking[0].value,
    display: variant.show(ranking[0].value, t),
    line: t(`squad.awards.${variant.key ?? def.key}.line`, { name: winner.gameName, ...variant.values(winner, ranking[0].value, t) }),
    ranking: ranking.map((entry) => ({ member: entry.member.index, display: variant.show(entry.value, t) })),
  };
}
