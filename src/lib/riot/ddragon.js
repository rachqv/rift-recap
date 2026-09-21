import "server-only";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";
import { compactItems } from "@/lib/recap/items";
import { compactRunes } from "@/lib/recap/runes";
import { voiceUrls } from "./voice";

// Data Dragon is Riot's public static-asset CDN. It needs no API key.
const BASE = "https://ddragon.leagueoflegends.com";

// match-v5 reports a few champion names that differ from their Data Dragon id.
const ID_ALIASES = { FiddleSticks: "Fiddlesticks" };

export function championId(name) {
  return ID_ALIASES[name] ?? name;
}

async function getJson(path, revalidate) {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
  if (!res.ok) throw new Error(`Data Dragon responded ${res.status} for ${path}`);
  return res.json();
}

/** Riot's code for an app locale ("pt-BR" -> "pt_BR"), which names the language folder of each Data Dragon file. */
const ddragonLocale = (locale) => LOCALES[locale]?.ddragon ?? LOCALES[DEFAULT_LOCALE].ddragon;

/**
 * A per-language Data Dragon file. Not every file exists in every language on every patch, so a missing one falls back to
 * English instead of failing.
 */
export async function getLocalizedJson(version, locale, file, revalidate = 60 * 60 * 24) {
  const code = ddragonLocale(locale);
  try {
    return await getJson(`/cdn/${version}/data/${code}/${file}`, revalidate);
  } catch (error) {
    if (code === ddragonLocale(DEFAULT_LOCALE)) throw error;
    return getJson(`/cdn/${version}/data/${ddragonLocale(DEFAULT_LOCALE)}/${file}`, revalidate);
  }
}

/**
 * Latest patch version plus champion display names, keyed by Data Dragon id, in the given app locale (English by default).
 * `locale` is kept on the result so anything fetched later for this index (skin names, items) uses the same language.
 * Never throws: on failure the recap falls back to raw ids and skips icons.
 */
export async function getChampionIndex(locale = DEFAULT_LOCALE) {
  try {
    const [version] = await getJson("/api/versions.json", 60 * 60 * 6);
    const { data } = await getLocalizedJson(version, locale, "champion.json");
    const byId = Object.fromEntries(
      Object.values(data).map((c) => [c.id, { name: c.name, title: c.title, tags: c.tags, key: c.key, info: c.info, partype: c.partype }]),
    );
    const byKey = Object.fromEntries(Object.values(data).map((c) => [c.key, c.id]));
    return { version, locale, byId, byKey };
  } catch {
    return { version: null, locale, byId: {}, byKey: {} };
  }
}

/** Compact item data (names, blurbs, which are boots or finished items) for the given patch. Empty on failure. */
export async function getItemIndex(version, locale = DEFAULT_LOCALE) {
  if (!version) return {};
  try {
    const { data } = await getLocalizedJson(version, locale, "item.json");
    return compactItems(data);
  } catch {
    return {};
  }
}

/** Every rune by id (names in the given language, icon paths, which are keystones) for the given patch. Empty on failure. */
export async function getRuneIndex(version, locale = DEFAULT_LOCALE) {
  if (!version) return {};
  try {
    return compactRunes(await getLocalizedJson(version, locale, "runesReforged.json"));
  } catch {
    return {};
  }
}

/** A rune's icon, from the `icon` path in `getRuneIndex` (these live under `/cdn/img/`, with no patch in the address). */
export const runeIconUrl = (path) => (path ? `${BASE}/cdn/img/${path}` : null);

export const itemIconUrl = (version, id) => (version ? `${BASE}/cdn/${version}/img/item/${id}.png` : null);

export function championName(index, id) {
  return index.byId[championId(id)]?.name ?? id;
}

/** `skin` is the skin number from the champion's skin list; 0 is the default skin. */
export const splashUrl = (id, skin = 0) => `${BASE}/cdn/img/champion/splash/${championId(id)}_${skin}.jpg`;

/** A champion's pick-screen ("choose") or ban voice line in `locale`'s language: `{ src, fallback }`, or null. See `voiceUrls`. */
export const championVoice = (index, id, locale, kind) => voiceUrls(index.byId[championId(id)]?.key, locale, kind);

export const championIconUrl = (version, id) =>
  version ? `${BASE}/cdn/${version}/img/champion/${championId(id)}.png` : null;

export const profileIconUrl = (version, iconId) =>
  version && iconId != null ? `${BASE}/cdn/${version}/img/profileicon/${iconId}.png` : null;
