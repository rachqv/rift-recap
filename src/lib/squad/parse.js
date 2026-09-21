import { isPlatform } from "@/lib/riot/regions";

// Squad and head-to-head pages are addressed by query string, so a page can be shared as a plain link:
//   /squad?region=euw1&p=Name%23TAG&p=Other%23TAG
//   /versus?a=euw1:Name%23TAG&b=na1:Other%23TAG
//   /clash?region=euw1&a=Name%23TAG&a=Other%23TAG&b=Third%23TAG&b=Fourth%23TAG

export const MIN_SQUAD = 2;
export const MAX_SQUAD = 5;

/**
 * Cleans up text pasted from chat, the game client or a phone keyboard: invisible marks (zero-width, direction marks),
 * odd spaces (non-breaking, ideographic) and the full-width "＃" that some keyboards type instead of "#".
 */
export function cleanRiotIdText(text) {
  return String(text ?? "")
    .replace(/[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, "")
    .replace(/[  -   　]/g, " ")
    .replace(/[＃﹟]/g, "#");
}

/** "Name#TAG" -> `{ gameName, tagLine }`, or null. Game names can't contain '#', so split on the last one. */
export function parseRiotId(text) {
  const value = cleanRiotIdText(text).trim();
  const at = value.lastIndexOf("#");
  if (at < 1) return null;
  const gameName = value.slice(0, at).trim();
  const tagLine = value.slice(at + 1).trim();
  return gameName && tagLine ? { gameName, tagLine } : null;
}

export const formatRiotId = ({ gameName, tagLine }) => `${gameName}#${tagLine}`;

// Profile pages of the popular stats sites name the player as `/<server>/<Name>-<TAG>`, so a pasted link says who and where.
const PROFILE_HOSTS = ["op.gg", "u.gg", "leagueofgraphs.com"];
// The sites' short server names (their other ones are Riot's own platform ids, like "euw1").
const SERVER_SLUGS = { na: "na1", euw: "euw1", eune: "eun1", eun: "eun1", lan: "la1", las: "la2", oce: "oc1", jp: "jp1", br: "br1", tr: "tr1", me: "me1", sg: "sg2", ph: "ph2", tw: "tw2", th: "th2", vn: "vn2" };

const decodePart = (part) => {
  try {
    return decodeURIComponent(part.replace(/\+/g, " "));
  } catch {
    return part; // a malformed escape: use it as typed
  }
};

/**
 * A pasted profile link -> `{ region, gameName, tagLine }`, or null when the text is not a link to a known site.
 * Game names may contain hyphens and tags never do, so the name and tag are split on the last one.
 */
export function parseProfileLink(text) {
  const value = cleanRiotIdText(text).trim();
  if (!value.includes("/") || /\s/.test(value.replace(/%20|\+/g, ""))) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!PROFILE_HOSTS.some((site) => host === site || host.endsWith(`.${site}`))) return null;

  const parts = url.pathname.split("/").filter(Boolean).map(decodePart);
  for (let i = 0; i < parts.length - 1; i++) {
    const slug = parts[i].toLowerCase();
    const region = isPlatform(slug) ? slug : SERVER_SLUGS[slug];
    const dash = parts[i + 1].lastIndexOf("-");
    if (!region || dash < 1) continue;
    const gameName = parts[i + 1].slice(0, dash).trim();
    const tagLine = parts[i + 1].slice(dash + 1).trim();
    if (gameName && /^[^\s-]{2,5}$/u.test(tagLine)) return { region, gameName, tagLine };
  }
  return null;
}

/** What someone typed or pasted into a Riot ID box: a profile link (which also names the server) or a plain "Name#TAG". */
export function readRiotIdInput(text) {
  return parseProfileLink(text) ?? parseRiotId(text);
}

// Next gives a repeated parameter as an array and a single one as a string.
const all = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const first = (value) => all(value)[0];

/** Reads `?region=&p=&p=...`. Duplicates (ignoring case) are dropped; unparseable entries are reported. */
export function parseSquadParams(searchParams) {
  const region = String(first(searchParams.region) ?? "");
  const players = [];
  const invalid = [];
  const seen = new Set();

  for (const raw of all(searchParams.p)) {
    const text = String(raw).trim();
    if (!text) continue;
    const id = parseRiotId(text);
    if (!id) {
      invalid.push(text);
      continue;
    }
    const key = formatRiotId(id).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    players.push(id);
  }
  return { region, regionValid: isPlatform(region), players, invalid, tooMany: players.length > MAX_SQUAD };
}

export function squadPath(region, players) {
  const query = new URLSearchParams({ region });
  for (const player of players) query.append("p", formatRiotId(player));
  return `/squad?${query}`;
}

// The share card for a page lives next to it: same query, different path.
export const squadCardPath = (region, players) => squadPath(region, players).replace("/squad?", "/squad/card?");

/** "euw1:Name#TAG" -> `{ region, gameName, tagLine }`, or null. */
function parseSlot(raw) {
  const value = String(raw ?? "").trim();
  const colon = value.indexOf(":");
  if (colon < 1) return null;
  const region = value.slice(0, colon);
  const id = parseRiotId(value.slice(colon + 1));
  return isPlatform(region) && id ? { region, ...id } : null;
}

const formatSlot = (player) => `${player.region}:${formatRiotId(player)}`;

export function parseVersusParams(searchParams) {
  return { a: parseSlot(first(searchParams.a)), b: parseSlot(first(searchParams.b)), demo: searchParams.demo != null };
}

export function versusPath(a, b) {
  const query = new URLSearchParams();
  query.set("a", formatSlot(a));
  if (b) query.set("b", formatSlot(b));
  return `/versus?${query}`;
}

export const samePlayer = (x, y) => x.region === y.region && formatRiotId(x).toLowerCase() === formatRiotId(y).toLowerCase();

export const versusCardPath = (a, b) => versusPath(a, b).replace("/versus?", "/versus/card?");

/** Reads `?region=&a=&a=&b=&b=...`: two squads on one server. Each squad drops duplicates (ignoring case); a player on both is reported. */
export function parseClashParams(searchParams) {
  const region = String(first(searchParams.region) ?? "");
  const invalid = [];
  const side = (key) => {
    const players = [];
    const seen = new Set();
    for (const raw of all(searchParams[key])) {
      const text = String(raw).trim();
      if (!text) continue;
      const id = parseRiotId(text);
      if (!id) {
        invalid.push(text);
        continue;
      }
      const name = formatRiotId(id).toLowerCase();
      if (seen.has(name)) continue;
      seen.add(name);
      players.push(id);
    }
    return players;
  };
  const [a, b] = [side("a"), side("b")];
  const inA = new Set(a.map((p) => formatRiotId(p).toLowerCase()));
  return { region, regionValid: isPlatform(region), a, b, invalid, overlap: b.filter((p) => inA.has(formatRiotId(p).toLowerCase())), tooMany: a.length > MAX_SQUAD || b.length > MAX_SQUAD };
}

export function clashPath(region, a, b) {
  const query = new URLSearchParams({ region });
  for (const player of a) query.append("a", formatRiotId(player));
  for (const player of b) query.append("b", formatRiotId(player));
  return `/clash?${query}`;
}

export const clashCardPath = (region, a, b) => clashPath(region, a, b).replace("/clash?", "/clash/card?");
