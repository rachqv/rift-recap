import { describe, expect, it } from "vitest";
import { getLineup } from "./lineup";

/** A member as squad stats hold them: `roles` is `[[role, games, wins], ...]`, most played first. */
const member = (index, ...roles) => ({ index, games: roles.reduce((total, [, games]) => total + games, 0), roles: roles.map(([role, games, wins]) => ({ role, games, wins })) });
const roleOf = (lineup, index) => lineup.rows.find((row) => row.index === index);

describe("getLineup", () => {
  it("needs three members who played together, each with a role they have played enough", () => {
    expect(getLineup([member(0, ["TOP", 10, 5]), member(1, ["MIDDLE", 10, 5])])).toBeNull();
    expect(getLineup([member(0, ["TOP", 10, 5]), member(1, ["MIDDLE", 10, 5]), member(2, ["UTILITY", 2, 2])])).toBeNull(); // 2 games in one role
    expect(getLineup([member(0, ["TOP", 10, 5]), member(1, ["MIDDLE", 10, 5]), member(2, ["UTILITY", 10, 5])])).not.toBeNull();
  });

  it("leaves a member who never played with the squad out of it", () => {
    const lineup = getLineup([member(0, ["TOP", 10, 5]), { index: 1, games: 0, roles: [] }, member(2, ["MIDDLE", 10, 5]), member(3, ["UTILITY", 10, 5])]);
    expect(lineup.rows.map((row) => row.index)).toEqual([0, 2, 3]);
  });

  it("is settled when everyone already wins most in the role they play most", () => {
    const lineup = getLineup([member(0, ["TOP", 10, 7]), member(1, ["MIDDLE", 10, 6]), member(2, ["UTILITY", 10, 5])]);
    expect(lineup.mood).toBe("settled");
    expect(lineup.gain).toBe(0);
    expect(lineup.rows.map((row) => [row.role, row.changed])).toEqual([["TOP", false], ["MIDDLE", false], ["UTILITY", false]]);
    expect(roleOf(lineup, 0)).toMatchObject({ games: 10, winRate: 0.7 }); // the raw record, not the shrunk one
  });

  it("suggests a swap when two members would each do clearly better in the other's usual role", () => {
    // Shrunk (six games of 50% added): 0 as Top .667 or Mid .4375; 1 as Mid .417 or Top .5. Swapping is 1.083 against .9375 as they are.
    const lineup = getLineup([member(0, ["MIDDLE", 10, 4], ["TOP", 6, 5]), member(1, ["TOP", 10, 5], ["MIDDLE", 6, 2]), member(2, ["JUNGLE", 10, 5])]);
    expect(lineup.mood).toBe("swap");
    expect(lineup.gain).toBeCloseTo((1.0833 - 0.9375) / 3, 3);
    expect(roleOf(lineup, 0)).toMatchObject({ role: "TOP", usual: "MIDDLE", changed: true, games: 6, winRate: 5 / 6 });
    expect(roleOf(lineup, 1)).toMatchObject({ role: "MIDDLE", usual: "TOP", changed: true });
    expect(roleOf(lineup, 2)).toMatchObject({ role: "JUNGLE", changed: false });
  });

  it("does not suggest a swap for a gain too small to mean anything", () => {
    // Member 0 wins .5625 (shrunk) in Top against .5 in Mid: a 2-point gain per member, under the bar.
    const lineup = getLineup([member(0, ["MIDDLE", 10, 5], ["TOP", 10, 6]), member(1, ["TOP", 10, 5], ["MIDDLE", 10, 5]), member(2, ["JUNGLE", 10, 5])]);
    expect(lineup.mood).toBe("settled");
    expect(lineup.rows.every((row) => !row.changed)).toBe(true);
  });

  it("prefers no change when two lineups are equally good", () => {
    const lineup = getLineup([member(0, ["MIDDLE", 10, 5], ["TOP", 10, 5]), member(1, ["TOP", 10, 5], ["MIDDLE", 10, 5]), member(2, ["JUNGLE", 10, 5])]);
    expect(lineup.mood).toBe("settled");
  });

  it("has to move someone when two members usually play the same role, however small the gain", () => {
    // 0 and 1 both usually play Mid. Member 1 has no other role, so member 0 has to take Top, even though their Top record is worse.
    const lineup = getLineup([member(0, ["MIDDLE", 10, 6], ["TOP", 4, 1]), member(1, ["MIDDLE", 10, 5]), member(2, ["JUNGLE", 10, 5])]);
    expect(lineup.mood).toBe("swap");
    expect(roleOf(lineup, 0)).toMatchObject({ role: "TOP", changed: true });
    expect(roleOf(lineup, 1)).toMatchObject({ role: "MIDDLE", changed: false });
  });

  it("has no lineup when members can't all play different roles they know", () => {
    expect(getLineup([member(0, ["MIDDLE", 10, 5]), member(1, ["MIDDLE", 10, 5]), member(2, ["JUNGLE", 10, 5])])).toBeNull();
  });

  it("never puts someone in a role they have played fewer than three games in", () => {
    // Member 0 went 2 for 2 in Top, but two games is luck: they stay in Mid.
    const lineup = getLineup([member(0, ["MIDDLE", 10, 5], ["TOP", 2, 2]), member(1, ["TOP", 10, 5]), member(2, ["JUNGLE", 10, 5])]);
    expect(roleOf(lineup, 0).role).toBe("MIDDLE");
  });
});
