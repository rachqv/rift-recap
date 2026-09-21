import { cardLanguage, formatFrom, plain } from "@/lib/card/respond";
import { squadCardResponse } from "@/lib/card/socialRespond";
import { errorMessage } from "@/lib/recap/load";
import { getChampionIndex } from "@/lib/riot/ddragon";
import { RiotApiError } from "@/lib/riot/client";
import { getDemoSquad } from "@/lib/squad/demo";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { loadSquad } from "@/lib/squad/load";
import { MIN_SQUAD, parseSquadParams } from "@/lib/squad/parse";

// The squad's share card: `/squad/card?region=euw1&p=Name%23TAG&p=...&format=story|og` (or `?demo=1`).
export async function GET(request) {
  const url = new URL(request.url);
  const format = formatFrom(request.url);
  const origin = url.origin;
  const { locale, t } = await cardLanguage(request.url);

  if (url.searchParams.has("demo")) {
    return squadCardResponse({ data: getDemoSquad(), index: await getChampionIndex(locale), format, origin, t });
  }

  const { region, regionValid, players, invalid, tooMany } = parseSquadParams({
    region: url.searchParams.get("region"),
    p: url.searchParams.getAll("p"),
  });
  if (!regionValid || invalid.length > 0 || tooMany || players.length < MIN_SQUAD) return plain(t("errors.badSquad"), 400);

  let data;
  try {
    data = await loadSquad(region, players, { since: RANGES[rangeOf(url.searchParams.get("range"))].since() });
  } catch (error) {
    if (!(error instanceof RiotApiError)) throw error;
    const status = error.status === 404 || error.status === 429 ? error.status : 502;
    return plain(error.status in { 401: 1, 403: 1, 404: 1, 429: 1 } ? errorMessage(t, error) : t("errors.api"), status);
  }
  if (data.missing) return plain(t("errors.playerMissing"), 404);
  if (data.sharedFound === 0) return plain(t("errors.noSharedGames"), 404);

  return squadCardResponse({ data, index: await getChampionIndex(locale), format, origin, t });
}
