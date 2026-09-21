import "server-only";

// The bundled fonts (`renderCard.js`) are Latin only. For any other language the card also needs the glyphs of its script:
// Cyrillic, Greek, Vietnamese and accented Latin from Inter and Cinzel, and Japanese, Korean, Chinese, Thai and Arabic from
// a Noto family. Those files are large (CJK ones are several MB), so instead of bundling them each card asks Google Fonts for
// a subset with just the characters it draws, which is a few KB. If that is unreachable the card still draws, with the
// bundled fonts and empty boxes where a glyph is missing, which beats an error page for a link preview.

const SCRIPT_FAMILY = {
  ja: "Noto Sans JP",
  ko: "Noto Sans KR",
  "zh-CN": "Noto Sans SC",
  "zh-TW": "Noto Sans TC",
  th: "Noto Sans Thai",
};

/**
 * Languages the card renderer (Satori) can't draw yet: its Arabic shaping fails on every Arabic font tried (Noto Sans Arabic,
 * Cairo, Tajawal, Almarai, IBM Plex Sans Arabic, Noto Kufi Arabic, Readex Pro, Noto Naskh Arabic), so an Arabic reader's card is
 * drawn in English. The rest of the site is unaffected. Remove a language from this set to try it again after upgrading.
 */
export const UNDRAWABLE = new Set(["ar"]);

const cache = new Map();

/** The font file Google serves for `family` at `weight` with only `text`'s characters, or null when it can't be had. */
async function subset(family, weight, text) {
  const key = `${family}:${weight}:${text}`;
  if (cache.has(key)) return cache.get(key);

  const pending = (async () => {
    try {
      // With no browser user agent, Google serves TrueType files, which is what the card renderer reads (it can't read WOFF2).
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
      const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
      if (!url) return null;
      const file = await fetch(url);
      return file.ok ? await file.arrayBuffer() : null;
    } catch {
      return null;
    }
  })();
  cache.set(key, pending);
  // Keep the memory bounded: cards in a few languages, each with its own text, add up over a long-running server.
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return pending;
}

/** Every distinct character of a string, as one string (what a font subset is asked for). */
const charactersOf = (text) => [...new Set(text)].join("");

/**
 * The extra fonts a card in `locale` needs. `text` is everything the card will draw (its data and labels as one string).
 * English needs none: the bundled Latin fonts cover it.
 */
export async function extraFonts(locale, text) {
  if (locale === "en") return [];
  const chars = charactersOf(text);
  const wanted = [
    { name: "Cinzel", family: "Cinzel", weight: 800 },
    { name: "Inter", family: "Inter", weight: 400 },
    { name: "Inter", family: "Inter", weight: 600 },
    { name: "Inter", family: "Inter", weight: 700 },
  ];
  const script = SCRIPT_FAMILY[locale];
  // The script font stands in wherever Cinzel or Inter have no glyph, at the same weights.
  if (script) for (const weight of [400, 600, 700, 800]) wanted.push({ name: "Noto", family: script, weight });

  const loaded = await Promise.all(wanted.map(async ({ name, family, weight }) => ({ name, weight, data: await subset(family, weight, chars) })));
  return loaded.filter((font) => font.data).map((font) => ({ ...font, style: "normal" }));
}

/** The font stack for a card's text: Cinzel or Inter first, then the script's Noto family for whatever they lack. */
export const stack = (family) => `${family}, Noto`;
