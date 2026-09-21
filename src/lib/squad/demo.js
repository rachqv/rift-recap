import { seededRandom } from "@/lib/random";
import { buildRecapSet } from "@/lib/recap/modes";
import { buildSquadStats } from "./build";
import { buildFaceOff, findMeetings } from "./faceoff";
import { buildCarry } from "./synergy";

// A made-up squad of five friends, for previewing the squad and head-to-head pages without a Riot API key.
// Each has a signature tendency, so the awards have something to tell them apart.
const CREW = [
  { puuid: "crew-0", gameName: "IronWall", tagLine: "TOP", icon: 3, role: "TOP", flash: 2.4, champs: ["Ornn", "Malphite", "Sion", "Shen"],
    kills: [3, 1.5], deaths: [7.6, 2], assists: [8, 3], dmg: 520, taken: 1500, cs: 6.4, vision: 0.8, cc: 34, pings: 6, steal: 0, obj: 250, turrets: [2.4, 1], kp: 0.52 },
  { puuid: "crew-1", gameName: "Snatchy", tagLine: "JGL", icon: 21, role: "JUNGLE", flash: 3.1, champs: ["Graves", "Kayn", "Viego", "Elise"],
    kills: [6, 2], deaths: [5, 2], assists: [8, 3], dmg: 610, taken: 800, cs: 5.2, vision: 1.1, cc: 18, pings: 9, steal: 0.22, obj: 650, turrets: [0.8, 0.8], kp: 0.66 },
  { puuid: "crew-2", gameName: "MidDiff", tagLine: "MID", icon: 12, role: "MIDDLE", flash: 4.3, champs: ["Ahri", "Syndra", "Zed", "Viktor"],
    kills: [9, 2.5], deaths: [4, 1.5], assists: [6, 2.5], dmg: 800, taken: 650, cs: 8.2, vision: 0.9, cc: 12, pings: 12, steal: 0, obj: 300, turrets: [1.6, 1], kp: 0.6 },
  { puuid: "crew-3", gameName: "PingPong", tagLine: "ADC", icon: 5, role: "BOTTOM", flash: 5.2, champs: ["Jinx", "Kaisa", "Ashe", "Jhin"],
    kills: [7, 2.5], deaths: [5, 2], assists: [6, 2.5], dmg: 720, taken: 600, cs: 8.6, vision: 0.8, cc: 8, pings: 46, steal: 0, obj: 380, turrets: [2, 1], kp: 0.58 },
  { puuid: "crew-4", gameName: "Wardy", tagLine: "SUP", icon: 15, role: "UTILITY", flash: 2.9, champs: ["Thresh", "Lulu", "Nami", "Leona"],
    kills: [1.5, 1.2], deaths: [5, 2], assists: [17, 4], dmg: 300, taken: 720, cs: 1.3, vision: 2.9, cc: 52, pings: 15, steal: 0, obj: 120, turrets: [0.5, 0.6], kp: 0.74 },
];

const FOE_CHAMPIONS = ["Darius", "Lee Sin", "Lux", "Vayne", "Leona", "Fizz", "Yasuo", "Ezreal", "Nautilus", "Zyra", "Riven", "Sett"].map((c) => c.replace(" ", ""));
const DAY = 86400000;
const GAMES = 34;

const clamp = (x, low, high) => Math.min(high, Math.max(low, x));

function teamObjectives(rand, won) {
  const count = (winnerMean, loserMean) => Math.max(0, Math.round((won ? winnerMean : loserMean) + (rand() + rand() - 1) * 1.4));
  return {
    dragon: { kills: count(2.6, 1.2), first: rand() < (won ? 0.68 : 0.32) },
    baron: { kills: count(0.9, 0.2), first: rand() < (won ? 0.55 : 0.2) },
    riftHerald: { kills: count(1.2, 0.6), first: rand() < (won ? 0.62 : 0.38) },
    horde: { kills: count(2.6, 1.4) },
    tower: { kills: count(8, 3), first: rand() < (won ? 0.7 : 0.3) },
    inhibitor: { kills: count(1.8, 0.3) },
  };
}

/** The demo squad's games, shaped like a loaded squad: `{ region, members, matches, sharedFound, scanned }`. */
export function getDemoSquad() {
  const rand = seededRandom("demo-squad");
  // The fields the head-to-head scenarios read (gold, wards, Flash, sprees...) come from their own generator, so adding
  // or tuning them never changes the numbers the squad awards are built from.
  const extra = seededRandom("demo-squad-extras");
  const around = ([mean, spread]) => Math.max(0, Math.round(mean + (rand() + rand() - 1) * spread * 1.6));
  const now = Date.now();

  // What the head-to-head scenarios read beyond the squad awards: gold, wards, Flash, sprees and big moments.
  const extras = (c, { minutes, kills, deaths, surrendered }) => {
    const support = c.role === "UTILITY";
    return {
      goldEarned: Math.round(minutes * (260 + c.cs * 32 + c.kills[0] * 8) * (0.9 + extra() * 0.2)),
      summoner1Id: 4, // Flash
      summoner1Casts: Math.round(c.flash * (0.6 + extra() * 0.8)),
      summoner2Id: c.role === "JUNGLE" ? 11 : 14, // Smite, Ignite
      summoner2Casts: 1,
      wardsKilled: Math.round(c.vision * 3 * (0.6 + extra() * 0.8)),
      detectorWardsPlaced: Math.round(c.vision * 2.2 * (0.6 + extra() * 0.8)),
      totalHealsOnTeammates: Math.round(support ? 6000 * (0.5 + extra()) : 300 * extra()),
      totalDamageShieldedOnTeammates: support ? Math.round(2500 * extra()) : 0,
      largestKillingSpree: Math.round(kills * 0.5 * (0.3 + extra())),
      largestCriticalStrike: Math.round((200 + c.dmg * 0.5) * (0.6 + extra() * 0.8)),
      longestTimeSpentLiving: Math.round(((minutes * 60) / (1 + deaths * 0.2)) * (0.45 + extra() * 0.4)),
      gameEndedInSurrender: surrendered,
      pentaKills: kills >= 5 && extra() < c.kills[0] * 0.004 ? 1 : 0,
      quadraKills: kills >= 4 && extra() < 0.03 ? 1 : 0,
      dragonKills: extra() < c.obj / 1600 ? 1 : 0,
      baronKills: extra() < c.obj / 6000 ? 1 : 0,
    };
  };

  const matches = Array.from({ length: GAMES }, (_, i) => {
    const minutes = 22 + rand() * 16;
    const win = rand() < 0.58;
    // Set on everyone in the game; on the losing side it means their team gave up.
    const surrendered = !win && extra() < 0.4;

    // Now and then one of the five sits a game out and a random ally takes the slot, so pairs have different records.
    const absent = rand() < 0.35 ? Math.floor(rand() * CREW.length) : -1;

    const crew = CREW.map((c, slot) => {
      if (slot === absent) {
        return {
          puuid: `ally-${i}`,
          riotIdGameName: `Ally${i}`,
          riotIdTagline: "EUW",
          profileIcon: 2,
          teamId: 100,
          win,
          teamPosition: c.role,
          championName: FOE_CHAMPIONS[Math.floor(rand() * FOE_CHAMPIONS.length)],
          kills: 4,
          deaths: 4,
          assists: 6,
          gameEndedInSurrender: surrendered,
        };
      }
      const kills = around(c.kills);
      const deaths = around(c.deaths);
      const pings = Math.round(c.pings * (0.7 + rand() * 0.6));
      return {
        puuid: c.puuid,
        riotIdGameName: c.gameName,
        riotIdTagline: c.tagLine,
        profileIcon: c.icon,
        teamId: 100,
        win,
        teamPosition: c.role,
        championName: c.champs[Math.floor(rand() * c.champs.length)],
        kills,
        deaths,
        assists: around(c.assists),
        totalMinionsKilled: Math.round(c.cs * minutes * (0.9 + rand() * 0.2)),
        neutralMinionsKilled: 0,
        visionScore: Math.round(c.vision * minutes * (0.8 + rand() * 0.4)),
        totalDamageDealtToChampions: Math.round(c.dmg * minutes * (0.85 + rand() * 0.3)),
        totalDamageTaken: Math.round(c.taken * minutes * (0.85 + rand() * 0.3)),
        timeCCingOthers: Math.round(c.cc * (0.7 + rand() * 0.6)),
        totalTimeSpentDead: Math.round(deaths * (15 + minutes * 0.9)),
        getBackPings: Math.round(pings * 0.6),
        onMyWayPings: Math.round(pings * 0.2),
        enemyMissingPings: pings - Math.round(pings * 0.6) - Math.round(pings * 0.2),
        objectivesStolen: rand() < c.steal ? 1 : 0,
        damageDealtToObjectives: Math.round(c.obj * minutes * (0.7 + rand() * 0.6)),
        turretTakedowns: around(c.turrets),
        firstBloodKill: rand() < 0.07,
        pentaKills: 0,
        quadraKills: 0,
        tripleKills: rand() < 0.08 ? 1 : 0,
        challenges: {
          killParticipation: clamp(c.kp + (rand() - 0.5) * 0.2, 0.2, 0.95),
          soloKills: Math.round(c.kills[0] * 0.3 * extra() * 2),
          skillshotsDodged: Math.round(3 + c.kills[0] * 0.7 * (0.5 + extra())),
          teamDamagePercentage: clamp((c.dmg / 2950) * (0.85 + extra() * 0.3), 0.03, 0.5),
        },
        ...extras(c, { minutes, kills, deaths, win, surrendered }),
      };
    });

    const foes = Array.from({ length: 5 }, (_, slot) => ({
      puuid: `foe-${i}-${slot}`,
      riotIdGameName: `Foe${i}x${slot}`,
      riotIdTagline: "EUW",
      profileIcon: 1,
      teamId: 200,
      win: !win,
      teamPosition: CREW[slot].role,
      championName: FOE_CHAMPIONS[Math.floor(rand() * FOE_CHAMPIONS.length)],
      kills: 4,
      deaths: 4,
      assists: 6,
      gameEndedInSurrender: surrendered,
    }));

    return {
      metadata: { matchId: `EUW1_${7412000000 + i * 17}` },
      info: {
        gameCreation: now - (GAMES - i) * 1.7 * DAY - rand() * 3 * 3600000,
        gameDuration: Math.round(minutes * 60),
        queueId: 420,
        gameMode: "CLASSIC",
        participants: [...crew, ...foes],
        teams: [
          { teamId: 100, win, objectives: teamObjectives(rand, win) },
          { teamId: 200, win: !win, objectives: teamObjectives(rand, !win) },
        ],
      },
    };
  });

  return {
    region: "euw1",
    members: CREW.map((c) => ({ puuid: c.puuid, gameName: c.gameName, tagLine: c.tagLine, profileIcon: c.icon })),
    // A few games where friends ended up on opposite teams, so there are rivalries to show.
    matches: matches.map((match, i) =>
      i % 7 === 3 ? asRivals(match, CREW[0], CREW[1]) : i % 9 === 5 ? asRivals(match, CREW[1], CREW[3]) : i % 11 === 4 ? asRivals(match, CREW[2], CREW[4]) : match,
    ),
    sharedFound: GAMES,
    scanned: 100,
  };
}

const RANKS = {
  "crew-2": { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 47, wins: 88, losses: 71 },
  "crew-3": { queueType: "RANKED_SOLO_5x5", tier: "PLATINUM", rank: "I", leaguePoints: 12, wins: 64, losses: 49 },
};

/**
 * A copy of the game where `b` faces `a` instead of playing with them: `b` crosses over to the enemy team, into `a`'s
 * lane, and the enemy who held that lane takes `b`'s old spot. Results follow the teams, so nobody's record breaks.
 * Games where either of them sat out (an ally took their slot) are returned as they are.
 */
function asRivals(match, a, b) {
  const participants = match.info.participants.map((p) => ({ ...p }));
  const [pa, pb] = [a, b].map((member) => participants.find((p) => p.puuid === member.puuid));
  const foe = pa && participants.find((p) => p.teamId !== pa.teamId && p.teamPosition === pa.teamPosition);
  if (!pa || !pb || !foe) return match;

  Object.assign(foe, { teamId: pb.teamId, teamPosition: pb.teamPosition, win: pb.win });
  Object.assign(pb, { teamId: pa.teamId === 100 ? 200 : 100, teamPosition: pa.teamPosition, win: !pa.win });
  return { ...match, info: { ...match.info, participants } };
}

/**
 * A made-up match timeline for the demo, shaped like Riot's: one frame a minute with each player's gold and XP, and the
 * kills `a` and `b` got on each other. Gold follows each player's end-of-game total; the rest is dressing.
 */
function demoTimeline(match, a, b) {
  const { participants, gameDuration } = match.info;
  const rand = seededRandom(match.metadata.matchId);
  const minutes = Math.floor(gameDuration / 60);
  // Each player's gold drifts around the smooth curve, more so mid-game, so the lead swings back and forth like a real one.
  const waves = participants.map(() => ({ phase: rand() * 6, size: 300 + rand() * 900, speed: 3 + rand() * 4 }));
  const frames = Array.from({ length: minutes + 1 }, (_, m) => {
    const progress = m / minutes;
    const participantFrames = {};
    participants.forEach((p, i) => {
      const earned = p.goldEarned ?? 11000 + (p.kills ?? 0) * 250;
      const wave = Math.sin(waves[i].phase + progress * waves[i].speed) * waves[i].size * Math.sin(progress * Math.PI);
      participantFrames[i + 1] = { totalGold: Math.max(500, Math.round(500 + (earned - 500) * progress ** 1.15 + wave)), xp: Math.round(19000 * progress ** 0.9) };
    });
    return { participantFrames, events: [] };
  });

  const id = (member) => participants.findIndex((p) => p.puuid === member.puuid) + 1;
  for (const [killer, victim] of [[a, b], [b, a]]) {
    const [pk, pv] = [participants[id(killer) - 1], participants[id(victim) - 1]];
    const count = Math.round(Math.min(pk.kills, pv.deaths) * 0.3 + rand());
    for (let k = 0; k < count; k++) {
      const minute = 2 + Math.floor(rand() * (minutes - 2));
      frames[minute].events.push({
        type: "CHAMPION_KILL",
        timestamp: minute * 60000,
        killerId: id(killer),
        victimId: id(victim),
        assistingParticipantIds: rand() < 0.45 ? [] : [id(killer) === 1 ? 2 : 1],
      });
    }
  }
  // Two or three dragons a game, more often to the side that won.
  const winningTeam = participants[id(a) - 1].win ? participants[id(a) - 1].teamId : participants[id(b) - 1].teamId;
  const losingTeam = winningTeam === 100 ? 200 : 100;
  const dragonCount = 2 + Math.floor(rand() * 2);
  for (let k = 0; k < dragonCount; k++) {
    const minute = Math.min(minutes, 6 + k * 5 + Math.floor(rand() * 3));
    frames[minute].events.push({ type: "ELITE_MONSTER_KILL", monsterType: "DRAGON", timestamp: minute * 60000 + 500, killerTeamId: rand() < 0.65 ? winningTeam : losingTeam });
  }
  for (const frame of frames) frame.events.sort((x, y) => x.timestamp - y.timestamp);
  return { metadata: { participants: participants.map((p) => p.puuid) }, info: { frameInterval: 60000, frames } };
}

/**
 * Head-to-head between the squad's mid and bot laners, on the games they share, including a few where they were on
 * opposite teams. Shaped like `loadVersus`. (Every demo game is a shared one, so there is no "apart" record to build synergy from.)
 */
export function getDemoVersus() {
  const squad = getDemoSquad();
  const [a, b] = [squad.members[2], squad.members[3]];
  const matches = squad.matches.map((match, i) => (i % 6 === 2 ? asRivals(match, a, b) : match));
  const matchIds = matches.map((m) => m.metadata.matchId);

  const meetingIds = new Set(findMeetings(matches, a.puuid, b.puuid).map((m) => m.matchId));
  const timelines = new Map(matches.filter((m) => meetingIds.has(m.metadata.matchId)).map((m) => [m.metadata.matchId, demoTimeline(m, a, b)]));

  const load = (member, level) => ({
    region: squad.region,
    account: { puuid: member.puuid, gameName: member.gameName, tagLine: member.tagLine },
    summoner: { profileIconId: member.profileIcon, summonerLevel: level },
    rankedEntries: RANKS[member.puuid] ? [RANKS[member.puuid]] : [],
    matches,
    matchIds,
    ...buildRecapSet(matches, member.puuid),
  });

  return { a: load(a, 312), b: load(b, 188), together: buildSquadStats(matches, [a, b]), faceOff: buildFaceOff(matches, a.puuid, b.puuid, timelines), synergy: null, carry: buildCarry(matches, a.puuid, b.puuid) };
}
