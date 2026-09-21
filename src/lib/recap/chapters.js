import { defaultT } from "@/lib/i18n/en";
import { buildRecap } from "./buildRecap";
import { getPersona } from "./persona";

// Your season in chapters: the archetype for each stretch of it, so you can see how you changed. The games are split by
// month (small months are merged into a neighbour), or into equal parts when everything falls in one or two months.

const MIN_CHAPTER_GAMES = 15; // an archetype over fewer games than this is mostly noise
const MAX_CHAPTERS = 4;
const MIN_TOTAL_GAMES = MIN_CHAPTER_GAMES * 2;

const monthKey = (t) => {
  const d = new Date(t);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};

/** Splits time-ordered games into chunks: one per month, small ones merged forward, else equal parts. */
export function chunkGames(games, t = defaultT) {
  const byMonth = [];
  for (const game of games) {
    const key = monthKey(game.info.gameCreation);
    if (byMonth.at(-1)?.key === key) byMonth.at(-1).games.push(game);
    else byMonth.push({ key, games: [game] });
  }

  // Merge a small month into the next one (or the previous one, for the last month).
  const merged = [];
  for (const month of byMonth) {
    const last = merged.at(-1);
    if (last && last.games.length < MIN_CHAPTER_GAMES) {
      last.games.push(...month.games);
      last.end = month.key;
    } else merged.push({ start: month.key, end: month.key, games: [...month.games] });
  }
  if (merged.length > 1 && merged.at(-1).games.length < MIN_CHAPTER_GAMES) {
    const tail = merged.pop();
    merged.at(-1).games.push(...tail.games);
    merged.at(-1).end = tail.end;
  }
  if (merged.length >= 2) return merged.slice(-MAX_CHAPTERS);

  // Everything landed in about one month: cut it into equal parts instead.
  const parts = Math.min(MAX_CHAPTERS, Math.floor(games.length / MIN_CHAPTER_GAMES));
  if (parts < 2) return [];
  const size = Math.ceil(games.length / parts);
  return Array.from({ length: parts }, (_, i) => ({ start: null, end: null, games: games.slice(i * size, (i + 1) * size), label: t("insights.chapters.part", { n: i + 1 }) }));
}

/**
 * @param matches match-v5 DTOs (any mix; only Summoner's Rift games are used, like the main recap)
 * @param puuid the player
 * @param names `{ nameOf(id), tagsOf(id) }` for champion display names and Data Dragon tags
 * @returns null with too few games; otherwise `[{ label, games, winRate, persona: { id, title, accent } }]`, oldest first
 */
export function getPersonaChapters(matches, puuid, { nameOf, tagsOf }, t = defaultT) {
  const rift = matches
    .filter((m) => m.info?.gameMode === "CLASSIC" && m.info.gameDuration >= 300 && m.info.participants.some((p) => p.puuid === puuid))
    .sort((a, b) => a.info.gameCreation - b.info.gameCreation);
  if (rift.length < MIN_TOTAL_GAMES) return null;

  const chunks = chunkGames(rift, t);
  if (chunks.length < 2) return null;

  const chapters = chunks.map((chunk) => {
    const recap = buildRecap(chunk.games, puuid);
    const [first, second] = recap.champions;
    const persona = getPersona(recap, { topName: nameOf(first.id), secondName: second ? nameOf(second.id) : undefined, tagsOf }, t);
    const month = (game) => t.date(game.info.gameCreation, { month: "short", timeZone: "UTC" });
    const [from, to] = [month(chunk.games[0]), month(chunk.games.at(-1))];
    const label = chunk.label ?? (chunk.start === chunk.end ? from : t("insights.chapters.range", { from, to }));
    return { label, games: recap.games, winRate: recap.winRate, persona: { id: persona.id, title: persona.title, accent: persona.accent } };
  });
  return chapters;
}

/** One line on the story the chapters tell. */
export function chaptersLine(chapters, t = defaultT) {
  const titles = chapters.map((c) => c.persona.id);
  if (new Set(titles).size === 1) return t("insights.chapters.same", { title: chapters[0].persona.title });
  const [first, last] = [chapters[0], chapters.at(-1)];
  return t("insights.chapters.changed", { first: first.persona.title, last: last.persona.title });
}
