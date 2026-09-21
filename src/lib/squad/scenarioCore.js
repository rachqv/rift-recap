import { defaultT } from "@/lib/i18n/en";

// The engine behind head-to-head "scenarios": small, themed face-offs like "Flash addict" or "Objective thief".
// A scenario definition reads one number per player; this file decides who wins it and how decisively.

// Two values within this relative distance are a dead heat, and a dead heat is not worth a card. This is wider than the
// stat rows' margin: a row can call a 3% gap a win, but a scenario makes a whole joke out of it, so it needs a real gap.
const TIE_MARGIN = 0.1;

/** How far apart the two values are, relative to the larger one; null when it is a tie or too close to make a scenario of. */
function decisiveGap(def, x, y) {
  const spread = Math.max(Math.abs(x), Math.abs(y));
  if (spread === 0) return null;
  const gap = Math.abs(x - y) / spread;
  return gap < (def.margin ?? TIE_MARGIN) || Math.abs(x - y) < (def.minDiff ?? 0) ? null : gap;
}

/**
 * Where A's side of the bar ends (0-1). Bars compare the two values directly (the smaller number gets the longer bar when
 * lower is better). Negative values are shifted up first so a bar never has a negative width.
 */
function barShare(x, y, higher) {
  const floor = Math.min(x, y, 0);
  const [sx, sy] = [x - floor, y - floor];
  return sx + sy === 0 ? 0.5 : higher ? sx / (sx + sy) : sy / (sx + sy);
}

/**
 * @param def `{ id, icon, value, show, values, higher?, scored?, minDiff? }`. The title, tagline and punchline are the
 *   messages `<ctx.scope>.<id>.title`, `.tagline` and `.line`
 *   - `value(view, ctx)` is one number per player, or null when the data isn't there
 *   - `show(value, view, ctx)` is how that number reads on the card
 *   - `values(win, lose, ctx, { win, lose })` gives the numbers the punchline needs (the winner is `name`, the other `other`
 *     and both are added for you); `variant(...)` may name another line (`lineLost`) for a different case
 * @param ctx `{ t, scope, nameOf }`: the translator, where the scenarios' messages live, and champion names
 *   - `higher` (default true) is whether a bigger number wins; `scored` (default true) is whether the scenario counts
 *     towards the side-bet tally. Traits like "pings a game" aren't better or worse, so they aren't scored.
 *   - `minDiff` is an absolute gap the two values must also clear, for numbers like win rates where 10% of 50% is
 *     only five points, or 1% vs 0% would otherwise look like a landslide.
 *   - `margin` replaces `TIE_MARGIN` for numbers with a big constant baked in (the ladder score), where a relative
 *     gap of a few percent is already a whole division.
 * @param a, b the two players' views (anything with a `name`; whatever `value` needs)
 * @returns `{ id, icon, title, tagline, scored, winner, gap, aShow, bShow, aShare, line }`, or null when the
 *   scenario doesn't apply (missing data, nothing but zeros) or it's a tie.
 */
function compareScenario(def, a, b, ctx = {}) {
  const t = ctx.t ?? defaultT;
  const scope = `${ctx.scope ?? "versus.scenarios"}.${def.id}`;
  ctx = { ...ctx, t };
  const [x, y] = [def.value(a, ctx), def.value(b, ctx)];
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const gap = decisiveGap(def, x, y);
  if (gap == null) return null;

  const higher = def.higher !== false;
  const winner = (x > y) === higher ? "a" : "b";
  const [win, lose] = winner === "a" ? [a, b] : [b, a];
  const [winValue, loseValue] = winner === "a" ? [x, y] : [y, x];
  const share = barShare(x, y, higher);

  return {
    id: def.id,
    icon: def.icon,
    title: t(`${scope}.title`),
    tagline: t(`${scope}.tagline`),
    scored: def.scored !== false,
    winner,
    gap: Math.min(gap, 1),
    aShow: def.show(x, a, ctx),
    bShow: def.show(y, b, ctx),
    aShare: share,
    line: t(`${scope}.${def.variant?.(win, lose, ctx, { win: winValue, lose: loseValue }) ?? "line"}`, {
      name: win.name,
      other: lose.name,
      ...def.values(win, lose, ctx, { win: winValue, lose: loseValue }),
    }),
  };
}

/** Runs every definition and keeps the `limit` most lopsided results, biggest gap first. */
export function pickScenarios(defs, a, b, ctx = {}, limit = Infinity) {
  return defs
    .map((def) => compareScenario(def, a, b, ctx))
    .filter(Boolean)
    .sort((x, y) => y.gap - x.gap)
    .slice(0, limit);
}

/** Who took more of the scored scenarios. Returns `{ a, b }`. */
export function tallyScenarios(scenarios) {
  const score = { a: 0, b: 0 };
  for (const s of scenarios) if (s.scored) score[s.winner]++;
  return score;
}

// ---- small formatting helpers shared by the definitions (each takes the translator, so numbers read in the reader's language)

export const pct = (t, x) => t.percent(x);
export const fixed = (t, digits, x) => t.fixed(x, digits);
export const thousands = (t, x) => t.number(Math.round(x));
/** 754 seconds -> "12:34" */
export const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
