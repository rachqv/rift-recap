import { describe, expect, it } from "vitest";
import { buildClash, clashLine, clashRows, findClashes, seriesVerdict, teamName } from "./clash";
import { getDemoClash } from "./demoClash";

const A = ["a1", "a2", "a3"].map((puuid) => ({ puuid, gameName: puuid.toUpperCase(), tagLine: "EUW" }));
const B = ["b1", "b2", "b3"].map((puuid) => ({ puuid, gameName: puuid.toUpperCase(), tagLine: "EUW" }));
const ids = (side) => side.map((m) => m.puuid);

const player = (puuid, teamId, win, extra = {}) => ({
  puuid, teamId, win, kills: 5, deaths: 5, assists: 5, totalDamageDealtToChampions: 20000, goldEarned: 12000, visionScore: 30, teamPosition: "MIDDLE", ...extra,
});

/** A game with the given members of each side, A on team 100 (so B on 200), and `aWon` deciding it. */
function game(n, { a = A, b = B, aWon = true, seconds = 1800, byMember = () => ({}), teamA = 100 } = {}) {
  const teamB = teamA === 100 ? 200 : 100;
  return {
    metadata: { matchId: `EUW1_${n}` },
    info: {
      gameCreation: 1_700_000_000_000 + n * 3_600_000,
      gameDuration: seconds,
      participants: [
        ...a.map((m) => player(m.puuid, teamA, aWon, byMember(m.puuid))),
        ...b.map((m) => player(m.puuid, teamB, !aWon, byMember(m.puuid))),
      ],
    },
  };
}

describe("findClashes", () => {
  it("keeps games where two or more of each side were on opposite teams, oldest first", () => {
    const matches = [game(2), game(1, { teamA: 200 })];
    const found = findClashes(matches, ids(A), ids(B));
    expect(found.map((c) => c.matchId)).toEqual(["EUW1_1", "EUW1_2"]);
    expect(found[0].a).toHaveLength(3);
  });

  it("skips games with fewer than two of a side, split sides, shared teams and remakes", () => {
    const oneOfA = game(1, { a: A.slice(0, 1) });
    const split = game(2);
    split.info.participants[0].teamId = 200; // one of A on the other team
    const together = game(3);
    together.info.participants.forEach((p) => (p.teamId = 100)); // everyone on one team
    const remake = game(4, { seconds: 200 });
    expect(findClashes([oneOfA, split, together, remake], ids(A), ids(B))).toEqual([]);
  });

  it("counts a game with a partial side (two of three)", () => {
    expect(findClashes([game(1, { a: A.slice(0, 2), b: B.slice(0, 2) })], ids(A), ids(B))).toHaveLength(1);
  });
});

describe("seriesVerdict", () => {
  it("says nothing before three games", () => {
    expect(seriesVerdict(2, { a: 2, b: 0 }).kind).toBe("few");
  });

  it("calls a lead only when it is bigger than luck", () => {
    expect(seriesVerdict(4, { a: 4, b: 0 })).toEqual({ kind: "lead", side: "a" });
    expect(seriesVerdict(4, { a: 3, b: 1 }).kind).toBe("level"); // 3-1 is a coin flip's ordinary streak
    expect(seriesVerdict(9, { a: 2, b: 7 })).toEqual({ kind: "lead", side: "b" });
    expect(seriesVerdict(6, { a: 3, b: 3 }).kind).toBe("level");
  });
});

describe("buildClash", () => {
  it("is null when the two sides never met", () => {
    expect(buildClash([], A, B)).toBeNull();
    expect(buildClash([game(1, { a: A.slice(0, 1) })], A, B)).toBeNull();
  });

  it("counts the series record and the last game", () => {
    const clash = buildClash([game(1), game(2, { aWon: false }), game(3, { aWon: false }), game(4, { aWon: false })], A, B);
    expect(clash.games).toBe(4);
    expect(clash.wins).toEqual({ a: 1, b: 3 });
    expect(clash.last.winner).toBe("b");
    expect(clash.verdict.kind).toBe("level");
  });

  it("averages each side per player and game", () => {
    const clash = buildClash([game(1, { byMember: (puuid) => (puuid.startsWith("a") ? { kills: 10, deaths: 2, assists: 4, goldEarned: 15000 } : { kills: 2, deaths: 10, assists: 2 }) })], A, B);
    expect(clash.sides.a.kda).toBe(7); // (10 + 4) / 2
    expect(clash.sides.b.kda).toBeCloseTo(0.4);
    expect(clash.sides.a.gold).toBe(15000);
    expect(clash.sides.b.gold).toBe(12000);
  });

  it("pairs the lanes both sides had, with who usually played each", () => {
    const roles = { a1: "TOP", a2: "JUNGLE", a3: "MIDDLE", b1: "TOP", b2: "MIDDLE", b3: "BOTTOM" };
    const clash = buildClash([game(1, { byMember: (puuid) => ({ teamPosition: roles[puuid] }) }), game(2, { aWon: false, byMember: (puuid) => ({ teamPosition: roles[puuid] }) })], A, B);
    expect(clash.lanes.map((l) => l.role)).toEqual(["TOP", "MIDDLE"]); // JUNGLE and BOTTOM had no opposite number
    const top = clash.lanes[0];
    expect(top.games).toBe(2);
    expect(top.outplayed).toEqual({ a: 0, b: 0 }); // the same KDA on both sides in this fixture
    expect([top.a.gameName, top.b.gameName]).toEqual(["A1", "B1"]);
  });

  it("gives a lane to the laner with the better KDA, and not to the game's winner", () => {
    const roles = { a1: "TOP", a2: "JUNGLE", b1: "TOP", b2: "JUNGLE" };
    const better = (win) => (puuid) => ({ teamPosition: roles[puuid], ...(puuid === "a1" ? { kills: 10, deaths: 1 } : puuid === "b2" ? { kills: 12, deaths: 1 } : {}), win });
    const ab = [A[0], A[1]];
    const bb = [B[0], B[1]];
    const clash = buildClash([1, 2, 3].map((n) => game(n, { a: ab, b: bb, aWon: n !== 3, byMember: better() })), ab, bb);
    const [top, jungle] = clash.lanes;
    expect(top.outplayed).toEqual({ a: 3, b: 0 }); // a1 had the KDA in all three, though A lost the third game
    expect(jungle.outplayed).toEqual({ a: 0, b: 3 });
  });

  it("names a standout only for a member with enough games", () => {
    const strong = (puuid) => (puuid === "a2" ? { kills: 20, deaths: 1 } : {});
    const three = buildClash([1, 2, 3].map((n) => game(n, { byMember: strong })), A, B);
    expect(three.stars.a.gameName).toBe("A2");
    const two = buildClash([1, 2].map((n) => game(n, { byMember: strong })), A, B);
    expect(two.stars.a).toBeNull();
    expect(two.stars.b).toBeNull();
  });

  it("leaves out members who were not in any clash", () => {
    const clash = buildClash([game(1, { a: A.slice(0, 2) })], A, B);
    expect(clash.players.a.map((p) => p.puuid)).toEqual(["a1", "a2"]);
  });
});

describe("wording", () => {
  const clash = (wins, games = wins.a + wins.b) => ({ games, wins, verdict: seriesVerdict(games, wins) });
  const names = { a: "Team A", b: "Team B" };

  it("names the leader, or says it is level or too early", () => {
    expect(clashLine(clash({ a: 7, b: 1 }), names)).toContain("Team A");
    expect(clashLine(clash({ a: 1, b: 7 }), names)).toContain("Team B");
    expect(clashLine(clash({ a: 3, b: 3 }), names)).toMatch(/level|even|too close/i);
    expect(clashLine(clash({ a: 1, b: 1 }), names)).toMatch(/2/);
  });

  it("names a side after its first member", () => {
    expect(teamName(A)).toContain("A1");
  });
});

describe("clashRows", () => {
  it("has a row per stat, the higher one winning, and a tie for neither", () => {
    const clash = buildClash([game(1, { byMember: (puuid) => (puuid.startsWith("a") ? { kills: 10, deaths: 2, assists: 4, visionScore: 30 } : { kills: 2, deaths: 10, assists: 2, visionScore: 30 }) })], A, B);
    const rows = clashRows(clash);
    expect(rows.map((r) => r.key)).toEqual(["kda", "damage", "gold", "vision"]);
    expect(rows[0].winner).toBe("a");
    expect(rows[0].aShow).toBe("7.00");
    expect(rows[0].aShare).toBeGreaterThan(0.9);
    expect(rows.find((r) => r.key === "damage").winner).toBeNull(); // same damage on both sides in this fixture
    expect(rows.find((r) => r.key === "vision").aShare).toBe(0.5);
  });
});

describe("the demo clash", () => {
  it("has games, lanes for every role, and a verdict", () => {
    const { a, b, clash } = getDemoClash();
    expect(a).toHaveLength(5);
    expect(b).toHaveLength(5);
    expect(clash.games).toBe(9);
    expect(clash.lanes).toHaveLength(5);
    expect(clash.wins.a + clash.wins.b).toBe(9);
  });
});
