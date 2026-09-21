import { describe, expect, it } from "vitest";
import { buildChampionRecap, getChampionLine } from "./championRecap";

// One game for player "me" on `champion`, oldest first by `at`; `mode` is the queue's gameMode.
const game = (at, champion, win = true, mode = "CLASSIC") => ({
  metadata: { matchId: `EUW1_${at}` },
  info: {
    gameCreation: at,
    gameDuration: 1800,
    gameMode: mode,
    participants: [
      { puuid: "me", teamId: 100, win, kills: 5, deaths: 3, assists: 5, championName: champion, teamPosition: "MIDDLE" },
      { puuid: "foe", teamId: 200, win: !win, kills: 3, deaths: 5, assists: 2, championName: "Zed", teamPosition: "MIDDLE" },
    ],
    teams: [],
  },
});

describe("buildChampionRecap", () => {
  it("counts only the games on that champion", () => {
    const recap = buildChampionRecap([game(1, "Ahri", true), game(2, "Lux", true), game(3, "Ahri", false), game(4, "Ahri", true)], "me", "Ahri");
    expect(recap.games).toBe(3);
    expect(recap.wins).toBe(2);
    expect(recap.winRate).toBeCloseTo(2 / 3);
    expect(recap.topChampions).toHaveLength(1);
    expect(recap.topChampions[0]).toMatchObject({ id: "Ahri", games: 3 });
  });

  it("leaves out games in other modes, like the main recap does", () => {
    const recap = buildChampionRecap([game(1, "Ahri", true), game(2, "Ahri", true, "ARAM"), game(3, "Ahri", false, "CHERRY")], "me", "Ahri");
    expect(recap.games).toBe(1);
  });

  it("finds a champion the match names differently from Data Dragon", () => {
    const canonical = (id) => (id === "FiddleSticks" ? "Fiddlesticks" : id);
    expect(buildChampionRecap([game(1, "FiddleSticks")], "me", "Fiddlesticks", canonical).games).toBe(1);
    expect(buildChampionRecap([game(1, "FiddleSticks")], "me", "Fiddlesticks")).toBeNull(); // without the alias it doesn't match
  });

  it("is null when you never played the champion", () => {
    expect(buildChampionRecap([game(1, "Lux")], "me", "Ahri")).toBeNull();
    expect(buildChampionRecap([], "me", "Ahri")).toBeNull();
  });
});

describe("getChampionLine", () => {
  const recap = (games, winRate) => ({ games, winRate });

  it("says a champion beats your usual when it clearly does", () => {
    // 80% over 20 games against 50% overall: 30 points, where about 17 would be luck.
    expect(getChampionLine(recap(20, 0.8), 0.5, "Ahri")).toBe("Ahri beats your usual: 80% against 50% overall.");
  });

  it("says it is a tougher one when it clearly is", () => {
    expect(getChampionLine(recap(20, 0.2), 0.5, "Ahri")).toBe("Ahri is a tougher one: 20% against 50% overall.");
  });

  it("says it is level when the gap is small, or too small for this few games to prove", () => {
    expect(getChampionLine(recap(20, 0.52), 0.5, "Ahri")).toBe("Ahri is right at your usual: 52%, 50% overall.");
    expect(getChampionLine(recap(20, 0.6), 0.5, "Ahri")).toContain("right at your usual"); // 10 points over 20 games is within luck
    expect(getChampionLine(recap(100, 0.6), 0.5, "Ahri")).toContain("beats your usual"); // ...but not over 100
  });

  it("gives just the record with too few games to compare", () => {
    expect(getChampionLine(recap(5, 1), 0.5, "Ahri")).toBe("5 games as Ahri so far: 100% win rate.");
    expect(getChampionLine(recap(1, 0), 0.5, "Ahri")).toBe("1 game as Ahri so far: 0% win rate.");
  });
});
