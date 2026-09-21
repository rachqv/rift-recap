// Shared sample data for stories. It comes from the same generators the demo pages use, so a story shows what real data
// produces, and it is deterministic (the generators are seeded), so stories can assert on it.

import { getBingo } from "@/lib/recap/bingo";
import { getFormCurve } from "@/lib/recap/formcurve";
import { getDemoData } from "@/lib/recap/demo";
import { getBlame } from "@/lib/recap/blame";
import { getTierList } from "@/lib/recap/tierlist";
import { getTilt } from "@/lib/recap/form";
import { getDamageProfile } from "@/lib/recap/playstyle";
import { getDemoSquad } from "@/lib/squad/demo";
import { buildQuiz } from "@/lib/squad/quiz";
import { buildSquadStats } from "@/lib/squad/build";

// The champion index the app builds from Data Dragon, trimmed to the champions the "closer" sample plays. Names missing from
// it fall back to the champion's id, so this only needs to be as complete as a story cares about.
export const championIndex = {
  version: "16.18.1",
  byId: {
    Garen: { name: "Garen", title: "The Might of Demacia", tags: ["Fighter", "Tank"], key: "86" },
    Ahri: { name: "Ahri", title: "the Nine-Tailed Fox", tags: ["Mage", "Assassin"], key: "103" },
    Lux: { name: "Lux", title: "the Lady of Luminosity", tags: ["Mage", "Support"], key: "99" },
    Ezreal: { name: "Ezreal", title: "the Prodigal Explorer", tags: ["Marksman", "Mage"], key: "81" },
  },
  byKey: { 86: "Garen", 103: "Ahri", 99: "Lux", 81: "Ezreal" },
};

/** The "closer" sample player: a recap with `recap`, `modes`, `activity`, `matches` and more. */
const soloData =getDemoData("closer");
export const { recap } = soloData;

/** Ready-made reads of that recap, the way the solo view builds them. */
export const soloReads = {
  tierList: getTierList(recap),
  tilt: getTilt(recap),
  blame: getBlame(recap),
  damage: getDamageProfile(recap),
  bingo: getBingo(recap),
  form: getFormCurve(recap),
};

/** The sample squad with its stats and quiz. `quiz.players` have no icons: stories render the initials fallback. */
export function squadFixture() {
  const squad = getDemoSquad();
  const stats = buildSquadStats(squad.matches, squad.members);
  const quiz = buildQuiz(stats.awards, stats.members);
  return { squad, stats, quiz: { ...quiz, players: quiz.players.map((p) => ({ ...p, iconUrl: null })) } };
}
