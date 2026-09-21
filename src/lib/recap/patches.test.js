import { describe, expect, it } from "vitest";
import { getPatchForm, patchLine } from "./patches";

/** `[["16.1", games, wins], ...]` as the `patches` of a recap. */
const recap = (...rows) => ({ patches: rows.map(([patch, games, wins]) => ({ patch, games, wins })) });

describe("getPatchForm", () => {
  it("needs three patches with a few games each", () => {
    expect(getPatchForm({})).toBeNull();
    expect(getPatchForm(recap())).toBeNull();
    expect(getPatchForm(recap(["16.1", 10, 5], ["16.2", 10, 5]))).toBeNull();
    // A patch with 5 games has no win rate, so this is only two.
    expect(getPatchForm(recap(["16.1", 10, 5], ["16.2", 5, 5], ["16.3", 10, 5]))).toBeNull();
    expect(getPatchForm(recap(["16.1", 6, 3], ["16.2", 6, 3], ["16.3", 6, 3]))).not.toBeNull();
  });

  it("gives each patch its win rate, in the order given", () => {
    const { patches, overall } = getPatchForm(recap(["16.1", 10, 2], ["16.2", 10, 5], ["16.3", 10, 9]));
    expect(patches.map((p) => [p.patch, p.rate])).toEqual([["16.1", 0.2], ["16.2", 0.5], ["16.3", 0.9]]);
    expect(overall).toBeCloseTo(16 / 30);
  });

  it("shows only the ten most recent patches with enough games", () => {
    const rows = Array.from({ length: 14 }, (_, i) => [`16.${i + 1}`, 8, 4]);
    const { patches } = getPatchForm(recap(["15.9", 3, 1], ...rows));
    expect(patches).toHaveLength(10);
    expect(patches[0].patch).toBe("16.5");
    expect(patches.at(-1).patch).toBe("16.14");
  });

  it("finds the best and worst patch, and calls a wide gap a swing", () => {
    const form = getPatchForm(recap(["16.1", 10, 2], ["16.2", 10, 5], ["16.3", 10, 9]));
    expect(form.best.patch).toBe("16.3");
    expect(form.worst.patch).toBe("16.1");
    expect(form.gap).toBeCloseTo(0.7);
    expect(form.mood).toBe("swing");
  });

  it("calls a narrow gap steady", () => {
    const form = getPatchForm(recap(["16.1", 10, 5], ["16.2", 10, 6], ["16.3", 10, 4]));
    expect(form.gap).toBeCloseTo(0.2);
    expect(form.mood).toBe("steady"); // 20 points over ten games a patch is well within luck
  });

  it("asks for more the fewer games there are behind the gap", () => {
    // The same 33-point gap: over six games a patch it is luck, over thirty it is not.
    expect(getPatchForm(recap(["16.1", 6, 2], ["16.2", 6, 4], ["16.3", 6, 3])).mood).toBe("steady");
    expect(getPatchForm(recap(["16.1", 30, 9], ["16.2", 30, 15], ["16.3", 30, 18])).mood).toBe("swing");
  });
});

describe("patchLine", () => {
  it("names the best and worst patch after a swing, and the range after a steady stretch", () => {
    expect(patchLine(getPatchForm(recap(["16.1", 10, 2], ["16.2", 10, 5], ["16.3", 10, 9])))).toBe("You did best on patch 16.3 (90%) and worst on patch 16.1 (20%).");
    expect(patchLine(getPatchForm(recap(["16.1", 10, 5], ["16.2", 10, 6], ["16.3", 10, 4])))).toBe("Patch after patch you stayed between 40% and 60%. New patches barely move you.");
  });
});
