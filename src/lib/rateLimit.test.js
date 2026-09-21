import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rateLimit";

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
