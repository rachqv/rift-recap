import { expect, userEvent, waitFor, within } from "storybook/test";
import { quizVerdict } from "@/lib/squad/quiz";
import { squadFixture } from "@/test/fixtures";
import SquadQuiz from "./SquadQuiz";

const { quiz } = squadFixture();
const nameOf = (index) => quiz.players.find((p) => p.index === index).gameName;
const total = quiz.rounds.length;

export default {
  title: "Squad/SquadQuiz",
  component: SquadQuiz,
  args: { quiz },
};

/** Picks `who(round)` for every round and clicks through to the score. Checks each reveal on the way. */
async function playThrough(canvasElement, who, expected) {
  const canvas = within(canvasElement);
  for (const [i, round] of quiz.rounds.entries()) {
    await waitFor(() => expect(canvas.getByText(`Who won it? ${i + 1} of ${total}`)).toBeInTheDocument());
    await expect(canvas.getByRole("heading", { name: round.title })).toBeInTheDocument();

    await userEvent.click(canvas.getByText(nameOf(who(round)), { selector: "span" }));
    await expect(canvas.getByText(expected(round))).toBeInTheDocument();
    // After an answer the choices lock, so a second click can't change it.
    for (const button of within(canvas.getByRole("group", { name: "Who won this award?" })).getAllByRole("button")) await expect(button).toBeDisabled();

    await userEvent.click(canvas.getByRole("button", { name: i + 1 === total ? "See your score" : "Next award" }));
  }
}

const wrong = (round) => quiz.players.find((p) => p.index !== round.answer).index;

/** Knowing every answer: each reveal says "Right!", and the score is full marks. */
export const PerfectScore = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await playThrough(canvasElement, (round) => round.answer, (round) => `Right! ${round.line}`);
    await waitFor(() => expect(canvas.getByText(`${total}/${total}`)).toBeInTheDocument());
    await expect(canvas.getByText(quizVerdict(total, total))).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Play again" })).toBeInTheDocument();
  },
};

/** Getting everything wrong names the real winner each time and scores zero. */
export const AllWrong = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await playThrough(canvasElement, wrong, (round) => `Nope, it was ${nameOf(round.answer)}. ${round.line}`);
    await waitFor(() => expect(canvas.getByText(`0/${total}`)).toBeInTheDocument());
    await expect(canvas.getByText(quizVerdict(0, total))).toBeInTheDocument();
  },
};

/** "Play again" starts over from the first award. */
export const PlayAgain = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await playThrough(canvasElement, (round) => round.answer, (round) => `Right! ${round.line}`);
    await userEvent.click(await canvas.findByRole("button", { name: "Play again" }));
    await waitFor(() => expect(canvas.getByText(`Who won it? 1 of ${total}`)).toBeInTheDocument());
  },
};
