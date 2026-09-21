import { describe, expect, it } from "vitest";
import { getTiltGuard, liveLine, tiltGuardLines } from "./tiltguard";

const DAY = 86400000;
const MINUTE = 60000;
const BASE = Date.UTC(2024, 0, 1, 12);

/** One sitting: games 30 minutes apart on their own day. "W" is a win, "L" a loss. */
const sitting = (day, results) => [...results].map((r, i) => ({ t: BASE + day * DAY + i * 30 * MINUTE, win: r === "W" }));
/** `count` sittings with the same results, one a day from day `from`. */
const repeat = (results, count, from = 0) => Array.from({ length: count }, (_, i) => sitting(from + i, results)).flat();

// Twelve sittings of two wins then three losses: each game after the first is counted by how many losses came right before it.
//   after a win: W(win) L(loss)  ->  24 games, 12 won  (the second W follows a win, and so does the first L)
//   after 1 loss: 12 games, none won;  after 2 in a row: 12 games, none won;  baseline 12/48 = 25%
const SPIRAL = repeat("WWLLL", 12);

describe("getTiltGuard", () => {
  it("needs enough games played back to back", () => {
    expect(getTiltGuard(null)).toBeNull();
    expect(getTiltGuard([])).toBeNull();
    expect(getTiltGuard(repeat("LLLL", 9))).toBeNull(); // 27 games that followed another
    expect(getTiltGuard(repeat("LLLL", 10))).not.toBeNull(); // 30
  });

  it("counts each game under the losses in a row before it in its sitting", () => {
    // W L L W: the first L follows a win, the second follows one loss, the last W follows two.
    const [afterWin, one, two, three] = getTiltGuard([...sitting(0, "WLLW"), ...repeat("LLLL", 10, 1)]).steps;
    expect(afterWin).toMatchObject({ games: 1, wins: 0 });
    expect(one).toMatchObject({ games: 11, wins: 0 });
    expect(two).toMatchObject({ games: 11, wins: 1 });
    expect(three).toMatchObject({ games: 10, wins: 0 }); // "3 or more" collects the fourth game of each LLLL too
  });

  it("does not chain losses across sittings", () => {
    // Every WWLL sitting ends on a loss and the next one starts a day later: nothing carries over.
    const { steps } = getTiltGuard([...repeat("WWLL", 12), ...repeat("LLLL", 10, 20)]);
    expect(steps[1].games).toBe(12 + 10); // the second L of each, and the second game of each LLLL
    expect(steps[2].games).toBe(10); // only LLLL gets to a third game
    expect(steps[0].games).toBe(24);
  });

  it("starts a new sitting after a long gap between games", () => {
    // Three losses, but the third comes two hours after the second: it is a new sitting, so it is not "after 2".
    const base = repeat("LLLL", 10, 20);
    const gap = [0, 30, 30 + 120].map((minutes) => ({ t: BASE + 100 * DAY + minutes * MINUTE, win: false }));
    const { steps } = getTiltGuard([...base, ...gap]);
    expect(steps[1].games).toBe(11); // the second loss counts
    expect(steps[2].games).toBe(10); // the third does not
  });

  it("has nothing to say without a streak to look at", () => {
    expect(getTiltGuard(repeat("WWLL", 12))).toBeNull(); // no sitting ever got to a game after two losses
  });

  it("reports a stop sign when you clearly win less deep into a streak", () => {
    const guard = getTiltGuard(SPIRAL);
    expect(guard.followups).toBe(48);
    expect(guard.baseline).toBeCloseTo(0.25);
    expect(guard.stop).toMatchObject({ losses: 2, rate: 0 });
    expect(guard.stop.drop).toBeCloseTo(0.25);
    expect(guard.mood).toBe("stop");
  });

  it("says how often you queue again at the stop sign", () => {
    expect(getTiltGuard(SPIRAL).stop.keepGoing).toBe(1); // all twelve times it was 2 down, a third game followed
  });

  it("is steady when streaks make no difference", () => {
    // W L L W W: the game after two losses is a win.
    const guard = getTiltGuard(repeat("WLLWW", 12));
    expect(guard.stop).toBeNull();
    expect(guard.mood).toBe("steady");
    expect(guard.steps[2].rate).toBe(1);
  });

  it("asks more of a bar with fewer games behind it", () => {
    // Both have a 50% baseline and win 1 in 4 after two losses, a 25-point drop. Eight games behind that bar is not enough
    // to rule out luck; sixteen is.
    const small = getTiltGuard([...repeat("LLW", 2), ...repeat("LLL", 6, 2), ...repeat("WW", 13, 10), ...sitting(30, "WL")]);
    expect(small.baseline).toBeCloseTo(0.5);
    expect(small.steps[2]).toMatchObject({ games: 8, wins: 2 });
    expect(small.stop).toBeNull();

    const large = getTiltGuard([...repeat("LLW", 4), ...repeat("LLL", 12, 4), ...repeat("WW", 24, 20)]);
    expect(large.baseline).toBeCloseTo(0.5);
    expect(large.steps[2]).toMatchObject({ games: 16, wins: 4 });
    expect(large.stop).toMatchObject({ losses: 2 });
  });

  it("takes the games in any order", () => {
    expect(getTiltGuard([...SPIRAL].reverse())).toEqual(getTiltGuard(SPIRAL));
  });

  describe("live", () => {
    it("notes a losing streak you are on at the end of your latest sitting", () => {
      const guard = getTiltGuard([...SPIRAL, ...sitting(20, "WLL")]);
      expect(guard.live).toEqual({ at: BASE + 20 * DAY + 2 * 30 * MINUTE, run: 2, rate: 0, stop: true });
    });

    it("is null when your last game was a win, or the streak is a single loss", () => {
      expect(getTiltGuard(repeat("WLLWW", 12)).live).toBeNull();
      expect(getTiltGuard([...SPIRAL, ...sitting(20, "WL")]).live).toBeNull();
    });

    it("is not past the stop sign when the streak is shorter than it", () => {
      // After two losses you win half; after three, none: the stop sign is at 3+, and you are on 2.
      const games = [...repeat("LLLL", 12), ...repeat("LLWWW", 12, 20), ...sitting(60, "LL")];
      const guard = getTiltGuard(games);
      expect(guard.stop).toMatchObject({ losses: 3, rate: 0 });
      expect(guard.live).toMatchObject({ run: 2, rate: 0.5, stop: false });
    });
  });
});

describe("the lines", () => {
  it("name the stop sign and how often you keep queueing", () => {
    const [verdict, extra] = tiltGuardLines(getTiltGuard(SPIRAL));
    expect(verdict).toBe("After 2 losses in a row you win 0% of the next game, against 25% usually. That's your stop sign.");
    expect(extra).toBe("And you queue up again 100% of the time.");
  });

  it("say streaks don't shake you when they don't", () => {
    const [verdict, extra] = tiltGuardLines(getTiltGuard(repeat("WLLWW", 12)));
    expect(verdict).toBe("Even after 2 losses in a row you win 100%. Streaks don't shake you.");
    expect(extra).toBeNull();
  });

  it("have a stop-here note and a plain one for a streak in progress", () => {
    expect(liveLine({ run: 3, rate: 0.2, stop: true })).toMatch(/3 losses deep.*20%.*Maybe stop here/);
    expect(liveLine({ run: 2, rate: 0.5, stop: false })).toMatch(/2-loss streak.*50%/);
  });
});
