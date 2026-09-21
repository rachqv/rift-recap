"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { buildCalendar, getCalendarInsight } from "@/lib/recap/calendar";
import base from "./slides.module.css";
import styles from "./Heatmap.module.css";

const subscribe = () => () => {};
// False while rendering on the server (and during hydration), true afterwards. The calendar depends on the
// viewer's time zone, so it is only drawn in the browser; the server sends a same-sized placeholder.
const useIsBrowser = () => useSyncExternalStore(subscribe, () => true, () => false);

// The tags the heatmap messages use around a number: `<b>`, and `<good>` / `<bad>` for a green or red one.
const tags = {
  b: (chunks) => <b>{chunks}</b>,
  good: (chunks) => <b className={base.good}>{chunks}</b>,
  bad: (chunks) => <b className={base.bad}>{chunks}</b>,
};

// 1 Jan 2024 was a Monday, so these dates give the weekday and hour names in the reader's language.
const weekdayDate = (day) => new Date(2024, 0, 1 + day);

/** GitHub-style grid of games per day, with a few "when do you play" stats. `activity` is `[{ t, win }]`. */
export default function Heatmap({ activity }) {
  const t = useT();
  const inBrowser = useIsBrowser();
  const calendar = useMemo(() => (inBrowser ? buildCalendar(activity) : null), [inBrowser, activity]);

  if (!calendar) return <div className={styles.placeholder} aria-hidden="true" />;

  const { weeks, months, cols, stats } = calendar;
  const dayText = (date) => t.date(date, { weekday: "short", month: "short", day: "numeric" });
  const monthText = (date) => t.date(date, { month: "short" });
  const rate = (x) => t.percent(x);
  // Label every other row to keep it light (Monday, Wednesday, Friday).
  const dayLabels = [0, 1, 2, 3, 4, 5, 6].map((day) => (day % 2 === 0 ? t.date(weekdayDate(day), { weekday: "short" }) : ""));

  function tooltip(day) {
    if (day.state === "future") return "";
    if (day.state === "nodata") return t("heatmap.before", { date: dayText(day.date) });
    return t("heatmap.day", { date: dayText(day.date), detail: day.games ? t("heatmap.dayGames", { games: day.games, wins: day.wins }) : t("heatmap.dayNone") });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.board} style={{ "--cols": cols }} role="img" aria-label={t("heatmap.aria", { games: stats.total, days: stats.activeDays })}>
        <div className={styles.months} aria-hidden="true">
          {months.map(({ col, date }) => (
            <span key={col} style={{ gridColumn: col + 1 }}>
              {monthText(date)}
            </span>
          ))}
        </div>
        <div className={styles.dayLabels} aria-hidden="true">
          {dayLabels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
        <div className={styles.grid} aria-hidden="true">
          {weeks.map((week, col) =>
            week.map((day) => (
              <span key={day.key} className={styles.cell} data-level={day.level} data-state={day.state} title={tooltip(day)} style={{ "--col": col }} />
            )),
          )}
        </div>
      </div>

      <div className={styles.legend} aria-hidden="true">
        <span>{t("heatmap.fewer")}</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={styles.swatch} data-level={level} />
        ))}
        <span>{t("heatmap.more")}</span>
      </div>

      <div className={base.chips}>
        <span className={base.chip} data-optional>
          {t.rich("heatmap.activeDays", { count: stats.activeDays, ...tags })}
        </span>
        <span className={base.chip}>{t.rich("heatmap.busiest", { date: dayText(stats.busiest.date), games: stats.busiest.games, ...tags })}</span>
        <span className={base.chip}>{t.rich("heatmap.streak", { days: stats.longestStreak, ...tags })}</span>
        <span className={base.chip} data-optional>
          {t.rich("heatmap.favorite", { day: t.date(weekdayDate(stats.favoriteWeekday), { weekday: "long" }), ...tags })}
        </span>
        <span className={base.chip}>{t.rich("heatmap.prime", { hour: t.date(new Date(2024, 0, 1, stats.peakHour), { hour: "numeric" }), ...tags })}</span>
      </div>

      {(stats.form.part || stats.form.month) && (
        <div className={base.chips}>
          {stats.form.part && (
            <span className={base.chip}>
              {t.rich("heatmap.bestPart", { part: t(`heatmap.parts.${stats.form.part.best.key}`), rate: rate(stats.form.part.best.rate), ...tags })}
              <span data-optional>
                {" "}
                {t.rich("heatmap.worstPart", { part: t(`heatmap.parts.${stats.form.part.worst.key}`), rate: rate(stats.form.part.worst.rate), ...tags })}
              </span>
            </span>
          )}
          {stats.form.month && (
            <span className={base.chip}>
              {t.rich("heatmap.bestMonth", { month: monthText(stats.form.month.best.date), rate: rate(stats.form.month.best.rate), ...tags })}
              <span data-optional>
                {" "}
                {t.rich("heatmap.worstMonth", { month: monthText(stats.form.month.worst.date), rate: rate(stats.form.month.worst.rate), ...tags })}
              </span>
            </span>
          )}
        </div>
      )}

      <p className={base.caption}>{getCalendarInsight(stats, t)}</p>
    </div>
  );
}
