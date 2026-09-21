import { cardLanguage, formatFrom, plain } from "@/lib/card/respond";
import { versusCardResponse } from "@/lib/card/socialRespond";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { errorMessage } from "@/lib/recap/load";
import { getChampionIndex } from "@/lib/riot/ddragon";
import { RiotApiError } from "@/lib/riot/client";
import { getDemoVersus } from "@/lib/squad/demo";
import { loadVersus } from "@/lib/squad/load";
import { parseVersusParams } from "@/lib/squad/parse";

// The head-to-head share card: `/versus/card?a=euw1:Name%23TAG&b=na1:Other%23TAG&format=story|og` (or `?demo=1`).
export async function GET(request) {
  const url = new URL(request.url);
  const format = formatFrom(request.url);
  const origin = url.origin;
  const { locale, t } = await cardLanguage(request.url);

  if (url.searchParams.has("demo")) {
    return versusCardResponse({ data: getDemoVersus(), index: await getChampionIndex(locale), format, origin, t });
  }

  const { a, b } = parseVersusParams({ a: url.searchParams.get("a"), b: url.searchParams.get("b") });
  if (!a || !b) return plain(t("errors.badVersus"), 400);

  let result;
  try {
    result = await loadVersus(a, b, { since: RANGES[rangeOf(url.searchParams.get("range"))].since(), locale });
  } catch (error) {
    if (!(error instanceof RiotApiError)) throw error;
    const status = error.status === 404 || error.status === 429 ? error.status : 502;
    return plain(error.status in { 401: 1, 403: 1, 404: 1, 429: 1 } ? errorMessage(t, error) : t("errors.api"), status);
  }
  if (result.error === "same") return plain(t("errors.samePlayers"), 400);
  if (result.a.recap.games === 0 || result.b.recap.games === 0) return plain(t("errors.notEnough"), 404);

  return versusCardResponse({ data: result, index: result.a.index, format, origin, t });
}
