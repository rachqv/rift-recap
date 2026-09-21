import { defaultT } from "@/lib/i18n/en";
import { PING_STYLE_KEYS } from "@/lib/pings";

// Small habits worth a line each: which ping you lean on, which summoner spells you take and how you use Flash, and how
// often your games end in a surrender. Every reader returns null when there isn't enough data to say anything.

// A ping style needs this many pings and games behind it: a handful of pings says nothing about a personality.
const MIN_PINGS = 30;
const MIN_PING_GAMES = 8;
// ...and the favourite has to be a real favourite, not just the top of a flat spread.
const MIN_TOP_SHARE = 0.22;

const MIN_SURRENDER_GAMES = 10;
const MIN_SPELL_GAMES = 8;

// Summoner spell ids from Data Dragon's summoner.json (they change rarely). Their names are in the `insights.spells` messages.
const SPELL_IDS = new Set([1, 3, 4, 6, 7, 11, 12, 13, 14, 21, 32]);
const spellName = (id, t) => t(SPELL_IDS.has(id) ? `insights.spells.${id}` : "insights.spells.unknown");

/** `{ perGame, top: { key, label, share }, title, line }` from the ping types, or null when there isn't enough. */
export function getPingStyle(recap, t = defaultT) {
  const pings = recap.pings;
  if (!pings || pings.games < MIN_PING_GAMES) return null;
  const total = Object.values(pings.byType).reduce((a, b) => a + b, 0);
  if (total < MIN_PINGS) return null;

  const [key, count] = Object.entries(pings.byType).sort((a, b) => b[1] - a[1])[0];
  if (!PING_STYLE_KEYS.includes(key) || count / total < MIN_TOP_SHARE) return null;
  return {
    perGame: total / pings.games,
    top: { key, label: t(`insights.pings.${key}.label`), share: count / total },
    title: t(`insights.pings.${key}.title`),
    line: t(`insights.pings.${key}.line`),
  };
}

/** `{ pair: [name, name], pairShare, flash: { key, perGame } | null }`, or null. */
export function getSpellHabits(recap, t = defaultT) {
  const spells = recap.spells;
  if (!spells || spells.games < MIN_SPELL_GAMES || !spells.topPair) return null;
  const [a, b] = spells.topPair.ids;
  return {
    pair: [spellName(a, t), spellName(b, t)],
    pairShare: spells.topPair.games / spells.games,
    flash: spells.flash ? { key: spells.flash.key, perGame: spells.flash.perGame } : null,
  };
}

/** `{ rate, ended, enemyQuit, weQuit }`: how many of your games ended in a surrender, and which side gave up. */
export function getSurrender(recap) {
  const s = recap.surrender;
  if (!s || s.known < MIN_SURRENDER_GAMES) return null;
  return { rate: s.ended / s.known, ended: s.ended, enemyQuit: s.enemyQuit, weQuit: s.ended - s.enemyQuit };
}

/**
 * All three, ready for a slide: `{ ping, spells, surrender, line }` (each part null when missing) or null when none
 * of them have anything. `line` is the one sentence worth saying.
 */
export function getHabits(recap, t = defaultT) {
  const [ping, spells, surrender] = [getPingStyle(recap, t), getSpellHabits(recap, t), getSurrender(recap)];
  if (!ping && !spells && !surrender) return null;

  let line;
  if (ping) line = ping.line;
  else if (spells?.flash) {
    const { key, perGame } = spells.flash;
    line = t(perGame >= 2 ? "insights.habits.flashEdge" : "insights.habits.flashCalm", { key, perGame: t.fixed(perGame) });
  } else if (surrender) line = surrenderLine(surrender, t);
  else line = t("insights.habits.pair", { a: spells.pair[0], b: spells.pair[1], share: t.percent(spells.pairShare) });
  return { ping, spells, surrender, line };
}

export function surrenderLine({ rate, weQuit, enemyQuit }, t = defaultT) {
  if (rate >= 0.4) return t("insights.habits.surrenderOften", { rate: t.percent(rate) });
  if (weQuit > enemyQuit) return t("insights.habits.surrenderUs", { weQuit, enemyQuit });
  if (enemyQuit > weQuit) return t("insights.habits.surrenderThem", { weQuit, enemyQuit });
  return t("insights.habits.surrenderRare", { rate: t.percent(rate) });
}
