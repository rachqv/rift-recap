import { defaultT } from "@/lib/i18n/en";
import { partOf } from "./calendar";

// When you win: win rate by part of the day and by weekday. Like the calendar, it uses the *local* day and hour of
// whoever runs it (the browser), so "you win less after midnight" means the player's midnight.

const PARTS = ["morning", "afternoon", "evening", "night"];

const MIN_GAMES = 60; // below this, seven weekdays get a handful of games each
// A bucket needs this many games before its win rate is shown as a rate at all.
const MIN_BUCKET_GAMES = 8;
// A row of bars needs this many rated buckets to be worth drawing; with fewer it is mostly blanks.
const MIN_RATED = 3;
// How far apart the best and worst bucket must be before it counts as a pattern rather than luck. There are seven
// weekdays to pick the extremes from, so the bar is higher than for the four parts of the day.
const MIN_PART_GAP = 0.15;
const MIN_DAY_GAP = 0.2;

const mondayFirst = (date) => (date.getDay() + 6) % 7; // 0 = Monday ... 6 = Sunday

const bucket = (key) => ({ key, games: 0, wins: 0, rate: null });

function extremes(buckets, minGap) {
  const rated = buckets.filter((b) => b.rate != null).sort((a, b) => b.rate - a.rate);
  if (rated.length < 2) return null;
  const [best, worst] = [rated[0], rated.at(-1)];
  return best.rate - worst.rate >= minGap ? { best, worst, gap: best.rate - worst.rate } : null;
}

/** Games and wins by part of the day and by weekday; `rate` is set once a bucket has enough games. */
function bucketGames(activity) {
  const parts = PARTS.map(bucket);
  const days = Array.from({ length: 7 }, (_, key) => bucket(key));
  for (const { t, win } of activity) {
    const date = new Date(t);
    for (const entry of [parts[PARTS.indexOf(partOf(date.getHours()))], days[mondayFirst(date)]]) {
      entry.games++;
      if (win) entry.wins++;
    }
  }
  for (const entry of [...parts, ...days]) if (entry.games >= MIN_BUCKET_GAMES) entry.rate = entry.wins / entry.games;
  return { parts, days };
}

/**
 * @param activity `[{ t: epoch ms, win: boolean }]`, one per game
 * @returns null with too few games, or when neither row has enough rated buckets to draw, else
 * `{ total, winRate, parts, days, showParts, showDays, byPart, byDay, focus }`. `showParts` / `showDays` say whether that row has enough rated buckets to draw. `parts` (morning, afternoon,
 * evening, night) and `days` (Monday first) are `{ key, games, wins, rate }`, where `rate` is null until the bucket has
 * enough games. `byPart` / `byDay` are `{ best, worst, gap }` or null when nothing stands out, and `focus` is which of
 * the two is the stronger pattern ("day", "part") or "steady" when neither is.
 */
export function getWinClock(activity) {
  if (!Array.isArray(activity) || activity.length < MIN_GAMES) return null;

  const { parts, days } = bucketGames(activity);

  const [showParts, showDays] = [parts, days].map((row) => row.filter((b) => b.rate != null).length >= MIN_RATED);
  if (!showParts && !showDays) return null;

  // The caption only talks about rows that are drawn.
  const byPart = showParts ? extremes(parts, MIN_PART_GAP) : null;
  const byDay = showDays ? extremes(days, MIN_DAY_GAP) : null;
  const winRate = activity.filter((a) => a.win).length / activity.length;
  return { total: activity.length, winRate, parts, days, showParts, showDays, byPart, byDay, focus: strongerPattern(byPart, byDay) };
}

/** Which of the two rows shows the stronger pattern: "day", "part", or "steady" when neither does. */
function strongerPattern(byPart, byDay) {
  // Compare gaps in units of their own threshold, so a 25-point weekday swing doesn't lose to a 22-point part-of-day one.
  if (byDay && (!byPart || byDay.gap / MIN_DAY_GAP >= byPart.gap / MIN_PART_GAP)) return "day";
  return byPart ? "part" : "steady";
}

// 1 Jan 2024 was a Monday, so these dates give the weekday name in the reader's language.
const weekdayName = (day, t) => t.date(new Date(2024, 0, 1 + day), { weekday: "long" });

/** One line on the strongest pattern, in the reader's language. */
export function clockLine(clock, t = defaultT) {
  if (clock.focus === "day") {
    const { best, worst } = clock.byDay;
    return t("heatmap.clock.day", { best: weekdayName(best.key, t), bestRate: t.percent(best.rate), worst: weekdayName(worst.key, t), worstRate: t.percent(worst.rate) });
  }
  if (clock.focus === "part") {
    const { best, worst } = clock.byPart;
    return t("heatmap.clock.part", { best: t(`heatmap.parts.${best.key}`), bestRate: t.percent(best.rate), worst: t(`heatmap.parts.${worst.key}`), worstRate: t.percent(worst.rate) });
  }
  return t("heatmap.clock.steady");
}
