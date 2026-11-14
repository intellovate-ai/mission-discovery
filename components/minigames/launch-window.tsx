"use client";
// LAUNCH WINDOW (owner VECTOR). 8-bit arcade, Press Start 2P, a strict 4 color palette.
// A needle sweeps faster as the count runs down; tap while it sits in the green window.
// The window narrows as the payload's mass climbs toward the rocket's limit.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Press_Start_2P } from "next/font/google";
import type { MinigameContext, MinigameDef, MinigameProps } from "@/lib/minigames/types";
import type { MinigameResult } from "@/lib/protocol";
import type { Sim } from "@/lib/game/sim";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"] });

// The only four colors in this world.
const NIGHT = "#0F0F1B";
const WHITE = "#F2F2F2";
const RED = "#E43B44";
const GREEN = "#63C74D";

const TITLE = "LAUNCH WINDOW";
const SUBTITLE = "Go at exactly the right moment";
const HOW_TO = "Tap when the needle is in the green.";
const WIN = "Clean launch. Right on target.";
const LOSE = "A little late, so the orbit is off. Fixing it later costs fuel.";
const COUNT_S = 10;
const SEGMENTS = 24;

type Phase = "count" | "launched";

export interface LaunchWindowLive {
  needle: number; // 0..1
  center: number; // window center 0..1
  width: number; // window width 0..1
  tMinus: number;
  phase: Phase;
  hit: boolean;
  accuracy: number; // 0..100
  lift: number; // 0..1 rocket climb after launch
  massKg: number;
  limitKg: number;
  rocketName: string;
  note: string;
}

/** The payload's share of what the ride can lift, and the window that leaves. */
function windowFor(sim: Sim) {
  const limitKg = sim.rocket?.maxMassKg ?? sim.maxMassKg;
  const ratio = Math.min(1, Math.max(0, sim.massKg / Math.max(0.1, limitKg)));
  const width = Math.max(0.04, 0.18 * Math.pow(1 - ratio, 1.2));
  return { limitKg, ratio, width };
}

function grade(needle: number, center: number, width: number) {
  const d = Math.abs(needle - center);
  const half = width / 2;
  const hit = d <= half;
  const score = hit ? 0.7 + 0.3 * (1 - d / half) : Math.max(0.05, 0.6 - (d - half) * 3);
  const accuracy = Math.max(0, Math.round(100 * (1 - d / Math.max(half, 0.0001) / 4)));
  return { hit, score: Math.round(score * 100) / 100, accuracy: hit ? Math.max(accuracy, 75) : Math.min(accuracy, 74) };
}

/** Needle and window at a moment in the count (seconds since start). Pure, so a tap is graded at its own instant. */
function motion(elapsed: number) {
  // Sweeps run faster as the count runs down.
  const f = (0.5 * elapsed + 0.055 * elapsed * elapsed) % 2;
  return { needle: f <= 1 ? f : 2 - f, center: 0.5 + 0.3 * Math.sin(elapsed * 0.8 + 0.6) };
}

// --- Sound sting: chiptune blips from a square wave, no audio files ---
let ac: AudioContext | null = null;
function blip(freqs: number[], step = 0.07, gain = 0.08) {
  try {
    ac ??= new AudioContext();
    if (ac.state === "suspended") void ac.resume();
    const t0 = ac.currentTime;
    freqs.forEach((f, i) => {
      const o = ac!.createOscillator();
      const g = ac!.createGain();
      o.type = "square";
      o.frequency.value = f;
      g.gain.setValueAtTime(gain, t0 + i * step);
      g.gain.setValueAtTime(0, t0 + (i + 1) * step - 0.005);
      o.connect(g).connect(ac!.destination);
      o.start(t0 + i * step);
      o.stop(t0 + (i + 1) * step);
    });
  } catch {
    /* no audio: fine */
  }
}

// --- Pixel art ---
const ROCKET = [
  "....W....",
  "...WWW...",
  "..WWWWW..",
  "..WWRWW..",
  "..WRRRW..",
  "..WWRWW..",
  "..WWWWW..",
  "..WWWWW..",
  "..WWWWW..",
  "..WRWRW..",
  "..WWWWW..",
  ".RWWWWWR.",
  "RRWWWWWRR",
  "RR.W.W.RR",
];
const FLAME = ["...RWR...", "....R....", "...R.R..."];

function Sprite({ rows, px, flame }: { rows: string[]; px: number; flame: boolean }) {
  const all = flame ? [...rows, ...FLAME] : rows;
  const w = rows[0].length;
  return (
    <svg width={w * px} height={all.length * px} viewBox={`0 0 ${w} ${all.length}`} shapeRendering="crispEdges" style={{ display: "block" }}>
      {all.flatMap((r, y) =>
        r.split("").map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c === "R" ? RED : c === "G" ? GREEN : WHITE} />)),
      )}
    </svg>
  );
}

// Fixed star field (deterministic so server and client render the same).
const STARS = Array.from({ length: 36 }, (_, i) => ({ x: (i * 37 + 11) % 100, y: (i * 53 + 7) % 70 }));

function Gauge({ live, h }: { live: LaunchWindowLive; h: string }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", gap: "0.6%", height: h }}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const s = (i + 0.5) / SEGMENTS;
          const inWin = Math.abs(s - live.center) <= live.width / 2 + 0.5 / SEGMENTS - 0.001;
          return <div key={i} style={{ flex: 1, background: inWin ? GREEN : NIGHT, border: inWin ? "none" : `3px solid ${WHITE}` }} />;
        })}
      </div>
      {/* the needle */}
      <div
        style={{
          position: "absolute",
          top: `calc(-0.6 * ${h})`,
          bottom: `calc(-0.6 * ${h})`,
          left: `${live.needle * 100}%`,
          width: 6,
          marginLeft: -3,
          background: live.phase === "launched" ? (live.hit ? GREEN : RED) : WHITE,
          transition: "left 100ms linear",
        }}
      />
    </div>
  );
}

function Scene({ live, mode, onTap, onContinue }: { live: LaunchWindowLive; mode: "play" | "watch"; onTap?: () => void; onContinue?: () => void }) {
  const play = mode === "play";
  const t = Math.ceil(live.tMinus);
  const climb = live.lift * (play ? 120 : 110); // cqh
  const px = play ? 9 : 1.1;
  return (
    <div className={pixel.className} style={{ position: "absolute", inset: 0, background: NIGHT, color: WHITE, containerType: "size", overflow: "hidden", imageRendering: "pixelated" }}>
      {STARS.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: 4, height: 4, background: i % 9 === 0 ? GREEN : WHITE }} />
      ))}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: play ? 18 : "4cqh 4cqw", gap: play ? 16 : "3cqh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: play ? 18 : "6cqh", lineHeight: 1.3, color: WHITE }}>{TITLE}</div>
            <div style={{ fontSize: play ? 10 : "2.6cqh", lineHeight: 1.6, marginTop: play ? 6 : "1cqh" }}>{SUBTITLE}</div>
          </div>
          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <div style={{ fontSize: play ? 10 : "2.4cqh" }}>T MINUS</div>
            <div style={{ fontSize: play ? 30 : "10cqh", lineHeight: 1.2, color: t <= 3 && live.phase === "count" ? RED : WHITE }}>{String(Math.max(0, t)).padStart(2, "0")}</div>
          </div>
        </div>

        <div style={{ fontSize: play ? 10 : "2.5cqh", lineHeight: 1.8, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>
            PAYLOAD {live.massKg.toFixed(1)} KG
          </span>
          <span style={{ color: live.width < 0.09 ? RED : GREEN }}>
            LIMIT {live.limitKg} KG
          </span>
        </div>

        <div style={{ padding: play ? "10px 0" : "2cqh 0" }}>
          <Gauge live={live} h={play ? "34px" : "9cqh"} />
        </div>

        {/* launch pad and rocket */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: play ? 14 : "3cqh", background: GREEN }} />
          <div style={{ position: "absolute", left: "50%", bottom: play ? 14 : "3cqh", transform: `translate(-50%, ${-climb}cqh)`, transition: "transform 120ms linear" }}>
            <div style={{ width: play ? undefined : `${9 * px}cqh` }}>
              {play ? (
                <Sprite rows={ROCKET} px={px} flame={live.phase === "launched"} />
              ) : (
                <WatchSprite flame={live.phase === "launched"} />
              )}
            </div>
          </div>
          {live.phase === "launched" && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, textAlign: "center", fontSize: play ? 13 : "3.6cqh", lineHeight: 1.8, color: live.hit ? GREEN : RED }}>
              ACCURACY {live.accuracy}%
            </div>
          )}
        </div>

        {play && live.phase === "count" && (
          <button
            onPointerDown={onTap}
            style={{ minHeight: 96, background: RED, color: WHITE, border: `4px solid ${WHITE}`, fontFamily: "inherit", fontSize: 22, touchAction: "manipulation", cursor: "pointer" }}
          >
            Launch
          </button>
        )}
        {live.phase === "launched" ? (
          <div style={{ fontSize: play ? 13 : "3.4cqh", lineHeight: 1.9, color: live.hit ? GREEN : RED, minHeight: play ? 0 : "8cqh" }}>{live.note}</div>
        ) : (
          !play && <div style={{ fontSize: "3cqh", lineHeight: 1.8 }}>{HOW_TO}</div>
        )}
        {play && live.phase === "launched" && (
          <button onClick={onContinue} style={{ minHeight: 64, background: NIGHT, color: WHITE, border: `4px solid ${WHITE}`, fontFamily: "inherit", fontSize: 16 }}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

/** Watch-side sprite that scales with the big screen's height. */
function WatchSprite({ flame }: { flame: boolean }) {
  const all = flame ? [...ROCKET, ...FLAME] : ROCKET;
  return (
    <svg viewBox={`0 0 9 ${all.length}`} shapeRendering="crispEdges" style={{ display: "block", width: "100%", height: "auto" }}>
      {all.flatMap((r, y) => r.split("").map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c === "R" ? RED : WHITE} />)))}
    </svg>
  );
}

// --- Play: VECTOR's phone ---
function Play({ ctx, sendLive, finish }: Pick<MinigameProps<LaunchWindowLive>, "ctx" | "sendLive" | "finish">) {
  const { limitKg, width } = useMemo(() => windowFor(ctx.sim), [ctx.sim]);
  const base = useMemo<Omit<LaunchWindowLive, "needle" | "center" | "tMinus" | "phase" | "hit" | "accuracy" | "lift" | "note">>(
    () => ({ width, massKg: ctx.sim.massKg, limitKg, rocketName: ctx.sim.rocket?.name ?? "" }),
    [width, ctx.sim.massKg, ctx.sim.rocket?.name, limitKg],
  );
  const [live, setLive] = useState<LaunchWindowLive>({ ...base, needle: 0, center: 0.5, tMinus: COUNT_S, phase: "count", hit: false, accuracy: 0, lift: 0, note: "" });
  const sim = useRef({ start: 0, pos: 0, center: 0.5, launchedAt: 0, lastTick: COUNT_S });
  const phaseRef = useRef<Phase>("count");
  const result = useRef<MinigameResult | null>(null);
  const done = useRef(false);

  const finishNow = useCallback(() => {
    if (done.current || !result.current) return;
    done.current = true;
    finish(result.current);
  }, [finish]);

  const launch = useCallback(() => {
    if (phaseRef.current !== "count") return;
    phaseRef.current = "launched";
    const s = sim.current;
    s.launchedAt = performance.now();
    const m = motion(Math.min(COUNT_S, (s.launchedAt - s.start) / 1000));
    s.pos = m.needle;
    s.center = m.center;
    const g = grade(s.pos, s.center, width);
    result.current = { score: g.score, note: g.hit ? WIN : LOSE };
    blip(g.hit ? [523, 659, 784, 1047] : [392, 330, 262, 196], 0.09, 0.09);
    const note = g.hit ? WIN : LOSE;
    setLive((l) => ({ ...l, needle: m.needle, center: m.center, phase: "launched", hit: g.hit, accuracy: g.accuracy, note }));
  }, [width]);

  // Game loop.
  useEffect(() => {
    const s = sim.current;
    s.start = performance.now();
    // A timer, not requestAnimationFrame, so the count keeps running even when the page is
    // not being painted (a hidden pane, a projector tab in the background).
    const loop = () => {
      const now = performance.now();
      const elapsed = (now - s.start) / 1000;
      if (phaseRef.current === "count") {
        const tMinus = Math.max(0, COUNT_S - elapsed);
        const m = motion(elapsed);
        s.pos = m.needle;
        s.center = m.center;
        const center = m.center;
        const tick = Math.ceil(tMinus);
        if (tick < s.lastTick) {
          s.lastTick = tick;
          blip([tick <= 3 ? 880 : 440], 0.05, 0.05);
        }
        const needle = m.needle;
        // Guarded: a tick queued before the tap must not move the needle after launch.
        setLive((l) => (l.phase === "count" ? { ...l, needle, center, tMinus } : l));
        if (tMinus <= 0) launch();
      } else {
        const t = (now - s.launchedAt) / 1000;
        setLive((l) => ({ ...l, lift: Math.min(1, (t * t) / 6) }));
      }
    };
    const id = setInterval(loop, 16);
    return () => clearInterval(id);
  }, [launch]);

  // Stream frames, and resend the latest so a throttled final frame still lands.
  const latest = useRef(live);
  useEffect(() => {
    latest.current = live;
    sendLive(live);
  }, [live, sendLive]);
  useEffect(() => {
    const id = setInterval(() => sendLive(latest.current), 300);
    return () => clearInterval(id);
  }, [sendLive]);

  // After the launch: show the line, then hand back.
  useEffect(() => {
    if (live.phase !== "launched") return;
    const id = setTimeout(finishNow, 4000);
    return () => clearTimeout(id);
  }, [live.phase, finishNow]);

  return <Scene live={live} mode="play" onTap={launch} onContinue={finishNow} />;
}

// --- Watch: the big screen ---
function Watch({ live }: { live: LaunchWindowLive | null }) {
  if (!live)
    return (
      <div className={pixel.className} style={{ position: "absolute", inset: 0, background: NIGHT, color: WHITE, containerType: "size", display: "grid", placeContent: "center", textAlign: "center", gap: "4cqh", padding: "4cqw" }}>
        <div style={{ fontSize: "7cqh", lineHeight: 1.3 }}>{TITLE}</div>
        <div style={{ fontSize: "3cqh", lineHeight: 1.6 }}>{SUBTITLE}</div>
        <div style={{ fontSize: "3cqh", lineHeight: 1.6, color: GREEN }}>{HOW_TO}</div>
        <div style={{ fontSize: "2.6cqh", lineHeight: 1.6 }}>Watching: VECTOR is waiting for the window.</div>
      </div>
    );
  return <Scene live={live} mode="watch" />;
}

function LaunchWindow({ mode, live, sendLive, finish, ctx }: MinigameProps<LaunchWindowLive>) {
  return mode === "play" ? <Play ctx={ctx} sendLive={sendLive} finish={finish} /> : <Watch live={live} />;
}

const autoResolve = (): MinigameResult => ({ score: 0.5, note: "A clean enough launch." });

const def: MinigameDef = {
  id: "launch-window",
  title: TITLE,
  subtitle: SUBTITLE,
  howTo: HOW_TO,
  owner: "vector",
  wipe: NIGHT,
  Component: LaunchWindow,
  autoResolve: autoResolve as (ctx: MinigameContext) => MinigameResult,
};
export default def;
