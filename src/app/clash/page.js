import RememberPlayer from "@/components/RememberPlayer";
import ClashForm from "@/components/squad/ClashForm";
import ClashView from "@/components/squad/ClashView";
import SetupShell from "@/components/squad/SetupShell";
import { getLocale, getT } from "@/lib/i18n/server";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { errorMessage } from "@/lib/recap/load";
import { paramPairs, rangeLinks, withRange } from "@/lib/recap/range";
import { RiotApiError } from "@/lib/riot/client";
import { getDemoClash } from "@/lib/squad/demoClash";
import { loadClash } from "@/lib/squad/load";
import { clashCardPath, formatRiotId, MIN_SQUAD, parseClashParams } from "@/lib/squad/parse";

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const [locale, t] = [await getLocale(), await getT()];
  if (sp.demo != null) return { title: t("clash.page.titleDemo") };

  const { region, regionValid, a, b } = parseClashParams(sp);
  if (!regionValid || a.length < MIN_SQUAD || b.length < MIN_SQUAD) return { title: t("clash.page.titleEmpty") };
  const title = t("clash.page.title", { a: a[0].gameName, b: b[0].gameName });
  const description = t("clash.page.description");
  // The card has no cookie to say which language, so the link carries it.
  const card = `${withRange(clashCardPath(region, a, b), rangeOf(sp.range))}&format=og&lang=${locale}`;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: "website", images: [{ url: card, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [card] },
  };
}

/** What is wrong with the input, as a message; null when nothing has been entered yet; undefined when it is fine. */
function inputProblem({ regionValid, a, b, invalid, overlap, tooMany }, t) {
  if (a.length === 0 && b.length === 0 && invalid.length === 0) return null;
  if (!regionValid) return t("squad.page.pickServer");
  if (invalid.length > 0) return t("squad.page.unreadable", { names: invalid.map((v) => `“${v}”`).join(", ") });
  if (a.length < MIN_SQUAD || b.length < MIN_SQUAD) return t("clash.page.atLeastTwo");
  if (tooMany) return t("squad.page.atMostFive");
  if (overlap.length > 0) return t("clash.page.overlap", { names: t.list(overlap.map(formatRiotId)) });
}

export default async function ClashPage({ searchParams }) {
  const sp = await searchParams;
  const range = rangeOf(sp.range);
  const [locale, t] = [await getLocale(), await getT()];

  if (sp.demo != null) return <ClashView data={getDemoClash()} share={{ cardUrl: "/clash/card?demo=1" }} t={t} />;

  const parsed = parseClashParams(sp);
  const { region, regionValid, a, b } = parsed;
  // `offerRanges` is for "nothing in this time range" errors: the other ranges are shown right under the message.
  const form = (error, offerRanges = false) => (
    <SetupShell>
      <ClashForm
        region={regionValid ? region : undefined}
        a={a.map(formatRiotId)}
        b={b.map(formatRiotId)}
        error={error}
        ranges={offerRanges && range !== "season" ? rangeLinks("/clash", paramPairs(sp), range, t) : undefined}
      />
    </SetupShell>
  );

  // No input yet is just the form; anything wrong with it is said above the form.
  const problem = inputProblem(parsed, t);
  if (problem !== undefined) return form(problem);

  let data;
  try {
    data = await loadClash(region, a, b, { since: RANGES[range].since() });
  } catch (error) {
    if (!(error instanceof RiotApiError)) throw error;
    return form(errorMessage(t, error));
  }

  if (data.missing) return form(t("squad.page.notFound", { names: data.missing.map(formatRiotId).join(", "), region: t(`common.regions.${region}`) }));
  if (data.overlap) return form(t("clash.page.overlap", { names: t.list(data.overlap.map(formatRiotId)) }));
  if (!data.clash) {
    const where = range === "season" ? t("squad.page.whereSeason", { count: data.scanned }) : t("squad.page.whereRange", { range: t(`common.range.${range}`).toLocaleLowerCase(locale) });
    return form(t("clash.page.noClash", { where }), true);
  }

  return (
    <>
      {[...data.a, ...data.b].map((member) => (
        <RememberPlayer key={member.puuid} gameName={member.gameName} tagLine={member.tagLine} region={region} />
      ))}
      <ClashView data={data} share={{ cardUrl: withRange(clashCardPath(region, a, b), range) }} ranges={rangeLinks("/clash", paramPairs(sp), range, t)} t={t} />
    </>
  );
}
