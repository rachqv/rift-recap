import { describe, expect, it } from "vitest";
import { buildRivalries } from "./rivalry";
import { apartRecord, buildCarry, buildSynergy } from "./synergy";

const player = (puuid, teamId, win, damage = 1000) => ({ puuid, teamId, win, totalDamageDealtToChampions: damage, kills: 1, deaths: 1, assists: 1, championName: "Ahri", teamPosition: "MIDDLE" });
const game = (id, participants, gameDuration = 1500) => ({ metadata: { matchId: id }, info: { gameDuration, gameCreation: Number(id.replace(/\D/g, "")) || 1, participants } });

describe("apartRecord", () => {
  it("counts wins outside the excluded games and skips remakes", () => {
    const matches = [
      game("g1", [player("me", 100, true)]),
      game("g2", [player("me", 100, false)]),
      game("g3", [player("me", 100, true)]), // excluded: played together
      game("g4", [player("me", 100, true)], 200), // remake
      game("g5", [player("someone", 100, true)]), // not in it
    ];
    expect(apartRecord(matches, "me", new Set(["g3"]))).toEqual({ games: 2, wins: 1 });
  });
});

describe("buildSynergy", () => {
  it("is null without enough games either way", () => {
    expect(buildSynergy({ a: { games: 3, wins: 2 }, b: { games: 3, wins: 2 } }, { a: { games: 5, wins: 3 }, b: { games: 5, wins: 3 } })).toBeNull();
    expect(buildSynergy({ a: { games: 20, wins: 10 }, b: { games: 20, wins: 10 } }, { a: { games: 2, wins: 2 }, b: { games: 2, wins: 2 } })).toBeNull();
  });

  it("calls it a lift when both improve together", () => {
    const result = buildSynergy({ a: { games: 20, wins: 10 }, b: { games: 20, wins: 9 } }, { a: { games: 10, wins: 8 }, b: { games: 10, wins: 7 } });
    expect(result.verdict).toBe("lift");
    expect(result.a.delta).toBeCloseTo(0.3);
  });

  it("calls it a drag when both do worse, mixed when they split, flat when nothing moves", () => {
    const apart = { a: { games: 20, wins: 14 }, b: { games: 20, wins: 14 } };
    expect(buildSynergy(apart, { a: { games: 10, wins: 3 }, b: { games: 10, wins: 4 } }).verdict).toBe("drag");
    expect(buildSynergy(apart, { a: { games: 10, wins: 3 }, b: { games: 10, wins: 9 } }).verdict).toBe("mixed");
    expect(buildSynergy(apart, { a: { games: 10, wins: 7 }, b: { games: 10, wins: 7 } }).verdict).toBe("flat");
  });

  it("still reports the side that has enough games", () => {
    const result = buildSynergy({ a: { games: 20, wins: 10 }, b: { games: 2, wins: 1 } }, { a: { games: 10, wins: 8 }, b: { games: 10, wins: 8 } });
    expect(result.b).toBeNull();
    expect(result.a.together).toBeCloseTo(0.8);
  });
});

describe("buildCarry", () => {
  it("counts damage leads and how the team does when each leads", () => {
    const matches = [
      game("g1", [player("a", 100, true, 3000), player("b", 100, true, 1000)]),
      game("g2", [player("a", 100, true, 3000), player("b", 100, true, 1000)]),
      game("g3", [player("a", 100, true, 3000), player("b", 100, true, 1000)]),
      game("g4", [player("a", 100, false, 1000), player("b", 100, false, 3000)]),
      game("g5", [player("a", 100, false, 1000), player("b", 100, false, 3000)]),
      game("g6", [player("a", 100, false, 1000), player("b", 100, false, 3000)]),
      game("g7", [player("a", 100, true, 2000), player("b", 200, false, 1000)]), // opponents: ignored
    ];
    const result = buildCarry(matches, "a", "b");
    expect(result.games).toBe(6);
    expect(result.lead).toEqual({ a: 3, b: 3 });
    expect(result.record).toEqual({ a: { games: 3, wins: 3 }, b: { games: 3, wins: 0 } });
    expect(result.better).toBe("a");
  });

  it("gives no verdict on a small sample, and null with no shared team games", () => {
    const one = [game("g1", [player("a", 100, true, 3000), player("b", 100, true, 1000)])];
    expect(buildCarry(one, "a", "b").better).toBeNull();
    expect(buildCarry([game("g2", [player("a", 100, true), player("b", 200, false)])], "a", "b")).toBeNull();
  });
});

describe("buildRivalries", () => {
  it("builds mirrored records for members who met on opposite teams", () => {
    const members = [{ puuid: "a" }, { puuid: "b" }, { puuid: "c" }];
    const matches = [
      game("g1", [player("a", 100, true), player("b", 200, false), player("c", 100, true)]),
      game("g2", [player("a", 100, false), player("b", 200, true)]),
      game("g3", [player("a", 100, true), player("b", 100, true)]), // teammates: not a meeting
    ];
    const { cells, total, hottest } = buildRivalries(matches, members);
    expect(cells[0][1]).toEqual({ games: 2, wins: 1 });
    expect(cells[1][0]).toEqual({ games: 2, wins: 1 });
    expect(cells[0][2]).toBeNull(); // a and c were only ever teammates
    expect(cells[2][1]).toEqual({ games: 1, wins: 1 }); // c beat b in g1
    expect(total).toBe(3);
    expect(hottest).toMatchObject({ a: 0, b: 1, games: 2 });
  });

  it("is empty when nobody met", () => {
    const result = buildRivalries([game("g1", [player("a", 100, true), player("b", 100, true)])], [{ puuid: "a" }, { puuid: "b" }]);
    expect(result.total).toBe(0);
    expect(result.hottest).toBeNull();
  });
});
