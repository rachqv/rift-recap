import { expect, within } from "storybook/test";
import { getLineup } from "@/lib/squad/lineup";
import { SquadRolesSlide } from "./squadSlides";

// A squad of three where two would each do better in the other's usual role (Mid and Top), and one is settled in the jungle.
const role = (name, games, wins) => ({ role: name, games, wins });
const members = [
  { index: 0, gameName: "Ana", profileIcon: null, games: 16, roles: [role("MIDDLE", 10, 4), role("TOP", 6, 5)] },
  { index: 1, gameName: "Ben", profileIcon: null, games: 16, roles: [role("TOP", 10, 5), role("MIDDLE", 6, 2)] },
  { index: 2, gameName: "Cai", profileIcon: null, games: 10, roles: [role("JUNGLE", 10, 5)] },
];

export default {
  title: "Squad/Roles",
  component: SquadRolesSlide,
  parameters: { layout: "fullscreen" },
};

/** Two members would each win more in the other's role: they are lit, and the row says what they usually play. */
export const Swap = {
  render: () => <SquadRolesSlide lineup={getLineup(members)} members={members} version={null} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = within(canvas.getByRole("list", { name: "Suggested role for each member" })).getAllByRole("listitem");
    await expect(rows).toHaveLength(3);
    await expect(within(rows[0]).getByText("Top")).toBeInTheDocument(); // Ana moves from Mid
    await expect(within(rows[0]).getByText("usually Mid")).toBeInTheDocument();
    await expect(within(rows[1]).getByText("Mid")).toBeInTheDocument();
    await expect(within(rows[2]).queryByText(/usually/)).toBeNull(); // Cai stays
    await expect(rows.map((row) => row.dataset.changed)).toEqual(["true", "true", "false"]);
    await expect(canvas.getByText(/best lineup: everyone in the role they win most/)).toBeInTheDocument();
  },
};

/** Everyone is already where they win most: nothing is lit, and it says so. */
export const Settled = {
  render: () => {
    const settled = [
      { index: 0, gameName: "Ana", profileIcon: null, games: 10, roles: [role("TOP", 10, 7)] },
      { index: 1, gameName: "Ben", profileIcon: null, games: 10, roles: [role("MIDDLE", 10, 6)] },
      { index: 2, gameName: "Cai", profileIcon: null, games: 10, roles: [role("JUNGLE", 10, 5)] },
    ];
    return <SquadRolesSlide lineup={getLineup(settled)} members={settled} version={null} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Everyone already plays the role they win most. Nothing to swap.")).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('[data-changed="true"]')).toHaveLength(0);
  },
};
