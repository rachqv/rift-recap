import Link from "next/link";
import RangeSwitch from "@/components/RangeSwitch";
import CountUp from "@/components/recap/CountUp";
import ResultStrip from "@/components/recap/ResultStrip";
import ShareButtons from "@/components/recap/ShareButtons";
import Slide, { Reveal } from "@/components/recap/Slide";
import { boldTags } from "@/components/recap/slides";
import base from "@/components/recap/slides.module.css";
import { defaultT } from "@/lib/i18n/en";
import { pairChemistry } from "@/lib/squad/compat";
import { versusPath } from "@/lib/squad/parse";
import PlayerAvatar, { MEMBER_COLORS } from "./PlayerAvatar";
import styles from "./squad.module.css";

const color = (index) => MEMBER_COLORS[index % MEMBER_COLORS.length];

/** "A, B and C" (or "A, B y C": however the reader's language joins a list). */
export const joinNames = (names, t = defaultT) => t.list(names);

// A heading sized for up to three lines, so long award titles stay on screen.
const threeLineChars = (text) => Math.max(...text.split(/\s+/).map((word) => word.length), Math.ceil(text.length / 3));

function recordLine(winRate, t) {
  const kind = winRate >= 0.6 ? "machine" : winRate >= 0.52 ? "good" : winRate >= 0.48 ? "balanced" : "rough";
  return t(`squad.slides.record.${kind}`);
}

/** Everyone, and how many games they played together. `art` is a champion splash the squad plays a lot. */
export function SquadIntroSlide({ squad, members, version, art, loaded, sharedFound, ranges, t = defaultT }) {
  return (
    <Slide art={art} strength="hero" eager>
      <Reveal i={0} className={base.eyebrow}>
        {t("squad.slides.intro.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.avatarRow}>
        {members.map((m) => (
          <PlayerAvatar key={m.puuid} version={version} icon={m.profileIcon} name={m.gameName} color={color(m.index)} />
        ))}
      </Reveal>
      <Reveal i={2} as="h1" className={styles.squadNames}>
        {members.map((m) => m.gameName).join(" · ")}
      </Reveal>
      <Reveal i={3} className={styles.together}>
        <span className={base.big}>
          <CountUp value={squad.games} />
        </span>
        <span className={base.megaLabel}>{t("squad.slides.intro.together", { count: squad.games })}</span>
      </Reveal>
      <Reveal i={4} className={base.chips}>
        <span className={base.chip}>{t.rich("recap.recordChip", { wins: squad.wins, losses: squad.losses, ...boldTags })}</span>
        <span className={base.chip}>{t.rich("recap.winRateChip", { rate: t.percent(squad.winRate), ...boldTags })}</span>
        <span className={base.chip}>{t.rich("squad.slides.intro.hours", { n: squad.hours, value: t.fixed(squad.hours), ...boldTags })}</span>
      </Reveal>
      {ranges && (
        <Reveal i={5}>
          <RangeSwitch links={ranges} label={t("common.range.label")} />
        </Reveal>
      )}
      {sharedFound > loaded && (
        <Reveal i={6} as="p" className={styles.note}>
          {t("squad.slides.intro.note", { loaded, found: sharedFound })}
        </Reveal>
      )}
    </Slide>
  );
}

/** The squad's record: win rate, streaks and how often everyone showed up. */
export function SquadRecordSlide({ squad, memberCount, art, t = defaultT }) {
  return (
    <Slide art={art}>
      <Reveal i={0} className={base.eyebrow}>
        {t("squad.slides.record.eyebrow")}
      </Reveal>
      <Reveal i={1} className={base.mega}>
        <CountUp value={squad.winRate} percent />
      </Reveal>
      <Reveal i={2} className={base.megaLabel}>
        {t("squad.slides.record.label")}
      </Reveal>
      <Reveal i={3} className={base.chips}>
        {squad.streaks.win >= 2 && <span className={base.chip}>{t.rich("squad.slides.record.bestStreak", { count: squad.streaks.win, ...boldTags })}</span>}
        {squad.streaks.loss >= 2 && <span className={base.chip}>{t.rich("squad.slides.record.worstSkid", { count: squad.streaks.loss, ...boldTags })}</span>}
        {memberCount > 2 && <span className={base.chip}>{t.rich("squad.slides.record.all", { members: memberCount, games: squad.allTogether, ...boldTags })}</span>}
      </Reveal>
      {squad.results?.length >= 5 && (
        <Reveal i={4} className={base.stripWrap}>
          <ResultStrip results={squad.results} t={t} />
        </Reveal>
      )}
      <Reveal i={5} as="p" className={base.caption}>
        {recordLine(squad.winRate, t)}
      </Reveal>
    </Slide>
  );
}

function PairCard({ kind, label, pair, members, version, t }) {
  const [a, b] = [members[pair.a], members[pair.b]];
  const chemistry = pairChemistry({ wins: pair.wins, games: pair.games, damageA: a.perMin.damage, damageB: b.perMin.damage }, t);
  return (
    <div className={`${styles.pair} ${styles[kind]}`}>
      <span className={styles.pairLabel}>{label}</span>
      <div className={styles.pairAvatars}>
        <PlayerAvatar version={version} icon={a.profileIcon} name={a.gameName} color={color(a.index)} />
        <PlayerAvatar version={version} icon={b.profileIcon} name={b.gameName} color={color(b.index)} />
      </div>
      <span className={styles.pairNames}>
        {a.gameName} + {b.gameName}
      </span>
      <span className={styles.pairRate}>{t.percent(pair.winRate)}</span>
      <small>{t("squad.slides.pairs.games", { count: pair.games })}</small>
      <small className={styles.pairChemistry}>{t("squad.slides.pairs.chemistry", { icon: "\u2764\uFE0F", score: t.percent(chemistry.score / 100), label: chemistry.label })}</small>
    </div>
  );
}

/** Which two of you win the most, and the least, when playing together. Needs 3+ members to compare. */
/** Who should play which role, from how each member did in each role in the games the squad played together. `lineup` is from `getLineup`. */
export function SquadRolesSlide({ lineup, members, version, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("squad.slides.roles.eyebrow")}
      </Reveal>
      <Reveal i={1} as="ul" className={styles.lineup} aria-label={t("squad.slides.roles.aria")}>
        {lineup.rows.map((row) => {
          const m = members[row.index];
          return (
            <li key={row.index} className={styles.lineupRow} data-changed={row.changed}>
              <PlayerAvatar version={version} icon={m.profileIcon} name={m.gameName} size="sm" color={color(m.index)} />
              <span className={styles.lineupName}>{m.gameName}</span>
              <b className={styles.lineupRole}>{t(`common.roles.${row.role}`)}</b>
              <small className={styles.lineupRecord}>
                {t("squad.slides.pairs.games", { count: row.games })} · {t.percent(row.winRate)}
              </small>
              {row.changed && <em className={styles.lineupWas}>{t("squad.slides.roles.was", { role: t(`common.roles.${row.usual}`) })}</em>}
            </li>
          );
        })}
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {t(`squad.slides.roles.${lineup.mood}`)}
      </Reveal>
    </Slide>
  );
}

export function SquadPairsSlide({ best, worst, members, version, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("squad.slides.pairs.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.pairs}>
        <PairCard kind="bestPair" label={t("squad.slides.pairs.best")} pair={best} members={members} version={version} t={t} />
        {worst && <PairCard kind="worstPair" label={t("squad.slides.pairs.worst")} pair={worst} members={members} version={version} t={t} />}
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {worst
          ? t("squad.slides.pairs.captionBoth", { a: members[best.a].gameName, b: members[best.b].gameName, c: members[worst.a].gameName, d: members[worst.b].gameName })
          : t("squad.slides.pairs.captionBest", { a: members[best.a].gameName, b: members[best.b].gameName })}
      </Reveal>
    </Slide>
  );
}

/** One award: who won it, by how much, and who came next. */
export function AwardSlide({ award, members, version, position, total, t = defaultT }) {
  const winner = members[award.winner];
  const runnersUp = award.ranking.slice(1, 4);
  return (
    <Slide accent={color(winner.index)}>
      <Reveal i={0} className={base.eyebrow}>
        {t("squad.slides.award.eyebrow", { position, total })}
      </Reveal>
      <Reveal i={1} className={styles.awardIcon}>
        <span aria-hidden="true">{award.icon}</span>
      </Reveal>
      <Reveal i={2} as="h2" className={styles.awardTitle} style={{ "--chars": threeLineChars(award.title) }}>
        {award.title}
      </Reveal>
      <Reveal i={3} as="p" className={base.epithet}>
        {award.tagline}
      </Reveal>
      <Reveal i={4} className={styles.winner}>
        <PlayerAvatar version={version} icon={winner.profileIcon} name={winner.gameName} size="lg" color={color(winner.index)} />
        <div className={styles.winnerText}>
          <span className={styles.winnerName}>{winner.gameName}</span>
          <span className={styles.winnerValue}>{award.display}</span>
          <span className={styles.winnerLabel}>{award.label}</span>
        </div>
      </Reveal>
      <Reveal i={5} as="p" className={base.caption}>
        {award.line}
      </Reveal>
      {runnersUp.length > 0 && (
        <Reveal i={6} className={base.chips}>
          {runnersUp.map((entry, i) => (
            <span key={entry.member} className={base.chip}>
              {t.rich("squad.slides.award.runner", { n: i + 2, name: members[entry.member].gameName, display: entry.display, ...boldTags })}
            </span>
          ))}
        </Reveal>
      )}
    </Slide>
  );
}

/** Everyone side by side: KDA, deaths, damage and trophies. */
export function SquadBoardSlide({ members, awardCounts, version, t = defaultT }) {
  const rows = [...members].filter((m) => m.games > 0).sort((a, b) => b.kda - a.kda);
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("squad.slides.board.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.boardWrap}>
        <div className={styles.board} role="table" aria-label={t("squad.slides.board.aria")}>
          <div className={`${styles.boardRow} ${styles.boardHead}`} role="row">
            <span />
            <span />
            <span>{t("squad.slides.board.kda")}</span>
            <span>{t("squad.slides.board.deaths")}</span>
            <span className={styles.hideSmall}>{t("squad.slides.board.damage")}</span>
            <span>{t("squad.slides.board.awards")}</span>
          </div>
          {rows.map((m) => (
            <div key={m.puuid} className={styles.boardRow} role="row">
              <PlayerAvatar version={version} icon={m.profileIcon} name={m.gameName} size="sm" color={color(m.index)} />
              <span className={styles.boardName}>{m.gameName}</span>
              <b>{t.fixed(m.kda, 2)}</b>
              <span>{t.fixed(m.perGame.deaths)}</span>
              <span className={styles.hideSmall}>{t.number(Math.round(m.perMin.damage))}</span>
              <span className={styles.trophies}>{awardCounts[m.index] ?? 0}</span>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal i={2} as="p" className={styles.note}>
        {t("squad.slides.board.note")}
      </Reveal>
    </Slide>
  );
}

/** The MVP, share buttons, and links onward. */
export function SquadFinaleSlide({ members, mvp, awardCounts, version, region, share, art, matchup, t = defaultT }) {
  const star = mvp != null ? members[mvp] : null;
  return (
    <Slide art={art} strength="hero" accent={star ? color(star.index) : undefined}>
      <Reveal i={0} className={base.eyebrow}>
        {t(star ? "squad.slides.finale.mvp" : "squad.slides.finale.none")}
      </Reveal>
      {star && (
        <>
          <Reveal i={1}>
            <PlayerAvatar version={version} icon={star.profileIcon} name={star.gameName} size="lg" color={color(star.index)} />
          </Reveal>
          <Reveal i={2} as="h2" className={base.persona} style={{ "--chars": Math.max(star.gameName.length, 6) }}>
            {star.gameName}
          </Reveal>
          <Reveal i={3} as="p" className={base.epithet}>
            {t("squad.slides.finale.awards", { count: awardCounts[star.index] })}
          </Reveal>
        </>
      )}
      <Reveal i={4} className={styles.links}>
        {members.map((m) => (
          <Link key={m.puuid} href={`/recap/${region}/${encodeURIComponent(m.gameName)}/${encodeURIComponent(m.tagLine)}`} className={styles.chipLink}>
            {t("squad.slides.finale.recap", { name: m.gameName })}
          </Link>
        ))}
        {matchup && (
          <Link href={versusPath({ region, ...matchup[0] }, { region, ...matchup[1] })} className={styles.chipLink}>
            {t("squad.slides.finale.versus", { a: matchup[0].gameName, b: matchup[1].gameName })}
          </Link>
        )}
      </Reveal>
      {share && (
        <Reveal i={5}>
          <ShareButtons cardUrl={share.cardUrl} title={t("squad.slides.finale.shareTitle", { names: joinNames(members.map((m) => m.gameName), t) })} />
        </Reveal>
      )}
      <Reveal i={6} className={base.actions}>
        <Link href="/squad" className={base.button}>
          {t("squad.slides.finale.another")}
        </Link>
      </Reveal>
    </Slide>
  );
}

/**
 * Who wins when two of you end up on opposite teams: a grid with each member's record against every other, read from the
 * row's side. `rivalries` is from `buildRivalries`, `members` are the squad stats' members.
 */
export function SquadRivalrySlide({ rivalries, members, version, t = defaultT }) {
  const shown = members.filter((m) => m.games > 0);
  const { cells, total, hottest } = rivalries;
  const cell = (i, j) => {
    const c = cells[i]?.[j];
    if (i === j) return <span className={styles.rivalSelf}>&mdash;</span>;
    if (!c) return <span className={styles.rivalNone}>·</span>;
    const state = c.wins > c.games - c.wins ? "up" : c.wins < c.games - c.wins ? "down" : "even";
    return (
      <span className={styles.rivalScore} data-state={state} aria-label={t("squad.slides.rivalry.cell", { wins: c.wins, losses: c.games - c.wins })}>
        {c.wins}–{c.games - c.wins}
      </span>
    );
  };
  const line = hottest
    ? hottest.wins.a === hottest.wins.b
      ? t("squad.slides.rivalry.even", { a: members[hottest.a].gameName, b: members[hottest.b].gameName, games: hottest.games })
      : t("squad.slides.rivalry.edge", {
          winner: members[hottest.wins.a > hottest.wins.b ? hottest.a : hottest.b].gameName,
          loser: members[hottest.wins.a > hottest.wins.b ? hottest.b : hottest.a].gameName,
          hi: Math.max(hottest.wins.a, hottest.wins.b),
          lo: Math.min(hottest.wins.a, hottest.wins.b),
        })
    : "";

  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("squad.slides.rivalry.eyebrow")}
      </Reveal>
      <Reveal i={1} as="p" className={styles.rivalLead}>
        {t("squad.slides.rivalry.lead", { count: total })}
      </Reveal>
      <Reveal i={2} className={styles.rivalWrap}>
        <div className={styles.rivalGrid} style={{ "--n": shown.length }} role="table" aria-label={t("squad.slides.rivalry.aria")}>
          <span className={styles.rivalCorner} />
          {shown.map((m) => (
            <span key={m.index} className={styles.rivalHead}>
              <PlayerAvatar version={version} icon={m.profileIcon} name={m.gameName} size="sm" color={color(m.index)} />
            </span>
          ))}
          {shown.map((row) => (
            <div key={row.index} className={styles.rivalRow} role="row">
              <span className={styles.rivalHead} title={row.gameName}>
                <PlayerAvatar version={version} icon={row.profileIcon} name={row.gameName} size="sm" color={color(row.index)} />
              </span>
              {shown.map((col) => (
                <span key={col.index} className={styles.rivalCell} role="cell">
                  {cell(row.index, col.index)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal i={3} as="p" className={base.caption}>
        {line}
      </Reveal>
    </Slide>
  );
}

const namesOf = (combo, members, t) => joinNames(combo.members.map((i) => members[i].gameName), t);

/**
 * Who to queue with: the best duo or trio in the squad by win rate together, and how the runners-up did.
 * `combos` is from `bestCombos` and `members` are the squad stats' members.
 */
export function SquadCombosSlide({ combos, members, version, t = defaultT }) {
  const { pick, duos, trios } = combos;
  const others = [...trios.slice(0, 2), ...duos.slice(0, 2)].filter((c) => c !== pick).slice(0, 3);
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("squad.slides.combos.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.pair + " " + styles.bestPair}>
        <span className={styles.pairLabel}>{t(pick.members.length === 3 ? "squad.slides.combos.trio" : "squad.slides.combos.duo")}</span>
        <div className={styles.pairAvatars}>
          {pick.members.map((i) => (
            <PlayerAvatar key={i} version={version} icon={members[i].profileIcon} name={members[i].gameName} color={color(members[i].index)} />
          ))}
        </div>
        <span className={styles.pairNames}>{namesOf(pick, members, t)}</span>
        <span className={styles.pairRate}>{t.percent(pick.winRate)}</span>
        <small>{t("squad.slides.combos.record", { wins: pick.wins, losses: pick.games - pick.wins, games: pick.games })}</small>
      </Reveal>
      {others.length > 0 && (
        <Reveal i={2} className={styles.comboList}>
          {others.map((combo) => (
            <div key={combo.members.join("-")} className={styles.comboRow}>
              <span className={styles.comboNames}>{namesOf(combo, members, t)}</span>
              <span className={styles.comboRate}>
                {t.percent(combo.winRate)} <small>{t("squad.slides.combos.games", { count: combo.games })}</small>
              </span>
            </div>
          ))}
        </Reveal>
      )}
      <Reveal i={3} as="p" className={base.caption}>
        {t("squad.slides.combos.caption", { names: namesOf(pick, members, t) })}
      </Reveal>
    </Slide>
  );
}
