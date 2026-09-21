import { expect, within } from "storybook/test";
import { rangeLinks } from "@/lib/recap/range";
import RangeSwitch from "./RangeSwitch";

export default {
  title: "Components/RangeSwitch",
  component: RangeSwitch,
  parameters: { layout: "centered" },
};

/** The default range: the season link stays clean, and only the other three carry `?range=`. */
export const Season = {
  args: {
    links: rangeLinks("/squad", [["region", "na1"], ["p", "Name#TAG"]], "season"),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole("navigation", { name: "Time range" });
    await expect(within(nav).getAllByRole("link")).toHaveLength(4);
    await expect(canvas.getByRole("link", { name: "This season" })).toHaveAttribute("aria-current", "true");
    await expect(canvas.getByRole("link", { name: "This season" })).toHaveAttribute("href", "/squad?region=na1&p=Name%23TAG");
    await expect(canvas.getByRole("link", { name: "Last 30 days" })).toHaveAttribute("href", "/squad?region=na1&p=Name%23TAG&range=30d");
    await expect(canvas.getByRole("link", { name: "Last 30 days" })).not.toHaveAttribute("aria-current");
    await expect(canvas.getByRole("link", { name: "Last 7 days" })).toHaveAttribute("href", "/squad?region=na1&p=Name%23TAG&range=7d");
  },
};

/** Another range selected; a saved `since` comparison is dropped from every link, since it doesn't carry across ranges. */
export const Last30Days = {
  args: {
    links: rangeLinks("/recap/na1/Name/TAG", [["since", "abc"], ["range", "30d"]], "30d"),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Last 30 days" })).toHaveAttribute("aria-current", "true");
    for (const link of canvas.getAllByRole("link")) await expect(link.getAttribute("href")).not.toContain("since");
  },
};

/** Demo pages have no range to switch, so nothing is drawn. */
export const Hidden = {
  args: { links: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("nav")).toBeNull();
  },
};
