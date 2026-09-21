import Image from "next/image";
import Link from "next/link";
import { defaultT } from "@/lib/i18n/en";
import { championName, championVoice, profileIconUrl } from "@/lib/riot/ddragon";
import CountUp from "./CountUp";
import Slide, { Reveal } from "./Slide";
import { boldTags, fitTo } from "./slides";
import VoiceLine from "./VoiceLine";
import base from "./slides.module.css";
import styles from "./socialSlides.module.css";

function Avatar({ src, name }) {
  return src ? (
    <Image src={src} alt="" width={96} height={96} unoptimized className={styles.avatarImg} />
  ) : (
    <span className={styles.avatarFallback}>{name.charAt(0).toUpperCase()}</span>
  );
}

function duoInsight(duo, t) {
  const name = duo.gameName;
  if (duo.soloWinRate == null) return t("recap.social.duo.alone", { name });
  const gap = duo.winRate - duo.soloWinRate;
  const values = { name, withRate: t.percent(duo.winRate), without: t.percent(duo.soloWinRate) };
  if (gap >= 0.08) return t("recap.social.duo.better", values);
  if (gap <= -0.08) return t("recap.social.duo.worse", values);
  return t("recap.social.duo.same", { name });
}

/** Your most frequent teammate, if you have one. `profileHref` links to their recap (omitted in the demo). */
export function DuoSlide({ duo, account, summoner, index, art, profileHref, versusHref, t = defaultT }) {
  const you = profileIconUrl(index.version, summoner?.profileIconId);
  const them = profileIconUrl(index.version, duo.profileIcon);
  const pair = duo.bestPair.you && duo.bestPair.them ? `${championName(index, duo.bestPair.you)} + ${championName(index, duo.bestPair.them)}` : null;

  return (
    <Slide art={art}>
      <Reveal i={0} className={base.eyebrow}>
        {t("recap.social.duo.eyebrow")}
      </Reveal>
      <Reveal i={1} className={styles.pair}>
        <Avatar src={you} name={account.gameName} />
        <span className={styles.link} aria-hidden="true" />
        <Avatar src={them} name={duo.gameName} />
      </Reveal>
      <Reveal i={2} as="h2" className={base.name} style={fitTo(duo.gameName)} dir="ltr">
        {duo.gameName}
        {duo.tagLine && <span className={base.tag}>#{duo.tagLine}</span>}
      </Reveal>
      <Reveal i={3} className={styles.together}>
        <span className={base.big}>
          <CountUp value={duo.games} />
        </span>
        <span className={base.megaLabel}>{t("recap.social.duo.together", { count: duo.games })}</span>
      </Reveal>
      <Reveal i={4} className={base.chips}>
        <span className={base.chip}>
          {t.rich("recap.social.duo.winTogether", { rate: t.percent(duo.winRate), b: (chunks) => <b className={duo.winRate >= 0.5 ? base.good : base.bad}>{chunks}</b> })}
        </span>
        {duo.soloWinRate != null && <span className={base.chip}>{t.rich("recap.social.duo.apart", { rate: t.percent(duo.soloWinRate), ...boldTags })}</span>}
        {pair && <span className={base.chip}>{t.rich("recap.social.duo.combo", { pair, ...boldTags })}</span>}
      </Reveal>
      <Reveal i={5} as="p" className={base.caption}>
        {duoInsight(duo, t)}
      </Reveal>
      {profileHref && (
        <Reveal i={6} className={base.actions}>
          <Link href={profileHref} className={styles.ghost}>
            {t("recap.social.duo.seeRecap", { name: duo.gameName })}
          </Link>
          {versusHref && (
            <Link href={versusHref} className={styles.ghost}>
              {t("recap.social.duo.versus")}
            </Link>
          )}
        </Reveal>
      )}
    </Slide>
  );
}

function MatchupCard({ kind, label, matchup, art, index, t }) {
  const name = championName(index, matchup.id);
  const rate = t.percent(matchup.winRate);
  return (
    <div className={`${styles.card} ${styles[kind]}`}>
      {art && <Image src={art.url} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" quality={90} className={styles.cardImg} />}
      <div className={styles.cardShade} />
      <div className="grain" />
      <div className={styles.cardBody}>
        <span className={styles.cardLabel}>{label}</span>
        <h3 className={styles.cardName} style={fitTo(name)}>
          {name}
        </h3>
        <span className={styles.record}>{t.rich("recap.social.matchup.record", { wins: matchup.wins, losses: matchup.losses, ...boldTags })}</span>
        <span className={styles.cardMeta}>
          {matchup.yourChampion ? t("recap.social.matchup.metaAs", { rate, champion: championName(index, matchup.yourChampion) }) : t("recap.social.matchup.meta", { rate })}
        </span>
      </div>
    </div>
  );
}

function matchupInsight(nemesis, best, index, t) {
  if (nemesis && best) return t("recap.social.matchup.insightBoth", { nemesis: championName(index, nemesis.id), best: championName(index, best.id) });
  if (nemesis) return t("recap.social.matchup.insightNemesis", { nemesis: championName(index, nemesis.id) });
  return t("recap.social.matchup.insightBest", { best: championName(index, best.id) });
}

/** Lane opponent that beats you most, next to the one you beat most. Either side may be missing. */
export function MatchupSlide({ nemesis, bestMatchup, index, art, t = defaultT }) {
  const single = !nemesis || !bestMatchup;
  // The champion that keeps beating you says the line they say when they are banned, when sound is on.
  const ban = nemesis ? championVoice(index, nemesis.id, t.locale, "ban") : null;
  return (
    <Slide>
      {ban && <VoiceLine src={ban.src} fallback={ban.fallback} />}
      <Reveal i={0} className={base.eyebrow}>
        {t(single ? "recap.social.matchup.single" : "recap.social.matchup.both")}
      </Reveal>
      <Reveal i={1} className={`${styles.versus} ${single ? styles.single : ""}`}>
        {nemesis && <MatchupCard kind="nemesis" label={t("recap.social.matchup.nemesis")} matchup={nemesis} art={art.nemesis} index={index} t={t} />}
        {!single && (
          <span className={styles.vs} aria-hidden="true">
            {t("recap.social.matchup.vs")}
          </span>
        )}
        {bestMatchup && <MatchupCard kind="best" label={t("recap.social.matchup.best")} matchup={bestMatchup} art={art.bestMatchup} index={index} t={t} />}
      </Reveal>
      <Reveal i={2} as="p" className={base.caption}>
        {matchupInsight(nemesis, bestMatchup, index, t)}
      </Reveal>
    </Slide>
  );
}
