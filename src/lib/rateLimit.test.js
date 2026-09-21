import { describe, expect, it, vi } from "vitest";
import { clientKey, createRateLimiter, createSharedRateLimiter, storeFrom } from "./rateLimit";

const clock = (start = 0) => {
  let time = start;
  return { now: () => time, advance: (ms) => (time += ms) };
};

describe("createRateLimiter", () => {
  it("allows up to the limit, then refuses with the seconds left", () => {
    const { now, advance } = clock();
    const check = createRateLimiter({ limit: 3, windowMs: 60_000, now });
    expect([check("a").ok, check("a").ok, check("a").ok]).toEqual([true, true, true]);
    advance(15_000);
    expect(check("a")).toEqual({ ok: false, retryAfter: 45 });
  });

  it("counts each key on its own", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock().now });
    expect(check("a").ok).toBe(true);
    expect(check("a").ok).toBe(false);
    expect(check("b").ok).toBe(true);
  });

  it("starts a fresh window once the last one ends", () => {
    const { now, advance } = clock();
    const check = createRateLimiter({ limit: 1, windowMs: 60_000, now });
    check("a");
    expect(check("a").ok).toBe(false);
    advance(60_000);
    expect(check("a").ok).toBe(true);
  });

  it("never reports a wait under one second", () => {
    const { now, advance } = clock();
    const check = createRateLimiter({ limit: 1, windowMs: 1000, now });
    check("a");
    advance(999);
    expect(check("a").retryAfter).toBe(1);
  });

  it("sweeps expired windows instead of growing forever", () => {
    const { now, advance } = clock();
    const check = createRateLimiter({ limit: 1, windowMs: 1000, now });
    for (let i = 0; i < 5000; i++) check(`ip-${i}`);
    advance(2000);
    // The sweep runs on the next request; the old client starts fresh either way, and the call must not throw.
    expect(check("ip-0").ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("takes the first address of x-forwarded-for", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});

// A tiny stand-in for Redis's REST pipeline: SET ... PX ... NX, INCR and PTTL over one shared map, with a clock.
function fakeRedis(now) {
  const data = new Map();
  const calls = [];
  const run = ([command, key, ...rest]) => {
    const entry = data.get(key);
    const live = entry && entry.expiresAt > now() ? entry : undefined;
    if (command === "SET") {
      if (!live) data.set(key, { value: rest[0], expiresAt: now() + rest[2] });
      return { result: live ? null : "OK" };
    }
    if (command === "INCR") {
      const current = live ?? { value: 0, expiresAt: Infinity };
      current.value += 1;
      data.set(key, current);
      return { result: current.value };
    }
    if (command === "PTTL") return { result: live ? live.expiresAt - now() : -2 };
    throw new Error(`unexpected ${command}`);
  };
  const fetchImpl = vi.fn(async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => JSON.parse(init.body).map(run) };
  });
  return { fetchImpl, calls };
}

const ENV = { UPSTASH_REDIS_REST_URL: "https://redis.example/", UPSTASH_REDIS_REST_TOKEN: "secret" };

describe("storeFrom", () => {
  it("reads Upstash's variables, or the ones Vercel KV sets, and drops a trailing slash", () => {
    expect(storeFrom(ENV)).toEqual({ url: "https://redis.example", token: "secret" });
    expect(storeFrom({ KV_REST_API_URL: "https://kv.example", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://kv.example", token: "t" });
  });

  it("is null unless both the address and the token are set", () => {
    expect(storeFrom({})).toBeNull();
    expect(storeFrom({ UPSTASH_REDIS_REST_URL: "https://redis.example" })).toBeNull();
  });
});

describe("createSharedRateLimiter", () => {
  it("counts in the shared store: allows up to the limit, then refuses with the seconds left", async () => {
    const { now, advance } = clock();
    const { fetchImpl, calls } = fakeRedis(now);
    const check = createSharedRateLimiter({ name: "pages", limit: 2, windowMs: 60_000, env: ENV, fetchImpl, now });
    expect((await check("a")).ok).toBe(true);
    expect((await check("a")).ok).toBe(true);
    advance(15_000);
    expect(await check("a")).toEqual({ ok: false, retryAfter: 45 });
    // One round trip per request, authenticated, to the pipeline endpoint.
    expect(calls).toHaveLength(3);
    expect(calls[0].url).toBe("https://redis.example/pipeline");
    expect(calls[0].init.headers.Authorization).toBe("Bearer secret");
  });

  it("shares the count between instances, and keeps keys and limiters apart", async () => {
    const { now } = clock();
    const { fetchImpl } = fakeRedis(now);
    const instance = () => createSharedRateLimiter({ name: "pages", limit: 1, windowMs: 60_000, env: ENV, fetchImpl, now });
    expect((await instance()("a")).ok).toBe(true);
    expect((await instance()("a")).ok).toBe(false); // another instance, same visitor
    expect((await instance()("b")).ok).toBe(true);
    const cards = createSharedRateLimiter({ name: "cards", limit: 1, windowMs: 60_000, env: ENV, fetchImpl, now });
    expect((await cards("a")).ok).toBe(true);
  });

  it("starts a fresh window once the last one ends", async () => {
    const { now, advance } = clock();
    const { fetchImpl } = fakeRedis(now);
    const check = createSharedRateLimiter({ name: "pages", limit: 1, windowMs: 60_000, env: ENV, fetchImpl, now });
    await check("a");
    expect((await check("a")).ok).toBe(false);
    advance(60_000);
    expect((await check("a")).ok).toBe(true);
  });

  it("counts in memory when no store is configured, without calling out", async () => {
    const fetchImpl = vi.fn();
    const check = createSharedRateLimiter({ name: "pages", limit: 1, windowMs: 60_000, env: {}, fetchImpl, now: clock().now });
    expect((await check("a")).ok).toBe(true);
    expect((await check("a")).ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["answers with an error", async () => ({ ok: false, status: 500, json: async () => ({}) })],
    ["gives an unreadable answer", async () => ({ ok: true, status: 200, json: async () => [{ error: "nope" }, { error: "nope" }, { error: "nope" }] })],
    ["is unreachable", async () => Promise.reject(new Error("network down"))],
  ])("falls back to counting in memory when the store %s", async (_, fetchImpl) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const check = createSharedRateLimiter({ name: "pages", limit: 1, windowMs: 60_000, env: ENV, fetchImpl, now: clock().now });
    expect((await check("a")).ok).toBe(true);
    expect((await check("a")).ok).toBe(false); // still limited, just per instance
    error.mockRestore();
  });
});
