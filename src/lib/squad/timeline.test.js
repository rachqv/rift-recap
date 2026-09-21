import { describe, expect, it } from "vitest";
import { buildFaceOff } from "./faceoff";
import { buildTimelineDuel, EVEN_GOLD } from "./timeline";

// Participant ids in the fake timelines: player A is 1, player B is 6 (the first of the other team).
const PUUIDS = { a: "pa", b: "pb" };
const metadata = { participants: ["pa", "x2", "x3", "x4", "x5", "pb", "y2", "y3", "y4", "y5"] };

/** A timeline with 20 one-minute frames where A and B have the given gold at minute 15 and at the end. */
function timeline({ at15 = [0, 0], end = [10000, 10000], events = [] } = {}) {
  const frames = Array.from({ length: 21 }, (_, minute) => {
    const gold = minute === 15 ? at15 : minute === 20 ? end : [minute * 500, minute * 500];
    return { participantFrames: { 1: { totalGold: gold[0], xp: gold[0] }, 6: { totalGold: gold[1], xp: gold[1] } }, events: [] };
  });
  for (const event of events) frames[Math.floor(event.timestamp / 60000)].events.push(event);
  return { metadata, info: { frames } };
}

const meeting = (matchId, { aWon }) => ({ matchId, a: { teamId: 100, win: aWon }, b: { teamId: 200, win: !aWon } });
const kill = (killerId, victimId, timestamp, assists = []) => ({ type: "CHAMPION_KILL", killerId, victimId, timestamp, assistingParticipantIds: assists });

describe("buildTimelineDuel", () => {
  it("returns null when no meeting has a timeline", () => {
    expect(buildTimelineDuel([meeting("m1", { aWon: true })], new Map(), PUUIDS)).toBeNull();
  });

  it("counts kills on each other and which of them were solo", () => {
    const events = [kill(1, 6, 60000), kill(1, 6, 120000, [2]), kill(6, 1, 180000), kill(1, 7, 200000)]; // the last one isn't between them
    const result = buildTimelineDuel([meeting("m1", { aWon: true })], new Map([["m1", timeline({ events })]]), PUUIDS);
    expect(result.kills).toEqual({ a: 2, b: 1 });
    expect(result.solo).toEqual({ a: 1, b: 1 });
  });

  it("finds who died first and who took the first dragon", () => {
    const events = [
      kill(6, 1, 90000), // A dies at 1:30
      kill(1, 6, 120000),
      { type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", killerTeamId: 200, timestamp: 400000 },
      { type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", killerTeamId: 100, timestamp: 300000 }, // earlier, so this one is first
    ];
    const result = buildTimelineDuel([meeting("m1", { aWon: true })], new Map([["m1", timeline({ events })]]), PUUIDS);
    expect(result.firstDeath).toEqual({ a: 1, b: 0 });
    expect(result.dragons).toEqual({ a: 1, b: 0 }); // A is on team 100
  });

  it("tracks who was ahead at 15 minutes and whether the lead became a win", () => {
    const ms = [meeting("won", { aWon: true }), meeting("thrown", { aWon: false }), meeting("level", { aWon: true })];
    const timelines = new Map([
      ["won", timeline({ at15: [7000, 5000] })], // A ahead by 2000, A wins
      ["thrown", timeline({ at15: [7000, 5000] })], // A ahead by 2000, but B wins: a comeback for B
      ["level", timeline({ at15: [5000 + EVEN_GOLD - 1, 5000] })], // within the even margin
    ]);
    const { early } = buildTimelineDuel(ms, timelines, PUUIDS);
    expect(early.ahead).toEqual({ a: 2, b: 0, even: 1 });
    expect(early.converted.a).toEqual({ ahead: 2, won: 1 });
    expect(early.comebacks).toEqual({ a: 0, b: 1 });
    expect(early.goldDiff).toBeCloseTo((2000 + 2000 + (EVEN_GOLD - 1)) / 3);
  });

  it("builds the gold curve from the latest game, with A's lead as a positive number", () => {
    const ms = [meeting("old", { aWon: true }), meeting("new", { aWon: false })];
    const timelines = new Map([["old", timeline()], ["new", timeline({ end: [8000, 12000] })]]);
    const { curve } = buildTimelineDuel(ms, timelines, PUUIDS);
    expect(curve.aWon).toBe(false);
    expect(curve.points).toHaveLength(21);
    expect(curve.points.at(-1)).toEqual({ minute: 20, diff: -4000 });
  });

  it("skips a game that has no timeline but keeps the others", () => {
    const ms = [meeting("m1", { aWon: true }), meeting("missing", { aWon: true })];
    const result = buildTimelineDuel(ms, new Map([["m1", timeline()]]), PUUIDS);
    expect(result.games).toBe(1);
  });

  it("has no early section when the game ended before the checkpoint", () => {
    const short = { metadata, info: { frames: [{ participantFrames: { 1: { totalGold: 500 }, 6: { totalGold: 500 } }, events: [] }] } };
    const result = buildTimelineDuel([meeting("m1", { aWon: true })], new Map([["m1", short]]), PUUIDS);
    expect(result.early).toBeNull();
  });
});

describe("buildFaceOff with timelines", () => {
  const match = (id, aTeam) => ({
    metadata: { matchId: id },
    info: {
      gameDuration: 1500,
      gameCreation: 1000,
      participants: [
        { puuid: "pa", teamId: aTeam, win: aTeam === 100, kills: 5, deaths: 2, assists: 1, championName: "Ahri", teamPosition: "MIDDLE" },
        { puuid: "pb", teamId: aTeam === 100 ? 200 : 100, win: aTeam !== 100, kills: 1, deaths: 5, assists: 1, championName: "Zed", teamPosition: "MIDDLE" },
      ],
    },
  });

  it("attaches the timeline result, and stays null without one", () => {
    const matches = [match("m1", 100)];
    expect(buildFaceOff(matches, "pa", "pb").timeline).toBeNull();
    const withTimeline = buildFaceOff(matches, "pa", "pb", new Map([["m1", timeline()]]));
    expect(withTimeline.timeline.games).toBe(1);
    expect(withTimeline.wins).toEqual({ a: 1, b: 0 });
  });

  it("ignores games where the two were teammates", () => {
    const together = match("m2", 100);
    together.info.participants[1].teamId = 100;
    expect(buildFaceOff([together], "pa", "pb")).toBeNull();
  });
});
