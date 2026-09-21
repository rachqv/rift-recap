import { expect, userEvent, within } from "storybook/test";
import { buildPersonaGuess } from "@/lib/recap/guess";
import { recap } from "@/test/fixtures";
import PersonaGuess from "./PersonaGuess";

// The guessing game before the reveal. It gets the same fixed player every time, so the options are always the same four.
const guess = buildPersonaGuess(recap, { id: "closer", title: "The Closer", alsoIds: [] }, { topName: "Ahri", seed: "story" });

export default {
  title: "Recap/PersonaGuess",
  component: PersonaGuess,
  parameters: { layout: "fullscreen" },
  args: { guess },
};

/** Three clues and four archetypes, none picked yet; the answer is not announced. */
export const Question = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Guess your archetype")).toBeInTheDocument();
    for (const clue of guess.clues) await expect(canvas.getByText(clue)).toBeInTheDocument();
    const group = canvas.getByRole("group", { name: "Which archetype are you?" });
    await expect(within(group).getAllByRole("button")).toHaveLength(4);
    await expect(canvas.queryByText(/Spot on|Not quite/)).toBeNull();
  },
};

/** A wrong pick is marked, the right one is shown, and the choices lock. */
export const WrongGuess = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const wrong = guess.options.find((option) => option.id !== guess.answer);
    await userEvent.click(canvas.getByRole("button", { name: wrong.title }));
    await expect(canvas.getByRole("button", { name: wrong.title })).toHaveAttribute("data-state", "wrong");
    await expect(canvas.getByRole("button", { name: "The Closer" })).toHaveAttribute("data-state", "right");
    await expect(canvas.getByText("Not quite. You're The Closer.")).toBeInTheDocument();
    await expect(canvas.getByText("Keep going for the full reveal.")).toBeInTheDocument();
    for (const button of within(canvas.getByRole("group")).getAllByRole("button")) await expect(button).toBeDisabled();
  },
};

/** The right pick is celebrated. */
export const RightGuess = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "The Closer" }));
    await expect(canvas.getByRole("button", { name: "The Closer" })).toHaveAttribute("data-state", "right");
    await expect(canvas.getByText("Spot on. You know your own game.")).toBeInTheDocument();
  },
};
