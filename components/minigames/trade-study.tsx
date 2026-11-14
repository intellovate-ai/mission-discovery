"use client";
// TRADE STUDY: give something to get something. A team game on a green felt card table.
// Every phone offers real part swaps from its own slots; everyone sees the gap close live.
//
// Team state (this mini game's slice of MissionState.team), keyed by role so devices never collide:
//   t0            number   start time (ms), written once by the ZENITH device
//   offer:<role>  Offer | "hold"   that role's chosen swap (Offer.set: "" means drop the slot)
//   lock:<role>   boolean  that role tapped Lock In
//   final         { score, note }  written by the ZENITH device just before finish()
//   rescue        true     ZENITH spent the one-time budget rescue: the shell must send { t: "rescue" }
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bitter } from "next/font/google";
import type { MinigameDef, MinigameProps } from "@/lib/minigames/types";
import type { MinigameResult, RoleId } from "@/lib/protocol";
import type { Sim } from "@/lib/game/sim";
import { useDevCtx } from "./trade-study-fixtures";
import {
  closure,
  findGap,
  fmtK,
  fmtKg,
  HOLD,
  merged,
  newBad,
  offersFor,
  ROLE_INFO,
  ROLE_ORDER,
  tradeScore,
  type Offer,
  type Ranked,
} from "./trade-study-logic";

const bitter = Bitter({ subsets: ["latin"], weight: ["400", "700"] });

const FELT = "#0F5132";
const CARD = "#FAFAF7";
const INK = "#1B2A22";
const LIMIT_S = 120;
const WIN = "Gap closed. That's how real mission teams work.";
const LOSE = "The gap stayed open. Someone always has to give a little.";

type Final = { score: number; note: string };
const isOffer = (v: unknown): v is Offer => typeof v === "object" && v !== null && "id" in v;
const pct = (n: number) => `${Math.round(n * 100)}%`;

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, note: "The team met in the middle." });

function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now;
}

function TradeStudy(props: MinigameProps) {
  const { mode, team, patchTeam, finish } = props;
  const ctx = useDevCtx(props.ctx);
  const { state, sim: base } = ctx;
  const gap = useMemo(() => findGap(base), [base]);
  const roles = useMemo(() => {
    const held = ROLE_ORDER.filter((r) => state.roles[r]);
    return held.length ? held : ROLE_ORDER;
  }, [state.roles]);
  const rescueOpen = !state.rescueUsed || team.rescue === true;
  const offers = useMemo(() => {
    const o = {} as Record<RoleId, Ranked[]>;
    for (const r of ROLE_ORDER) o[r] = gap ? offersFor(r, state, base, gap, rescueOpen) : [];
    return o;
  }, [state, base, gap, rescueOpen]);

  const chosen = roles.map((r) => team[`offer:${r}`]).filter(isOffer);
  const preview = merged(state, chosen);
  const close = closure(base, preview.sim, gap);
  const problems = newBad(base, preview.sim);
  const contributors = roles.filter((r) => isOffer(team[`offer:${r}`])).length;
  const eligible = gap ? roles.filter((r) => offers[r].length > 0).length : roles.length;
  const locked = roles.every((r) => team[`lock:${r}`] === true);
  const final = team.final as Final | undefined;

  const now = useNow();
  const t0 = typeof team.t0 === "number" ? team.t0 : 0;
  const left = t0 && now ? Math.max(0, LIMIT_S - (now - t0) / 1000) : LIMIT_S;
  const timeUp = t0 > 0 && now > 0 && left <= 0;

  const isDirector = mode === "play" && ctx.myRoles.includes("zenith");
  const finishing = useRef(false);

  useEffect(() => {
    if (isDirector && !t0) patchTeam({ t0: Date.now() });
  }, [isDirector, t0, patchTeam]);

  useEffect(() => {
    if (!isDirector || finishing.current || !(locked || timeUp)) return;
    finishing.current = true;
    const closed = !gap || (close >= 0.999 && problems.length === 0);
    const result: MinigameResult = {
      score: Math.round(tradeScore(close, gap ? contributors : roles.filter((r) => team[`lock:${r}`]).length, gap ? eligible : roles.length, problems.length, !!gap) * 100) / 100,
      note: closed ? WIN : LOSE,
      ...(Object.keys(preview.set).length ? { set: preview.set } : {}),
    };
    patchTeam({ final: { score: result.score, note: result.note }, ...(preview.rescue ? { rescue: true } : {}) });
    setTimeout(() => finish(result), 2500);
  });

  const view = { state, base, gap, roles, offers, preview, close, problems, left, team, final, locked };
  return (
    <div className={bitter.className} style={{ position: "absolute", inset: 0, background: FELT, backgroundImage: "radial-gradient(ellipse at 50% 40%, #16683F 0%, #0F5132 55%, #0A3D25 100%)", color: CARD, overflow: "hidden", containerType: "size" }}>
      {mode === "play" ? <Play {...view} myRoles={ctx.myRoles.filter((r) => roles.includes(r))} patchTeam={patchTeam} /> : <Watch {...view} />}
    </div>
  );
}

type View = {
  state: MinigameProps["ctx"]["state"];
  base: Sim;
  gap: ReturnType<typeof findGap>;
  roles: RoleId[];
  offers: Record<RoleId, Ranked[]>;
  preview: ReturnType<typeof merged>;
  close: number;
  problems: ReturnType<typeof newBad>;
  left: number;
  team: Record<string, unknown>;
  final: Final | undefined;
  locked: boolean;
};

/* ---------- shared pieces ---------- */

function Chip({ role, size = 40, label = true }: { role: RoleId; size?: number; label?: boolean }) {
  const c = ROLE_INFO[role].color;
  return (
    <div
      aria-label={ROLE_INFO[role].call}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "none",
        background: c,
        border: `${Math.max(2, size / 14)}px dashed ${CARD}`,
        boxShadow: `0 0 0 ${Math.max(2, size / 16)}px ${c}, 0 ${size / 10}px ${size / 6}px rgba(0,0,0,.35)`,
        display: "grid",
        placeItems: "center",
        color: CARD,
        fontWeight: 700,
        fontSize: size * 0.3,
      }}
    >
      {label ? ROLE_INFO[role].call[0] : null}
    </div>
  );
}

function barOf(sim: Sim, key: string) {
  return sim.bars.find((b) => b.key === key);
}

function Clock({ left, big }: { left: number; big?: boolean }) {
  const s = Math.ceil(left);
  return (
    <div style={{ fontWeight: 700, fontSize: big ? "max(20px, 2.6cqw)" : 20, color: s <= 15 ? "#FFD2A8" : CARD, fontVariantNumeric: "tabular-nums" }}>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </div>
  );
}

/** The shortfall card: which resource is short, before and after everyone's offers. */
function GapCard({ v, big }: { v: View; big?: boolean }) {
  const f = big ? (n: number) => `max(${n}px, ${(n / 9.6).toFixed(2)}cqw)` : (n: number) => `${n}px`;
  if (!v.gap) {
    return (
      <div style={{ background: CARD, color: INK, borderRadius: 10, padding: big ? "1.6cqw 2cqw" : 14, boxShadow: "0 6px 18px rgba(0,0,0,.3)" }}>
        <div style={{ fontWeight: 700, fontSize: f(22) }}>Every Margin Holds</div>
        <div style={{ fontSize: f(16), opacity: 0.8, marginTop: 4 }}>Each role confirms their numbers.</div>
      </div>
    );
  }
  const bar = barOf(v.base, v.gap.resource);
  const after = barOf(v.preview.sim, v.gap.resource);
  return (
    <div style={{ background: CARD, color: INK, borderRadius: 10, padding: big ? "1.4cqw 2cqw" : 14, boxShadow: "0 6px 18px rgba(0,0,0,.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: f(22) }}>The Gap: {bar?.label}</div>
        <div style={{ fontWeight: 700, fontSize: f(18), color: v.close >= 0.999 ? "#1B7A3F" : "#9A3412" }}>{pct(v.close)} Closed</div>
      </div>
      <div style={{ fontSize: f(15), marginTop: 4 }}>
        {bar?.value}
        {after && after.value !== bar?.value ? <span style={{ fontWeight: 700 }}> → {after.value}</span> : null}
      </div>
      {!big && <div style={{ fontSize: 14, marginTop: 6, opacity: 0.8, lineHeight: 1.35 }}>{v.gap.line}</div>}
      <div style={{ marginTop: big ? "1cqw" : 10, background: "#E6E6DF", borderRadius: 20, padding: 3 }}>
        <div style={{ height: big ? "1.4cqw" : 12, borderRadius: 20, width: pct(Math.max(0.02, v.close)), background: v.close >= 0.999 ? "#1B7A3F" : FELT, transition: "width .4s ease" }} />
      </div>
      {v.problems.length > 0 && (
        <div style={{ fontSize: f(14), marginTop: 6, color: "#9A3412", fontWeight: 700 }}>
          New Problem: {v.problems.map((c) => barOf(v.preview.sim, c.resource)?.label).join(", ")}
        </div>
      )}
    </div>
  );
}

function effects(base: Sim, o: Ranked, gapKey?: string) {
  const out: string[] = [];
  const dc = o.after.costK - base.costK;
  const dm = o.after.massKg - base.massKg;
  if (o.rescue) out.push("Budget +$150k");
  else if (Math.abs(dc) >= 1) out.push(`Cost ${fmtK(dc)}`);
  if (Math.abs(dm) >= 0.01) out.push(`Mass ${fmtKg(dm)}`);
  if (gapKey && gapKey !== "budget" && gapKey !== "mass") {
    const b = barOf(o.after, gapKey);
    if (b) out.push(`${b.label} ${b.value}`);
  }
  return out.join(" · ");
}

/* ---------- play: one phone, one or more roles ---------- */

function Play(v: View & { myRoles: RoleId[]; patchTeam: MinigameProps["patchTeam"] }) {
  const [tab, setTab] = useState<RoleId | null>(null);
  const mine = v.myRoles;
  const active = tab ?? mine.find((r) => !v.team[`lock:${r}`]) ?? mine[0];
  if (!active) return <div style={{ padding: 24 }}>Watching the table.</div>;
  const info = ROLE_INFO[active];
  const isLocked = v.team[`lock:${active}`] === true;
  const pick = v.team[`offer:${active}`];
  const pickId = isOffer(pick) ? pick.id : pick === HOLD ? HOLD : null;
  const list = v.offers[active];

  const choose = (o: Ranked | typeof HOLD) => {
    if (isLocked || v.final) return;
    const value = o === HOLD ? HOLD : ({ id: o.id, role: o.role, label: o.label, set: o.set, ...(o.rescue ? { rescue: true } : {}) } satisfies Offer);
    v.patchTeam({ [`offer:${active}`]: value });
  };
  const lock = () => {
    if (v.final) return;
    if (!isLocked && pickId === null && v.gap) v.patchTeam({ [`offer:${active}`]: HOLD, [`lock:${active}`]: true });
    else v.patchTeam({ [`lock:${active}`]: !isLocked });
    setTab(null);
  };

  const cardStyle = (selected: boolean): CSSProperties => ({
    display: "flex",
    gap: 12,
    alignItems: "center",
    width: "100%",
    textAlign: "left",
    background: CARD,
    color: INK,
    borderRadius: 10,
    padding: "12px 14px",
    border: "none",
    outline: selected ? `4px solid ${info.color}` : "none",
    boxShadow: selected ? "0 10px 22px rgba(0,0,0,.45)" : "0 3px 8px rgba(0,0,0,.3)",
    transform: selected ? "translateY(-3px) rotate(-0.6deg)" : "none",
    transition: "transform .15s ease, box-shadow .15s ease",
    opacity: isLocked && !selected ? 0.55 : 1,
    fontFamily: "inherit",
    cursor: isLocked ? "default" : "pointer",
  });

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: 16, gap: 12, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: 1 }}>TRADE STUDY</div>
        <Clock left={v.left} />
      </div>
      <GapCard v={v} />

      {mine.length > 1 && (
        <div style={{ display: "flex", gap: 8 }}>
          {mine.map((r) => (
            <button
              key={r}
              onClick={() => setTab(r)}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 4px", borderRadius: 24, border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 15, background: r === active ? CARD : "rgba(0,0,0,.25)", color: r === active ? INK : CARD }}
            >
              <Chip role={r} size={20} label={false} />
              {v.team[`lock:${r}`] ? "✓" : ROLE_INFO[r].call}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Chip role={active} size={36} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>
            {info.title} {info.call}
          </div>
          <div style={{ fontSize: 15, opacity: 0.8 }}>{v.gap ? "Your offer to the table" : "Your margins"}</div>
        </div>
      </div>

      {v.gap ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((o) => (
            <button key={o.id} onClick={() => choose(o)} style={cardStyle(pickId === o.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{o.label}</div>
                <div style={{ fontSize: 14, opacity: 0.75, marginTop: 2 }}>{effects(v.base, o, v.gap?.resource)}</div>
                {o.problems.length > 0 && <div style={{ fontSize: 14, color: "#9A3412", marginTop: 2 }}>New Problem: {o.problems.map((c) => barOf(o.after, c.resource)?.label).join(", ")}</div>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: o.closure >= 0.999 ? "#1B7A3F" : INK }}>{pct(o.closure)}</div>
            </button>
          ))}
          {list.length === 0 && <div style={{ fontSize: 15, opacity: 0.85 }}>Nothing in your slots closes this gap. Hold, and back your crew.</div>}
          <button onClick={() => choose(HOLD)} style={{ ...cardStyle(pickId === HOLD), background: "rgba(250,250,247,.12)", color: CARD }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Hold</div>
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {info.bars.map((k) => {
            const b = barOf(v.base, k);
            return b ? (
              <div key={k} style={{ background: CARD, color: INK, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
                  <span>{b.label}</span>
                  <span style={{ fontWeight: 400 }}>{b.value}</span>
                </div>
              </div>
            ) : null;
          })}
        </div>
      )}

      <div style={{ flex: 1 }} />
      {v.final ? (
        <div style={{ background: CARD, color: INK, borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 17, textAlign: "center" }}>{v.final.note}</div>
      ) : (
        <button
          onClick={lock}
          style={{ padding: "16px 12px", borderRadius: 12, border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 18, background: isLocked ? "rgba(0,0,0,.3)" : info.color, color: isLocked || active === "zenith" || active === "vector" ? CARD : INK, boxShadow: "0 4px 0 rgba(0,0,0,.35)" }}
        >
          {isLocked ? "Locked In · Tap to Change" : v.gap ? "Lock In" : "Confirm and Lock In"}
        </button>
      )}
    </div>
  );
}

/* ---------- watch: the big screen card table ---------- */

function Watch(v: View) {
  const fs = (n: number) => `max(${Math.round(n * 0.8)}px, ${(n / 12.8).toFixed(2)}cqw)`;
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateRows: "auto auto 1fr", padding: "2.5cqw 3cqw", gap: "2cqw" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: fs(40), letterSpacing: 2 }}>TRADE STUDY</div>
          <div style={{ fontSize: fs(22), opacity: 0.85 }}>Give something to get something</div>
        </div>
        <Clock left={v.left} big />
      </div>
      <div style={{ width: "62%", justifySelf: "center" }}>
        <GapCard v={v} big />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${v.roles.length}, 1fr)`, gap: "1.6cqw", alignItems: "end" }}>
        {v.roles.map((r) => {
          const o = v.team[`offer:${r}`];
          const ranked = isOffer(o) ? v.offers[r].find((x) => x.id === o.id) : undefined;
          const lockedIn = v.team[`lock:${r}`] === true;
          return (
            <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1cqw" }}>
              <div
                style={{
                  width: "100%",
                  minHeight: "10cqw",
                  background: isOffer(o) || (!v.gap && lockedIn) ? CARD : "rgba(250,250,247,.1)",
                  color: isOffer(o) || (!v.gap && lockedIn) ? INK : CARD,
                  border: isOffer(o) ? "none" : "2px dashed rgba(250,250,247,.35)",
                  borderRadius: 10,
                  padding: "1cqw 1.2cqw",
                  boxShadow: isOffer(o) ? "0 8px 18px rgba(0,0,0,.35)" : "none",
                  transform: isOffer(o) ? `rotate(${(ROLE_ORDER.indexOf(r) - 1.5) * 1.2}deg)` : "none",
                  position: "relative",
                }}
              >
                {isOffer(o) ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: fs(20), lineHeight: 1.2 }}>{o.label}</div>
                    {ranked && <div style={{ fontSize: fs(16), opacity: 0.75, marginTop: "0.4cqw" }}>{effects(v.base, ranked, v.gap?.resource)}</div>}
                  </>
                ) : (
                  <div style={{ fontSize: fs(20), opacity: 0.85 }}>{o === HOLD ? "Hold" : !v.gap && lockedIn ? "Margins Confirmed" : "Thinking"}</div>
                )}
                {lockedIn && (
                  <div style={{ position: "absolute", right: "-0.6cqw", top: "-1.4cqw", fontWeight: 700, fontSize: fs(15), color: ROLE_INFO[r].color, border: `2px solid ${ROLE_INFO[r].color}`, borderRadius: 6, padding: "0 0.5cqw", transform: "rotate(-6deg)", background: CARD }}>
                    Locked In
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.8cqw" }}>
                <Chip role={r} size={44} />
                <div style={{ fontWeight: 700, fontSize: fs(20) }}>{ROLE_INFO[r].call}</div>
              </div>
            </div>
          );
        })}
      </div>
      {v.final && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(10,61,37,.72)" }}>
          <div style={{ background: CARD, color: INK, borderRadius: 14, padding: "2.4cqw 3.4cqw", maxWidth: "70%", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,.45)" }}>
            <div style={{ fontWeight: 700, fontSize: fs(38), lineHeight: 1.2 }}>{v.final.note}</div>
            <div style={{ fontSize: fs(22), marginTop: "1cqw" }}>Collaboration {pct(v.final.score)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const def: MinigameDef = {
  id: "trade-study",
  title: "TRADE STUDY",
  subtitle: "Give something to get something",
  howTo: "Everyone offers something from their own resources. Close the gap before the timer.",
  owner: "team",
  wipe: "#0F5132",
  Component: TradeStudy,
  autoResolve,
};
export default def;
