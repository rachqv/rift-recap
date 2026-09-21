import Image from "next/image";
import CountUp from "./CountUp";
import FormCurve from "./FormCurve";
import Heatmap from "./Heatmap";
import LiveStreak from "./LiveStreak";
import ShareButtons from "./ShareButtons";
import WinBars from "./WinBars";
import WinClock from "./WinClock";
import Slide, { Reveal } from "./Slide";
import { defaultT } from "@/lib/i18n/en";
import { championName, itemIconUrl, runeIconUrl } from "@/lib/riot/ddragon";
import { boldTags, ChampionIcon } from "./slides";
import { comfortLine, grayScreenLine } from "@/lib/recap/form";
import { formLines } from "@/lib/recap/formcurve";
import { patchLine } from "@/lib/recap/patches";
import { surrenderLine } from "@/lib/recap/habits";
import { tierListLine } from "@/lib/recap/tierlist";
import { progressLine, savedPersonaTitle } from "@/lib/recap/progress";
import { getItemInsight } from "@/lib/recap/items";
import { getObjectiveInsight } from "@/lib/recap/objectives";
import { getKeystoneInsight } from "@/lib/recap/runes";
import { LIVE_HOURS, liveLine, tiltGuardLines } from "@/lib/recap/tiltguard";
import base from "./slides.module.css";
import styles from "./dataSlides.module.css";

// For widths and positions in the CSS, where a plain 0-100 number is what's wanted (text uses `t.percent`).
const pct = (x) => Math.round(x * 100);

// Item names run long ("Locket of the Iron Solari"), so size the heading for two lines: whichever is larger, the
// longest word or half the whole name.
const twoLineChars = (name) => Math.max(...name.split(/\s+/).map((word) => word.length), Math.ceil(name.length / 2));

/**
 * Your rolling win rate as a line, with your best and worst stretch marked. `curve` is from `getFormCurve`; `share` is `{ cardUrl }`
 * for the share buttons (the card route draws the same chart when asked for the "form" format).
 */
export function FormCurveSlide({ curve, share, t = defaultT }) {
  const [swing, trend] = formLines(curve, t);
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.formcurve.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={styles.note}>
        {t("recap.formcurve.lead", { games: t("recap.gamesLabel", { count: curve.window }) })}
      </Reveal>
      <Reveal i={2} className={styles.calendar}>
        <FormCurve curve={curve} t={t} />
      </Reveal>
      <Reveal i={3} as="p" className={base.caption}>
        {swing}
        <br />
        {trend}
      </Reveal>
      {share && (
        <Reveal i={4}>
          <ShareButtons cardUrl={share.cardUrl} format="form" filename="rift-recap-season-line.png" title={t("recap.formcurve.shareTitle")} />
        </Reveal>
      )}
    </Slide>
  );
}

/** Games per day as a heatmap. The calendar itself is drawn in the browser, in the viewer's time zone. */
export function CalendarSlide({ activity, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.calendar.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.calendar}>
        <Heatmap activity={activity} />
      </Reveal>
      <Reveal i={2} as="p" className={styles.note}>
        {t("recap.calendar.note", { count: activity.length })}
      </Reveal>
    </Slide>
  );
}

/** Win rate by time of day and weekday. The buckets are drawn in the browser, in the viewer's time zone. */
export function ClockSlide({ activity, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.clock.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.calendar}>
        <WinClock activity={activity} />
      </Reveal>
      <Reveal i={2} as="p" className={styles.note}>
        {t("recap.calendar.note", { count: activity.length })}
      </Reveal>
    </Slide>
  );
}

/** Win rate on each game patch, with the best and worst marked when they are further apart than luck. `form` is from `getPatchForm`. */
export function PatchSlide({ form, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.patches.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.calendar}>
        <WinBars title={t("recap.patches.title")} buckets={form.patches} label={(p) => p.patch} highlight={form.mood === "swing" ? form : null} average={form.overall} t={t} />
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {patchLine(form, t)}
      </Reveal>
    </Slide>
  );
}

function ItemIcon({ version, id, className }) {
  const src = itemIconUrl(version, id);
  if (!src) return <span className={`${className} ${styles.iconFallback}`} />;
  // Data Dragon item icons are 64x64: shown at or below that size so they stay crisp.
  return <Image src={src} alt="" width={64} height={64} unoptimized className={className} />;
}

/** The finished item you end games with most, and your usual build. `picks` is from `pickFavoriteItems`. */
export function ItemsSlide({ picks, index, games, t = defaultT }) {
  const { favorite, boots, build } = picks;
  const others = [...build.slice(1), ...(boots ? [boots] : [])];
  const good = (chunks) => <b className={favorite.winRate >= 0.5 ? base.good : base.bad}>{chunks}</b>;

  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.items.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.hero}>
        <ItemIcon version={index.version} id={favorite.id} className={styles.heroIcon} />
      </Reveal>
      <Reveal i={2} as="h2" className={styles.itemName} style={{ "--chars": twoLineChars(favorite.name) }}>
        {favorite.name}
      </Reveal>
      {favorite.plaintext && (
        <Reveal i={3} as="p" className={`${base.epithet} ${styles.blurb}`}>
          {favorite.plaintext}
        </Reveal>
      )}
      <Reveal i={4} className={base.chips}>
        <span className={base.chip}>{t.rich("recap.items.inGames", { count: favorite.games, games, ...boldTags })}</span>
        <span className={base.chip}>{t.rich("recap.items.winWith", { rate: t.percent(favorite.winRate), b: good })}</span>
        {favorite.winRateWithout != null && (
          <span className={base.chip}>{t.rich("recap.items.without", { rate: t.percent(favorite.winRateWithout), ...boldTags })}</span>
        )}
      </Reveal>
      <Reveal i={5} as="p" className={base.caption}>
        {getItemInsight(picks, t)}
      </Reveal>
      {others.length > 0 && (
        <Reveal i={6} className={styles.build}>
          {others.map((item) => (
            <div key={item.id} className={styles.buildItem} title={item.name}>
              <ItemIcon version={index.version} id={item.id} className={styles.buildIcon} />
              <span>{item.boots ? t("recap.items.boots") : t("recap.gamesLabel", { count: item.games })}</span>
            </div>
          ))}
        </Reveal>
      )}
    </Slide>
  );
}

// A rune's icon (Data Dragon's are 128 pixels square, so they stay sharp at the sizes used here).
function RuneIcon({ path, className, alt = "" }) {
  const src = runeIconUrl(path);
  if (!src) return <span className={`${className} ${styles.iconFallback}`} />;
  return <Image src={src} alt={alt} width={128} height={128} unoptimized className={className} />;
}

/** The keystone rune you take most, how it goes, and your next few. `picks` is from `pickKeystones`. */
export function RunesSlide({ picks, t = defaultT }) {
  const { favorite, others, total } = picks;
  const good = (chunks) => <b className={favorite.winRate >= 0.5 ? base.good : base.bad}>{chunks}</b>;

  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.runes.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.hero}>
        <RuneIcon path={favorite.icon} className={styles.heroIcon} />
      </Reveal>
      <Reveal i={2} as="h2" className={styles.itemName} style={{ "--chars": twoLineChars(favorite.name) }}>
        {favorite.name}
      </Reveal>
      <Reveal i={3} as="p" className={base.epithet}>
        {favorite.tree}
      </Reveal>
      <Reveal i={4} className={base.chips}>
        <span className={base.chip}>{t.rich("recap.items.inGames", { count: favorite.games, games: total, ...boldTags })}</span>
        <span className={base.chip}>{t.rich("recap.runes.winWith", { rate: t.percent(favorite.winRate), b: good })}</span>
        {favorite.winRateWithout != null && <span className={base.chip}>{t.rich("recap.runes.without", { rate: t.percent(favorite.winRateWithout), ...boldTags })}</span>}
      </Reveal>
      <Reveal i={5} as="p" className={base.caption}>
        {getKeystoneInsight(picks, t)}
      </Reveal>
      {others.length > 0 && (
        <Reveal i={6} className={styles.build}>
          {others.map((rune) => (
            <div key={rune.id} className={styles.buildItem} title={rune.name}>
              <RuneIcon path={rune.icon} className={styles.buildIcon} alt={rune.name} />
              <span>{t("recap.gamesLabel", { count: rune.games })}</span>
              <span>{t.percent(rune.winRate)}</span>
            </div>
          ))}
        </Reveal>
      )}
    </Slide>
  );
}

/** Champions you hardly play that are built like ones you win with. `advice` is from `getPoolAdvice`. */
export function PoolSlide({ advice, index, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.pool.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.pool}>
        {advice.map(({ anchor, picks }) => (
          <div key={anchor.id} className={styles.poolRow}>
            <p className={styles.poolBecause}>
              <ChampionIcon index={index} id={anchor.id} size={36} />
              <span>{t("recap.pool.because", { champion: championName(index, anchor.id), rate: t.percent(anchor.winRate) })}</span>
            </p>
            <ul className={styles.poolPicks}>
              {picks.map((pick) => {
                const tag = index.byId[pick.id]?.tags?.[0];
                return (
                  <li key={pick.id} className={styles.poolCard}>
                    <ChampionIcon index={index} id={pick.id} size={52} />
                    <b>{championName(index, pick.id)}</b>
                    {tag && <small>{t(`insights.classInline.${tag}`)}</small>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {t("recap.pool.note")}
      </Reveal>
    </Slide>
  );
}

const TILES = [
  { key: "tower", icon: "🏰", personal: (p, t) => t("recap.objectives.youTotal", { count: p.turrets }) },
  { key: "dragon", icon: "🐉", personal: (p, t) => t("recap.objectives.youSecured", { count: p.dragons }) },
  { key: "baron", icon: "👑", personal: (p, t) => t("recap.objectives.youSecured", { count: p.barons }) },
  { key: "herald", icon: "🦀" },
  { key: "grubs", icon: "🐛" },
  { key: "inhibitor", icon: "💠", personal: (p, t) => t("recap.objectives.youTotal", { count: p.inhibitors }) },
];

/** What your teams took across your games, and your own share of it. `objectives` is from `summarizeObjectives`. */
export function ObjectivesSlide({ objectives, t = defaultT }) {
  const { team, perGame, personal, firsts, games } = objectives;
  const tower = firsts.tower;
  const compare = tower.winRateWith != null && tower.winRateWithout != null;

  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.objectives.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={styles.lead}>
        {t("recap.objectives.lead", { games })}
      </Reveal>
      <Reveal i={2} className={styles.tiles}>
        {TILES.map(({ key, icon, personal: you }) => (
          <div key={key} className={styles.tile}>
            <span className={styles.tileIcon} aria-hidden="true">
              {icon}
            </span>
            <span className={styles.tileValue}>
              <CountUp value={team[key]} />
            </span>
            <span className={base.tileLabel}>{t(`recap.objectives.tiles.${key}`)}</span>
            <small>{you ? you(personal, t) : t("recap.objectives.perGame", { value: t.fixed(perGame[key]) })}</small>
          </div>
        ))}
      </Reveal>
      <Reveal i={3} className={base.chips}>
        <span className={base.chip}>{t.rich("recap.objectives.firstTower", { rate: t.percent(tower.rate), ...boldTags })}</span>
        {compare && (
          <span className={base.chip}>
            {t.rich("recap.objectives.withWithout", { withIt: t.percent(tower.winRateWith), without: t.percent(tower.winRateWithout), ...boldTags })}
          </span>
        )}
        {personal.stolen > 0 && <span className={base.chip}>{t.rich("recap.objectives.stolen", { count: personal.stolen, ...boldTags })}</span>}
      </Reveal>
      <Reveal i={4} as="p" className={base.caption}>
        {getObjectiveInsight(objectives, t)}
      </Reveal>
    </Slide>
  );
}

// The gauge runs from tilting (left) to bouncing back (right); a 50-point gap either way pins the marker to an end.
const gaugePosition = (gap) => Math.min(96, Math.max(4, 50 - (gap / 0.5) * 50));

/** Win rate after a win against win rate after a loss. `tilt` is from `getTilt`. */
export function TiltSlide({ tilt, t = defaultT }) {
  const sides = [
    { key: "win", label: t("recap.tilt.afterWin"), ...tilt.afterWin },
    { key: "loss", label: t("recap.tilt.afterLoss"), ...tilt.afterLoss },
  ];
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t(`recap.tilt.eyebrow.${tilt.mood}`)}
      </Reveal>
      <Reveal i={1} className={styles.moodIcon}>
        <span aria-hidden="true">{{ tilt: "\u{1F624}", resilient: "\u{1F525}", steady: "\u{1F9D8}" }[tilt.mood]}</span>
      </Reveal>
      <Reveal i={2} className={styles.versusPair}>
        {sides.map((side) => (
          <div key={side.key} className={styles.formCard} data-kind={side.key}>
            <span className={styles.formValue}>
              <CountUp value={side.rate} percent />
            </span>
            <span className={base.tileLabel}>{side.label}</span>
            <small>{t("recap.gamesLabel", { count: side.games })}</small>
          </div>
        ))}
      </Reveal>
      <Reveal i={3} className={styles.gauge}>
        <div className={styles.gaugeTrack}>
          <span className={styles.gaugeMarker} style={{ left: `${gaugePosition(tilt.gap)}%` }} />
        </div>
        <div className={styles.gaugeLabels} aria-hidden="true">
          <span>{t("recap.tilt.tilts")}</span>
          <span>{t("recap.tilt.bounces")}</span>
        </div>
      </Reveal>
      <Reveal i={4} as="p" className={base.caption}>
        {tilt.line}
      </Reveal>
    </Slide>
  );
}

/**
 * Win rate of the next game after a win and after 1, 2 and 3+ losses in a row, with the depth where it drops marked as your stop
 * sign, and a note if you are on a losing streak right now. `guard` is from `getTiltGuard`.
 */
export function TiltGuardSlide({ guard, t = defaultT }) {
  const [verdict, extra] = tiltGuardLines(guard, t);
  const stopAt = guard.stop?.losses ?? Infinity;
  return (
    <Slide accent={guard.stop ? "#e84057" : undefined}>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.tiltguard.eyebrow")}
      </Reveal>
      {guard.live && (
        <LiveStreak until={guard.live.at + LIVE_HOURS * 3600000} stop={guard.live.stop} label={t("recap.tiltguard.live")}>
          {liveLine(guard.live, t)}
        </LiveStreak>
      )}
      <Reveal i={2} as="ul" className={styles.guard} style={{ "--baseline": guard.baseline }} aria-label={t("recap.tiltguard.eyebrow")}>
        {guard.steps.map((step, i) => {
          const label = step.key === 0 ? t("recap.tilt.afterWin") : t(`recap.tiltguard.step${step.key}`);
          const rated = step.rate != null;
          const detail = t("heatmap.dayGames", { games: step.games, wins: step.wins });
          return (
            <li key={step.key} className={styles.guardStep} data-rated={rated} data-stop={rated && step.key >= stopAt} style={{ "--rate": step.rate ?? 0, "--i": i }}>
              <span className={styles.srOnly}>{rated ? t("heatmap.clock.bar", { label, rate: t.percent(step.rate), detail }) : t("heatmap.clock.barFew", { label, detail })}</span>
              <span className={styles.guardValue} aria-hidden="true">
                {rated ? t.percent(step.rate) : "·"}
              </span>
              <span className={styles.guardTrack} aria-hidden="true">
                <span className={styles.guardBar} />
              </span>
              <span className={styles.guardLabel} aria-hidden="true">
                {label}
              </span>
              <small className={styles.guardGames} aria-hidden="true">
                {step.games}
              </small>
            </li>
          );
        })}
      </Reveal>
      <Reveal i={3} as="p" className={base.caption}>
        {verdict}
        {extra && (
          <>
            <br />
            {extra}
          </>
        )}
      </Reveal>
    </Slide>
  );
}

/** Your win rate on your most played champions, against your overall win rate. `comfort` is from `getComfort`. */
export function ComfortSlide({ comfort, recap, index, art, t = defaultT }) {
  const nameOf = (id) => championName(index, id);
  return (
    <Slide art={art}>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.comfort.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={styles.lead}>
        {t("recap.comfort.lead", { rate: t.percent(recap.winRate) })}
      </Reveal>
      <Reveal i={2} className={styles.comfortRows}>
        {comfort.rows.map((row) => (
          <div key={row.id} className={styles.comfortRow} data-good={row.delta >= 0.03 ? "true" : row.delta <= -0.03 ? "false" : "even"}>
            <ChampionIcon index={index} id={row.id} size={40} />
            <span className={styles.comfortName}>
              {nameOf(row.id)}
              <small>{t("recap.gamesLabel", { count: row.games })}</small>
              <span className={styles.comfortBar} aria-hidden="true">
                <i style={{ width: `${pct(row.winRate)}%` }} />
                <b style={{ left: `${pct(recap.winRate)}%` }} />
              </span>
            </span>
            <span className={styles.comfortRate}>{t.percent(row.winRate)}</span>
            <span className={styles.comfortDelta}>
              {row.delta >= 0 ? "+" : "−"}
              {t.number(Math.abs(Math.round(row.delta * 100)))}
            </span>
          </div>
        ))}
      </Reveal>
      <Reveal i={3} as="p" className={base.caption}>
        {comfortLine(comfort, nameOf, t)}
      </Reveal>
    </Slide>
  );
}

/** Time spent waiting to respawn. `grayScreen` is from `getGrayScreen`. */
export function GrayScreenSlide({ grayScreen, t = defaultT }) {
  const dead = grayScreen.share;
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.gray.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.skull}>
        <span aria-hidden="true">{"\u{1F480}"}</span>
      </Reveal>
      <Reveal i={2} className={base.mega}>
        <CountUp value={grayScreen.hours} decimals={1} />
        <span className={styles.megaUnit}>{t("recap.gray.unit")}</span>
      </Reveal>
      <Reveal i={3} className={base.megaLabel}>
        {t("recap.gray.spentDead")}
      </Reveal>
      <Reveal i={4} className={styles.aliveBar}>
        <div className={styles.aliveTrack} role="img" aria-label={t("recap.gray.aliveAria", { alive: t.percent(1 - pct(dead) / 100), dead: t.percent(pct(dead) / 100) })}>
          <span className={styles.aliveFill} style={{ width: `${100 - pct(dead)}%` }} />
        </div>
        <div className={styles.aliveLabels} aria-hidden="true">
          <span>{t("recap.gray.alive", { value: t.percent(1 - pct(dead) / 100) })}</span>
          <span>{t("recap.gray.dead", { value: t.percent(pct(dead) / 100) })}</span>
        </div>
      </Reveal>
      <Reveal i={5} className={base.chips}>
        <span className={base.chip}>{t.rich("recap.gray.share", { share: t.percent(dead), ...boldTags })}</span>
        <span className={base.chip}>{t.rich("recap.gray.perGame", { minutes: t.fixed(grayScreen.perGame), ...boldTags })}</span>
        {grayScreen.films >= 1 && (
          <span className={base.chip}>{t.rich("recap.gray.films", { n: Math.round(grayScreen.films), ...boldTags })}</span>
        )}
      </Reveal>
      <Reveal i={6} as="p" className={base.caption}>
        {grayScreenLine(grayScreen, t)}
      </Reveal>
    </Slide>
  );
}

/** What changed since a saved snapshot. `progress` is from `compareToSnapshot`, `saved` from `readRecapSnapshot`. */
/** The "improved / slipped" chips and a row for each stat: what `before` was, what it is now, and which way that went. `progress` is from `compareToSnapshot` or `compareRecaps`. */
function ProgressRows({ progress, t }) {
  return (
    <>
      <Reveal i={2} className={base.chips}>
        <span className={base.chip}>{t.rich("recap.progress.improved", { count: progress.better, ...boldTags })}</span>
        <span className={base.chip}>{t.rich("recap.progress.slipped", { count: progress.worse, ...boldTags })}</span>
      </Reveal>
      <Reveal i={3} className={styles.comfortRows}>
        {progress.rows.map((row) => (
          <div key={row.key} className={styles.progressRow} data-mood={row.mood}>
            <span className={styles.progressLabel}>{row.label}</span>
            <span className={styles.progressBefore}>{row.before}</span>
            <span aria-hidden="true">→</span>
            <span className={styles.progressAfter}>{row.after}</span>
            <span className={styles.progressMark} aria-label={t(`recap.progress.mood.${row.mood}`)}>
              {row.mood === "better" ? "▲" : row.mood === "worse" ? "▼" : "·"}
            </span>
          </div>
        ))}
      </Reveal>
    </>
  );
}

/** The last 7 days against the 7 days before them. `week` is from `getWeekCompare`. */
export function WeekSlide({ week, t = defaultT }) {
  return (
    <Slide dwell={10}>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.week.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={styles.lead}>
        {t("recap.week.lead", { now: t("recap.gamesLabel", { count: week.games.now }), before: t("recap.gamesLabel", { count: week.games.before }) })}
      </Reveal>
      <ProgressRows progress={week.progress} t={t} />
      <Reveal i={4} as="p" className={base.caption}>
        {progressLine(week.progress, t)}
      </Reveal>
    </Slide>
  );
}

export function ProgressSlide({ progress, saved, games, art, t = defaultT }) {
  const date = t.date(saved.time, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <Slide art={art} dwell={10}>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.progress.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={styles.lead}>
        {t("recap.progress.lead", { date, saved: saved.games, games })}
        {saved.persona ? t("recap.progress.was", { persona: savedPersonaTitle(saved.persona, t) }) : ""}
      </Reveal>
      <ProgressRows progress={progress} t={t} />
      <Reveal i={4} as="p" className={base.caption}>
        {progressLine(progress, t)}
      </Reveal>
    </Slide>
  );
}

/**
 * The trophy bingo board: the 24 trophies on a 5x5 board with a free space in the middle, unlocked ones lit, locked ones dimmed
 * with how close you got, and finished lines outlined. `bingo` is from `getBingo`; `share` is `{ cardUrl }` (the bingo card is
 * drawn by the same route as the share card).
 */
export function TrophiesSlide({ bingo, share, t = defaultT }) {
  const trophies = bingo.cells.filter((cell) => !cell.free);
  const closest = trophies.filter((b) => !b.unlocked && b.progress > 0).sort((a, b) => b.progress - a.progress)[0];
  const caption = bingo.next
    ? t("recap.trophies.nextBingo", { name: bingo.next.name, percent: t.percent(bingo.next.progress), text: bingo.next.text })
    : closest
      ? t("recap.trophies.next", { name: closest.name, percent: t.percent(closest.progress), text: closest.text })
      : bingo.unlocked === bingo.total
        ? t("recap.trophies.all")
        : null;
  return (
    <Slide dwell={10}>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.trophies.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.trophyCount}>
        <span className={styles.trophyBig}>
          <CountUp value={bingo.unlocked} />
        </span>
        <span className={styles.trophyOf}>{t("recap.trophies.of", { total: bingo.total })}</span>
        <span className={base.chip}>{t.rich("recap.trophies.lines", { count: bingo.lines, ...boldTags })}</span>
      </Reveal>
      <Reveal i={2} as="ul" className={styles.board} aria-label={t("recap.trophies.board")}>
        {bingo.cells.map((cell, position) =>
          cell.free ? (
            <li key="free" className={styles.trophy} data-free="true" data-line={cell.inLine}>
              <span className={styles.trophyIcon} aria-hidden="true">
                ★
              </span>
              <span className={styles.trophyName}>{t("recap.trophies.free")}</span>
            </li>
          ) : (
            <li key={cell.id} className={styles.trophy} data-unlocked={cell.unlocked} data-line={cell.inLine} data-position={position} title={`${cell.name}: ${cell.text}`}>
              <span className={styles.trophyIcon} aria-hidden="true">
                {cell.icon}
              </span>
              <span className={styles.trophyName}>{cell.name}</span>
              {!cell.unlocked && (
                <span className={styles.trophyBar} aria-hidden="true">
                  <i style={{ width: `${Math.round(cell.progress * 100)}%` }} />
                </span>
              )}
              <span className={styles.srOnly}>{cell.unlocked ? t("recap.trophies.unlocked") : t("recap.trophies.progress", { percent: t.percent(cell.progress) })}</span>
            </li>
          ),
        )}
      </Reveal>
      {caption && (
        <Reveal i={3} as="p" className={`${base.caption} ${styles.trophyNote}`}>
          {caption}
        </Reveal>
      )}
      {share && (
        <Reveal i={4}>
          <ShareButtons cardUrl={share.cardUrl} format="bingo" filename="rift-recap-bingo.png" title={t("recap.trophies.shareTitle")} />
        </Reveal>
      )}
    </Slide>
  );
}

const BLAME_ICONS = { carry: "\u{1F9B8}", weak: "\u{1FA9E}", team: "\u{1F91D}" };
const BLAME_TONES = { carry: "#3ddc97", weak: "#e84057", team: "#c8aa6e" };

/** In your losses, how you compare with your own team. `blame` is from `getBlame`. */
export function BlameSlide({ blame, t = defaultT }) {
  const { loss, verdict } = blame;
  const heading = t(`recap.blame.${verdict}`);
  return (
    <Slide accent={BLAME_TONES[verdict]}>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.blame.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.moodIcon}>
        <span aria-hidden="true">{BLAME_ICONS[verdict]}</span>
      </Reveal>
      <Reveal i={2} as="h2" className={styles.itemName} style={{ "--chars": heading.length }}>
        {heading}
      </Reveal>
      <Reveal i={3} as="p" className={styles.lead}>
        {t("recap.blame.across", { losses: loss.games })}
      </Reveal>
      <Reveal i={4} className={styles.versusPair}>
        <div className={styles.formCard} data-kind={verdict === "weak" ? "loss" : "win"}>
          <span className={styles.formValue}>
            <CountUp value={blame.topRate} percent />
          </span>
          <span className={base.tileLabel}>{t("recap.blame.topDamage")}</span>
          <small>{t("recap.blame.chance", { rate: t.percent(0.2) })}</small>
        </div>
        <div className={styles.formCard} data-kind={verdict === "carry" ? "win" : verdict === "weak" ? "loss" : undefined}>
          <span className={styles.formValue}>
            <CountUp value={loss.deathShare ?? 0.2} percent />
          </span>
          <span className={base.tileLabel}>{t("recap.blame.deaths")}</span>
          <small>{t("recap.blame.average", { rate: t.percent(0.2) })}</small>
        </div>
      </Reveal>
      <Reveal i={5} as="p" className={base.caption}>
        {blame.line}
      </Reveal>
    </Slide>
  );
}

/** Your champion pool ranked S to D. `tierList` is from `getTierList`. */
export function TierListSlide({ tierList, index, t = defaultT }) {
  const nameOf = (id) => championName(index, id);
  return (
    <Slide dwell={9}>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.tierList.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.tierList} role="list" aria-label={t("recap.tierList.aria")}>
        {tierList.tiers.map((tier) => (
          <div key={tier.key} className={styles.tierRow} role="listitem">
            <span className={styles.tierKey} style={{ background: tier.color }}>
              {tier.key}
            </span>
            <span className={styles.tierChamps}>
              {tier.champions.map((c) => (
                <span key={c.id} className={styles.tierChamp} title={t("recap.tierList.title", { name: nameOf(c.id), winRate: t.percent(c.winRate), games: c.games })}>
                  <ChampionIcon index={index} id={c.id} size={38} />
                </span>
              ))}
            </span>
          </div>
        ))}
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {tierListLine(tierList, nameOf, t)}
      </Reveal>
      <Reveal i={3} as="p" className={styles.note}>
        {t("recap.tierList.note")}
      </Reveal>
    </Slide>
  );
}

/** Ping style, summoner spells and surrenders as three tiles. `habits` is from `getHabits`. */
export function HabitsSlide({ habits, t = defaultT }) {
  const { ping, spells, surrender } = habits;
  const tiles = [
    ping && { key: "ping", icon: "\u{1F4CD}", title: ping.title, small: t("recap.habits.pings", { value: t.fixed(ping.perGame) }), label: t("recap.habits.ping") },
    spells && {
      key: "spells",
      icon: "\u2728",
      title: spells.pair.join(" + "),
      small: spells.flash ? t("recap.habits.flash", { key: spells.flash.key, value: t.fixed(spells.flash.perGame) }) : t("recap.habits.pairShare", { share: t.percent(spells.pairShare) }),
      label: t("recap.habits.spells"),
    },
    surrender && { key: "surrender", icon: "\u{1F3F3}\uFE0F", title: t.percent(surrender.rate), small: t("recap.habits.quits", { enemy: surrender.enemyQuit, ours: surrender.weQuit }), label: t("recap.habits.surrender") },
  ].filter(Boolean);

  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.habits.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.habitTiles} style={{ "--n": tiles.length }}>
        {tiles.map((tile) => (
          <div key={tile.key} className={styles.habit}>
            <span className={styles.tileIcon} aria-hidden="true">
              {tile.icon}
            </span>
            <span className={styles.habitTitle}>{tile.title}</span>
            <span className={base.tileLabel}>{tile.label}</span>
            <small>{tile.small}</small>
          </div>
        ))}
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {habits.line}
      </Reveal>
    </Slide>
  );
}
