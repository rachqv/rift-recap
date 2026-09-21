"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import PinIcon from "@/components/PinIcon";
import {
  clearRecentPlayers,
  clearUnpinnedPlayers,
  forgetPlayer,
  getRecentPlayersSnapshot,
  getServerRecentPlayersSnapshot,
  parseRecentPlayers,
  pinnedFirst,
  subscribeRecentPlayers,
  togglePinned,
} from "@/lib/recentPlayers";
import { useT } from "@/lib/i18n/client";
import { PLATFORMS } from "@/lib/riot/regions";
import { squadPath, versusPath } from "@/lib/squad/parse";
import styles from "./PlayersList.module.css";

const encode = encodeURIComponent;

/**
 * Everyone this browser has looked up, with a shortcut to each thing you can do with them. Pinned players come first and stay
 * however many others are looked up. The list lives only in this browser (see `lib/recentPlayers.js`); nothing here is sent
 * anywhere.
 */
export default function PlayersList() {
  const t = useT();
  const snapshot = useSyncExternalStore(subscribeRecentPlayers, getRecentPlayersSnapshot, getServerRecentPlayersSnapshot);
  const players = useMemo(() => pinnedFirst(parseRecentPlayers(snapshot)), [snapshot]);
  const anyPinned = players.some((player) => player.pinned);

  if (players.length === 0) {
    return (
      <p className={styles.empty}>
        {t.rich("players.empty", { home: (chunks) => <Link href="/">{chunks}</Link> })}
      </p>
    );
  }

  return (
    <>
      <ul className={styles.list}>
        {players.map((player) => {
          const label = `${player.gameName}#${player.tagLine}`;
          return (
            <li key={`${player.region}:${label.toLowerCase()}`} className={styles.row} data-pinned={player.pinned || undefined}>
              <span className={styles.who}>
                <span className={styles.name}>{player.gameName}</span>
                <span className={styles.tag}>#{player.tagLine}</span>
                <span className={styles.badge}>{PLATFORMS[player.region] ? t(`common.regions.${player.region}`) : player.region}</span>
              </span>
              <span className={styles.actions}>
                <Link href={`/recap/${player.region}/${encode(player.gameName)}/${encode(player.tagLine)}`}>{t("players.recap")}</Link>
                <Link href={versusPath(player)}>{t("players.versus")}</Link>
                <Link href={squadPath(player.region, [player])}>{t("players.squad")}</Link>
                <button
                  type="button"
                  className={styles.pin}
                  aria-pressed={Boolean(player.pinned)}
                  aria-label={t(player.pinned ? "players.unpin" : "players.pin", { name: label })}
                  onClick={() => togglePinned(player)}
                >
                  <PinIcon filled={player.pinned} />
                </button>
                <button type="button" className={styles.forget} onClick={() => forgetPlayer(player)} aria-label={t("players.remove", { name: label })}>
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {/* With favourites pinned, "clear" leaves them alone: remove those one by one. */}
      <button type="button" className={styles.clear} onClick={anyPinned ? clearUnpinnedPlayers : clearRecentPlayers}>
        {t(anyPinned ? "players.clearUnpinned" : "players.clear")}
      </button>
    </>
  );
}
