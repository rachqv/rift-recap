import { defaultT } from "@/lib/i18n/en";

// The trophy shelf: small achievements unlocked by what happened in your games. Each badge has a `value` (where you are)
// and a `target` (what unlocks it), so a locked one can show how close you got.

const MIN_RATED_GAMES = 20; // rate badges (win rate, kill participation, CS and vision per minute) only count with this many games behind them
const MIN_AFTER_LOSS_GAMES = 8;

// Each badge's name and text are the `badges.<id>` messages. `value(recap)` returns a number, or null when the data isn't there (the badge then stays locked with no progress).
//
// The order here is the bingo board (`bingo.js`): five rows of five, read left to right, with a free space in the middle
// (so the third row has four badges). It is the same for every player, so two people's cards line up square for square.
// Each row is a theme: highlights, form, objectives, teamwork and vision, dedication. Reordering, adding or removing a badge
// changes every player's board, so keep the total at 24.
const BADGES = [
  { id: "penta", icon: "\u{1F525}", target: 1, value: (r) => r.multikills.penta },
  { id: "quadra", icon: "⚡", target: 3, value: (r) => r.multikills.quadra },
  { id: "triple", icon: "\u{1F3AF}", target: 10, value: (r) => r.multikills.triple },
  { id: "kills", icon: "\u{1F5E1}️", target: 20, value: (r) => r.mostKills },
  { id: "perfect", icon: "\u{1F48E}", target: 10, value: (r) => r.bestGame?.kda ?? null },

  { id: "flawless", icon: "✨", target: 1, value: (r) => r.deathlessGames },
  { id: "flawless5", icon: "\u{1F6E1}️", target: 5, value: (r) => r.deathlessGames },
  { id: "streak", icon: "\u{1F4C8}", target: 8, value: (r) => r.streaks.win },
  { id: "winrate", icon: "\u{1F451}", target: 0.6, value: (r) => (r.games >= MIN_RATED_GAMES ? r.winRate : null), percent: true },
  { id: "bounce", icon: "\u{1F504}", target: 0.6, percent: true, value: (r) => (r.afterResult?.loss.games >= MIN_AFTER_LOSS_GAMES ? r.afterResult.loss.wins / r.afterResult.loss.games : null) },

  { id: "dragon", icon: "\u{1F432}", target: 10, value: (r) => r.objectives?.personal.dragons ?? null },
  { id: "baron", icon: "\u{1F47E}", target: 5, value: (r) => r.objectives?.personal.barons ?? null },
  // (the free space sits here, in the middle of the row)
  { id: "turrets", icon: "\u{1F3F0}", target: 100, value: (r) => r.objectives?.personal.turrets ?? null },
  { id: "thief", icon: "\u{1F97E}", target: 1, value: (r) => r.objectives?.personal.stolen ?? null },

  { id: "firstblood", icon: "\u{1FA78}", target: 10, value: (r) => r.firstBloods },
  { id: "teamplayer", icon: "\u{1F91C}", target: 0.65, percent: true, value: (r) => (r.games >= MIN_RATED_GAMES ? (r.killParticipation ?? null) : null) },
  { id: "duo", icon: "\u{1F46F}", target: 20, value: (r) => r.duo?.games ?? 0 },
  { id: "vision", icon: "\u{1F441}️", target: 1.5, decimals: 1, value: (r) => (r.games >= MIN_RATED_GAMES ? (r.visionPerMin ?? null) : null) },
  { id: "farm", icon: "\u{1F33E}", target: 7.5, decimals: 1, value: (r) => (r.games >= MIN_RATED_GAMES ? (r.csPerMin ?? null) : null) },

  { id: "variety", icon: "\u{1F308}", target: 20, value: (r) => r.uniqueChampions },
  { id: "roles", icon: "\u{1F9ED}", target: 5, value: (r) => r.roleCount ?? 0 },
  { id: "loyal", icon: "\u{1F91D}", target: 30, value: (r) => r.topChampions[0]?.games ?? 0 },
  { id: "marathon", icon: "\u{1F3C3}", target: 2700, value: (r) => r.longestGame?.seconds ?? null },
  { id: "hours", icon: "⌛", target: 40, value: (r) => r.hoursPlayed },
];

/**
 * @param recap a `buildRecap` result
 * @returns `{ badges, unlocked, total }` where each badge is `{ id, icon, name, text, unlocked, progress, slot }`.
 * `progress` is 0 to 1 (1 once unlocked; 0 when there is no data). Unlocked badges come first, and `slot` is the badge's
 * place in the catalog (0 to 23), which is where it sits on the bingo board.
 */
export function getBadges(recap, t = defaultT) {
  const badges = BADGES.map(({ value, target, percent, decimals, ...badge }, slot) => {
    const v = value(recap);
    const unlocked = v != null && v >= target;
    const shown = percent ? t.percent(target) : decimals ? t.fixed(target, decimals) : target;
    const text = t(`badges.${badge.id}.text`, { target: shown, games: MIN_RATED_GAMES, minutes: target / 60 });
    return { ...badge, slot, name: t(`badges.${badge.id}.name`), text, unlocked, progress: v == null ? 0 : Math.min(1, Math.max(0, v / target)) };
  });
  const ordered = [...badges.filter((b) => b.unlocked), ...badges.filter((b) => !b.unlocked).sort((a, b) => b.progress - a.progress)];
  return { badges: ordered, unlocked: badges.filter((b) => b.unlocked).length, total: badges.length };
}
