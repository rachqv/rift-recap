import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, LOCALES, matchAcceptLanguage, matchTag, READY_LOCALES } from "./config";
import { EN_FLAT } from "./en";
import { flatten } from "./flatten";
import { loadMessages, pickNamespaces } from "./messages";
import { NAMESPACES } from "./namespaces";
import { createT } from "./translate";

const MESSAGES_DIR = join(import.meta.dirname, "..", "..", "messages");
const readNamespace = (locale, namespace) => flatten(JSON.parse(readFileSync(join(MESSAGES_DIR, locale, `${namespace}.json`), "utf8")), namespace);
const filesOf = (locale) => readdirSync(join(MESSAGES_DIR, locale)).filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, ""));

describe("locales", () => {
  it("every locale has what the app needs", () => {
    for (const [locale, info] of Object.entries(LOCALES)) {
      expect(info.label, locale).toBeTruthy();
      expect(["ltr", "rtl"], locale).toContain(info.dir);
      expect(() => new Intl.NumberFormat(info.intl), locale).not.toThrow();
      expect(info.ddragon, locale).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    }
  });

  it("recognises supported locales only", () => {
    expect(isLocale("pt-BR")).toBe(true);
    expect(isLocale("xx")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale("toString")).toBe(false);
  });

  it("matches browser language tags to a locale", () => {
    expect(matchTag("es-MX")).toBe("es");
    expect(matchTag("PT-br")).toBe("pt-BR");
    expect(matchTag("pt-PT")).toBe("pt-BR");
    expect(matchTag("zh-Hant-TW")).toBe("zh-TW");
    expect(matchTag("zh-Hans")).toBe("zh-CN");
    expect(matchTag("zh")).toBe("zh-CN");
    expect(matchTag("in")).toBe("id");
    expect(matchTag("sv")).toBeNull();
  });

  it("picks the browser's most wanted supported language", () => {
    const all = Object.keys(LOCALES);
    expect(matchAcceptLanguage("sv, fr;q=0.8, en;q=0.5", all)).toBe("fr");
    expect(matchAcceptLanguage("de;q=0.4, ja;q=0.9", all)).toBe("ja");
    expect(matchAcceptLanguage("es-419,es;q=0.9,en;q=0.8", all)).toBe("es");
    expect(matchAcceptLanguage("*", all)).toBe(DEFAULT_LOCALE);
    expect(matchAcceptLanguage("fr;q=0", all)).toBe(DEFAULT_LOCALE);
    expect(matchAcceptLanguage(null, all)).toBe(DEFAULT_LOCALE);
  });

  it("only lands on a language that is ready, unless told otherwise", () => {
    expect(READY_LOCALES).toContain("es");
    expect(READY_LOCALES).toContain(DEFAULT_LOCALE);
    expect(matchAcceptLanguage("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    // A language missing from the supported list (a new one still being translated) gets English until it is added.
    expect(matchAcceptLanguage("vi,en;q=0.5", ["en", "es"])).toBe(DEFAULT_LOCALE);
    expect(matchAcceptLanguage("vi,es;q=0.5", ["en", "es"])).toBe("es");
  });
});

describe("createT", () => {
  const en = createT("en", { "a.plain": "Hello", "a.name": "Hi {name}", "a.games": "{count, plural, one {# game} other {# games}}", "a.rich": "Read <b>this</b> now", "a.apostrophe": "Couldn't load {what}" });

  it("returns plain text and fills placeholders", () => {
    expect(en("a.plain")).toBe("Hello");
    expect(en("a.name", { name: "Ahri" })).toBe("Hi Ahri");
    expect(en("a.apostrophe", { what: "it" })).toBe("Couldn't load it");
  });

  it("uses the plural rules of the language", () => {
    expect(en("a.games", { count: 1 })).toBe("1 game");
    expect(en("a.games", { count: 1234 })).toBe("1,234 games");
    const ru = createT("ru", { k: "{n, plural, one {# игра} few {# игры} many {# игр} other {# игры}}" });
    expect([1, 3, 5, 21, 22, 25].map((n) => ru("k", { n }))).toEqual(["1 игра", "3 игры", "5 игр", "21 игра", "22 игры", "25 игр"]);
    const ar = createT("ar", { k: "{n, plural, zero {لا شيء} one {واحد} two {اثنان} few {# قليل} many {# كثير} other {# آخر}}" });
    expect([0, 1, 2, 5, 11, 100].map((n) => ar("k", { n }))).toEqual(["لا شيء", "واحد", "اثنان", "5 قليل", "11 كثير", "100 آخر"]);
    const ja = createT("ja", { k: "{n, plural, other {#戦}}" });
    expect(ja("k", { n: 3 })).toBe("3戦");
  });

  it("gives rich messages as keyed React nodes", () => {
    const parts = en.rich("a.rich", { b: (chunks) => ({ tag: "b", chunks }) });
    expect(Array.isArray(parts)).toBe(true);
    expect(parts.every((part) => part.key != null)).toBe(true);
  });

  it("shows the key for a message that is missing, instead of nothing", () => {
    expect(en("a.nope")).toBe("a.nope");
    expect(en.rich("a.nope")).toBe("a.nope");
    expect(en.has("a.plain")).toBe(true);
    expect(en.has("a.nope")).toBe(false);
  });

  it("formats numbers and dates for the locale", () => {
    expect(en.number(1234.5)).toBe("1,234.5");
    expect(createT("de", {}).number(1234.5)).toBe("1.234,5");
    expect(createT("fr", {}).number(0.5, { style: "percent" }).replace(/\s/g, " ")).toBe("50 %");
    expect(createT("ar", {}).number(123)).toBe("123"); // Latin digits, as League itself uses
    expect(createT("ja", {}).date(new Date(Date.UTC(2026, 2, 5)), { month: "long", day: "numeric", timeZone: "UTC" })).toBe("3月5日");
    expect(en.dir).toBe("ltr");
    expect(createT("ar", {}).dir).toBe("rtl");
  });
});

describe("message files", () => {
  it("the namespace list matches the English files", () => {
    expect([...NAMESPACES].sort()).toEqual(filesOf("en").sort());
  });

  it("every language marked ready is fully translated", () => {
    for (const locale of READY_LOCALES) {
      const own = Object.assign({}, ...filesOf(locale).map((namespace) => readNamespace(locale, namespace)));
      expect(Object.keys(EN_FLAT).filter((key) => !(key in own)), `${locale} is marked ready but lacks messages`).toEqual([]);
    }
  });

  it("English messages are all valid ICU", () => {
    for (const [key, message] of Object.entries(EN_FLAT)) {
      expect(typeof message, key).toBe("string");
      expect(() => new IntlMessageFormat(message, "en"), key).not.toThrow();
    }
  });

  const variablesOf = (message) => {
    const names = new Set();
    const visit = (nodes) => {
      for (const node of nodes) {
        if (node.type === 1 || node.type === 2 || node.type === 3 || node.type === 4 || node.type === 5 || node.type === 8) names.add(node.value);
        if (node.options) Object.values(node.options).forEach((option) => visit(option.value));
        if (node.children) visit(node.children);
      }
    };
    visit(new IntlMessageFormat(message, "en").getAst());
    return [...names].sort();
  };

  // A translation may not invent keys, lose or rename placeholders, or break its own syntax: those are the mistakes that
  // crash a page or show a raw `{name}` to someone. Files a locale doesn't have yet simply fall back to English.
  for (const locale of Object.keys(LOCALES).filter((l) => l !== DEFAULT_LOCALE)) {
    let files = [];
    try {
      files = filesOf(locale);
    } catch {
      // no folder yet: the locale is all English for now
    }
    for (const namespace of files) {
      it(`${locale}/${namespace} agrees with English`, () => {
        expect(NAMESPACES).toContain(namespace);
        const translated = readNamespace(locale, namespace);
        for (const [key, message] of Object.entries(translated)) {
          expect(EN_FLAT[key], `${key} does not exist in English`).toBeTypeOf("string");
          expect(typeof message, key).toBe("string");
          expect(() => new IntlMessageFormat(message, LOCALES[locale].intl), `${locale} ${key}`).not.toThrow();
          expect(variablesOf(message), `${locale} ${key}`).toEqual(variablesOf(EN_FLAT[key]));
        }
      });
    }
  }
});

describe("loadMessages", () => {
  it("English is the catalog itself", async () => {
    expect(await loadMessages("en")).toBe(EN_FLAT);
  });

  it("a translated locale overrides English and keeps English for anything it lacks", async () => {
    const es = await loadMessages("es");
    expect(es["home.badge"]).toBe("Resumen de temporada");
    expect(Object.keys(es).sort()).toEqual(Object.keys(EN_FLAT).sort());
  });

  it("a locale with no files is all English", async () => {
    expect(await loadMessages("xx")).toEqual(EN_FLAT);
  });

  it("picks only the namespaces asked for", () => {
    const picked = pickNamespaces(EN_FLAT, ["search"]);
    expect(Object.keys(picked).every((key) => key.startsWith("search."))).toBe(true);
    expect(Object.keys(picked).length).toBeGreaterThan(0);
  });
});

describe("keys used in the code", () => {
  // Every `t("some.key")` in the source has to exist in English, or the page would show the key itself. Keys built from a
  // variable (`t(\`common.regions.${id}\`)`) can't be checked exactly, so their fixed start must at least match something.
  const SRC = join(import.meta.dirname, "..", "..");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(js|jsx)$/.test(entry.name) && !/\.(test|stories)\./.test(entry.name)) files.push(path);
    }
  };
  walk(SRC);

  // Comments show example calls (`t("home.title")`); they are not uses.
  const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

  const keys = Object.keys(EN_FLAT);
  const used = [];
  for (const file of files) {
    const source = withoutComments(readFileSync(file, "utf8"));
    // t("key"), t.rich("key"), t(`key`), also a key chosen by a ternary: t(cond ? "a.b" : "a.c")
    for (const match of source.matchAll(/\bt(?:\.rich)?\(\s*([^,)]*?)(?:,|\))/g)) {
      for (const literal of match[1].matchAll(/["'`]([a-z][A-Za-z0-9]*\.[A-Za-z0-9_.${}]+)["'`]/g)) used.push({ file, key: literal[1] });
    }
  }

  it("finds the calls it is meant to check", () => {
    expect(used.length).toBeGreaterThan(300);
  });

  it("every key used exists in the English messages", () => {
    const missing = [];
    for (const { file, key } of used) {
      if (key.includes("${")) {
        const prefix = key.slice(0, key.indexOf("${"));
        if (!keys.some((k) => k.startsWith(prefix))) missing.push(`${file.slice(SRC.length)}: ${key} (no key starts with "${prefix}")`);
      } else if (!(key in EN_FLAT)) missing.push(`${file.slice(SRC.length)}: ${key}`);
    }
    expect(missing).toEqual([]);
  });

  it("every English message is used somewhere (no dead text for translators to work on)", () => {
    const text = files.map((file) => withoutComments(readFileSync(file, "utf8"))).join("\n");
    // A line the code picks by name at run time ("line" or "lineLost", "description" or "descriptionAlt").
    const variant = /\.(line[A-Z]\w*|descriptionAlt)$/;
    const unused = keys.filter((key) => {
      if (variant.test(key)) return false;
      const literal = `"${key}"`;
      if (text.includes(literal) || text.includes(`'${key}'`) || text.includes("`" + key + "`")) return false;
      // Keys reached through a template, like `common.regions.${id}`: matched by their shared start.
      const parts = key.split(".");
      if (parts.some((_, i) => text.includes("`" + parts.slice(0, i + 1).join(".") + ".${"))) return false;
      // ...or with a number on the end, like `common.loading.recap${n}`.
      if (text.includes("`" + key.replace(/\d+$/, "") + "${")) return false;
      // Keys reached through a prefix held in a variable (`${T}.eyebrow` with T = "versus.slides.timeline").
      const tail = parts.at(-1);
      return !(text.includes("}." + tail + "`") || text.includes("}." + tail + "\""));
    });
    expect(unused).toEqual([]);
  });
});

describe("right-to-left languages", () => {
  const ar = createT("ar", { "a.name": "مرحبا {name}", "a.rich": "<b>{name}</b> فاز", "a.count": "{n, plural, other {#}} لعبة" });

  it("keeps a name inside a sentence in one piece", () => {
    expect(ar("a.name", { name: "Winner#W" })).toBe("مرحبا ⁨Winner#W⁩");
    expect(ar("a.count", { n: 40 })).toBe("40 لعبة");
  });

  it("does the same for rich messages, and leaves tags alone", () => {
    const parts = ar.rich("a.rich", { name: "Ahri", b: (chunks) => ({ tag: "b", chunks }) });
    expect(JSON.stringify(parts)).toContain("⁨Ahri⁩");
  });

  it("does nothing to left-to-right languages", () => {
    expect(createT("en", { k: "Hi {name}" })("k", { name: "Ahri" })).toBe("Hi Ahri");
  });
});
