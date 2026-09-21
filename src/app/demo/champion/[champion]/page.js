import { notFound } from "next/navigation";
import ChampionView from "@/components/recap/ChampionView";
import RecapMessage from "@/components/recap/RecapMessage";
import { getLocale, getT } from "@/lib/i18n/server";
import { buildChampionRecap } from "@/lib/recap/championRecap";
import { DEMO_STYLES, getDemoData } from "@/lib/recap/demo";
import { safeDecode } from "@/lib/recap/load";
import { championId, championName, getChampionIndex } from "@/lib/riot/ddragon";

// One champion's story for a sample player: `/demo/champion/Ahri?style=slayer`. Needs no Riot API key.
export default async function DemoChampionPage({ params, searchParams }) {
  const { champion } = await params;
  const { style } = await searchParams;
  const current = DEMO_STYLES.includes(style) ? style : "slayer";
  const [locale, t] = [await getLocale(), await getT()];
  const index = await getChampionIndex(locale);
  const id = safeDecode(champion);
  if (!index.byId[id]) notFound();

  const data = getDemoData(current);
  const backHref = `/demo?style=${current}`;
  const recap = buildChampionRecap(data.matches, "demo", id, championId);
  if (!recap) {
    return (
      <RecapMessage title={t("recap.champion.noneTitle")} t={t} actions={<a href={backHref}>{t("recap.champion.back")}</a>}>
        {t("recap.champion.none", { who: data.account.gameName, champion: championName(index, id) })}
      </RecapMessage>
    );
  }
  return <ChampionView account={data.account} recap={recap} overall={data.recap.winRate} index={index} backHref={backHref} t={t} />;
}
