import { describe, expect, it } from "vitest";
import { buildPersonaGuess } from "./guess";
import { PERSONA_IDS } from "./persona";

const recap = { winRate: 0.6, kda: 3.456 };
const persona = { id: "closer", title: "The Closer", alsoIds: ["streaker", "carry"] };
const guess = (seed = "Name#TAG", overrides = {}) => buildPersonaGuess(recap, { ...persona, ...overrides }, { topName: "Ahri", seed });

describe("buildPersonaGuess", () => {
  it("offers the real archetype and three others, all different", () => {
    const { options, answer } = guess();
    expect(options).toHaveLength(4);
    expect(new Set(options.map((o) => o.id)).size).toBe(4);
    expect(options.map((o) => o.id)).toContain("closer");
    expect(answer).toBe("closer");
    expect(options.find((o) => o.id === "closer").title).toBe("The Closer");
    for (const option of options) expect(PERSONA_IDS).toContain(option.id);
  });

  it("never uses an archetype the player also scored high on as a decoy", () => {
    // Over many seeds, so a lucky shuffle can't hide it.
    for (let i = 0; i < 200; i++) {
      const ids = guess(`seed-${i}`).options.map((o) => o.id);
      expect(ids).not.toContain("streaker");
      expect(ids).not.toContain("carry");
    }
  });

  it("gives the same options in the same order for the same player, so a reload doesn't reshuffle", () => {
    expect(guess("Name#TAG")).toEqual(guess("Name#TAG"));
  });

  it("gives other players other decoys, and puts the answer in different places", () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `player-${i}`);
    const positions = new Set(seeds.map((seed) => guess(seed).options.findIndex((o) => o.id === "closer")));
    expect(positions.size).toBeGreaterThanOrEqual(3); // not always first or last
    const decoySets = new Set(seeds.map((seed) => guess(seed).options.map((o) => o.id).sort().join()));
    expect(decoySets.size).toBeGreaterThan(10);
  });

  it("writes three clues about the season that don't give the archetype away", () => {
    const { clues } = guess();
    expect(clues).toEqual(["Most played: Ahri", "Win rate 60%", "KDA 3.46"]);
    for (const clue of clues) expect(clue).not.toMatch(/closer/i);
  });

  it("works for a player with no runners-up", () => {
    expect(guess("x", { alsoIds: [] }).options).toHaveLength(4);
    expect(guess("x", { alsoIds: undefined }).options).toHaveLength(4);
  });
});
