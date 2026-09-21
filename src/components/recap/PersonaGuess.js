"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import Slide, { Reveal } from "./Slide";
import base from "./slides.module.css";
import styles from "./PersonaGuess.module.css";

/**
 * A game before the reveal: three clues, four archetypes, pick the one you think you are. Nothing is stored. `guess` is from
 * `buildPersonaGuess` (`{ answer, title, options, clues }`); the answer comes with the page, like the squad quiz's do.
 */
export default function PersonaGuess({ guess }) {
  const t = useT();
  const [pick, setPick] = useState(null);
  const answered = pick != null;

  return (
    // A slideshow waits a long time here: this is a slide you play with.
    <Slide dwell={30}>
      <Reveal i={0} className={base.eyebrow}>
        {t("quiz.guess.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={base.epithet}>
        {t("quiz.guess.lead")}
      </Reveal>
      <Reveal i={2} className={base.chips}>
        {guess.clues.map((clue) => (
          <span key={clue} className={base.chip}>
            {clue}
          </span>
        ))}
      </Reveal>
      <Reveal i={3} className={styles.wrap}>
        <div className={styles.choices} role="group" aria-label={t("quiz.guess.group")}>
          {guess.options.map((option) => {
            const state = !answered ? undefined : option.id === guess.answer ? "right" : option.id === pick ? "wrong" : "other";
            return (
              <button key={option.id} type="button" className={styles.choice} data-state={state} disabled={answered} onClick={() => setPick(option.id)}>
                {option.title}
              </button>
            );
          })}
        </div>
      </Reveal>
      <Reveal i={4} as="p" className={base.caption}>
        <span aria-live="polite">{answered ? (pick === guess.answer ? t("quiz.guess.right") : t("quiz.guess.wrong", { title: guess.title })) : ""}</span>
      </Reveal>
      {answered && (
        <Reveal i={5} as="p" className={styles.next}>
          {t("quiz.guess.next")}
        </Reveal>
      )}
    </Slide>
  );
}
