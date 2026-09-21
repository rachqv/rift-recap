import { expect, userEvent, waitFor, within } from "storybook/test";
import PlayersList from "./PlayersList";

export default {
  title: "Components/PlayersList",
  component: PlayersList,
  parameters: { layout: "padded" },
};

// The list lives in this browser's local storage (see lib/recentPlayers.js). A story fills it before rendering and puts
// things back afterwards, so stories don't leak into each other.
const KEY = "riftRecap.recentPlayers.v1";
const seed = (players) => () => {
  const before = window.localStorage.getItem(KEY);
  if (players) window.localStorage.setItem(KEY, JSON.stringify(players));
  else window.localStorage.removeItem(KEY);
  return () => (before == null ? window.localStorage.removeItem(KEY) : window.localStorage.setItem(KEY, before));
};

const PLAYERS = [
  { gameName: "MidDiff", tagLine: "MID", region: "euw1" },
  { gameName: "PingPong", tagLine: "ADC", region: "euw1" },
  { gameName: "Faker", tagLine: "KR1", region: "kr" },
];

/** Every saved player, with a shortcut to a recap, a head-to-head and a squad. */
export const WithPlayers = {
  beforeEach: seed(PLAYERS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getAllByText("EU West")).toHaveLength(2);

    const [recap, versus, squad] = within(canvas.getAllByRole("listitem")[0]).getAllByRole("link");
    await expect(recap).toHaveAttribute("href", "/recap/euw1/MidDiff/MID");
    await expect(versus.getAttribute("href")).toContain("/versus?a=euw1%3AMidDiff%23MID");
    await expect(squad.getAttribute("href")).toContain("/squad?region=euw1&p=MidDiff%23MID");
  },
};

/** The X next to a player removes only that player. */
export const RemoveOne = {
  beforeEach: seed(PLAYERS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Remove PingPong#ADC from this list" }));
    await waitFor(() => expect(canvas.getAllByRole("listitem")).toHaveLength(2));
    await expect(canvas.queryByText("PingPong")).toBeNull();
    await expect(canvas.getByText("MidDiff")).toBeInTheDocument();
  },
};

export const ClearAll = {
  beforeEach: seed(PLAYERS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(canvas.getByText(/No players yet/)).toBeInTheDocument());
    await expect(canvas.queryAllByRole("listitem")).toHaveLength(0);
  },
};

export const Empty = {
  beforeEach: seed(null),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/No players yet/)).toBeInTheDocument();
  },
};

/** A pinned player is listed first, marked, and offers "Unpin"; the others offer "Pin". */
export const Pinned = {
  beforeEach: seed([PLAYERS[0], PLAYERS[1], { ...PLAYERS[2], pinned: true }]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole("listitem");
    await expect(within(rows[0]).getByText("Faker")).toBeInTheDocument(); // pinned, so first even though it is the oldest
    await expect(within(rows[0]).getByRole("button", { name: "Unpin Faker#KR1" })).toHaveAttribute("aria-pressed", "true");
    await expect(within(rows[1]).getByRole("button", { name: "Pin MidDiff#MID to the top" })).toHaveAttribute("aria-pressed", "false");
  },
};

/** The pin button moves a player to the top, and the list remembers it. */
export const PinOne = {
  beforeEach: seed(PLAYERS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Pin Faker#KR1 to the top" }));
    await waitFor(() => expect(within(canvas.getAllByRole("listitem")[0]).getByText("Faker")).toBeInTheDocument());
    await expect(JSON.parse(window.localStorage.getItem(KEY)).find((p) => p.gameName === "Faker").pinned).toBe(true);
    await userEvent.click(canvas.getByRole("button", { name: "Unpin Faker#KR1" }));
    await waitFor(() => expect(within(canvas.getAllByRole("listitem")[2]).getByText("Faker")).toBeInTheDocument());
  },
};

/** With players pinned, "clear" only clears the rest; the pinned ones are removed one by one. */
export const ClearKeepsPinned = {
  beforeEach: seed([PLAYERS[0], { ...PLAYERS[1], pinned: true }, PLAYERS[2]]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Clear all" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Clear unpinned" }));
    await waitFor(() => expect(canvas.getAllByRole("listitem")).toHaveLength(1));
    await expect(canvas.getByText("PingPong")).toBeInTheDocument();
  },
};
