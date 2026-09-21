import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { defaultT } from "@/lib/i18n/en";
import { championIconUrl, championName, championVoice, profileIconUrl } from "@/lib/riot/ddragon";
import { getModeInsight } from "@/lib/recap/modes";
import { formatDuration, PERSONA_COUNT, rarityShareText } from "@/lib/recap/persona";
import RangeSwitch from "@/components/RangeSwitch";
import CountUp from "./CountUp";
import ResultStrip from "./ResultStrip";
import PersonaSound from "./PersonaSound";
import SaveSnapshot from "./SaveSnapshot";
import VoiceLine from "./VoiceLine";
import ShareButtons from "./ShareButtons";
import Slide, { Reveal } from "./Slide";
import styles from "./slides.module.css";

// Big headings are sized from their longest word (`--chars` in the CSS) so long names fit on a phone.
export const fitTo = (text) => ({ "--chars": Math.max(...text.split(/\s+/).map((word) => word.length)) });

// The tags the recap messages use around a number: `<b>`, and `<good>` / `<bad>` for a green or red one.
export const boldTags = {
  b: (chunks) => <b>{chunks}</b>,
  good: (chunks) => <b className={styles.good}>{chunks}</b>,
  bad: (chunks) => <b className={styles.bad}>{chunks}</b>,
};

// "Ahri" is 4 letters, but a word like "Yeşil" or a Thai title has marks that belong to the letter before them.
const graphemes = (text, locale) => [...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);

export function ChampionIcon({ index, id, size = 44 }) {
  const src = championIconUrl(index.version, id);
  if (!src) return <span className={styles.iconFallback} style={{ width: size, height: size }} />;
  return <Image src={src} alt="" width={size} height={size} unoptimized className={styles.icon} />;
}

export function IntroSlide({ account, summoner, index, recap, totalGames, season, art, ranges, t = defaultT }) {
  const icon = profileIconUrl(index.version, summoner?.profileIconId);
  return (
    <Slide art={art} strength="hero" eager>
      <Reveal i={0} className={styles.eyebrow}>
        {t("recap.intro.eyebrow", { season })}
      </Reveal>
      {icon && (
        <Reveal i={1} className={styles.avatar}>
          <Image src={icon} alt="" width={112} height={112} unoptimized />
          {summoner?.summonerLevel != null && <span className={styles.level}>{summoner.summonerLevel}</span>}
        </Reveal>
      )}
      {/* A Riot ID is always written left to right, whatever the language of the page. */}
      <Reveal i={2} as="h1" className={styles.name} dir="ltr">
        {account.gameName}
        <span className={styles.tag}>#{account.tagLine}</span>
      </Reveal>
      <Reveal i={3} as="p" className={styles.caption}>
        {t("recap.intro.caption", { games: totalGames ?? recap.games })}
      </Reveal>
      {ranges && (
        <Reveal i={4}>
          <RangeSwitch links={ranges} label={t("common.range.label")} />
        </Reveal>
      )}
      <Reveal i={5} className={styles.scrollHint}>
        {t("recap.intro.scroll")} <span aria-hidden="true">↓</span>
      </Reveal>
    </Slide>
  );
}

export function GamesSlide({ recap, insights, riftOnly, t = defaultT }) {
  return (
    <Slide>
      <Reveal i={0} className={styles.eyebrow}>
        {t("recap.games.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.mega}>
        <CountUp value={recap.games} />
      </Reveal>
      <Reveal i={2} className={styles.megaLabel}>
        {t(riftOnly ? "recap.games.riftOnly" : "recap.games.played", { count: recap.games })}
      </Reveal>
      <Reveal i={3} className={styles.chips}>
        <span className={styles.chip}>{t.rich("recap.games.wins", { count: recap.wins, ...boldTags })}</span>
        <span className={styles.chip}>{t.rich("recap.games.losses", { count: recap.losses, ...boldTags })}</span>
        <span className={styles.chip}>
          {t.rich("recap.games.hours", { n: recap.hoursPlayed, value: <CountUp value={recap.hoursPlayed} decimals={1} />, ...boldTags })}
        </span>
      </Reveal>
      {recap.results?.length >= 5 && (
        <Reveal i={4} className={styles.stripWrap}>
          <ResultStrip results={recap.results} t={t} />
        </Reveal>
      )}
      <Reveal i={5} as="p" className={styles.caption}>
        {insights.games}
      </Reveal>
    </Slide>
  );
}

export function WinSlide({ recap, insights, t = defaultT }) {
  const offset = 100 - recap.winRate * 100;
  return (
    <Slide>
      <Reveal i={0} className={styles.eyebrow}>
        {t("recap.win.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.ring}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0d9a0" />
              <stop offset="100%" stopColor="#0ac8b9" />
            </linearGradient>
          </defs>
          <circle className={styles.track} cx="50" cy="50" r="44" pathLength="100" />
          <circle className={styles.bar} data-bar cx="50" cy="50" r="44" pathLength="100" style={{ "--off": offset }} />
        </svg>
        <div className={styles.ringCenter}>
          <span className={styles.ringValue}>
            <CountUp value={recap.winRate} percent />
          </span>
          <span className={styles.megaLabel}>{t("recap.record", { wins: recap.wins, losses: recap.losses })}</span>
        </div>
      </Reveal>
      <Reveal i={2} as="p" className={styles.caption}>
        {insights.win}
      </Reveal>
      <Reveal i={3} className={styles.chips}>
        <span className={styles.chip}>{insights.streak}</span>
        {insights.comeback && <span className={styles.chip}>{insights.comeback}</span>}
      </Reveal>
    </Slide>
  );
}

/** Your most played champion. Their voice line plays as the slide arrives, when sound is on. */
export function ChampionSlide({ recap, index, insights, art, moreHref, eyebrow, t = defaultT }) {
  const top = recap.topChampions[0];
  const voice = championVoice(index, top.id, t.locale);
  const runnersUp = recap.topChampions.slice(1, 5);
  return (
    <Slide art={art} strength="hero">
      <Reveal i={0} className={styles.eyebrow}>
        {eyebrow ?? t("recap.champion.eyebrow")}
      </Reveal>
      <Reveal i={1} as="h2" className={styles.champion} style={fitTo(championName(index, top.id))}>
        {championName(index, top.id)}
      </Reveal>
      {index.byId[top.id]?.title && (
        <Reveal i={2} as="p" className={styles.epithet}>
          {index.byId[top.id].title}
        </Reveal>
      )}
      {voice && <VoiceLine src={voice.src} fallback={voice.fallback} />}
      <Reveal i={3} className={styles.chips}>
        <span className={styles.chip}>{t.rich("recap.gamesChip", { count: top.games, ...boldTags })}</span>
        <span className={styles.chip}>
          {t.rich("recap.winRateChip", { rate: t.percent(top.winRate), b: (chunks) => <b className={top.winRate >= 0.5 ? styles.good : styles.bad}>{chunks}</b> })}
        </span>
        <span className={styles.chip}>{t.rich("recap.kdaChip", { kda: t.fixed(top.kda, 2), ...boldTags })}</span>
      </Reveal>
      <Reveal i={4} as="p" className={styles.caption}>
        {insights.champion}
      </Reveal>
      {moreHref && (
        <Reveal i={5} className={styles.finaleLinks}>
          <Link href={moreHref} className={styles.smallLink}>
            {t("recap.champion.more", { champion: championName(index, top.id) })}
          </Link>
        </Reveal>
      )}
      {runnersUp.length > 0 && (
        <Reveal i={6} className={styles.runners}>
          {runnersUp.map((c) => (
            <div key={c.id} className={styles.runner}>
              <ChampionIcon index={index} id={c.id} />
              <span>{championName(index, c.id)}</span>
              <small>{t("recap.gamesLabel", { count: c.games })}</small>
            </div>
          ))}
        </Reveal>
      )}
    </Slide>
  );
}

export function KdaSlide({ recap, index, insights, art, t = defaultT }) {
  const best = recap.bestGame;
  return (
    <Slide art={art}>
      <Reveal i={0} className={styles.eyebrow}>
        {t("recap.kda.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.trio}>
        <div>
          <span className={`${styles.big} ${styles.kills}`}>
            <CountUp value={recap.kills} />
          </span>
          <span className={styles.tileLabel}>{t("recap.kda.kills")}</span>
          <small>{t("recap.kda.perGame", { value: t.fixed(recap.perGame.kills) })}</small>
        </div>
        <div>
          <span className={`${styles.big} ${styles.deaths}`}>
            <CountUp value={recap.deaths} />
          </span>
          <span className={styles.tileLabel}>{t("recap.kda.deaths")}</span>
          <small>{t("recap.kda.perGame", { value: t.fixed(recap.perGame.deaths) })}</small>
        </div>
        <div>
          <span className={`${styles.big} ${styles.assists}`}>
            <CountUp value={recap.assists} />
          </span>
          <span className={styles.tileLabel}>{t("recap.kda.assists")}</span>
          <small>{t("recap.kda.perGame", { value: t.fixed(recap.perGame.assists) })}</small>
        </div>
      </Reveal>
      <Reveal i={2} className={styles.chips}>
        <span className={styles.chip}>{t.rich("recap.kdaChip", { kda: <CountUp value={recap.kda} decimals={2} />, ...boldTags })}</span>
      </Reveal>
      <Reveal i={3} as="p" className={styles.caption}>
        {insights.kda}
      </Reveal>
      {best && (
        <Reveal i={4} className={styles.card}>
          <span className={styles.tileLabel}>{t("recap.kda.best")}</span>
          <span className={styles.cardMain}>
            {t("recap.kda.bestLine", { champion: championName(index, best.champion), kills: best.kills, deaths: best.deaths, assists: best.assists })}
          </span>
          <small>{t(best.win ? "recap.kda.victory" : "recap.kda.defeat")}</small>
        </Reveal>
      )}
    </Slide>
  );
}

export function PlaystyleSlide({ recap, index, t = defaultT }) {
  const highlights = [
    recap.multikills.penta > 0 && { key: "penta", count: recap.multikills.penta },
    recap.multikills.quadra > 0 && { key: "quadra", count: recap.multikills.quadra },
    recap.multikills.triple > 0 && { key: "triple", count: recap.multikills.triple },
    recap.firstBloods > 0 && { key: "firstBloods", count: recap.firstBloods },
    recap.deathlessGames > 0 && { key: "deathless", count: recap.deathlessGames },
  ].filter(Boolean);

  return (
    <Slide>
      <Reveal i={0} className={styles.eyebrow}>
        {t("recap.style.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.tiles}>
        {recap.role && (
          <div className={styles.tile}>
            <span className={styles.tileValue}>{t(`common.roles.${recap.role.key}`)}</span>
            <span className={styles.tileLabel}>{t("recap.style.mainRole", { share: t.percent(recap.role.share) })}</span>
          </div>
        )}
        <div className={styles.tile}>
          <span className={styles.tileValue}>
            <CountUp value={recap.csPerMin} decimals={1} />
          </span>
          <span className={styles.tileLabel}>{t("recap.style.cs")}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>
            <CountUp value={recap.visionPerMin} decimals={2} />
          </span>
          <span className={styles.tileLabel}>{t("recap.style.vision")}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>
            <CountUp value={recap.damagePerMin} />
          </span>
          <span className={styles.tileLabel}>{t("recap.style.damage")}</span>
        </div>
        {recap.killParticipation != null && (
          <div className={styles.tile}>
            <span className={styles.tileValue}>
              <CountUp value={recap.killParticipation} percent />
            </span>
            <span className={styles.tileLabel}>{t("recap.style.kp")}</span>
          </div>
        )}
      </Reveal>
      {highlights.length > 0 && (
        <Reveal i={2} className={styles.chips}>
          {highlights.slice(0, 4).map((h) => (
            <span key={h.key} className={styles.chip}>
              {t.rich(`recap.style.${h.key}`, { count: h.count, ...boldTags })}
            </span>
          ))}
        </Reveal>
      )}
      {recap.longestGame && (
        <Reveal i={3} as="p" className={styles.caption}>
          {t(recap.longestGame.win ? "recap.style.longestWon" : "recap.style.longestLost", {
            duration: formatDuration(recap.longestGame.seconds, t),
            champion: championName(index, recap.longestGame.champion),
          })}
        </Reveal>
      )}
    </Slide>
  );
}

/** ARAM and normal-game slides: same layout, with copy that compares against the Rift and ranked numbers. */
export function ModeSlide({ mode, stats, rift, ranked, index, art, t = defaultT }) {
  const top = stats.topChampions[0];
  const topName = championName(index, top.id);

  return (
    <Slide art={art}>
      <Reveal i={0} className={styles.eyebrow}>
        {t(`recap.mode.${mode}.eyebrow`)}
      </Reveal>
      <Reveal i={1} className={styles.mega}>
        <CountUp value={stats.games} />
      </Reveal>
      <Reveal i={2} className={styles.megaLabel}>
        {t(`recap.mode.${mode}.label`, { count: stats.games })}
      </Reveal>
      <Reveal i={3} className={styles.chips}>
        <span className={styles.chip}>{t.rich("recap.recordChip", { wins: stats.wins, losses: stats.losses, ...boldTags })}</span>
        <span className={styles.chip}>{t.rich("recap.winRateChip", { rate: t.percent(stats.winRate), ...boldTags })}</span>
        <span className={styles.chip}>{t.rich("recap.kdaChip", { kda: t.fixed(stats.kda, 2), ...boldTags })}</span>
      </Reveal>
      <Reveal i={4} as="p" className={styles.caption}>
        {getModeInsight(mode, stats, { rift, ranked, topName }, t)}
      </Reveal>
      <Reveal i={5} className={styles.runners}>
        {stats.topChampions.slice(0, 3).map((c) => (
          <div key={c.id} className={styles.runner}>
            <ChampionIcon index={index} id={c.id} />
            <span>{championName(index, c.id)}</span>
            <small>{t("recap.gamesLabel", { count: c.games })}</small>
          </div>
        ))}
      </Reveal>
    </Slide>
  );
}

export function RankSlide({ rank, t = defaultT }) {
  return (
    <Slide accent={rank.color}>
      <Reveal i={0} className={styles.eyebrow}>
        {rank.queueLabel}
      </Reveal>
      <Reveal i={1} className={styles.emblemWrap}>
        <Image src={rank.emblem} alt={t("recap.rank.emblem", { title: rank.title })} width={500} height={500} sizes="(max-width: 640px) 60vw, 320px" className={styles.emblem} />
      </Reveal>
      {/* One line, sized to fit: the small division numeral counts as roughly half a letter each. */}
      <Reveal
        i={2}
        className={`${styles.mega} ${styles.tier}`}
        style={{ "--chars": rank.tierName.length + (rank.division ? 0.6 + rank.division.length * 0.5 : 0) }}
      >
        {rank.tierName}
        {rank.division && <span className={styles.division}>{rank.division}</span>}
      </Reveal>
      <Reveal i={3} className={styles.chips}>
        <span className={styles.chip}>{t.rich("recap.rank.lp", { lp: rank.lp, ...boldTags })}</span>
        <span className={styles.chip}>{t.rich("recap.recordChip", { wins: rank.wins, losses: rank.losses, ...boldTags })}</span>
        <span className={styles.chip}>{t.rich("recap.winRateChip", { rate: t.percent(rank.winRate), ...boldTags })}</span>
      </Reveal>
      <Reveal i={4} as="p" className={styles.caption}>
        {t("recap.rank.caption")}
      </Reveal>
    </Slide>
  );
}

// Embers thrown outward when the archetype lands: fixed angles and distances, so the reveal looks the same every time.
const EMBERS = Array.from({ length: 16 }, (_, n) => ({
  angle: n * 22.5 + (n % 2 ? 7 : -5),
  distance: 9 + (n % 4) * 3.2,
  size: 3 + (n % 3) * 2,
  delay: (n % 5) * 0.04,
}));

/**
 * The archetype name, revealed letter by letter out of a blur, with a shockwave, a flash and embers. Decorative parts are aria-hidden.
 * Arabic joins its letters, so pulling them apart would spell the name wrong: there each word appears as one piece.
 */
export function PersonaTitle({ title, locale = "en" }) {
  const words = title.split(" ");
  const pieces = (word) => (locale === "ar" ? [word] : graphemes(word, locale));
  let n = 0;
  return (
    <div className={styles.stage} style={fitTo(title)}>
      <div className={styles.burst} aria-hidden="true">
        <span className={styles.rays} />
        <span className={styles.flash} />
        <span className={styles.shockwave} />
        <span className={`${styles.shockwave} ${styles.ringLate}`} />
        {EMBERS.map((ember, i) => (
          <span
            key={i}
            className={styles.ember}
            style={{ "--a": `${ember.angle}deg`, "--d": `${ember.distance}rem`, "--s": `${ember.size}px`, "--w": `${ember.delay}s` }}
          />
        ))}
      </div>
      <h2 className={styles.persona} aria-label={title}>
        {words.map((word, w) => (
          <Fragment key={w}>
            <span className={styles.word} aria-hidden="true">
              {pieces(word).map((letter) => (
                <span key={n} className={styles.letter} style={{ "--n": n++ }}>
                  {letter}
                </span>
              ))}
            </span>
            {/* Outside the inline-block, where the space cannot collapse. */}
            {w < words.length - 1 ? " " : ""}
          </Fragment>
        ))}
      </h2>
      <span className={styles.flare} aria-hidden="true" />
    </div>
  );
}

export function PersonaSlide({ persona, recap, index, art, share, links, snapshot, t = defaultT }) {
  const top = recap.topChampions[0];
  return (
    <Slide art={art} strength="hero" accent={persona.accent}>
      <Reveal i={0} className={styles.eyebrow}>
        {t("recap.persona.eyebrow")}
      </Reveal>
      <PersonaTitle title={persona.title} locale={t.locale} />
      <Reveal i={2} as="p" className={styles.epithet}>
        {persona.tagline}
      </Reveal>
      <Reveal i={3} as="p" className={styles.caption}>
        {persona.description}
      </Reveal>
      <Reveal i={4} className={styles.chips}>
        {persona.rarity && (
          <span className={styles.chip} style={{ borderColor: persona.rarity.color }}>
            {t.rich("persona.rarity.chip", {
              tier: persona.rarity.tier,
              share: rarityShareText(persona.rarity, t),
              b: (chunks) => <b style={{ color: persona.rarity.color }}>{chunks}</b>,
            })}
          </span>
        )}
        <span className={styles.chip}>{t.rich("recap.gamesChip", { count: recap.games, ...boldTags })}</span>
        <span className={styles.chip}>{t.rich("recap.winRateChip", { rate: t.percent(recap.winRate), ...boldTags })}</span>
        <span className={styles.chip}>{t.rich("recap.persona.main", { champion: championName(index, top.id), ...boldTags })}</span>
      </Reveal>
      {persona.alsoAn.length > 0 && (
        <Reveal i={5} as="p" className={styles.also}>
          {t("recap.persona.also", { list: t.list(persona.alsoAn) })}
        </Reveal>
      )}
      {share && (
        <Reveal i={6}>
          <ShareButtons cardUrl={share.cardUrl} title={t("recap.persona.shareTitle", { title: persona.title })} />
        </Reveal>
      )}
      {(links || snapshot) && (
        <Reveal i={7} className={styles.finaleLinks}>
          {snapshot && <SaveSnapshot snapshot={snapshot} className={styles.smallLink} />}
          {links && (
            <>
              <Link href={links.compare} className={styles.smallLink}>
                {t("recap.persona.compare")}
              </Link>
              <Link href={links.squad} className={styles.smallLink}>
                {t("recap.persona.squad")}
              </Link>
            </>
          )}
        </Reveal>
      )}
      <Reveal i={8} className={styles.actions}>
        <Link href="/" className={styles.button}>
          {t("recap.persona.search")}
        </Link>
      </Reveal>
      <Reveal i={9} as="p" className={styles.fineprint}>
        {t(persona.rarity ? "recap.persona.countEstimate" : "recap.persona.count", { count: PERSONA_COUNT })}
      </Reveal>
      <PersonaSound persona={persona.id} />
    </Slide>
  );
}
