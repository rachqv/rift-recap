import { defaultT } from "@/lib/i18n/en";

// "Who won it?": the squad's awards turned into a guessing game. Each round names an award and the group guesses which
// member took it; the answers travel with the page, so it needs no server state.

const MIN_PLAYERS = 3; // with two players it is a coin flip
const MAX_ROUNDS = 4;

/**
 * @param awards `stats.awards` from `buildSquadStats`, each `{ title, tagline, icon, winner, display, line }`
 * @param members `stats.members`; only those with games can be guessed
 * @returns `{ players, rounds }` or null when the squad is too small for a quiz. `players` are the choices
 * (`{ index, gameName, profileIcon }`) and each round is `{ id, icon, title, tagline, answer, display, line }`.
 */
export function buildQuiz(awards, members) {
  const players = members.filter((m) => m.games > 0).map((m) => ({ index: m.index, gameName: m.gameName, profileIcon: m.profileIcon }));
  if (players.length < MIN_PLAYERS) return null;

  // An award only makes a fair question when its winner is one of the players a guess can name.
  const ids = new Set(players.map((p) => p.index));
  const rounds = awards
    .filter((award) => ids.has(award.winner))
    .slice(0, MAX_ROUNDS)
    .map((award) => ({ id: award.id ?? award.title, icon: award.icon, title: award.title, tagline: award.tagline, answer: award.winner, display: award.display, line: award.line }));
  return rounds.length >= 2 ? { players, rounds } : null;
}

/** A line for the final score. */
export function quizVerdict(correct, total, t = defaultT) {
  if (correct === total) return t("quiz.verdict.perfect");
  if (correct >= Math.ceil(total / 2)) return t("quiz.verdict.good");
  return t("quiz.verdict.low");
}
