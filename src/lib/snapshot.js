// Snapshots let a page say "here is how it looked last time" without a database: the numbers worth comparing are packed
// into a URL parameter (`?since=...`) that anyone can save and open later. The value is untrusted user input, so every
// reader checks its shape and clamps the numbers instead of trusting what it decodes.

const MAX_LENGTH = 1200; // characters of the encoded value; a real snapshot is well under 300

/** Object -> URL-safe text. */
export const encodeSnapshot = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** URL text -> whatever object was encoded, or null when it isn't valid. Callers must still check the fields. */
export function decodeSnapshot(text) {
  const value = Array.isArray(text) ? text[0] : text;
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A finite number clamped to `[low, high]`, or null. */
export function clampNumber(value, low, high) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  return value !== "" && Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : null;
}

/** A timestamp in milliseconds, or null when it is in the far past or the future. Rejected, not clamped: a made-up date would read as real. */
export function readTime(value) {
  const t = clampNumber(value, -Infinity, Infinity);
  return t != null && t >= Date.UTC(2020, 0, 1) && t <= Date.now() + 86400000 ? t : null;
}

export const round = (x, digits = 3) => Math.round(x * 10 ** digits) / 10 ** digits;
