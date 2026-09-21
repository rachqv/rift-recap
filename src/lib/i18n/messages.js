import { DEFAULT_LOCALE } from "./config";
import { EN_FLAT } from "./en";
import { flatten } from "./flatten";
import { NAMESPACES } from "./namespaces";

// One locale's messages, in English wherever the locale has no translation yet. Loading one is a dynamic import of each
// namespace file; a file that doesn't exist (a locale that is only partly translated) just contributes nothing.
const loaded = new Map();

async function loadNamespace(locale, namespace) {
  try {
    const { default: tree } = await import(`../../messages/${locale}/${namespace}.json`);
    return flatten(tree, namespace);
  } catch {
    return {};
  }
}

/** All messages for `locale`, with English filling any gap. Cached for the life of the server. */
export function loadMessages(locale) {
  if (locale === DEFAULT_LOCALE) return Promise.resolve(EN_FLAT);
  if (!loaded.has(locale)) {
    loaded.set(
      locale,
      Promise.all(NAMESPACES.map((namespace) => loadNamespace(locale, namespace))).then((parts) => Object.assign({}, EN_FLAT, ...parts)),
    );
  }
  return loaded.get(locale);
}

/** Just the given namespaces of `messages`: what a client component needs, without sending the whole catalog. */
export function pickNamespaces(messages, namespaces) {
  const prefixes = namespaces.map((namespace) => `${namespace}.`);
  return Object.fromEntries(Object.entries(messages).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix))));
}
