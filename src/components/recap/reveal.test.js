import { describe, expect, it } from "vitest";
import { ROOT } from "./ambient";
import { flavorFor, IMPACT, motifFor, SCALE } from "./reveal";

// Every archetype id the reveal knows a flavor for, plus ones it doesn't (they get the default).
const IDS = ["slayer", "assassin", "archmage", "explorer", "pathfinder", "phoenix", "closer", "unknown-archetype"];
const FLAVORS = [...new Set(IDS.map(flavorFor))];

// A note's place in its octave: 2 -> 1, 3 -> 3/2, 12/5 -> 6/5.
const withinOctave = (ratio) => {
  let r = ratio;
  while (r >= 2) r /= 2;
  return r;
};

describe("the archetype reveal", () => {
  it("is built on the soundtrack's root, so it can't be in another key", () => {
    expect(ROOT).toBe(110); // the pad's A2; the reveal's notes are ratios on it
  });

  it("uses only notes of the scale the soundtrack sits in", () => {
    for (const flavor of FLAVORS) {
      for (const motif of flavor.motifs) {
        for (const ratio of motif) expect(SCALE, `ratio ${ratio}`).toContain(withinOctave(ratio));
      }
      for (const [, , ratio] of flavor.drums ?? []) expect(SCALE, `drum ${ratio}`).toContain(withinOctave(ratio * 2));
    }
  });

  it("resolves every phrase on the root or the fifth", () => {
    for (const flavor of FLAVORS) {
      for (const motif of flavor.motifs) expect([1, 3 / 2]).toContain(withinOctave(motif.at(-1)));
    }
  });

  it("gives an archetype the same phrase every time, from its own flavor", () => {
    for (const id of IDS) {
      expect(motifFor(id)).toBe(motifFor(id));
      expect(flavorFor(id).motifs).toContain(motifFor(id));
    }
  });

  it("gives each family its own flavor, and unknown archetypes the heroic one", () => {
    expect(flavorFor("slayer")).not.toBe(flavorFor("archmage"));
    expect(flavorFor("pathfinder").drums).toBeDefined();
    expect(flavorFor("closer")).toBe(flavorFor("unknown-archetype"));
  });

  it("lands the phrase on the flash: no note is scheduled before the slide starts", () => {
    for (const flavor of FLAVORS) {
      for (const motif of flavor.motifs) {
        if (!flavor.forward) expect(IMPACT - flavor.gap * (motif.length - 1)).toBeGreaterThanOrEqual(0);
      }
      for (const [offset] of flavor.drums ?? []) expect(IMPACT + offset).toBeGreaterThanOrEqual(0);
    }
  });
});
