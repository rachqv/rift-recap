import { cardLanguage, cardResponse, formatFrom, plain } from "@/lib/card/respond";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { errorMessage, loadRecap, safeDecode } from "@/lib/recap/load";
import { RiotApiError } from "@/lib/riot/client";
import { isPlatform } from "@/lib/riot/regions";

// The share card for a player: `/recap/euw1/Name/TAG/card?format=story|og|bingo|form`.
export async function GET(request, { params }) {
  const { region, name, tag } = await params;
  const { locale, t } = await cardLanguage(request.url);
  if (!isPlatform(region)) return plain(t("errors.unknownRegion"), 404);

  let data;
  try {
    data = await loadRecap(region, safeDecode(name), safeDecode(tag), { since: RANGES[rangeOf(new URL(request.url).searchParams.get("range"))].since(), locale });
  } catch (error) {
    if (!(error instanceof RiotApiError)) throw error;
    const status = error.status === 404 || error.status === 429 ? error.status : 502;
    return plain(error.status in { 401: 1, 403: 1, 404: 1, 429: 1 } ? errorMessage(t, error) : t("errors.api"), status);
  }
  if (data.recap.games === 0) return plain(t("errors.noGamesCard"), 404);

  return cardResponse({ data, format: formatFrom(request.url, ["bingo", "form"]), origin: new URL(request.url).origin, t });
}
