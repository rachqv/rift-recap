import { seededRandom } from "@/lib/random";
import { buildClash } from "./clash";

// Two made-up squads of five that play custom 5v5s against each other, for previewing the squad vs squad page without a Riot API key.
// It has its own random stream, so changing it never moves the numbers of the other demos.

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

// Per role: kills, deaths, assists, damage per minute, gold per minute, vision per minute, and a few champions.
const KIT = {
  TOP: { k: 3.5, d: 4.5, a: 5, dmg: 520, gold: 380, vision: 0.7, champs: ["Ornn", "Sett", "Garen", "Riven"] },
  JUNGLE: { k: 5.5, d: 4.5, a: 8, dmg: 480, gold: 360, vision: 1.1, champs: ["Graves", "Kayn", "Viego", "Elise"] },
  MIDDLE: { k: 7, d: 4, a: 6, dmg: 760, gold: 420, vision: 0.9, champs: ["Ahri", "Syndra", "Zed", "Viktor"] },
  BOTTOM: { k: 7, d: 4.5, a: 6, dmg: 700, gold: 430, vision: 0.8, champs: ["Jinx", "Kaisa", "Ashe", "Jhin"] },
  UTILITY: { k: 1.5, d: 5, a: 14, dmg: 250, gold: 260, vision: 2.8, champs: ["Thresh", "Lulu", "Nami", "Leona"] },
};

const SIDE_A = ["IronWall", "Snatchy", "MidDiff", "PingPong", "Wardy"];
const SIDE_B = ["Bramble", "Nightjar", "Crescent", "Longshot", "Lanternkeeper"];

const members = (names, side) => names.map((gameName, i) => ({ puuid: `clash-${side}-${i}`, gameName, tagLine: "EUW" }));

/** The demo clash, shaped like a loaded one: `{ region, a, b, clash, scanned }`. Squad A is a little the stronger side. */
export function getDemoClash() {
  const rand = seededRandom("demo-clash");
  const [a, b] = [members(SIDE_A, "a"), members(SIDE_B, "b")];
  const now = Date.now();
  const GAMES = 9;

  const matches = Array.from({ length: GAMES }, (_, i) => {
    const minutes = 24 + rand() * 12;
    const aWon = rand() < 0.66;
    const participant = (member, role, teamId, strength) => {
      const kit = KIT[role];
      const jitter = () => 0.75 + rand() * 0.5;
      const kills = Math.round(kit.k * strength * jitter());
      return {
        puuid: member.puuid,
        teamId,
        win: teamId === 100 ? aWon : !aWon,
        teamPosition: role,
        championName: kit.champs[Math.floor(rand() * kit.champs.length)],
        kills,
        deaths: Math.max(0, Math.round((kit.d / strength) * jitter())),
        assists: Math.round(kit.a * strength * jitter()),
        totalDamageDealtToChampions: Math.round(kit.dmg * minutes * strength * jitter()),
        goldEarned: Math.round(kit.gold * minutes * strength * jitter()),
        visionScore: Math.round(kit.vision * minutes * jitter()),
      };
    };
    // The side that wins a game usually played a bit better in it, which is what makes it the winner.
    const [strengthA, strengthB] = aWon ? [1.08, 0.94] : [0.94, 1.08];
    return {
      metadata: { matchId: `EUW1_${7_000_000_000 + i}` },
      info: {
        gameCreation: now - (GAMES - i) * 3 * 86400000,
        gameDuration: Math.round(minutes * 60),
        participants: [...a.map((m, r) => participant(m, ROLES[r], 100, strengthA)), ...b.map((m, r) => participant(m, ROLES[r], 200, strengthB))],
      },
    };
  });

  return { region: "euw1", a, b, clash: buildClash(matches, a, b), scanned: 300 };
}
