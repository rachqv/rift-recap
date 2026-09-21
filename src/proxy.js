import { NextResponse } from "next/server";
import { clientKey, createSharedRateLimiter } from "@/lib/rateLimit";

// Everything that costs Riot API requests (a player's games) or draws an image, per visitor address. Generous for real use (a
// recap is one page load), tight enough that a script can't burn the API key's budget. The counts are shared between serverless
// instances when a Redis store is configured (see lib/rateLimit.js and .env.example); otherwise they are per instance.
const pages = createSharedRateLimiter({ name: "pages", limit: 30, windowMs: 60_000 });
const cards = createSharedRateLimiter({ name: "cards", limit: 20, windowMs: 60_000 });

export async function proxy(request) {
  // Local development reloads constantly; the limit is for a deployed site.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;
  const isCard = pathname.endsWith("/card");
  // The head-to-head, squad and squad vs squad pages are free forms until the link names players; only then do they load games.
  const loadsPlayers = pathname.startsWith("/recap/") || searchParams.size > 0;
  if (!isCard && !loadsPlayers) return NextResponse.next();

  const { ok, retryAfter } = await (isCard ? cards : pages)(clientKey(request.headers));
  if (ok) return NextResponse.next();

  return new NextResponse("Too many requests. Wait a moment and try again.", {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Link prefetches from the browser aren't a person asking for a recap, so they're left out (`missing`). The matcher has to be a
// literal so Next can read it at build time.
export const config = {
  matcher: [
    { source: "/recap/:path*", missing: [{ type: "header", key: "next-router-prefetch" }] },
    { source: "/versus/:path*", missing: [{ type: "header", key: "next-router-prefetch" }] },
    { source: "/squad/:path*", missing: [{ type: "header", key: "next-router-prefetch" }] },
    { source: "/clash/:path*", missing: [{ type: "header", key: "next-router-prefetch" }] },
    { source: "/demo/card", missing: [{ type: "header", key: "next-router-prefetch" }] },
  ],
};
