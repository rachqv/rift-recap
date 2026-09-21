import Background from "@/components/Background";
import Story from "@/components/recap/Story";
import { defaultT } from "@/lib/i18n/en";
import { teamName } from "@/lib/squad/clash";
import { squadPath } from "@/lib/squad/parse";
import { ClashEndSlide, ClashIntroSlide, ClashLanesSlide, ClashNumbersSlide, ClashStarsSlide } from "./clashSlides";

/**
 * The squad vs squad story. `data` is `{ region, a, b, clash }` (from `loadClash` or the demo), `a` and `b` the squads' members
 * and `clash` the result of `buildClash` (there has to be one: the page says so when the squads never met). Lanes and standouts are
 * left out when there are none.
 */
export default function ClashView({ data, ranges, t = defaultT }) {
  const { clash } = data;
  const teams = {
    a: { name: teamName(data.a, t), members: data.a },
    b: { name: teamName(data.b, t), members: data.b },
  };
  const hrefs = { a: squadPath(data.region, data.a), b: squadPath(data.region, data.b) };

  const slides = [
    [t("clash.rail.start"), <ClashIntroSlide t={t} key="intro" clash={clash} teams={teams} ranges={ranges} />],
    clash.lanes.length > 0 && [t("clash.rail.lanes"), <ClashLanesSlide t={t} key="lanes" lanes={clash.lanes} />],
    [t("clash.rail.numbers"), <ClashNumbersSlide t={t} key="numbers" clash={clash} teams={teams} />],
    (clash.stars.a || clash.stars.b) && [t("clash.rail.stars"), <ClashStarsSlide t={t} key="stars" stars={clash.stars} teams={teams} />],
    [t("clash.rail.end"), <ClashEndSlide t={t} key="end" teams={teams} hrefs={hrefs} />],
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
