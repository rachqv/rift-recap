import { notFound } from "next/navigation";
import ChampionView from "@/components/recap/ChampionView";
import RecapMessage from "@/components/recap/RecapMessage";
import { getLocale, getT } from "@/lib/i18n/server";
import { buildChampionRecap } from "@/lib/recap/championRecap";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { errorMessage, loadRecap, safeDecode } from "@/lib/recap/load";
import { withRange } from "@/lib/recap/range";
import { RiotApiError } from "@/lib/riot/client";
import { championId, championName, getChampionIndex } from "@/lib/riot/ddragon";
import { isPlatform } from "@/lib/riot/regions";

const encode = encodeURIComponent;

// One champion's story for a player: `/recap/euw1/Name/TAG/champion/Ahri`. The champion is Data Dragon's id, and `?range=` works like
// on the full recap. It reads the same games the full recap does, so it costs no extra Riot requests.
export async function generateMetadata({ params }) {
  const { name, tag, champion } = await params;
  const [locale, t] = [await getLocale(), await getT()];
  const index = await getChampionIndex(locale);
  const title = t("recap.champion.pageTitle", { champion: championName(index, safeDecode(champion)), name: safeDecode(name), tag: safeDecode(tag) });
  // Players don't belong in search results, and there is no card of their own for one champion.
  return { title, robots: { index: false } };
}

export default async function ChampionPage({ params, searchParams }) {
  const { region, name, tag, champion } = await params;
  const sp = await searchParams;
  const [locale, t] = [await getLocale(), await getT()];
  const range = rangeOf(sp.range);
  if (!isPlatform(region)) notFound();

  let data;
  try {
    data = await loadRecap(region, safeDecode(name), safeDecode(tag), { since: RANGES[range].since(), locale });
  } catch (err) {
    if (!(err instanceof RiotApiError)) throw err;
    return (
      <RecapMessage title={t("recap.page.failed")} t={t}>
        {errorMessage(t, err)}
      </RecapMessage>
    );
  }

  const id = safeDecode(champion);
  if (!data.index.byId[id]) notFound(); // not a champion Data Dragon knows
  const backHref = withRange(`/recap/${region}/${encode(data.account.gameName)}/${encode(data.account.tagLine)}`, range);

  const recap = buildChampionRecap(data.matches, data.account.puuid, id, championId);
  if (!recap) {
    return (
      <RecapMessage title={t("recap.champion.noneTitle")} t={t} actions={<a href={backHref}>{t("recap.champion.back")}</a>}>
        {t("recap.champion.none", { who: `${data.account.gameName}#${data.account.tagLine}`, champion: championName(data.index, id) })}
      </RecapMessage>
    );
  }
  return <ChampionView account={data.account} recap={recap} overall={data.recap.winRate} index={data.index} backHref={backHref} t={t} />;
}
