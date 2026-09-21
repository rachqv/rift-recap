import { expect, within } from "storybook/test";
import { clockLine, getWinClock } from "@/lib/recap/clock";
import { formLines } from "@/lib/recap/formcurve";
import { progressLine } from "@/lib/recap/progress";
import { getWeekCompare } from "@/lib/recap/week";
import { getPatchForm, patchLine } from "@/lib/recap/patches";
import { compactRunes, getKeystoneInsight, pickKeystones } from "@/lib/recap/runes";
import { getTiltGuard, tiltGuardLines } from "@/lib/recap/tiltguard";
import { tierListLine } from "@/lib/recap/tierlist";
import { championIndex, recap as soloRecap, soloReads } from "@/test/fixtures";
import { BlameSlide, ClockSlide, FormCurveSlide, PatchSlide, PoolSlide, RunesSlide, TierListSlide, TiltGuardSlide, TiltSlide, TrophiesSlide, WeekSlide } from "./dataSlides";
import { DamageProfileSlide } from "./extraSlides";
import { ChampionSlide } from "./slides";

// The slides, fed by the same "closer" sample player the demo page uses. Each one checks that the numbers and the sentence
// it shows come from the data, and that its structure is what a screen reader should find.
export default {
  title: "Recap/Slides",
  parameters: { layout: "fullscreen" },
};

const nameOf = (id) => championIndex.byId[id]?.name ?? id;

/** The graph has one row for each tier from S to D, and the caption agrees with the tiers the champions are really in. */
export const TierList = {
  render: () => <TierListSlide tierList={soloReads.tierList} index={championIndex} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list", { name: "Champion tier list" });
    await expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    await expect(canvas.getByText(tierListLine(soloReads.tierList, nameOf))).toBeInTheDocument();
  },
};

/** The bingo board: the count of unlocked trophies, one square for every trophy plus the free space, and a card to download. */
export const Trophies = {
  render: () => <TrophiesSlide bingo={soloReads.bingo} share={{ cardUrl: "/demo/card?style=closer" }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { bingo } = soloReads;
    await expect(canvas.getByText(`of ${bingo.total} unlocked`)).toBeInTheDocument();
    await expect(within(canvas.getByRole("list", { name: "Trophy bingo board" })).getAllByRole("listitem")).toHaveLength(25);
    const unlocked = canvasElement.querySelectorAll('[data-unlocked="true"]');
    const locked = canvasElement.querySelectorAll('[data-unlocked="false"]');
    await expect(unlocked).toHaveLength(bingo.unlocked);
    await expect(unlocked.length + locked.length).toBe(bingo.total);
    await expect(canvasElement.querySelectorAll('[data-free="true"]')).toHaveLength(1);
    await expect(canvas.getByRole("link", { name: "Download card" }).getAttribute("href")).toMatch(/format=bingo/);
  },
};

export const Tilt = {
  render: () => <TiltSlide tilt={soloReads.tilt} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(soloReads.tilt.line)).toBeInTheDocument();
    await expect(canvas.getByText("After a win")).toBeInTheDocument();
    await expect(canvas.getByText("After a loss")).toBeInTheDocument();
  },
};

export const WasItYou = {
  render: () => <BlameSlide blame={soloReads.blame} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(soloReads.blame.line)).toBeInTheDocument();
    await expect(canvas.getByText("Top damage")).toBeInTheDocument();
  },
};

/** Physical, magic and true damage as one bar, with a text alternative that lists the three shares. */
export const DamageProfile = {
  render: () => <DamageProfileSlide profile={soloReads.damage} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: soloReads.damage.style })).toBeInTheDocument();
    const bar = canvas.getByRole("img");
    await expect(bar.getAttribute("aria-label")).toMatch(/Physical \d+%, Magic \d+%, True \d+%/);
    await expect(canvas.getByText(soloReads.damage.line)).toBeInTheDocument();
  },
};

// A season of 126 games, 18 on each weekday, spread over four times of day: Fridays are the good day, Mondays the bad one.
const clockActivity = Array.from({ length: 126 }, (_, i) => {
  const weekday = i % 7;
  const nth = Math.floor(i / 7);
  const wins = [5, 9, 9, 10, 15, 11, 8][weekday];
  // 1 Jan 2024 was a Monday. Local dates, like the chart, so the same games land on the same days in any time zone.
  return { t: new Date(2024, 0, 1 + weekday + 7 * Math.floor(nth / 4), [9, 14, 20, 1][nth % 4]).getTime(), win: nth < wins };
});

/** Bars for the time of day and the weekday, with the strongest pattern in the caption. Each bar has a text alternative. */
export const WhenYouWin = {
  render: () => <ClockSlide activity={clockActivity} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clock = getWinClock(clockActivity);
    await expect(await canvas.findByRole("list", { name: "Time of day" })).toBeInTheDocument();
    await expect(within(canvas.getByRole("list", { name: "Time of day" })).getAllByRole("listitem")).toHaveLength(4);
    await expect(within(canvas.getByRole("list", { name: "Day of the week" })).getAllByRole("listitem")).toHaveLength(7);
    await expect(canvas.getByText(clockLine(clock))).toBeInTheDocument();
    // Friday is the best day in the data, and it is marked as the best bar.
    await expect(clock.focus).toBe("day");
    await expect(canvasElement.querySelectorAll('[data-tone="best"]')).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('[data-tone="worst"]')).toHaveLength(1);
  },
};

// Twelve sittings of two wins then three losses (once you are two down, the next game is lost): a clear stop sign.
const guardHistory = () => Array.from({ length: 12 }, (_, day) => [..."WWLLL"].map((r, i) => ({ t: Date.UTC(2024, 0, 1 + day, 18) + i * 30 * 60000, win: r === "W" }))).flat();

/** Win rate after a win and after 1, 2 and 3+ losses in a row, with the stop sign marked and worded. */
export const TiltGuard = {
  render: () => <TiltGuardSlide guard={getTiltGuard(guardHistory())} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const guard = getTiltGuard(guardHistory());
    await expect(within(canvas.getByRole("list", { name: "Tilt guard" })).getAllByRole("listitem")).toHaveLength(4);
    await expect(canvas.getByText(tiltGuardLines(guard)[0], { exact: false })).toBeInTheDocument();
    // Two losses in a row is where the win rate drops, so that bar and the ones after it are marked.
    await expect(canvasElement.querySelectorAll('[data-stop="true"]')).toHaveLength(guard.steps.filter((s) => s.rate != null && s.key >= guard.stop.losses).length);
    // These games are from 2024: there is no streak "right now".
    await expect(canvas.queryByText("Right now")).toBeNull();
  },
};

/** The same history with a losing streak that ended half an hour ago: the "right now" note appears. */
export const TiltGuardLive = {
  render: () => {
    const now = Date.now();
    const streak = [90, 60, 30].map((minutes, i) => ({ t: now - minutes * 60000, win: i === 0 }));
    return <TiltGuardSlide guard={getTiltGuard([...guardHistory(), ...streak])} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Right now")).toBeInTheDocument();
    await expect(canvas.getByText(/2 losses deep right now/)).toBeInTheDocument();
  },
};

/** The rolling win rate as a line: its text alternative and both captions come from the data, and the chips give the same three values. */
export const SeasonLine = {
  render: () => <FormCurveSlide curve={soloReads.form} share={{ cardUrl: "/demo/card?style=closer" }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { form } = soloReads;
    const percent = (rate) => `${Math.round(rate * 100)}%`;
    await expect(canvas.getByRole("img", { name: `Rolling win rate: best ${percent(form.best.rate)}, worst ${percent(form.worst.rate)}, latest ${percent(form.now.rate)}` })).toBeInTheDocument();
    const [swing, trend] = formLines(form);
    await expect(canvas.getByText(swing, { exact: false })).toBeInTheDocument();
    await expect(canvas.getByText(trend, { exact: false })).toBeInTheDocument();
    await expect(canvas.getByText(/^Best/)).toBeInTheDocument();
    await expect(canvas.getByText(/^Worst/)).toBeInTheDocument();
    await expect(canvas.getByText(/^Now/)).toBeInTheDocument();
    // The card that is downloaded is drawn from the same curve, in its own format.
    await expect(canvas.getByRole("link", { name: "Download card" }).getAttribute("href")).toMatch(/format=form/);
  },
};

// The sample player's last 7 days, against a week before it that was a bit worse: fewer games, a lower win rate and KDA.
const weekBefore = { ...soloRecap, games: 22, winRate: soloRecap.winRate - 0.15, kda: soloRecap.kda * 0.7 };

/** The last 7 days against the 7 before: a row for each stat, which way it moved, and the sentence about them. */
export const WeekOnWeek = {
  render: () => <WeekSlide week={getWeekCompare(soloRecap, weekBefore)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const week = getWeekCompare(soloRecap, weekBefore);
    await expect(canvas.getByText("Last 7 days vs the 7 before")).toBeInTheDocument();
    await expect(canvas.getByText(`${soloRecap.games} games now · 22 games then`)).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("[data-mood]")).toHaveLength(week.progress.rows.length);
    await expect(canvasElement.querySelectorAll('[data-mood="better"]')).toHaveLength(week.progress.better);
    await expect(canvas.getByText(progressLine(week.progress))).toBeInTheDocument();
  },
};

// Three patches: a bad one, an average one and a very good one, ten games each (the demo's patches depend on today's date).
const patchHistory = { patches: [{ patch: "16.1", games: 10, wins: 2 }, { patch: "16.2", games: 10, wins: 5 }, { patch: "16.3", games: 10, wins: 9 }] };

/** A bar for each patch, the best and worst colored, and the sentence naming them. */
export const PatchByPatch = {
  render: () => <PatchSlide form={getPatchForm(patchHistory)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = getPatchForm(patchHistory);
    await expect(within(canvas.getByRole("list", { name: "Win rate by patch" })).getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getByText("16.3: 90% win rate, 10 games, 9 won", { exact: false })).toBeInTheDocument();
    await expect(canvas.getByText(patchLine(form))).toBeInTheDocument();
    await expect(form.mood).toBe("swing");
    await expect(canvasElement.querySelectorAll('[data-tone="best"]')).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('[data-tone="worst"]')).toHaveLength(1);
  },
};

// Two keystones and their trees, as Data Dragon lists them. The icons are the real ones, from the patch-free /cdn/img/ path.
const runeIndex = compactRunes([
  { id: 8100, name: "Domination", slots: [{ runes: [{ id: 8112, name: "Electrocute", icon: "perk-images/Styles/Domination/Electrocute/Electrocute.png" }] }] },
  { id: 8000, name: "Precision", slots: [{ runes: [{ id: 8010, name: "Conqueror", icon: "perk-images/Styles/Precision/Conqueror/Conqueror.png" }, { id: 8008, name: "Lethal Tempo", icon: "perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png" }] }] },
]);
const keystoneStats = [{ id: 8112, games: 20, wins: 8 }, { id: 8010, games: 12, wins: 10 }, { id: 8008, games: 8, wins: 4 }];

/** Your most played keystone, its win rate with and without it, and the next ones: the sentence says another one works better. */
export const Runes = {
  render: () => <RunesSlide picks={pickKeystones(keystoneStats, runeIndex)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const picks = pickKeystones(keystoneStats, runeIndex);
    await expect(canvas.getByRole("heading", { name: "Electrocute" })).toBeInTheDocument();
    await expect(canvas.getByText("Domination")).toBeInTheDocument();
    await expect(canvas.getByText(getKeystoneInsight(picks))).toBeInTheDocument();
    await expect(picks.verdict).toBe("better");
    // The other keystones are named for screen readers, by their icon.
    await expect(canvas.getByAltText("Conqueror")).toBeInTheDocument();
    await expect(canvas.getByAltText("Lethal Tempo")).toBeInTheDocument();
  },
};

// One champion you win with, and two like it (Data Dragon's classes for the sample index, so the class shows under each).
const poolAdvice = [{ anchor: { id: "Ahri", games: 30, winRate: 0.7 }, picks: [{ id: "Lux", similarity: 5 }, { id: "Garen", similarity: 2 }] }];

/** The champion you win with, why it is the reason, and the champions to try, each with its class. */
export const ChampionsToTry = {
  render: () => <PoolSlide advice={poolAdvice} index={championIndex} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Because Ahri works for you: 70% win rate")).toBeInTheDocument();
    const picks = canvas.getAllByRole("listitem");
    await expect(picks).toHaveLength(2);
    await expect(within(picks[0]).getByText("Lux")).toBeInTheDocument();
    await expect(within(picks[0]).getByText("mage")).toBeInTheDocument(); // shown in capitals by the CSS
    await expect(within(picks[1]).getByText("fighter")).toBeInTheDocument();
    // It says what it is: a suggestion.
    await expect(canvas.getByText(/A suggestion, not a promise/)).toBeInTheDocument();
  },
};

/** The signature champion slide links to that champion's own page. */
export const ChampionLink = {
  render: () => <ChampionSlide recap={soloRecap} index={championIndex} insights={{ champion: "A line about the champion." }} moreHref="/demo/champion/Ahri" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = nameOf(soloRecap.topChampions[0].id);
    await expect(canvas.getByRole("heading", { name })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: `All your ${name} games` }).getAttribute("href")).toBe("/demo/champion/Ahri");
    await expect(canvas.getByText("Your signature champion")).toBeInTheDocument();
  },
};

/** On the champion's own page the slide says it is a report, and has no link to itself. */
export const ChampionReport = {
  render: () => <ChampionSlide recap={soloRecap} index={championIndex} insights={{ champion: "A line about the champion." }} eyebrow="Champion report" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Champion report")).toBeInTheDocument();
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};
