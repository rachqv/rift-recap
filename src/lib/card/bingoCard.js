import { cardFonts, CARD_SIZES, drawCard, GOLD, GOLD_BRIGHT, Header, INK, MUTED, Stat, TEAL, flex, ls, up } from "./renderCard";
import { stack } from "./fonts";

// The trophy bingo card: the 5x5 board on the tall story canvas. Text only, since Satori has no emoji font here, so the
// squares carry trophy names instead of their icons.

const CELL = 170;
const GAP = 15;
const SHADOW = "0 2px 12px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)";

// A check mark and a star, as SVG (Satori draws those; it has no glyphs to spare).
const CHECK = "M6 12.5l4 4 8-9";
const STAR = "M12 1.5l3.2 6.9 7.5.9-5.5 5.2 1.5 7.4L12 18.1l-6.7 3.8 1.5-7.4L1.3 9.3l7.5-.9z";

function Square({ cell, labels, t }) {
  const border = cell.inLine ? `4px solid ${TEAL}` : cell.unlocked || cell.free ? `3px solid ${GOLD}` : "2px solid rgba(160,155,140,0.25)";
  const lit = cell.unlocked || cell.free;
  return (
    <div
      style={flex({
        position: "relative",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: CELL,
        height: CELL,
        padding: "12px 10px",
        border,
        borderRadius: 22,
        background: lit ? "linear-gradient(160deg, rgba(74,60,22,0.95), rgba(20,16,8,0.95))" : "rgba(8,16,34,0.72)",
        boxShadow: cell.inLine ? "0 0 26px rgba(10,200,185,0.55)" : lit ? "0 0 22px rgba(240,217,160,0.28)" : "none",
      })}
    >
      {cell.free ? (
        <div style={flex({ flexDirection: "column", alignItems: "center", gap: 10 })}>
          <svg width="46" height="46" viewBox="0 0 24 24">
            <path d={STAR} fill={GOLD_BRIGHT} />
          </svg>
          <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 28, letterSpacing: ls(t, 3), color: GOLD_BRIGHT })}>{up(t, labels.free)}</div>
        </div>
      ) : (
        <div style={flex({ flexDirection: "column", alignItems: "center", width: "100%" })}>
          {cell.unlocked && (
            <svg width="30" height="30" viewBox="0 0 24 24" style={{ marginBottom: 8 }}>
              <circle cx="12" cy="12" r="12" fill={GOLD} />
              <path d={CHECK} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <div
            style={flex({
              width: "100%",
              maxHeight: 88,
              overflow: "hidden",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1.15,
              color: cell.unlocked ? "#f6ecd0" : MUTED,
            })}
          >
            {cell.name}
          </div>
          {!cell.unlocked && (
            <div style={flex({ width: "80%", height: 7, marginTop: 12, borderRadius: 4, background: "rgba(255,255,255,0.12)" })}>
              <div style={flex({ width: `${Math.round(cell.progress * 100)}%`, height: 7, borderRadius: 4, background: GOLD })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BingoStory(d) {
  const { t, labels, bingo } = d;
  const rows = Array.from({ length: bingo.size }, (_, row) => bingo.cells.slice(row * bingo.size, (row + 1) * bingo.size));
  return (
    <div style={flex({ position: "relative", width: 1080, height: 1920, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, background: "linear-gradient(to bottom, rgba(24,36,72,0.9) 0%, rgba(5,11,24,0) 45%, rgba(40,32,12,0.5) 100%)" })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, flexDirection: "column", padding: "84px 84px 72px" })}>
        <Header season={d.season} t={t} />

        <div style={flex({ flexDirection: "column", marginTop: 64 })}>
          <div style={flex({ alignItems: "baseline", maxWidth: "100%" })}>
            <div style={flex({ fontSize: 54, fontWeight: 700, color: "#f0e6d2", textShadow: SHADOW, maxWidth: "70%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" })}>{d.name}</div>
            <div style={flex({ fontSize: 34, fontWeight: 600, color: "#c9c3b3", textShadow: SHADOW, marginLeft: 12 })}>{`#${d.tag}`}</div>
          </div>
          <div style={flex({ marginTop: 18, fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 96, lineHeight: 1.02, color: "#ffffff", textShadow: "0 6px 40px rgba(0,0,0,0.85)" })}>{up(t, labels.header)}</div>
          <div style={flex({ width: 170, height: 8, marginTop: 24, borderRadius: 4, background: TEAL })} />
        </div>

        <div style={flex({ flex: 1 })} />

        <div style={flex({ flexDirection: "column", gap: GAP, alignSelf: "center" })}>
          {rows.map((row, i) => (
            <div key={i} style={flex({ gap: GAP })}>
              {row.map((cell, j) => (
                <Square key={j} cell={cell} labels={labels} t={t} />
              ))}
            </div>
          ))}
        </div>

        <div style={flex({ marginTop: 44, gap: 20 })}>
          <Stat value={t.number(bingo.lines)} label={labels.lines} t={t} />
          <Stat value={`${bingo.unlocked}/${bingo.total}`} label={labels.trophies} t={t} />
        </div>
        {labels.next && <div style={flex({ marginTop: 26, fontSize: 30, fontWeight: 600, color: GOLD_BRIGHT, textShadow: SHADOW })}>{labels.next}</div>}

        <div style={flex({ flexDirection: "column", marginTop: 40 })}>
          <div style={flex({ fontSize: 30, fontWeight: 700, color: GOLD })}>{d.host}</div>
          <div style={flex({ marginTop: 10, fontSize: 17, lineHeight: 1.4, color: "rgba(160,155,140,0.7)" })}>{labels.disclaimer}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Draws the bingo card. `data`: `{ t, name, tag, season, host, bingo, labels }`. `bingo` is `getBingo` reduced to what is drawn
 * (`{ size, cells, lines, unlocked, total }`, each cell `{ free, inLine }` or `{ name, unlocked, progress, inLine }`) and
 * `labels` is every fixed line of text on the card. The labels travel in `data` because the fonts for a script other than
 * Latin are cut from the characters in it (`cardFonts`), and text written straight from `t` would be missing glyphs.
 */
export async function renderBingoCard(data) {
  return drawCard(<BingoStory {...data} />, {
    ...CARD_SIZES.story,
    fonts: await cardFonts(data.t, data),
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
