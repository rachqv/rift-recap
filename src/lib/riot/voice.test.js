import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/config";
import { voiceUrls } from "./voice";

const FILE = (pack) => `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/${pack}/v1/champion-choose-vo/103.ogg`;

describe("voiceUrls", () => {
  it("plays the default (English) line for English, with nothing to fall back to", () => {
    expect(voiceUrls(103, "en")).toEqual({ src: FILE("default"), fallback: null });
    expect(voiceUrls(103)).toEqual({ src: FILE("default"), fallback: null });
  });

  it("plays the line in the language's own pack, falling back to English if it can't be loaded", () => {
    expect(voiceUrls(103, "es")).toEqual({ src: FILE("es_es"), fallback: FILE("default") });
    expect(voiceUrls(103, "ja")).toEqual({ src: FILE("ja_jp"), fallback: FILE("default") });
    expect(voiceUrls(103, "zh-CN")).toEqual({ src: FILE("zh_cn"), fallback: FILE("default") });
    expect(voiceUrls("103", "pt-BR").src).toBe(FILE("pt_br")); // the key is a string in Data Dragon's data
  });

  it("plays the English line in languages Riot recorded no voice pack for", () => {
    for (const locale of ["zh-TW", "vi", "th", "id"]) expect(voiceUrls(103, locale), locale).toEqual({ src: FILE("default"), fallback: null });
  });

  it("plays the English line for a language it doesn't know", () => {
    expect(voiceUrls(103, "xx")).toEqual({ src: FILE("default"), fallback: null });
  });

  it("has ban lines too, in the same packs, with the same English fallback", () => {
    const BAN = (pack) => FILE(pack).replace("champion-choose-vo", "champion-ban-vo");
    expect(voiceUrls(103, "en", "ban")).toEqual({ src: BAN("default"), fallback: null });
    expect(voiceUrls(103, "ko", "ban")).toEqual({ src: BAN("ko_kr"), fallback: BAN("default") });
    expect(voiceUrls(103, "vi", "ban")).toEqual({ src: BAN("default"), fallback: null });
    expect(voiceUrls(103, "es", "choose")).toEqual(voiceUrls(103, "es")); // "choose" is the default
    expect(voiceUrls(103, "es", "nonsense")).toEqual(voiceUrls(103, "es")); // an unknown kind is a pick line
  });

  it("has nothing for a champion without a key", () => {
    expect(voiceUrls(undefined, "es")).toBeNull();
    expect(voiceUrls("", "es")).toBeNull();
  });
});

describe("the languages' voice packs", () => {
  it("are named after the language's Data Dragon code (es_ES -> es_es), which is how Community Dragon names its folders", () => {
    for (const [locale, { voice, ddragon }] of Object.entries(LOCALES)) {
      if (voice) expect(voice, locale).toBe(ddragon.toLowerCase());
    }
  });

  it("cover the languages that have one, and English has none of its own", () => {
    const withVoice = Object.keys(LOCALES).filter((locale) => LOCALES[locale].voice);
    expect(withVoice).toHaveLength(16);
    expect(LOCALES.en.voice).toBeUndefined();
  });
});
