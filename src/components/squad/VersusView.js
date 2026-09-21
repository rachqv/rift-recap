import Background from "@/components/Background";
import Story from "@/components/recap/Story";
import { defaultT } from "@/lib/i18n/en";
import { pickSplashes } from "@/lib/riot/skins";
import { artSeed } from "@/lib/recap/art";
import { championName } from "@/lib/riot/ddragon";
import { buildScenarios } from "@/lib/squad/scenarios";
import { compareToRematch, readRematch, rematchSnapshot } from "@/lib/squad/rematch";
import { compareRecaps, withSummary } from "@/lib/squad/versus";
import {
  SplitArt,
  VersusFaceOffSlide,
  VersusIntroSlide,
  VersusRhythmSlide,
  VersusScenarioSlide,
  VersusStatsSlide,
  VersusStyleSlide,
  VersusTimelineSlide,
  VersusTogetherSlide,
  VersusVerdictSlide,
} from "./versusSlides";

const recapPath = (region, account) => `/recap/${region}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}`;

// Same bar the recap uses for its calendar: enough games, on enough different days, for the hours to mean something.
const hasRhythm = (activity) => activity?.length >= 8 && new Set(activity.map((game) => Math.floor(game.t / 86400000))).size >= 4;

/**
 * The head-to-head story. `data` is `{ a, b, together, faceOff }` (from `loadVersus` or the demo), where a and b are
 * loaded recaps with at least one game each, `together` is stats over the games they played as teammates and `faceOff`
 * is their record as opponents (each null when there are no such games). `since` is a decoded `?since=` value from an
 * earlier visit, which adds a rematch comparison to the verdict when it was saved for these same two players. `t` writes
 * every word of it.
 */
export default async function VersusView({ data, index, share, since, ranges, t = defaultT }) {
  const [a, b] = [withSummary(data.a, index, t), withSummary(data.b, index, t)];
  const comparison = compareRecaps(a.recap, b.recap, t);
  const sameServer = a.region === b.region;
  const saved = readRematch(since, a, b);
  const rematch = saved ? { ...compareToRematch(saved, comparison, a, b, t), time: saved.time } : null;

  // Three skins each: the first is the intro backdrop, the rest are the verdict's.
  const [skinsA, skinsB] = await Promise.all([
    pickSplashes(index, a.recap.topChampions[0].id, { count: 3, seed: artSeed(a.account) }),
    pickSplashes(index, b.recap.topChampions[0].id, { count: 3, seed: artSeed(b.account) }),
  ]);
  const [artA, artB] = [skinsA[0], skinsB[0]];
  const rest = (skins) => (skins.length > 1 ? skins.slice(1) : skins); // a champion with one usable skin reuses it
  const verdictArt = { a: rest(skinsA), b: rest(skinsB) };

  const version = index.version;
  const aName = a.account.gameName;
  const bName = b.account.gameName;

  // Themed side bets between the two, from data the stat rows don't use. Each one is a slide of its own.
  const scenarios = buildScenarios(a, b, { t, nameOf: (id) => championName(index, id) });

  const slides = [
    [t("versus.rail.start"), <VersusIntroSlide t={t} key="intro" a={a} b={b} version={version} sameServer={sameServer} ranges={ranges} backdrop={<SplitArt left={artA} right={artB} />} />],
    [t("versus.rail.numbers"), <VersusStatsSlide t={t} key="stats" comparison={comparison} aName={aName} bName={bName} />],
    [t("versus.rail.styles"), <VersusStyleSlide t={t} key="style" a={a} b={b} index={index} />],
    ...scenarios.scenarios.map((scenario, i) => [
      scenario.title,
      <VersusScenarioSlide t={t} key={scenario.id} scenario={scenario} position={i + 1} total={scenarios.scenarios.length} a={a} b={b} version={version} />,
    ]),
    hasRhythm(a.activity) && hasRhythm(b.activity) && [
      t("versus.rail.hours"),
      <VersusRhythmSlide t={t} key="rhythm" a={{ name: aName, activity: a.activity }} b={{ name: bName, activity: b.activity }} />,
    ],
    data.together && [t("versus.rail.together"), <VersusTogetherSlide t={t} key="together" together={data.together} synergy={data.synergy} carry={data.carry} aName={aName} bName={bName} />],
    data.faceOff && [t("versus.rail.faceoff"), <VersusFaceOffSlide t={t} key="faceoff" faceOff={data.faceOff} aName={aName} bName={bName} index={index} />],
    data.faceOff?.timeline && [t("versus.rail.timeline"), <VersusTimelineSlide t={t} key="timeline" timeline={data.faceOff.timeline} aName={aName} bName={bName} />],
    [
      t("versus.rail.verdict"),
      <VersusVerdictSlide
        t={t}
        key="verdict"
        comparison={comparison}
        sideBets={scenarios.scenarios.length > 0 ? scenarios.sideBets : null}
        a={a}
        b={b}
        share={share}
        index={index}
        art={verdictArt}
        rematch={rematch}
        snapshot={rematchSnapshot(a, b, comparison)}
        region={sameServer ? a.region : null}
        aHref={recapPath(a.region, a.account)}
        bHref={recapPath(b.region, b.account)}
      />,
    ],
  ].filter(Boolean);

  return (
    <>
      <Background showChampions={false} />
      {/* Reveal animations start hidden and are triggered by JS; without it, show everything. */}
      <noscript>
        <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <Story labels={slides.map(([label]) => label)} ids={slides.map(([, slide]) => slide.key)}>{slides.map(([, slide]) => slide)}</Story>
    </>
  );
}
