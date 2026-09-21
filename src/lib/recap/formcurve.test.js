import { describe, expect, it } from "vitest";
import { curveShape, formLines, getFormCurve } from "./formcurve";

const DAY = 86400000;
/** A recap with just what the curve reads: `pattern` is a string of W and L, one game a day. */
const recap = (pattern) => ({ results: [...pattern].map((r) => r === "W"), resultTimes: [...pattern].map((_, i) => i * DAY) });
const twenty = (r) => r.repeat(20);

describe("getFormCurve", () => {
  it("needs enough games, and a time for each", () => {
    expect(getFormCurve(recap("W".repeat(29)))).toBeNull();
    expect(getFormCurve(recap("W".repeat(30)))).not.toBeNull();
    expect(getFormCurve({ results: recap("W".repeat(40)).results })).toBeNull(); // no times
    expect(getFormCurve({ ...recap("W".repeat(40)), resultTimes: [1, 2, 3] })).toBeNull(); // not one per game
  });

  it("sizes the window at about a fifth of the games, from 10 to 20", () => {
    const windowFor = (games) => getFormCurve(recap("WL".repeat(games / 2))).window;
    expect(windowFor(30)).toBe(10);
    expect(windowFor(60)).toBe(12);
    expect(windowFor(100)).toBe(20);
    expect(windowFor(300)).toBe(20);
  });

  it("makes one point for each game from the first full window on", () => {
    const { points, window } = getFormCurve(recap(twenty("L") + twenty("W"))); // 40 games, window 10
    expect(window).toBe(10);
    expect(points).toHaveLength(31);
    expect(points[0]).toMatchObject({ index: 9, rate: 0 });
    expect(points.at(-1)).toMatchObject({ index: 39, rate: 1 });
  });

  it("finds the best and worst stretch, and when they ended", () => {
    const curve = getFormCurve(recap(twenty("L") + twenty("W")));
    expect(curve.best).toMatchObject({ rate: 1, index: 29, at: 29 * DAY }); // the first window that is all wins
    expect(curve.worst).toMatchObject({ rate: 0, index: 9, at: 9 * DAY });
    expect(curve.now.index).toBe(39);
    expect(curve.average).toBe(0.5);
    expect(curve.swing).toBe(1);
    expect(curve.mood).toBe("swing");
    expect(curve.trend).toBe("hot");
  });

  it("calls a flat season steady, and lately even", () => {
    const curve = getFormCurve(recap("WL".repeat(20)));
    expect(curve.swing).toBe(0);
    expect(curve.mood).toBe("steady");
    expect(curve.trend).toBe("even");
  });

  it("calls a bad ending cold", () => {
    const curve = getFormCurve(recap("W".repeat(30) + "L".repeat(10))); // 75% for the season, 0% lately
    expect(curve.average).toBe(0.75);
    expect(curve.now.rate).toBe(0);
    expect(curve.trend).toBe("cold");
  });

  it("does not call a small swing a swing", () => {
    // 60% in one block of ten, 50% in the next: the line never leaves 50-60%, well inside what luck alone gives.
    const curve = getFormCurve(recap("WLWLWLWLWW" + "LWLWLWLWLW" + "WLWLWLWLWW" + "LWLWLWLWLW"));
    expect(curve.best.rate).toBeCloseTo(0.6);
    expect(curve.worst.rate).toBeCloseTo(0.5);
    expect(curve.swing).toBeLessThan(0.2);
    expect(curve.mood).toBe("steady");
  });
});

describe("formLines", () => {
  it("say how far the season swung, and how lately compares", () => {
    expect(formLines(getFormCurve(recap(twenty("L") + twenty("W"))))).toEqual([
      "From 0% at your lowest to 100% at your highest, 10 games at a time.",
      "Lately you're hot: 100% over your last 10 games, against 50% for the season.",
    ]);
  });

  it("have wording for a steady season and a cold finish", () => {
    const [steady] = formLines(getFormCurve(recap("WL".repeat(20))));
    expect(steady).toBe("Over any 10 games you stayed between 50% and 50%. Very steady.");
    const [, cold] = formLines(getFormCurve(recap("W".repeat(30) + "L".repeat(10))));
    expect(cold).toBe("Lately it's been rougher: 0% over your last 10 games, against 75% for the season.");
  });
});

describe("curveShape", () => {
  const box = { width: 500, height: 200, pad: { left: 40, right: 10, top: 10, bottom: 10 } };

  it("puts the highest point at the top of the plot and the lowest at the bottom, oldest at the left", () => {
    // Twenty losses then twenty wins: the line climbs from 0% to 100% over indexes 9 to 39.
    const shape = curveShape(getFormCurve(recap(twenty("L") + twenty("W"))), box);
    expect(shape.marks.worst).toEqual({ x: 40, y: 190 }); // 0%, the first point
    expect(shape.marks.now).toEqual({ x: 490, y: 10 }); // 100%, the last
    expect(shape.marks.best.y).toBe(10);
    expect(shape.marks.best.x).toBeCloseTo(40 + (20 / 30) * 450); // the first all-win window ends at game 29
    expect(shape.average).toBe(100); // 50%, half way
    expect(shape.line.startsWith("M40.0 190.0")).toBe(true);
    expect(shape.area.endsWith("Z")).toBe(true);
  });

  it("puts axis ticks at round numbers", () => {
    expect(curveShape(getFormCurve(recap(twenty("L") + twenty("W"))), box).ticks.map((t) => t.percent)).toEqual([0, 20, 40, 60, 80, 100]);
    // A flat season is zoomed in to 40 points tall, in steps of 10.
    expect(curveShape(getFormCurve(recap("WL".repeat(20))), box).ticks.map((t) => t.percent)).toEqual([30, 40, 50, 60, 70]);
  });

  it("gives each tick the y of its percentage", () => {
    const { ticks } = curveShape(getFormCurve(recap(twenty("L") + twenty("W"))), box);
    expect(ticks[0].y).toBe(190); // 0%
    expect(ticks.at(-1).y).toBe(10); // 100%
  });
});
