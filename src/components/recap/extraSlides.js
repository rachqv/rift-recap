import { earlyLine } from "@/lib/recap/early";
import { defaultT } from "@/lib/i18n/en";
import { pointsText } from "@/lib/recap/mastery";
import { sessionLine } from "@/lib/recap/sessions";
import { championName } from "@/lib/riot/ddragon";
import CountUp from "./CountUp";
import Slide, { Reveal } from "./Slide";
import { boldTags, ChampionIcon } from "./slides";
import base from "./slides.module.css";
import styles from "./extraSlides.module.css";

const signed = (t, x, digits = 0) => `${x >= 0 ? "+" : "−"}${t.fixed(Math.abs(x), digits)}`;
const shortDate = (t, date) => t.date(date, { month: "short", day: "numeric", timeZone: "UTC" });

/** Physical, magic and true damage as one bar. `profile` is from `getDamageProfile`. */
export function DamageProfileSlide({ profile, t = defaultT }) {
  const parts = ["physical", "magic", "true"].map((key) => ({ key, label: t(`recap.damage.parts.${key}`), share: profile.shares[key] }));
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.damage.eyebrow")}
      </Reveal>
      <Reveal i={1} as="h2" className={styles.headline} style={{ "--chars": profile.style.length }}>
        {profile.style}
      </Reveal>
      <Reveal i={2} className={styles.damageBar} role="img" aria-label={parts.map((p) => t("recap.damage.partAria", { label: p.label, share: t.percent(p.share) })).join(", ")}>
        {parts.map((p) => (
          <span key={p.key} data-kind={p.key} style={{ flexGrow: Math.max(p.share, 0.02) }} />
        ))}
      </Reveal>
      <Reveal i={3} className={styles.damageLegend}>
        {parts.map((p) => (
          <span key={p.key} data-kind={p.key}>
            <i aria-hidden="true" /> {p.label} <b>{t.percent(p.share)}</b>
          </span>
        ))}
      </Reveal>
      <Reveal i={4} as="p" className={base.caption}>
        {profile.line}
      </Reveal>
    </Slide>
  );
}

/** How the classes on your team change your win rate. `comp` is from `getTeamComp`. */
export function TeamCompSlide({ comp, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.comp.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.compRows}>
        {comp.facts.map((fact) => (
          <div key={fact.label} className={styles.compRow} data-good={fact.gap > 0}>
            <span className={styles.compLabel}>
              {t.rich("recap.comp.with", { class: fact.inline, ...boldTags })}
              <small>{t("recap.comp.games", { withGames: fact.withGames, withoutGames: fact.withoutGames })}</small>
            </span>
            <span className={styles.compRates}>
              <b>{t.percent(fact.withRate)}</b>
              <em>{t("recap.comp.versus", { rate: t.percent(fact.withoutRate) })}</em>
            </span>
            <span className={styles.compGap}>{signed(t, fact.gap * 100)}</span>
          </div>
        ))}
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {comp.line}
      </Reveal>
    </Slide>
  );
}

function NightCard({ label, night, tone, t }) {
  return (
    <div className={styles.night} data-tone={tone}>
      <span className={styles.nightLabel}>{label}</span>
      <span className={styles.nightScore}>
        {night.wins}–{night.losses}
      </span>
      <small>{t("recap.sessions.meta", { games: night.games, date: shortDate(t, night.start) })}</small>
    </div>
  );
}

/** Your best and worst sittings. `sessions` is from `getSessions`. */
export function SessionsSlide({ sessions, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.sessions.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={styles.lead}>
        {t("recap.sessions.lead", { count: sessions.sessions, avg: t.fixed(sessions.avgGames) })}
      </Reveal>
      <Reveal i={2} className={styles.nights}>
        <NightCard label={t("recap.sessions.best")} night={sessions.best} tone="good" t={t} />
        {sessions.worst && <NightCard label={t("recap.sessions.worst")} night={sessions.worst} tone="bad" t={t} />}
        {sessions.longest !== sessions.best && sessions.longest !== sessions.worst && <NightCard label={t("recap.sessions.longest")} night={sessions.longest} t={t} />}
      </Reveal>
      <Reveal i={3} as="p" className={base.caption}>
        {sessionLine(sessions, t)}
      </Reveal>
    </Slide>
  );
}

/** Your most memorable games as cards. `games` is from `getHighlights`. */
export function HighlightsSlide({ games, index, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.highlights.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.reel}>
        {games.map((game) => (
          <div key={game.kind} className={styles.reelCard} data-win={game.win}>
            <ChampionIcon index={index} id={game.champion} size={52} />
            <span className={styles.reelText}>
              <small>{game.kind}</small>
              <b>{championName(index, game.champion)}</b>
              <span>
                {t("recap.highlights.meta", {
                  what: game.seconds != null ? t("recap.highlights.minutes", { count: Math.round(game.seconds / 60) }) : `${game.kills}/${game.deaths}/${game.assists}`,
                  date: shortDate(t, game.at),
                })}
              </span>
            </span>
            <em>{t(game.win ? "recap.highlights.won" : "recap.highlights.lost")}</em>
          </div>
        ))}
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {t("recap.highlights.caption")}
      </Reveal>
    </Slide>
  );
}

/** You against your lane opponent, and the gold you left unspent. `lane` and `gold` are from `getLaneCheck` and `getGoldHabits`. */
export function LaneSlide({ lane, gold, t = defaultT }) {
  const tiles = [
    lane && { key: "cs", value: t("recap.lane.csValue", { value: signed(t, lane.cs, 1) }), label: t("recap.lane.cs"), good: lane.cs >= 0 },
    lane && { key: "gold", value: signed(t, lane.gold), label: t("recap.lane.goldDiff"), good: lane.gold >= 0 },
    lane && { key: "dmg", value: signed(t, lane.damage), label: t("recap.lane.damage"), good: lane.damage >= 0 },
    gold && { key: "unspent", value: t.number(Math.round(gold.unspent)), label: t("recap.lane.unspent") },
  ].filter(Boolean);
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t(lane ? "recap.lane.lane" : "recap.lane.gold")}
      </Reveal>
      <Reveal i={1} className={styles.laneTiles}>
        {tiles.map((tile) => (
          <div key={tile.key} className={styles.laneTile} data-good={tile.good}>
            <span className={styles.laneValue}>{tile.value}</span>
            <span className={base.tileLabel}>{tile.label}</span>
          </div>
        ))}
      </Reveal>
      {lane && (
        <Reveal i={2} className={base.chips}>
          <span className={base.chip}>
            {t.rich("recap.lane.ahead", { rate: t.percent(lane.aheadRate), games: lane.games, b: (chunks) => <b className={lane.aheadRate >= 0.5 ? base.good : base.bad}>{chunks}</b> })}
          </span>
          <span className={base.chip} data-optional>
            {t("recap.lane.kills", { value: signed(t, lane.kills, 1) })}
          </span>
        </Reveal>
      )}
      <Reveal i={3} as="p" className={base.caption}>
        {lane ? lane.line : gold.line}
        {lane && gold ? ` ${gold.line}` : ""}
      </Reveal>
    </Slide>
  );
}

/** Ahead, level or behind at 15 minutes, in your latest games. `early` is from `buildEarlyGame`. */
export function EarlyGameSlide({ early, t = defaultT }) {
  const title = t(`recap.early.titles.${early.profile}`);
  const parts = [
    { key: "ahead", label: t("recap.early.parts.ahead"), n: early.ahead },
    { key: "even", label: t("recap.early.parts.even"), n: early.even },
    { key: "behind", label: t("recap.early.parts.behind"), n: early.behind },
  ];
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.early.eyebrow")}
      </Reveal>
      <Reveal i={1} as="h2" className={styles.headline} style={{ "--chars": title.length }}>
        {title}
      </Reveal>
      <Reveal i={2} className={styles.damageBar} role="img" aria-label={parts.map((p) => t("recap.early.aria", { label: p.label, n: p.n })).join(", ")}>
        {parts.map((p) => (
          <span key={p.key} data-early={p.key} style={{ flexGrow: Math.max(p.n, 0.05) }} />
        ))}
      </Reveal>
      <Reveal i={3} className={styles.damageLegend}>
        {parts.map((p) => (
          <span key={p.key} data-early={p.key}>
            <i aria-hidden="true" /> {p.label} <b>{p.n}</b>
          </span>
        ))}
      </Reveal>
      <Reveal i={4} className={base.chips}>
        {early.ahead > 0 && <span className={base.chip}>{t.rich("recap.early.wonAhead", { wins: early.winsAhead, total: early.ahead, ...boldTags })}</span>}
        {early.behind > 0 && <span className={base.chip}>{t.rich("recap.early.wonBehind", { wins: early.winsBehind, total: early.behind, ...boldTags })}</span>}
      </Reveal>
      <Reveal i={5} as="p" className={base.caption}>
        {earlyLine(early, t)}
      </Reveal>
      <Reveal i={6} as="p" className={styles.lead}>
        {t("recap.early.lead", { games: early.games })}
      </Reveal>
    </Slide>
  );
}

/** Champions you have real mastery on but barely played this season. `flames` is from `getOldFlames`. */
export function OldFlamesSlide({ flames, index, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.flames.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={styles.lead}>
        {t("recap.flames.lead")}
      </Reveal>
      <Reveal i={2} className={styles.flames}>
        {flames.map((flame) => (
          <div key={flame.id} className={styles.flame}>
            <ChampionIcon index={index} id={flame.id} size={54} />
            <span className={styles.flameName}>{championName(index, flame.id)}</span>
            <span className={styles.flamePoints}>
              <CountUp value={flame.points} compact />
            </span>
            <small>{t("recap.flames.mastery", { level: flame.level, played: flame.games === 0 ? t("recap.flames.notPlayed") : t("recap.gamesLabel", { count: flame.games }) })}</small>
          </div>
        ))}
      </Reveal>
      <Reveal i={3} as="p" className={base.caption}>
        {t("recap.flames.caption", { champion: championName(index, flames[0].id), points: pointsText(flames[0].points, t) })}
      </Reveal>
    </Slide>
  );
}
