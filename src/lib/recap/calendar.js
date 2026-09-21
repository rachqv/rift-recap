import { defaultT } from "@/lib/i18n/en";

// Calendar heatmap: games per day in a GitHub-style grid, plus when you like to play.
//
// Days and hours are the *local* ones of whoever runs this (the browser), because "you play at night" only
// makes sense in the player's own time zone. So this is meant to run client-side.

const HOURS_LABEL = ["night", "morning", "afternoon", "evening"];

// Win rate by time of day and by month only says something with enough games behind each bucket, and when the best
// and worst are far enough apart that luck alone would rarely do it.
const MIN_BUCKET_GAMES = 8;
const MIN_FORM_GAP = 0.15;
export const partOf = (hour) => (hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening");

const pad = (n) => String(n).padStart(2, "0");
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
// Building dates from parts (not adding 24h of milliseconds) keeps days correct across daylight saving changes.
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const mondayFirst = (date) => (date.getDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
const weeksBetween = (from, to) => Math.round((to - from) / (7 * 86400000));

/** Heat level 0-4. Uses the counts as they are while they're small, and scales to the busiest day after that. */
const levelOf = (count, max) => (count === 0 ? 0 : max <= 4 ? count : Math.max(1, Math.ceil((count / max) * 4)));

/**
 * @param activity `[{ t: epoch ms, win: boolean }]`, one per game
 * @param options `now` (epoch ms), `minWeeks`/`maxWeeks` bound the width of the grid
 * @returns `null` with no games, else `{ weeks, months, cols, stats }`. `weeks` is columns of 7 days (Monday
 * first); each day is `{ key, date, games, wins, level, state }` where state is "day", "future" or "nodata"
 * (before the earliest game we have, so we can't say whether it was a quiet day).
 */
export function buildCalendar(activity, { now = Date.now(), minWeeks = 10, maxWeeks = 53 } = {}) {
  if (!activity?.length) return null;

  const today = startOfDay(new Date(now));
  const perDay = new Map();
  const perHour = new Array(24).fill(0);
  const perWeekday = new Array(7).fill(0);
  const perPart = new Map(); // "evening" -> { games, wins }
  const perMonth = new Map(); // "2026-03" -> { games, wins, date }
  const tally = (map, key, win, extra) => {
    const entry = map.get(key) ?? { games: 0, wins: 0, ...extra };
    entry.games++;
    if (win) entry.wins++;
    map.set(key, entry);
  };
  let earliest = Infinity;

  for (const { t, win } of activity) {
    const date = new Date(t);
    const key = dayKey(date);
    const entry = perDay.get(key) ?? { games: 0, wins: 0 };
    entry.games++;
    if (win) entry.wins++;
    perDay.set(key, entry);
    perHour[date.getHours()]++;
    perWeekday[mondayFirst(date)]++;
    tally(perPart, partOf(date.getHours()), win);
    tally(perMonth, key.slice(0, 7), win, { date: new Date(date.getFullYear(), date.getMonth(), 1) });
    earliest = Math.min(earliest, t);
  }

  const first = startOfDay(new Date(earliest));
  const thisWeek = addDays(today, -mondayFirst(today));
  const cols = Math.min(maxWeeks, Math.max(minWeeks, weeksBetween(addDays(first, -mondayFirst(first)), thisWeek) + 1));
  const gridStart = addDays(thisWeek, -(cols - 1) * 7);

  const max = Math.max(...[...perDay.values()].map((d) => d.games));
  const weeks = Array.from({ length: cols }, (_, col) =>
    Array.from({ length: 7 }, (_, row) => {
      const date = addDays(gridStart, col * 7 + row);
      const key = dayKey(date);
      const { games = 0, wins = 0 } = perDay.get(key) ?? {};
      const state = date > today ? "future" : date < first ? "nodata" : "day";
      return { key, date, games, wins, level: state === "day" ? levelOf(games, max) : 0, state };
    }),
  );

  // Label a column with its month when the month changes.
  const months = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const month = week[0].date.getMonth();
    if (month !== lastMonth) months.push({ col, date: week[0].date });
    lastMonth = month;
  });

  return { weeks, months, cols, stats: summarize({ perDay, perHour, perWeekday, perPart, perMonth, first, today, max, total: activity.length }) };
}

function summarize({ perDay, perHour, perWeekday, perPart, perMonth, first, today, max, total }) {
  // Longest run of consecutive days with at least one game.
  let longest = 0;
  let run = 0;
  for (let day = first; day <= today; day = addDays(day, 1)) {
    run = perDay.has(dayKey(day)) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  const busiestKey = [...perDay.entries()].sort((a, b) => b[1].games - a[1].games || (a[0] < b[0] ? 1 : -1))[0][0];
  const [y, m, d] = busiestKey.split("-").map(Number);

  const share = (from, to) => perHour.slice(from, to).reduce((a, b) => a + b, 0) / total;
  const parts = [share(0, 5), share(5, 12), share(12, 18), share(18, 24)];
  const weekend = (perWeekday[5] + perWeekday[6]) / total;

  return {
    total,
    activeDays: perDay.size,
    longestStreak: longest,
    busiest: { date: new Date(y, m - 1, d), games: max },
    favoriteWeekday: perWeekday.indexOf(Math.max(...perWeekday)), // 0 = Monday
    peakHour: perHour.indexOf(Math.max(...perHour)),
    parts: Object.fromEntries(HOURS_LABEL.map((label, i) => [label, parts[i]])),
    weekendShare: weekend,
    form: { part: extremes(perPart), month: extremes(perMonth) },
    flavor: flavorOf({ nightShare: parts[0], morningShare: parts[1], weekend, total }),
  };
}

/**
 * The best and worst bucket by win rate, among those with enough games. Null when there aren't two of them or the two
 * are too close to tell apart. Each is `{ key, rate, games, ...extra }`.
 */
function extremes(buckets) {
  const rated = [...buckets]
    .filter(([, b]) => b.games >= MIN_BUCKET_GAMES)
    .map(([key, b]) => ({ ...b, key, rate: b.wins / b.games }))
    .sort((a, b) => b.rate - a.rate);
  if (rated.length < 2) return null;
  const [best, worst] = [rated[0], rated.at(-1)];
  return best.rate - worst.rate >= MIN_FORM_GAP ? { best, worst } : null;
}

/** A short label for when the player plays, or null when nothing stands out. */
function flavorOf({ nightShare, morningShare, weekend, total }) {
  if (nightShare >= 0.2) return "night owl";
  if (morningShare >= 0.4) return "early bird";
  if (total >= 10 && weekend >= 0.6) return "weekend warrior";
  if (total >= 10 && weekend <= 0.15) return "weekday grinder";
  return null;
}

const FLAVOR_LINES = {
  "night owl": (s, t) => t("heatmap.insight.nightOwl", { share: t.percent(s.parts.night) }),
  "early bird": (s, t) => t("heatmap.insight.earlyBird", { share: t.percent(s.parts.morning) }),
  "weekend warrior": (s, t) => t("heatmap.insight.weekend", { share: t.percent(s.weekendShare) }),
  "weekday grinder": (s, t) => t("heatmap.insight.weekday"),
};

export function getCalendarInsight(stats, t = defaultT) {
  if (stats.flavor) return FLAVOR_LINES[stats.flavor](stats, t);
  if (stats.longestStreak >= 4) return t("heatmap.insight.streak", { days: stats.longestStreak });
  return t("heatmap.insight.steady");
}
