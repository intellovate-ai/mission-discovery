"use client";
// A crew member's device. Join by code, pick roles, vote, build your slots in the Clean Room,
// play the mini games you own, watch and react to the rest, then read your role card.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { rolesOf, ROLES, stepsFor, type RoleId, type Slot } from "@/lib/protocol";
import { useMission } from "@/lib/net/useMission";
import { score, simulate, type Bar } from "@/lib/game/sim";
import { CLEANROOM_SLOTS, EMBER, OPTIONAL_SLOTS, partsForSlot, SLOT_OWNER, type ObjectiveId } from "@/lib/game/data/ember";
import { MG_ACTION, ROLE_INFO, STATUS_COLOR } from "@/lib/game/roles";
import { MINIGAMES } from "@/lib/minigames/registry";
import Hud from "@/components/shell/Hud";
import MinigameStage from "@/components/shell/MinigameStage";
import { ReactionButtons } from "@/components/shell/Reactions";

const JOIN_KEY = "md-join";
const savedJoin = () => {
  try {
    return localStorage.getItem(JOIN_KEY);
  } catch {
    return null;
  }
};

const SLOT_LABEL: Record<Slot, string> = {
  bus: "Frame",
  solar: "Solar Power",
  battery: "Battery",
  computer: "Flight Computer",
  heater: "Battery Heater",
  thruster: "Thruster",
  pointing: "Pointing",
  instrument1: "Instrument",
  instrument2: "Second Instrument",
  radio: "Radio",
  ground: "Ground Stations",
  rocket: "Rocket",
  orbit: "Orbit",
};

export default function Play() {
  const saved = useSyncExternalStore(() => () => {}, savedJoin, () => null);
  const { code, state, error, connect, playerId, clearLive } = useMission();
  const myRoles = useMemo(() => (state ? rolesOf(state, playerId) : []), [state, playerId]);
  const sim = useMemo(
    () => (state ? simulate(state.design, state.objectiveId as ObjectiveId | null, state.rescueUsed) : null),
    [state],
  );
  const stepIndex = state?.stepIndex ?? -1;
  useEffect(() => clearLive(), [stepIndex, clearLive]);

  if (!code || (error && !state)) return <JoinForm saved={saved} error={error} onJoin={(c, n) => connect(c, "player", n)} />;
  if (!state || !sim) return <Shell><p style={{ color: "var(--text-dim)" }}>Joining {code}.</p></Shell>;

  const step = stepIndex >= 0 ? stepsFor(state.missionId)[stepIndex] : undefined;
  const me = state.players.find((p) => p.id === playerId);

  // Mini games take the whole device.
  if (step?.kind === "mg") {
    const def = MINIGAMES[step.id];
    const mine = def.owner === "team" || myRoles.includes(def.owner);
    if (mine) {
      return (
        <main style={{ position: "fixed", inset: 0 }}>
          <MinigameStage key={`${stepIndex}-${step.id}`} id={step.id} mode="play" state={state} sim={sim} myRoles={myRoles} isHost={false} />
        </main>
      );
    }
    const owner = def.owner as RoleId;
    return (
      <main style={{ position: "fixed", inset: 0, display: "grid", gridTemplateRows: "auto 1fr auto" }}>
        <div style={{ padding: "12px 16px", borderLeft: `4px solid ${ROLE_INFO[owner].color}` }}>
          Watching: <b>{ROLE_INFO[owner].name}</b> is {MG_ACTION[step.id]}.
        </div>
        <div style={{ position: "relative" }}>
          <MinigameStage key={`${stepIndex}-${step.id}`} id={step.id} mode="watch" state={state} sim={sim} myRoles={myRoles} isHost={false} />
        </div>
        <div style={{ padding: 12 }}>
          <ReactionButtons />
        </div>
      </main>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 600 }}>{me?.name ?? "Crew"}</span>
        <span className="display" style={{ fontSize: 22, letterSpacing: 2 }}>{state.code}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {myRoles.map((r) => (
          <span key={r} style={{ color: ROLE_INFO[r].color, fontWeight: 700 }}>{ROLE_INFO[r].title} {ROLE_INFO[r].name}</span>
        ))}
      </div>

      {stepIndex === -1 && <RolePick myRoles={myRoles} />}
      {step?.kind === "objective" && <ObjectivePick />}
      {step?.kind === "cleanroom" && <Build myRoles={myRoles} sim={sim} />}
      {step?.kind === "scene" && (
        <div style={{ marginTop: 32 }}>
          <div className="display" style={{ fontSize: 40 }}>{step.scene === "launch" ? "Launch Site" : "The Flight Path"}</div>
          <p style={{ color: "var(--text-dim)", marginTop: 8 }}>Watch the big screen.</p>
          <div style={{ marginTop: 24 }}><ReactionButtons /></div>
        </div>
      )}
      {step?.kind === "report" && <RoleCards myRoles={myRoles} bars={sim.bars} total={score(sim, state.results, state.objectiveId as ObjectiveId | null).total} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: "100dvh", padding: 16, maxWidth: 520, margin: "0 auto" }}>{children}</main>;
}

function JoinForm({ saved, error, onJoin }: { saved: string | null; error: string | null; onJoin: (code: string, name: string) => void }) {
  const last = useMemo(() => {
    try {
      return saved ? (JSON.parse(saved) as { code: string; name: string }) : null;
    } catch {
      return null;
    }
  }, [saved]);
  const [codeIn, setCode] = useState<string | null>(null);
  const [nameIn, setName] = useState<string | null>(null);
  const c = (codeIn ?? last?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const n = nameIn ?? last?.name ?? "";
  const join = () => {
    try {
      localStorage.setItem(JOIN_KEY, JSON.stringify({ code: c, name: n.trim() }));
    } catch {}
    onJoin(c, n.trim() || "Crew");
  };
  const field = { display: "block", width: "100%", marginTop: 6, padding: "14px 14px", borderRadius: 6, background: "var(--track)", color: "var(--text)", fontSize: 22 } as const;
  return (
    <Shell>
      <h1 className="display" style={{ fontSize: 44, marginTop: 24 }}>MISSION: DISCOVERY</h1>
      <label style={{ display: "block", marginTop: 28, color: "var(--text-dim)" }}>
        Enter the code on the big screen
        <input value={c} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" inputMode="text" style={{ ...field, fontSize: 40, letterSpacing: 10, fontFamily: "var(--font-display)" }} />
      </label>
      <label style={{ display: "block", marginTop: 16, color: "var(--text-dim)" }}>
        Your name
        <input value={n} onChange={(e) => setName(e.target.value)} maxLength={24} style={field} />
      </label>
      {error && <p style={{ color: "var(--bad)", marginTop: 12 }}>{error}</p>}
      <button className="btn" style={{ marginTop: 20, width: "100%", padding: 16, fontSize: 20 }} disabled={c.length !== 4} onClick={join}>
        Join a Mission
      </button>
    </Shell>
  );
}

function RolePick({ myRoles }: { myRoles: RoleId[] }) {
  const { state, send } = useMission();
  if (!state) return null;
  const open = ROLES.filter((r) => !state.roles[r]);
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: 18 }}>Pick your role. Each one sees the mission differently.</p>
      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {ROLES.map((r) => {
          const info = ROLE_INFO[r];
          const holder = state.roles[r];
          const mine = myRoles.includes(r);
          const taken = !!holder && !mine;
          const who = taken ? state.players.find((p) => p.id === holder)?.name : null;
          return (
            <button
              key={r}
              disabled={taken}
              onClick={() => send(mine ? { t: "release", role: r } : { t: "claim", role: r })}
              style={{ textAlign: "left", padding: 14, borderRadius: 8, background: mine ? info.color : "var(--track)", color: mine ? "#0A0C10" : "#fff", opacity: taken ? 0.45 : 1, borderLeft: `6px solid ${info.color}` }}
            >
              <div className="display" style={{ fontSize: 26 }}>{info.name}</div>
              <div style={{ fontSize: 14, opacity: 0.85 }}>{info.title}{who ? ` · ${who}` : ""}</div>
              <div style={{ fontSize: 15, marginTop: 6 }}>{info.line}</div>
              <div style={{ fontSize: 14, marginTop: 4, opacity: 0.85 }}>Strength: {info.strength}</div>
            </button>
          );
        })}
      </div>
      {myRoles.length > 0 && open.length > 0 && (
        <p style={{ marginTop: 14, color: "var(--text-dim)" }}>
          Nobody picked {open.map((r) => ROLE_INFO[r].name).join(" or ")}. Want to take that role too? Tap it above.
        </p>
      )}
      <p style={{ marginTop: 14, color: "var(--text-dim)" }}>The host starts the mission from the big screen.</p>
    </div>
  );
}

function ObjectivePick() {
  const { state, send, playerId } = useMission();
  if (!state) return null;
  const mine = state.votes.objective?.[playerId];
  return (
    <div style={{ marginTop: 20 }}>
      <div className="display" style={{ fontSize: 36 }}>{EMBER.codename}</div>
      <p style={{ marginTop: 6 }}>{EMBER.briefing}</p>
      <p style={{ marginTop: 14, color: "var(--text-dim)" }}>Vote for your objective.</p>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {EMBER.objectives.map((o) => (
          <button
            key={o.id}
            onClick={() => send({ t: "vote", key: "objective", option: o.id })}
            style={{ textAlign: "left", padding: 14, borderRadius: 8, background: mine === o.id ? "var(--accent)" : "var(--track)", color: "#fff" }}
          >
            <div className="display" style={{ fontSize: 24 }}>{o.title}</div>
            <div style={{ fontSize: 14, marginTop: 4, opacity: 0.85 }}>{o.must.join(". ")}.</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Build({ myRoles, sim }: { myRoles: RoleId[]; sim: ReturnType<typeof simulate> }) {
  const { state, send } = useMission();
  if (!state) return null;
  const slots = CLEANROOM_SLOTS.filter((s) => myRoles.includes(SLOT_OWNER[s]));
  const resources = [...new Set(myRoles.flatMap((r) => ROLE_INFO[r].resources))];
  const checks = sim.checks.filter((c) => resources.includes(c.resource));
  return (
    <div style={{ marginTop: 20 }}>
      <div className="display" style={{ fontSize: 36 }}>The Clean Room</div>
      {resources.length > 0 && <div style={{ marginTop: 12 }}><Hud sim={sim} only={resources} size="small" /></div>}
      {checks.map((c) => (
        <div key={c.id} style={{ borderLeft: `4px solid ${STATUS_COLOR[c.status]}`, paddingLeft: 10, marginTop: 10, fontSize: 15 }}>{c.line}</div>
      ))}
      {slots.length === 0 && <p style={{ marginTop: 16, color: "var(--text-dim)" }}>Your role picks later. Help your crew decide.</p>}
      {slots.map((slot) => {
        const optional = OPTIONAL_SLOTS.includes(slot);
        const current = state.design[slot];
        const color = ROLE_INFO[SLOT_OWNER[slot]].color;
        return (
          <section key={slot} style={{ marginTop: 22 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {SLOT_LABEL[slot]}{optional ? " (Optional)" : ""}
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {optional && (
                <button onClick={() => send({ t: "set", slot, value: null })} style={{ textAlign: "left", padding: 12, borderRadius: 6, background: !current ? color : "var(--track)", color: "#fff" }}>
                  None
                </button>
              )}
              {partsForSlot(slot).map((p) => (
                <button
                  key={p.id}
                  onClick={() => send({ t: "set", slot, value: p.id })}
                  style={{ textAlign: "left", padding: 12, borderRadius: 6, background: current === p.id ? color : "var(--track)", color: "#fff" }}
                >
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 14, opacity: 0.85, marginTop: 2 }}>{p.blurb}</div>
                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                    {[p.mass ? `${p.mass} kg` : null, `$${p.cost}k`, p.power ? `uses ${p.power} W` : null, p.gen ? `makes ${p.gen} W` : null].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <div style={{ display: "grid", gap: 8, marginTop: 24, marginBottom: 24 }}>
        {myRoles.map((r) => (
          <button key={r} className="btn" style={{ background: state.ready[r] ? "var(--track)" : ROLE_INFO[r].color }} onClick={() => send({ t: "ready", role: r, ready: !state.ready[r] })}>
            {state.ready[r] ? `${ROLE_INFO[r].name} Is Ready (Tap to Keep Building)` : `${ROLE_INFO[r].name} Ready`}
          </button>
        ))}
      </div>
    </div>
  );
}

const RANK = { ok: 0, empty: 1, warn: 2, bad: 3 } as const;

function RoleCards({ myRoles, bars, total }: { myRoles: RoleId[]; bars: Bar[]; total: number }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div className="display" style={{ fontSize: 36 }}>Mission Report</div>
      <p style={{ color: "var(--text-dim)" }}>Crew score: {total} of 1,000. The full report is on the big screen.</p>
      {myRoles.map((r) => {
        const mine = bars.filter((b) => ROLE_INFO[r].resources.includes(b.key)).sort((a, b) => RANK[a.status] - RANK[b.status]);
        const best = mine[0];
        const worst = mine[mine.length - 1];
        return (
          <div key={r} className="panel" style={{ marginTop: 14, borderLeft: `6px solid ${ROLE_INFO[r].color}` }}>
            <div className="display" style={{ fontSize: 24 }}>{ROLE_INFO[r].name}</div>
            <p style={{ marginTop: 6 }}>
              As {ROLE_INFO[r].name}, you {best?.status === "ok" ? `kept ${best.label.toLowerCase()} healthy` : "kept the mission moving"}. Next time, watch your {(worst ?? best)?.label.toLowerCase() ?? "margins"}.
            </p>
          </div>
        );
      })}
      <div style={{ marginTop: 20 }}><ReactionButtons /></div>
    </div>
  );
}
