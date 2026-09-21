import { describe, expect, it } from "vitest";
import { buildRecap } from "./buildRecap";

// One game for player "me", oldest first by `at`.
const game = (at, win, { dead, deaths = 3 } = {}) => ({
  metadata: { matchId: `EUW1_${at}` },
  info: {
    gameCreation: at,
    gameDuration: 1800,
    participants: [
      { puuid: "me", teamId: 100, win, kills: 5, deaths, assists: 5, championName: "Ahri", teamPosition: "MIDDLE", totalTimeSpentDead: dead },
      { puuid: "foe", teamId: 200, win: !win, kills: 3, deaths: 5, assists: 2, championName: "Zed", teamPosition: "MIDDLE" },
    ],
    teams: [],
  },
});

describe("buildRecap: how the next game went", () => {
  it("counts the game after each win and each loss, in the order they were played", () => {
    // Played in the order W W L W L L, so the games after a result are: W->W, W->L, L->W, W->L, L->L.
    const results = [true, true, false, true, false, false];
    const matches = results.map((win, i) => game(i + 1, win)).reverse(); // shuffled input: the recap sorts by time
    const { afterResult } = buildRecap(matches, "me");
    expect(afterResult.win).toEqual({ games: 3, wins: 1 }); // after wins: W (won), L (lost), L (lost)
    expect(afterResult.loss).toEqual({ games: 2, wins: 1 }); // after losses: W (won), L (lost)
  });

  it("has nothing to count with a single game", () => {
    expect(buildRecap([game(1, true)], "me").afterResult).toEqual({ win: { games: 0, wins: 0 }, loss: { games: 0, wins: 0 } });
  });
});

describe("buildRecap: time dead", () => {
  it("adds up the time spent dead and its share of the time in game", () => {
    const { timeDead } = buildRecap([game(1, true, { dead: 120 }), game(2, false, { dead: 240 })], "me");
    expect(timeDead.seconds).toBe(360);
    expect(timeDead.share).toBeCloseTo(360 / 3600);
  });

  it("is null when Riot doesn't send the field", () => {
    expect(buildRecap([game(1, true)], "me").timeDead).toBeNull();
  });

  it("counts a game with the field but no deaths as zero seconds, not missing", () => {
    expect(buildRecap([game(1, true, { dead: 0, deaths: 0 })], "me").timeDead).toEqual({ seconds: 0, share: 0 });
  });
});

describe("buildRecap: pings, spells, surrenders and team role", () => {
  const team = (me, mates) => [
    { puuid: "me", teamId: 100, ...me },
    ...mates.map((m, i) => ({ puuid: `mate${i}`, teamId: 100, ...m })),
    { puuid: "foe", teamId: 200, kills: 1, deaths: 1, assists: 1, championName: "Zed", teamPosition: "MIDDLE", totalDamageDealtToChampions: 500, win: !me.win },
  ];
  const base = { kills: 5, deaths: 3, assists: 5, championName: "Ahri", teamPosition: "MIDDLE" };
  const mate = (damage, deaths = 4) => ({ kills: 3, deaths, assists: 3, championName: "Lux", teamPosition: "TOP", totalDamageDealtToChampions: damage, win: true });
  const match = (at, participants) => ({ metadata: { matchId: `EUW1_${at}` }, info: { gameCreation: at, gameDuration: 1800, participants, teams: [] } });

  it("sums pings by type over the games that report them", () => {
    const withPings = match(1, team({ ...base, win: true, enemyMissingPings: 4, getBackPings: 2 }, []));
    const without = match(2, team({ ...base, win: true }, []));
    const { pings } = buildRecap([withPings, without], "me");
    expect(pings.games).toBe(1);
    expect(pings.byType).toMatchObject({ enemyMissingPings: 4, getBackPings: 2, onMyWayPings: 0 });
    expect(buildRecap([without], "me").pings).toBeNull();
  });

  it("finds the usual spell pair, which key Flash is on and how often it is cast", () => {
    const g = (at, s1, s2, c1, c2) => match(at, team({ ...base, win: true, summoner1Id: s1, summoner2Id: s2, summoner1Casts: c1, summoner2Casts: c2 }, []));
    const { spells } = buildRecap([g(1, 4, 14, 2, 1), g(2, 14, 4, 0, 4), g(3, 4, 14, 3, 0), g(4, 12, 4, 1, 1)], "me");
    expect(spells.games).toBe(4);
    expect(spells.topPair).toEqual({ ids: [4, 14], games: 3 });
    expect(spells.flash.key).toBe("D"); // Flash on D in 2 games and on F in 2: D wins the tie
    expect(spells.flash.perGame).toBeCloseTo((2 + 4 + 3 + 1) / 4);
  });

  it("counts surrenders and who gave up", () => {
    const g = (at, win, ended) => match(at, team({ ...base, win, gameEndedInSurrender: ended }, []));
    const { surrender } = buildRecap([g(1, true, true), g(2, false, true), g(3, true, false), g(4, false, false)], "me");
    expect(surrender).toEqual({ known: 4, ended: 2, enemyQuit: 1 });
  });

  it("compares you with your own team in wins and losses", () => {
    const lossTop = match(1, team({ ...base, win: false, deaths: 2, totalDamageDealtToChampions: 4000 }, [mate(2000, 6), mate(2000, 6), mate(2000, 6)]));
    const lossLow = match(2, team({ ...base, win: false, deaths: 8, totalDamageDealtToChampions: 1000 }, [mate(3000, 2), mate(3000, 2), mate(3000, 2)]));
    const { blame } = buildRecap([lossTop, lossLow], "me");
    expect(blame.win).toBeNull();
    expect(blame.loss.games).toBe(2);
    expect(blame.loss.top).toBe(1);
    expect(blame.loss.rank).toBeCloseTo((1 + 4) / 2);
    expect(blame.loss.damageShare).toBeCloseTo((4000 / 10000 + 1000 / 10000) / 2);
    expect(blame.loss.deathShare).toBeCloseTo((2 / 20 + 8 / 14) / 2);
  });

  it("has no team comparison without teammates' damage", () => {
    expect(buildRecap([match(1, team({ ...base, win: false }, []))], "me").blame).toBeNull();
  });

  it("tracks the most kills in a game", () => {
    expect(buildRecap([match(1, team({ ...base, win: true, kills: 17 }, [])), match(2, team({ ...base, win: true, kills: 9 }, []))], "me").mostKills).toBe(17);
  });
});

describe("buildRecap: results and when they happened", () => {
  it("lists each game's result and time in the order played, whatever order the matches come in", () => {
    const played = [[10, true], [20, false], [30, true]];
    const { results, resultTimes } = buildRecap([...played].reverse().map(([at, win]) => game(at, win)), "me");
    expect(results).toEqual([true, false, true]);
    expect(resultTimes).toEqual([10, 20, 30]);
  });
});

describe("buildRecap: patches", () => {
  const onPatch = (at, win, gameVersion) => {
    const base = game(at, win);
    return { ...base, info: { ...base.info, gameVersion } };
  };

  it("counts games and wins on each patch, oldest patch first (14.10 comes after 14.3, not before)", () => {
    const { patches } = buildRecap(
      [onPatch(1, true, "14.10.556.7432"), onPatch(2, false, "14.3.100.1"), onPatch(3, true, "14.3.101.2"), onPatch(4, false, "14.10.9.9")],
      "me",
    );
    expect(patches).toEqual([
      { patch: "14.3", major: 14, minor: 3, games: 2, wins: 1 },
      { patch: "14.10", major: 14, minor: 10, games: 2, wins: 1 },
    ]);
  });

  it("leaves out games that don't say which patch they were on", () => {
    const { patches } = buildRecap([onPatch(1, true, "14.3.1.1"), game(2, true), onPatch(3, true, "not a version")], "me");
    expect(patches).toEqual([{ patch: "14.3", major: 14, minor: 3, games: 1, wins: 1 }]);
    expect(buildRecap([game(1, true)], "me").patches).toEqual([]);
  });
});

describe("buildRecap: keystones", () => {
  const withKeystone = (at, win, perk) => {
    const base = game(at, win);
    const [me, ...rest] = base.info.participants;
    return { ...base, info: { ...base.info, participants: [{ ...me, perks: perk == null ? undefined : { styles: [{ style: 8100, selections: [{ perk }, { perk: 8139 }] }, { style: 8000, selections: [{ perk: 9111 }] }] } }, ...rest] } };
  };

  it("counts games and wins with the first rune of the first tree, most played first", () => {
    const { keystones } = buildRecap(
      [withKeystone(1, true, 8112), withKeystone(2, false, 8010), withKeystone(3, true, 8010), withKeystone(4, true, 8010), withKeystone(5, false, 8112)],
      "me",
    );
    expect(keystones).toEqual([
      { id: 8010, games: 3, wins: 2 },
      { id: 8112, games: 2, wins: 1 },
    ]);
  });

  it("leaves out games with no rune data", () => {
    const { keystones } = buildRecap([withKeystone(1, true, 8112), withKeystone(2, true, undefined), game(3, true)], "me");
    expect(keystones).toEqual([{ id: 8112, games: 1, wins: 1 }]);
    expect(buildRecap([game(1, true)], "me").keystones).toEqual([]);
  });
});
