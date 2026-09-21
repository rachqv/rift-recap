import { describe, expect, it } from "vitest";
import { comfortLine, getComfort, getGrayScreen, getTilt } from "./form";

const champ = (id, games, winRate) => ({ id, games, winRate });
const recap = (overrides = {}) => ({ games: 60, winRate: 0.5, champions: [], afterResult: { win: { games: 25, wins: 15 }, loss: { games: 25, wins: 12 } }, timeDead: null, ...overrides });

describe("getTilt", () => {
  it("needs enough games after both a win and a loss", () => {
    expect(getTilt(recap({ afterResult: { win: { games: 5, wins: 4 }, loss: { games: 30, wins: 10 } } }))).toBeNull();
    expect(getTilt(recap({ afterResult: undefined }))).toBeNull();
  });

  it("reads a big drop after a loss as tilt", () => {
    const tilt = getTilt(recap({ afterResult: { win: { games: 25, wins: 18 }, loss: { games: 25, wins: 8 } } }));
    expect(tilt.mood).toBe("tilt");
    expect(tilt.gap).toBeCloseTo(0.4);
  });

  it("reads a better record after a loss as resilient", () => {
    expect(getTilt(recap({ afterResult: { win: { games: 25, wins: 10 }, loss: { games: 25, wins: 18 } } })).mood).toBe("resilient");
  });

  it("calls a small gap steady, since gaps that size are luck", () => {
    expect(getTilt(recap()).mood).toBe("steady"); // 60% vs 48%
  });
});

describe("getComfort", () => {
  it("ignores champions with too few games and needs at least two of the rest", () => {
    expect(getComfort(recap({ champions: [champ("Ahri", 20, 0.7), champ("Zed", 3, 0.1)] }))).toBeNull();
  });

  it("finds the best and worst swings against the overall win rate", () => {
    const comfort = getComfort(recap({ champions: [champ("Garen", 20, 0.5), champ("Ahri", 10, 0.8), champ("Lux", 8, 0.25)] }));
    expect(comfort.best).toMatchObject({ id: "Ahri" });
    expect(comfort.best.delta).toBeCloseTo(0.3);
    expect(comfort.worst).toMatchObject({ id: "Lux" });
    expect(comfort.rows.map((r) => r.id)).toEqual(["Garen", "Ahri", "Lux"]);
  });

  it("has no worst pick when nothing costs you wins", () => {
    const comfort = getComfort(recap({ champions: [champ("Ahri", 20, 0.6), champ("Zed", 10, 0.5)] }));
    expect(comfort.worst).toBeNull();
    expect(comfortLine(comfort, (id) => id)).toContain("Ahri lifts you");
  });
});

describe("getGrayScreen", () => {
  it("is null without data and converts seconds to hours and minutes a game", () => {
    expect(getGrayScreen(recap())).toBeNull();
    expect(getGrayScreen(recap({ timeDead: { seconds: 0, share: 0 } }))).toBeNull();
    const result = getGrayScreen(recap({ games: 60, timeDead: { seconds: 7200, share: 0.1 } }));
    expect(result.hours).toBe(2);
    expect(result.perGame).toBeCloseTo(2);
    expect(result.films).toBe(1);
  });
});
