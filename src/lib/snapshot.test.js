import { describe, expect, it } from "vitest";
import { compareToSnapshot, progressLine, readRecapSnapshot, recapSnapshot, savedRankTitle } from "./recap/progress";
import { ladderScore } from "./recap/rank";
import { compareToRematch, readRematch, rematchSnapshot } from "./squad/rematch";
import { clampNumber, decodeSnapshot, encodeSnapshot } from "./snapshot";

const recap = (overrides = {}) => ({
  games: 80,
  winRate: 0.55,
  kda: 3,
  perGame: { kills: 6, deaths: 5, assists: 7 },
  csPerMin: 7,
  visionPerMin: 1,
  damagePerMin: 700,
  killParticipation: 0.6,
  ...overrides,
});

describe("decodeSnapshot", () => {
  it("round-trips an object", () => {
    expect(decodeSnapshot(encodeSnapshot({ v: 1, a: [1, 2] }))).toEqual({ v: 1, a: [1, 2] });
  });

  it("returns null for anything that isn't an encoded object", () => {
    for (const bad of [undefined, null, "", "not base64 json!!", encodeSnapshot("just a string"), encodeSnapshot([1, 2]), "a".repeat(2000), 42]) {
      expect(decodeSnapshot(bad)).toBeNull();
    }
  });

  it("takes the first of a repeated parameter", () => {
    expect(decodeSnapshot([encodeSnapshot({ v: 1 }), "junk"])).toEqual({ v: 1 });
  });
});

describe("clampNumber", () => {
  it("clamps numbers and rejects everything else", () => {
    expect(clampNumber(5, 0, 1)).toBe(1);
    expect(clampNumber("0.5", 0, 1)).toBe(0.5);
    expect(clampNumber(-3, 0, 1)).toBe(0);
    for (const bad of [NaN, Infinity, "", "abc", null, undefined, true, {}, []]) expect(clampNumber(bad, 0, 1)).toBeNull();
  });
});

describe("recap snapshots", () => {
  const saved = () => readRecapSnapshot(decodeSnapshot(recapSnapshot(recap(), { title: "The Closer" })));

  it("survives the trip through a link", () => {
    expect(saved()).toMatchObject({ games: 80, persona: "The Closer", stats: { wr: 0.55, kda: 3, d: 5 } });
  });

  it("rejects wrong versions, missing or absurd times, and thin snapshots", () => {
    const ok = { v: 1, t: Date.now() - 1000, g: 10, wr: 0.5, kda: 2, k: 5 };
    expect(readRecapSnapshot(ok)).not.toBeNull();
    expect(readRecapSnapshot({ ...ok, v: 2 })).toBeNull();
    expect(readRecapSnapshot({ ...ok, t: 5 })).toBeNull();
    expect(readRecapSnapshot({ ...ok, t: Date.now() + 10 * 86400000 })).toBeNull();
    expect(readRecapSnapshot({ v: 1, t: ok.t, g: 10, wr: 0.5 })).toBeNull();
    expect(readRecapSnapshot(null)).toBeNull();
  });

  it("clamps out-of-range numbers and cuts long persona names", () => {
    const read = readRecapSnapshot({ v: 1, t: Date.now() - 1000, g: 10, wr: 7, kda: -4, k: 5, p: "x".repeat(500) });
    expect(read.stats.wr).toBe(1);
    expect(read.stats.kda).toBe(0);
    expect(read.persona).toHaveLength(40);
  });

  it("marks stats better, worse or flat, treating fewer deaths as better", () => {
    const before = saved();
    const now = recap({ winRate: 0.65, kda: 3.02, perGame: { kills: 6, deaths: 4, assists: 5 } });
    const { rows, better, worse } = compareToSnapshot(before, now);
    const mood = Object.fromEntries(rows.map((r) => [r.key, r.mood]));
    expect(mood).toMatchObject({ wr: "better", kda: "flat", k: "flat", d: "better", a: "worse" });
    expect(better).toBe(2);
    expect(worse).toBe(1);
    expect(rows.find((r) => r.key === "wr")).toMatchObject({ before: "55%", after: "65%" });
  });

  it("describes the change in words", () => {
    expect(progressLine({ better: 0, worse: 0, rows: [1] })).toMatch(/Nothing has really moved/);
    expect(progressLine({ better: 5, worse: 0, rows: new Array(9) })).toMatch(/Better across the board/);
    expect(progressLine({ better: 0, worse: 4, rows: new Array(9) })).toMatch(/rougher/);
  });
});

describe("rematch snapshots", () => {
  const side = (gameName, tagLine, winRate) => ({ account: { gameName, tagLine }, recap: { winRate, kda: 3 } });
  const [a, b] = [side("MidDiff", "MID", 0.5), side("PingPong", "ADC", 0.6)];
  const comparison = (x, y) => ({ score: { a: x, b: y, ties: 0 } });

  it("reads back for the same pair, ignoring the case of their names", () => {
    const raw = decodeSnapshot(rematchSnapshot(a, b, comparison(3, 5)));
    expect(readRematch(raw, a, b)).toMatchObject({ score: [3, 5], winRate: [0.5, 0.6] });
    expect(readRematch(raw, side("MIDDIFF", "mid", 0.5), b)).not.toBeNull();
  });

  it("is ignored for a different pair or the players swapped", () => {
    const raw = decodeSnapshot(rematchSnapshot(a, b, comparison(3, 5)));
    expect(readRematch(raw, a, side("Other", "EUW", 0.5))).toBeNull();
    expect(readRematch(raw, b, a)).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(readRematch({ v: 1, t: Date.now() - 1000, n: ["middiff#mid", "pingpong#adc"], s: [1] }, a, b)).toBeNull();
    expect(readRematch({ v: 1, t: Date.now() - 1000, n: ["middiff#mid", "pingpong#adc"], s: "no" }, a, b)).toBeNull();
    expect(readRematch(null, a, b)).toBeNull();
  });

  it("says when the lead changed hands, and who has improved otherwise", () => {
    const saved = readRematch(decodeSnapshot(rematchSnapshot(a, b, comparison(3, 5))), a, b);
    expect(compareToRematch(saved, comparison(6, 2), a, b).line).toMatch(/changed hands: MidDiff/);

    const better = side("MidDiff", "MID", 0.62); // +12 points, while PingPong is unchanged
    expect(compareToRematch(saved, comparison(3, 5), better, b).line).toMatch(/MidDiff has improved more/);
    expect(compareToRematch(saved, comparison(3, 5), a, b).line).toMatch(/About the same/);
  });
});

describe("rank in a recap snapshot", () => {
  const silver = { tier: "SILVER", division: "II", lp: 50, title: "Silver II" };
  const gold = { tier: "GOLD", division: "IV", lp: 10, title: "Gold IV" };
  const base = { ...recap(), games: 80 };
  const saved = (rank) => readRecapSnapshot(decodeSnapshot(recapSnapshot(base, { title: "The Closer" }, rank)));

  it("orders the ladder by tier, then division, then LP", () => {
    expect(ladderScore(gold)).toBeGreaterThan(ladderScore(silver));
    expect(ladderScore({ tier: "SILVER", division: "I", lp: 0 })).toBeGreaterThan(ladderScore({ tier: "SILVER", division: "II", lp: 99 }));
    expect(ladderScore({ tier: "MASTER", division: null, lp: 120 })).toBeGreaterThan(ladderScore({ tier: "DIAMOND", division: "I", lp: 99 }));
  });

  it("round-trips through the link, and is null when the player was unranked", () => {
    // The link holds the tier and division, not English words, so it reads right in any language.
    expect(saved(silver).rank).toEqual({ score: ladderScore(silver), title: "SILVER II" });
    expect(savedRankTitle("SILVER II")).toBe("Silver II");
    expect(savedRankTitle("Gold IV")).toBe("Gold IV"); // an older link, saved with English words
    expect(savedRankTitle("MASTER")).toBe("Master");
    expect(savedRankTitle("Mystery")).toBe("Mystery");
    expect(saved(null).rank).toBeNull();
  });

  it("adds a rank row that reads better, worse or flat", () => {
    const rankRow = (before, now) => compareToSnapshot(saved(before), base, now).rows.find((r) => r.key === "rank");
    expect(rankRow(silver, gold)).toMatchObject({ before: "Silver II", after: "Gold IV", mood: "better" });
    expect(rankRow(gold, silver).mood).toBe("worse");
    expect(rankRow(silver, { ...silver, lp: 60 }).mood).toBe("flat");
    expect(rankRow(null, gold)).toBeUndefined(); // no saved rank to compare with
    expect(rankRow(silver, null)).toBeUndefined(); // unranked now
  });

  it("ignores a rank that is malformed or out of range", () => {
    const ok = { v: 1, t: Date.now() - 1000, g: 10, wr: 0.5, kda: 2, k: 5 };
    expect(readRecapSnapshot({ ...ok, rk: "abc", rt: "Gold" }).rank).toBeNull();
    expect(readRecapSnapshot({ ...ok, rk: 500 }).rank).toBeNull(); // no title
    expect(readRecapSnapshot({ ...ok, rk: 99999, rt: "x".repeat(200) }).rank).toEqual({ score: 6000, title: "x".repeat(24) });
  });
});
