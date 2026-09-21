import { defaultT } from "@/lib/i18n/en";

// Objective stats: what your teams took (dragons, barons, towers...) and what you personally secured.
// Team numbers come from each match's `teams[].objectives`; personal ones from the participant.

const TEAM_KEYS = { dragon: "dragon", baron: "baron", herald: "riftHerald", grubs: "horde", tower: "tower", inhibitor: "inhibitor" };

// Objectives whose "first one" tends to matter, for the "you win X% more when your team gets it" line.
const FIRST_KEYS = ["tower", "dragon", "herald", "baron"];

// A win-rate comparison needs enough games on both sides to mean anything.
const MIN_SAMPLE = 3;

export function createObjectiveTally() {
  return {
    games: 0,
    team: Object.fromEntries(Object.keys(TEAM_KEYS).map((key) => [key, 0])),
    personal: { turrets: 0, inhibitors: 0, dragons: 0, barons: 0, stolen: 0, damageToObjectives: 0 },
    firsts: Object.fromEntries(FIRST_KEYS.map((key) => [key, { with: { games: 0, wins: 0 }, without: { games: 0, wins: 0 } }])),
  };
}

function addPersonal(personal, me) {
  // `turretTakedowns` includes assists; older data only has `turretKills`.
  personal.turrets += me.turretTakedowns ?? me.turretKills ?? 0;
  personal.inhibitors += me.inhibitorTakedowns ?? me.inhibitorKills ?? 0;
  personal.dragons += me.dragonKills ?? 0;
  personal.barons += me.baronKills ?? 0;
  personal.stolen += me.objectivesStolen ?? 0;
  personal.damageToObjectives += me.damageDealtToObjectives ?? 0;
}

/** Records one game. `teams` is the match's `info.teams`; `won` is whether `me` won. Skips games without team data. */
export function addObjectives(tally, me, teams, won) {
  const objectives = teams?.find((team) => team.teamId === me.teamId)?.objectives;
  if (!objectives) return;

  tally.games++;
  for (const [key, source] of Object.entries(TEAM_KEYS)) tally.team[key] += objectives[source]?.kills ?? 0;
  for (const key of FIRST_KEYS) {
    const side = objectives[TEAM_KEYS[key]]?.first ? tally.firsts[key].with : tally.firsts[key].without;
    side.games++;
    if (won) side.wins++;
  }
  addPersonal(tally.personal, me);
}

const rate = (side) => (side.games >= MIN_SAMPLE ? side.wins / side.games : null);

/** `null` when no game had team data, so the slide can be skipped. */
export function summarizeObjectives(tally) {
  const n = tally.games;
  if (n === 0) return null;

  const firsts = Object.fromEntries(
    FIRST_KEYS.map((key) => {
      const { with: got, without: missed } = tally.firsts[key];
      return [key, { rate: got.games / n, winRateWith: rate(got), winRateWithout: rate(missed), gamesWith: got.games, gamesWithout: missed.games }];
    }),
  );

  return {
    games: n,
    team: tally.team,
    perGame: Object.fromEntries(Object.entries(tally.team).map(([key, total]) => [key, total / n])),
    personal: tally.personal,
    // How much of the team's haul was yours, e.g. 0.3 = you took 30% of your team's towers.
    share: {
      turrets: tally.team.tower ? tally.personal.turrets / tally.team.tower : 0,
      dragons: tally.team.dragon ? tally.personal.dragons / tally.team.dragon : 0,
      barons: tally.team.baron ? tally.personal.barons / tally.team.baron : 0,
    },
    firsts,
  };
}

/** One personalised line for the objectives slide, most striking fact first. */
export function getObjectiveInsight(obj, t = defaultT) {
  const { personal, share, firsts, team } = obj;

  if (personal.stolen >= 2) return t("insights.objectives.stolen", { count: personal.stolen });

  // The objective whose "first one" moves your win rate the most, when the gap is big enough to trust.
  const swing = Object.entries(firsts)
    .filter(([, f]) => f.winRateWith != null && f.winRateWithout != null)
    .map(([key, f]) => ({ key, gap: f.winRateWith - f.winRateWithout, f }))
    .sort((a, b) => b.gap - a.gap)[0];
  const first = { tower: "firstTower", dragon: "firstDragon", herald: "firstHerald", baron: "firstBaron" };
  if (swing && swing.gap >= 0.15) {
    return t(`insights.objectives.${first[swing.key]}`, { withIt: t.percent(swing.f.winRateWith), without: t.percent(swing.f.winRateWithout) });
  }

  if (share.turrets >= 0.3) return t("insights.objectives.turrets", { share: t.percent(share.turrets) });
  if (personal.barons >= 2) return t("insights.objectives.barons", { count: personal.barons });
  if (personal.dragons >= 5) return t("insights.objectives.dragons", { count: personal.dragons });
  return t("insights.objectives.default", { dragons: team.dragon, towers: team.tower });
}
