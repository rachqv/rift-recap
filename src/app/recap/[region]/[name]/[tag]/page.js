import { notFound } from "next/navigation";
import RangeSwitch from "@/components/RangeSwitch";
import RememberPlayer from "@/components/RememberPlayer";
import RecapMessage, { OtherServers } from "@/components/recap/RecapMessage";
import RecapView from "@/components/recap/RecapView";
import { getLocale, getT } from "@/lib/i18n/server";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { errorMessage, loadRecap, safeDecode } from "@/lib/recap/load";
import { readRecapSnapshot } from "@/lib/recap/progress";
import { paramPairs, rangeLinks, withRange } from "@/lib/recap/range";
import { RiotApiError } from "@/lib/riot/client";
import { isPlatform } from "@/lib/riot/regions";
import { decodeSnapshot } from "@/lib/snapshot";

const encode = encodeURIComponent;

// Depending on the Next version, params arrive encoded or decoded. Decoding then encoding gives the same
// result either way (Riot IDs never contain a literal '%').
const routePath = (region, name, tag) => `/recap/${region}/${encode(safeDecode(name))}/${encode(safeDecode(tag))}`;

export async function generateMetadata({ params }) {
  const { region, name, tag } = await params;
  const [locale, t] = [await getLocale(), await getT()];
  const title = t("recap.page.title", { name: safeDecode(name), tag: safeDecode(tag) });
  const description = t("recap.page.description");
  // Link previews use the share card, drawn on demand by the card route. It has no cookie, so the language goes in the link.
  const card = `${routePath(region, name, tag)}/card?format=og&lang=${locale}`;
  return {
    title,
    description,
    // Shared links still preview (bots read the page), but individual players don't belong in search results.
    robots: { index: false },
    openGraph: { title, description, type: "website", images: [{ url: card, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [card] },
  };
}

export default async function RecapPage({ params, searchParams }) {
  const { region, name, tag } = await params;
  const sp = await searchParams;
  const { since } = sp;
  const [locale, t] = [await getLocale(), await getT()];
  const range = rangeOf(sp.range);
  if (!isPlatform(region)) notFound();

  let data;
  try {
    data = await loadRecap(region, safeDecode(name), safeDecode(tag), { extras: true, since: RANGES[range].since(), previous: RANGES[range].previous?.(), locale });
  } catch (err) {
    if (!(err instanceof RiotApiError)) throw err;
    return (
      <RecapMessage title={t("recap.page.failed")} t={t}>
        {errorMessage(t, err)}
      </RecapMessage>
    );
  }

  const path = routePath(region, data.account.gameName, data.account.tagLine);

  if (data.recap.games === 0) {
    // No games often means the wrong server (a player's games are kept per regional cluster), so offer the other ones.
    const servers = <OtherServers region={region} t={t} hrefFor={(id) => withRange(routePath(id, data.account.gameName, data.account.tagLine), range)} />;
    const who = `${data.account.gameName}#${data.account.tagLine}`;
    const since = t.date(RANGES[range].since(), { dateStyle: "medium", timeZone: "UTC" });
    // The season is the longest range, so with no games in it there is nothing longer to offer. Any shorter one has other
    // ranges to try, and the switch that normally does that lives on a slide that only exists when there are games.
    if (range === "season") {
      return (
        <RecapMessage title={t("recap.page.noGamesTitle")} t={t} actions={servers}>
          {t("recap.page.noGames", { who, since })}
        </RecapMessage>
      );
    }
    return (
      <RecapMessage
        title={t("recap.page.noRangeTitle")}
        t={t}
        actions={
          <>
            <RangeSwitch links={rangeLinks(path, paramPairs(sp), range, t)} label={t("common.range.label")} />
            {servers}
          </>
        }
      >
        {t("recap.page.noRange", { who, since })}
      </RecapMessage>
    );
  }
  return (
    <>
      <RememberPlayer gameName={data.account.gameName} tagLine={data.account.tagLine} region={region} />
      <RecapView
        {...data}
        region={region}
        share={{ cardUrl: withRange(`${path}/card`, range) }}
        championHref={(id) => withRange(`${path}/champion/${encode(id)}`, range)}
        saved={readRecapSnapshot(decodeSnapshot(since))}
        range={range}
        ranges={rangeLinks(path, paramPairs(sp), range, t)}
        t={t}
      />
    </>
  );
}
