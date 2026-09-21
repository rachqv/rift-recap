import { defaultT } from "@/lib/i18n/en";
import { seededRandom, shuffled } from "@/lib/random";
import { PERSONA_IDS } from "./persona";

// "Guess your archetype": a game just before the reveal. Three clues about your season, four archetypes to pick from: the real
// one and three others. The others are chosen to be fair, so a wrong pick is really wrong: an archetype the player also scored
// high on (their runners-up) is never a decoy.

const DECOYS = 3;

/**
 * @param recap a `buildRecap` result
 * @param persona from `getPersona` (`id`, `title` and `alsoIds`)
 * @param names `{ topName, seed }`: the display name of your most played champion, and any string that stays the same for this
 * player (the same seed always gives the same four options in the same order, so a reload doesn't reshuffle them)
 * @returns `{ answer, title, options, clues }`: `answer` and `title` are the real archetype's id and title, `options` is
 * `[{ id, title }]` in the order to show, and `clues` is three sentences.
 */
export function buildPersonaGuess(recap, persona, { topName, seed }, t = defaultT) {
  const random = seededRandom(`${seed}:${persona.id}`);
  const others = PERSONA_IDS.filter((id) => id !== persona.id && !persona.alsoIds?.includes(id));
  const chosen = shuffled([persona.id, ...shuffled(others, random).slice(0, DECOYS)], random);
  return {
    answer: persona.id,
    title: persona.title,
    options: chosen.map((id) => ({ id, title: t(`persona.${id}.title`) })),
    clues: [
      t("quiz.guess.clueMain", { champion: topName }),
      t("quiz.guess.clueRate", { rate: t.percent(recap.winRate) }),
      t("quiz.guess.clueKda", { kda: t.fixed(recap.kda, 2) }),
    ],
  };
}
