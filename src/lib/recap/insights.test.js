import { describe, expect, it } from "vitest";
import { getBadges } from "./badges";
import { getBlame } from "./blame";
import { getHabits, getPingStyle, getSpellHabits, getSurrender } from "./habits";
import { getTierList, tierListLine, tierScore } from "./tierlist";

const ping = (overrides) => ({ games: 40, byType: { getBackPings: 0, enemyMissingPings: 0, onMyWayPings: 0, assistMePings: 0, ...overrides } });

describe("getPingStyle", () => {
  it("needs enough games and pings", () => {
    expect(getPingStyle({ pings: null })).toBeNull();
    expect(getPingStyle({ pings: { ...ping({ enemyMissingPings: 200 }), games: 3 } })).toBeNull();
    expect(getPingStyle({ pings: ping({ enemyMissingPings: 10 }) })).toBeNull(); // 10 pings in 40 games
  });

  it("names the personality after the ping you use most", () => {
    const style = getPingStyle({ pings: ping({ enemyMissingPings: 300, getBackPings: 60, onMyWayPings: 40 }) });
    expect(style.title).toBe("The Lookout");
    expect(style.perGame).toBeCloseTo(10);
    expect(style.top.share).toBeCloseTo(0.75);
  });

  it("gives no personality when the pings are spread evenly", () => {
    const pings = { games: 40, byType: Object.fromEntries(["allInPings", "assistMePings", "commandPings", "enemyMissingPings", "enemyVisionPings", "getBackPings", "holdPings", "needVisionPings", "onMyWayPings", "pushPings", "visionClearedPings"].map((k) => [k, 20])) };
    expect(getPingStyle({ pings })).toBeNull();
  });
});

describe("getSpellHabits and getSurrender", () => {
  it("reports the usual spell pair and Flash key", () => {
    const habits = getSpellHabits({ spells: { games: 20, topPair: { ids: [4, 14], games: 15 }, flash: { key: "F", perGame: 2.5, games: 20 } } });
    expect(habits.pair).toEqual(["Flash", "Ignite"]);
    expect(habits.pairShare).toBeCloseTo(0.75);
    expect(habits.flash).toEqual({ key: "F", perGame: 2.5 });
    expect(getSpellHabits({ spells: { games: 3, topPair: { ids: [4, 14], games: 3 }, flash: null } })).toBeNull();
  });

  it("splits surrenders by which side gave up", () => {
    expect(getSurrender({ surrender: { known: 40, ended: 10, enemyQuit: 7 } })).toMatchObject({ rate: 0.25, enemyQuit: 7, weQuit: 3 });
    expect(getSurrender({ surrender: { known: 5, ended: 5, enemyQuit: 0 } })).toBeNull();
  });

  it("returns null when there is nothing, and picks a line otherwise", () => {
    expect(getHabits({})).toBeNull();
    expect(getHabits({ surrender: { known: 20, ended: 9, enemyQuit: 2 } }).line).toMatch(/surrender/);
    expect(getHabits({ pings: ping({ getBackPings: 300 }) }).line).toMatch(/retreat/);
  });
});

describe("getBlame", () => {
  const side = (games, top, damageShare, deathShare, rank) => ({ games, top, damageShare, deathShare, rank });

  it("needs enough losses", () => {
    expect(getBlame({ blame: { loss: side(4, 4, 0.4, 0.1, 1), win: null } })).toBeNull();
    expect(getBlame({})).toBeNull();
  });

  it("says you carried when you top the damage and rarely die", () => {
    const result = getBlame({ blame: { loss: side(20, 10, 0.32, 0.18, 1.8), win: side(20, 8, 0.3, 0.17, 2) } });
    expect(result.verdict).toBe("carry");
    expect(result.topRate).toBe(0.5);
  });

  it("says you were the weak link when you feed and rarely lead", () => {
    expect(getBlame({ blame: { loss: side(20, 1, 0.14, 0.33, 4.1), win: null } }).verdict).toBe("weak");
  });

  it("calls it a team effort otherwise", () => {
    expect(getBlame({ blame: { loss: side(20, 4, 0.2, 0.2, 3), win: null } }).verdict).toBe("team");
  });
});

describe("getTierList", () => {
  const champ = (id, games, winRate, kda = 3) => ({ id, games, winRate, kda });

  it("puts champions in tiers by win rate, with KDA as the tiebreaker", () => {
    const list = getTierList({ champions: [champ("Ahri", 10, 0.8, 4), champ("Zed", 8, 0.62), champ("Lux", 8, 0.5), champ("Yasuo", 6, 0.2, 1.5), champ("Teemo", 2, 1)] });
    const at = (key) => list.tiers.find((t) => t.key === key).champions.map((c) => c.id);
    expect(at("S")).toEqual(["Ahri"]);
    expect(at("A")).toEqual(["Zed"]);
    expect(at("B")).toEqual(["Lux"]);
    expect(at("D")).toEqual(["Yasuo"]);
    expect(list.tiers.map((t) => t.key)).toEqual(["S", "A", "B", "C", "D"]);
    expect(list.best.id).toBe("Ahri");
    expect(list.worst.id).toBe("Yasuo");
  });

  it("leaves out champions with too few games and needs at least three", () => {
    expect(getTierList({ champions: [champ("Ahri", 10, 0.8), champ("Zed", 8, 0.6), champ("Teemo", 2, 1)] })).toBeNull();
  });

  it("caps the KDA so a huge one can't lift a losing champion", () => {
    expect(tierScore({ winRate: 0.3, kda: 50 })).toBeCloseTo(0.51);
    expect(tierScore({ winRate: 0.3, kda: 5 })).toBeCloseTo(0.51);
  });
});

describe("tierListLine", () => {
  const champ = (id, games, winRate, kda = 3) => ({ id, games, winRate, kda });
  const line = (champions) => tierListLine(getTierList({ champions }), (id) => id);

  it("only says S tier when the best champion is in the S row", () => {
    expect(line([champ("Ahri", 10, 0.85, 5), champ("Zed", 8, 0.55), champ("Yasuo", 6, 0.2, 1)])).toMatch(/^Ahri is your S-tier pick at 85%./);
  });

  it("says so when nothing reached S, and names the tier the best champion is in", () => {
    // 69% with a 3 KDA scores 0.69 x 0.7 + ... which is below the S line, so this list has no S tier.
    const text = line([champ("Sion", 12, 0.69), champ("Garen", 8, 0.55), champ("Ornn", 6, 0.4)]);
    expect(text).toMatch(/^Nothing reached S tier. Sion leads your list in A tier at 69%./);
    expect(text).not.toMatch(/S-tier pick/);
    expect(text).toMatch(/Ornn is at the bottom, in [A-D] tier, with 40%./);
  });

  it("calls the bottom champion a D-tier pick only when it is in D", () => {
    expect(line([champ("Ahri", 10, 0.85, 5), champ("Zed", 8, 0.5), champ("Yasuo", 6, 0.2, 1)])).toMatch(/Yasuo is your D-tier pick at 20%./);
  });

  it("has its own wording when the whole pool is in one tier", () => {
    expect(line([champ("Sion", 12, 0.66), champ("Ornn", 8, 0.62), champ("Garen", 6, 0.64)])).toBe("Your whole pool sits in A tier, led by Sion at 66%.");
  });
});

describe("getBadges", () => {
  const recap = (overrides = {}) => ({
    games: 60,
    winRate: 0.65,
    multikills: { penta: 1, quadra: 1, triple: 12 },
    deathlessGames: 2,
    streaks: { win: 5, loss: 3 },
    mostKills: 14,
    bestGame: { kda: 11 },
    firstBloods: 4,
    objectives: { personal: { stolen: 0, turrets: 60 } },
    uniqueChampions: 12,
    topChampions: [{ games: 31 }],
    longestGame: { seconds: 2000 },
    afterResult: { win: { games: 30, wins: 20 }, loss: { games: 20, wins: 10 } },
    hoursPlayed: 30,
    ...overrides,
  });

  it("unlocks badges that reach their target and counts them", () => {
    const { badges, unlocked, total } = getBadges(recap());
    const by = Object.fromEntries(badges.map((b) => [b.id, b]));
    for (const id of ["penta", "triple", "flawless", "winrate", "perfect", "loyal"]) expect(by[id].unlocked, id).toBe(true);
    for (const id of ["quadra", "flawless5", "streak", "kills", "thief", "marathon", "bounce"]) expect(by[id].unlocked, id).toBe(false);
    expect(unlocked).toBe(badges.filter((b) => b.unlocked).length);
    expect(total).toBe(badges.length);
  });

  it("puts unlocked badges first and orders the rest by progress", () => {
    const { badges } = getBadges(recap());
    const firstLocked = badges.findIndex((b) => !b.unlocked);
    expect(badges.slice(0, firstLocked).every((b) => b.unlocked)).toBe(true);
    const progress = badges.slice(firstLocked).map((b) => b.progress);
    expect(progress).toEqual([...progress].sort((a, b) => b - a));
  });

  it("shows partial progress and treats missing data as locked with none", () => {
    const { badges } = getBadges(recap({ objectives: null, games: 10 }));
    const by = Object.fromEntries(badges.map((b) => [b.id, b]));
    expect(by.quadra.progress).toBeCloseTo(1 / 3);
    expect(by.thief).toMatchObject({ unlocked: false, progress: 0 });
    expect(by.winrate).toMatchObject({ unlocked: false, progress: 0 }); // too few games to rate
  });
});
