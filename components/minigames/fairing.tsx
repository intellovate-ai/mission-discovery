"use client";
// FAIRING (owner FORGE). Engineering blueprint on grid paper, B612 Mono.
// Pack the design's real parts (0.25U blocks) into the frame before the timer runs out.
// Play: the phone runs the puzzle and streams every frame. Watch: redraws from `live` only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { B612_Mono } from "next/font/google";
import type { MinigameContext, MinigameDef, MinigameProps } from "@/lib/minigames/types";
import type { MinigameResult } from "@/lib/protocol";
import type { Part } from "@/lib/game/data/ember";

const mono = B612_Mono({ weight: ["400", "700"], subsets: ["latin"] });

const BG = "#123A63";
const INK = "#E8F1FA";
const DIM = "rgba(232, 241, 250, 0.55)";
const FAINT = "rgba(232, 241, 250, 0.14)";
const TIME_S = 30;

const TITLE = "FAIRING";
const SUBTITLE = "Fit it inside the rocket";
const HOW_TO = "Rotate and drop each part into the frame.";
const LOSE = "It doesn't fit. Something bigger needs a bigger frame, or something has to go.";
const winLine = (margin: number) => `Packed with ${margin}% room to spare.`;

// Drawing codes stamped on each block, like a parts list on a real drawing.
const CODE: Partial<Record<string, string>> = {
  battery: "BATT",
  computer: "OBC",
  pointing: "ADCS",
  instrument1: "INST",
  instrument2: "INST",
  radio: "COMM",
  thruster: "PROP",
  solar: "SOLAR",
  heater: "HTR",
};

// Outside dimensions of real CubeSat frames in mm (CubeSat Design Specification).
const DIMS: Record<number, [number, number]> = { 1: [100, 113.5], 3: [100, 340.5], 6: [226.3, 366] };

interface Piece {
  name: string;
  code: string;
  volume: number;
  cells: number;
  w: number;
  h: number;
}
interface Placement {
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
type Phase = "play" | "won" | "lost";

export interface FairingLive {
  cols: number;
  rows: number;
  capU: number;
  pieces: { name: string; code: string; volume: number; placed: boolean }[];
  placements: Placement[];
  sel: number;
  ghost: { x: number; y: number; w: number; h: number } | null;
  timeLeft: number;
  phase: Phase;
  note: string;
  volumeU: number;
}

function frameGrid(capU: number) {
  const cells = Math.max(1, Math.round(capU * 4));
  const cols = capU >= 6 ? 4 : 2;
  return { cols, rows: Math.ceil(cells / cols) };
}

function toPieces(parts: Part[]): Piece[] {
  return parts
    .filter((p) => p.volume > 0)
    .map((p) => {
      const cells = Math.max(1, Math.round(p.volume / 0.25));
      const w = cells >= 4 ? 2 : cells;
      return { name: p.name, code: CODE[p.slot] ?? "PART", volume: p.volume, cells, w, h: Math.ceil(cells / w) };
    })
    .sort((a, b) => b.cells - a.cells);
}

const dims = (p: Piece, rot: boolean) => (rot ? { w: p.h, h: p.w } : { w: p.w, h: p.h });

function occupied(placements: Placement[], cols: number, rows: number) {
  const g = new Array<number>(cols * rows).fill(-1);
  for (const p of placements) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) g[y * cols + x] = p.i;
  return g;
}

/** Where a w×h block dropped in column x comes to rest (lowest top row), or -1. */
function landing(g: number[], cols: number, rows: number, x: number, w: number, h: number) {
  if (x < 0 || x + w > cols || h > rows) return -1;
  const fits = (y: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (g[yy * cols + xx] !== -1) return false;
    return true;
  };
  let best = -1;
  for (let y = 0; y + h <= rows; y++) {
    if (!fits(y)) break;
    best = y;
  }
  return best;
}

function anyFit(g: number[], cols: number, rows: number, p: Piece) {
  for (const rot of [false, true]) {
    const d = dims(p, rot);
    for (let x = 0; x + d.w <= cols; x++) if (landing(g, cols, rows, x, d.w, d.h) >= 0) return true;
  }
  return false;
}

// --- Sound sting: pencil scratch (filtered noise, no audio files) ---
let ac: AudioContext | null = null;
function scratch(len = 0.14, gain = 0.22) {
  try {
    ac ??= new AudioContext();
    if (ac.state === "suspended") void ac.resume();
    const n = Math.floor(ac.sampleRate * len);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * (0.6 + 0.4 * Math.sin(i / 90));
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3200;
    bp.Q.value = 0.9;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(ac.destination);
    src.start();
  } catch {
    /* no audio: fine */
  }
}

// --- The drawing (shared by play and watch) ---
function Drawing({ live, cell, onColumn }: { live: FairingLive; cell: number; onColumn?: (x: number) => void }) {
  const { cols, rows, placements, pieces, ghost } = live;
  const pad = cell * 0.9;
  const W = cols * cell + pad * 2;
  const H = rows * cell + pad * 2;
  const [mmW, mmH] = DIMS[live.capU] ?? [100 * (cols / 2), 113.5 * (rows / 2)];
  const fs = Math.max(9, cell * 0.2);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible", touchAction: "manipulation" }}>
      <defs>
        <pattern id="fairing-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={INK} strokeWidth="1" opacity="0.35" />
        </pattern>
      </defs>
      {/* dimension lines */}
      <g stroke={DIM} strokeWidth="1" fill="none">
        <line x1={pad} y1={pad * 0.35} x2={pad + cols * cell} y2={pad * 0.35} />
        <line x1={pad} y1={pad * 0.15} x2={pad} y2={pad * 0.6} />
        <line x1={pad + cols * cell} y1={pad * 0.15} x2={pad + cols * cell} y2={pad * 0.6} />
        <line x1={pad * 0.35} y1={pad} x2={pad * 0.35} y2={pad + rows * cell} />
        <line x1={pad * 0.15} y1={pad} x2={pad * 0.6} y2={pad} />
        <line x1={pad * 0.15} y1={pad + rows * cell} x2={pad * 0.6} y2={pad + rows * cell} />
      </g>
      <text x={pad + (cols * cell) / 2} y={pad * 0.35 - 4} fill={DIM} fontSize={fs} textAnchor="middle" className={mono.className}>
        {mmW} mm
      </text>
      <text
        x={pad * 0.35 - 4}
        y={pad + (rows * cell) / 2}
        fill={DIM}
        fontSize={fs}
        textAnchor="middle"
        transform={`rotate(-90 ${pad * 0.35 - 4} ${pad + (rows * cell) / 2})`}
        className={mono.className}
      >
        {mmH} mm
      </text>
      {/* 0.25U grid */}
      <g stroke={FAINT} strokeDasharray="3 4">
        {Array.from({ length: cols - 1 }, (_, i) => (
          <line key={`c${i}`} x1={pad + (i + 1) * cell} y1={pad} x2={pad + (i + 1) * cell} y2={pad + rows * cell} />
        ))}
        {Array.from({ length: rows - 1 }, (_, i) => (
          <line key={`r${i}`} x1={pad} y1={pad + (i + 1) * cell} x2={pad + cols * cell} y2={pad + (i + 1) * cell} />
        ))}
      </g>
      {/* 1U station marks */}
      {Array.from({ length: Math.floor(rows / 2) - 1 }, (_, i) => (
        <line key={`u${i}`} x1={pad - 6} y1={pad + (i + 1) * 2 * cell} x2={pad + cols * cell + 6} y2={pad + (i + 1) * 2 * cell} stroke={DIM} strokeWidth="1" />
      ))}
      {/* placed parts */}
      {placements.map((p) => {
        const pc = pieces[p.i];
        return (
          <g key={p.i}>
            <rect x={pad + p.x * cell + 2} y={pad + p.y * cell + 2} width={p.w * cell - 4} height={p.h * cell - 4} fill="url(#fairing-hatch)" stroke={INK} strokeWidth="2" />
            <rect x={pad + p.x * cell + cell * 0.12} y={pad + (p.y + p.h / 2) * cell - fs * 0.9} width={p.w * cell - cell * 0.24} height={fs * 1.8} fill={BG} />
            <text x={pad + (p.x + p.w / 2) * cell} y={pad + (p.y + p.h / 2) * cell + fs * 0.35} fill={INK} fontSize={fs} fontWeight={700} textAnchor="middle" className={mono.className}>
              {pc?.code}
            </text>
          </g>
        );
      })}
      {/* where the selected part will land */}
      {ghost && (
        <rect
          x={pad + ghost.x * cell + 3}
          y={pad + ghost.y * cell + 3}
          width={ghost.w * cell - 6}
          height={ghost.h * cell - 6}
          fill="rgba(232, 241, 250, 0.08)"
          stroke={INK}
          strokeWidth="2"
          strokeDasharray="8 6"
        />
      )}
      {/* frame outline */}
      <rect x={pad} y={pad} width={cols * cell} height={rows * cell} fill="none" stroke={INK} strokeWidth="3" />
      {/* tap targets: one per column */}
      {onColumn &&
        Array.from({ length: cols }, (_, i) => (
          <rect key={`t${i}`} x={pad + i * cell} y={pad} width={cell} height={rows * cell} fill="transparent" onPointerDown={() => onColumn(i)} style={{ cursor: "pointer" }} />
        ))}
    </svg>
  );
}

const paper: React.CSSProperties = {
  background: `linear-gradient(${FAINT} 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(90deg, ${FAINT} 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(rgba(232,241,250,0.05) 1px, transparent 1px) 0 0 / 8px 8px, linear-gradient(90deg, rgba(232,241,250,0.05) 1px, transparent 1px) 0 0 / 8px 8px, ${BG}`,
  color: INK,
};

function Clock({ t, size }: { t: number; size: number | string }) {
  const s = Math.ceil(t);
  return (
    <div style={{ fontSize: size, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: s <= 5 ? "#FFD27A" : INK }}>
      00:{String(s).padStart(2, "0")}
    </div>
  );
}

// --- Play: the owner's phone ---
function Play({ ctx, sendLive, finish }: Pick<MinigameProps<FairingLive>, "ctx" | "sendLive" | "finish">) {
  const capU = ctx.sim.capacityU;
  const { cols, rows } = useMemo(() => frameGrid(capU), [capU]);
  const pieces = useMemo(() => toPieces(ctx.sim.parts), [ctx.sim.parts]);
  const volumeU = pieces.reduce((a, p) => a + p.volume, 0);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [sel, setSel] = useState(0);
  const [rot, setRot] = useState(false);
  const [col, setCol] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_S);
  const [phase, setPhase] = useState<Phase>(pieces.length ? "play" : "won");
  const endsAt = useRef(0);
  const done = useRef(false);

  const margin = Math.max(0, Math.round((1 - volumeU / capU) * 100));
  const placedSet = useMemo(() => new Set(placements.map((p) => p.i)), [placements]);
  const g = useMemo(() => occupied(placements, cols, rows), [placements, cols, rows]);
  const piece = pieces[sel];
  const d = piece ? dims(piece, rot) : { w: 1, h: 1 };
  const x = Math.min(Math.max(0, col), Math.max(0, cols - d.w));
  const y = piece && phase === "play" ? landing(g, cols, rows, x, d.w, d.h) : -1;
  const ghost = y >= 0 ? { x, y, w: d.w, h: d.h } : null;

  const result = useCallback(
    (ph: Phase, left: number, placedCells: number): MinigameResult => {
      if (ph === "won") return { score: Math.round((0.6 + 0.4 * (left / TIME_S)) * 100) / 100, note: winLine(margin) };
      const total = pieces.reduce((a, p) => a + p.cells, 0) || 1;
      return { score: Math.round((0.1 + 0.3 * (placedCells / total)) * 100) / 100, note: LOSE };
    },
    [margin, pieces],
  );
  const placedCells = placements.reduce((a, p) => a + p.w * p.h, 0);
  const res = phase === "play" ? null : result(phase, timeLeft, placedCells);
  const finishNow = useCallback(() => {
    if (done.current || !res) return;
    done.current = true;
    finish(res);
  }, [finish, res]);

  // Clock.
  useEffect(() => {
    if (phase !== "play") return;
    endsAt.current = performance.now() + TIME_S * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, (endsAt.current - performance.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) setPhase((p) => (p === "play" ? "lost" : p));
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // Stream the frame to the big screen.
  const gx = ghost?.x ?? -1;
  const gy = ghost?.y ?? -1;
  const note = res?.note ?? "";
  const frame = useMemo<FairingLive>(
    () => ({
      cols,
      rows,
      capU,
      pieces: pieces.map((p, i) => ({ name: p.name, code: p.code, volume: p.volume, placed: placedSet.has(i) })),
      placements,
      sel,
      ghost: gy >= 0 ? { x: gx, y: gy, w: d.w, h: d.h } : null,
      timeLeft,
      phase,
      note,
      volumeU,
    }),
    [cols, rows, capU, pieces, placedSet, placements, sel, gx, gy, d.w, d.h, timeLeft, phase, note, volumeU],
  );
  // Send on change, and resend the latest frame so a throttled final frame still lands.
  const latest = useRef(frame);
  useEffect(() => {
    latest.current = frame;
    sendLive(frame);
  }, [frame, sendLive]);
  useEffect(() => {
    const id = setInterval(() => sendLive(latest.current), 300);
    return () => clearInterval(id);
  }, [sendLive]);

  // Result: show it, then hand back.
  useEffect(() => {
    if (phase === "play") return;
    scratch(phase === "won" ? 0.35 : 0.2, 0.3);
    const id = setTimeout(finishNow, 3500);
    return () => clearTimeout(id);
  }, [phase, finishNow]);

  const nextAfter = (pl: Placement[]) => {
    const used = new Set(pl.map((p) => p.i));
    const gg = occupied(pl, cols, rows);
    const left = pieces.map((_, i) => i).filter((i) => !used.has(i));
    if (!left.length) return { phase: "won" as Phase, sel: 0 };
    if (!left.some((i) => anyFit(gg, cols, rows, pieces[i]))) return { phase: "lost" as Phase, sel: left[0] };
    return { phase: "play" as Phase, sel: left[0] };
  };

  const drop = () => {
    if (phase !== "play" || !ghost) return;
    scratch();
    const pl = [...placements, { i: sel, ...ghost }];
    setPlacements(pl);
    const n = nextAfter(pl);
    setSel(n.sel);
    setRot(false);
    if (n.phase !== "play") setPhase(n.phase);
  };

  const btn: React.CSSProperties = {
    flex: 1,
    minHeight: 56,
    background: "transparent",
    color: INK,
    border: `2px solid ${INK}`,
    borderRadius: 4,
    fontSize: 17,
    fontWeight: 700,
    fontFamily: "inherit",
    touchAction: "manipulation",
  };
  const cell = Math.floor(Math.min(400 / rows, 250 / cols, 84));

  return (
    <div className={mono.className} style={{ ...paper, position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: 16, gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>{TITLE}</div>
          <div style={{ fontSize: 15, color: DIM }}>{SUBTITLE}</div>
        </div>
        <Clock t={timeLeft} size={28} />
      </div>
      <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: 0 }}>
        <Drawing live={frame} cell={cell} onColumn={(i) => setCol(i)} />
      </div>
      {phase === "play" && piece ? (
        <>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {pieces.map((p, i) =>
              placedSet.has(i) ? null : (
                <button
                  key={i}
                  onClick={() => {
                    setSel(i);
                    setRot(false);
                  }}
                  style={{
                    flex: "0 0 auto",
                    textAlign: "left",
                    padding: "8px 10px",
                    background: i === sel ? INK : "transparent",
                    color: i === sel ? BG : INK,
                    border: `1px ${i === sel ? "solid" : "dashed"} ${INK}`,
                    borderRadius: 4,
                    fontFamily: "inherit",
                    fontSize: 15,
                    maxWidth: 170,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {p.code} · {p.volume}U
                  </div>
                  <div style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                </button>
              ),
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn} aria-label="Move Left" onClick={() => setCol(Math.max(0, x - 1))}>
              ◀
            </button>
            <button style={btn} aria-label="Move Right" onClick={() => setCol(Math.min(cols - d.w, x + 1))}>
              ▶
            </button>
            <button style={btn} onClick={() => setRot((r) => !r)} disabled={piece.w === piece.h}>
              Rotate
            </button>
            <button style={{ ...btn, flex: 1.4, background: INK, color: BG, opacity: ghost ? 1 : 0.4 }} onClick={drop} disabled={!ghost}>
              Drop
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gap: 12, paddingBottom: 8 }}>
          <div style={{ fontSize: 19, lineHeight: 1.35, fontWeight: 700 }}>{res?.note}</div>
          <button style={{ ...btn, background: INK, color: BG }} onClick={finishNow}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

// --- Watch: the big screen ---
function Watch({ live }: { live: FairingLive | null }) {
  const box: React.CSSProperties = { ...paper, position: "absolute", inset: 0, containerType: "size", display: "flex", padding: "4cqh 4cqw", gap: "4cqw" };
  if (!live)
    return (
      <div className={mono.className} style={{ ...box, flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: "2cqh" }}>
        <div style={{ fontSize: "12cqh", fontWeight: 700, letterSpacing: "0.3cqh" }}>{TITLE}</div>
        <div style={{ fontSize: "4.5cqh", color: DIM }}>{SUBTITLE}</div>
        <div style={{ fontSize: "4cqh" }}>{HOW_TO}</div>
        <div style={{ fontSize: "3.6cqh", color: DIM, marginTop: "3cqh" }}>Watching: FORGE is packing the frame.</div>
      </div>
    );
  const sel = live.pieces[live.sel];
  return (
    <div className={mono.className} style={box}>
      <div style={{ flex: "0 0 auto", display: "grid", placeItems: "center", height: "92cqh" }}>
        <WatchDrawing live={live} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.4cqh", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "9cqh", fontWeight: 700, letterSpacing: "0.3cqh", lineHeight: 1 }}>{TITLE}</div>
            <div style={{ fontSize: "3.8cqh", color: DIM, marginTop: "1cqh" }}>{SUBTITLE}</div>
          </div>
          <Clock t={live.timeLeft} size="8cqh" />
        </div>
        <div style={{ borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${DIM}`, padding: "1.4cqh 0", display: "flex", justifyContent: "space-between", fontSize: "3.4cqh" }}>
          <span>FRAME {live.capU}U</span>
          <span>
            PARTS {live.volumeU}U OF {live.capU}U
          </span>
        </div>
        <div style={{ display: "grid", gap: "1.2cqh", fontSize: "3.4cqh", overflow: "hidden" }}>
          {live.pieces.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: "1.5cqw", opacity: p.placed ? 0.45 : 1, fontWeight: i === live.sel && live.phase === "play" ? 700 : 400 }}>
              <span style={{ width: "3cqw" }}>{p.placed ? "✓" : i === live.sel && live.phase === "play" ? "▶" : "·"}</span>
              <span style={{ width: "8cqw" }}>{p.code}</span>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              <span>{p.volume}U</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", fontSize: "4.6cqh", fontWeight: 700, lineHeight: 1.3, minHeight: "12cqh" }}>
          {live.phase === "play" ? (sel ? `${sel.code}: ${sel.name}` : "") : live.note}
        </div>
      </div>
    </div>
  );
}

/** Sizes the drawing to the big screen's height. */
function WatchDrawing({ live }: { live: FairingLive }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cell = h ? Math.floor(h / (live.rows + 1.8)) : 0;
  return (
    <div ref={ref} style={{ height: "100%", display: "grid", placeItems: "center" }}>
      {cell > 0 && <Drawing live={live} cell={cell} />}
    </div>
  );
}

function Fairing({ mode, live, sendLive, finish, ctx }: MinigameProps<FairingLive>) {
  return mode === "play" ? <Play ctx={ctx} sendLive={sendLive} finish={finish} /> : <Watch live={live} />;
}

const autoResolve = (ctx: MinigameContext): MinigameResult => {
  const { volumeU, capacityU } = ctx.sim;
  if (volumeU > capacityU) return { score: 0.3, note: LOSE };
  return { score: 0.5, note: winLine(Math.max(0, Math.round((1 - volumeU / capacityU) * 100))) };
};

const def: MinigameDef = {
  id: "fairing",
  title: TITLE,
  subtitle: SUBTITLE,
  howTo: HOW_TO,
  owner: "forge",
  wipe: BG,
  Component: Fairing,
  autoResolve,
};
export default def;
