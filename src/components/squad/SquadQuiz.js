"use client";

import { useState } from "react";
import Slide, { Reveal } from "@/components/recap/Slide";
import base from "@/components/recap/slides.module.css";
import { useT } from "@/lib/i18n/client";
import { quizVerdict } from "@/lib/squad/quiz";
import Image from "next/image";
import { MEMBER_COLORS } from "./memberColors";
import avatar from "./PlayerAvatar.module.css";
import styles from "./squad.module.css";

/**
 * The squad guessing game: one award at a time, guess who won it, then see the answer. `quiz` is from `buildQuiz`
 * (`{ players, rounds }`, each player with an `iconUrl` or null). All state stays in the browser; the answers come with the page.
 */
export default function SquadQuiz({ quiz }) {
  const t = useT();
  const [picks, setPicks] = useState([]); // the guess for each round answered so far
  const [revealed, setRevealed] = useState(false);

  const step = picks.length - (revealed ? 1 : 0); // the round on screen
  const done = step >= quiz.rounds.length;
  const round = quiz.rounds[step];
  const guess = revealed ? picks.at(-1) : null;
  const correct = picks.filter((pick, i) => pick === quiz.rounds[i].answer).length;
  const nameOf = (index) => quiz.players.find((p) => p.index === index)?.gameName;

  function choose(index) {
    if (revealed) return;
    setPicks((current) => [...current, index]);
    setRevealed(true);
  }

  function reset() {
    setPicks([]);
    setRevealed(false);
  }

  return (
    // A slideshow waits a long time here: the quiz is the one slide you play with.
    <Slide dwell={30}>
      <Reveal i={0} className={base.eyebrow}>
        {done ? t("quiz.result") : t("quiz.round", { step: step + 1, total: quiz.rounds.length })}
      </Reveal>

      {done ? (
        <>
          <Reveal i={1} className={base.mega}>
            {correct}/{quiz.rounds.length}
          </Reveal>
          <Reveal i={2} as="p" className={base.caption}>
            {quizVerdict(correct, quiz.rounds.length, t)}
          </Reveal>
          <Reveal i={3}>
            <button type="button" className={styles.quizButton} onClick={reset}>
              {t("quiz.again")}
            </button>
          </Reveal>
        </>
      ) : (
        <>
          <Reveal i={1} className={styles.quizIcon}>
            <span aria-hidden="true">{round.icon}</span>
          </Reveal>
          <Reveal i={2} as="h2" className={styles.quizTitle}>
            {round.title}
          </Reveal>
          <Reveal i={3} as="p" className={base.epithet}>
            {round.tagline}
          </Reveal>
          <Reveal i={4} className={styles.quizWrap}>
            <div className={styles.quizChoices} role="group" aria-label={t("quiz.group")}>
            {quiz.players.map((player) => {
              const state = !revealed ? undefined : player.index === round.answer ? "right" : player.index === guess ? "wrong" : "other";
              return (
                <button
                  key={player.index}
                  type="button"
                  className={styles.quizChoice}
                  data-state={state}
                  disabled={revealed}
                  onClick={() => choose(player.index)}
                >
                  {player.iconUrl ? (
                    <Image src={player.iconUrl} alt="" width={96} height={96} unoptimized className={`${avatar.avatar} ${avatar.sm}`} style={{ "--ring": MEMBER_COLORS[player.index % MEMBER_COLORS.length] }} />
                  ) : (
                    <span className={`${avatar.avatar} ${avatar.sm} ${avatar.fallback}`} style={{ "--ring": MEMBER_COLORS[player.index % MEMBER_COLORS.length] }}>
                      {player.gameName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span>{player.gameName}</span>
                </button>
              );
            })}
            </div>
          </Reveal>
          <Reveal i={5} as="p" className={base.caption}>
            <span aria-live="polite">
              {revealed ? t("quiz.reveal", { verdict: guess === round.answer ? t("quiz.right") : t("quiz.wrong", { name: nameOf(round.answer) }), line: round.line }) : t("quiz.pick")}
            </span>
          </Reveal>
          {revealed && (
            <Reveal i={6}>
              <button type="button" className={styles.quizButton} onClick={() => setRevealed(false)}>
                {t(step + 1 >= quiz.rounds.length ? "quiz.score" : "quiz.next")}
              </button>
            </Reveal>
          )}
        </>
      )}
    </Slide>
  );
}
