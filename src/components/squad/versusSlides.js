import Image from "next/image";
import RangeSwitch from "@/components/RangeSwitch";
import Link from "next/link";
import SaveSnapshot from "@/components/recap/SaveSnapshot";
import ShareButtons from "@/components/recap/ShareButtons";
import Slide, { Reveal } from "@/components/recap/Slide";
import { boldTags, ChampionIcon, PersonaTitle } from "@/components/recap/slides";
import base from "@/components/recap/slides.module.css";
import { defaultT } from "@/lib/i18n/en";
import { championIconUrl, championName } from "@/lib/riot/ddragon";
import { pairChemistry } from "@/lib/squad/compat";
import { CHECKPOINT_MINUTE, EVEN_GOLD } from "@/lib/squad/timeline";
import { compareRecaps, memberAsRecap, verdictLine } from "@/lib/squad/versus";
import GoldLeadChart from "./GoldLeadChart";
import PlayerAvatar from "./PlayerAvatar";
import RhythmRows from "./RhythmRows";
import styles from "./versus.module.css";
import squadStyles from "./squad.module.css";

// Player A is always gold and player B always teal, on every slide.
export const SIDE_COLORS = { a: "#e0b458", b: "#0ac8b9" };

// A tag that shows its text in a side's color, for messages about just one of the players.
function sideOf(side) {
  return function SideText(chunks) {
    return <b style={{ color: SIDE_COLORS[side] }}>{chunks}</b>;
  };
}

// Tags for the messages that show the two players' numbers in their colors: `<sa>`, `<sb>` and plain `<b>`.
const sideTags = {
  b: (chunks) => <b>{chunks}</b>,
  sa: (chunks) => <b style={{ color: SIDE_COLORS.a }}>{chunks}</b>,
  sb: (chunks) => <b style={{ color: SIDE_COLORS.b }}>{chunks}</b>,
};

function RankBadge({ rank, t }) {
  if (!rank) return <span className={styles.unranked}>{t("versus.slides.intro.unranked")}</span>;
  return (
    <span className={styles.rank} style={{ "--tier": rank.color }}>
      <Image src={rank.emblem} alt="" width={40} height={40} className={styles.rankEmblem} />
      {rank.title}
    </span>
  );
}

/** Each player's champion art on their half of the screen, fading toward the middle. */
export function SplitArt({ left, right }) {
  return (
    <div className={styles.split}>
      {[
        ["a", left],
        ["b", right],
      ].map(([side, skin]) =>
        skin ? (
          <div key={side} className={styles.half} data-side={side}>
            <Image src={skin.url} alt="" fill sizes="50vw" quality={90} className={styles.halfImg} />
            <div className={styles.halfShade} />
            <div className="grain" />
          </div>
        ) : null,
      )}
    </div>
  );
}

/** Two players facing off. `a` and `b` are `{ account, summoner, region, games, rank }`. */
export function VersusIntroSlide({ a, b, version, backdrop, sameServer, ranges, t = defaultT }) {
  return (
    <Slide backdrop={backdrop} eager>
      <Reveal i={0} className={base.eyebrow}>
        {t("versus.slides.intro.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.faceOff}>
        {[
          ["a", a],
          ["b", b],
        ].map(([side, p]) => (
          <div key={side} className={styles.contender} data-side={side}>
            <PlayerAvatar version={version} icon={p.summoner?.profileIconId} name={p.account.gameName} size="lg" color={SIDE_COLORS[side]} />
            <span className={styles.contenderName}>{p.account.gameName}</span>
            <span className={styles.contenderTag}>#{p.account.tagLine}</span>
            <RankBadge rank={p.rank} t={t} />
            <small>{t("versus.slides.intro.games", { count: p.games })}</small>
          </div>
        ))}
        <span className={styles.vsBadge} aria-hidden="true">
          {t("versus.slides.intro.vs")}
        </span>
      </Reveal>
      {ranges && (
        <Reveal i={2}>
          <RangeSwitch links={ranges} label={t("common.range.label")} />
        </Reveal>
      )}
      {!sameServer && (
        <Reveal i={3} as="p" className={styles.note}>
          {t("versus.slides.intro.differentServers")}
        </Reveal>
      )}
    </Slide>
  );
}

function StatRows({ comparison, t }) {
  return (
    <div className={styles.rows} role="table" aria-label={t("versus.slides.stats.aria")}>
      {comparison.rows.map((row) => (
        <div key={row.key} className={styles.row} data-winner={row.winner} role="row">
          <span className={styles.valueA}>{row.aShow}</span>
          <div className={styles.mid}>
            <span className={styles.rowLabel}>{row.label}</span>
            <div className={styles.bar} aria-hidden="true">
              <span data-side="a" style={{ width: `${Math.round(row.aShare * 100)}%` }} />
              <span data-side="b" />
            </div>
          </div>
          <span className={styles.valueB}>{row.bShow}</span>
        </div>
      ))}
    </div>
  );
}

/** The stat-by-stat comparison. `comparison` is from `compareRecaps`. */
export function VersusStatsSlide({ comparison, aName, bName, t = defaultT }) {
  const { score } = comparison;
  return (
    <Slide dwell={10}>
      <Reveal i={0} className={base.eyebrow}>
        {t("versus.slides.stats.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.scoreline}>
        <span style={{ color: SIDE_COLORS.a }}>{aName}</span>
        <b>
          {score.a} – {score.b}
        </b>
        <span style={{ color: SIDE_COLORS.b }}>{bName}</span>
      </Reveal>
      <Reveal i={2} className={styles.tableWrap}>
        <StatRows comparison={comparison} t={t} />
      </Reveal>
      {score.ties > 0 && (
        <Reveal i={3} as="p" className={styles.note}>
          {t("versus.slides.stats.ties", { count: score.ties })}
        </Reveal>
      )}
    </Slide>
  );
}

/** How each one plays: archetype, main champion, main role. `a` and `b` carry `persona`, `recap`, `index`. */
export function VersusStyleSlide({ a, b, index, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("versus.slides.style.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.styleGrid}>
        {[
          ["a", a],
          ["b", b],
        ].map(([side, p]) => {
          const top = p.recap.topChampions[0];
          const icon = championIconUrl(index.version, top.id);
          const values = { games: top.games, rate: t.percent(top.winRate), role: p.recap.role ? t(`common.roles.${p.recap.role.key}`) : "" };
          return (
            <div key={side} className={styles.styleCard} data-side={side} style={{ "--side": SIDE_COLORS[side], "--accent-card": p.persona.accent }}>
              <span className={styles.styleName}>{p.account.gameName}</span>
              <span className={styles.persona}>{p.persona.title}</span>
              <span className={styles.tagline}>{p.persona.tagline}</span>
              <div className={styles.mainChamp}>
                {icon && <Image src={icon} alt="" width={48} height={48} unoptimized className={styles.champIcon} />}
                <span>
                  <b>{championName(index, top.id)}</b>
                  <small>{t(p.recap.role ? "versus.slides.style.metaRole" : "versus.slides.style.meta", values)}</small>
                </span>
              </div>
            </div>
          );
        })}
      </Reveal>
    </Slide>
  );
}

function Matchup({ aName, bName, t }) {
  return (
    <div className={styles.matchup}>
      <span style={{ color: SIDE_COLORS.a }}>{aName}</span>
      <i>{t("versus.slides.scenario.vs")}</i>
      <span style={{ color: SIDE_COLORS.b }}>{bName}</span>
    </div>
  );
}

// A heading sized for up to three lines, so long scenario titles stay on screen.
const threeLineChars = (text) => Math.max(...text.split(/\s+/).map((word) => word.length), Math.ceil(text.length / 3));

/**
 * One side bet on a slide of its own: the scenario, both players' numbers face to face, and the punchline. The winner's
 * color tints the slide. `scenario` is from `buildScenarios`; `a` and `b` are `{ account, summoner }`.
 */
export function VersusScenarioSlide({ scenario: s, position, total, a, b, version, t = defaultT }) {
  return (
    <Slide accent={SIDE_COLORS[s.winner]}>
      <Reveal i={0} className={base.eyebrow}>
        {t("versus.slides.scenario.eyebrow", { group: s.group, position, total })}
      </Reveal>
      <Reveal i={1} className={styles.scenarioIcon}>
        <span aria-hidden="true">{s.icon}</span>
      </Reveal>
      <Reveal i={2} as="h2" className={styles.scenarioHeading} style={{ "--chars": threeLineChars(s.title) }}>
        {s.title}
      </Reveal>
      <Reveal i={3} as="p" className={base.epithet}>
        {s.tagline}
      </Reveal>
      <Reveal i={4} className={styles.showdown}>
        {[
          ["a", a, s.aShow],
          ["b", b, s.bShow],
        ].map(([side, p, show]) => (
          <div key={side} className={styles.fighter} data-side={side} data-won={s.winner === side}>
            <PlayerAvatar version={version} icon={p.summoner?.profileIconId} name={p.account.gameName} size="lg" color={SIDE_COLORS[side]} />
            <span className={styles.fighterName}>{p.account.gameName}</span>
            <span className={styles.fighterValue}>{show}</span>
            <span className={styles.fighterTag}>{s.winner === side ? t(s.scored ? "versus.slides.scenario.wins" : "versus.slides.scenario.leads") : " "}</span>
          </div>
        ))}
        <span className={styles.vsBadge} aria-hidden="true">
          {t("versus.slides.intro.vs")}
        </span>
      </Reveal>
      <Reveal i={5} as="p" className={base.caption}>
        {s.line}
      </Reveal>
    </Slide>
  );
}

/** When the two play, in the viewer's time zone. `a` and `b` are `{ name, activity }`. */
export function VersusRhythmSlide({ a, b, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("versus.slides.rhythm.eyebrow")}
      </Reveal>
      <Reveal i={1}>
        <Matchup aName={a.name} bName={b.name} t={t} />
      </Reveal>
      <Reveal i={2} className={styles.tableWrap}>
        <RhythmRows a={a} b={b} />
      </Reveal>
      <Reveal i={3} as="p" className={styles.note}>
        {t("versus.slides.rhythm.note")}
      </Reveal>
    </Slide>
  );
}

function faceOffLine(faceOff, aName, bName, t) {
  const { wins } = faceOff;
  if (wins.a === wins.b) return t("versus.slides.faceoff.even");
  const [win, lose, hi, lo] = wins.a > wins.b ? [aName, bName, wins.a, wins.b] : [bName, aName, wins.b, wins.a];
  if (lo === 0) return t("versus.slides.faceoff.sweep", { name: win, other: lose });
  return t("versus.slides.faceoff.edge", { name: win, other: lose, hi, lo });
}

function MeetingSide({ side, p, name, index, t }) {
  const icon = championIconUrl(index.version, p.champion);
  return (
    <div className={styles.meetingSide} data-side={side} data-win={p.win}>
      {icon && <Image src={icon} alt="" width={44} height={44} unoptimized className={styles.champIcon} />}
      <span>
        <b>{name}</b>
        <small>{t("versus.slides.faceoff.meta", { champion: championName(index, p.champion), kills: p.kills, deaths: p.deaths, assists: p.assists })}</small>
      </span>
      <em>{t(p.win ? "versus.slides.faceoff.won" : "versus.slides.faceoff.lost")}</em>
    </div>
  );
}

/** How the two do when they're on opposite teams. `faceOff` is from `buildFaceOff`. */
export function VersusFaceOffSlide({ faceOff, aName, bName, index, t = defaultT }) {
  const { games, wins, outplayed, duels, last } = faceOff;
  const role = last.role ? t(`versus.slides.faceoff.roles.${["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].includes(last.role) ? last.role : "other"}`) : null;
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t("versus.slides.faceoff.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.scoreline}>
        <span style={{ color: SIDE_COLORS.a }}>{aName}</span>
        <b>
          {wins.a} – {wins.b}
        </b>
        <span style={{ color: SIDE_COLORS.b }}>{bName}</span>
      </Reveal>
      <Reveal i={2} className={base.chips}>
        <span className={base.chip}>{t.rich("versus.slides.faceoff.meetings", { count: games, ...boldTags })}</span>
        {duels.games > 0 && <span className={base.chip}>{t.rich("versus.slides.faceoff.duels", { count: duels.games, left: duels.wins.a, right: duels.wins.b, ...boldTags })}</span>}
        {outplayed.a !== outplayed.b && (
          <span className={base.chip}>{t.rich("versus.slides.faceoff.better", { name: outplayed.a > outplayed.b ? aName : bName, ...boldTags })}</span>
        )}
      </Reveal>
      <Reveal i={3} className={styles.meeting}>
        <span className={styles.meetingLabel}>{role ? t("versus.slides.faceoff.lastRole", { role }) : t("versus.slides.faceoff.last")}</span>
        <div className={styles.meetingSides}>
          <MeetingSide side="a" p={last.a} name={aName} index={index} t={t} />
          <MeetingSide side="b" p={last.b} name={bName} index={index} t={t} />
        </div>
      </Reveal>
      <Reveal i={4} as="p" className={base.caption}>
        {faceOffLine(faceOff, aName, bName, t)}
      </Reveal>
    </Slide>
  );
}

const gold = (t, x) => t.number(Math.round(Math.abs(x)));

function timelineLine(timeline, aName, bName, t) {
  const { early, kills } = timeline;
  const T = "versus.slides.timeline";
  if (!early) {
    if (kills.a === kills.b) return t(`${T}.noEdge`);
    return t(`${T}.killsLead`, { name: kills.a > kills.b ? aName : bName });
  }
  if (Math.abs(early.goldDiff) < EVEN_GOLD) return t(`${T}.level`, { minute: CHECKPOINT_MINUTE });

  const side = early.goldDiff > 0 ? "a" : "b";
  const [leader, other] = side === "a" ? [aName, bName] : [bName, aName];
  const { ahead, won } = early.converted[side];
  const lead = t(`${T}.lead`, { leader, minute: CHECKPOINT_MINUTE, gold: gold(t, early.goldDiff) });
  if (ahead < 2) return lead;
  if (won === ahead) return t(`${T}.allWon`, { lead, other });
  if (won === 0) return t(`${T}.noneWon`, { lead, other });
  return t(`${T}.someWon`, { lead, won, ahead });
}

/** The minute-by-minute view of the games they played against each other. `timeline` is `faceOff.timeline` from `buildFaceOff`. */
export function VersusTimelineSlide({ timeline, aName, bName, t = defaultT }) {
  const { games, kills, solo, early, firstDeath, dragons, curve } = timeline;
  const firstDeaths = firstDeath.a + firstDeath.b;
  const dragonGames = dragons.a + dragons.b;
  const T = "versus.slides.timeline";
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t(`${T}.eyebrow`)}
      </Reveal>
      <Reveal i={1} className={styles.scoreline}>
        <span style={{ color: SIDE_COLORS.a }}>{aName}</span>
        <b>
          {kills.a} – {kills.b}
        </b>
        <span style={{ color: SIDE_COLORS.b }}>{bName}</span>
      </Reveal>
      <Reveal i={2} className={base.chips}>
        <span className={base.chip}>{t.rich(`${T}.kills`, { meetings: games, ...sideTags })}</span>
        {solo.a + solo.b > 0 && <span className={base.chip}>{t.rich(`${T}.solo`, { left: solo.a, right: solo.b, ...sideTags })}</span>}
      </Reveal>
      {early && (
        <Reveal i={3} className={base.chips}>
          <span className={base.chip}>
            {t.rich(`${T}.ahead`, { minute: CHECKPOINT_MINUTE, left: early.ahead.a, right: early.ahead.b, ...sideTags })}
            {early.ahead.even > 0 && ` ${t(`${T}.aheadLevel`, { count: early.ahead.even })}`}
          </span>
          {firstDeaths > 0 && (
            <span className={base.chip} data-optional>
              {t.rich(`${T}.firstDeath`, { left: firstDeath.a, right: firstDeath.b, ...sideTags })}
            </span>
          )}
          {dragonGames > 0 && (
            <span className={base.chip} data-optional>
              {t.rich(`${T}.firstDragon`, { left: dragons.a, right: dragons.b, ...sideTags })}
            </span>
          )}
          {Math.abs(early.goldDiff) >= EVEN_GOLD && (
            <span className={base.chip}>{t.rich(`${T}.goldLead`, { gold: gold(t, early.goldDiff), name: early.goldDiff > 0 ? aName : bName, ...sideTags })}</span>
          )}
        </Reveal>
      )}
      {curve && (
        <Reveal i={4} className={styles.chartWrap}>
          <GoldLeadChart points={curve.points} aName={aName} bName={bName} aWon={curve.aWon} />
        </Reveal>
      )}
      <Reveal i={5} as="p" className={base.caption}>
        {timelineLine(timeline, aName, bName, t)}
        {games < 3 ? ` ${t("versus.slides.small")}` : ""}
      </Reveal>
    </Slide>
  );
}

const points = (t, x) => `${x >= 0 ? "+" : "−"}${t.number(Math.abs(Math.round(x * 100)))}`;

function synergyLine(synergy, aName, bName, t) {
  const T = "versus.slides.together";
  const [da, db] = [synergy.a?.delta, synergy.b?.delta];
  const both = [da, db].filter((d) => d != null);
  const each = da != null && db != null ? t(`${T}.each`, { aName, a: points(t, da), bName, b: points(t, db) }) : t(`${T}.eachOne`, { value: points(t, both[0]), name: da != null ? aName : bName });
  if (synergy.verdict === "lift") return t(`${T}.lift`, { each });
  if (synergy.verdict === "drag") return t(`${T}.drag`, { each });
  if (synergy.verdict === "mixed") return t(`${T}.mixed`, { each });
  return t(`${T}.flat`);
}

/** Who had the better KDA in the shared games, as `[name, kda, side]`; null when it was level. */
function kdaCarryOf(ma, mb, aName, bName) {
  if (ma.kda === mb.kda) return null;
  return ma.kda > mb.kda ? [aName, ma.kda, "a"] : [bName, mb.kda, "b"];
}

/** The chips under the together slide's caption: who dealt more damage, when it paid off, and how each does apart. */
function TogetherChips({ damage, synergy, aName, bName, t }) {
  const T = "versus.slides.together";
  const rate = (r) => t.percent(r.wins / r.games);
  return (
    <Reveal i={4} className={base.chips}>
      {damage && damage.lead.a + damage.lead.b > 0 && <span className={base.chip}>{t.rich(`${T}.topDamage`, { left: damage.lead.a, right: damage.lead.b, ...sideTags })}</span>}
      {damage?.better && (
        <span className={base.chip}>
          {t.rich(`${T}.winsMore`, { name: damage.better === "a" ? aName : bName, side: sideOf(damage.better) })}
          <span data-optional>
            {" "}
            {t(`${T}.winsMoreRates`, { rate: rate(damage.record[damage.better]), other: rate(damage.record[damage.better === "a" ? "b" : "a"]) })}
          </span>
        </span>
      )}
      {synergy &&
        ["a", "b"].map(
          (side) =>
            synergy[side] && (
              <span key={side} className={base.chip} data-optional>
                {t.rich(`${T}.apart`, { name: side === "a" ? aName : bName, apart: t.percent(synergy[side].apart), together: t.percent(synergy[side].together), side: sideOf(side) })}
              </span>
            ),
        )}
    </Reveal>
  );
}

/** What happens when the two queue together. `together` is from `buildSquadStats` over their shared games. */
export function VersusTogetherSlide({ together, synergy, carry: damage, aName, bName, t = defaultT }) {
  const T = "versus.slides.together";
  const [ma, mb] = together.members;
  const comparison = compareRecaps(memberAsRecap(ma), memberAsRecap(mb), t);
  // Four rows are enough here: this slide is about the shared games, not a second full comparison.
  const rows = { ...comparison, rows: comparison.rows.filter((r) => ["kda", "damage", "deaths", "vision"].includes(r.key)) };
  const kdaCarry = kdaCarryOf(ma, mb, aName, bName);
  const { squad } = together;
  const chemistry = pairChemistry({ wins: squad.wins, games: squad.games, damageA: ma.perMin.damage, damageB: mb.perMin.damage, lifts: [synergy?.a?.delta, synergy?.b?.delta] }, t);
  return (
    <Slide>
      <Reveal i={0} className={base.eyebrow}>
        {t(`${T}.eyebrow`)}
      </Reveal>
      <Reveal i={1} className={squadStyles.chemistry}>
        <span className={squadStyles.chemistryHeart} aria-hidden="true">
          {"\u2764\uFE0F"}
        </span>
        <span>
          <span className={squadStyles.chemistryScore}>{t.percent(chemistry.score / 100)}</span>
          <span className={squadStyles.chemistryLabel}>{t(`${T}.chemistry`, { label: chemistry.label })}</span>
        </span>
      </Reveal>
      <Reveal i={1} className={base.chips}>
        <span className={base.chip}>{t.rich("recap.gamesChip", { count: squad.games, ...boldTags })}</span>
        <span className={base.chip}>{t.rich("recap.recordChip", { wins: squad.wins, losses: squad.losses, ...boldTags })}</span>
        <span className={base.chip}>{t.rich("recap.winRateChip", { rate: t.percent(squad.winRate), ...boldTags })}</span>
      </Reveal>
      <Reveal i={2} className={styles.tableWrap}>
        <StatRows comparison={rows} t={t} />
      </Reveal>
      <Reveal i={3} as="p" className={base.caption}>
        {kdaCarry ? t(`${T}.carry`, { name: kdaCarry[0], kda: t.fixed(kdaCarry[1], 2) }) : t(`${T}.even`)}
        {squad.games < 3 ? ` ${t("versus.slides.small")}` : ""}
      </Reveal>
      {(damage || synergy) && <TogetherChips damage={damage} synergy={synergy} aName={aName} bName={bName} t={t} />}
      {synergy && (
        <Reveal i={5} as="p" className={styles.note}>
          {synergyLine(synergy, aName, bName, t)}
        </Reveal>
      )}
    </Slide>
  );
}

/** The two contestants side by side: the winner larger and crowned, the other beside them (both level on a tie). */
function Podium({ a, b, side, score, index, t }) {
  const V = "versus.slides.verdict";
  return (
    <Reveal i={1} className={styles.podium}>
      {[
        ["a", a],
        ["b", b],
      ].map(([who, p]) => (
        <div key={who} className={styles.contestant} data-side={who} data-role={side ? (who === side ? "winner" : "loser") : "tie"}>
          <div className={styles.champion}>
            <PlayerAvatar version={index.version} icon={p.summoner?.profileIconId} name={p.account.gameName} size={who === side ? "lg" : "md"} color={SIDE_COLORS[who]} />
            {who === side && (
              <span className={styles.crown} aria-hidden="true">
                ♛
              </span>
            )}
          </div>
          <span className={styles.contestantName}>{p.account.gameName}</span>
          <span className={styles.contestantRows}>{t(`${V}.rows`, { count: score[who] })}</span>
        </div>
      ))}
    </Reveal>
  );
}

/** The winner's main champion, then last time's score when there is a rematch, else the side-bet tally. */
function VerdictChips({ main, rematch, sideBets, index, t }) {
  const V = "versus.slides.verdict";
  return (
    <Reveal i={4} className={base.chips}>
      {main && (
        <span className={`${base.chip} ${styles.mainChip}`}>
          <ChampionIcon index={index} id={main.id} size={24} /> {t.rich(`${V}.main`, { champion: championName(index, main.id), ...boldTags })}
        </span>
      )}
      {rematch ? (
        <span className={base.chip}>
          {t.rich(`${V}.rematchChip`, { date: t.date(rematch.time, { month: "short", day: "numeric", timeZone: "UTC" }), left: rematch.before[0], right: rematch.before[1], ...sideTags })}
        </span>
      ) : (
        sideBets && <span className={base.chip}>{t.rich(`${V}.sideBets`, { left: sideBets.a, right: sideBets.b, ...sideTags })}</span>
      )}
    </Reveal>
  );
}

/** The line under the score: last time's result when there is one, else the verdict, plus a note when the side bets disagree with it. */
function verdictCaption({ comparison, rematch, a, b, sideBets, t }) {
  if (rematch) return rematch.line;
  const V = "versus.slides.verdict";
  const { winner, score } = comparison;
  // The side bets are their own scoreboard, and sometimes they disagree with the stat rows, which is half the fun.
  const betLeader = !sideBets || sideBets.a === sideBets.b ? null : sideBets.a > sideBets.b ? "a" : "b";
  const disagrees = betLeader && betLeader !== winner && winner !== "tie";
  const note = disagrees ? ` ${t(`${V}.sideBetsNote`, { name: betLeader === "a" ? a.account.gameName : b.account.gameName })}` : "";
  return verdictLine(comparison, a.account.gameName, b.account.gameName, t) + note;
}

/**
 * The verdict, with share buttons and links onward. The winner gets the persona treatment from their own recap: their
 * champion's splash art (cycling through skins), a burst behind the title, and a crown on their icon, with the runner-up beside them. `art` is
 * `{ a, b }`, each a list of skins; a tie shows both mains split down the middle. `index` is the champion index.
 * `rematch` (from `compareToRematch`) adds last time's score, and `snapshot` lets the pair save this one to compare later.
 */
export function VersusVerdictSlide({ comparison, sideBets, a, b, share, aHref, bHref, region, index, art, rematch, snapshot, t = defaultT }) {
  const V = "versus.slides.verdict";
  const { winner, score } = comparison;
  const win = winner === "tie" ? null : winner === "a" ? a : b;
  const side = winner === "tie" ? null : winner;
  const main = win?.recap.topChampions[0];
  const title = win ? t(`${V}.wins`, { name: win.account.gameName }) : t(`${V}.tie`);
  return (
    <Slide
      accent={side ? SIDE_COLORS[side] : undefined}
      art={side ? art[side] : undefined}
      backdrop={side ? undefined : <SplitArt left={art.a[0]} right={art.b[0]} />}
      strength="hero"
    >
      <Reveal i={0} className={base.eyebrow}>
        {t(`${V}.eyebrow`)}
      </Reveal>
      <Podium a={a} b={b} side={side} score={score} index={index} t={t} />
      <PersonaTitle title={title} locale={t.locale} />
      <Reveal i={3} className={base.megaLabel}>
        {t(score.ties > 0 ? `${V}.scoreTied` : `${V}.score`, { a: score.a, b: score.b, ties: score.ties })}
      </Reveal>
      <VerdictChips main={main} rematch={rematch} sideBets={sideBets} index={index} t={t} />
      <Reveal i={5} as="p" className={`${base.caption} ${styles.verdictCaption}`}>
        {verdictCaption({ comparison, rematch, a, b, sideBets, t })}
      </Reveal>
      <Reveal i={6} className={styles.links}>
        <Link href={aHref} className={styles.chipLink}>
          {t(`${V}.recap`, { name: a.account.gameName })}
        </Link>
        <Link href={bHref} className={styles.chipLink}>
          {t(`${V}.recap`, { name: b.account.gameName })}
        </Link>
        {snapshot && <SaveSnapshot snapshot={snapshot} label={t("share.saveRematch")} className={styles.chipLink} />}
      </Reveal>
      {share && (
        <Reveal i={7}>
          <ShareButtons cardUrl={share.cardUrl} title={t(`${V}.shareTitle`, { a: a.account.gameName, b: b.account.gameName })} />
        </Reveal>
      )}
      <Reveal i={8} className={base.actions}>
        <Link href={region ? `/versus?a=${encodeURIComponent(`${region}:${a.account.gameName}#${a.account.tagLine}`)}` : "/versus"} className={base.button}>
          {t(`${V}.again`)}
        </Link>
      </Reveal>
    </Slide>
  );
}
