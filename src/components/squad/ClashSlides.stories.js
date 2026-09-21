import { expect, within } from "storybook/test";
import { clashLine, clashRows, teamName } from "@/lib/squad/clash";
import { getDemoClash } from "@/lib/squad/demoClash";
import { ClashEndSlide, ClashIntroSlide, ClashLanesSlide, ClashNumbersSlide, ClashStarsSlide } from "./clashSlides";

// The demo squads: five players each, nine custom games between them.
const { a, b, clash } = getDemoClash();
const teams = { a: { name: teamName(a), members: a }, b: { name: teamName(b), members: b } };

export default {
  title: "Squad/Clash",
  parameters: { layout: "fullscreen" },
};

/** Both squads with their members, the series score, and the sentence that says who leads (or that it is too close to say). */
export const Intro = {
  render: () => <ClashIntroSlide clash={clash} teams={teams} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(teams.a.name)).toBeInTheDocument();
    await expect(canvas.getByText(teams.b.name)).toBeInTheDocument();
    await expect(within(canvas.getByRole("list", { name: teams.a.name })).getAllByRole("listitem")).toHaveLength(5);
    await expect(canvas.getByRole("img", { name: `${clash.wins.a} – ${clash.wins.b}` })).toBeInTheDocument();
    await expect(canvas.getByText(clashLine(clash, { a: teams.a.name, b: teams.b.name }))).toBeInTheDocument();
    await expect(canvas.getByText("9 games played against each other")).toBeInTheDocument();
  },
};

/** One row for each lane both squads had someone in, with how many games each laner had the better KDA. */
export const Lanes = {
  render: () => <ClashLanesSlide lanes={clash.lanes} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = within(canvas.getByRole("list", { name: "Results by lane" })).getAllByRole("listitem");
    await expect(rows).toHaveLength(clash.lanes.length);
    await expect(within(rows[0]).getByText("Top")).toBeInTheDocument();
    await expect(within(rows[0]).getByText(clash.lanes[0].a.gameName)).toBeInTheDocument();
    await expect(within(rows[0]).getByText(`${clash.lanes[0].outplayed.a} – ${clash.lanes[0].outplayed.b}`)).toBeInTheDocument();
    // The side that won the lane is the one lit.
    const { a: winsA, b: winsB } = clash.lanes[0].outplayed;
    await expect(rows[0].dataset.winner).toBe(winsA === winsB ? "" : winsA > winsB ? "a" : "b");
  },
};

/** Average KDA, damage, gold and vision per player, per game; the higher side of each row is marked. */
export const Numbers = {
  render: () => <ClashNumbersSlide clash={clash} teams={teams} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = within(canvas.getByRole("table", { name: "Averages per player, per game" })).getAllByRole("row");
    const expected = clashRows(clash);
    await expect(rows).toHaveLength(4);
    await expect(rows.map((row) => row.dataset.winner)).toEqual(expected.map((row) => row.winner ?? undefined)); // a tie has no attribute
    await expect(within(rows[0]).getByText(expected[0].aShow)).toBeInTheDocument();
    await expect(within(rows[0]).getByText("KDA")).toBeInTheDocument();
  },
};

/** Each squad's best KDA, named only when they played enough games against the other squad. */
export const Stars = {
  render: () => <ClashStarsSlide stars={clash.stars} teams={teams} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(`Best KDA on ${teams.a.name}`)).toBeInTheDocument();
    await expect(canvas.getByText(clash.stars.a.gameName)).toBeInTheDocument();
    await expect(canvas.getByText(clash.stars.b.gameName)).toBeInTheDocument();
    await expect(canvas.getByText(/at least 3 games between the squads/)).toBeInTheDocument();
  },
};

/** With too few games nobody is named: the card says so with a dash instead of guessing. */
export const NoStars = {
  render: () => <ClashStarsSlide stars={{ a: null, b: clash.stars.b }} teams={teams} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("–")).toBeInTheDocument();
    await expect(canvas.getByText(clash.stars.b.gameName)).toBeInTheDocument();
  },
};

/** The way on: each squad's own recap, as a link to the squad page with the same players. */
export const End = {
  render: () => <ClashEndSlide teams={teams} hrefs={{ a: "/squad?region=euw1&p=A", b: "/squad?region=euw1&p=B" }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: `Squad recap: ${teams.a.name}` }).getAttribute("href")).toBe("/squad?region=euw1&p=A");
    await expect(canvas.getByRole("link", { name: `Squad recap: ${teams.b.name}` })).toBeInTheDocument();
  },
};
