"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { isPlatform } from "@/lib/riot/regions";
import { readRiotIdInput } from "@/lib/squad/parse";

// How much of a rejected Riot ID is sent back (a real one is at most 16 + 1 + 5 characters).
const MAX_TYPED = 64;

export async function searchPlayer(formData) {
  const riotId = String(formData.get("riotId") ?? "").trim();
  const chosen = String(formData.get("region") ?? "");

  // A plain Riot ID, or a pasted profile link, which also says which server the player is on.
  const id = readRiotIdInput(riotId);
  const region = id?.region ?? chosen;

  if (!id || !isPlatform(region)) {
    // Send back what was typed, so a typo is a small fix rather than starting over.
    const params = new URLSearchParams({ error: "invalid", id: riotId.slice(0, MAX_TYPED) });
    if (isPlatform(chosen)) params.set("region", chosen);
    redirect(`/?${params}`);
  }

  redirect(`/recap/${region}/${encodeURIComponent(id.gameName)}/${encodeURIComponent(id.tagLine)}`);
}

/** Remembers the language chosen with the language switch. Setting a cookie in an action redraws the current page. */
export async function setLocale(locale) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
