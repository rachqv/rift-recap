import Background from "@/components/Background";
import { defaultT } from "@/lib/i18n/en";
import { artSeed, resolveArt } from "@/lib/recap/art";
import { SEASON_START } from "@/lib/recap/config";
import { getBingo } from "@/lib/recap/bingo";
import { getBlame } from "@/lib/recap/blame";
import { pickKeystones } from "@/lib/recap/runes";
import { getPatchForm } from "@/lib/recap/patches";
import { getPoolAdvice } from "@/lib/recap/pool";
import { getFormCurve } from "@/lib/recap/formcurve";
import { getComfort, getGrayScreen, getTilt } from "@/lib/recap/form";
import { getHabits } from "@/lib/recap/habits";
import { getOldFlames } from "@/lib/recap/mastery";
import { getDamageProfile, getGoldHabits, getHighlights, getLaneCheck, getTeamComp } from "@/lib/recap/playstyle";
import { compareToSnapshot, recapSnapshot } from "@/lib/recap/progress";
import { pickFavoriteItems } from "@/lib/recap/items";
import { getWinClock } from "@/lib/recap/clock";
import { getSessions } from "@/lib/recap/sessions";
import { getWeekCompare } from "@/lib/recap/week";
import { getTiltGuard } from "@/lib/recap/tiltguard";
import { buildSummary } from "@/lib/recap/summary";
import { getTierList } from "@/lib/recap/tierlist";
import { squadPath, versusPath } from "@/lib/squad/parse";
import { championId, getItemIndex, getRuneIndex } from "@/lib/riot/ddragon";
import { pickSplashes } from "@/lib/riot/skins";
import { BlameSlide, CalendarSlide, ClockSlide, ComfortSlide, FormCurveSlide, GrayScreenSlide, HabitsSlide, ItemsSlide, ObjectivesSlide, PatchSlide, PoolSlide, ProgressSlide, RunesSlide, TierListSlide, TiltGuardSlide, TiltSlide, TrophiesSlide, WeekSlide } from "./dataSlides";
import { DamageProfileSlide, EarlyGameSlide, HighlightsSlide, LaneSlide, OldFlamesSlide, SessionsSlide, TeamCompSlide } from "./extraSlides";
import Story from "./Story";
import {
  ChampionSlide,
  GamesSlide,
  IntroSlide,
  KdaSlide,
  ModeSlide,
  PersonaSlide,
  PlaystyleSlide,
  RankSlide,
  WinSlide,
} from "./slides";
import { DuoSlide, MatchupSlide } from "./socialSlides";

const encode = encodeURIComponent;

const tagsOf = (index) => (id) => index.byId[championId(id)]?.tags;

/** A calendar needs a few different days to say anything (UTC days are close enough for this check). */
const hasEnoughDays = (activity) => activity?.length >= 8 && new Set(activity.map((a) => Math.floor(a.t / 86400000))).size >= 4;

/** The reads of the recap itself: what each slide is built from, most of them null when there is too little to say. */
function readStats({ recap, index, mastery, t }) {
  return {
    tilt: getTilt(recap, t),
    comfort: getComfort(recap),
    grayScreen: getGrayScreen(recap),
    blame: getBlame(recap, t),
    tierList: getTierList(recap),
    habits: getHabits(recap, t),
    bingo: getBingo(recap, t),
    damage: getDamageProfile(recap, t),
    lane: getLaneCheck(recap, t),
    gold: getGoldHabits(recap, t),
    comp: getTeamComp(recap, tagsOf(index), t),
    highlights: getHighlights(recap, t),
    pool: getPoolAdvice(recap, index.byId, championId),
    formCurve: getFormCurve(recap),
    patchForm: getPatchForm(recap),
    flames: getOldFlames(mastery, recap, index.byKey),
  };
}

/** The reads that need more than the recap: the games one by one (`activity`), the week before, or a saved snapshot. */
function readHistory({ recap, activity, before, saved, t }, rank) {
  const showCalendar = hasEnoughDays(activity);
  return {
    showCalendar,
    // Which weekday and hour a game fell on depends on the viewer's time zone, so the slide is drawn in the browser. This
    // only checks there are enough games for it to have something to say (it is null with too few).
    showClock: showCalendar && getWinClock(activity) != null,
    // The 7 days before, when there are some (only the "last 7 days" range loads them), to say what changed.
    week: before ? getWeekCompare(recap, before.recap, t) : null,
    sessions: getSessions(activity),
    tiltGuard: activity ? getTiltGuard(activity) : null,
    progress: saved ? compareToSnapshot(saved, recap, rank, t) : null,
  };
}

/** Ways to bring other people in: compare with your duo, a friend, or start a squad with yourself filled in. */
function readLinks({ recap, account, region }) {
  const duoHref = region && recap.duo?.tagLine ? `/recap/${region}/${encode(recap.duo.gameName)}/${encode(recap.duo.tagLine)}` : null;
  const me = region ? { region, gameName: account.gameName, tagLine: account.tagLine } : null;
  const versusHref = me && recap.duo?.tagLine ? versusPath(me, { region, gameName: recap.duo.gameName, tagLine: recap.duo.tagLine }) : null;
  const links = me ? { compare: versusPath(me), squad: squadPath(region, [me]) } : null;
  return { duoHref, versusHref, links };
}

/** Everything the slides are built from: the props, plus what is worked out (and fetched) from them. */
async function readView(props) {
  const { account, recap, modes, rankedEntries, index, range, t } = props;
  const { insights, persona, rank } = buildSummary({ recap, rankedEntries, index }, t);
  const [art, itemIndex, runeIndex] = await Promise.all([
    resolveArt({ recap, modes, index, seed: artSeed(account) }),
    getItemIndex(index.version, index.locale),
    getRuneIndex(index.version, index.locale),
  ]);
  const stats = readStats(props);
  // The champion that lifts your win rate the most gets the comfort slide's backdrop.
  const [comfortArt] = stats.comfort ? await pickSplashes(index, stats.comfort.best.id, { seed: `${artSeed(account)}:comfort` }) : [];

  return {
    ...props,
    ...stats,
    ...readHistory(props, rank),
    ...readLinks(props),
    insights,
    persona,
    rank,
    art,
    comfortArt,
    items: pickFavoriteItems(recap.items, itemIndex, recap),
    runes: pickKeystones(recap.keystones, runeIndex),
    season: range === "season" ? t("recap.season", { year: SEASON_START.getUTCFullYear() }) : t(`common.range.${range}`),
  };
}

// Each slide group is a list of [label for the progress rail, slide]. Slides without enough data (no duo, no matchups,
// no ARAM, no normals, unranked) are false, and dropped when the groups are put together.

function openingSlides({ t, account, summoner, index, recap, totalGames, season, art, ranges, insights, riftOnly, week, formCurve, share, showCalendar, activity, showClock, patchForm, sessions, progress, saved }) {
  return [
    [t("recap.rail.start"), <IntroSlide t={t} key="intro" account={account} summoner={summoner} index={index} recap={recap} totalGames={totalGames} season={season} art={art.intro} ranges={ranges} />],
    [t("recap.rail.games"), <GamesSlide t={t} key="games" recap={recap} insights={insights} riftOnly={riftOnly} />],
    week && [t("recap.rail.week"), <WeekSlide t={t} key="week" week={week} />],
    formCurve && [t("recap.rail.form"), <FormCurveSlide t={t} key="form" curve={formCurve} share={share} />],
    showCalendar && [t("recap.rail.calendar"), <CalendarSlide t={t} key="calendar" activity={activity} />],
    showClock && [t("recap.rail.clock"), <ClockSlide t={t} key="clock" activity={activity} />],
    patchForm && [t("recap.rail.patches"), <PatchSlide t={t} key="patches" form={patchForm} />],
    sessions && [t("recap.rail.nights"), <SessionsSlide t={t} key="nights" sessions={sessions} />],
    [t("recap.rail.wins"), <WinSlide t={t} key="wins" recap={recap} insights={insights} />],
    progress?.rows.length > 0 && [t("recap.rail.progress"), <ProgressSlide t={t} key="progress" progress={progress} saved={saved} games={recap.games} art={art.kda} />],
  ];
}

function performanceSlides({ t, recap, index, insights, art, championHref, tilt, tiltGuard, blame, comfort, comfortArt, flames, tierList, pool, highlights, damage, grayScreen }) {
  return [
    tilt && [t("recap.rail.tilt"), <TiltSlide t={t} key="tilt" tilt={tilt} />],
    tiltGuard && [t("recap.rail.tiltGuard"), <TiltGuardSlide t={t} key="tiltguard" guard={tiltGuard} />],
    blame && [t("recap.rail.blame"), <BlameSlide t={t} key="blame" blame={blame} />],
    [t("recap.rail.champion"), <ChampionSlide t={t} key="champion" recap={recap} index={index} insights={insights} art={art.champion} moreHref={championHref?.(recap.topChampions[0].id)} />],
    comfort && [t("recap.rail.comfort"), <ComfortSlide t={t} key="comfort" comfort={comfort} recap={recap} index={index} art={comfortArt} />],
    flames && [t("recap.rail.flames"), <OldFlamesSlide t={t} key="flames" flames={flames} index={index} />],
    tierList && [t("recap.rail.tierList"), <TierListSlide t={t} key="tiers" tierList={tierList} index={index} />],
    pool && [t("recap.rail.pool"), <PoolSlide t={t} key="pool" advice={pool} index={index} />],
    [t("recap.rail.combat"), <KdaSlide t={t} key="kda" recap={recap} index={index} insights={insights} art={art.kda} />],
    highlights && [t("recap.rail.highlights"), <HighlightsSlide t={t} key="highlights" games={highlights} index={index} />],
    damage && [t("recap.rail.damage"), <DamageProfileSlide t={t} key="damage" profile={damage} />],
    grayScreen && [t("recap.rail.gray"), <GrayScreenSlide t={t} key="gray" grayScreen={grayScreen} />],
  ];
}

function playstyleSlides({ t, recap, index, lane, gold, earlyGame, habits, items, runes }) {
  return [
    [t("recap.rail.playstyle"), <PlaystyleSlide t={t} key="style" recap={recap} index={index} />],
    (lane || gold) && [t("recap.rail.lane"), <LaneSlide t={t} key="lane" lane={lane} gold={gold} />],
    earlyGame && [t("recap.rail.early"), <EarlyGameSlide t={t} key="early" early={earlyGame} />],
    habits && [t("recap.rail.habits"), <HabitsSlide t={t} key="habits" habits={habits} />],
    items && [t("recap.rail.items"), <ItemsSlide t={t} key="items" picks={items} index={index} games={recap.games} />],
    runes && [t("recap.rail.runes"), <RunesSlide t={t} key="runes" picks={runes} />],
    recap.objectives && [t("recap.rail.objectives"), <ObjectivesSlide t={t} key="objectives" objectives={recap.objectives} />],
  ];
}

function socialAndModeSlides({ t, recap, account, summoner, index, art, duoHref, versusHref, comp, modes }) {
  return [
    recap.duo && [t("recap.rail.duo"), <DuoSlide t={t} key="duo" duo={recap.duo} account={account} summoner={summoner} index={index} art={art.duo} profileHref={duoHref} versusHref={versusHref} />],
    (recap.nemesis || recap.bestMatchup) && [t("recap.rail.matchups"), <MatchupSlide t={t} key="matchups" nemesis={recap.nemesis} bestMatchup={recap.bestMatchup} index={index} art={art} />],
    comp && [t("recap.rail.comps"), <TeamCompSlide t={t} key="comp" comp={comp} />],
    modes.normal && [t("recap.rail.normals"), <ModeSlide t={t} key="normal" mode="normal" stats={modes.normal} rift={recap} ranked={modes.ranked} index={index} art={art.normal} />],
    modes.aram && [t("recap.rail.aram"), <ModeSlide t={t} key="aram" mode="aram" stats={modes.aram} rift={recap} ranked={modes.ranked} index={index} art={art.aram} />],
  ];
}

function closingSlides({ t, recap, index, bingo, share, rank, persona, art, links }) {
  return [
    bingo.unlocked > 0 && [t("recap.rail.trophies"), <TrophiesSlide t={t} key="trophies" bingo={bingo} share={share} />],
    rank && [t("recap.rail.rank"), <RankSlide t={t} key="rank" rank={rank} />],
    [t("recap.rail.you"), <PersonaSlide t={t} key="persona" persona={persona} recap={recap} index={index} art={art.persona} share={share} links={links} snapshot={recapSnapshot(recap, persona, rank)} />],
  ];
}

/**
 * The full recap story. Expects a recap with at least one game.
 * `region` enables links to other players' recaps; `share` is `{ cardUrl }` for the share buttons. `saved` is a snapshot
 * from an earlier visit (`readRecapSnapshot`), which adds a "since last time" slide. `t` writes every word of it: the language of
 * the page (English when omitted).
 */
export default async function RecapView({ range = "season", t = defaultT, ...props }) {
  const view = await readView({ ...props, range, t });
  const slides = [openingSlides(view), performanceSlides(view), playstyleSlides(view), socialAndModeSlides(view), closingSlides(view)].flat().filter(Boolean);

  return (
    <>
      <Background showChampions={false} />
      {/* Reveal animations start hidden and are triggered by JS; without it, show everything. */}
      <noscript>
        <style>{"[data-reveal]{opacity:1!important;transform:none!important}[data-bar]{stroke-dashoffset:var(--off)!important}"}</style>
      </noscript>
      <Story labels={slides.map(([label]) => label)} ids={slides.map(([, slide]) => slide.key)}>{slides.map(([, slide]) => slide)}</Story>
    </>
  );
}
