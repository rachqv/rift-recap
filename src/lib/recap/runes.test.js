import { describe, expect, it } from "vitest";
import { compactRunes, getKeystoneInsight, pickKeystones } from "./runes";

// A slice of Data Dragon's runesReforged.json: each tree's first slot is its keystones, the rest are ordinary runes.
const TREES = [
  { id: 8100, name: "Domination", slots: [{ runes: [{ id: 8112, name: "Electrocute", icon: "perk/e.png" }, { id: 8128, name: "Dark Harvest", icon: "perk/d.png" }] }, { runes: [{ id: 8126, name: "Cheap Shot", icon: "perk/c.png" }] }] },
  { id: 8000, name: "Precision", slots: [{ runes: [{ id: 8010, name: "Conqueror", icon: "perk/k.png" }, { id: 8008, name: "Lethal Tempo", icon: "perk/l.png" }] }, { runes: [{ id: 9111, name: "Triumph", icon: "perk/t.png" }] }] },
  { id: 8200, name: "Sorcery", slots: [{ runes: [{ id: 8214, name: "Summon Aery", icon: "perk/a.png" }] }] },
];
const index = compactRunes(TREES);
const stat = (id, games, wins) => ({ id, games, wins });

describe("compactRunes", () => {
  it("finds every rune by id, with its tree, and marks the first slot of a tree as its keystones", () => {
    expect(index[8112]).toEqual({ id: 8112, name: "Electrocute", icon: "perk/e.png", tree: "Domination", keystone: true });
    expect(index[8126]).toMatchObject({ name: "Cheap Shot", tree: "Domination", keystone: false });
    expect(index[8214].keystone).toBe(true);
  });

  it("copes with no data", () => {
    expect(compactRunes(undefined)).toEqual({});
    expect(compactRunes([{ id: 1, name: "Empty" }])).toEqual({});
  });
});

describe("pickKeystones", () => {
  it("needs enough games with a known keystone", () => {
    expect(pickKeystones([], index)).toBeNull();
    expect(pickKeystones(undefined, index)).toBeNull();
    expect(pickKeystones([stat(8112, 9, 5)], index)).toBeNull();
    expect(pickKeystones([stat(8112, 6, 3), stat(99999, 40, 20)], index)).toBeNull(); // an unknown rune id counts for nothing
    expect(pickKeystones([stat(8112, 10, 5)], index)).not.toBeNull();
  });

  it("names your favorite keystone, your next few, and how often and how well you do with each", () => {
    const picks = pickKeystones([stat(8010, 20, 12), stat(8112, 10, 4), stat(8214, 6, 3), stat(8008, 4, 1), stat(8128, 2, 1)], index);
    expect(picks.total).toBe(42);
    expect(picks.favorite).toMatchObject({ id: 8010, name: "Conqueror", tree: "Precision", games: 20, wins: 12, winRate: 0.6 });
    expect(picks.favorite.share).toBeCloseTo(20 / 42);
    expect(picks.others.map((k) => k.name)).toEqual(["Electrocute", "Summon Aery", "Lethal Tempo"]); // three, not four
  });

  it("gives the win rate without your favorite only when there are enough other games", () => {
    // 8 wins of 14 without it... 22 games in all: 12 of 20 with it, and 5 of 10 with the rest: 50%.
    expect(pickKeystones([stat(8010, 20, 12), stat(8112, 10, 5)], index).favorite.winRateWithout).toBeCloseTo(0.5);
    expect(pickKeystones([stat(8010, 20, 12), stat(8112, 5, 5)], index).favorite.winRateWithout).toBeNull(); // 5 other games
  });

  it("says a keystone is better when it clearly wins more than your favorite", () => {
    // 40% over 20 games with Electrocute, 83% over 12 with Conqueror: far more than luck.
    const picks = pickKeystones([stat(8112, 20, 8), stat(8010, 12, 10)], index);
    expect(picks.favorite.name).toBe("Electrocute");
    expect(picks.best.name).toBe("Conqueror");
    expect(picks.verdict).toBe("better");
  });

  it("asks more of a gap the fewer games are behind it", () => {
    // 50% over 8 games against 83% over 6: a 33-point gap, but this few games could do that by chance.
    expect(pickKeystones([stat(8112, 8, 4), stat(8010, 6, 5)], index).verdict).toBe("plain");
  });

  it("ignores a keystone with too few games when looking for the best", () => {
    const picks = pickKeystones([stat(8112, 15, 7), stat(8010, 5, 5)], index); // 5 games at 100% is not a better keystone: too few
    expect(picks.best.name).toBe("Electrocute");
    expect(picks.verdict).toBe("plain");
  });

  it("calls someone who takes one keystone nearly every game loyal", () => {
    expect(pickKeystones([stat(8112, 45, 22), stat(8010, 5, 3)], index).verdict).toBe("loyal");
  });

  it("is plain otherwise", () => {
    expect(pickKeystones([stat(8112, 15, 8), stat(8010, 12, 6)], index).verdict).toBe("plain");
  });
});

describe("getKeystoneInsight", () => {
  it("has a sentence for each verdict", () => {
    expect(getKeystoneInsight(pickKeystones([stat(8112, 20, 8), stat(8010, 12, 10)], index))).toBe("Conqueror wins 83% for you, against 40% with Electrocute. Worth taking more often?");
    expect(getKeystoneInsight(pickKeystones([stat(8112, 45, 22), stat(8010, 5, 3)], index))).toBe("Electrocute in 90% of your games. Once you find a keystone, you stick with it.");
    expect(getKeystoneInsight(pickKeystones([stat(8112, 15, 8), stat(8010, 12, 6)], index))).toBe("Electrocute is your keystone: 53% win rate over 15 games.");
  });
});
