import { expect, userEvent, waitFor, within } from "storybook/test";
import GoldLeadChart from "./GoldLeadChart";

export default {
  title: "Squad/GoldLeadChart",
  component: GoldLeadChart,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: "min(92vw, 38rem)" }}>
        <Story />
      </div>
    ),
  ],
};

// A game where the lead swings and player B ends up ahead and wins; and one where A leads more and more.
const swing = Array.from({ length: 21 }, (_, minute) => ({ minute, diff: Math.round(Math.sin(minute / 3.2) * 2200 - minute * 60) }));
const aLeads = Array.from({ length: 21 }, (_, minute) => ({ minute, diff: minute * 180 }));

/** The readout starts on the final minute and says who was ahead by how much. */
export const BWinsAfterASwing = {
  args: { points: swing, aName: "MidDiff", bName: "PingPong", aWon: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chart = canvas.getByRole("img");
    await expect(chart.getAttribute("aria-label")).toContain("Gold lead between MidDiff and PingPong");
    await expect(canvas.getByText("PingPong won")).toBeInTheDocument();
    await expect(canvasElement.querySelector("figcaption")).toHaveTextContent("Minute 20"); // the last frame
    await expect(canvas.getByText("PingPong", { selector: "b" })).toBeInTheDocument(); // B is ahead at the end
  },
};

/** Moving the pointer over the chart scrubs the readout to that minute; leaving returns it to the end. */
export const Scrubbing = {
  args: { points: aLeads, aName: "MidDiff", bName: "PingPong", aWon: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("MidDiff", { selector: "b" })).toBeInTheDocument(); // A leads at the end
    const svg = canvasElement.querySelector("svg");
    await userEvent.hover(svg); // pointer at the far left: minute 0, where the game was level
    await waitFor(() => expect(canvas.getByText("Level")).toBeInTheDocument());
    await userEvent.unhover(svg);
    await waitFor(() => expect(canvas.queryByText("Level")).toBeNull());
  },
};
