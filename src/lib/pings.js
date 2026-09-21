// The ping types match-v5 reports for each player, and what using each one says about you. Shared by the squad awards
// (which only need the total) and the solo "ping personality".

export const PING_FIELDS = [
  "allInPings", "assistMePings", "commandPings", "enemyMissingPings", "enemyVisionPings", "getBackPings",
  "holdPings", "needVisionPings", "onMyWayPings", "pushPings", "visionClearedPings",
];

/** The ping types that describe a personality. Their names, titles and lines are in the `insights.pings` messages. */
export const PING_STYLE_KEYS = [
  "getBackPings", "enemyMissingPings", "onMyWayPings", "assistMePings", "needVisionPings", "commandPings",
  "pushPings", "holdPings", "allInPings", "enemyVisionPings", "visionClearedPings",
];

/** Total pings in one participant. */
export const sumPings = (p) => PING_FIELDS.reduce((total, field) => total + (p[field] ?? 0), 0);
