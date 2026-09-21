/* eslint-disable @next/next/no-img-element -- Satori (ImageResponse) draws plain <img> elements; next/image does not apply here. */
import { ImageResponse } from "next/og";
import { rarityShareText } from "@/lib/recap/persona";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extraFonts, stack } from "./fonts";

// Satori (behind ImageResponse) needs the font files. They don't depend on the request, so read them once.
const fontDir = join(process.cwd(), "assets", "fonts");
const [cinzel, interRegular, interSemiBold, interBold] = await Promise.all(
  ["cinzel-latin-800-normal.woff", "inter-latin-400-normal.woff", "inter-latin-600-normal.woff", "inter-latin-700-normal.woff"].map((file) =>
    readFile(join(fontDir, file)),
  ),
);

const FONTS = [
  { name: "Cinzel", data: cinzel, weight: 800, style: "normal" },
  { name: "Inter", data: interRegular, weight: 400, style: "normal" },
  { name: "Inter", data: interSemiBold, weight: 600, style: "normal" },
  { name: "Inter", data: interBold, weight: 700, style: "normal" },
];

export const CARD_SIZES = {
  story: { width: 1080, height: 1920 }, // phone stories and downloads
  og: { width: 1200, height: 630 }, // link previews
};

const GOLD = "#c8aa6e";
const GOLD_BRIGHT = "#f0d9a0";
const TEAL = "#0ac8b9";
const MUTED = "#a09b8c";
const INK = "#050b18";
// Uppercase in the reader's language ("i" becomes "İ" in Turkish), and never letter-spaced in Arabic, which joins its letters.
const up = (t, text) => text.toLocaleUpperCase(t.locale);
const ls = (t, spacing) => (t.locale === "ar" ? 0 : spacing);
const pct = (t, x) => t.percent(x);

// Cinzel capitals average roughly 0.86em per letter: size the title so its longest word fits the width.
function titleSize(title, width, max) {
  const longest = Math.max(...title.split(" ").map((word) => word.length));
  return Math.min(max, Math.floor(width / (longest * 0.86)));
}

// The rarity tier as a pill ("RARE · ABOUT 1% OF PLAYERS"), coloured by tier. `rarity` is from `getPersona`.
function RarityBadge({ rarity, compact, t }) {
  if (!rarity) return null;
  const text = up(t, t("persona.rarity.badge", { tier: rarity.tier, share: rarityShareText(rarity, t) }));
  return (
    <div style={flex({ alignSelf: "flex-start", padding: compact ? "6px 16px" : "10px 26px", border: `${compact ? 2 : 3}px solid ${rarity.color}`, borderRadius: 999, background: "rgba(5,11,24,0.78)", fontSize: compact ? 15 : 24, fontWeight: 700, letterSpacing: ls(t, compact ? 3 : 5), color: rarity.color })}>
      {text}
    </div>
  );
}

const flex = (extra = {}) => ({ display: "flex", ...extra });

function Stat({ value, label, compact, t }) {
  return (
    <div
      style={flex({
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        padding: compact ? "16px 8px" : "28px 12px",
        border: "2px solid rgba(200,170,110,0.4)",
        borderRadius: compact ? 18 : 26,
        background: "rgba(8,16,34,0.78)",
      })}
    >
      <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: compact ? 40 : 66, color: GOLD_BRIGHT })}>{value}</div>
      <div style={flex({ fontSize: compact ? 15 : 22, fontWeight: 600, letterSpacing: ls(t, compact ? 3 : 5), color: MUTED, marginTop: 4 })}>
        {up(t, label)}
      </div>
    </div>
  );
}

function Header({ season, compact, t }) {
  return (
    <div style={flex({ alignItems: "center", justifyContent: "space-between" })}>
      <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: compact ? 26 : 38, letterSpacing: compact ? 6 : 9, color: GOLD_BRIGHT })}>RIFT RECAP</div>
      <div
        style={flex({
          padding: compact ? "6px 16px" : "8px 22px",
          border: `2px solid ${TEAL}`,
          borderRadius: 999,
          fontSize: compact ? 15 : 24,
          fontWeight: 600,
          letterSpacing: ls(t, compact ? 4 : 6),
          color: TEAL,
          background: "rgba(5,11,24,0.7)",
        })}
      >
        {up(t, season)}
      </div>
    </div>
  );
}

function PlayerLine({ name, tag, size }) {
  return (
    <div style={flex({ alignItems: "baseline", maxWidth: "100%" })}>
      <div style={flex({ fontSize: size, fontWeight: 700, color: "#f0e6d2", textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)", maxWidth: "70%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" })}>{name}</div>
      <div style={flex({ fontSize: Math.round(size * 0.62), fontWeight: 600, color: "#c9c3b3", textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)", marginLeft: 12 })}>{`#${tag}`}</div>
    </div>
  );
}

function StoryCard(d) {
  const { t } = d;
  const title = up(t, d.persona.title);
  return (
    <div style={flex({ position: "relative", width: 1080, height: 1920, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      <img alt="" src={d.art} width={1080} height={1240} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover", objectPosition: "62% 22%" }} />
      <div
        style={flex({
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: 1500,
          background: `linear-gradient(to bottom, rgba(5,11,24,0.4) 0%, rgba(5,11,24,0) 30%, rgba(5,11,24,0.72) 52%, ${INK} 70%)`,
        })}
      />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, flexDirection: "column", padding: "84px 84px 72px" })}>
        <Header season={d.season} t={t} />
        <div style={flex({ flex: 1 })} />

        <div style={flex({ flexDirection: "column" })}>
          <PlayerLine name={d.name} tag={d.tag} size={54} />
          <div style={flex({ marginTop: 34, fontSize: 28, fontWeight: 600, letterSpacing: ls(t, 10), color: TEAL, textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)" })}>{up(t, t("cards.thisSeason"))}</div>
          <div
            style={flex({
              marginTop: 14,
              fontFamily: stack("Cinzel"),
              fontWeight: 800,
              fontSize: titleSize(title, 912, 138),
              lineHeight: 1.02,
              color: "#ffffff",
              textShadow: "0 6px 40px rgba(0,0,0,0.85)",
            })}
          >
            {title}
          </div>
          <div style={flex({ width: 170, height: 8, marginTop: 26, borderRadius: 4, background: d.persona.accent })} />
          <div style={flex({ marginTop: 22 })}>
            <RarityBadge rarity={d.persona.rarity} t={t} />
          </div>
          <div style={flex({ marginTop: 26, fontSize: 40, fontWeight: 600, color: GOLD_BRIGHT, textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)" })}>{d.persona.tagline}</div>
          <div style={flex({ marginTop: 18, fontSize: 32, lineHeight: 1.45, color: "#ded8c8", textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)" })}>{d.persona.description}</div>

          <div style={flex({ marginTop: 44, gap: 20 })}>
            <Stat value={t.number(d.recap.games)} label={t("cards.games")} t={t} />
            <Stat value={pct(t, d.recap.winRate)} label={t("cards.winRate")} t={t} />
            <Stat value={t.fixed(d.recap.kda, 2)} label={t("cards.kda")} t={t} />
          </div>

          {d.trophies && d.trophies.unlocked > 0 && (
            <div style={flex({ marginTop: 22, alignItems: "center", gap: 16, fontSize: 24, fontWeight: 600, color: MUTED })}>
              <div style={flex({ fontWeight: 700, letterSpacing: ls(t, 5), color: TEAL })}>{up(t, t("cards.trophies"))}</div>
              <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 32, color: GOLD_BRIGHT })}>{`${d.trophies.unlocked}/${d.trophies.total}`}</div>
              <div style={flex({ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", color: "#ded8c8" })}>{d.trophies.names.join(" · ")}</div>
            </div>
          )}

          <div style={flex({ marginTop: 22, alignItems: "center", justifyContent: "space-between", padding: "18px 30px", border: "2px solid rgba(200,170,110,0.4)", borderRadius: 26, background: "rgba(8,16,34,0.78)" })}>
            <div style={flex({ alignItems: "center", gap: 18 })}>
              {d.rank && <img alt="" src={d.rank.emblem} width={96} height={96} />}
              <div style={flex({ flexDirection: "column" })}>
                <div style={flex({ fontSize: 22, fontWeight: 600, letterSpacing: ls(t, 5), color: MUTED })}>{up(t, t(d.rank ? "cards.rank" : "cards.main"))}</div>
                <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 44, color: d.rank ? d.rank.color : GOLD_BRIGHT })}>{d.rank ? d.rank.title : d.topName}</div>
              </div>
            </div>
            <div style={flex({ flexDirection: "column", alignItems: "flex-end" })}>
              <div style={flex({ fontSize: 22, fontWeight: 600, letterSpacing: ls(t, 5), color: MUTED })}>{up(t, t(d.rank ? "cards.main" : "cards.topChampion"))}</div>
              <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 44, color: GOLD_BRIGHT })}>{d.rank ? d.topName : t("cards.gamesCount", { count: d.recap.topChampions[0].games })}</div>
            </div>
          </div>
        </div>

        <div style={flex({ flexDirection: "column", marginTop: 48 })}>
          <div style={flex({ fontSize: 30, fontWeight: 700, color: GOLD })}>{d.host}</div>
          <div style={flex({ marginTop: 10, fontSize: 17, lineHeight: 1.4, color: "rgba(160,155,140,0.7)" })}>{t("cards.disclaimer")}</div>
        </div>
      </div>
    </div>
  );
}

function OgCard(d) {
  const { t } = d;
  const title = up(t, d.persona.title);
  return (
    <div style={flex({ position: "relative", width: 1200, height: 630, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      <img alt="" src={d.art} width={800} height={630} style={{ position: "absolute", top: 0, right: 0, objectFit: "cover", objectPosition: "60% 20%" }} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1200, height: 630, background: `linear-gradient(to right, ${INK} 0%, ${INK} 40%, rgba(5,11,24,0.55) 62%, rgba(5,11,24,0.1) 100%)` })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 700, height: 630, flexDirection: "column", justifyContent: "space-between", padding: "44px 0 40px 56px" })}>
        <div style={flex({ width: 590, flexDirection: "column" })}>
          <Header season={d.season} compact t={t} />
        </div>
        <div style={flex({ flexDirection: "column", width: 620 })}>
          <PlayerLine name={d.name} tag={d.tag} size={34} />
          <div style={flex({ marginTop: 18, fontSize: 18, fontWeight: 600, letterSpacing: ls(t, 6), color: TEAL })}>{up(t, t("cards.thisSeason"))}</div>
          <div style={flex({ marginTop: 8, fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: titleSize(title, 620, 92), lineHeight: 1.02, color: "#ffffff", textShadow: "0 4px 30px rgba(0,0,0,0.85)" })}>{title}</div>
          <div style={flex({ width: 110, height: 6, marginTop: 16, borderRadius: 3, background: d.persona.accent })} />
          <div style={flex({ marginTop: 14 })}>
            <RarityBadge rarity={d.persona.rarity} compact t={t} />
          </div>
          <div style={flex({ marginTop: 14, fontSize: 26, fontWeight: 600, color: GOLD_BRIGHT })}>{d.persona.tagline}</div>
        </div>
        <div style={flex({ width: 590, gap: 14 })}>
          <Stat value={t.number(d.recap.games)} label={t("cards.games")} compact t={t} />
          <Stat value={pct(t, d.recap.winRate)} label={t("cards.winRate")} compact t={t} />
          <Stat value={t.fixed(d.recap.kda, 2)} label={t("cards.kda")} compact t={t} />
        </div>
      </div>
    </div>
  );
}

/**
 * Draws a share card. `data`: `{ name, tag, season, host, persona, recap, rank, topName, trophies, art }`, where
 * `art` is a splash URL, `persona` is from `getPersona`, and `rank` is from `pickRank` (or null).
 */
/**
 * Draws a card into a finished response. `ImageResponse` draws lazily, while its body is being sent, so a drawing error would
 * surface after the response had started and just cut the connection. Drawing it here, inside the caller's try/catch, turns
 * that into an error the caller can handle (and retry in English).
 */
export async function drawCard(element, options) {
  const image = new ImageResponse(element, options);
  const body = await image.arrayBuffer();
  return new Response(body, { status: 200, headers: image.headers });
}

export async function renderCard(format, data) {
  const size = CARD_SIZES[format] ?? CARD_SIZES.story;
  const fonts = await cardFonts(data.t, data);
  return drawCard(format === "og" ? <OgCard {...data} /> : <StoryCard {...data} />, {
    ...size,
    fonts,
    // Cards are cheap to keep: the recap behind them changes slowly.
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}

/** The fonts for a card: the bundled Latin ones, plus the glyphs of the reader's script when it isn't English. */
export async function cardFonts(t, data) {
  const text = JSON.stringify(data, (key, value) => (key === "t" ? undefined : value));
  return [...FONTS, ...(await extraFonts(t.locale, text))];
}

// Building blocks shared with the squad and head-to-head cards (socialCards.js).
export { GOLD, GOLD_BRIGHT, Header, INK, MUTED, Stat, TEAL, flex, ls, up };
