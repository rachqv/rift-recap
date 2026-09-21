"use client";

import { useEffect } from "react";
import { rememberPlayer } from "@/lib/recentPlayers";

/**
 * Renders nothing. Saves a player to this browser's recent searches once their recap has loaded, so only
 * players that exist (and that Riot returned) ever show up as suggestions.
 */
export default function RememberPlayer({ gameName, tagLine, region }) {
  useEffect(() => {
    rememberPlayer({ gameName, tagLine, region });
  }, [gameName, tagLine, region]);

  return null;
}
