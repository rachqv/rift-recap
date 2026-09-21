import { defaultT } from "@/lib/i18n/en";
import { RANGES } from "./config";

// The "This season / Last 90 days / Last 30 days" switch. A page keeps the range in `?range=`; the season is the default
// and leaves the link unchanged.

/**
 * Links for the switch on a page.
 * @param pathname the page's path, like "/squad"
 * @param params the page's other query parameters as `[name, value]` pairs (`range` and `since` are dropped: a saved
 * comparison from one range means nothing in another)
 * @param current the range key now in use
 * @param t translates the labels (English by default)
 * @returns `[{ key, label, href, current }]`
 */
export function rangeLinks(pathname, params, current, t = defaultT) {
  return Object.keys(RANGES).map((key) => {
    const query = new URLSearchParams(params.filter(([name]) => name !== "range" && name !== "since"));
    if (key !== "season") query.set("range", key);
    const text = query.toString();
    return { key, label: t(`common.range.${key}`), href: text ? `${pathname}?${text}` : pathname, current: key === current };
  });
}

/** `[name, value]` pairs of a Next `searchParams` object (repeated parameters give several pairs). */
export const paramPairs = (searchParams) =>
  Object.entries(searchParams).flatMap(([name, value]) => (Array.isArray(value) ? value.map((v) => [name, v]) : value == null ? [] : [[name, value]]));

/**
 * Splits match-v5 DTOs at `at` (a Date): `current` are the games from then on, `earlier` the ones before it. The order is kept.
 */
export function splitAt(matches, at) {
  const current = [];
  const earlier = [];
  for (const match of matches) (match.info.gameCreation >= at.getTime() ? current : earlier).push(match);
  return { current, earlier };
}

/** Adds `range` to a path that may already have a query, unless it is the default season. */
export const withRange = (path, range) => (range === "season" ? path : `${path}${path.includes("?") ? "&" : "?"}range=${range}`);
