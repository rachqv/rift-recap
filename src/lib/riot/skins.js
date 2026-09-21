import "server-only";
import { seededRandom, shuffled } from "@/lib/random";
import { championId, getLocalizedJson, splashUrl } from "./ddragon";

/** `[{ num, name }]` for a champion, from Data Dragon. Empty on failure. */
async function getSkinList(version, locale, id) {
  try {
    const key = championId(id);
    const { data } = await getLocalizedJson(version, locale, `champion/${key}.json`);
    return (data[key]?.skins ?? []).map((skin) => ({ num: skin.num, name: skin.name === "default" ? null : skin.name }));
  } catch {
    return [];
  }
}

// Not every listed skin has splash art on the CDN (some return 403), so check before using one.
// Kept per server process: whether an image exists almost never changes.
const availability = new Map();

async function splashExists(id, num) {
  const url = splashUrl(id, num);
  if (!availability.has(url)) {
    availability.set(
      url,
      fetch(url, { method: "HEAD" })
        .then((res) => res.ok)
        .catch(() => false),
    );
  }
  return availability.get(url);
}

/**
 * Picks `count` different skins of a champion for backdrops. The choice is seeded, so a given player sees the
 * same art every visit but different players (and different slides) get different skins. Always returns at
 * least the default skin.
 * @returns {Promise<Array<{ num: number, name: string | null, url: string }>>}
 */
export async function pickSplashes(index, id, { count = 1, seed = "" } = {}) {
  const fallback = [{ num: 0, name: null, url: splashUrl(id, 0) }];
  if (!index.version) return fallback;

  const skins = await getSkinList(index.version, index.locale, id);
  if (skins.length === 0) return fallback;

  const order = shuffled(skins, seededRandom(`${seed}:${id}`));
  const picked = [];
  // Check a few candidates at a time, in parallel, and keep going only if too many turn out to be missing.
  for (let at = 0; at < order.length && picked.length < count; at += count + 2) {
    const batch = order.slice(at, at + count + 2);
    const ok = await Promise.all(batch.map((skin) => splashExists(id, skin.num)));
    for (const [i, skin] of batch.entries()) {
      if (ok[i] && picked.length < count) picked.push({ ...skin, url: splashUrl(id, skin.num) });
    }
  }
  return picked.length > 0 ? picked : fallback;
}
