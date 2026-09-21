import { useSyncExternalStore } from "react";
import { isPlatform } from "@/lib/riot/regions";

// Players this browser has successfully looked up. Stored locally, never sent anywhere.
// Riot has no player-search API, so this is the only source of "suggestions" for real players.
//
// The list is newest first. A player can be pinned (`pinned: true`): pinned players are never pushed out by newer lookups,
// and they are listed first. Lists saved before pinning existed have no such field and read as nothing pinned.
const KEY = "riftRecap.recentPlayers.v1";
const CHANGE_EVENT = "rift-recap:recent-players";
// How many players that are not pinned are kept.
export const MAX_RECENT = 20;
const EMPTY = "[]";

const sameEntry = (a, b) =>
  a.region === b.region && a.gameName.toLowerCase() === b.gameName.toLowerCase() && a.tagLine.toLowerCase() === b.tagLine.toLowerCase();

/** The pinned players first, each group still newest first. */
export const pinnedFirst = (players) => [...players.filter((p) => p.pinned), ...players.filter((p) => !p.pinned)];

/** Drops the oldest unpinned players beyond `MAX_RECENT`; pinned ones always stay. */
export function trimRecents(players) {
  let unpinned = 0;
  return players.filter((p) => p.pinned || ++unpinned <= MAX_RECENT);
}

/** The list with `player` moved (or added) to the top. A pinned player stays pinned. */
export function withPlayer(players, { gameName, tagLine, region }) {
  const entry = { gameName, tagLine, region };
  const before = players.find((p) => sameEntry(p, entry));
  if (before?.pinned) entry.pinned = true;
  return trimRecents([entry, ...players.filter((p) => !sameEntry(p, entry))]);
}

/** The list with `player` pinned, or unpinned if it was pinned. It keeps its place in the order. */
export function withPinToggled(players, player) {
  return trimRecents(
    players.map((p) => {
      if (!sameEntry(p, player)) return p;
      const { pinned, ...rest } = p;
      return pinned ? rest : { ...rest, pinned: true };
    }),
  );
}

// The functions below are shaped for React's useSyncExternalStore: the snapshot is the raw JSON
// string, so it stays referentially stable until the stored data actually changes.

export function subscribeRecentPlayers(callback) {
  window.addEventListener("storage", callback); // changes from other tabs
  window.addEventListener(CHANGE_EVENT, callback); // changes from this tab
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function getRecentPlayersSnapshot() {
  try {
    return window.localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY; // storage blocked (private mode, disabled cookies, ...)
  }
}

export const getServerRecentPlayersSnapshot = () => EMPTY;

/** Parses a snapshot into `[{ gameName, tagLine, region, pinned? }]`, dropping anything malformed. */
export function parseRecentPlayers(snapshot) {
  try {
    const list = JSON.parse(snapshot);
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => p && typeof p.gameName === "string" && typeof p.tagLine === "string" && isPlatform(p.region))
      .map(({ gameName, tagLine, region, pinned }) => ({ gameName, tagLine, region, ...(pinned === true && { pinned: true }) }));
  } catch {
    return [];
  }
}

function write(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage is unavailable; suggestions just won't persist.
  }
}

const read = () => parseRecentPlayers(getRecentPlayersSnapshot());

/** Moves (or adds) a player to the top of the list. */
export function rememberPlayer(player) {
  write(withPlayer(read(), player));
}

/** Pins a player to the top of the list, or unpins one that is pinned. */
export function togglePinned(player) {
  write(withPinToggled(read(), player));
}

/** Removes one player from the list (pinned or not). */
export function forgetPlayer(player) {
  write(read().filter((p) => !sameEntry(p, player)));
}

/** Empties the list, pinned players too. */
export function clearRecentPlayers() {
  write([]);
}

/** Forgets everyone who is not pinned. */
export function clearUnpinnedPlayers() {
  write(read().filter((p) => p.pinned));
}

export const DEFAULT_REGION = "na1";

/**
 * The server a form should start on: the one of the player looked up last, so people who play outside North America
 * don't have to change it every visit. The server render (and a browser with no history) gets the default.
 */
export function useLastRegion() {
  const snapshot = useSyncExternalStore(subscribeRecentPlayers, getRecentPlayersSnapshot, getServerRecentPlayersSnapshot);
  return parseRecentPlayers(snapshot)[0]?.region ?? DEFAULT_REGION;
}
