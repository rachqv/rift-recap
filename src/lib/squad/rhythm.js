import { pct, pickScenarios } from "./scenarioCore";
import { defaultT } from "@/lib/i18n/en";

// "When do you play" scenarios. They read `buildCalendar(...).stats`, which depends on the viewer's own time zone, so
// (like the calendar itself) they are meant to run in the browser. Their words are the `rhythm.<id>` messages, which
// are sent to the browser (unlike the head-to-head ones).

const RHYTHM = [
  {
    id: "nightOwl",
    icon: "🦉",
    scored: false,
    minDiff: 0.05,
    value: (v) => v.stats.parts.night,
    show: (x, v, { t }) => pct(t, x),
    values: (w, l, { t }, x) => ({ share: pct(t, x.win) }),
  },
  {
    id: "earlyBird",
    icon: "🐦",
    scored: false,
    minDiff: 0.05,
    value: (v) => v.stats.parts.morning,
    show: (x, v, { t }) => pct(t, x),
    values: (w, l, { t }, x) => ({ share: pct(t, x.win) }),
  },
  {
    id: "weekend",
    icon: "🏖️",
    scored: false,
    minDiff: 0.05,
    value: (v) => v.stats.weekendShare,
    show: (x, v, { t }) => pct(t, x),
    values: (w, l, { t }, x) => ({ share: pct(t, x.win) }),
  },
  {
    id: "streak",
    icon: "📅",
    scored: false,
    value: (v) => v.stats.longestStreak,
    show: (x, v, { t }) => t("rhythm.daysShort", { value: x }),
    values: (w, l, ctx, x) => ({ days: x.win, otherDays: x.lose }),
  },
  {
    id: "binge",
    icon: "🍿",
    scored: false,
    value: (v) => v.stats.busiest.games,
    show: (x) => String(x),
    values: (w, l, ctx, x) => ({ games: x.win }),
  },
];

/**
 * @param a, b `{ name, stats }` where `stats` is `buildCalendar(activity).stats`
 * @returns the scenarios where the two play at the most different times, biggest gap first
 */
export function buildRhythmScenarios(a, b, limit = 5, t = defaultT) {
  return pickScenarios(RHYTHM, a, b, { t, scope: "rhythm" }, limit);
}
