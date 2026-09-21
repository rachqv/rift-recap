import { redirect } from "next/navigation";
import RememberPlayer from "@/components/RememberPlayer";
import SetupShell from "@/components/squad/SetupShell";
import VersusForm from "@/components/squad/VersusForm";
import VersusView from "@/components/squad/VersusView";
import { getLocale, getT } from "@/lib/i18n/server";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { errorMessage } from "@/lib/recap/load";
import { paramPairs, rangeLinks, withRange } from "@/lib/recap/range";
import { RiotApiError } from "@/lib/riot/client";
import { getChampionIndex } from "@/lib/riot/ddragon";
import { isPlatform } from "@/lib/riot/regions";
import { decodeSnapshot } from "@/lib/snapshot";
import { getDemoVersus } from "@/lib/squad/demo";
import { loadVersus } from "@/lib/squad/load";
import { formatRiotId, parseRiotId, parseVersusParams, versusCardPath, versusPath } from "@/lib/squad/parse";

const one = (value) => (Array.isArray(value) ? value[0] : value);
const idOf = (slot) => (slot ? formatRiotId(slot) : "");

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const [locale, t] = [await getLocale(), await getT()];
  if (sp.demo != null) return { title: t("versus.page.titleDemo") };

  const { a, b } = parseVersusParams(sp);
  if (!a || !b) return { title: t("versus.page.titleEmpty") };

  const title = t("versus.page.title", { a: a.gameName, b: b.gameName });
  const description = t("versus.page.description");
  // The card has no cookie to say which language, so the link carries it.
  const card = `${versusCardPath(a, b)}&format=og&lang=${locale}`;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: "website", images: [{ url: card, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [card] },
  };
}

/** The form posts separate fields (ra/ia, rb/ib): redirect to the canonical shareable link when both read, else show the form again. */
function formPostPage(sp, t) {
  const [ra, rb] = [one(sp.ra), one(sp.rb)];
  const [ia, ib] = [parseRiotId(one(sp.ia)), parseRiotId(one(sp.ib))];
  const slotA = ia && isPlatform(ra) ? { region: ra, ...ia } : null;
  const slotB = ib && isPlatform(rb) ? { region: rb, ...ib } : null;
  if (slotA && slotB) redirect(versusPath(slotA, slotB));

  const bad = t.list([!slotA && t("versus.page.first"), !slotB && t("versus.page.second")].filter(Boolean));
  return (
    <SetupShell>
      <VersusForm
        a={{ region: isPlatform(ra) ? ra : undefined, id: String(one(sp.ia) ?? "") }}
        b={{ region: isPlatform(rb) ? rb : undefined, id: String(one(sp.ib) ?? "") }}
        error={t("versus.page.unreadableTwo", { who: bad })}
      />
    </SetupShell>
  );
}

export default async function VersusPage({ searchParams }) {
  const sp = await searchParams;
  const range = rangeOf(sp.range);
  const [locale, t] = [await getLocale(), await getT()];

  if (sp.demo != null) {
    const [data, index] = [getDemoVersus(), await getChampionIndex(locale)];
    return <VersusView data={data} index={index} share={{ cardUrl: "/versus/card?demo=1" }} since={decodeSnapshot(sp.since)} t={t} />;
  }

  if (sp.ia !== undefined || sp.ib !== undefined) return formPostPage(sp, t);

  const { a, b } = parseVersusParams(sp);
  // `offerRanges` is for the "no games in this time range" error: the other ranges are shown right under it.
  const form = (error, offerRanges = false) => (
    <SetupShell>
      <VersusForm
        a={{ region: a?.region, id: idOf(a) }}
        b={{ region: b?.region, id: idOf(b) }}
        error={error}
        ranges={offerRanges && range !== "season" ? rangeLinks("/versus", paramPairs(sp), range, t) : undefined}
      />
    </SetupShell>
  );

  if (!a || !b) {
    // `a` alone is a prefilled form (a link from a recap); anything else malformed is worth saying.
    const malformed = (sp.a !== undefined && !a) || (sp.b !== undefined && !b);
    return form(malformed ? t("versus.page.malformed") : null);
  }

  let result;
  try {
    result = await loadVersus(a, b, { since: RANGES[range].since(), locale });
  } catch (error) {
    if (!(error instanceof RiotApiError)) throw error;
    if (error.status === 404) return form(t("versus.page.notFound"));
    return form(errorMessage(t, error));
  }

  if (result.error === "same") return form(t("versus.page.same"));

  const quiet = [result.a, result.b].filter((p) => p.recap.games === 0);
  if (quiet.length > 0) {
    const names = t.list(quiet.map((p) => `${p.account.gameName}#${p.account.tagLine}`));
    return form(t("versus.page.noGames", { names, since: t.date(RANGES[range].since(), { dateStyle: "medium", timeZone: "UTC" }) }), true);
  }

  return (
    <>
      {[result.a, result.b].map((player) => (
        <RememberPlayer key={player.account.puuid} gameName={player.account.gameName} tagLine={player.account.tagLine} region={player.region} />
      ))}
      <VersusView data={result} index={result.a.index} share={{ cardUrl: withRange(versusCardPath(a, b), range) }} since={decodeSnapshot(sp.since)} ranges={rangeLinks("/versus", paramPairs(sp), range, t)} t={t} />
    </>
  );
}
