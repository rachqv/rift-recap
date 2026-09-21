import { defaultT } from "@/lib/i18n/en";

// Your season as a line: your win rate over a rolling window of games, so you can see the hot streaks and the slumps that a
// single season-long percentage hides. The window is about a fifth of your games, between 10 and 20.
//
// The best and worst stretch are just the highest and lowest points of that line. Any noisy series has a high and a low, so
// they are reported as what happened ("your best stretch"), not as proof that you were better or worse then.

const MIN_GAMES = 30;
const MIN_WINDOW = 10;
const MAX_WINDOW = 20;
const MIN_SWING = 0.2; // the best and worst stretch must be this far apart before the season is called swingy
const MIN_SHIFT = 0.1; // how far "lately" must be from your season average to be called hot or cold

/**
 * @param recap a `buildRecap` result: it needs `results` and `resultTimes` (one per game, oldest first)
 * @returns null with too few games or no times, else `{ window, points, best, worst, now, average, swing, mood, trend }`:
 * - `points`: `[{ index, rate, at }]`, one per game from the `window`th on: `rate` is your win rate over the `window` games
 *   ending at game `index` (0-based), played at `at` (epoch ms)
 * - `best`, `worst`, `now`: the highest point (the first one if it is reached more than once), the lowest, and the last
 * - `average`: your win rate over every game
 * - `mood`: "swing" when `best` and `worst` are far apart, else "steady"
 * - `trend`: "hot", "cold" or "even": whether `now` is well above, well below or near `average`
 */
export function getFormCurve(recap) {
  const { results, resultTimes: times } = recap;
  if (!Array.isArray(results) || results.length < MIN_GAMES || !Array.isArray(times) || times.length !== results.length) return null;

  const count = results.length;
  const window = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, Math.round(count / 5)));
  const points = [];
  let wins = 0;
  for (let i = 0; i < count; i++) {
    if (results[i]) wins++;
    if (i >= window && results[i - window]) wins--;
    if (i >= window - 1) points.push({ index: i, rate: wins / window, at: times[i] });
  }

  const best = points.reduce((top, point) => (point.rate > top.rate ? point : top));
  const worst = points.reduce((low, point) => (point.rate < low.rate ? point : low));
  const now = points.at(-1);
  const average = results.filter(Boolean).length / count;
  const swing = best.rate - worst.rate;
  const trend = now.rate - average >= MIN_SHIFT ? "hot" : average - now.rate >= MIN_SHIFT ? "cold" : "even";
  return { window, points, best, worst, now, average, swing, mood: swing >= MIN_SWING ? "swing" : "steady", trend };
}

/** The two sentences under the chart: how much the season swung, and how "lately" compares with your average. */
export function formLines(curve, t = defaultT) {
  const games = t("recap.gamesLabel", { count: curve.window });
  return [
    t(`insights.formcurve.${curve.mood}`, { worst: t.percent(curve.worst.rate), best: t.percent(curve.best.rate), games }),
    t(`insights.formcurve.${curve.trend}`, { now: t.percent(curve.now.rate), avg: t.percent(curve.average), games }),
  ];
}

/** The vertical range of a chart in whole percents: the data plus a little room, in steps of 10, and never less than 40 points tall. */
function axisRange(low, high) {
  let bottom = Math.max(0, Math.floor((low * 100 - 5) / 10) * 10);
  let top = Math.min(100, Math.ceil((high * 100 + 5) / 10) * 10);
  while (top - bottom < 40) {
    if (bottom > 0) bottom -= 10;
    if (top - bottom < 40 && top < 100) top += 10;
  }
  return [bottom, top];
}

/**
 * Where everything goes when `curve` is drawn in a `width` x `height` box with `pad` ({ left, right, top, bottom }) around the plot.
 * The chart on the slide and the one on the share card both use it, so they are the same picture.
 * @returns `{ line, area, ticks, average, marks }`: `line` and `area` are SVG path data; `ticks` is `[{ percent, y }]`, at round
 * numbers; `average` is the y of your season win rate; `marks` is `{ worst, best, now }`, each `{ x, y }`.
 */
export function curveShape(curve, { width, height, pad }) {
  const { points, best, worst, now, average } = curve;
  const [bottom, top] = axisRange(Math.min(worst.rate, average), Math.max(best.rate, average));
  const first = points[0].index;
  const last = points.at(-1).index;
  const x = (index) => pad.left + ((index - first) / (last - first)) * (width - pad.left - pad.right);
  const y = (rate) => pad.top + ((top - rate * 100) / (top - bottom)) * (height - pad.top - pad.bottom);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.index).toFixed(1)} ${y(p.rate).toFixed(1)}`).join(" ");
  const area = `${line} L${x(last).toFixed(1)} ${height - pad.bottom} L${x(first).toFixed(1)} ${height - pad.bottom} Z`;
  const step = top - bottom <= 40 ? 10 : 20;
  // Round numbers (20, 40, 60...), not steps counted up from the bottom of the range.
  const firstTick = Math.ceil(bottom / step) * step;
  const ticks = Array.from({ length: Math.floor((top - firstTick) / step) + 1 }, (_, i) => {
    const percent = firstTick + i * step;
    return { percent, y: y(percent / 100) };
  });
  const mark = (point) => ({ x: x(point.index), y: y(point.rate) });
  return { line, area, ticks, average: y(average), marks: { worst: mark(worst), best: mark(best), now: mark(now) } };
}
