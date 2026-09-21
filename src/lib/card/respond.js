import "server-only";
import { artSeed, personaSkin, topChampionSkins } from "@/lib/recap/art";
import { getBadges } from "@/lib/recap/badges";
import { getBingo } from "@/lib/recap/bingo";
import { curveShape, formLines, getFormCurve } from "@/lib/recap/formcurve";
import { DEFAULT_LOCALE, isLocale, LOCALE_PARAM } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { loadMessages } from "@/lib/i18n/messages";
import { createT } from "@/lib/i18n/translate";
import { SEASON_START } from "@/lib/recap/config";
import { buildSummary } from "@/lib/recap/summary";
import { UNDRAWABLE } from "./fonts";
import { renderBingoCard } from "./bingoCard";
import { FORM_BOX, renderFormCard } from "./formCard";
import { renderCard } from "./renderCard";

export const plain = (message, status) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * Runs `draw(t)` and returns its response. A card that can't be drawn in a language (a font the renderer can't read, say) is
 * drawn again in English rather than failing, since a link preview in English beats none.
 */
export async function drawInLanguage(t, draw) {
  try {
    return await draw(t);
  } catch (error) {
    console.error(`Share card failed (${t.locale})`, error);
    if (t.locale !== DEFAULT_LOCALE) {
      try {
        return await draw(createT(DEFAULT_LOCALE, await loadMessages(DEFAULT_LOCALE), { isolate: false }));
      } catch (again) {
        console.error("Share card failed in English too", again);
      }
    }
    return plain(t("errors.cardFailed"), 502);
  }
}

/** `?format=og` for link previews; anything else is the tall story card. `extra` lists other formats the route can draw (the player card also has "bingo" and "form"). */
export function formatFrom(url, extra = []) {
  const asked = new URL(url).searchParams.get("format");
  return asked === "og" || extra.includes(asked) ? asked : "story";
}

/**
 * The language a card is drawn in: `?lang=` when the link says (link previews and downloads do, since they have no cookie), else
 * this request's own. Returns `{ locale, t }`.
 */
export async function cardLanguage(url) {
  const asked = new URL(url).searchParams.get(LOCALE_PARAM);
  const wanted = isLocale(asked) ? asked : await getLocale();
  const locale = UNDRAWABLE.has(wanted) ? DEFAULT_LOCALE : wanted;
  // Without the bidi isolate marks browsers want: the card renderer can't lay them out.
  return { locale, t: createT(locale, await loadMessages(locale), { isolate: false }) };
}

/**
 * Builds the share card for a loaded recap. The artwork is the same skin the recap's final slide uses, so the
 * card matches what the player just saw.
 */
async function drawPlayerCard({ data, format, origin, t }) {
  const { account, recap, rankedEntries, index } = data;
  const { persona, rank, topName } = buildSummary({ recap, rankedEntries, index }, t);
  const skins = await topChampionSkins(index, recap, artSeed(account));
  const shelf = getBadges(recap, t);

  return renderCard(format, {
    t,
    name: account.gameName,
    tag: account.tagLine,
    season: t("recap.season", { year: SEASON_START.getUTCFullYear() }),
    host: new URL(origin).host,
    persona,
    recap,
    rank,
    topName,
    // Text only: Satori has no emoji font here, so the card lists trophy names instead of their icons.
    trophies: { unlocked: shelf.unlocked, total: shelf.total, names: shelf.badges.filter((b) => b.unlocked).slice(0, 3).map((b) => b.name) },
    art: personaSkin(skins).url,
  });
}

/** The trophy bingo card: the 5x5 board, drawn from the same trophies the recap's last slides show. */
async function drawBingoCard({ data, origin, t }) {
  const { account, recap } = data;
  const bingo = getBingo(recap, t);

  return renderBingoCard({
    t,
    name: account.gameName,
    tag: account.tagLine,
    season: t("recap.season", { year: SEASON_START.getUTCFullYear() }),
    host: new URL(origin).host,
    // Only what is drawn: the icons and descriptions stay behind (and out of the font subset).
    bingo: {
      size: bingo.size,
      lines: bingo.lines,
      unlocked: bingo.unlocked,
      total: bingo.total,
      cells: bingo.cells.map((c) => (c.free ? { free: true, inLine: c.inLine } : { name: c.name, unlocked: c.unlocked, progress: c.progress, inLine: c.inLine })),
    },
    labels: {
      header: t("cards.bingo.header"),
      free: t("cards.bingo.free"),
      lines: t("cards.bingo.lines"),
      trophies: t("cards.trophies"),
      next: bingo.next ? t("cards.bingo.next", { name: bingo.next.name }) : null,
      disclaimer: t("cards.disclaimer"),
    },
  });
}

/** The season-as-a-line card: the rolling win rate chart from the recap's form slide, with the same three markers and sentences. */
async function drawFormCard({ data, origin, t }) {
  const { account, recap } = data;
  const curve = getFormCurve(recap);
  if (!curve) return plain(t("errors.noGamesCard"), 404); // the slide needs 30 games, so the card does too

  const date = (at) => t.date(at, { month: "short", day: "numeric", timeZone: "UTC" });
  const shape = curveShape(curve, FORM_BOX);
  return renderFormCard({
    t,
    name: account.gameName,
    tag: account.tagLine,
    season: t("recap.season", { year: SEASON_START.getUTCFullYear() }),
    host: new URL(origin).host,
    shape: { ...shape, ticks: shape.ticks.map((tick) => ({ ...tick, label: t.percent(tick.percent / 100) })) },
    chips: [
      { kind: "best", label: t("cards.form.best"), value: t.percent(curve.best.rate), note: t("cards.form.ended", { date: date(curve.best.at) }) },
      { kind: "worst", label: t("cards.form.worst"), value: t.percent(curve.worst.rate), note: t("cards.form.ended", { date: date(curve.worst.at) }) },
      { kind: "now", label: t("cards.form.now"), value: t.percent(curve.now.rate), note: null },
    ],
    lines: formLines(curve, t),
    labels: { title: t("recap.formcurve.eyebrow"), disclaimer: t("cards.disclaimer") },
  });
}

// `format` picks the card: "bingo" and "form" have their own; anything else ("og", "story") is the player's share card.
const DRAWERS = { bingo: drawBingoCard, form: drawFormCard };
export const cardResponse = (args) => drawInLanguage(args.t, (t) => (DRAWERS[args.format] ?? drawPlayerCard)({ ...args, t }));
