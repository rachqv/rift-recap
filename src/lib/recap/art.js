import "server-only";
import { pickSplashes } from "@/lib/riot/skins";

/** A player's stable seed, so their skins don't change between visits. */
export const artSeed = (account) => `${account.gameName}#${account.tagLine}`;

/** Four different skins of the top champion. */
export const topChampionSkins = (index, recap, seed) => pickSplashes(index, recap.topChampions[0].id, { count: 4, seed });

// The intro, the champion slide and the finale all feature the top champion: give each its own skin.
const at = (skins, i) => skins[i % skins.length];
const introSkin = (skins) => at(skins, 0);
const championSkins = (skins) => [...skins.slice(1), skins[0]]; // starts on a different skin from the intro
export const personaSkin = (skins) => at(skins, 2);

/**
 * Chooses the backdrop art for each slide. Every slide that shows a champion gets a different skin where
 * possible, and the signature-champion slide cycles through several.
 *
 * @returns each entry is `{ url, name }` (or an array of them, for the cycling slide); `null` when a slide has none.
 */
export async function resolveArt({ recap, modes, index, seed }) {
  const top = recap.topChampions[0].id;
  const one = (id, salt) => pickSplashes(index, id, { seed: `${seed}:${salt}` }).then(([skin]) => skin);

  const [topSkins, kda, normal, aram, nemesis, bestMatchup, duo] = await Promise.all([
    topChampionSkins(index, recap, seed),
    one(recap.bestGame?.champion ?? top, "kda"),
    modes.normal ? one(modes.normal.topChampions[0].id, "normal") : null,
    modes.aram ? one(modes.aram.topChampions[0].id, "aram") : null,
    recap.nemesis ? one(recap.nemesis.id, "nemesis") : null,
    recap.bestMatchup ? one(recap.bestMatchup.id, "best") : null,
    recap.duo?.bestPair.you ? one(recap.duo.bestPair.you, "duo") : null,
  ]);

  return {
    intro: introSkin(topSkins),
    champion: championSkins(topSkins),
    persona: personaSkin(topSkins),
    kda,
    normal,
    aram,
    nemesis,
    bestMatchup,
    duo,
  };
}
