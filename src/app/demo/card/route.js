import { cardLanguage, cardResponse, formatFrom } from "@/lib/card/respond";
import { DEMO_STYLES, getDemoData } from "@/lib/recap/demo";
import { getChampionIndex } from "@/lib/riot/ddragon";

// The share card for a sample player: `/demo/card?style=slayer&format=story|og|bingo|form`. Needs no Riot API key.
export async function GET(request) {
  const url = new URL(request.url);
  const style = url.searchParams.get("style");
  const { locale, t } = await cardLanguage(request.url);
  const data = { ...getDemoData(DEMO_STYLES.includes(style) ? style : "slayer"), index: await getChampionIndex(locale) };
  return cardResponse({ data, format: formatFrom(request.url, ["bingo", "form"]), origin: url.origin, t });
}
