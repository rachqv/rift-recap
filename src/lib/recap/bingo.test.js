import { describe, expect, it } from "vitest";
import { getBadges } from "./badges";
import { getBingo } from "./bingo";

// A recap that reaches every trophy's target exactly, so each test can take some away.
const full = (overrides = {}) => ({
  games: 60,
  winRate: 0.6,
  multikills: { penta: 1, quadra: 3, triple: 10 },
  deathlessGames: 5,
  streaks: { win: 8, loss: 2 },
  mostKills: 20,
  bestGame: { kda: 10 },
  firstBloods: 10,
  objectives: { personal: { stolen: 1, turrets: 100, dragons: 10, barons: 5 } },
  uniqueChampions: 20,
  topChampions: [{ games: 30 }],
  longestGame: { seconds: 2700 },
  afterResult: { win: { games: 30, wins: 20 }, loss: { games: 20, wins: 12 } },
  hoursPlayed: 40,
  killParticipation: 0.65,
  duo: { games: 20 },
  visionPerMin: 1.5,
  csPerMin: 7.5,
  roleCount: 5,
  ...overrides,
});

// A recap where nothing is unlocked.
const bare = (overrides = {}) =>
  full({
    games: 0,
    winRate: 0,
    multikills: { penta: 0, quadra: 0, triple: 0 },
    deathlessGames: 0,
    streaks: { win: 0, loss: 0 },
    mostKills: 0,
    bestGame: null,
    firstBloods: 0,
    objectives: null,
    uniqueChampions: 0,
    topChampions: [],
    longestGame: null,
    afterResult: null,
    hoursPlayed: 0,
    killParticipation: null,
    duo: null,
    visionPerMin: 0,
    csPerMin: 0,
    roleCount: 0,
    ...overrides,
  });

describe("the 24 trophies", () => {
  it("each have their own place in the catalog, 0 to 23", () => {
    const { badges, total } = getBadges(full());
    expect(total).toBe(24);
    expect(badges.map((b) => b.slot).sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });

  it("all unlock when every target is reached, and none do with nothing", () => {
    expect(getBadges(full()).unlocked).toBe(24);
    expect(getBadges(bare()).unlocked).toBe(0);
  });

  it("need enough games behind a rate before it counts", () => {
    const by = Object.fromEntries(getBadges(full({ games: 10 })).badges.map((b) => [b.id, b]));
    for (const id of ["winrate", "teamplayer", "vision", "farm"]) expect(by[id], id).toMatchObject({ unlocked: false, progress: 0 });
  });

  it("show a decimal target the way the language writes it", () => {
    const text = (id) => getBadges(full()).badges.find((b) => b.id === id).text;
    expect(text("farm")).toMatch(/7\.5/);
    expect(text("teamplayer")).toMatch(/65%/);
  });
});

describe("getBingo", () => {
  const at = (bingo, id) => bingo.cells.findIndex((c) => c.id === id);

  it("lays the trophies out in catalog order with the free space in the middle", () => {
    const { cells, size } = getBingo(bare());
    expect(size).toBe(5);
    expect(cells).toHaveLength(25);
    expect(cells[12].free).toBe(true);
    expect([0, 4, 10, 11, 13, 14, 20, 24].map((i) => cells[i].id)).toEqual(["penta", "perfect", "dragon", "baron", "turrets", "thief", "variety", "hours"]);
    expect(cells.filter((c) => !c.free)).toHaveLength(24);
  });

  it("finishes all 12 lines when everything is unlocked", () => {
    const bingo = getBingo(full());
    expect(bingo.lines).toBe(12);
    expect(bingo.unlocked).toBe(24);
    expect(bingo.cells.every((c) => c.inLine)).toBe(true);
    expect(bingo.next).toBeNull();
  });

  it("has no line with nothing unlocked: the free space alone is not one", () => {
    const bingo = getBingo(bare());
    expect(bingo.lines).toBe(0);
    expect(bingo.cells.some((c) => c.inLine)).toBe(false);
    expect(bingo.next).toBeNull();
  });

  it("counts the free space towards a line: four trophies finish the middle row", () => {
    // The objectives row is dragon, baron, FREE, turrets, thief: four trophies finish it.
    const bingo = getBingo(bare({ objectives: { personal: { stolen: 1, turrets: 100, dragons: 10, barons: 5 } } }));
    expect(bingo.lines).toBe(1);
    expect([10, 11, 12, 13, 14].every((i) => bingo.cells[i].inLine)).toBe(true);
    expect(bingo.cells.filter((c) => c.inLine)).toHaveLength(5);
  });

  it("loses a row, a column and a diagonal when a corner trophy is missing", () => {
    const bingo = getBingo(full({ multikills: { penta: 0, quadra: 3, triple: 10 } })); // top left
    expect(bingo.lines).toBe(9);
    expect(bingo.cells[at(bingo, "penta")].inLine).toBe(false);
    // Its row, column and diagonal are broken, but a square on none of them (the right end of the middle row) still counts.
    expect(bingo.cells[at(bingo, "thief")].inLine).toBe(true);
  });

  it("loses only a row and a column for a square that is on no diagonal", () => {
    expect(getBingo(full({ objectives: { personal: { stolen: 1, turrets: 0, dragons: 10, barons: 5 } } })).lines).toBe(10); // turrets, row 3 column 4
  });

  it("names the trophy that would finish a line, preferring the one closest to unlocking", () => {
    // Penta would finish the first column and the diagonal, quadra the second column. Quadra is 2 of 3 there, penta 0 of 1.
    const bingo = getBingo(full({ multikills: { penta: 0, quadra: 2, triple: 10 } }));
    expect(bingo.next).toMatchObject({ id: "quadra" });
    expect(bingo.next.progress).toBeCloseTo(2 / 3);
    expect(bingo.next.name).toBe("Quadra collector");
  });

  it("has no next bingo when every open line is two or more short", () => {
    expect(getBingo(bare({ hoursPlayed: 40, roleCount: 5 })).next).toBeNull();
  });
});
