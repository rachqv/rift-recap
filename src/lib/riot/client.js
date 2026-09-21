import "server-only";

export class RiotApiError extends Error {
  constructor(status, message, { retryAfter } = {}) {
    super(message);
    this.name = "RiotApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// When Riot says "slow down" (429) with a short Retry-After, waiting and trying again beats failing the whole page.
// Longer waits aren't worth holding a request open for, so those still surface as a rate-limit error.
const MAX_RETRIES = 2;
const MAX_RETRY_WAIT_SECONDS = 10;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Thin fetch wrapper for the Riot API. Server-only: the API key stays out of the client bundle.
 * `host` is a platform (euw1) or regional (europe) subdomain.
 *
 * `revalidate` is how many seconds a response may be reused from Next's cache. Use 0 for data that must be fresh on every
 * request: it is then not cached at all. (A cached entry that has expired is still served once while it refreshes in the
 * background, so a short time isn't "fresh", it just means "one view behind".)
 */
export async function riotFetch(host, path, { params, revalidate = 300 } = {}) {
  const key = process.env.RIOT_API_KEY;
  if (!key) {
    throw new RiotApiError(500, "RIOT_API_KEY is not set. Copy .env.local to .env.local and add your key.");
  }

  const url = new URL(`https://${host}.api.riotgames.com${path}`);
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { "X-Riot-Token": key },
      ...(revalidate === 0 ? { cache: "no-store" } : { next: { revalidate } }),
    });

    if (res.ok) return res.json();

    const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
    if (res.status === 429 && attempt < MAX_RETRIES && retryAfter && retryAfter <= MAX_RETRY_WAIT_SECONDS) {
      await sleep(retryAfter * 1000);
      continue;
    }
    throw new RiotApiError(res.status, `Riot API responded ${res.status} for ${path}`, { retryAfter });
  }
}
