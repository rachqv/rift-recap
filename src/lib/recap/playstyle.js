import { defaultT } from "@/lib/i18n/en";

// More reads on how a player plays, each from data `buildRecap` already collects: which kind of damage they deal, how
// they do against their lane opponent and with their gold, how the classes on their team change their results, and
// their most memorable games. Each returns null when there isn't enough data to say something honest.

const thousands = (t, x) => t.number(Math.round(Math.abs(x)));

// ------------------------------------------------------------ damage profile

const MIN_DAMAGE_GAMES = 8;

/**
 * @returns null, or `{ games, shares: { physical, magic, true }, style, line }` where `shares` add up to 1 and `style` is a
 * short title for the mix.
 */
export function getDamageProfile(recap, t = defaultT) {
  const d = recap.damageTypes;
  if (!d || d.games < MIN_DAMAGE_GAMES) return null;
  const total = d.physical + d.magic + d.true;
  if (total <= 0) return null;
  const shares = { physical: d.physical / total, magic: d.magic / total, true: d.true / total };

  const [kind, share] =
    shares.magic >= 0.6 ? ["spellslinger", shares.magic] : shares.physical >= 0.75 ? ["steel", shares.physical] : shares.true >= 0.12 ? ["trueDamage", shares.true] : ["mixed", 0];
  const style = t(`insights.damage.${kind}.style`);
  const line = t(`insights.damage.${kind}.line`, { share: t.percent(share) });
  return { games: d.games, shares, style, line };
}

// ------------------------------------------------------------ lane and gold

const MIN_LANE_GAMES = 8;

/**
 * You against your lane opponent (the enemy in your position), per game.
 * @returns null, or `{ games, cs, gold, damage, kills, aheadRate, line }`; each difference is yours minus theirs.
 */
export function getLaneCheck(recap, t = defaultT) {
  const lane = recap.lane;
  if (!lane || lane.games < MIN_LANE_GAMES) return null;
  const n = lane.games;
  const result = { games: n, cs: lane.cs / n, gold: lane.gold / n, damage: lane.damage / n, kills: lane.kills / n, aheadRate: lane.ahead / n };
  const line =
    result.aheadRate >= 0.6
      ? t("insights.lane.bully", { rate: t.percent(result.aheadRate), gold: thousands(t, result.gold) })
      : result.aheadRate <= 0.4
        ? t("insights.lane.behind", { rate: t.percent(1 - result.aheadRate) })
        : t("insights.lane.even", { rate: t.percent(result.aheadRate) });
  return { ...result, line };
}

/** Gold left unspent when the game ended, per game. Null with no data. */
export function getGoldHabits(recap, t = defaultT) {
  const g = recap.gold;
  if (!g || g.games < MIN_DAMAGE_GAMES) return null;
  const unspent = g.unspent / g.games;
  const line = t(`insights.gold.${unspent >= 900 ? "high" : unspent >= 300 ? "mid" : "low"}`, { gold: thousands(t, unspent) });
  return { unspent, line };
}

// ------------------------------------------------------------ team composition

const CLASSES = ["Tank", "Marksman", "Mage", "Assassin", "Fighter", "Support"];
const MIN_SIDE_GAMES = 8; // games with and without a class, before comparing win rates
const MIN_COMP_GAP = 0.12;

/**
 * How the classes on your team change your results.
 * @param tagsOf function from champion id to its Data Dragon tags (or undefined)
 * @returns null, or `{ facts, line }` where each fact is `{ label, inline, withRate, withGames, withoutRate, withoutGames, gap }`
 * for a class that makes at least a 12 point difference (up to three, biggest first).
 */
export function getTeamComp(recap, tagsOf, t = defaultT) {
  const games = recap.teamGames ?? [];
  if (games.length < MIN_SIDE_GAMES * 2) return null;

  const facts = [];
  for (const cls of CLASSES) {
    const tally = { with: { games: 0, wins: 0 }, without: { games: 0, wins: 0 } };
    for (const game of games) {
      const bucket = game.mates.some((id) => tagsOf?.(id)?.[0] === cls) ? tally.with : tally.without;
      bucket.games++;
      if (game.win) bucket.wins++;
    }
    if (tally.with.games < MIN_SIDE_GAMES || tally.without.games < MIN_SIDE_GAMES) continue;
    const [withRate, withoutRate] = [tally.with.wins / tally.with.games, tally.without.wins / tally.without.games];
    if (Math.abs(withRate - withoutRate) < MIN_COMP_GAP) continue;
    facts.push({ label: t(`insights.classes.${cls}`), inline: t(`insights.classInline.${cls}`), withRate, withGames: tally.with.games, withoutRate, withoutGames: tally.without.games, gap: withRate - withoutRate });
  }
  if (facts.length === 0) return null;

  facts.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const top = facts.slice(0, 3);
  const lead = top[0];
  const line = t(lead.gap > 0 ? "insights.comp.better" : "insights.comp.worse", { class: lead.inline, withRate: t.percent(lead.withRate), withoutRate: t.percent(lead.withoutRate) });
  return { facts: top, line };
}

// ------------------------------------------------------------ memorable games

/**
 * Up to three memorable games, each `{ kind, champion, kills, deaths, assists, seconds?, at, win }`: a pentakill (or the
 * most kills), the best KDA and the longest game. A game that is more than one of these appears once. Null with fewer than two.
 */
export function getHighlights(recap, t = defaultT) {
  const candidates = [
    recap.pentaGame ? { kind: t("insights.highlights.penta"), ...recap.pentaGame } : recap.killGame && recap.killGame.kills >= 8 ? { kind: t("insights.highlights.kills"), ...recap.killGame } : null,
    recap.bestGame ? { kind: t("insights.highlights.kda"), ...recap.bestGame } : null,
    recap.longestGame ? { kind: t("insights.highlights.longest"), ...recap.longestGame } : null,
  ].filter((game) => game && game.at != null);

  const seen = new Set();
  const games = candidates.filter((game) => (seen.has(game.at) ? false : seen.add(game.at)));
  return games.length >= 2 ? games : null;
}
