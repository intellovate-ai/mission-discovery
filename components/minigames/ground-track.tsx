"use client";
// GROUND TRACK (owner PRISM): choose the orbit with two sliders, altitude and tilt, and watch a
// week of passes paint a vintage world map. Shows Africa coverage, sharpness, lifetime and the
// debris rule, all live through simulate(). Sets design.orbit.
// Style (Art Bible 3): vintage cartography, paper #EFE4C8, ink #2B2118, route #B3261E, IM Fell English.
import { IM_Fell_English } from "next/font/google";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { MinigameContext, MinigameDef, MinigameProps } from "@/lib/minigames/types";
import type { MinigameResult } from "@/lib/protocol";
import { EMBER, ORBITS, ROCKETS, type ObjectiveId, type Orbit } from "@/lib/game/data/ember";
import { simulate } from "@/lib/game/sim";
import { AFRICA_CELLS, AFRICA_PATH, LAND_PATH } from "./ground-track-map";
import { coverage, coveredBy, parseCells, tiltDeg, weekTrack, WEEK_S, type Coverage, type TrackPoint } from "./ground-track-orbit";

const fell = IM_Fell_English({ weight: "400", style: ["normal", "italic"], subsets: ["latin"] });

const PAPER = "#EFE4C8";
const INK = "#2B2118";
const ROUTE = "#B3261E";
const LANDFILL = "#E3D3A9";
const PAINT_MS = 4500;

// Words Bible section 7 and 8.
const LOSE_LIFE = "Lower is sharper, but the air drags you down sooner. Your orbit won't last 2 years.";
const debrisLine = (alt: number) => `At ${alt} km your spacecraft stays up for 25+ years after it dies. Add a thruster to bring it down, or fly lower.`;
const winLine = (pct: number) => `${pct}% of the target covered.`;
const GLOSS_TRACK = "The line your spacecraft traces over the planet below.";
const GLOSS_ORBIT = "The path around a planet. Lower is closer and sharper; higher lasts longer.";

// ---------- Geometry (pure, cached per orbit) ----------

const CELLS = parseCells(AFRICA_CELLS);

interface Chunk {
  start: number;
  lit: string;
  dark: string;
}
interface Geo {
  track: TrackPoint[];
  cov: Coverage;
  chunks: Chunk[];
}
const geoCache = new Map<string, Geo>();
const xy = (p: TrackPoint) => `${p.lon.toFixed(1)} ${(-p.lat).toFixed(1)}`;

function geoFor(o: Orbit): Geo {
  const hit = geoCache.get(o.id);
  if (hit) return hit;
  const track = weekTrack(o);
  const cov = coverage(o, CELLS, track);
  const periodS = o.periodMin * 60;
  const chunks: Chunk[] = [];
  const stride = 3; // draw every minute
  let cur: Chunk | null = null;
  const lastEnd: Record<"lit" | "dark", number> = { lit: -1, dark: -1 };
  for (let i = 0; i + stride < track.length; i += stride) {
    const p = track[i];
    const q = track[i + stride];
    const k = Math.floor(p.t / periodS);
    if (!cur || chunks.length - 1 < k) {
      cur = { start: k * periodS, lit: "", dark: "" };
      chunks.push(cur);
      lastEnd.lit = lastEnd.dark = -1;
    }
    if (Math.abs(q.lon - p.lon) > 180) continue; // wraps the map edge
    const cls = p.lit ? "lit" : "dark";
    cur[cls] += lastEnd[cls] === i ? ` ${xy(q)}` : `M${xy(p)} ${xy(q)}`;
    lastEnd[cls] = i + stride;
  }
  const g = { track, cov, chunks };
  geoCache.set(o.id, g);
  return g;
}

function coveredPath(c: Coverage, t: number) {
  let d = "";
  for (let i = 0; i < CELLS.length; i++) if (c.firstSeen[i] <= t) d += `M${CELLS[i][1]} ${-(CELLS[i][0] + 1)}h1v1h-1z`;
  return d;
}

// ---------- Rules ----------

const ALT = [400, 550, 700];
const TILT = ["51.6°", "Sun Sync", "Dawn Dusk"];
const POS: Record<string, [number, number]> = { "leo-400": [0, 0], "sso-550": [1, 1], "sso-700": [2, 1], "sso-dd-550": [1, 2] };

function allowedOrbits(ctx: MinigameContext): Orbit[] {
  const r = ROCKETS.find((x) => x.id === ctx.state.design.rocket);
  const list = r ? ORBITS.filter((o) => r.orbits.includes(o.id)) : ORBITS;
  return list.length ? list : ORBITS;
}

/** Nearest allowed orbit to a slider position; the slider just moved weighs most. */
function snap(allowed: Orbit[], alt: number, tilt: number, moved: "alt" | "tilt"): Orbit {
  let best = allowed[0];
  let bestCost = Infinity;
  for (const o of allowed) {
    const [a, t] = POS[o.id] ?? [1, 1];
    const cost = moved === "alt" ? 10 * Math.abs(a - alt) + Math.abs(t - tilt) : Math.abs(a - alt) + 10 * Math.abs(t - tilt);
    if (cost < bestCost) {
      bestCost = cost;
      best = o;
    }
  }
  return best;
}

interface Eval {
  cov: number;
  revisit: number;
  sharp: number;
  life: number;
  lifeOk: boolean;
  debris: boolean;
  fitOk: boolean;
  science: number;
  lines: string[];
  score: number;
  note: string;
  must: string | null;
}

function evaluate(ctx: MinigameContext, o: Orbit): Eval {
  const sim = simulate({ ...ctx.state.design, orbit: o.id }, (ctx.state.objectiveId as ObjectiveId | null) ?? null, ctx.state.rescueUsed);
  const geo = geoFor(o);
  const cov = geo.cov.week;
  const lifeOk = sim.lifeYears >= EMBER.requiredLifeYears;
  const debris = sim.checks.some((c) => c.id === "debris");
  const obj = EMBER.objectives.find((x) => x.id === ctx.state.objectiveId);
  const fitOk = !(obj?.wants.sunSync && !o.sunSync);
  const sharp = o.sharpness * (o.dawnDusk ? 0.7 : 1);
  // Score: fit to the objective (and light for the camera), a little for coverage, halved for each broken rule.
  let score = (fitOk ? 1 : 0.4) * (o.dawnDusk ? 0.7 : 1) * (0.8 + 0.2 * cov);
  if (!lifeOk) score *= 0.5;
  if (debris) score *= 0.5;
  const pct = Math.round(cov * 100);
  const must = obj?.wants.sunSync ? "Same time of day every pass" : null;
  const note = !lifeOk
    ? LOSE_LIFE
    : debris
      ? debrisLine(o.altitudeKm)
      : !fitOk
        ? `${winLine(pct)} But crops need the same time of day every pass.`
        : winLine(pct);
  const lines = sim.checks.filter((c) => c.status === "bad" && ["life", "debris", "ride", "eclipse"].includes(c.id)).map((c) => c.line);
  return { cov, revisit: geo.cov.revisitDays, sharp, life: sim.lifeYears, lifeOk, debris, fitOk, science: Math.round(sim.science), lines, score: Math.round(score * 100) / 100, note, must };
}

// ---------- Live frame ----------

interface GTLive {
  orbitId: string;
  allowed: string[];
  paint: number; // 0..1 of the week painted
  covNow: number;
  e: Eval;
  objective: string | null;
  locked: boolean;
}

// ---------- Pieces ----------

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("en-US");

function TrackMap({ orbit, paint, sat = true }: { orbit?: Orbit; paint: number; sat?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const geo = useMemo(() => (orbit ? geoFor(orbit) : null), [orbit]);
  const T = paint * WEEK_S;
  const q = Math.floor(paint * 120);
  const covered = useMemo(() => (geo ? coveredPath(geo.cov, (q / 120) * WEEK_S) : ""), [geo, q]);
  const chunks = geo ? geo.chunks.filter((c) => c.start <= T) : [];
  const head = geo ? geo.track[Math.min(geo.track.length - 1, Math.round(T / 20))] : null;
  const grat: string[] = [];
  for (let lon = -150; lon <= 150; lon += 30) grat.push(`M${lon} -90V90`);
  for (let lat = -60; lat <= 60; lat += 30) if (lat) grat.push(`M-180 ${-lat}H180`);
  return (
    <svg viewBox="-181 -91 362 182" style={{ width: "100%", height: "100%", display: "block" }} aria-label="World map with a week of ground track">
      <defs>
        <pattern id={`${uid}h`} width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="2.2" stroke={INK} strokeWidth="0.45" opacity="0.55" />
        </pattern>
      </defs>
      <rect x={-180} y={-90} width={360} height={180} fill={PAPER} />
      <path d={grat.join("")} stroke={INK} strokeOpacity={0.2} strokeWidth={0.6} vectorEffect="non-scaling-stroke" fill="none" />
      <path d="M-180 0H180" stroke={INK} strokeOpacity={0.45} strokeWidth={0.8} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      <path d={LAND_PATH} fill={LANDFILL} stroke={INK} strokeWidth={0.8} vectorEffect="non-scaling-stroke" fillRule="evenodd" />
      <path d={AFRICA_PATH} fill={`url(#${uid}h)`} />
      <path d={covered} fill={ROUTE} fillOpacity={0.42} />
      <path d={AFRICA_PATH} fill="none" stroke={INK} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
      {chunks.map((c, i) => (
        <g key={i}>
          {c.dark && <path d={c.dark} fill="none" stroke={INK} strokeOpacity={0.28} strokeWidth={0.6} strokeDasharray="1 2.5" vectorEffect="non-scaling-stroke" />}
          {c.lit && <path d={c.lit} fill="none" stroke={ROUTE} strokeOpacity={0.6} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />}
        </g>
      ))}
      {sat && head && paint < 1 && (
        <g transform={`translate(${head.lon} ${-head.lat})`}>
          <circle r={2.6} fill={PAPER} stroke={ROUTE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <path d="M-4.5 0H4.5M0 -4.5V4.5" stroke={ROUTE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      )}
      <rect x={-180} y={-90} width={360} height={180} fill="none" stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <rect x={-178} y={-88} width={356} height={176} fill="none" stroke={INK} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const rangeCss = `
.gt-range{-webkit-appearance:none;appearance:none;width:100%;height:36px;background:transparent;margin:0;touch-action:none}
.gt-range:focus{outline:none}
.gt-range::-webkit-slider-runnable-track{height:2px;background:${INK}}
.gt-range::-moz-range-track{height:2px;background:${INK}}
.gt-range::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:30px;margin-top:-14px;border-radius:50%;background:${PAPER};border:2px solid ${INK};box-shadow:inset 0 0 0 6px ${PAPER},inset 0 0 0 30px ${ROUTE}}
.gt-range::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:${ROUTE};border:2px solid ${INK};box-shadow:inset 0 0 0 5px ${PAPER}}
.gt-range:focus-visible::-webkit-slider-thumb{outline:2px solid ${ROUTE};outline-offset:2px}
.gt-btn{font:inherit;width:100%;min-height:54px;background:${INK};color:${PAPER};border:none;border-radius:6px;font-size:22px;letter-spacing:.02em;cursor:pointer}
.gt-btn:active{transform:translateY(1px)}
.gt-btn:disabled{opacity:.5}
@keyframes gt-stamp{from{transform:rotate(-8deg) scale(1.6);opacity:0}to{transform:rotate(-8deg) scale(1);opacity:1}}
`;

function Stops({ label, value, options, onChange }: { label: string; value: number; options: { text: string; ok: boolean }[]; onChange: (i: number) => void }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 17 }}>
        <span style={{ fontVariant: "small-caps", letterSpacing: "0.04em" }}>{label}</span>
        <span style={{ color: ROUTE, fontSize: 20 }}>{options[value]?.text}</span>
      </div>
      <input className="gt-range" type="range" min={0} max={options.length - 1} step={1} value={value} aria-label={label} onChange={(ev) => onChange(Number(ev.target.value))} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, fontSize: 15 }}>
        {options.map((o, i) => (
          <span
            key={o.text}
            style={{ textAlign: i === 0 ? "left" : i === options.length - 1 ? "right" : "center", opacity: o.ok ? 1 : 0.38, textDecoration: o.ok ? "none" : "line-through" }}
          >
            {o.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function Readouts({ e, covNow, big }: { e: Eval; covNow: number; big?: boolean }) {
  const rows: [string, string, boolean][] = [
    ["Africa Covered", `${Math.round(covNow * 100)}%`, true],
    [big ? "Image Sharpness" : "Sharpness", `${Math.round(e.sharp * 100)}%`, true],
    ["Revisit", Number.isFinite(e.revisit) ? `${big ? "every " : ""}${fmt(e.revisit)} days` : "Never", true],
    ["Lifetime", `${big ? "about " : ""}${fmt(e.life)} years`, e.lifeOk],
    ["Debris Rule", e.debris ? "Broken" : "Clear", !e.debris],
    ["Science", big ? `${e.science} of 400` : `${e.science}`, true],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: big ? "1fr" : "1fr 1fr 1fr", columnGap: big ? 0 : 10, rowGap: big ? "0.6cqh" : 4 }}>
      {rows.map(([k, v, ok]) => (
        <div key={k} style={{ borderBottom: `1px solid ${INK}33`, paddingBottom: big ? "0.5cqh" : 3, display: big ? "flex" : "block", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontVariant: "small-caps", letterSpacing: "0.04em", fontSize: big ? "2.6cqh" : 15, opacity: 0.8, whiteSpace: "nowrap" }}>{k}</div>
          <div style={{ fontSize: big ? "3.6cqh" : 19, color: ok ? INK : ROUTE, whiteSpace: "nowrap" }}>
            {!ok && <span aria-hidden>✗ </span>}
            {v}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stamp({ text, big }: { text: string; big?: boolean }) {
  return (
    <div
      style={{
        display: "inline-block",
        border: `3px double ${ROUTE}`,
        color: ROUTE,
        padding: big ? "0.6cqh 1.6cqh" : "4px 12px",
        fontSize: big ? "4.4cqh" : 24,
        fontVariant: "small-caps",
        letterSpacing: "0.06em",
        animation: "gt-stamp 380ms ease-out both",
      }}
    >
      {text}
    </div>
  );
}

// ---------- Play ----------

function Play({ ctx, sendLive, finish }: Pick<MinigameProps<GTLive>, "ctx" | "sendLive" | "finish">) {
  const allowed = useMemo(() => allowedOrbits(ctx), [ctx]);
  const [orbit, setOrbit] = useState<Orbit>(() => allowed.find((o) => o.id === ctx.state.design.orbit) ?? allowed.find((o) => o.id === "sso-550") ?? allowed[0]);
  const [paint, setPaint] = useState(0);
  const [locked, setLocked] = useState(false);
  const e = useMemo(() => evaluate(ctx, orbit), [ctx, orbit]);
  const geo = geoFor(orbit);
  const covNow = coveredBy(geo.cov, paint * WEEK_S);
  const obj = EMBER.objectives.find((x) => x.id === ctx.state.objectiveId);
  const rocket = ROCKETS.find((r) => r.id === ctx.state.design.rocket);

  // Paint the week whenever the orbit changes.
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / PAINT_MS);
      setPaint(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [orbit]);

  // Mirror to the big screen. The kit throttles; a slow heartbeat makes sure the last frame lands.
  const frame: GTLive = { orbitId: orbit.id, allowed: allowed.map((o) => o.id), paint, covNow, e, objective: obj?.title ?? null, locked };
  const latest = useRef(frame);
  useEffect(() => {
    latest.current = frame;
    sendLive(frame);
  });
  useEffect(() => {
    const id = setInterval(() => sendLive(latest.current), 300);
    return () => clearInterval(id);
  }, [sendLive]);

  // finish() exactly once: shortly after locking (so the big screen shows the stamp), or on unmount.
  const result = useRef<MinigameResult | null>(null);
  const done = useRef(false);
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });
  const fire = () => {
    if (done.current || !result.current) return;
    done.current = true;
    finishRef.current(result.current);
  };
  useEffect(() => () => fire(), []);
  const lock = () => {
    if (locked) return;
    result.current = { score: e.score, set: { orbit: orbit.id }, note: e.note };
    setLocked(true);
    setTimeout(fire, 1800);
  };

  const [ai, ti] = POS[orbit.id] ?? [1, 1];
  const altOpts = ALT.map((a, i) => ({ text: `${a} km`, ok: allowed.some((o) => POS[o.id]?.[0] === i) }));
  const tiltOpts = TILT.map((t, i) => ({ text: t, ok: allowed.some((o) => POS[o.id]?.[1] === i) }));

  const rideNote = rocket && allowed.length < ORBITS.length ? `Struck out: the ${rocket.name} doesn't go there.` : null;

  return (
    <div className={fell.className} style={{ position: "absolute", inset: 0, overflowY: "auto", background: PAPER, color: INK, display: "flex", flexDirection: "column" }}>
      <style>{rangeCss}</style>
      <div style={{ padding: "12px 12px 8px", display: "grid", alignContent: "start", gap: 8, flex: 1 }}>
        <header style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, letterSpacing: "0.08em", lineHeight: 1 }}>GROUND TRACK</div>
          <div style={{ fontStyle: "italic", fontSize: 16, marginTop: 2 }}>{def.subtitle}</div>
        </header>
        <div style={{ aspectRatio: "362 / 182", width: "100%" }}>
          <TrackMap orbit={orbit} paint={paint} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontStyle: "italic", marginTop: -4 }}>
          <span>
            Tilt {fmt(tiltDeg(orbit))}°, {Math.round(orbit.periodMin)} minutes a lap
          </span>
          <span>Day {Math.min(7, Math.floor(paint * 7) + 1)} of 7</span>
        </div>
        {!locked ? (
          <>
            <Stops label="Altitude" value={ai} options={altOpts} onChange={(i) => setOrbit(snap(allowed, i, ti, "alt"))} />
            <Stops label="Tilt" value={ti} options={tiltOpts} onChange={(i) => setOrbit(snap(allowed, ai, i, "tilt"))} />
            {rideNote && <div style={{ fontSize: 15, fontStyle: "italic", opacity: 0.75, marginTop: -2 }}>{rideNote}</div>}
          </>
        ) : (
          <div style={{ textAlign: "center", display: "grid", gap: 8, justifyItems: "center", padding: "6px 0" }}>
            <Stamp text="Orbit Chosen" />
            <div style={{ fontSize: 19 }}>{e.note}</div>
          </div>
        )}
        <Readouts e={e} covNow={covNow} />
        {obj && e.must && (
          <div style={{ fontSize: 15 }}>
            <span style={{ fontVariant: "small-caps" }}>{obj.title}:</span> {e.must.toLowerCase()}{" "}
            <span style={{ color: e.fitOk ? INK : ROUTE }}>{e.fitOk ? "(met)" : "(missed)"}</span>
          </div>
        )}
        {!locked &&
          e.lines.map((l) => (
            <div key={l} style={{ fontSize: 15, fontStyle: "italic", color: ROUTE, borderLeft: `3px solid ${ROUTE}`, paddingLeft: 8 }}>
              {l}
            </div>
          ))}
        {!locked && !e.lines.length && (
          <div style={{ fontSize: 15, fontStyle: "italic", opacity: 0.75 }}>
            <span style={{ fontVariant: "small-caps", fontStyle: "normal" }}>Orbit:</span> {GLOSS_ORBIT}
          </div>
        )}
      </div>
      {!locked && (
        <div style={{ position: "sticky", bottom: 0, padding: "8px 12px 12px", background: PAPER, borderTop: `1px solid ${INK}33` }}>
          <button className="gt-btn" onClick={lock}>
            Choose This Orbit
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Watch ----------

function Watch({ live }: { live: GTLive | null }) {
  const orbit = live ? ORBITS.find((o) => o.id === live.orbitId) : undefined;
  const root: CSSProperties = { position: "absolute", inset: 0, background: PAPER, color: INK, containerType: "size", overflow: "hidden" };
  if (!live || !orbit) {
    return (
      <div className={fell.className} style={{ ...root, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: "9cqh", letterSpacing: "0.08em" }}>GROUND TRACK</div>
          <div style={{ fontStyle: "italic", fontSize: "4cqh" }}>{def.subtitle}</div>
          <div style={{ fontSize: "3.2cqh", marginTop: "4cqh", opacity: 0.8 }}>Watching: PRISM is choosing an orbit.</div>
          <div style={{ fontSize: "2.6cqh", marginTop: "1cqh", fontStyle: "italic", opacity: 0.7 }}>Ground track: {GLOSS_TRACK.toLowerCase()}</div>
        </div>
      </div>
    );
  }
  const e = live.e;
  return (
    <div className={fell.className} style={{ ...root, padding: "3cqh 3cqw", display: "grid", gridTemplateRows: "auto 1fr", gap: "2cqh" }}>
      <style>{rangeCss}</style>
      <header style={{ display: "flex", alignItems: "baseline", gap: "2cqw" }}>
        <div style={{ fontSize: "7cqh", letterSpacing: "0.08em", lineHeight: 1 }}>GROUND TRACK</div>
        <div style={{ fontStyle: "italic", fontSize: "3.4cqh" }}>{def.subtitle}</div>
        <div style={{ marginLeft: "auto", fontSize: "3cqh", fontStyle: "italic" }}>{live.objective ?? ""}</div>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 25cqw", gap: "2.4cqw", minHeight: 0 }}>
        <div style={{ display: "grid", alignContent: "start", gap: "1cqh", minHeight: 0 }}>
          <div style={{ width: "100%", aspectRatio: "362 / 182", maxHeight: "68cqh" }}>
            <TrackMap orbit={orbit} paint={live.paint} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "3cqh", fontStyle: "italic" }}>
            <span>
              <span style={{ color: ROUTE }}>━</span> Daylight Pass &nbsp; <span style={{ opacity: 0.6 }}>┄</span> Night Pass &nbsp; <span style={{ color: ROUTE }}>▨</span> Africa Photographed
            </span>
            <span>Day {Math.min(7, Math.floor(live.paint * 7) + 1)} of 7</span>
          </div>
        </div>
        <div style={{ display: "grid", alignContent: "start", gap: "1.6cqh" }}>
          <div>
            <div style={{ fontVariant: "small-caps", fontSize: "2.6cqh", opacity: 0.8 }}>Orbit</div>
            <div style={{ fontSize: "4.6cqh", color: ROUTE, lineHeight: 1.1 }}>{orbit.name}</div>
            <div style={{ fontSize: "2.6cqh", fontStyle: "italic", opacity: 0.8 }}>Tilt {fmt(tiltDeg(orbit))}°, once around every {Math.round(orbit.periodMin)} minutes</div>
          </div>
          <Readouts e={e} covNow={live.covNow} big />
          {live.locked ? (
            <div style={{ display: "grid", gap: "1cqh", justifyItems: "start" }}>
              <Stamp text="Orbit Chosen" big />
              <div style={{ fontSize: "3.2cqh" }}>{e.note}</div>
            </div>
          ) : (
            e.lines.slice(0, 1).map((l) => (
              <div key={l} style={{ fontSize: "2.8cqh", fontStyle: "italic", color: ROUTE, borderLeft: `0.4cqw solid ${ROUTE}`, paddingLeft: "1cqw" }}>
                {l}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function GroundTrack({ mode, live, sendLive, finish, ctx }: MinigameProps<GTLive>) {
  if (mode === "watch") return <Watch live={live} />;
  return <Play ctx={ctx} sendLive={sendLive} finish={finish} />;
}

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, set: { orbit: 'sso-550' }, note: '550 km sun-synchronous: same time of day, every day.' });

const def: MinigameDef = {
  id: "ground-track",
  title: "GROUND TRACK",
  subtitle: "Choose the path you trace over the world",
  howTo: "Slide altitude and tilt; watch a week of passes paint the map.",
  owner: "prism",
  wipe: "#EFE4C8",
  Component: GroundTrack,
  autoResolve,
};
export default def;
