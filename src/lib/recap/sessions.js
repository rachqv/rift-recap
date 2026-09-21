// Gaming sessions: games played close together, as one sitting. Two games more than `GAP_MINUTES` apart start a new one.
// Works on `[{ t, win }]` (one entry per game, oldest first), so it needs no time zone: it only looks at the gaps.

import { defaultT } from "@/lib/i18n/en";

export const GAP_MINUTES = 90;
const MIN_SESSIONS = 3;
const MIN_SESSION_GAMES = 3; // a "night" needs at least this many games to be worth naming

/**
 * @returns `{ sessions, avgGames, best, worst, longest }` or null with too few sittings. Each named session is
 * `{ start, games, wins, losses }`; `best` and `worst` are by wins minus losses, and `worst` is null unless it was a losing night.
 */
export function getSessions(activity) {
  if (!Array.isArray(activity) || activity.length === 0) return null;
  const ordered = [...activity].sort((a, b) => a.t - b.t);

  const sessions = [];
  for (const game of ordered) {
    const last = sessions.at(-1);
    if (last && game.t - last.end <= GAP_MINUTES * 60000) {
      last.end = game.t;
      last.games++;
      if (game.win) last.wins++;
    } else {
      sessions.push({ start: game.t, end: game.t, games: 1, wins: game.win ? 1 : 0 });
    }
  }
  const all = sessions.map((s) => ({ ...s, losses: s.games - s.wins }));
  if (all.length < MIN_SESSIONS) return null;

  const real = all.filter((s) => s.games >= MIN_SESSION_GAMES);
  if (real.length === 0) return null;
  const net = (s) => s.wins - s.losses;
  const byNet = [...real].sort((a, b) => net(b) - net(a) || b.games - a.games);
  const best = byNet[0];
  const worst = byNet.at(-1);
  const longest = [...real].sort((a, b) => b.games - a.games)[0];
  return {
    sessions: all.length,
    avgGames: ordered.length / all.length,
    best,
    worst: net(worst) < 0 && worst !== best ? worst : null,
    longest,
  };
}

export function sessionLine({ best, worst, longest }, t = defaultT) {
  if (worst && best.wins / best.games >= 0.7) {
    return t("insights.sessions.contrast", { bestWins: best.wins, bestLosses: best.losses, worstWins: worst.wins, worstLosses: worst.losses });
  }
  if (longest.games >= 8) return t("insights.sessions.marathon", { games: longest.games });
  return t("insights.sessions.best", { wins: best.wins, losses: best.losses });
}
