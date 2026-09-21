import { describe, expect, it } from "vitest";
import { compareRecaps } from "./progress";
import { getWeekCompare } from "./week";

// Just the stats the comparison reads.
const recap = (overrides = {}) => ({
  games: 12,
  winRate: 0.5,
  kda: 3,
  perGame: { kills: 6, deaths: 5, assists: 8 },
  csPerMin: 6,
  visionPerMin: 1,
  damagePerMin: 700,
  killParticipation: 0.6,
  ...overrides,
});

describe("compareRecaps", () => {
  it("gives a row for each stat and says which way it moved", () => {
    const { rows, better, worse } = compareRecaps(recap(), recap({ winRate: 0.7, kda: 2, perGame: { kills: 6, deaths: 3, assists: 8 } }));
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(rows).toHaveLength(9);
    expect(by.wr).toMatchObject({ label: "Win rate", before: "50%", after: "70%", mood: "better" });
    expect(by.kda.mood).toBe("worse");
    expect(by.d).toMatchObject({ before: "5.0", after: "3.0", mood: "better" }); // fewer deaths is better
    expect(by.k.mood).toBe("flat");
    expect(better).toBe(2);
    expect(worse).toBe(1);
  });

  it("needs a bigger move than a saved comparison to call a change: a week is only a few games", () => {
    // 5% up on the win rate (0.50 to 0.525) is a change over a season's worth of games, but noise over a week.
    const { rows } = compareRecaps(recap(), recap({ winRate: 0.525 }));
    expect(rows.find((r) => r.key === "wr").mood).toBe("flat");
    expect(compareRecaps(recap(), recap({ winRate: 0.56 })).rows.find((r) => r.key === "wr").mood).toBe("better");
  });

  it("skips a stat one side doesn't have", () => {
    const { rows } = compareRecaps(recap({ killParticipation: null, visionPerMin: undefined }), recap());
    expect(rows.map((r) => r.key)).not.toContain("kp");
    expect(rows.map((r) => r.key)).not.toContain("vs");
  });
});

describe("getWeekCompare", () => {
  it("compares this week with the week before, and says how many games each had", () => {
    const week = getWeekCompare(recap({ games: 14, winRate: 0.65 }), recap({ games: 9, winRate: 0.45 }));
    expect(week.games).toEqual({ now: 14, before: 9 });
    expect(week.progress.better).toBeGreaterThan(0);
  });

  it("needs a week before, and a few games in each", () => {
    expect(getWeekCompare(recap(), null)).toBeNull();
    expect(getWeekCompare(recap({ games: 4 }), recap())).toBeNull();
    expect(getWeekCompare(recap(), recap({ games: 4 }))).toBeNull();
    expect(getWeekCompare(recap({ games: 5 }), recap({ games: 5 }))).not.toBeNull();
  });
});
