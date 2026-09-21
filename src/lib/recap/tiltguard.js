import { defaultT } from "@/lib/i18n/en";
import { GAP_MINUTES } from "./sessions";

// The tilt guard: how your next game goes as losses pile up within one sitting, and whether you keep queueing anyway.
// A "sitting" is what `sessions.js` calls one: games less than `GAP_MINUTES` apart. A loss streak only means something inside
// one, so a loss on Monday and another on Thursday are not "two in a row".
//
// Win rates over a handful of games are mostly luck, so a "stop sign" (a streak depth where you really do worse) needs a gap
// bigger than chance alone would give.

const MIN_FOLLOWUPS = 30; // games that came right after another one in the same sitting, in total
const MIN_STEP_GAMES = 8; // games behind one bar before its win rate is shown
const MIN_DROP = 0.2; // the least a stop sign has to fall below your usual
const Z = 1.5; // and it has to be this many standard errors below it, which asks more of a bar with fewer games
const MAX_STEP = 3; // 3 stands for "3 or more in a row"

/** How long after your last game the "right now" note still applies, in hours. */
export const LIVE_HOURS = 3;

/**
 * Walks the games oldest first and counts how each went after 0, 1, 2 and 3+ losses in a row within one sitting, and how often a
 * game that ended at each depth was followed by another. Also returns where the last game left the run.
 */
function walkSittings(games) {
  const steps = Array.from({ length: MAX_STEP + 1 }, (_, key) => ({ key, games: 0, wins: 0, rate: null }));
  const queued = Array.from({ length: MAX_STEP + 1 }, () => ({ reached: 0, again: 0 })); // how often a game ending at this depth was followed by another
  let run = 0; // losses in a row, ending at the game before this one
  let pending = null; // the depth the previous game ended at, if it ended in a loss
  let previous = null;

  for (const game of games) {
    const sameSitting = previous != null && game.t - previous.t <= GAP_MINUTES * 60000;
    if (pending != null) {
      queued[pending].reached++;
      if (sameSitting) queued[pending].again++;
    }
    if (sameSitting) {
      const step = steps[Math.min(run, MAX_STEP)];
      step.games++;
      if (game.win) step.wins++;
    } else {
      run = 0;
    }
    run = game.win ? 0 : run + 1;
    pending = run > 0 ? Math.min(run, MAX_STEP) : null;
    previous = game;
  }
  return { steps, queued, run, previous };
}

/** The first streak depth (2, then 3+) where you win clearly less than `baseline`, or null. */
function findStopSign(steps, queued, baseline) {
  const enough = (step) => Math.max(MIN_DROP, Z * Math.sqrt((baseline * (1 - baseline)) / step.games));
  const hit = [2, 3].map((key) => steps[key]).find((step) => step.rate != null && baseline - step.rate >= enough(step));
  if (!hit) return null;
  const { reached, again } = queued[hit.key];
  return { losses: hit.key, rate: hit.rate, drop: baseline - hit.rate, keepGoing: reached >= MIN_STEP_GAMES ? again / reached : null };
}

/** The note for a losing streak you are on now (2 or more), or null. */
function findLive({ steps, run, previous }, stop) {
  const depth = Math.min(run, MAX_STEP);
  const now = steps[depth];
  return run >= 2 && now.rate != null ? { at: previous.t, run, rate: now.rate, stop: Boolean(stop && depth >= stop.losses) } : null;
}

/**
 * @param activity `[{ t: epoch ms, win: boolean }]`, one per game, any order
 * @returns null with too few back-to-back games to say anything, else
 * `{ steps, baseline, followups, stop, mood, live }`:
 * - `steps`: `[{ key, games, wins, rate }]` for the game after a win (`key` 0), after 1 loss, after 2 in a row and after 3 or
 *   more (`rate` is null with too few games)
 * - `baseline`: your win rate over all those games
 * - `stop`: null, or `{ losses, rate, drop, keepGoing }` for the first streak depth (2, then 3+) where you win clearly less;
 *   `keepGoing` is the share of the time you queued again at that depth (null with too few)
 * - `mood`: "stop" or "steady"
 * - `live`: null, or `{ at, run, rate, stop }` for a losing streak you are on now (2 or more in your last sitting): `at` is
 *   when your last game was, `rate` is what you usually win after that many, and `stop` says whether it is past the stop sign.
 *   It says nothing about whether it is still "now": the page checks `at` against the clock.
 */
export function getTiltGuard(activity) {
  if (!Array.isArray(activity) || activity.length === 0) return null;
  const games = [...activity].sort((a, b) => a.t - b.t);

  const walk = walkSittings(games);
  const { steps, queued } = walk;

  const followups = steps.reduce((total, step) => total + step.games, 0);
  if (followups < MIN_FOLLOWUPS) return null;
  for (const step of steps) if (step.games >= MIN_STEP_GAMES) step.rate = step.wins / step.games;
  // One loss on its own is the Tilt slide's business: this one needs a streak to look at.
  if (steps[1].rate == null || (steps[2].rate == null && steps[3].rate == null)) return null;

  const baseline = steps.reduce((total, step) => total + step.wins, 0) / followups;
  const stop = findStopSign(steps, queued, baseline);

  return { steps, baseline, followups, stop, mood: stop ? "stop" : "steady", live: findLive(walk, stop) };
}

/** The sentences under the bars: the verdict, and for a stop sign, how often you queue again anyway (or null). */
export function tiltGuardLines(guard, t = defaultT) {
  if (guard.stop) {
    const { losses, rate, keepGoing } = guard.stop;
    return [
      t("insights.tiltguard.stop", { losses, rate: t.percent(rate), base: t.percent(guard.baseline) }),
      keepGoing != null && keepGoing >= 0.5 ? t("insights.tiltguard.keepGoing", { keep: t.percent(keepGoing) }) : null,
    ];
  }
  const deepest = [3, 2].map((key) => guard.steps[key]).find((step) => step.rate != null);
  return [t("insights.tiltguard.steady", { losses: deepest.key, rate: t.percent(deepest.rate) }), null];
}

/** The "right now" note for a losing streak in progress (`guard.live`). */
export function liveLine(live, t = defaultT) {
  return t(live.stop ? "insights.tiltguard.liveStop" : "insights.tiltguard.liveInfo", { run: live.run, rate: t.percent(live.rate) });
}
