"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { buildCalendar } from "@/lib/recap/calendar";
import { buildRhythmScenarios } from "@/lib/squad/rhythm";
import ScenarioRows from "./ScenarioRows";
import styles from "./versus.module.css";

const subscribe = () => () => {};
// False while rendering on the server (and during hydration), true afterwards. "When do you play" depends on the
// viewer's time zone, so it is only worked out in the browser; the server sends a same-sized placeholder.
const useIsBrowser = () => useSyncExternalStore(subscribe, () => true, () => false);

/** How the two players' hours differ. `a` and `b` are `{ name, activity }` with `activity` as `[{ t, win }]`. */
export default function RhythmRows({ a, b }) {
  const t = useT();
  const inBrowser = useIsBrowser();
  const scenarios = useMemo(() => {
    if (!inBrowser) return null;
    const [calendarA, calendarB] = [buildCalendar(a.activity), buildCalendar(b.activity)];
    if (!calendarA || !calendarB) return [];
    return buildRhythmScenarios({ name: a.name, stats: calendarA.stats }, { name: b.name, stats: calendarB.stats }, 5, t);
  }, [inBrowser, a, b, t]);

  if (!scenarios) return <div className={styles.rhythmPlaceholder} aria-hidden="true" />;
  if (scenarios.length === 0) return <p className={styles.note}>{t("rhythm.same")}</p>;
  return <ScenarioRows scenarios={scenarios} label={t("rhythm.label")} />;
}
