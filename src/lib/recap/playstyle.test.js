import { describe, expect, it } from "vitest";
import { buildRecap } from "./buildRecap";
import { buildEarlyGame } from "./early";
import { chunkGames, getPersonaChapters } from "./chapters";
import { getOldFlames } from "./mastery";
import { getDamageProfile, getGoldHabits, getHighlights, getLaneCheck, getTeamComp } from "./playstyle";
import { rangeLinks, splitAt, withRange } from "./range";
import { getSessions } from "./sessions";
import { bestCombos } from "../squad/combos";

const MIN = 60000;
const HOUR = 60 * MIN;

describe("getDamageProfile", () => {
  const dmg = (physical, magic, tru = 0, games = 20) => ({ damageTypes: { games, physical, magic, true: tru } });

  it("needs enough games and some damage", () => {
    expect(getDamageProfile(dmg(1, 1, 0, 3))).toBeNull();
    expect(getDamageProfile({})).toBeNull();
    expect(getDamageProfile(dmg(0, 0))).toBeNull();
  });

  it("names the mix and the shares add up to one", () => {
    const mage = getDamageProfile(dmg(300, 700));
    expect(mage.style).toBe("The Spellslinger");
    expect(Object.values(mage.shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(getDamageProfile(dmg(800, 200)).style).toBe("Steel over spells");
    expect(getDamageProfile(dmg(500, 350, 150)).style).toBe("True damage enthusiast");
    expect(getDamageProfile(dmg(550, 400, 50)).style).toBe("The mixed threat");
  });
});

describe("getLaneCheck and getGoldHabits", () => {
  it("averages the differences per game and reads the ahead rate", () => {
    const lane = getLaneCheck({ lane: { games: 10, cs: 100, gold: 5000, damage: -2000, kills: 5, ahead: 7 } });
    expect(lane).toMatchObject({ games: 10, cs: 10, gold: 500, damage: -200, kills: 0.5, aheadRate: 0.7 });
    expect(lane.line).toMatch(/Lane bully/);
    expect(getLaneCheck({ lane: { games: 10, cs: 0, gold: 0, damage: 0, kills: 0, ahead: 2 } }).line).toMatch(/out-earns you/);
    expect(getLaneCheck({ lane: { games: 3, cs: 0, gold: 0, damage: 0, kills: 0, ahead: 3 } })).toBeNull();
  });

  it("reports unspent gold per game", () => {
    expect(getGoldHabits({ gold: { games: 10, unspent: 12000 } }).unspent).toBe(1200);
    expect(getGoldHabits({ gold: { games: 10, unspent: 12000 } }).line).toMatch(/1,200 gold unspent/);
    expect(getGoldHabits({ gold: { games: 2, unspent: 100 } })).toBeNull();
  });
});

describe("getTeamComp", () => {
  const tags = { Malphite: ["Tank"], Jinx: ["Marksman"], Ahri: ["Mage"] };
  const tagsOf = (id) => tags[id];
  // 10 games with a tank on the team (all won) and 10 without (all lost)
  const game = (win, mate) => ({ win, mates: [mate], foes: [] });
  const teamGames = [...Array.from({ length: 10 }, () => game(true, "Malphite")), ...Array.from({ length: 10 }, () => game(false, "Ahri"))];

  it("finds a class that changes the win rate", () => {
    const comp = getTeamComp({ teamGames }, tagsOf);
    expect(comp.facts[0]).toMatchObject({ label: "Tank", withRate: 1, withoutRate: 0 });
    expect(comp.line).toMatch(/With a tank on your team you win 100%/);
  });

  it("says nothing with too few games or too small a gap", () => {
    expect(getTeamComp({ teamGames: teamGames.slice(0, 5) }, tagsOf)).toBeNull();
    const flat = Array.from({ length: 24 }, (_, i) => game(i % 2 === 0, i < 12 ? "Malphite" : "Ahri"));
    expect(getTeamComp({ teamGames: flat }, tagsOf)).toBeNull();
  });
});

describe("getHighlights", () => {
  const g = (at, kills = 5) => ({ champion: "Ahri", kills, deaths: 1, assists: 2, at, win: true });

  it("lists distinct games and needs at least two", () => {
    const list = getHighlights({ pentaGame: g(1, 12), bestGame: g(2, 8), longestGame: { ...g(3), seconds: 2800 } });
    expect(list.map((x) => x.kind)).toEqual(["Pentakill", "Best KDA", "Longest game"]);
    expect(getHighlights({ pentaGame: g(1), bestGame: g(1), longestGame: null })).toBeNull(); // the same game, once
  });

  it("falls back to the most kills when there was no pentakill", () => {
    expect(getHighlights({ killGame: g(1, 12), bestGame: g(2) })[0].kind).toBe("Most kills");
    expect(getHighlights({ killGame: g(1, 5), bestGame: g(2) })).toBeNull(); // 5 kills is not a highlight
  });
});

describe("getSessions", () => {
  const at = (hours, win) => ({ t: hours * HOUR, win });

  it("groups games less than 90 minutes apart into one sitting", () => {
    // sitting 1: three wins in a row; sitting 2 (a day later): two losses and a win; sitting 3: three losses
    const activity = [at(0, true), at(1, true), at(2, true), at(24, false), at(25, false), at(26, true), at(50, false), at(51, false), at(52, false)];
    const s = getSessions(activity);
    expect(s.sessions).toBe(3);
    expect(s.best).toMatchObject({ games: 3, wins: 3, losses: 0 });
    expect(s.worst).toMatchObject({ wins: 0, losses: 3 });
    expect(s.avgGames).toBe(3);
  });

  it("needs enough sittings, and returns null for none", () => {
    expect(getSessions([])).toBeNull();
    expect(getSessions([at(0, true), at(1, true), at(2, true), at(3, true)])).toBeNull(); // one long sitting
  });

  it("does not depend on the order it is given", () => {
    const activity = [at(0, true), at(1, true), at(2, true), at(30, false), at(31, false), at(32, false), at(60, true), at(61, true), at(62, false)];
    expect(getSessions([...activity].reverse())).toEqual(getSessions(activity));
  });
});

describe("buildEarlyGame", () => {
  const frames = (mine, theirs) => ({ frames: Array.from({ length: 20 }, (_, m) => ({ participantFrames: { 1: { totalGold: m === 15 ? mine : 0 }, 6: { totalGold: m === 15 ? theirs : 0 } } })) });
  const game = (id, win) => ({
    metadata: { matchId: id },
    info: { participants: [{ puuid: "me", teamId: 100, teamPosition: "MIDDLE", win }, { puuid: "foe", teamId: 200, teamPosition: "MIDDLE", win: !win }] },
  });
  const timeline = (mine, theirs) => ({ metadata: { participants: ["me", "a", "b", "c", "d", "foe"] }, info: frames(mine, theirs) });

  it("counts ahead, behind and level at 15 minutes, and the wins from each", () => {
    const matches = [game("1", true), game("2", true), game("3", false), game("4", true), game("5", false), game("6", true)];
    const timelines = new Map([
      ["1", timeline(6000, 4000)], ["2", timeline(6000, 4000)], ["3", timeline(6000, 4000)], // ahead x3 (2 wins)
      ["4", timeline(4000, 6000)], ["5", timeline(4000, 6000)], // behind x2 (1 win)
      ["6", timeline(5000, 5050)], // level
    ]);
    const r = buildEarlyGame(matches, timelines, "me");
    expect(r).toMatchObject({ games: 6, ahead: 3, behind: 2, even: 1, winsAhead: 2, winsBehind: 1 });
  });

  it("needs five games and skips games without a timeline or a lane opponent", () => {
    expect(buildEarlyGame([game("1", true)], new Map([["1", timeline(1, 2)]]), "me")).toBeNull();
    expect(buildEarlyGame([game("1", true)], new Map(), "me")).toBeNull();
  });
});

describe("getOldFlames", () => {
  const recap = { champions: [{ id: "Ahri", games: 20 }, { id: "Zed", games: 1 }] };
  const keyToId = { 103: "Ahri", 238: "Zed", 157: "Yasuo" };
  const entry = (championId, championPoints) => ({ championId, championLevel: 6, championPoints, lastPlayTime: 0 });

  it("keeps high-mastery champions you barely played, biggest first", () => {
    const flames = getOldFlames([entry(103, 500000), entry(238, 90000), entry(157, 200000)], recap, keyToId);
    expect(flames.map((f) => f.id)).toEqual(["Yasuo", "Zed"]); // Ahri is played a lot; Yasuo not at all
    expect(flames[0].games).toBe(0);
    expect(flames[1].games).toBe(1);
  });

  it("drops low mastery and unknown champions, and returns null with nothing", () => {
    expect(getOldFlames([entry(157, 5000), entry(9999, 900000)], recap, keyToId)).toBeNull();
    expect(getOldFlames(null, recap, keyToId)).toBeNull();
  });
});

describe("persona chapters", () => {
  const rift = (t, win, champion = "Ahri") => ({
    metadata: { matchId: `EUW1_${t}` },
    info: {
      gameMode: "CLASSIC",
      gameDuration: 1800,
      gameCreation: t,
      participants: [{ puuid: "me", teamId: 100, win, kills: 5, deaths: 3, assists: 5, championName: champion, teamPosition: "MIDDLE" }],
      teams: [],
    },
  });
  const month = (m) => Date.UTC(2026, m, 10);
  const games = (m, n, champion) => Array.from({ length: n }, (_, i) => rift(month(m) + i * HOUR, i % 2 === 0, champion));
  const names = { nameOf: (id) => id, tagsOf: () => undefined };

  it("splits by month, merging a small month into the one after it", () => {
    const wrapped = games(0, 20).concat(games(1, 4), games(2, 20));
    const chunks = chunkGames(wrapped.sort((a, b) => a.info.gameCreation - b.info.gameCreation));
    expect(chunks.map((c) => c.games.length)).toEqual([20, 24]); // February's 4 games joined March
  });

  it("cuts a single month into equal parts", () => {
    const chunks = chunkGames(games(3, 60));
    expect(chunks).toHaveLength(4);
    expect(chunks.map((c) => c.label)).toEqual(["Part 1", "Part 2", "Part 3", "Part 4"]);
  });

  it("gives each chapter its own archetype, and needs enough games", () => {
    const matches = [...games(0, 20, "Ahri"), ...games(1, 20, "Zed")];
    const chapters = getPersonaChapters(matches, "me", names);
    expect(chapters).toHaveLength(2);
    expect(chapters.map((c) => c.label)).toEqual(["Jan", "Feb"]);
    expect(chapters.every((c) => c.persona.title && c.games === 20)).toBe(true);
    expect(getPersonaChapters(games(0, 20), "me", names)).toBeNull();
  });
});

describe("bestCombos", () => {
  const member = (puuid) => ({ puuid });
  const p = (puuid, teamId, win) => ({ puuid, teamId, win });
  const game = (id, participants) => ({ metadata: { matchId: id }, info: { gameDuration: 1800, gameCreation: 1, participants } });
  const members = ["a", "b", "c", "d"].map(member);

  it("ranks duos and trios by shrunk win rate, ignoring combos with few games", () => {
    // a+b+c win 5 of 5 together; a+d lose 4 of 4; b+d only ever played 2 games
    const matches = [
      ...Array.from({ length: 5 }, (_, i) => game(`w${i}`, [p("a", 100, true), p("b", 100, true), p("c", 100, true)])),
      ...Array.from({ length: 4 }, (_, i) => game(`l${i}`, [p("a", 100, false), p("d", 100, false)])),
      ...Array.from({ length: 2 }, (_, i) => game(`x${i}`, [p("b", 100, true), p("d", 100, true)])),
    ];
    const { duos, trios, pick } = bestCombos(matches, members);
    expect(trios).toHaveLength(1);
    expect(trios[0]).toMatchObject({ members: [0, 1, 2], games: 5, wins: 5 });
    expect(duos.find((d) => d.members.join() === "1,3")).toBeUndefined(); // 2 games: not ranked
    expect(duos.at(-1).members).toEqual([0, 3]); // the losing duo is last
    expect(pick.members).toEqual([0, 1, 2]);
  });

  it("does not count players who were on opposite teams", () => {
    const matches = Array.from({ length: 6 }, (_, i) => game(`g${i}`, [p("a", 100, true), p("b", 200, false)]));
    expect(bestCombos(matches, members).pick).toBeNull();
  });
});

describe("range switch", () => {
  it("builds a link per range, keeps other parameters and drops since", () => {
    const links = rangeLinks("/squad", [["region", "na1"], ["p", "A#B"], ["since", "x"], ["range", "30d"]], "30d");
    expect(links.map((l) => l.key)).toEqual(["season", "90d", "30d", "7d"]);
    expect(links[0].href).toBe("/squad?region=na1&p=A%23B");
    expect(links[2].href).toBe("/squad?region=na1&p=A%23B&range=30d");
    expect(links.filter((l) => l.current).map((l) => l.key)).toEqual(["30d"]);
    expect(links[3].href).toBe("/squad?region=na1&p=A%23B&range=7d");
  });

  it("has a week range with the week before it to compare with, and no other range does", async () => {
    const { RANGES, rangeOf } = await import("./config");
    expect(rangeOf("7d")).toBe("7d");
    expect(RANGES["7d"].since().getTime() - RANGES["7d"].previous().getTime()).toBe(7 * 86400000);
    expect(Object.keys(RANGES).filter((key) => RANGES[key].previous)).toEqual(["7d"]);
  });

  it("splits games at a moment, keeping their order", () => {
    const match = (at) => ({ info: { gameCreation: at } });
    const { current, earlier } = splitAt([match(1), match(5), match(9), match(10)], new Date(9));
    expect(current.map((m) => m.info.gameCreation)).toEqual([9, 10]); // a game exactly at the moment is current
    expect(earlier.map((m) => m.info.gameCreation)).toEqual([1, 5]);
  });

  it("leaves the season link clean and adds range to card paths", () => {
    expect(rangeLinks("/recap/na1/A/B", [], "season")[0].href).toBe("/recap/na1/A/B");
    expect(withRange("/x/card", "season")).toBe("/x/card");
    expect(withRange("/x/card", "90d")).toBe("/x/card?range=90d");
    expect(withRange("/x/card?a=1", "30d")).toBe("/x/card?a=1&range=30d");
  });
});

describe("buildRecap: new fields", () => {
  const match = (t, me, foe) => ({
    metadata: { matchId: `EUW1_${t}` },
    info: {
      gameCreation: t,
      gameDuration: 1800,
      participants: [
        { puuid: "me", teamId: 100, teamPosition: "MIDDLE", championName: "Ahri", kills: 5, deaths: 2, assists: 3, win: true, ...me },
        { puuid: "foe", teamId: 200, teamPosition: "MIDDLE", championName: "Zed", kills: 2, deaths: 5, assists: 1, win: false, ...foe },
      ],
      teams: [],
    },
  });

  it("sums damage types, gold left over and the lane difference", () => {
    const recap = buildRecap(
      [
        match(1, { physicalDamageDealtToChampions: 100, magicDamageDealtToChampions: 300, trueDamageDealtToChampions: 20, goldEarned: 10000, goldSpent: 9600, totalMinionsKilled: 200, totalDamageDealtToChampions: 420 }, { goldEarned: 9000, totalMinionsKilled: 150, totalDamageDealtToChampions: 300 }),
      ],
      "me",
    );
    expect(recap.damageTypes).toEqual({ games: 1, physical: 100, magic: 300, true: 20 });
    expect(recap.gold).toEqual({ games: 1, unspent: 900 }); // 10000 earned + 500 starting - 9600 spent
    expect(recap.lane).toMatchObject({ games: 1, cs: 50, gold: 1000, damage: 120, kills: 3, ahead: 1 });
  });

  it("leaves them null when Riot doesn't send the fields, and dates the memorable games", () => {
    const recap = buildRecap([match(5000, { pentaKills: 1 })], "me");
    expect(recap.damageTypes).toBeNull();
    expect(recap.gold).toBeNull();
    expect(recap.lane).toBeNull();
    expect(recap.pentaGame).toMatchObject({ champion: "Ahri", at: 5000 });
    expect(recap.bestGame.at).toBe(5000);
    expect(recap.longestGame.at).toBe(5000);
  });

  it("records each game's team and the enemy champions for team-comp reads", () => {
    const recap = buildRecap([match(1, {}, {})], "me");
    expect(recap.teamGames).toEqual([]); // no teammates in this fixture
  });
});

describe("time ranges start on a day boundary", () => {
  it("keeps the same start all day, so the Riot request (and its cache entry) doesn't change every second", async () => {
    const { vi } = await import("vitest");
    const { RANGES } = await import("./config");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-20T00:00:05Z"));
      const morning = RANGES["30d"].since().getTime();
      vi.setSystemTime(new Date("2026-09-20T23:59:59Z"));
      const night = RANGES["30d"].since().getTime();
      expect(night).toBe(morning);
      expect(new Date(morning).toISOString()).toBe("2026-08-21T00:00:00.000Z"); // midnight UTC, 30 days before the 20th

      vi.setSystemTime(new Date("2026-09-21T00:00:01Z")); // a new day moves it by one day
      expect(RANGES["30d"].since().getTime() - morning).toBe(86400000);
      expect(RANGES["90d"].since().toISOString()).toBe("2026-06-23T00:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});
