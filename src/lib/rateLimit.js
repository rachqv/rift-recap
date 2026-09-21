// Fixed-window rate limiters. `createRateLimiter` keeps its counts in memory: exact on one long-running server (`next start`), but
// on serverless hosts every warm instance keeps its own, so it only slows a flood down. `createSharedRateLimiter` counts in a Redis
// store all instances share (Upstash, or Vercel's KV, which is Upstash) when one is configured, and is the in-memory one when not.
// Riot's own limit (100 requests / 2 minutes on a dev key) is what this protects.

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

// A store that can't answer quickly is worse than no store: the limiter sits in front of every recap, so give up fast and fall back.
const STORE_TIMEOUT_MS = 1000;

/** The Redis REST endpoint and token from the environment (Upstash's own names, or the ones Vercel KV sets), or null when there is none. */
export function storeFrom(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/**
 * Like `createRateLimiter`, but counted in the shared Redis store when one is configured, so the limit holds across serverless
 * instances. `check(key)` is async and returns the same `{ ok, retryAfter }`. `name` keeps this limiter's counts apart from the others'.
 * With no store, or when the store fails or is slow, the visitor is counted in memory instead: never blocked because of the store.
 * `env`, `fetchImpl` and `now` are injectable for tests.
 */
export function createSharedRateLimiter({ name, limit, windowMs, env = process.env, fetchImpl = fetch, now = Date.now }) {
  const local = createRateLimiter({ limit, windowMs, now });

  return async function check(key) {
    const store = storeFrom(env);
    if (!store) return local(key);

    const redisKey = `rl:${name}:${key}`;
    try {
      // SET ... NX opens the window (and its expiry) only for the first hit; INCR counts it; PTTL says how long is left. One round trip.
      const response = await fetchImpl(`${store.url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${store.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["SET", redisKey, 0, "PX", windowMs, "NX"], ["INCR", redisKey], ["PTTL", redisKey]]),
        signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`store answered ${response.status}`);
      const [, count, ttl] = (await response.json()).map((entry) => entry.result);
      if (typeof count !== "number") throw new Error("store gave no count");
      // A key without an expiry (PTTL < 0) can't happen after SET ... PX, but never leave a visitor locked out for good if it does.
      const left = ttl > 0 ? ttl : windowMs;
      return { ok: count <= limit, retryAfter: Math.max(1, Math.ceil(left / 1000)) };
    } catch (error) {
      console.error("Rate limit store failed, counting in memory", error);
      return local(key);
    }
  };
}
