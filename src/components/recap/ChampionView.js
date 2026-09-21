import Link from "next/link";
import Background from "@/components/Background";
import { defaultT } from "@/lib/i18n/en";
import { artSeed, resolveArt } from "@/lib/recap/art";
import { getChampionLine } from "@/lib/recap/championRecap";
import { pickFavoriteItems } from "@/lib/recap/items";
import { getPatchForm } from "@/lib/recap/patches";
import { getInsights } from "@/lib/recap/persona";
import { getHighlights } from "@/lib/recap/playstyle";
import { pickKeystones } from "@/lib/recap/runes";
import { championName, getItemIndex, getRuneIndex } from "@/lib/riot/ddragon";
import { ItemsSlide, PatchSlide, RunesSlide } from "./dataSlides";
import { HighlightsSlide } from "./extraSlides";
import Slide, { Reveal } from "./Slide";
import Story from "./Story";
import { ChampionSlide, KdaSlide, WinSlide } from "./slides";
import { MatchupSlide } from "./socialSlides";
import base from "./slides.module.css";

/** The last slide: a way back to the full recap. */
function BackSlide({ href, t }) {
  return (
    <Slide>
      <Reveal i={0} className={base.actions}>
        <Link href={href} className={base.button}>
          {t("recap.champion.back")}
        </Link>
      </Reveal>
    </Slide>
  );
}

/**
 * One champion's story: the recap's own slides, over just the games on that champion. `recap` is `buildChampionRecap`'s result and
 * `overall` is your win rate over all your games, to compare it with. `backHref` is the full recap. Slides without enough data (no
 * runes, no matchups, too few patches) are skipped, like in the main recap.
 */
export default async function ChampionView({ account, recap, overall, index, backHref, t = defaultT }) {
  const top = recap.topChampions[0];
  const name = championName(index, top.id);
  // The main recap's lines, except the one about the top champion, which would say "100% of your games were this one".
  const insights = { ...getInsights(recap, name, t), champion: getChampionLine(recap, overall, name, t) };

  const [art, itemIndex, runeIndex] = await Promise.all([
    resolveArt({ recap, modes: {}, index, seed: `${artSeed(account)}:${top.id}` }),
    getItemIndex(index.version, index.locale),
    getRuneIndex(index.version, index.locale),
  ]);
  const items = pickFavoriteItems(recap.items, itemIndex, recap);
  const runes = pickKeystones(recap.keystones, runeIndex);
  const highlights = getHighlights(recap, t);
  const patchForm = getPatchForm(recap);

  const slides = [
    [t("recap.rail.champion"), <ChampionSlide t={t} key="champion" recap={recap} index={index} insights={insights} art={art.champion} eyebrow={t("recap.champion.pageEyebrow")} />],
    [t("recap.rail.wins"), <WinSlide t={t} key="wins" recap={recap} insights={insights} />],
    [t("recap.rail.combat"), <KdaSlide t={t} key="kda" recap={recap} index={index} insights={insights} art={art.kda} />],
    highlights && [t("recap.rail.highlights"), <HighlightsSlide t={t} key="highlights" games={highlights} index={index} />],
    runes && [t("recap.rail.runes"), <RunesSlide t={t} key="runes" picks={runes} />],
    items && [t("recap.rail.items"), <ItemsSlide t={t} key="items" picks={items} index={index} games={recap.games} />],
    (recap.nemesis || recap.bestMatchup) && [t("recap.rail.matchups"), <MatchupSlide t={t} key="matchups" nemesis={recap.nemesis} bestMatchup={recap.bestMatchup} index={index} art={art} />],
    patchForm && [t("recap.rail.patches"), <PatchSlide t={t} key="patches" form={patchForm} />],
    [t("recap.rail.back"), <BackSlide t={t} key="back" href={backHref} />],
  ].filter(Boolean);

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
