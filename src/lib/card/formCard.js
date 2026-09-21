import { cardFonts, CARD_SIZES, drawCard, GOLD, GOLD_BRIGHT, Header, INK, MUTED, TEAL, flex, ls, up } from "./renderCard";
import { stack } from "./fonts";

// The season-as-a-line share card: your rolling win rate as a line, with the best stretch, the worst stretch and now marked, on the tall
// story canvas. The picture is the same one the slide draws (`curveShape`), and it is text-only outside the chart: Satori has no emoji font
// and gives no fonts to text inside an SVG image, so the axis labels are ordinary text laid over it.

export const FORM_BOX = { width: 912, height: 520, pad: { left: 96, right: 22, top: 26, bottom: 26 } };
const DOT = { worst: "#ff6b7d", best: "#3ddc97", now: "#f0d9a0" };
const SHADOW = "0 2px 12px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)";

function Chart({ shape }) {
  const { width, height, pad } = FORM_BOX;
  return (
    <div style={flex({ position: "relative", width, height })}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ac8b9" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0ac8b9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {shape.ticks.map((tick) => (
          <line key={tick.percent} x1={pad.left} x2={width - pad.right} y1={tick.y} y2={tick.y} stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        ))}
        <path d={shape.area} fill="url(#area)" />
        <line x1={pad.left} x2={width - pad.right} y1={shape.average} y2={shape.average} stroke="rgba(235,229,213,0.6)" strokeWidth="2" strokeDasharray="10 10" />
        <path d={shape.line} fill="none" stroke={TEAL} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        {["worst", "best", "now"].map((kind) => (
          <circle key={kind} cx={shape.marks[kind].x} cy={shape.marks[kind].y} r="13" fill={DOT[kind]} stroke={INK} strokeWidth="4" />
        ))}
      </svg>
      {shape.ticks.map((tick) => (
        <div key={tick.percent} style={flex({ position: "absolute", left: 0, top: tick.y - 15, width: pad.left - 16, height: 30, alignItems: "center", justifyContent: "flex-end", fontSize: 24, fontWeight: 600, color: MUTED })}>
          {tick.label}
        </div>
      ))}
    </div>
  );
}

function Tile({ chip, t }) {
  return (
    <div style={flex({ flex: 1, flexDirection: "column", alignItems: "center", padding: "26px 10px", border: "2px solid rgba(200,170,110,0.4)", borderRadius: 26, background: "rgba(8,16,34,0.78)" })}>
      <div style={flex({ alignItems: "center", gap: 12 })}>
        <div style={flex({ width: 18, height: 18, borderRadius: 9, background: DOT[chip.kind] })} />
        <div style={flex({ fontSize: 22, fontWeight: 600, letterSpacing: ls(t, 3), color: MUTED })}>{up(t, chip.label)}</div>
      </div>
      <div style={flex({ marginTop: 8, fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 64, color: GOLD_BRIGHT })}>{chip.value}</div>
      <div style={flex({ marginTop: 4, fontSize: 24, fontWeight: 600, color: "#ded8c8", minHeight: 30 })}>{chip.note ?? " "}</div>
    </div>
  );
}

function FormStory(d) {
  const { t, labels } = d;
  return (
    <div style={flex({ position: "relative", width: 1080, height: 1920, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, background: "linear-gradient(to bottom, rgba(24,36,72,0.9) 0%, rgba(5,11,24,0) 45%, rgba(10,60,70,0.35) 100%)" })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, flexDirection: "column", padding: "84px 84px 72px" })}>
        <Header season={d.season} t={t} />

        <div style={flex({ flexDirection: "column", marginTop: 64 })}>
          <div style={flex({ alignItems: "baseline", maxWidth: "100%" })}>
            <div style={flex({ fontSize: 54, fontWeight: 700, color: "#f0e6d2", textShadow: SHADOW, maxWidth: "70%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" })}>{d.name}</div>
            <div style={flex({ fontSize: 34, fontWeight: 600, color: "#c9c3b3", textShadow: SHADOW, marginLeft: 12 })}>{`#${d.tag}`}</div>
          </div>
          <div style={flex({ marginTop: 18, fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 76, lineHeight: 1.06, color: "#ffffff", textShadow: "0 6px 40px rgba(0,0,0,0.85)" })}>{up(t, labels.title)}</div>
          <div style={flex({ width: 170, height: 8, marginTop: 24, borderRadius: 4, background: TEAL })} />
        </div>

        <div style={flex({ flex: 1 })} />

        <div style={flex({ alignSelf: "center" })}>
          <Chart shape={d.shape} />
        </div>

        <div style={flex({ marginTop: 44, gap: 16 })}>
          {d.chips.map((chip) => (
            <Tile key={chip.kind} chip={chip} t={t} />
          ))}
        </div>

        <div style={flex({ flexDirection: "column", marginTop: 40, gap: 12, fontSize: 32, lineHeight: 1.4, color: "#ded8c8", textShadow: SHADOW })}>
          {d.lines.map((line) => (
            <div key={line} style={flex({})}>
              {line}
            </div>
          ))}
        </div>

        <div style={flex({ flex: 1 })} />

        <div style={flex({ flexDirection: "column", marginTop: 32 })}>
          <div style={flex({ fontSize: 30, fontWeight: 700, color: GOLD })}>{d.host}</div>
          <div style={flex({ marginTop: 10, fontSize: 17, lineHeight: 1.4, color: "rgba(160,155,140,0.7)" })}>{labels.disclaimer}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Draws the season line card. `data`: `{ t, name, tag, season, host, shape, chips, lines, labels }`. `shape` is `curveShape`'s result for
 * `FORM_BOX`, with a `label` on each tick; `chips` are `[{ kind, label, value, note }]` for the best, worst and latest stretch; `lines`
 * are the two sentences under the chart. Everything drawn as text travels in `data` (see `renderBingoCard` for why).
 */
export async function renderFormCard(data) {
  return drawCard(<FormStory {...data} />, {
    ...CARD_SIZES.story,
    fonts: await cardFonts(data.t, data),
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
