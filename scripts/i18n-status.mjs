// How much of each language is translated.
//
//   npm run i18n:status           a table of every language
//   npm run i18n:status -- ja     the keys `ja` is still missing (they show in English until translated)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "src", "messages");
const flatten = (tree, prefix = "", out = {}) => {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, path, out);
    else out[path] = value;
  }
  return out;
};
const load = (locale) => {
  const dir = join(ROOT, locale);
  if (!existsSync(dir)) return {};
  return Object.assign({}, ...readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => flatten(JSON.parse(readFileSync(join(dir, f), "utf8")), f.replace(/\.json$/, ""))));
};

// The supported languages are the ones in src/lib/i18n/config.js
const config = readFileSync(join(import.meta.dirname, "..", "src", "lib", "i18n", "config.js"), "utf8");
const locales = [...config.matchAll(/^\s+(?:"([\w-]+)"|(\w+)): \{ label:/gm)].map((m) => m[1] ?? m[2]);

const english = load("en");
const total = Object.keys(english).length;
const focus = process.argv[2];

if (focus) {
  const have = load(focus);
  const missing = Object.keys(english).filter((key) => !(key in have));
  console.log(`${focus}: ${total - missing.length}/${total} translated, ${missing.length} missing`);
  for (const key of missing) console.log(`  ${key}`);
} else {
  console.log(`${"locale".padEnd(8)} ${"done".padStart(11)}  progress`);
  for (const locale of locales) {
    const done = locale === "en" ? total : Object.keys(english).filter((key) => key in load(locale)).length;
    const bar = "█".repeat(Math.round((done / total) * 20)).padEnd(20, "░");
    console.log(`${locale.padEnd(8)} ${`${done}/${total}`.padStart(11)}  ${bar} ${Math.round((done / total) * 100)}%`);
  }
}
