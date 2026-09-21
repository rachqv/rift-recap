import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";

// Each champion's voice lines, from Community Dragon (Riot's game files, mirrored). The League client ships a voice
// pack for most of its languages, and Community Dragon keeps each in a folder of its own beside the default (English) one, with the
// same file names: the champion's numeric key. They are Ogg audio, which Safari may not play.
const BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global";
const DEFAULT_PACK = "default";

// The line a champion says when you pick them ("choose"), and when they are banned ("ban").
const FOLDERS = { choose: "champion-choose-vo", ban: "champion-ban-vo" };

const fileFor = (pack, kind, key) => `${BASE}/${pack}/v1/${FOLDERS[kind] ?? FOLDERS.choose}/${key}.ogg`;

/**
 * The voice line for the champion with numeric key `key`, in `locale`'s language where Riot recorded one. `kind` is "choose"
 * (the default) or "ban".
 * @returns null without a key, else `{ src, fallback }`: `src` is the line in the language's pack (or the default one, where the
 * language has none: Traditional Chinese, Vietnamese, Thai and Indonesian play the English line), and `fallback` is the default
 * line for the player to switch to if `src` can't be loaded, or null when `src` already is it.
 */
export function voiceUrls(key, locale = DEFAULT_LOCALE, kind = "choose") {
  if (!key) return null;
  const pack = LOCALES[locale]?.voice;
  const fallback = fileFor(DEFAULT_PACK, kind, key);
  return pack ? { src: fileFor(pack, kind, key), fallback } : { src: fallback, fallback: null };
}
