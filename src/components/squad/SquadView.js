import Background from "@/components/Background";
import Story from "@/components/recap/Story";
import { defaultT } from "@/lib/i18n/en";
import { profileIconUrl } from "@/lib/riot/ddragon";
import { pickSplashes } from "@/lib/riot/skins";
import { buildSquadStats } from "@/lib/squad/build";
import { bestCombos } from "@/lib/squad/combos";
import { getLineup } from "@/lib/squad/lineup";
import { buildQuiz } from "@/lib/squad/quiz";
import { buildRivalries } from "@/lib/squad/rivalry";
import SquadQuiz from "./SquadQuiz";
import { AwardSlide, SquadBoardSlide, SquadFinaleSlide, SquadIntroSlide, SquadCombosSlide, SquadPairsSlide, SquadRecordSlide, SquadRivalrySlide, SquadRolesSlide } from "./squadSlides";

/**
 * The squad story. `data` is `{ region, members, matches, sharedFound }` (from `loadSquad` or the demo) with at
 * least one shared game. `share` is `{ cardUrl }` for the share buttons. `t` writes every word of it.
 */
export default async function SquadView({ data, index, share, ranges, t = defaultT }) {
  const stats = buildSquadStats(data.matches, data.members, t);
  // Members who never shared a game with anyone else can't appear on any slide.
  const present = stats.members.filter((m) => m.games > 0);
  const seed = data.members.map((m) => `${m.gameName}#${m.tagLine}`).join("|");
  const [intro, finale, record] = stats.squad.topChampion ? await pickSplashes(index, stats.squad.topChampion, { count: 3, seed }) : [];

  const version = index.version;
  const rivalries = buildRivalries(data.matches, data.members);
  const quiz = buildQuiz(stats.awards, stats.members);
  const combos = present.length >= 3 ? bestCombos(data.matches, data.members) : null;
  const lineup = getLineup(stats.members);
  const top = stats.pairs[0];
  const matchup = top ? [stats.members[top.a], stats.members[top.b]] : null;

  const slides = [
    [t("squad.rail.start"), <SquadIntroSlide t={t} key="intro" squad={stats.squad} members={present} version={version} art={intro} loaded={data.matches.length} sharedFound={data.sharedFound} ranges={ranges} />],
    [t("squad.rail.record"), <SquadRecordSlide t={t} key="record" squad={stats.squad} memberCount={present.length} art={record ?? intro} />],
    present.length >= 3 && stats.bestPair && [t("squad.rail.duos"), <SquadPairsSlide t={t} key="pairs" best={stats.bestPair} worst={stats.worstPair} members={stats.members} version={version} />],
    lineup && [t("squad.rail.roles"), <SquadRolesSlide t={t} key="roles" lineup={lineup} members={stats.members} version={version} />],
    combos?.pick && [t("squad.rail.queue"), <SquadCombosSlide t={t} key="combos" combos={combos} members={stats.members} version={version} />],
    rivalries.total > 0 && [t("squad.rail.rivals"), <SquadRivalrySlide t={t} key="rivals" rivalries={rivalries} members={stats.members} version={version} />],
    ...stats.awards.map((award, i) => [
      award.title,
      <AwardSlide t={t} key={award.id} award={award} members={stats.members} version={version} position={i + 1} total={stats.awards.length} />,
    ]),
    quiz && [t("squad.rail.quiz"), <SquadQuiz key="quiz" quiz={{ ...quiz, players: quiz.players.map((p) => ({ ...p, iconUrl: profileIconUrl(version, p.profileIcon) })) }} />],
    [t("squad.rail.board"), <SquadBoardSlide t={t} key="board" members={stats.members} awardCounts={stats.awardCounts} version={version} />],
    [t("squad.rail.mvp"), <SquadFinaleSlide t={t} key="finale" members={stats.members} mvp={stats.mvp} awardCounts={stats.awardCounts} version={version} region={data.region} share={share} art={finale} matchup={matchup} />],
  ].filter(Boolean);

  return (
    <>
      <Background showChampions={false} />
      {/* Reveal animations start hidden and are triggered by JS; without it, show everything. */}
      <noscript>
        <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <Story labels={slides.map(([label]) => label)} ids={slides.map(([, slide]) => slide.key)}>{slides.map(([, slide]) => slide)}</Story>
    </>
  );
}
