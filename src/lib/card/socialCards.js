/* eslint-disable @next/next/no-img-element -- Satori (ImageResponse) draws plain <img> elements; next/image does not apply here. */
import { cardFonts, CARD_SIZES, drawCard, GOLD, GOLD_BRIGHT, Header, INK, MUTED, Stat, TEAL, flex, ls, up } from "./renderCard";
import { stack } from "./fonts";

// Share cards for the squad and head-to-head pages. Text only: no emoji, since Satori has no emoji font here.

const MEMBER_COLORS = ["#c8aa6e", "#0ac8b9", "#e84057", "#a78bfa", "#3ddc97"];
const SIDE_COLORS = { a: "#e0b458", b: "#0ac8b9" };
const SHADOW = "0 2px 12px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)";
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

function Avatar({ src, name, size, color }) {
  const ring = { width: size, height: size, borderRadius: size / 2, border: `${Math.max(3, Math.round(size / 24))}px solid ${color}` };
  if (src) return <img alt="" src={src} width={size} height={size} style={ring} />;
  return (
    <div style={flex({ ...ring, alignItems: "center", justifyContent: "center", background: "#0f1f3d", fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: size * 0.42, color: GOLD_BRIGHT })}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ============================================================ squad

function SquadStory(d) {
  const { t } = d;
  const awards = d.awards.slice(0, 7);
  return (
    <div style={flex({ position: "relative", width: 1080, height: 1920, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      {d.art && <img alt="" src={d.art} width={1080} height={900} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover", objectPosition: "60% 22%" }} />}
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1200, background: `linear-gradient(to bottom, rgba(5,11,24,0.55) 0%, rgba(5,11,24,0.1) 25%, rgba(5,11,24,0.85) 55%, ${INK} 72%)` })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, flexDirection: "column", padding: "84px 84px 72px" })}>
        <Header season={t("cards.squad.header")} t={t} />
        <div style={flex({ flex: 1 })} />

        <div style={flex({ gap: 18 })}>
          {d.members.map((m) => (
            <Avatar key={m.name} src={m.icon} name={m.name} size={132} color={MEMBER_COLORS[m.index % 5]} />
          ))}
        </div>
        <div style={flex({ marginTop: 30, fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: d.members.length > 3 ? 46 : 58, lineHeight: 1.15, color: "#ffffff", textShadow: SHADOW })}>
          {d.members.map((m) => m.name).join(" · ")}
        </div>

        <div style={flex({ marginTop: 34, gap: 20 })}>
          <Stat value={t.number(d.squad.games)} label={t("cards.squad.gamesTogether")} t={t} />
          <Stat value={t.percent(d.squad.winRate)} label={t("cards.winRate")} t={t} />
          <Stat value={t.fixed(d.squad.hours)} label={t("cards.squad.hours")} t={t} />
        </div>

        <div style={flex({ marginTop: 40, fontSize: 24, fontWeight: 600, letterSpacing: ls(t, 8), color: TEAL, textShadow: SHADOW })}>{up(t, t("cards.squad.awards"))}</div>
        <div style={flex({ flexDirection: "column", marginTop: 8 })}>
          {awards.map((a) => (
            <div key={a.title} style={flex({ alignItems: "center", justifyContent: "space-between", padding: "17px 0", borderBottom: "1px solid rgba(200,170,110,0.25)" })}>
              <div style={flex({ fontSize: 29, fontWeight: 700, color: GOLD_BRIGHT, maxWidth: 560, textShadow: SHADOW })}>{a.title}</div>
              <div style={flex({ alignItems: "baseline", gap: 12 })}>
                <div style={flex({ fontSize: 29, fontWeight: 700, color: MEMBER_COLORS[a.memberIndex % 5], maxWidth: 260, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" })}>{a.winner}</div>
                <div style={flex({ fontSize: 24, fontWeight: 600, color: MUTED })}>{a.display}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={flex({ flexDirection: "column", marginTop: 34 })}>
          <div style={flex({ fontSize: 28, fontWeight: 700, color: GOLD })}>{d.host}</div>
          <div style={flex({ marginTop: 8, fontSize: 16, lineHeight: 1.4, color: "rgba(160,155,140,0.7)" })}>{t("cards.disclaimer")}</div>
        </div>
      </div>
    </div>
  );
}

function SquadOg(d) {
  const { t } = d;
  const awards = d.awards.slice(0, 4);
  return (
    <div style={flex({ position: "relative", width: 1200, height: 630, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      {d.art && <img alt="" src={d.art} width={700} height={630} style={{ position: "absolute", top: 0, right: 0, objectFit: "cover", objectPosition: "60% 20%" }} />}
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1200, height: 630, background: `linear-gradient(to right, ${INK} 0%, ${INK} 45%, rgba(5,11,24,0.82) 70%, rgba(5,11,24,0.55) 100%)` })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1200, height: 630, padding: "44px 56px 40px", justifyContent: "space-between" })}>
        <div style={flex({ flexDirection: "column", width: 520, justifyContent: "space-between" })}>
          <Header season={t("cards.squad.header")} compact t={t} />
          <div style={flex({ flexDirection: "column" })}>
            <div style={flex({ gap: 10 })}>
              {d.members.map((m) => (
                <Avatar key={m.name} src={m.icon} name={m.name} size={84} color={MEMBER_COLORS[m.index % 5]} />
              ))}
            </div>
            <div style={flex({ marginTop: 20, fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 36, lineHeight: 1.15, color: "#ffffff", textShadow: SHADOW })}>{d.members.map((m) => m.name).join(" · ")}</div>
          </div>
          <div style={flex({ gap: 14 })}>
            <Stat value={t.number(d.squad.games)} label={t("cards.games")} compact t={t} />
            <Stat value={t.percent(d.squad.winRate)} label={t("cards.winRate")} compact t={t} />
            <Stat value={t.number(Math.round(d.squad.hours))} label={t("cards.squad.together")} compact t={t} />
          </div>
        </div>
        <div style={flex({ flexDirection: "column", width: 480, justifyContent: "center" })}>
          <div style={flex({ fontSize: 20, fontWeight: 600, letterSpacing: ls(t, 6), color: TEAL, textShadow: SHADOW })}>{up(t, t("cards.squad.awards"))}</div>
          {awards.map((a) => (
            <div key={a.title} style={flex({ flexDirection: "column", padding: "14px 0", borderBottom: "1px solid rgba(200,170,110,0.25)" })}>
              <div style={flex({ fontSize: 24, fontWeight: 700, color: GOLD_BRIGHT, textShadow: SHADOW })}>{a.title}</div>
              <div style={flex({ fontSize: 22, fontWeight: 600, color: MEMBER_COLORS[a.memberIndex % 5], textShadow: SHADOW })}>{`${a.winner}  ${a.display}`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * `data`: `{ t, host, members: [{ index, name, icon }], squad, awards: [{ title, winner, memberIndex, display }], art }`, where `t` is the translator and `icon`/`art` are image URLs (or null).
 */
export async function renderSquadCard(format, data) {
  const size = CARD_SIZES[format] ?? CARD_SIZES.story;
  return drawCard(format === "og" ? <SquadOg {...data} /> : <SquadStory {...data} />, { ...size, fonts: await cardFonts(data.t, data), headers: { "Cache-Control": CACHE } });
}

// ============================================================ versus

function Row({ row, size }) {
  const color = (side) => (row.winner === side ? SIDE_COLORS[side] : MUTED);
  const weight = (side) => (row.winner === side ? 800 : 600);
  return (
    <div style={flex({ alignItems: "center", justifyContent: "space-between", padding: `${size * 0.5}px 0`, borderBottom: "1px solid rgba(200,170,110,0.2)" })}>
      <div style={flex({ width: size * 4, fontSize: size * 1.15, fontWeight: weight("a"), color: color("a") })}>{row.aShow}</div>
      <div style={flex({ fontSize: size * 0.72, fontWeight: 600, letterSpacing: 4, color: MUTED, textTransform: "uppercase" })}>{row.label}</div>
      <div style={flex({ width: size * 4, justifyContent: "flex-end", fontSize: size * 1.15, fontWeight: weight("b"), color: color("b") })}>{row.bShow}</div>
    </div>
  );
}

// A scenario result (see `compareScenario`): each player's number on their side, the scenario between them, and the
// punchline underneath. `winner` gets the colour, the other side fades.
function ScenarioRow({ s }) {
  const value = (side) => flex({ width: 280, justifyContent: side === "a" ? "flex-start" : "flex-end", fontSize: 32, fontWeight: s.winner === side ? 800 : 600, color: s.winner === side ? SIDE_COLORS[side] : MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
  return (
    <div style={flex({ flexDirection: "column", padding: "20px 0", borderBottom: "1px solid rgba(200,170,110,0.2)" })}>
      <div style={flex({ alignItems: "center", justifyContent: "space-between" })}>
        <div style={value("a")}>{s.aShow}</div>
        <div style={flex({ flex: 1, justifyContent: "center", textAlign: "center", padding: "0 14px", fontSize: 26, fontWeight: 700, letterSpacing: 3, color: GOLD_BRIGHT, textTransform: "uppercase" })}>{s.title}</div>
        <div style={value("b")}>{s.bShow}</div>
      </div>
      <div style={flex({ marginTop: 8, justifyContent: "center", textAlign: "center", fontSize: 22, lineHeight: 1.3, color: MUTED })}>{s.line}</div>
    </div>
  );
}

function Contender({ side, p, width, avatar, nameSize, rankSize, t }) {
  return (
    <div style={flex({ flexDirection: "column", alignItems: "center", width })}>
      <Avatar src={p.icon} name={p.name} size={avatar} color={SIDE_COLORS[side]} />
      <div style={flex({ marginTop: 14, fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: nameSize, color: SIDE_COLORS[side], maxWidth: width, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textShadow: SHADOW })}>{p.name}</div>
      <div style={flex({ fontSize: rankSize, fontWeight: 600, color: MUTED })}>{p.rank ?? t("cards.versus.unranked")}</div>
    </div>
  );
}

function VersusStory(d) {
  const { t } = d;
  return (
    <div style={flex({ position: "relative", width: 1080, height: 1920, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, background: `linear-gradient(160deg, rgba(224,180,88,0.18) 0%, ${INK} 45%, rgba(10,200,185,0.18) 100%)` })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, flexDirection: "column", padding: "84px 84px 72px" })}>
        <Header season={t("cards.versus.header")} t={t} />
        <div style={flex({ marginTop: 70, alignItems: "flex-start", justifyContent: "space-between" })}>
          <Contender side="a" p={d.a} width={400} avatar={210} nameSize={54} rankSize={30} t={t} />
          <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 44, color: MUTED, paddingTop: 80 })}>{t("cards.versus.vs")}</div>
          <Contender side="b" p={d.b} width={400} avatar={210} nameSize={54} rankSize={30} t={t} />
        </div>
        <div style={flex({ flexDirection: "column", alignItems: "center", marginTop: 40 })}>
          <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 150, color: "#ffffff", textShadow: SHADOW })}>{`${d.score.a}-${d.score.b}`}</div>
          <div style={flex({ fontSize: 24, fontWeight: 600, letterSpacing: ls(t, 6), color: MUTED })}>{up(t, t("cards.versus.rowsWon"))}</div>
        </div>
        <div style={flex({ marginTop: 40, fontSize: 40, fontWeight: 600, color: GOLD_BRIGHT, textAlign: "center", justifyContent: "center", textShadow: SHADOW })}>{d.verdict}</div>
        <div style={flex({ marginTop: 44, fontSize: 24, fontWeight: 600, letterSpacing: ls(t, 8), color: TEAL, textShadow: SHADOW })}>{up(t, t(d.scenarios.length > 0 ? "cards.versus.scenarios" : "cards.versus.numbers"))}</div>
        <div style={flex({ flexDirection: "column", marginTop: 6 })}>
          {d.scenarios.length > 0
            ? d.scenarios.map((s) => <ScenarioRow key={s.id} s={s} />)
            : d.rows.slice(0, 8).map((row) => <Row key={row.key} row={row} size={30} />)}
        </div>
        <div style={flex({ flex: 1 })} />
        <div style={flex({ fontSize: 28, fontWeight: 700, color: GOLD })}>{d.host}</div>
        <div style={flex({ marginTop: 8, fontSize: 16, lineHeight: 1.4, color: "rgba(160,155,140,0.7)" })}>{t("cards.disclaimer")}</div>
      </div>
    </div>
  );
}

function VersusOg(d) {
  const { t } = d;
  return (
    <div style={flex({ position: "relative", width: 1200, height: 630, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1200, height: 630, background: `linear-gradient(110deg, rgba(224,180,88,0.22) 0%, ${INK} 50%, rgba(10,200,185,0.22) 100%)` })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1200, height: 630, flexDirection: "column", padding: "44px 56px 40px", justifyContent: "space-between" })}>
        <Header season={t("cards.versus.header")} compact t={t} />
        <div style={flex({ alignItems: "center", justifyContent: "space-between" })}>
          <Contender side="a" p={d.a} width={440} avatar={190} nameSize={56} rankSize={30} t={t} />
          <div style={flex({ flexDirection: "column", alignItems: "center" })}>
            <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 100, color: "#ffffff", textShadow: SHADOW })}>{`${d.score.a}-${d.score.b}`}</div>
            <div style={flex({ fontSize: 18, fontWeight: 600, letterSpacing: ls(t, 5), color: MUTED })}>{up(t, t("cards.versus.rowsWon"))}</div>
          </div>
          <Contender side="b" p={d.b} width={440} avatar={190} nameSize={56} rankSize={30} t={t} />
        </div>
        <div style={flex({ gap: 16 })}>
          {d.scenarios.map((s) => (
            <div key={s.id} style={flex({ flex: 1, flexDirection: "column", alignItems: "center", padding: "12px 10px", border: `2px solid ${SIDE_COLORS[s.winner]}`, borderRadius: 16, background: "rgba(8,16,34,0.78)" })}>
              <div style={flex({ fontSize: 18, fontWeight: 700, letterSpacing: 3, color: GOLD_BRIGHT, textTransform: "uppercase" })}>{s.title}</div>
              <div style={flex({ fontSize: 26, fontWeight: 800, color: SIDE_COLORS[s.winner], maxWidth: 320, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" })}>{s.winner === "a" ? d.a.name : d.b.name}</div>
            </div>
          ))}
        </div>
        <div style={flex({ fontSize: 26, fontWeight: 600, color: GOLD_BRIGHT, justifyContent: "center", textAlign: "center" })}>{d.verdict}</div>
      </div>
    </div>
  );
}

/**
 * `data`: `{ t, host, a, b, score: { a, b }, verdict, rows, scenarios }` where a/b are `{ name, icon, rank }`, `rows` come
 * from `compareRecaps` and `scenarios` from `buildScenarios` (the most lopsided few; `rows` fill in when there are none).
 */
export async function renderVersusCard(format, data) {
  const size = CARD_SIZES[format] ?? CARD_SIZES.story;
  return drawCard(format === "og" ? <VersusOg {...data} /> : <VersusStory {...data} />, { ...size, fonts: await cardFonts(data.t, data), headers: { "Cache-Control": CACHE } });
}

// ============================================================ squad vs squad

// One side of the clash: the team's name over its members' names.
function ClashSide({ side, team, width, nameSize, memberSize }) {
  return (
    <div style={flex({ flexDirection: "column", alignItems: "center", width })}>
      <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: nameSize, color: SIDE_COLORS[side], maxWidth: width, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textShadow: SHADOW })}>{team.name}</div>
      <div style={flex({ flexDirection: "column", alignItems: "center", marginTop: 12 })}>
        {team.members.map((name) => (
          <div key={name} style={flex({ fontSize: memberSize, fontWeight: 600, color: MUTED, maxWidth: width, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" })}>{name}</div>
        ))}
      </div>
    </div>
  );
}

// A lane: each squad's usual laner on their side, the role and the lane's count between them. The lit side won more of its games.
function LaneRow({ lane }) {
  const name = (side) => flex({ width: 340, justifyContent: side === "a" ? "flex-start" : "flex-end", fontSize: 28, fontWeight: lane.winner === side ? 800 : 600, color: lane.winner === side ? SIDE_COLORS[side] : MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
  return (
    <div style={flex({ alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(200,170,110,0.2)" })}>
      <div style={name("a")}>{lane.aName}</div>
      <div style={flex({ flexDirection: "column", alignItems: "center" })}>
        <div style={flex({ fontSize: 20, fontWeight: 600, letterSpacing: 4, color: MUTED, textTransform: "uppercase" })}>{lane.role}</div>
        <div style={flex({ fontSize: 30, fontWeight: 800, color: GOLD_BRIGHT })}>{lane.score}</div>
      </div>
      <div style={name("b")}>{lane.bName}</div>
    </div>
  );
}

function ClashStory(d) {
  const { t } = d;
  return (
    <div style={flex({ position: "relative", width: 1080, height: 1920, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, background: `linear-gradient(160deg, rgba(224,180,88,0.18) 0%, ${INK} 45%, rgba(10,200,185,0.18) 100%)` })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, flexDirection: "column", padding: "84px 84px 72px" })}>
        <Header season={t("clash.slides.intro.eyebrow")} t={t} />
        <div style={flex({ marginTop: 60, alignItems: "flex-start", justifyContent: "space-between" })}>
          <ClashSide side="a" team={d.teams.a} width={370} nameSize={44} memberSize={26} />
          <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 40, color: MUTED, paddingTop: 10 })}>{t("cards.versus.vs")}</div>
          <ClashSide side="b" team={d.teams.b} width={370} nameSize={44} memberSize={26} />
        </div>
        <div style={flex({ flexDirection: "column", alignItems: "center", marginTop: 34 })}>
          <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 150, color: "#ffffff", textShadow: SHADOW })}>{`${d.score.a}-${d.score.b}`}</div>
          <div style={flex({ fontSize: 24, fontWeight: 600, letterSpacing: ls(t, 4), color: MUTED })}>{d.played}</div>
        </div>
        <div style={flex({ marginTop: 28, fontSize: 34, fontWeight: 600, lineHeight: 1.25, color: GOLD_BRIGHT, textAlign: "center", justifyContent: "center", textShadow: SHADOW })}>{d.verdict}</div>
        {d.lanes.length > 0 && (
          <div style={flex({ flexDirection: "column" })}>
            <div style={flex({ marginTop: 36, fontSize: 24, fontWeight: 600, letterSpacing: ls(t, 8), color: TEAL, textShadow: SHADOW })}>{up(t, d.lanesTitle)}</div>
            <div style={flex({ flexDirection: "column", marginTop: 4 })}>
              {d.lanes.map((lane) => (
                <LaneRow key={lane.key} lane={lane} />
              ))}
            </div>
          </div>
        )}
        <div style={flex({ marginTop: 30, fontSize: 24, fontWeight: 600, letterSpacing: ls(t, 8), color: TEAL, textShadow: SHADOW })}>{up(t, d.numbersTitle)}</div>
        <div style={flex({ flexDirection: "column", marginTop: 2 })}>
          {d.rows.map((row) => (
            <Row key={row.key} row={row} size={26} />
          ))}
        </div>
        <div style={flex({ flex: 1 })} />
        <div style={flex({ fontSize: 28, fontWeight: 700, color: GOLD })}>{d.host}</div>
        <div style={flex({ marginTop: 8, fontSize: 16, lineHeight: 1.4, color: "rgba(160,155,140,0.7)" })}>{t("cards.disclaimer")}</div>
      </div>
    </div>
  );
}

function ClashOg(d) {
  const { t } = d;
  return (
    <div style={flex({ position: "relative", width: 1200, height: 630, background: INK, fontFamily: stack("Inter"), color: "#f0e6d2" })}>
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1200, height: 630, background: `linear-gradient(110deg, rgba(224,180,88,0.22) 0%, ${INK} 50%, rgba(10,200,185,0.22) 100%)` })} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: 1200, height: 630, flexDirection: "column", padding: "44px 56px 40px", justifyContent: "space-between" })}>
        <Header season={t("clash.slides.intro.eyebrow")} compact t={t} />
        <div style={flex({ alignItems: "center", justifyContent: "space-between" })}>
          <ClashSide side="a" team={d.teams.a} width={410} nameSize={40} memberSize={22} />
          <div style={flex({ flexDirection: "column", alignItems: "center", width: 240 })}>
            <div style={flex({ fontFamily: stack("Cinzel"), fontWeight: 800, fontSize: 100, color: "#ffffff", textShadow: SHADOW })}>{`${d.score.a}-${d.score.b}`}</div>
          </div>
          <ClashSide side="b" team={d.teams.b} width={410} nameSize={40} memberSize={22} />
        </div>
        <div style={flex({ fontSize: 26, fontWeight: 600, color: GOLD_BRIGHT, justifyContent: "center", textAlign: "center" })}>{d.verdict}</div>
      </div>
    </div>
  );
}

/**
 * `data`: `{ t, host, teams: { a, b }, score: { a, b }, played, verdict, lanesTitle, numbersTitle, lanes, rows }` where a team is
 * `{ name, members: [name] }`, `lanes` are `{ key, role, aName, bName, score, winner }` and `rows` come from `clashRows`.
 */
export async function renderClashCard(format, data) {
  const size = CARD_SIZES[format] ?? CARD_SIZES.story;
  return drawCard(format === "og" ? <ClashOg {...data} /> : <ClashStory {...data} />, { ...size, fonts: await cardFonts(data.t, data), headers: { "Cache-Control": CACHE } });
}
