// The languages the app is offered in: the ones the League of Legends client itself ships with.
//  - `label` is the language's own name, so people can find theirs whatever language the page is in.
//  - `dir` is the writing direction.
//  - `intl` is the BCP 47 tag for number and date formatting (a specific region, so digits and separators are predictable).
//  - `ddragon` is Riot's code for the same language, used to fetch champion and item names in it.
//  - `voice` is the name of the same language's folder of champion voice lines on Community Dragon (see `lib/riot/voice.js`).
//    Left out where there is no such folder, and for English, whose lines are the default ones: those use the English voice.
//  - `ready` is whether the language is fully translated (a test checks that). Only ready languages are offered in the language
//    switch and picked from the browser's language; the others can still be tried by hand (a cookie, or `?lang=` on a card).
export const LOCALES = {
  en: { label: "English", dir: "ltr", intl: "en-US", ddragon: "en_US", ready: true },
  es: { label: "Español", dir: "ltr", intl: "es-ES", ddragon: "es_ES", voice: "es_es", ready: true },
  "pt-BR": { label: "Português (Brasil)", dir: "ltr", intl: "pt-BR", ddragon: "pt_BR", voice: "pt_br", ready: true },
  fr: { label: "Français", dir: "ltr", intl: "fr-FR", ddragon: "fr_FR", voice: "fr_fr", ready: true },
  de: { label: "Deutsch", dir: "ltr", intl: "de-DE", ddragon: "de_DE", voice: "de_de", ready: true },
  it: { label: "Italiano", dir: "ltr", intl: "it-IT", ddragon: "it_IT", voice: "it_it", ready: true },
  pl: { label: "Polski", dir: "ltr", intl: "pl-PL", ddragon: "pl_PL", voice: "pl_pl", ready: true },
  ro: { label: "Română", dir: "ltr", intl: "ro-RO", ddragon: "ro_RO", voice: "ro_ro", ready: true },
  el: { label: "Ελληνικά", dir: "ltr", intl: "el-GR", ddragon: "el_GR", voice: "el_gr", ready: true },
  hu: { label: "Magyar", dir: "ltr", intl: "hu-HU", ddragon: "hu_HU", voice: "hu_hu", ready: true },
  cs: { label: "Čeština", dir: "ltr", intl: "cs-CZ", ddragon: "cs_CZ", voice: "cs_cz", ready: true },
  tr: { label: "Türkçe", dir: "ltr", intl: "tr-TR", ddragon: "tr_TR", voice: "tr_tr", ready: true },
  ru: { label: "Русский", dir: "ltr", intl: "ru-RU", ddragon: "ru_RU", voice: "ru_ru", ready: true },
  ja: { label: "日本語", dir: "ltr", intl: "ja-JP", ddragon: "ja_JP", voice: "ja_jp", ready: true },
  ko: { label: "한국어", dir: "ltr", intl: "ko-KR", ddragon: "ko_KR", voice: "ko_kr", ready: true },
  "zh-CN": { label: "简体中文", dir: "ltr", intl: "zh-CN", ddragon: "zh_CN", voice: "zh_cn", ready: true },
  "zh-TW": { label: "繁體中文", dir: "ltr", intl: "zh-TW", ddragon: "zh_TW", ready: true },
  vi: { label: "Tiếng Việt", dir: "ltr", intl: "vi-VN", ddragon: "vi_VN", ready: true },
  th: { label: "ไทย", dir: "ltr", intl: "th-TH", ddragon: "th_TH", ready: true },
  id: { label: "Bahasa Indonesia", dir: "ltr", intl: "id-ID", ddragon: "id_ID", ready: true },
  ar: { label: "العربية", dir: "rtl", intl: "ar-AE", ddragon: "ar_AE", voice: "ar_ae", ready: true },
};

export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "locale";
export const LOCALE_PARAM = "lang";

/** The languages that are fully translated: the ones people can pick. */
export const READY_LOCALES = Object.keys(LOCALES).filter((locale) => LOCALES[locale].ready);

export const isLocale = (value) => typeof value === "string" && Object.hasOwn(LOCALES, value);

// Browsers send tags like "zh-Hant-TW" or "pt-PT"; these map the ones that don't match a supported locale by their prefix.
const ALIASES = {
  "zh-hans": "zh-CN",
  "zh-sg": "zh-CN",
  "zh-hant": "zh-TW",
  "zh-hk": "zh-TW",
  "zh-mo": "zh-TW",
  zh: "zh-CN",
  pt: "pt-BR",
  in: "id", // the old code for Indonesian, still sent by some Android browsers
};

const byLowerCase = Object.fromEntries(Object.keys(LOCALES).map((locale) => [locale.toLowerCase(), locale]));

/** The supported locale for one language tag ("es-MX" -> "es"), or null. */
export function matchTag(tag) {
  const parts = String(tag).trim().toLowerCase().split("-");
  // "zh-hant-tw" -> "zh-hant" -> "zh": the most specific tag we know wins.
  for (let length = parts.length; length > 0; length--) {
    const candidate = parts.slice(0, length).join("-");
    if (byLowerCase[candidate] ?? ALIASES[candidate]) return byLowerCase[candidate] ?? ALIASES[candidate];
  }
  return null;
}

/**
 * The best locale for an `Accept-Language` header, in the order of the browser's preferences. Only `supported` languages count
 * (the ready ones, unless told otherwise).
 */
export function matchAcceptLanguage(header, supported = READY_LOCALES) {
  const tags = String(header ?? "")
    .split(",")
    .map((part, order) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) : 1, order };
    })
    .filter(({ tag, q }) => tag && tag !== "*" && q > 0)
    .sort((a, b) => b.q - a.q || a.order - b.order);
  for (const { tag } of tags) {
    const match = matchTag(tag);
    if (match && supported.includes(match)) return match;
  }
  return DEFAULT_LOCALE;
}
