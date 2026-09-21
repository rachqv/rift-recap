import { describe, expect, it } from "vitest";
import { clockLine, getWinClock } from "./clock";

// Built from local dates, like the code under test, so the tests pass in any time zone. 1 Jan 2024 was a Monday.
const game = (weekday, hour, win) => ({ t: new Date(2024, 0, 1 + weekday, hour).getTime(), win });
const many = (count, weekday, hour, wins) => Array.from({ length: count }, (_, i) => game(weekday, hour, i < wins));

// Three weekdays at one hour (so only the weekday can explain a difference), and three hours on one weekday.
const weekdays = (mon, wed, fri) => [...many(20, 0, 15, mon), ...many(20, 2, 15, wed), ...many(20, 4, 15, fri)];
const hours = (morning, afternoon, night) => [...many(20, 2, 9, morning), ...many(20, 2, 15, afternoon), ...many(20, 2, 1, night)];

describe("getWinClock", () => {
  it("needs enough games", () => {
    expect(getWinClock(null)).toBeNull();
    expect(getWinClock(weekdays(10, 10, 10).slice(1))).toBeNull(); // 59 games
    expect(getWinClock(weekdays(10, 10, 10))).not.toBeNull();
  });

  it("needs a row with enough rated buckets to draw", () => {
    // 60 games, but all on one weekday at one hour: nothing to compare.
    expect(getWinClock(many(60, 0, 9, 30))).toBeNull();
  });

  it("counts games into the part of the day and the weekday they were played in", () => {
    const clock = getWinClock([...many(20, 0, 9, 10), ...many(20, 5, 20, 10), ...many(20, 5, 2, 10)]);
    const part = (key) => clock.parts.find((p) => p.key === key);
    expect(part("morning")).toMatchObject({ games: 20, wins: 10, rate: 0.5 });
    expect(part("evening").games).toBe(20);
    expect(part("night").games).toBe(20);
    expect(part("afternoon")).toMatchObject({ games: 0, rate: null });
    expect(clock.winRate).toBeCloseTo(0.5);
    expect(clock.days[0].games).toBe(20); // Monday first
    expect(clock.days[5].games).toBe(40); // Saturday
  });

  it("only draws a row that has enough rated buckets", () => {
    const clock = getWinClock(weekdays(10, 10, 10)); // three weekdays, but only the afternoon
    expect(clock.showDays).toBe(true);
    expect(clock.showParts).toBe(false);
    expect(clock.byPart).toBeNull();
  });

  it("gives no win rate to a bucket with too few games", () => {
    const clock = getWinClock([...weekdays(10, 10, 10), ...many(3, 5, 15, 3)]);
    expect(clock.days[5]).toMatchObject({ games: 3, wins: 3, rate: null });
  });

  it("finds a weekday pattern", () => {
    const clock = getWinClock(weekdays(4, 10, 18));
    expect(clock.focus).toBe("day");
    expect(clock.byDay.best.key).toBe(4);
    expect(clock.byDay.worst.key).toBe(0);
    expect(clock.byDay.gap).toBeCloseTo(0.7);
  });

  it("finds a time-of-day pattern", () => {
    const clock = getWinClock(hours(16, 10, 6));
    expect(clock.showDays).toBe(false);
    expect(clock.byDay).toBeNull();
    expect(clock.focus).toBe("part");
    expect(clock.byPart.best.key).toBe("morning");
    expect(clock.byPart.worst.key).toBe("night");
  });

  it("calls it steady when the win rate barely moves", () => {
    const clock = getWinClock([...many(20, 0, 9, 10), ...many(20, 3, 15, 11), ...many(20, 5, 21, 10)]);
    expect(clock.showDays && clock.showParts).toBe(true);
    expect(clock.byDay).toBeNull();
    expect(clock.byPart).toBeNull();
    expect(clock.focus).toBe("steady");
  });

  it("uses the local hour, so 23:59 is evening and midnight is night", () => {
    const last = new Date(2024, 0, 1, 23, 59).getTime();
    const first = new Date(2024, 0, 2, 0, 0).getTime();
    const clock = getWinClock([...many(20, 1, 10, 10), ...many(20, 2, 15, 10), ...many(18, 3, 20, 9), { t: last, win: true }, { t: first, win: true }]);
    expect(clock.parts.find((p) => p.key === "evening").games).toBe(19); // 18 at 20:00 and the one at 23:59
    expect(clock.parts.find((p) => p.key === "night").games).toBe(1);
  });
});

describe("clockLine", () => {
  it("names the best and worst weekday", () => {
    const line = clockLine(getWinClock(weekdays(4, 10, 18)));
    expect(line).toMatch(/Friday/);
    expect(line).toMatch(/Monday/);
    expect(line).toMatch(/90%/);
    expect(line).toMatch(/20%/);
  });

  it("names the best and worst part of the day", () => {
    const line = clockLine(getWinClock(hours(16, 10, 6)));
    expect(line).toMatch(/morning/);
    expect(line).toMatch(/night/);
  });

  it("has a line for steady players too", () => {
    expect(clockLine(getWinClock([...many(20, 0, 9, 10), ...many(20, 3, 15, 11), ...many(20, 5, 21, 10)]))).toMatch(/barely moves/i);
  });
});
