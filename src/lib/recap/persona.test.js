import { describe, expect, it } from "vitest";
import { getPersona, PERSONA_COUNT, rarityOf, rarityShareText } from "./persona";

// A player who sits exactly on the population norms for a mid laner over 80 games, so no trait stands out.
function averageRecap(overrides = {}) {
  const counts = [17, 12, ...new Array(16).fill(3)]; // 18 champions, 77 games
  counts.push(3); // 19 champions, 80 games
  const champions = counts.map((games, i) => ({ id: `Champ${i}`, games, winRate: 0.5 }));
  return {
    games: 80,
    winRate: 0.5,
    kda: (6.6 + 5.8) / 5.3,
    perGame: { kills: 6.6, deaths: 5.3, assists: 5.8 },
    csPerMin: 6.8,
    visionPerMin: 0.75,
    damagePerMin: 710,
    killParticipation: 0.6,
    firstBloods: 10,
    avgGameMinutes: 28.5,
    trend: { early: 0.5, late: 0.5 },
    streaks: { win: 5, loss: 5 },
    multikills: { penta: 0, quadra: 0, triple: 0 },
    objectives: { games: 80, personal: { stolen: 0, turrets: 240 } },
    role: { key: "MIDDLE", label: "Mid", share: 0.6 },
    roleShares: { MIDDLE: 0.6, TOP: 0.2, BOTTOM: 0.2 },
    roleCount: 3,
    uniqueChampions: champions.length,
    champions,
    topChampions: champions.slice(0, 5),
    hoursPlayed: 40,
    kills: 528,
    deaths: 424,
    assists: 464,
    deathlessGames: 0,
    ...overrides,
  };
}

const withTopShare = (share) => {
  const top = Math.round(80 * share);
  const rest = 80 - top;
  const champions = [{ id: "Ahri", games: top, winRate: 0.5 }, ...Array.from({ length: 10 }, (_, i) => ({ id: `Other${i}`, games: rest / 10, winRate: 0.5 }))];
  return averageRecap({ champions, topChampions: champions.slice(0, 5), uniqueChampions: 11 });
};

const tags = (map) => (id) => map[id];
const persona = (recap, options) => getPersona(recap, { topName: "Ahri", secondName: "Other0", ...options });

describe("getPersona", () => {
  it("gives an average player the Grinder", () => {
    expect(persona(averageRecap()).id).toBe("grinder");
  });

  it("only gives the One-Trick at 80% of games on one champion", () => {
    expect(persona(withTopShare(0.85)).id).toBe("onetrick");
    expect(persona(withTopShare(0.8)).id).toBe("onetrick");
    expect(persona(withTopShare(0.7)).id).not.toBe("onetrick");
    expect(persona(withTopShare(0.6)).id).not.toBe("onetrick");
  });

  it("gives a player with a slayer's numbers the Slayer", () => {
    expect(persona(averageRecap({ perGame: { kills: 9.5, deaths: 5.3, assists: 5.8 }, kills: 760 })).id).toBe("slayer");
  });

  it("scores each champion class against its own norm", () => {
    // 55% of games on assassins: well past the Assassin norm, and far below what the Sharpshooter would need.
    const recap = averageRecap();
    const assassinTags = Object.fromEntries(recap.champions.map((c, i) => [c.id, i < 6 ? ["Assassin"] : ["Fighter"]]));
    const share = recap.champions.slice(0, 6).reduce((total, c) => total + c.games, 0) / recap.games;
    expect(share).toBeGreaterThan(0.5);
    expect(persona(recap, { tagsOf: tags(assassinTags) }).id).toBe("assassin");

    // The same share of marksmen is not enough: marksmen are far more common, so the bar is higher.
    const marksmanTags = Object.fromEntries(recap.champions.map((c, i) => [c.id, i < 6 ? ["Marksman"] : ["Fighter"]]));
    expect(persona(recap, { tagsOf: tags(marksmanTags) }).id).not.toBe("sharpshooter");
  });

  it("attaches the rarity of the archetype it picked", () => {
    const result = persona(withTopShare(0.85));
    expect(result.rarity).toMatchObject({ tier: "Legendary", share: 0.3 });
    expect(persona(averageRecap()).rarity.tier).toBe("Common");
  });
});

describe("rarity", () => {
  it("assigns tiers by estimated share", () => {
    expect(rarityOf("explorer").tier).toBe("Common");
    expect(rarityOf("chameleon").tier).toBe("Uncommon");
    expect(rarityOf("assassin").tier).toBe("Rare");
    expect(rarityOf("carry").tier).toBe("Legendary");
    expect(rarityOf("nope")).toBeNull();
  });

  it("words the share as a rounded estimate", () => {
    expect(rarityShareText({ share: 4.3 })).toBe("about 4%");
    expect(rarityShareText({ share: 0.7 })).toBe("under 1%");
  });

  it("covers every archetype the scorer can return", () => {
    // Every archetype but the Grinder is one of PERSONAS, and all of them (Grinder included) need a rarity.
    expect(PERSONA_COUNT).toBe(34);
    const ids = ["onetrick", "specialist", "explorer", "chameleon", "showstopper", "thief", "slayer", "daredevil", "playmaker", "unlucky", "phoenix", "risingstar", "streaker", "scout", "farmer", "heavyhitter", "everpresent", "opener", "demolisher", "untouchable", "closer", "marathoner", "speedrunner", "assassin", "archmage", "sharpshooter", "brawler", "bulwark", "pathfinder", "islander", "centerpiece", "carry", "guardian", "grinder"];
    expect(ids).toHaveLength(PERSONA_COUNT);
    for (const id of ids) expect(rarityOf(id), id).not.toBeNull();
  });
});
