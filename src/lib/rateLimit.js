// A fixed-window rate limiter kept in memory. It is exact on one long-running server (`next start`). On serverless hosts every
// warm instance keeps its own counts, so it only slows a flood down; use the host's firewall (Vercel WAF, Cloudflare) or a
// shared store for a hard limit. Riot's own limit (100 requests / 2 minutes on a dev key) is what this protects.

// Past this many tracked clients, expired windows are swept so a wide flood can't grow the map without bound.
const SWEEP_AT = 5000;

/**
 * `limit` requests per `windowMs`, counted per key. `check(key)` returns `{ ok, retryAfter }` (seconds until the window ends).
 * `now` is a clock, injectable for tests.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const windows = new Map();

  return function check(key) {
    const time = now();
    if (windows.size >= SWEEP_AT) {
      for (const [k, w] of windows) if (w.resetAt <= time) windows.delete(k);
    }
    let window = windows.get(key);
    if (!window || window.resetAt <= time) {
      window = { count: 0, resetAt: time + windowMs };
      windows.set(key, window);
    }
    window.count += 1;
    return { ok: window.count <= limit, retryAfter: Math.max(1, Math.ceil((window.resetAt - time) / 1000)) };
  };
}

/**
 * The visitor's address. Behind Vercel (and most proxies) `x-forwarded-for` is set by the platform; when the app is exposed
 * directly a client could forge it, so don't treat this as identity, only as a way to spread the load.
 */
export function clientKey(headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}
