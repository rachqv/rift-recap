import RememberPlayer from "@/components/RememberPlayer";
import SetupShell from "@/components/squad/SetupShell";
import SquadForm from "@/components/squad/SquadForm";
import SquadView from "@/components/squad/SquadView";
import { getLocale, getT } from "@/lib/i18n/server";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { errorMessage } from "@/lib/recap/load";
import { paramPairs, rangeLinks, withRange } from "@/lib/recap/range";
import { getChampionIndex } from "@/lib/riot/ddragon";
import { RiotApiError } from "@/lib/riot/client";
import { getDemoSquad } from "@/lib/squad/demo";
import { loadSquad } from "@/lib/squad/load";
import { formatRiotId, MIN_SQUAD, parseSquadParams, squadCardPath } from "@/lib/squad/parse";

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const [locale, t] = [await getLocale(), await getT()];
  if (sp.demo != null) return { title: t("squad.page.titleDemo") };

  const { region, regionValid, players } = parseSquadParams(sp);
  if (!regionValid || players.length < MIN_SQUAD) return { title: t("squad.page.titleEmpty") };

  const title = t("squad.page.title", { names: players.map((p) => p.gameName).join(", ") });
  const description = t("squad.page.description");
  // The card has no cookie to say which language, so the link carries it.
  const card = `${squadCardPath(region, players)}&format=og&lang=${locale}`;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: "website", images: [{ url: card, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [card] },
  };
}

export default async function SquadPage({ searchParams }) {
  const sp = await searchParams;
  const range = rangeOf(sp.range);
  const [locale, t] = [await getLocale(), await getT()];

  if (sp.demo != null) {
    const [data, index] = [getDemoSquad(), await getChampionIndex(locale)];
    return <SquadView data={data} index={index} share={{ cardUrl: "/squad/card?demo=1" }} t={t} />;
  }

  const { region, regionValid, players, invalid, tooMany } = parseSquadParams(sp);
  // `offerRanges` is for errors that mean "nothing in this time range": a shorter range is what caused them, so the other
  // ranges are shown right under the message. (The season is the longest, so there is nothing longer to offer.)
  const form = (error, offerRanges = false) => (
    <SetupShell>
      <SquadForm
        region={regionValid ? region : undefined}
        values={players.map(formatRiotId)}
        error={error}
        ranges={offerRanges && range !== "season" ? rangeLinks("/squad", paramPairs(sp), range, t) : undefined}
      />
    </SetupShell>
  );

  // No input yet: just the form.
  if (players.length === 0 && invalid.length === 0) return form(null);

  if (!regionValid) return form(t("squad.page.pickServer"));
  if (players.length === 1 && invalid.length === 0) return form(null); // e.g. a link from a recap: just prefill
  if (invalid.length > 0) return form(t("squad.page.unreadable", { names: invalid.map((v) => `“${v}”`).join(", ") }));
  if (players.length < MIN_SQUAD) return form(t("squad.page.atLeastTwo"));
  if (tooMany) return form(t("squad.page.atMostFive"));

  let data;
  try {
    data = await loadSquad(region, players, { since: RANGES[range].since() });
  } catch (error) {
    if (!(error instanceof RiotApiError)) throw error;
    return form(errorMessage(t, error));
  }

  if (data.missing) {
    const names = data.missing.map(formatRiotId).join(", ");
    return form(t("squad.page.notFound", { names, region: t(`common.regions.${region}`) }));
  }
  if (data.sharedFound === 0) {
    const where = range === "season" ? t("squad.page.whereSeason", { count: data.scanned }) : t("squad.page.whereRange", { range: t(`common.range.${range}`).toLocaleLowerCase(locale) });
    return form(t("squad.page.noShared", { where }), true);
  }

  const index = await getChampionIndex(locale);
  return (
    <>
      {data.members.map((member) => (
        <RememberPlayer key={member.puuid} gameName={member.gameName} tagLine={member.tagLine} region={region} />
      ))}
      <SquadView data={data} index={index} share={{ cardUrl: withRange(squadCardPath(region, players), range) }} ranges={rangeLinks("/squad", paramPairs(sp), range, t)} t={t} />
    </>
  );
}
