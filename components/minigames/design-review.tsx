"use client";
// DESIGN REVIEW: prove it's ready to fly. A turn-based battle against the Review Board in our own
// retro battle style. The Board's questions are the design's real weaknesses; moves are evidence.
//
// Team state (this mini game's slice of MissionState.team), keyed by role and turn:
//   pick:<role>:<turn>  move id, or "none"   that role's move this turn
//   res:<turn>          { q, by, role }       the turn's outcome, written by the ZENITH device
//   rescue              true                  Budget Rescue answered a question: the shell must send { t: "rescue" }
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Silkscreen } from "next/font/google";
import type { MinigameDef, MinigameProps } from "@/lib/minigames/types";
import type { RoleId } from "@/lib/protocol";
import { score, simulate, type Check } from "@/lib/game/sim";
import { EMBER, type ObjectiveId } from "@/lib/game/data/ember";
import { useDevCtx } from "./trade-study-fixtures";
import { ROLE_INFO, ROLE_ORDER } from "./trade-study-logic";
import { battleOf, CRED_MAX, movesFor, NONE, questionsFor, resolveTurn, type Move, type Question, type Res } from "./design-review-logic";

const silk = Silkscreen({ subsets: ["latin"], weight: ["400", "700"] });

const VIOLET = "#2A1E5C";
const TEAL = "#2EC4B6";
const CREAM = "#FFF3D6";
const DEEP = "#140D33";
const MID = "#4B3A8C";
const GO_LINE = "The Board says GO.";
const NO_GO_LINE = "The Board says NO GO. Here's what they couldn't accept.";

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, note: "The Board heard your case." });

function DesignReview(props: MinigameProps) {
  const { mode, team, patchTeam, finish } = props;
  const ctx = useDevCtx(props.ctx);
  const { state, sim } = ctx;
  const obj = state.objectiveId as ObjectiveId | null;
  const questions = useMemo(() => questionsFor(sim), [sim]);
  const moves = useMemo(() => movesFor(state, sim), [state, sim]);
  const roles = useMemo(() => {
    const held = ROLE_ORDER.filter((r) => state.roles[r]);
    return held.length ? held : ROLE_ORDER;
  }, [state.roles]);
  const b = battleOf(team, questions);
  const current = b.over ? null : questions[b.turn];
  const picks = Object.fromEntries(roles.map((r) => [r, team[`pick:${r}:${b.turn}`] as string | undefined])) as Partial<Record<RoleId, string>>;
  const allPicked = !b.over && roles.every((r) => picks[r]);
  const picksKey = roles.map((r) => picks[r] ?? "").join(",");

  const isDirector = mode === "play" && ctx.myRoles.includes("zenith");
  const resolved = useRef(-1);
  useEffect(() => {
    if (!isDirector || !allPicked || !current) return;
    const turn = b.turn;
    const t = setTimeout(() => {
      if (resolved.current >= turn) return;
      resolved.current = turn;
      const res = resolveTurn(current, picks, moves, b.spent, roles);
      patchTeam({ [`res:${turn}`]: res, ...(res.by === "budget-rescue" ? { rescue: true } : {}) });
    }, 1400);
    return () => clearTimeout(t);
    // picksKey stands in for picks: a changed pick restarts the countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirector, allPicked, b.turn, picksKey]);

  // The verdict: score() decides GO so it matches the mission report.
  const rescuePlayed = b.res.some((r) => r.by === "budget-rescue");
  const finalSim = rescuePlayed && !state.rescueUsed ? simulate(state.design, obj, true) : sim;
  const go = score(finalSim, state.results, obj).go;
  const reviewScore = questions.length ? b.answered.size / questions.length : 1;
  // Listed: every question nobody answered, plus anything that still blocks GO even when argued
  // (a bad check, or less than the objective's share of data home: score() checks both).
  const minDelivered = EMBER.objectives.find((o) => o.id === obj)?.wants.minDelivered ?? 0.5;
  const blocks = (c: Check) => c.status === "bad" || (c.id === "data" && finalSim.delivered < minDelivered);
  const open = questions
    .map((q) => ({
      q,
      lines: q.checks
        .map((c) => finalSim.checks.find((f) => f.id === c.id))
        .filter((c): c is Check => !!c && (!b.answered.has(q.id) || blocks(c)))
        .map((c) => c.line),
    }))
    .filter((x) => x.lines.length > 0);
  const done = () => finish({ score: Math.round(reviewScore * 100) / 100, note: go ? GO_LINE : NO_GO_LINE });

  const v: View = { questions, moves, roles, b, current, picks, go, open, team };
  return (
    <div className={silk.className} style={{ position: "absolute", inset: 0, background: VIOLET, color: CREAM, overflow: "hidden", containerType: "size" }}>
      <style>{`
        @keyframes dr-shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-4%) } 40% { transform: translateX(4%) } 60% { transform: translateX(-2%) } 80% { transform: translateX(2%) } }
        @keyframes dr-blink { 0%,100% { opacity: 1 } 50% { opacity: .2 } }
        @keyframes dr-rise { from { transform: translateY(12px) } to { transform: none } }
      `}</style>
      {mode === "play" ? <Play {...v} myRoles={ctx.myRoles.filter((r) => roles.includes(r))} patchTeam={patchTeam} isDirector={isDirector} onDone={done} /> : <Watch {...v} />}
    </div>
  );
}

type View = {
  questions: Question[];
  moves: Move[];
  roles: RoleId[];
  b: ReturnType<typeof battleOf>;
  current: Question | null;
  picks: Partial<Record<RoleId, string>>;
  go: boolean;
  open: { q: Question; lines: string[] }[];
  team: Record<string, unknown>;
};

/* ---------- pixel art (original) ---------- */

type Px = [number, number, string];

function Pixels({ w, h, px, style }: { w: number; h: number; px: Px[]; style?: CSSProperties }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{ display: "block", ...style }} aria-hidden>
      {px.map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width={1.02} height={1.02} fill={c} />
      ))}
    </svg>
  );
}

function fromRows(rows: string[], pal: Record<string, string>): Px[] {
  const out: Px[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => pal[ch] && out.push([x, y, pal[ch]])));
  return out;
}

/** Three reviewers behind a long bench. */
const BOARD_W = 25;
const BOARD_H = 14;
const BOARD_PX: Px[] = (() => {
  const g: string[][] = Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill("."));
  for (const o of [2, 10, 18]) {
    for (let x = o + 1; x <= o + 3; x++) {
      g[0][x] = "m";
      for (let y = 1; y <= 3; y++) g[y][x] = "c";
    }
    g[2][o + 1] = "d";
    g[2][o + 3] = "d";
    for (let y = 4; y <= 7; y++) for (let x = o; x <= o + 4; x++) g[y][x] = "m";
    g[4][o + 2] = "c";
  }
  for (let x = 0; x < BOARD_W; x++) {
    g[7][x] = "c";
    for (let y = 8; y <= 12; y++) g[y][x] = "t";
    g[13][x] = "d";
  }
  for (let x = 9; x <= 15; x++) g[10][x] = "c";
  return fromRows(g.map((r) => r.join("")), { c: CREAM, m: MID, d: DEEP, t: TEAL });
})();

const CREW_ROWS = ["..www..", ".wvvvw.", ".wvvvw.", "..www..", ".rrrrr.", "rr.r.rr", "r.rrr.r", "..r.r..", ".rr.rr."];

function Crew({ role, style }: { role: RoleId; style?: CSSProperties }) {
  return <Pixels w={7} h={9} px={fromRows(CREW_ROWS, { w: CREAM, v: DEEP, r: ROLE_INFO[role].color })} style={style} />;
}

/* ---------- shared pieces ---------- */

function Segments({ n, full, color, h }: { n: number; full: number; color: string; h: number | string }) {
  return (
    <div style={{ display: "flex", gap: 3, background: DEEP, padding: 3, borderRadius: 2 }}>
      {Array.from({ length: Math.max(1, n) }, (_, i) => (
        <div key={i} style={{ flex: 1, height: h, background: n === 0 ? "transparent" : i < full ? color : MID, transition: "background .3s" }} />
      ))}
    </div>
  );
}

const moveName = (moves: Move[], id: string | null | undefined) => moves.find((m) => m.id === id)?.name;

function outcomeLine(v: View, r: Res | undefined) {
  if (!r) return null;
  return r.by ? `${moveName(v.moves, r.by)} answered it.` : "Nobody could answer that.";
}

function box(extra?: CSSProperties): CSSProperties {
  return { background: CREAM, color: VIOLET, border: `4px solid ${TEAL}`, boxShadow: `0 0 0 4px ${DEEP}, 6px 6px 0 4px ${DEEP}`, borderRadius: 4, ...extra };
}

function Verdict({ v, big, action }: { v: View; big?: boolean; action?: ReactNode }) {
  const f = (n: number) => (big ? `max(${Math.round(n * 0.75)}px, ${(n / 12.8).toFixed(2)}cqw)` : `${n}px`);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: big ? "1.2cqw" : 12, animation: "dr-rise .5s ease both" }}>
      <div style={{ fontSize: f(big ? 52 : 28), fontWeight: 700, color: v.go ? TEAL : "#FF8A80", lineHeight: 1.05 }}>{v.go ? "GO" : "NO GO"}</div>
      <div style={{ fontSize: f(big ? 24 : 16), lineHeight: 1.3 }}>{v.go ? GO_LINE : NO_GO_LINE}</div>
      {v.questions.length > 0 && (
        <div style={{ fontSize: f(big ? 18 : 14), opacity: 0.85 }}>
          {v.b.answered.size} of {v.questions.length} questions answered
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: big ? "0.9cqw" : 10, overflowY: "auto" }}>
        {v.open.map(({ q, lines }) => (
          <div key={q.id} style={{ ...box({ padding: big ? "0.8cqw 1.2cqw" : "10px 12px" }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: f(big ? 20 : 15), fontWeight: 700 }}>&ldquo;{q.line}&rdquo;</div>
              {v.b.answered.has(q.id) && <div style={{ fontSize: f(big ? 14 : 11), background: TEAL, color: DEEP, padding: "2px 6px", flex: "none" }}>ANSWERED</div>}
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ fontFamily: "var(--font-body), sans-serif", fontSize: f(big ? 20 : 15), lineHeight: 1.35, marginTop: 4 }}>
                {l}
              </div>
            ))}
          </div>
        ))}
      </div>
      {action}
    </div>
  );
}

/* ---------- play: one phone, one or more roles ---------- */

function Play(v: View & { myRoles: RoleId[]; patchTeam: MinigameProps["patchTeam"]; isDirector: boolean; onDone: () => void }) {
  const [tab, setTab] = useState<RoleId | null>(null);
  const mine = v.myRoles;
  const active = tab ?? mine.find((r) => !v.picks[r]) ?? mine[0];
  const last = v.b.res[v.b.res.length - 1];

  if (v.b.over) {
    return (
      <div style={{ position: "absolute", inset: 0, padding: 16, overflowY: "auto" }}>
        <Verdict
          v={v}
          action={
            v.isDirector ? (
              <button onClick={v.onDone} style={{ ...box({ padding: "14px 12px", fontFamily: "inherit", fontSize: 18, fontWeight: 700, cursor: "pointer" }), background: TEAL, color: DEEP }}>
                Continue
              </button>
            ) : null
          }
        />
      </div>
    );
  }
  if (!active || !v.current) return <div style={{ padding: 24 }}>Watching the review.</div>;

  const myMoves = v.moves.filter((m) => m.role === active);
  const picked = v.picks[active];
  const choose = (id: string) => {
    v.patchTeam({ [`pick:${active}:${v.b.turn}`]: id });
    setTab(null);
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: 16, gap: 12, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>DESIGN REVIEW</div>
        <div style={{ fontSize: 13, textAlign: "right" }}>
          BOARD HP {v.questions.length - v.b.answered.size}/{v.questions.length}
        </div>
      </div>
      <Segments n={v.questions.length} full={v.questions.length - v.b.answered.size} color={TEAL} h={8} />

      <div key={v.b.turn} style={{ ...box({ padding: "14px 14px", animation: "dr-rise .4s ease both" }) }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          QUESTION {v.b.turn + 1} OF {v.questions.length}
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4, lineHeight: 1.25 }}>&ldquo;{v.current.line}&rdquo;</div>
      </div>
      {last && <div style={{ fontSize: 14, color: last.by ? TEAL : "#FF8A80" }}>{outcomeLine(v, last)}</div>}

      {mine.length > 1 && (
        <div style={{ display: "flex", gap: 6 }}>
          {mine.map((r) => (
            <button
              key={r}
              onClick={() => setTab(r)}
              style={{ flex: 1, padding: "8px 2px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, border: `3px solid ${r === active ? CREAM : MID}`, background: r === active ? ROLE_INFO[r].color : DEEP, color: CREAM, borderRadius: 3 }}
            >
              {v.picks[r] ? "✓ " : ""}
              {ROLE_INFO[r].call}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Crew role={active} style={{ width: 28 }} />
        <div style={{ fontSize: 14 }}>
          {ROLE_INFO[active].call}: PICK YOUR EVIDENCE
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {myMoves.map((m) => {
          const spent = v.b.spent.has(m.id);
          const usable = m.unlocked && !spent;
          const sel = picked === m.id;
          return (
            <button
              key={m.id}
              disabled={!usable}
              onClick={() => choose(m.id)}
              style={{
                textAlign: "left",
                padding: "10px 10px",
                minHeight: 74,
                fontFamily: "inherit",
                borderRadius: 3,
                border: `3px solid ${sel ? CREAM : usable ? TEAL : MID}`,
                background: sel ? TEAL : usable ? DEEP : "transparent",
                color: sel ? DEEP : usable ? CREAM : "rgba(255,243,214,.45)",
                cursor: usable ? "pointer" : "default",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
              <div style={{ fontFamily: "var(--font-body), sans-serif", fontSize: 14, marginTop: 4, lineHeight: 1.25 }}>{spent ? "Used" : m.unlocked ? m.evidence : "Locked"}</div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => choose(NONE)}
        style={{ padding: "12px", fontFamily: "inherit", fontSize: 14, fontWeight: 700, borderRadius: 3, border: `3px solid ${picked === NONE ? CREAM : MID}`, background: picked === NONE ? MID : "transparent", color: CREAM }}
      >
        No Evidence
      </button>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 13, opacity: 0.8, textAlign: "center", animation: picked ? "dr-blink 1.4s steps(2) infinite" : "none" }}>
        {Object.keys(v.picks).filter((r) => v.picks[r as RoleId]).length} OF {v.roles.length} READY
      </div>
    </div>
  );
}

/* ---------- watch: the big screen battle ---------- */

function Watch(v: View) {
  const fs = (n: number) => `max(${Math.round(n * 0.75)}px, ${(n / 12.8).toFixed(2)}cqw)`;
  const last = v.b.res[v.b.res.length - 1];
  const hp = v.questions.length - v.b.answered.size;
  const abs = (l: number, t: number, w: number, extra?: CSSProperties): CSSProperties => ({ position: "absolute", left: `${l}%`, top: `${t}%`, width: `${w}%`, ...extra });

  if (v.b.over) {
    return (
      <div style={{ position: "absolute", inset: "4% 4%", display: "grid", gridTemplateColumns: "1fr 28%", gap: "3cqw", alignItems: "start" }}>
        <Verdict v={v} big />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2cqw", paddingTop: "4cqw" }}>
          <Pixels w={BOARD_W} h={BOARD_H} px={BOARD_PX} style={{ width: "100%" }} />
          <div style={{ display: "flex", gap: "1cqw", width: "80%" }}>
            {v.roles.map((r) => (
              <Crew key={r} role={r} style={{ flex: 1 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* stage floor */}
      <div style={abs(0, 58, 100, { height: "42%", background: DEEP, opacity: 0.55 })} />
      <div style={abs(56, 38, 36, { height: "9%", borderRadius: "50%", background: MID })} />
      <div style={abs(6, 60, 38, { height: "8%", borderRadius: "50%", background: MID })} />

      {/* Board */}
      <div style={abs(4, 6, 40, box({ padding: "1cqw 1.4cqw" }))}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(22), fontWeight: 700 }}>
          <span>REVIEW BOARD</span>
          <span>
            HP {hp}/{v.questions.length}
          </span>
        </div>
        <div style={{ marginTop: "0.6cqw" }}>
          <Segments n={v.questions.length} full={hp} color={TEAL} h="1cqw" />
        </div>
      </div>
      <div key={`b${v.b.turn}`} style={abs(60, 6, 28, { animation: last?.by ? "dr-shake .5s steps(5)" : "none" })}>
        <Pixels w={BOARD_W} h={BOARD_H} px={BOARD_PX} style={{ width: "100%" }} />
      </div>

      {/* Crew */}
      <div key={`c${v.b.turn}`} style={abs(9, 34, 32, { display: "flex", gap: "1.2cqw", alignItems: "end", animation: last && !last.by ? "dr-shake .5s steps(5)" : "none" })}>
        {v.roles.map((r) => (
          <div key={r} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4cqw" }}>
            <Crew role={r} style={{ width: "100%" }} />
          </div>
        ))}
      </div>
      <div style={abs(54, 50, 42, box({ padding: "1cqw 1.4cqw" }))}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(22), fontWeight: 700 }}>
          <span>CREW</span>
          <span>
            CREDIBILITY {Math.max(0, v.b.cred)}/{CRED_MAX}
          </span>
        </div>
        <div style={{ marginTop: "0.6cqw" }}>
          <Segments n={CRED_MAX} full={Math.max(0, v.b.cred)} color="#F4A261" h="1cqw" />
        </div>
      </div>

      {/* Text box */}
      <div key={`t${v.b.turn}`} style={abs(3, 71, 94, box({ height: "24%", padding: "1.2cqw 1.8cqw", display: "flex", flexDirection: "column", justifyContent: "space-between", animation: "dr-rise .4s ease both" }))}>
        <div>
          {last && <div style={{ fontSize: fs(18), color: last.by ? "#11776E" : "#B3261E" }}>{outcomeLine(v, last)}</div>}
          <div style={{ fontSize: fs(30), fontWeight: 700, lineHeight: 1.2 }}>{v.current ? `“${v.current.line}”` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: "1.4cqw" }}>
          {v.roles.map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: "0.5cqw", fontSize: fs(18) }}>
              <span style={{ width: "1.2cqw", height: "1.2cqw", minWidth: 10, minHeight: 10, background: ROLE_INFO[r].color, display: "inline-block" }} />
              {ROLE_INFO[r].call} {v.picks[r] ? "READY" : "..."}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const def: MinigameDef = {
  id: "design-review",
  title: "DESIGN REVIEW",
  subtitle: "Prove it's ready to fly",
  howTo: "Each turn, pick your role's best evidence against the Board's questions.",
  owner: "team",
  wipe: "#2A1E5C",
  Component: DesignReview,
  autoResolve,
};
export default def;
