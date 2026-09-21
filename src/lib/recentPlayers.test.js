import { describe, expect, it } from "vitest";
import { MAX_RECENT, parseRecentPlayers, pinnedFirst, trimRecents, withPinToggled, withPlayer } from "./recentPlayers";
import { getSuggestions } from "./suggestions";

const player = (n, extra = {}) => ({ gameName: `P${n}`, tagLine: "EUW", region: "euw1", ...extra });
const names = (list) => list.map((p) => p.gameName);

describe("withPlayer", () => {
  it("moves a player to the top, without duplicating it (ignoring case)", () => {
    const list = [player(1), player(2), player(3)];
    expect(names(withPlayer(list, { gameName: "p3", tagLine: "euw", region: "euw1" }))).toEqual(["p3", "P1", "P2"]);
  });

  it("keeps a pinned player pinned when they are looked up again", () => {
    const list = [player(1), player(2, { pinned: true })];
    expect(withPlayer(list, player(2))[0]).toEqual(player(2, { pinned: true }));
  });

  it("treats the same name on another server as another player", () => {
    const list = [player(1)];
    expect(withPlayer(list, { ...player(1), region: "na1" })).toHaveLength(2);
  });
});

describe("trimRecents", () => {
  it("keeps the newest unpinned players, up to the limit", () => {
    const list = Array.from({ length: MAX_RECENT + 5 }, (_, i) => player(i));
    const kept = trimRecents(list);
    expect(kept).toHaveLength(MAX_RECENT);
    expect(kept[0].gameName).toBe("P0"); // newest first: the oldest are the ones dropped
  });

  it("never drops a pinned player, however old, and they do not count against the limit", () => {
    const list = [...Array.from({ length: MAX_RECENT + 3 }, (_, i) => player(i)), player(99, { pinned: true })];
    const kept = trimRecents(list);
    expect(kept).toHaveLength(MAX_RECENT + 1);
    expect(names(kept)).toContain("P99");
  });

  it("looking someone up does not push a pinned player out", () => {
    let list = [player(0, { pinned: true })];
    for (let i = 1; i <= MAX_RECENT * 2; i++) list = withPlayer(list, player(i));
    expect(names(list)).toContain("P0");
    expect(list.filter((p) => !p.pinned)).toHaveLength(MAX_RECENT);
  });
});

describe("withPinToggled", () => {
  it("pins a player where they are, and unpins them again", () => {
    const list = [player(1), player(2), player(3)];
    const pinned = withPinToggled(list, player(2));
    expect(names(pinned)).toEqual(["P1", "P2", "P3"]);
    expect(pinned[1].pinned).toBe(true);
    const back = withPinToggled(pinned, player(2));
    expect(back[1]).toEqual(player(2));
    expect("pinned" in back[1]).toBe(false);
  });

  it("unpinning can drop a player that is now beyond the limit", () => {
    // A full list of recent players plus one old pinned player. Unpinned, that player is the oldest of MAX_RECENT + 1, so they go.
    const list = [...Array.from({ length: MAX_RECENT }, (_, i) => player(i)), player(99, { pinned: true })];
    const after = withPinToggled(list, player(99));
    expect(after).toHaveLength(MAX_RECENT);
    expect(names(after)).not.toContain("P99");
  });

  it("does nothing for a player who is not in the list", () => {
    const list = [player(1)];
    expect(withPinToggled(list, player(2))).toEqual(list);
  });
});

describe("pinnedFirst", () => {
  it("lists pinned players first, each group keeping its order", () => {
    const list = [player(1), player(2, { pinned: true }), player(3), player(4, { pinned: true })];
    expect(names(pinnedFirst(list))).toEqual(["P2", "P4", "P1", "P3"]);
  });
});

describe("parseRecentPlayers", () => {
  it("reads lists saved before pinning existed as nothing pinned", () => {
    const saved = JSON.stringify([{ gameName: "Old", tagLine: "EUW", region: "euw1" }]);
    expect(parseRecentPlayers(saved)).toEqual([{ gameName: "Old", tagLine: "EUW", region: "euw1" }]);
  });

  it("keeps only a real pin, and drops anything malformed", () => {
    const saved = JSON.stringify([
      { gameName: "A", tagLine: "EUW", region: "euw1", pinned: true },
      { gameName: "B", tagLine: "EUW", region: "euw1", pinned: "yes" },
      { gameName: "C", tagLine: "EUW", region: "nope", pinned: true },
      { gameName: 3, tagLine: "EUW", region: "euw1" },
      null,
    ]);
    expect(parseRecentPlayers(saved)).toEqual([
      { gameName: "A", tagLine: "EUW", region: "euw1", pinned: true },
      { gameName: "B", tagLine: "EUW", region: "euw1" },
    ]);
    expect(parseRecentPlayers("not json")).toEqual([]);
  });
});

describe("getSuggestions with pinned players", () => {
  const recents = [player(1), player(2), player(3, { pinned: true }), player(4), player(5), player(6), player(7)];

  it("shows pinned players first, and says which they are", () => {
    const items = getSuggestions("", recents, []);
    expect(items.map((item) => item.gameName)).toEqual(["P3", "P1", "P2", "P4", "P5"]);
    expect(items.map((item) => item.pinned)).toEqual([true, false, false, false, false]);
  });

  it("puts a pinned player first among equally good matches", () => {
    const items = getSuggestions("p", recents, []);
    expect(items[0].gameName).toBe("P3");
  });

  it("still ranks a better match above a pinned one", () => {
    const items = getSuggestions("p2", recents, []);
    expect(items[0].gameName).toBe("P2");
  });
});
