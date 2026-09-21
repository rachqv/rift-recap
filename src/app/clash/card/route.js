import { cardLanguage, formatFrom, plain } from "@/lib/card/respond";
import { clashCardResponse } from "@/lib/card/socialRespond";
import { errorMessage } from "@/lib/recap/load";
import { RANGES, rangeOf } from "@/lib/recap/config";
import { RiotApiError } from "@/lib/riot/client";
import { getDemoClash } from "@/lib/squad/demoClash";
import { loadClash } from "@/lib/squad/load";
import { MIN_SQUAD, parseClashParams } from "@/lib/squad/parse";

// The squad vs squad share card: `/clash/card?region=euw1&a=Name%23TAG&a=...&b=...&format=story|og` (or `?demo=1`).
export async function GET(request) {
  const url = new URL(request.url);
  const format = formatFrom(request.url);
  const origin = url.origin;
  const { t } = await cardLanguage(request.url);

  if (url.searchParams.has("demo")) return clashCardResponse({ data: getDemoClash(), format, origin, t });

  const { region, regionValid, a, b, invalid, overlap, tooMany } = parseClashParams({
    region: url.searchParams.get("region"),
    a: url.searchParams.getAll("a"),
    b: url.searchParams.getAll("b"),
  });
  if (!regionValid || invalid.length > 0 || overlap.length > 0 || tooMany || a.length < MIN_SQUAD || b.length < MIN_SQUAD) return plain(t("errors.badSquad"), 400);

  let data;
  try {
    data = await loadClash(region, a, b, { since: RANGES[rangeOf(url.searchParams.get("range"))].since() });
  } catch (error) {
    if (!(error instanceof RiotApiError)) throw error;
    const status = error.status === 404 || error.status === 429 ? error.status : 502;
    return plain(error.status in { 401: 1, 403: 1, 404: 1, 429: 1 } ? errorMessage(t, error) : t("errors.api"), status);
  }
  if (data.missing) return plain(t("errors.playerMissing"), 404);
  if (data.overlap) return plain(t("errors.badSquad"), 400);
  if (!data.clash) return plain(t("errors.noSharedGames"), 404);

  return clashCardResponse({ data, format, origin, t });
}
