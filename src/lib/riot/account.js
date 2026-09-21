import "server-only";
import { riotFetch } from "./client";
import { accountHostFor } from "./regions";

/** Resolves a Riot ID (Name#TAG) to `{ puuid, gameName, tagLine }`. */
export function getAccountByRiotId(platform, gameName, tagLine) {
  return riotFetch(
    accountHostFor(platform),
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    { revalidate: 86400 },
  );
}
