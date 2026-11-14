"use client";
// DOWNLINK (owner VECTOR): a rhythm game where beats only count while a ground station is
// overhead. One day of operations: storage fills between passes at the instruments' data rate,
// overflow is lost, and every beat you hit sends a packet home. Numbers come from ctx.sim.
// Style (Art Bible 3): green CRT terminal with scanlines, #031208 and phosphor #33FF66, VT323.
import { VT323 } from "next/font/google";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MinigameDef, MinigameProps } from "@/lib/minigames/types";
import type { MinigameResult } from "@/lib/protocol";
import type { Sim } from "@/lib/game/sim";

const vt = VT323({ weight: "400", subsets: ["latin"] });

const BG = "#031208";
const PH = "#33FF66";

// Words Bible section 7 (win line, lose line) and section 5 (glossary).
const LOSE = "Your storage overflowed between passes. More stations, a faster radio or onboard compression would fix it.";
const homeLine = (mb: number) => `${fmtMB(mb)} MB home.`;
const GLOSS_PASS = "Pass: the few minutes a ground station can see your spacecraft.";
const GLOSS_DOWNLINK = "Downlink: sending data from the spacecraft to the ground.";

const fmtMB = (n: number) => (n < 10 ? (Math.round(n * 10) / 10).toLocaleString("en-US") : Math.round(n).toLocaleString("en-US"));
const pct = (n: number) => `${Math.round(n * 100)}%`;

// ---------- Config from the design ----------

interface Cfg {
  passesPerDay: number;
  visual: number; // passes shown in the game (20 a day are grouped into 8)
  beatsPerPass: number;
  beatS: number;
  lead: number;
  gap: number;
  pad: number;
  passDur: number;
  day: number; // game seconds for one whole day
  perPass: number; // MB per real pass (as stored, after compression)
  mbPerBeat: number;
  compress: number;
  gen: number; // raw MB a day
  storageMB: number;
  startBacklog: number;
  win: number; // hit window, seconds either side
  perfect: number;
  radio: string;
  ground: string;
  link: boolean;
  shortfall: boolean; // the design itself cannot get half the data home
  dataLine: string | null;
}

function makeCfg(sim: Sim): Cfg {
  const passesPerDay = sim.passesPerDay;
  const perPass = sim.perPassMB;
  const compress = sim.parts.find((p) => p.compress)?.compress ?? 1;
  const storageMB = (sim.parts.find((p) => p.storageGB)?.storageGB ?? 2) * 1000;
  const radio = sim.parts.find((p) => p.slot === "radio")?.name ?? "No radio";
  const ground = sim.parts.find((p) => p.slot === "ground")?.name ?? "No ground station";
  const link = passesPerDay > 0 && perPass > 0;
  const visual = Math.max(1, Math.min(passesPerDay, 8));
  const beatsPerPass = 8;
  // Difficulty from the design: a faster radio means a faster beat; onboard compression packs
  // more into each packet, so the hit window is tighter.
  const bpm = perPass >= 10 ? 124 : 96;
  const beatS = 60 / bpm;
  const pad = 0.9;
  const passDur = pad * 2 + (beatsPerPass - 1) * beatS;
  const lead = 2.6;
  const gap = 3;
  const day = lead + visual * passDur + (visual - 1) * gap + 1.6;
  const stored = sim.dataGenMBday / compress; // MB a day written to storage
  const capacity = passesPerDay * perPass; // MB a day the link can carry
  // Mission day 30: a design that can't keep up has been filling its storage for a month.
  const surplus = stored - capacity;
  const startBacklog = Math.min(storageMB, surplus > 0 ? surplus * 29 : stored * 0.2);
  const dataLine = sim.checks.find((c) => c.id === "data")?.line ?? null;
  return {
    passesPerDay,
    visual,
    beatsPerPass,
    beatS,
    lead,
    gap,
    pad,
    passDur,
    day,
    perPass,
    mbPerBeat: link ? (perPass * passesPerDay) / visual / beatsPerPass : 0,
    compress,
    gen: sim.dataGenMBday,
    storageMB,
    startBacklog,
    win: compress > 1 ? 0.12 : 0.15,
    perfect: 0.06,
    radio,
    ground,
    link,
    shortfall: sim.dataGenMBday > 0 && sim.delivered < 0.5,
    dataLine,
  };
}

const passStart = (c: Cfg, k: number) => c.lead + k * (c.passDur + c.gap);
const beatTime = (c: Cfg, i: number) => passStart(c, Math.floor(i / c.beatsPerPass)) + c.pad + (i % c.beatsPerPass) * c.beatS;
const totalBeats = (c: Cfg) => c.visual * c.beatsPerPass;
function passAt(c: Cfg, t: number): number {
  for (let k = 0; k < c.visual; k++) {
    const s = passStart(c, k);
    if (t >= s && t <= s + c.passDur) return k;
  }
  return -1;
}
function nextPass(c: Cfg, t: number): number {
  for (let k = 0; k < c.visual; k++) if (passStart(c, k) > t) return k;
  return -1;
}
const clock = (c: Cfg, t: number) => {
  const m = Math.max(0, Math.min(1439, Math.floor((t / c.day) * 1440)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// ---------- Live frame ----------

type Judge = "perfect" | "good" | "miss" | "nosignal";
interface DLLive {
  phase: "intro" | "run" | "done";
  cfg: Cfg;
  t: number;
  backlog: number; // MB on board
  sentRaw: number; // MB home (as collected)
  lostRaw: number; // MB lost to overflow (as collected)
  marks: string; // per beat: . pending, P perfect, G good, X miss
  judge: { k: Judge; t: number } | null;
  score?: number;
  note?: string;
}

function initial(cfg: Cfg): DLLive {
  return { phase: "intro", cfg, t: 0, backlog: cfg.startBacklog, sentRaw: 0, lostRaw: 0, marks: ".".repeat(totalBeats(cfg)), judge: null };
}

function resultOf(v: DLLive): MinigameResult {
  const n = totalBeats(v.cfg);
  const hits = [...v.marks].filter((m) => m === "P" || m === "G").length;
  const score = n ? Math.round((hits / n) * 100) / 100 : 0;
  const short = !v.cfg.link || v.cfg.shortfall || v.lostRaw > 0.05;
  return { score, note: short ? `${homeLine(v.sentRaw)} ${LOSE}` : homeLine(v.sentRaw) };
}

// ---------- Sound (Web Audio, synthesized; no files) ----------

function makeSound() {
  let ac: AudioContext | null = null;
  const ensure = () => {
    if (!ac && typeof window !== "undefined") {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) ac = new Ctor();
    }
    return ac;
  };
  const tone = (f: number, dur: number, gain: number, type: OscillatorType = "square", at = 0) => {
    const a = ensure();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    const t0 = a.currentTime + at;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  };
  return {
    unlock: () => void ensure()?.resume(),
    tick: () => tone(1200, 0.03, 0.025, "square"),
    hit: (perfect: boolean) => tone(perfect ? 1760 : 1320, 0.07, 0.05, "square"),
    miss: () => tone(140, 0.12, 0.04, "sawtooth"),
    // Modem chirp: a quick run of FSK tones when a station comes overhead.
    chirp: () => [1070, 1270, 2025, 2225, 1270, 2025, 1070, 2225].forEach((f, i) => tone(f, 0.05, 0.03, "square", i * 0.045)),
    close: () => void ac?.close(),
  };
}

// ---------- Drawing (shared by play and watch) ----------

const css = `
.dl-root{position:absolute;inset:0;background:${BG};color:${PH};overflow:hidden;text-shadow:0 0 6px ${PH}88}
.dl-root::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0,rgba(0,0,0,0) 2px,rgba(0,0,0,.28) 3px,rgba(0,0,0,0) 4px);z-index:5}
.dl-root::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(ellipse at center,rgba(51,255,102,.07),rgba(0,0,0,.45) 85%);z-index:4}
.dl-btn{font:inherit;color:${BG};background:${PH};border:none;border-radius:6px;cursor:pointer;text-shadow:none;width:100%;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}
.dl-btn:active{filter:brightness(.8)}
.dl-ghost{font:inherit;color:${PH};background:transparent;border:2px solid ${PH};border-radius:6px;cursor:pointer;width:100%}
@keyframes dl-blink{50%{opacity:0}}
.dl-blink{animation:dl-blink 1s steps(1) infinite}
`;

function Bar({ fill }: { fill: number }) {
  return (
    <div style={{ height: "100%", minHeight: 10, border: `2px solid ${PH}`, padding: 2 }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, fill)) * 100}%`, background: PH }} />
    </div>
  );
}

function Sky({ cfg, t }: { cfg: Cfg; t: number }) {
  const k = passAt(cfg, t);
  const f = k >= 0 ? (t - passStart(cfg, k)) / cfg.passDur : 0;
  const sx = 20 + 260 * f;
  const sy = 64 - Math.sin(Math.PI * f) * 50;
  const arc = Array.from({ length: 21 }, (_, i) => {
    const q = i / 20;
    return `${i ? "L" : "M"}${(20 + 260 * q).toFixed(1)} ${(64 - Math.sin(Math.PI * q) * 50).toFixed(1)}`;
  }).join("");
  return (
    <svg viewBox="0 0 300 80" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      <path d="M0 70H300" stroke={PH} strokeWidth={1.5} />
      {[10, 40, 90, 130, 175, 220, 265].map((x) => (
        <path key={x} d={`M${x} 74h8`} stroke={PH} strokeOpacity={0.4} />
      ))}
      <path d={arc} fill="none" stroke={PH} strokeOpacity={k >= 0 ? 0.55 : 0.18} strokeDasharray="2 4" />
      {/* ground station dish */}
      <path d="M150 70V60M140 52Q150 66 160 52M150 60L156 50" fill="none" stroke={PH} strokeWidth={2} />
      {k >= 0 && (
        <>
          <path d={`M150 56L${sx.toFixed(1)} ${sy.toFixed(1)}`} stroke={PH} strokeOpacity={0.5} strokeDasharray="3 3" />
          <g transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`}>
            <rect x={-4} y={-3} width={8} height={6} fill={PH} />
            <path d="M-12 0H-5M5 0H12" stroke={PH} strokeWidth={3} />
          </g>
        </>
      )}
    </svg>
  );
}

function DayStrip({ cfg, t }: { cfg: Cfg; t: number }) {
  return (
    <svg viewBox="0 0 300 16" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      <path d="M0 8H300" stroke={PH} strokeOpacity={0.35} />
      {Array.from({ length: cfg.visual }, (_, k) => {
        const s = passStart(cfg, k);
        const x = (s / cfg.day) * 300;
        const w = (cfg.passDur / cfg.day) * 300;
        const done = t > s + cfg.passDur;
        const now = t >= s && !done;
        return <rect key={k} x={x} y={2} width={w} height={12} fill={done || now ? PH : "none"} fillOpacity={now ? 1 : 0.45} stroke={PH} strokeWidth={1} />;
      })}
      <path d={`M${((t / cfg.day) * 300).toFixed(1)} 0V16`} stroke={PH} strokeWidth={2} />
    </svg>
  );
}

const APPROACH = 1.7; // seconds a beat takes to fall to the line

function Lane({ v, t }: { v: DLLive; t: number }) {
  const { cfg } = v;
  const H = 200;
  const hitY = 172;
  const notes: { y: number; m: string; i: number }[] = [];
  for (let i = 0; i < totalBeats(cfg); i++) {
    const dt = beatTime(cfg, i) - t;
    if (dt > APPROACH || dt < -0.35) continue;
    notes.push({ y: hitY - (dt / APPROACH) * (hitY - 8), m: v.marks[i] ?? ".", i });
  }
  const k = passAt(cfg, t);
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      <rect x={1} y={1} width={98} height={H - 2} fill="none" stroke={PH} strokeOpacity={0.5} />
      {k < 0 && <rect x={1} y={1} width={98} height={H - 2} fill={PH} fillOpacity={0.04} />}
      <path d={`M2 ${hitY}H98`} stroke={PH} strokeWidth={k >= 0 ? 3 : 1} strokeOpacity={k >= 0 ? 1 : 0.35} />
      <path d={`M2 ${hitY - 9}H98M2 ${hitY + 9}H98`} stroke={PH} strokeOpacity={0.25} strokeDasharray="2 3" />
      {notes.map((n) =>
        n.m === "." ? (
          <rect key={n.i} x={20} y={n.y - 5} width={60} height={10} fill={PH} />
        ) : n.m === "X" ? (
          <rect key={n.i} x={20} y={n.y - 5} width={60} height={10} fill="none" stroke={PH} strokeOpacity={0.5} strokeDasharray="3 2" />
        ) : (
          <rect key={n.i} x={10} y={hitY - 7} width={80} height={14} fill="none" stroke={PH} strokeWidth={2} opacity={Math.max(0, 1 - (t - beatTime(cfg, n.i)) * 3)} />
        ),
      )}
    </svg>
  );
}

const JUDGE_TEXT: Record<Judge, string> = { perfect: "PERFECT", good: "GOOD", miss: "MISS", nosignal: "NO SIGNAL" };

function Screen({ v, t, big, onTap }: { v: DLLive; t: number; big?: boolean; onTap?: () => void }) {
  const { cfg } = v;
  const k = passAt(cfg, t);
  const nk = nextPass(cfg, t);
  const n = totalBeats(cfg);
  const hits = [...v.marks].filter((m) => m === "P" || m === "G").length;
  const misses = [...v.marks].filter((m) => m === "X").length;
  const full = v.backlog >= cfg.storageMB - 0.5;
  const judge = v.judge && t - v.judge.t < 0.6 ? v.judge.k : null;
  const fs = (phone: number, cq: number) => (big ? `${cq}cqh` : `${phone}px`);
  const status =
    k >= 0
      ? `Station overhead: pass ${Math.min(cfg.visual, k + 1)} of ${cfg.visual}`
      : nk >= 0
        ? `No station in view. Next pass ${clock(cfg, passStart(cfg, nk))}`
        : "No station in view";
  const meters = (
    <div style={{ display: "grid", gap: big ? "1.2cqh" : 6 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(19, 3.6) }}>
          <span>Storage</span>
          <span>
            {fmtMB(v.backlog)} of {fmtMB(cfg.storageMB)} MB
          </span>
        </div>
        <div style={{ height: big ? "3.4cqh" : 18 }}>
          <Bar fill={v.backlog / cfg.storageMB} />
        </div>
        {full && (
          <div className="dl-blink" style={{ fontSize: fs(19, 3.6) }}>
            OVERFLOW: DATA LOST
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: fs(18, 3.4) }}>
        <div>
          <div style={{ opacity: 0.7 }}>Sent Home</div>
          <div style={{ fontSize: fs(26, 5.4) }}>{fmtMB(v.sentRaw)} MB</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>Lost</div>
          <div style={{ fontSize: fs(26, 5.4) }}>{fmtMB(v.lostRaw)} MB</div>
        </div>
        <div>
          <div style={{ opacity: 0.7 }}>Hits</div>
          <div style={{ fontSize: fs(26, 5.4) }}>
            {hits}/{n}
          </div>
        </div>
      </div>
    </div>
  );
  const lane = (
    <div
      onPointerDown={onTap ? (e) => (e.preventDefault(), onTap()) : undefined}
      style={{ position: "relative", height: "100%", minHeight: 0, touchAction: "none", cursor: onTap ? "pointer" : "default" }}
    >
      <Lane v={v} t={t} />
      {judge && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "38%", textAlign: "center", fontSize: fs(40, 8) }}>
          <span style={{ background: BG, padding: "0 0.4em", boxShadow: `0 0 0 2px ${PH}` }}>{JUDGE_TEXT[judge]}</span>
        </div>
      )}
      {k < 0 && !judge && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "38%", textAlign: "center", fontSize: fs(22, 4.4), opacity: 0.6 }}>NO CARRIER</div>
      )}
    </div>
  );
  const head = (
    <div style={{ display: "flex", alignItems: big ? "baseline" : "flex-start", gap: big ? "2cqw" : 10 }}>
      <div style={{ display: "flex", flexDirection: big ? "row" : "column", alignItems: big ? "baseline" : "flex-start", gap: big ? "2cqw" : 2 }}>
        <div style={{ fontSize: fs(42, 9), lineHeight: 0.9 }}>DOWNLINK</div>
        <div style={{ fontSize: fs(18, 3.8), opacity: 0.8, whiteSpace: "nowrap" }}>{def.subtitle}</div>
      </div>
      <div style={{ marginLeft: "auto", fontSize: fs(22, 4), textAlign: "right", whiteSpace: "nowrap" }}>
        Mission Day 30
        <br />
        {clock(cfg, t)}
      </div>
    </div>
  );
  if (big) {
    return (
      <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr", gap: "2cqh", padding: "3cqh 3cqw" }}>
        {head}
        <div style={{ height: "3cqh" }}>
          <DayStrip cfg={cfg} t={t} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "30cqw 1fr", gap: "3cqw", minHeight: 0 }}>
          {lane}
          <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: "2cqh", minHeight: 0 }}>
            <div style={{ height: "24cqh" }}>
              <Sky cfg={cfg} t={t} />
            </div>
            <div style={{ fontSize: "4.2cqh" }}>&gt; {status}</div>
            <div style={{ display: "grid", alignContent: "end", gap: "2cqh" }}>
              {meters}
              <div style={{ fontSize: "3.2cqh", opacity: 0.75 }}>
                {cfg.radio}, {fmtMB(cfg.perPass * cfg.compress)} MB a pass. {cfg.ground}, {cfg.passesPerDay} passes a day.
                {misses ? ` ${misses} missed.` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto auto 74px auto 1fr auto auto", gap: 8, padding: "12px 12px 14px" }}>
      {head}
      <div style={{ height: 14 }}>
        <DayStrip cfg={cfg} t={t} />
      </div>
      <Sky cfg={cfg} t={t} />
      <div style={{ fontSize: 19 }}>&gt; {status}</div>
      {lane}
      {meters}
      {onTap && (
        <button className="dl-btn" style={{ fontSize: 34, height: 76 }} onPointerDown={(e) => (e.preventDefault(), onTap())}>
          Transmit
        </button>
      )}
    </div>
  );
}

// ---------- Play ----------

function Play({ ctx, sendLive, finish }: Pick<MinigameProps<DLLive>, "ctx" | "sendLive" | "finish">) {
  const [v, setV] = useState<DLLive>(() => initial(makeCfg(ctx.sim)));
  const game = useRef<DLLive>(v);
  const sound = useRef<ReturnType<typeof makeSound> | null>(null);
  const t0 = useRef(0);
  const finishRef = useRef(finish);
  const done = useRef(false);
  const result = useRef<MinigameResult | null>(null);
  useEffect(() => {
    finishRef.current = finish;
  });
  const fire = () => {
    if (done.current || !result.current) return;
    done.current = true;
    finishRef.current(result.current);
  };
  useEffect(
    () => () => {
      fire();
      sound.current?.close();
    },
    [],
  );

  // Mirror every frame; a slow heartbeat makes sure the last frame lands through the throttle.
  useEffect(() => {
    sendLive(v);
  }, [v, sendLive]);
  useEffect(() => {
    const id = setInterval(() => sendLive(game.current), 300);
    return () => clearInterval(id);
  }, [sendLive]);

  // The game loop.
  useEffect(() => {
    if (v.phase !== "run") return;
    let raf = 0;
    let lastBeat = -1;
    let lastPass = -1;
    const loop = (now: number) => {
      const g = { ...game.current };
      const c = g.cfg;
      // Time comes from the clock, not the frame count, so a dropped frame never skips data.
      const prev = g.t;
      g.t = Math.min(c.day, (now - t0.current) / 1000);
      const dt = Math.max(0, g.t - prev);
      // Storage fills all day; anything past full is lost.
      g.backlog += (c.gen / c.compress / c.day) * dt;
      if (g.backlog > c.storageMB) {
        g.lostRaw += (g.backlog - c.storageMB) * c.compress;
        g.backlog = c.storageMB;
      }
      // Beats that slid past the window are misses.
      let marks = g.marks;
      for (let i = 0; i < marks.length; i++) {
        if (marks[i] === "." && beatTime(c, i) < g.t - c.win) {
          marks = marks.slice(0, i) + "X" + marks.slice(i + 1);
          g.judge = { k: "miss", t: g.t };
          sound.current?.miss();
        }
      }
      g.marks = marks;
      // Metronome ticks and the modem chirp when a station comes overhead.
      const k = passAt(c, g.t);
      if (k >= 0 && k !== lastPass) {
        lastPass = k;
        sound.current?.chirp();
      }
      for (let i = lastBeat + 1; i < totalBeats(c) && beatTime(c, i) <= g.t; i++) {
        lastBeat = i;
        sound.current?.tick();
      }
      if (g.t >= c.day) {
        g.t = c.day;
        g.phase = "done";
        const r = resultOf(g);
        g.score = r.score;
        g.note = r.note;
        result.current = r;
        setTimeout(fire, 2600);
      }
      game.current = g;
      setV(g);
      if (g.phase === "run") raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [v.phase]); // the loop runs once per run phase

  const start = () => {
    sound.current ??= makeSound();
    sound.current.unlock();
    t0.current = performance.now();
    const g = { ...game.current, phase: "run" as const };
    game.current = g;
    setV(g);
  };

  const tap = () => {
    const g = { ...game.current };
    if (g.phase !== "run") return;
    const c = g.cfg;
    const t = (performance.now() - t0.current) / 1000;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < g.marks.length; i++) {
      if (g.marks[i] !== ".") continue;
      const d = Math.abs(beatTime(c, i) - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD <= c.win) {
      const perfect = bestD <= c.perfect;
      g.marks = g.marks.slice(0, best) + (perfect ? "P" : "G") + g.marks.slice(best + 1);
      const send = Math.min(g.backlog, c.mbPerBeat);
      g.backlog -= send;
      g.sentRaw += send * c.compress;
      g.judge = { k: perfect ? "perfect" : "good", t };
      sound.current?.hit(perfect);
    } else if (passAt(c, t) < 0) {
      g.judge = { k: "nosignal", t };
    } else return;
    game.current = g;
    setV(g);
  };

  // Keyboard for laptops: space or enter transmits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        if (game.current.phase !== "run") return;
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const c = v.cfg;
  if (v.phase === "intro") {
    const rows: [string, string][] = [
      ["Radio", `${c.radio}, ${fmtMB(c.perPass * c.compress)} MB a pass`],
      ["Ground", `${c.ground}, ${c.passesPerDay} passes a day`],
      ["Data", `${fmtMB(c.gen)} MB a day collected`],
      ["Storage", `${fmtMB(c.storageMB)} MB on board`],
      ["Compression", c.compress > 1 ? `${c.compress} times smaller` : "None"],
    ];
    return (
      <div style={{ height: "100%", display: "grid", alignContent: "start", gap: 12, padding: "16px 14px", overflowY: "auto" }}>
        <div style={{ fontSize: 56, lineHeight: 0.9 }}>DOWNLINK</div>
        <div style={{ fontSize: 22, opacity: 0.85 }}>{def.subtitle}</div>
        <div style={{ fontSize: 21, display: "grid", gap: 2 }}>
          {rows.map(([k, val]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "118px 1fr" }}>
              <span style={{ opacity: 0.7 }}>&gt; {k}</span>
              <span>{val}</span>
            </div>
          ))}
        </div>
        {c.dataLine && <div style={{ fontSize: 20, border: `2px dashed ${PH}`, padding: "8px 10px" }}>{c.dataLine}</div>}
        <div style={{ fontSize: 19, opacity: 0.8 }}>{GLOSS_PASS}</div>
        <div style={{ fontSize: 22 }}>{def.howTo}</div>
        {c.link ? (
          <button className="dl-btn" style={{ fontSize: 32, height: 70 }} onClick={start}>
            Start Downlink
          </button>
        ) : (
          <>
            <div className="dl-blink" style={{ fontSize: 28 }}>
              NO CARRIER
            </div>
            <div style={{ fontSize: 20 }}>No radio or ground station yet, so nothing can come home.</div>
            <button
              className="dl-ghost"
              style={{ fontSize: 28, height: 64 }}
              onClick={() => {
                result.current = { score: 0, note: `${homeLine(0)} ${LOSE}` };
                fire();
              }}
            >
              Continue
            </button>
          </>
        )}
      </div>
    );
  }
  if (v.phase === "done") return <Done v={v} />;
  return <Screen v={v} t={v.t} onTap={tap} />;
}

function Done({ v, big }: { v: DLLive; big?: boolean }) {
  const fs = (phone: number, cq: number) => (big ? `${cq}cqh` : `${phone}px`);
  return (
    <div style={{ height: "100%", display: "grid", alignContent: "center", gap: big ? "2.4cqh" : 14, padding: big ? "6cqh 8cqw" : "20px 16px" }}>
      <div style={{ fontSize: fs(30, 5), opacity: 0.8 }}>&gt; LINK CLOSED. DAY 30 COMPLETE.</div>
      <div style={{ fontSize: fs(64, 14), lineHeight: 0.9 }}>{fmtMB(v.sentRaw)} MB HOME</div>
      <div style={{ fontSize: fs(26, 5) }}>
        Hit rate {pct(v.score ?? 0)}. Lost to overflow: {fmtMB(v.lostRaw)} MB.
      </div>
      <div style={{ fontSize: fs(24, 4.6), borderLeft: `4px solid ${PH}`, paddingLeft: big ? "1.4cqw" : 10 }}>{v.note}</div>
      <div style={{ fontSize: fs(19, 3.4), opacity: 0.7 }}>{GLOSS_DOWNLINK}</div>
    </div>
  );
}

// ---------- Watch ----------

function Watch({ live }: { live: DLLive | null }) {
  const liveRef = useRef(live);
  const [t, setT] = useState(live?.t ?? 0);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  // Smooth the ~10 frames a second into a moving lane.
  useEffect(() => {
    let raf = 0;
    let lastT = -1;
    let at = 0;
    const loop = (now: number) => {
      const l = liveRef.current;
      if (l) {
        if (l.t !== lastT) {
          lastT = l.t;
          at = now;
        }
        setT(l.phase === "run" ? Math.min(l.t + (now - at) / 1000, l.t + 0.35) : l.t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!live || live.phase === "intro") {
    return (
      <div style={{ height: "100%", display: "grid", alignContent: "center", justifyItems: "center", gap: "2cqh", textAlign: "center" }}>
        <div style={{ fontSize: "16cqh", lineHeight: 0.9 }}>DOWNLINK</div>
        <div style={{ fontSize: "5cqh" }}>{def.subtitle}</div>
        <div style={{ fontSize: "4cqh", opacity: 0.8 }}>Watching: VECTOR is getting the data home.</div>
        <div style={{ fontSize: "3.4cqh", opacity: 0.65 }}>{GLOSS_PASS}</div>
        <div className="dl-blink" style={{ fontSize: "4cqh" }}>
          _
        </div>
      </div>
    );
  }
  if (live.phase === "done") return <Done v={live} big />;
  return <Screen v={live} t={t} big />;
}

function Downlink({ mode, live, sendLive, finish, ctx }: MinigameProps<DLLive>) {
  const root: CSSProperties = mode === "watch" ? { containerType: "size" } : {};
  return (
    <div className={`dl-root ${vt.className}`} style={root}>
      <style>{css}</style>
      <div style={{ position: "relative", height: "100%", zIndex: 1 }}>{mode === "watch" ? <Watch live={live} /> : <Play ctx={ctx} sendLive={sendLive} finish={finish} />}</div>
    </div>
  );
}

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, note: 'Some of the data made it home.' });

const def: MinigameDef = {
  id: "downlink",
  title: "DOWNLINK",
  subtitle: "Get the data home",
  howTo: "Tap to the beat while the station is overhead.",
  owner: "vector",
  wipe: "#031208",
  Component: Downlink,
  autoResolve,
};
export default def;
