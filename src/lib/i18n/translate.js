import { createElement, Fragment } from "react";
import { IntlMessageFormat } from "intl-messageformat";
import { DEFAULT_LOCALE, LOCALES } from "./config";

// Compiling a message is the slow part of formatting it, and the same few hundred messages are used all the time.
const compiled = new Map();

function compile(locale, message) {
  let perLocale = compiled.get(locale);
  if (!perLocale) compiled.set(locale, (perLocale = new Map()));
  let format = perLocale.get(message);
  if (!format) perLocale.set(message, (format = new IntlMessageFormat(message, LOCALES[locale].intl)));
  return format;
}

// In a right-to-left language a Latin name or a number next to punctuation gets scrambled ("Winner#W" reads as "W#Winner"), so each
// text value is wrapped in invisible isolate marks (FSI ... PDI) and stays in one piece.
const FSI = "⁨";
const PDI = "⁩";
const isolate = (values) => Object.fromEntries(Object.entries(values ?? {}).map(([name, value]) => [name, typeof value === "string" && value ? FSI + value + PDI : value]));

// Plain text with no placeholders (most of the app) skips the parser altogether.
const isPlain = (message) => !/[{}<>']/.test(message);

const warned = new Set();
function missing(locale, key) {
  if (process.env.NODE_ENV === "production" || warned.has(key)) return;
  warned.add(key);
  console.warn(`[i18n] No message for "${key}" (${locale})`);
}

// React wants keys on children that come out of an array; a formatted message has no natural ones.
const keyed = (nodes) => nodes.map((node, i) => createElement(Fragment, { key: i }, node));

/**
 * Makes the translate function for one locale. `messages` is a flat map of `namespace.key` to an ICU message; anything
 * missing from it is reported and shown as its key, so a gap is visible instead of blank. In right-to-left languages text values are
 * wrapped in invisible isolate marks so names stay in one piece; `{ isolate: false }` leaves them out (the card renderer can't use them).
 *
 *   t("home.title")                                   plain text
 *   t("games", { count: 3 })                          "{count, plural, one {# game} other {# games}}"
 *   t.rich("hint", { link: (chunks) => <a>{chunks}</a> })     "Or <link>see a sample</link>"
 *   t.number(1234.5)  t.date(date, { month: "short" })   formatted for the locale
 */
export function createT(locale, messages, { isolate: isolateText = true } = {}) {
  const intl = LOCALES[locale].intl;
  const rtl = isolateText && LOCALES[locale].dir === "rtl";
  const source = (key) => {
    const message = messages[key];
    if (typeof message !== "string") {
      missing(locale, key);
      return null;
    }
    return message;
  };

  const t = (key, values) => {
    const message = source(key);
    if (message === null) return key;
    if (isPlain(message)) return message;
    return String(compile(locale, message).format(rtl ? isolate(values) : values));
  };

  t.rich = (key, values = {}) => {
    const message = source(key);
    if (message === null) return key;
    if (isPlain(message)) return message;
    // Tag handlers get their children as an array, which needs keys before React can render it.
    const wrapped = Object.fromEntries(
      Object.entries(rtl ? isolate(values) : values).map(([name, value]) => [name, typeof value === "function" ? (chunks) => value(keyed(chunks)) : value]),
    );
    const out = compile(locale, message).format(wrapped);
    const parts = Array.isArray(out) ? out : [out];
    // A value that is a function can only come from a tag and a placeholder sharing one name (say `<b>` and `{b}`).
    if (parts.some((part) => typeof part === "function")) {
      throw new Error(`[i18n] "${key}": a placeholder received a function. Does a tag share its name (<b> and {b})?`);
    }
    return Array.isArray(out) ? keyed(out) : out;
  };

  /** ["a", "b", "c"] -> "a, b and c", in the language's own way of joining. */
  t.list = (items) => new Intl.ListFormat(intl, { style: "long", type: "conjunction" }).format(items);
  t.has = (key) => typeof messages[key] === "string";
  t.locale = locale;
  t.dir = LOCALES[locale].dir;
  t.number = (value, options) => new Intl.NumberFormat(intl, options).format(value);
  /** 0.5 -> "50%", the way the language writes it ("50 %" in French, "%50" in Turkish). */
  t.percent = (value) => new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 0 }).format(value);
  /** A number with exactly `digits` decimals (1 by default): 3.8 -> "3.8", or "3,8" in German. */
  t.fixed = (value, digits = 1) => new Intl.NumberFormat(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  t.date = (value, options) => new Intl.DateTimeFormat(intl, options).format(value);
  return t;
}
