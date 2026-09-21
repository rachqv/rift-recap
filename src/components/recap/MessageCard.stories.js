import { expect, fn, userEvent, within } from "storybook/test";
import RangeSwitch from "@/components/RangeSwitch";
import { rangeLinks } from "@/lib/recap/range";
import { MessageCard, OtherServers } from "./RecapMessage";

export default {
  title: "Recap/MessageCard",
  component: MessageCard,
  parameters: { layout: "fullscreen" },
};

/** An error or empty result always has a way out: the card has its button. */
export const Plain = {
  args: { title: "No games yet", children: "We couldn't find any games. Play a few matches and come back." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "No games yet" })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Try another player" })).toHaveAttribute("href", "/");
    await expect(canvas.queryByRole("navigation", { name: "Time range" })).toBeNull();
  },
};

/**
 * A player with no games in a short time range: the message offers the other ranges right there. Without them the page was
 * a dead end, because the range switch normally lives on a slide that only exists when there are games.
 */
export const EmptyTimeRange = {
  args: {
    title: "No games in this time range",
    children: "Name#TAG hasn't played a game since Thu Aug 20 2026. Try a longer range.",
    actions: <RangeSwitch links={rangeLinks("/recap/na1/Name/TAG", [], "30d")} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole("navigation", { name: "Time range" });
    const links = within(nav).getAllByRole("link");
    await expect(links.map((link) => link.textContent)).toEqual(["This season", "Last 90 days", "Last 30 days", "Last 7 days"]);
    await expect(within(nav).getByRole("link", { name: "Last 30 days" })).toHaveAttribute("aria-current", "true");
    // The longer ranges are real links to the same player, so picking one loads their recap for that range.
    await expect(within(nav).getByRole("link", { name: "Last 90 days" })).toHaveAttribute("href", "/recap/na1/Name/TAG?range=90d");
    await expect(within(nav).getByRole("link", { name: "This season" })).toHaveAttribute("href", "/recap/na1/Name/TAG");
    await expect(canvas.getByRole("link", { name: "Try another player" })).toBeInTheDocument();
  },
};

/**
 * A player with no games at all: often the wrong server, since games are kept per regional cluster. The other clusters' servers
 * are offered (folded away until asked for); the servers in the player's own cluster would show the same empty history.
 */
export const NoGamesOtherServers = {
  args: {
    title: "No games yet",
    children: "Name#TAG hasn't played a game since Thu Jan 08 2026.",
    actions: <OtherServers region="euw1" hrefFor={(id) => `/recap/${id}/Name/TAG`} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Maybe another server?"));
    await expect(canvas.getByRole("link", { name: "North America" })).toHaveAttribute("href", "/recap/na1/Name/TAG");
    await expect(canvas.getByRole("link", { name: "Korea" })).toHaveAttribute("href", "/recap/kr/Name/TAG");
    // Same cluster (europe) as EU West: the same games would come back, so these are left out.
    await expect(canvas.queryByRole("link", { name: "EU West" })).toBeNull();
    await expect(canvas.queryByRole("link", { name: "Turkey" })).toBeNull();
  },
};

/** An unexpected failure offers "Try again" beside the way back to the search; pressing it asks the page to draw itself again. */
export const Crash = {
  args: {
    title: "Something went wrong",
    children: "That page didn't load properly. Try again, or search for another player.",
    retry: { label: "Try again", onClick: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.retry.onClick).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole("link", { name: "Try another player" })).toHaveAttribute("href", "/");
  },
};
