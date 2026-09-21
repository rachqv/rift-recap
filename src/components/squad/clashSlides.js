import Link from "next/link";
import RangeSwitch from "@/components/RangeSwitch";
import ShareButtons from "@/components/recap/ShareButtons";
import Slide, { Reveal } from "@/components/recap/Slide";
import base from "@/components/recap/slides.module.css";
import { defaultT } from "@/lib/i18n/en";
import { clashLine, clashRows, STAR_GAMES } from "@/lib/squad/clash";
import { SIDE_COLORS } from "./versusSlides";
import clashStyles from "./clash.module.css";
import versusStyles from "./versus.module.css";

function Side({ side, team }) {
  return (
    <div className={clashStyles.side} data-side={side}>
      <span className={clashStyles.teamName}>{team.name}</span>
      <ul className={clashStyles.members} aria-label={team.name}>
        {team.members.map((member) => (
          <li key={member.puuid}>{member.gameName}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The two squads and the series score between them. `clash` is `buildClash`'s result, `teams` is `{ a, b }` with each side's
 * `{ name, members }` (the member names show under it), `ranges` the time-range links.
 */
export function ClashIntroSlide({ clash, teams, ranges, t = defaultT }) {
  const names = { a: teams.a.name, b: teams.b.name };
  return (
    <Slide eager>
      <Reveal i={0} className={base.eyebrow}>
        {t("clash.slides.intro.eyebrow")}
      </Reveal>
      <Reveal i={1} className={clashStyles.sides}>
        <Side side="a" team={teams.a} />
        <div className={clashStyles.score} role="img" aria-label={`${clash.wins.a} – ${clash.wins.b}`}>
          <span>{clash.wins.a}</span>
          <span className={clashStyles.dash} aria-hidden="true">
            –
          </span>
          <span>{clash.wins.b}</span>
        </div>
        <Side side="b" team={teams.b} />
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {clashLine(clash, names, t)}
      </Reveal>
      <Reveal i={3} as="p" className={versusStyles.note}>
        {t("clash.slides.intro.played", { games: t("recap.gamesLabel", { count: clash.games }) })}
      </Reveal>
      {ranges && (
        <Reveal i={4}>
          <RangeSwitch links={ranges} label={t("common.range.label")} />
        </Reveal>
      )}
    </Slide>
  );
}

/** One row per lane both squads had someone in: who usually played it, and in how many games each side's laner had the better KDA. */
export function ClashLanesSlide({ lanes, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("clash.slides.lanes.eyebrow")}
      </Reveal>
      <Reveal i={1}>
        <ul className={clashStyles.lanes} aria-label={t("clash.slides.lanes.aria")}>
          {lanes.map((lane) => (
            <li key={lane.role} className={clashStyles.lane} data-winner={lane.outplayed.a === lane.outplayed.b ? "" : lane.outplayed.a > lane.outplayed.b ? "a" : "b"}>
              <span className={clashStyles.laner} data-side="a">
                {lane.a?.gameName}
              </span>
              <span className={clashStyles.laneMid}>
                <span className={clashStyles.laneRole}>{t(`common.roles.${lane.role}`)}</span>
                <span className={clashStyles.laneScore}>
                  {lane.outplayed.a} – {lane.outplayed.b}
                </span>
              </span>
              <span className={clashStyles.laner} data-side="b">
                {lane.b?.gameName}
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal i={2} as="p" className={versusStyles.note}>
        {t("clash.slides.lanes.note")}
      </Reveal>
    </Slide>
  );
}

/** Average KDA, damage, gold and vision per player per game, side by side. */
export function ClashNumbersSlide({ clash, teams, t = defaultT }) {
  const rows = clashRows(clash, t);
  return (
    <Slide dwell={10}>
      <Reveal i={0} className={base.eyebrow}>
        {t("clash.slides.numbers.eyebrow")}
      </Reveal>
      <Reveal i={1} className={versusStyles.scoreline}>
        <span style={{ color: SIDE_COLORS.a }}>{teams.a.name}</span>
        <span style={{ color: SIDE_COLORS.b }}>{teams.b.name}</span>
      </Reveal>
      <Reveal i={2} className={versusStyles.tableWrap}>
        <div className={versusStyles.rows} role="table" aria-label={t("clash.slides.numbers.aria")}>
          {rows.map((row) => (
            <div key={row.key} className={versusStyles.row} data-winner={row.winner} role="row">
              <span className={versusStyles.valueA}>{row.aShow}</span>
              <div className={versusStyles.mid}>
                <span className={versusStyles.rowLabel}>{row.label}</span>
                <div className={versusStyles.bar} aria-hidden="true">
                  <span data-side="a" style={{ width: `${Math.round(row.aShare * 100)}%` }} />
                  <span data-side="b" />
                </div>
              </div>
              <span className={versusStyles.valueB}>{row.bShow}</span>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal i={3} as="p" className={versusStyles.note}>
        {t("clash.slides.numbers.note")}
      </Reveal>
    </Slide>
  );
}

/** Each squad's best KDA, among members with enough games between the squads. */
export function ClashStarsSlide({ stars, teams, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("clash.slides.stars.eyebrow")}
      </Reveal>
      <Reveal i={1} className={clashStyles.stars}>
        {["a", "b"].map((side) => {
          const star = stars[side];
          return (
            <div key={side} className={clashStyles.star} data-side={side} style={{ "--side": SIDE_COLORS[side] }}>
              <span className={clashStyles.starTitle}>{t("clash.slides.stars.best", { team: teams[side].name })}</span>
              {star ? (
                <>
                  <span className={clashStyles.starName}>{star.gameName}</span>
                  <span className={clashStyles.starStat}>{t("clash.slides.stars.stat", { kda: t.fixed(star.kda, 2), games: t("recap.gamesLabel", { count: star.games }) })}</span>
                  <span className={clashStyles.starNone}>{t("clash.slides.stars.record", { wins: star.wins, games: star.games })}</span>
                </>
              ) : (
                <span className={clashStyles.starNone}>–</span>
              )}
            </div>
          );
        })}
      </Reveal>
      <Reveal i={2} as="p" className={versusStyles.note}>
        {t("clash.slides.stars.note", { min: STAR_GAMES })}
      </Reveal>
    </Slide>
  );
}

/** The way on: each squad's own recap (`hrefs` is `{ a, b }`) and the share buttons (`share` is `{ cardUrl }`). */
export function ClashEndSlide({ teams, hrefs, share, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("clash.slides.end.eyebrow")}
      </Reveal>
      <Reveal i={1} className={clashStyles.ends}>
        {["a", "b"].map((side) => (
          <Link key={side} href={hrefs[side]} className={base.button}>
            {t("clash.slides.end.recap", { team: teams[side].name })}
          </Link>
        ))}
      </Reveal>
      {share && (
        <Reveal i={2}>
          <ShareButtons cardUrl={share.cardUrl} title={t("clash.page.title", { a: teams.a.members[0].gameName, b: teams.b.members[0].gameName })} />
        </Reveal>
      )}
    </Slide>
  );
}
