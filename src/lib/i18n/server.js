import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, matchAcceptLanguage } from "./config";
import { loadMessages, pickNamespaces } from "./messages";
import { CLIENT_NAMESPACES } from "./namespaces";
import { createT } from "./translate";

/**
 * The language for this request: the one chosen with the language switch (a cookie), else what the browser asks for, else
 * English. Reading cookies makes a page dynamic, which every page that shows a player already is.
 */
export const getLocale = cache(async () => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return matchAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
});

/** The translate function for `locale` (this request's, when omitted). Pass it down to server components as `t`. */
export const getT = cache(async (locale) => {
  const use = locale ?? (await getLocale());
  return createT(use, await loadMessages(use));
});

/** What the browser-side provider needs: the locale and the messages of the namespaces client components use. */
export async function getClientI18n(locale) {
  const use = locale ?? (await getLocale());
  return { locale: use, messages: pickNamespaces(await loadMessages(use), CLIENT_NAMESPACES) };
}
