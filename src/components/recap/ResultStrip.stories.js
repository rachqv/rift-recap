import { expect, within } from "storybook/test";
import ResultStrip from "./ResultStrip";

export default {
  title: "Recap/ResultStrip",
  component: ResultStrip,
  parameters: { layout: "centered" },
};

/** One dot per game, oldest first, with a text summary for screen readers. */
export const Mixed = {
  args: { results: [true, true, false, true, false, false, true, true] },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement).getByRole("img");
    await expect(strip).toHaveAccessibleName("5 wins and 3 losses, oldest game first");
    await expect(strip.children).toHaveLength(8);
    await expect(strip.children[0]).toHaveAttribute("data-win", "true");
    await expect(strip.children[2]).toHaveAttribute("data-win", "false");
  },
};

export const OneHundredGames = {
  args: { results: Array.from({ length: 100 }, (_, i) => i % 3 !== 0) },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement).getByRole("img");
    await expect(strip.children).toHaveLength(100);
    await expect(strip).toHaveAccessibleName("66 wins and 34 losses, oldest game first");
  },
};
