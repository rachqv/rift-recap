"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { clockLine, getWinClock } from "@/lib/recap/clock";
import base from "./slides.module.css";
import WinBars from "./WinBars";
import styles from "./WinClock.module.css";

const subscribe = () => () => {};
// False while rendering on the server (and during hydration), true afterwards. Which day and hour a game fell on
// depends on the viewer's time zone, so this is only drawn in the browser; the server sends a same-sized placeholder.
const useIsBrowser = () => useSyncExternalStore(subscribe, () => true, () => false);

// 1 Jan 2024 was a Monday, so these dates give the weekday names in the reader's language.
const weekdayDate = (day) => new Date(2024, 0, 1 + day);

/** Win rate by time of day and by weekday, in the viewer's time zone. `activity` is `[{ t, win }]`. */
export default function WinClock({ activity }) {
  const t = useT();
  const inBrowser = useIsBrowser();
  const clock = useMemo(() => (inBrowser ? getWinClock(activity) : null), [inBrowser, activity]);

  if (!clock) return <div className={styles.placeholder} aria-hidden="true" />;

  return (
    <div className={styles.wrap} role="group" aria-label={t("heatmap.clock.aria")}>
      {clock.showParts && (
        <WinBars
          title={t("heatmap.clock.byPart")}
          buckets={clock.parts}
          label={(part) => t(`heatmap.parts.${part.key}`)}
          highlight={clock.byPart}
          average={clock.winRate}
          t={t}
        />
      )}
      {clock.showDays && (
        <WinBars
          title={t("heatmap.clock.byDay")}
          buckets={clock.days}
          label={(day) => t.date(weekdayDate(day.key), { weekday: "short" })}
          highlight={clock.byDay}
          average={clock.winRate}
          t={t}
        />
      )}
      <p className={base.caption}>{clockLine(clock, t)}</p>
    </div>
  );
}
