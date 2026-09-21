import "server-only";
import { championName, profileIconUrl } from "@/lib/riot/ddragon";
import { pickSplashes } from "@/lib/riot/skins";
import { buildSquadStats } from "@/lib/squad/build";
import { clashLine, clashRows, teamName } from "@/lib/squad/clash";
import { buildScenarios } from "@/lib/squad/scenarios";
import { compareRecaps, verdictLine, withSummary } from "@/lib/squad/versus";
import { drawInLanguage, plain } from "./respond";
import { renderClashCard, renderSquadCard, renderVersusCard } from "./socialCards";

/** Share card for a loaded squad (`{ members, matches, sharedFound }`). The art matches the squad story's intro. */
export const squadCardResponse = (args) => drawInLanguage(args.t, (t) => drawSquadCard({ ...args, t }));

async function drawSquadCard({ data, index, format, origin, t }) {
  const stats = buildSquadStats(data.matches, data.members, t);
  if (stats.squad.games === 0) return plain(t("errors.noSharedGames"), 404);

  const seed = data.members.map((m) => `${m.gameName}#${m.tagLine}`).join("|");
  const [art] = stats.squad.topChampion ? await pickSplashes(index, stats.squad.topChampion, { count: 2, seed }) : [];

  return renderSquadCard(format, {
    t,
    host: new URL(origin).host,
    members: stats.members
      .filter((m) => m.games > 0)
      .map((m) => ({ index: m.index, name: m.gameName, icon: profileIconUrl(index.version, m.profileIcon) })),
    squad: stats.squad,
    awards: stats.awards.map((a) => ({ title: a.title, winner: stats.members[a.winner].gameName, memberIndex: a.winner, display: a.display })),
    art: art?.url ?? null,
  });
}

/** Share card for a loaded head-to-head (`{ a, b }`, each a loaded player with `account`, `summoner`, `rankedEntries`, `recap`, `modes`, `matches`). */
export const versusCardResponse = (args) => drawInLanguage(args.t, (t) => drawVersusCard({ ...args, t }));

async function drawVersusCard({ data, index, format, origin, t }) {
  const [a, b] = [withSummary(data.a, index, t), withSummary(data.b, index, t)];
  const side = (p) => ({ name: p.account.gameName, icon: profileIconUrl(index.version, p.summoner?.profileIconId), rank: p.rank?.title ?? null });
  const comparison = compareRecaps(a.recap, b.recap, t);
  // The same side bets the story shows, biggest gaps first: what makes this pair's card different from any other.
  const scenarios = buildScenarios(a, b, { t, nameOf: (id) => championName(index, id) }).scenarios.slice(0, format === "og" ? 3 : 6);

  return renderVersusCard(format, {
    t,
    host: new URL(origin).host,
    a: side(a),
    b: side(b),
    score: comparison.score,
    verdict: verdictLine(comparison, a.account.gameName, b.account.gameName, t),
    rows: comparison.rows,
    scenarios,
  });
}

/** Share card for a loaded squad vs squad (`{ a, b, clash }`: the squads' members and `buildClash`'s result, which must not be null). */
export const clashCardResponse = (args) => drawInLanguage(args.t, (t) => drawClashCard({ ...args, t }));

function drawClashCard({ data, format, origin, t }) {
  const { a, b, clash } = data;
  const teams = {
    a: { name: teamName(a, t), members: a.map((m) => m.gameName) },
    b: { name: teamName(b, t), members: b.map((m) => m.gameName) },
  };
  const laner = (member) => member?.gameName ?? "";

  return renderClashCard(format, {
    t,
    host: new URL(origin).host,
    teams,
    score: clash.wins,
    played: t("clash.slides.intro.played", { games: t("recap.gamesLabel", { count: clash.games }) }),
    verdict: clashLine(clash, { a: teams.a.name, b: teams.b.name }, t),
    lanesTitle: t("clash.slides.lanes.eyebrow"),
    numbersTitle: t("clash.slides.numbers.eyebrow"),
    lanes: clash.lanes.map((lane) => ({
      key: lane.role,
      role: t(`common.roles.${lane.role}`),
      aName: laner(lane.a),
      bName: laner(lane.b),
      score: `${lane.outplayed.a} - ${lane.outplayed.b}`,
      winner: lane.outplayed.a === lane.outplayed.b ? null : lane.outplayed.a > lane.outplayed.b ? "a" : "b",
    })),
    rows: clashRows(clash, t),
  });
}
