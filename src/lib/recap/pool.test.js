import { describe, expect, it } from "vitest";
import { getPoolAdvice } from "./pool";

// A few champions as the champion index holds them (Data Dragon's real tags and 0-10 scores).
const BY_ID = {
  Ahri: { tags: ["Mage", "Assassin"], info: { attack: 3, defense: 4, magic: 8, difficulty: 5 }, partype: "Mana" },
  Syndra: { tags: ["Mage"], info: { attack: 2, defense: 3, magic: 9, difficulty: 8 }, partype: "Mana" },
  Lux: { tags: ["Mage", "Support"], info: { attack: 2, defense: 4, magic: 9, difficulty: 5 }, partype: "Mana" },
  Zed: { tags: ["Assassin"], info: { attack: 9, defense: 2, magic: 1, difficulty: 7 }, partype: "Energy" },
  Talon: { tags: ["Assassin", "Fighter"], info: { attack: 9, defense: 3, magic: 1, difficulty: 7 }, partype: "Mana" },
  Garen: { tags: ["Fighter", "Tank"], info: { attack: 7, defense: 7, magic: 1, difficulty: 5 }, partype: "None" },
  Malphite: { tags: ["Tank", "Mage"], info: { attack: 5, defense: 9, magic: 7, difficulty: 2 }, partype: "Mana" },
};
const champ = (id, games, winRate) => ({ id, games, winRate });
const recap = (champions, winRate = 0.5) => ({ champions, winRate });

describe("getPoolAdvice", () => {
  it("suggests the champions most alike one you win with, and that you haven't played", () => {
    const advice = getPoolAdvice(recap([champ("Ahri", 30, 0.7)]), BY_ID);
    expect(advice).toHaveLength(1);
    expect(advice[0].anchor).toEqual({ id: "Ahri", games: 30, winRate: 0.7 });
    // Another mage with a similar spread (Lux, then Syndra) before any assassin, and never the champion itself.
    expect(advice[0].picks.map((p) => p.id)).toEqual(["Lux", "Syndra"]);
  });

  it("does not suggest a champion you have already played more than a couple of games", () => {
    const advice = getPoolAdvice(recap([champ("Ahri", 30, 0.7), champ("Lux", 3, 0.5), champ("Syndra", 2, 0.5)]), BY_ID);
    const picks = advice[0].picks.map((p) => p.id);
    expect(picks).not.toContain("Lux"); // 3 games: played enough
    expect(picks).toContain("Syndra"); // 2 games: still one to try
  });

  it("builds on up to two champions and never suggests the same one twice", () => {
    const advice = getPoolAdvice(recap([champ("Ahri", 30, 0.7), champ("Zed", 20, 0.6), champ("Garen", 12, 0.55)]), BY_ID);
    expect(advice.map((a) => a.anchor.id)).toEqual(["Ahri", "Zed"]); // the two best win rates
    const picks = advice.flatMap((a) => a.picks.map((p) => p.id));
    expect(new Set(picks).size).toBe(picks.length);
    expect(advice[1].picks[0].id).toBe("Talon"); // an assassin/fighter with the same scores as Zed
  });

  it("only builds on a champion you know and win with", () => {
    // 4 games is not enough to know a champion, and losing with one is nothing to build on.
    expect(getPoolAdvice(recap([champ("Ahri", 4, 0.9)]), BY_ID)).toBeNull();
    expect(getPoolAdvice(recap([champ("Ahri", 30, 0.4)], 0.5), BY_ID)).toBeNull();
    expect(getPoolAdvice(recap([champ("Ahri", 30, 0.5)], 0.5), BY_ID)).not.toBeNull(); // as good as your average counts
  });

  it("copes with champions that have no scores", () => {
    const plain = { Ahri: { tags: ["Mage"] }, Lux: { tags: ["Mage"] }, Zed: { tags: ["Assassin"] } };
    const advice = getPoolAdvice(recap([champ("Ahri", 10, 0.7)]), plain);
    expect(advice[0].picks[0].id).toBe("Lux"); // by class alone
  });

  it("uses the index's id for a champion a match names differently", () => {
    const byId = { Fiddlesticks: { tags: ["Mage", "Support"] }, Lux: { tags: ["Mage", "Support"] } };
    const advice = getPoolAdvice(recap([champ("FiddleSticks", 10, 0.7)]), byId, (id) => (id === "FiddleSticks" ? "Fiddlesticks" : id));
    expect(advice[0].picks.map((p) => p.id)).toEqual(["Lux"]); // not Fiddlesticks itself
  });

  it("gives the same answer every time", () => {
    const r = recap([champ("Ahri", 30, 0.7), champ("Zed", 20, 0.6)]);
    expect(getPoolAdvice(r, BY_ID)).toEqual(getPoolAdvice(r, BY_ID));
  });

  it("has nothing without champions", () => {
    expect(getPoolAdvice(recap([]), BY_ID)).toBeNull();
    expect(getPoolAdvice({}, BY_ID)).toBeNull();
  });
});
