"use client";
// A crew member's device. Join by code, pick roles, vote, build your slots in the Clean Room,
// play the mini games you own, watch and react to the rest, then read your role card.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { rolesOf, ROLES, stepsFor, type RoleId } from "@/lib/protocol";
import { useMission } from "@/lib/net/useMission";
import { score, simulate } from "@/lib/game/sim";
import { EMBER, type ObjectiveId } from "@/lib/game/data/ember";
import { MG_ACTION, ROLE_INFO } from "@/lib/game/roles";
import { MINIGAMES } from "@/lib/minigames/registry";
import Build from "@/components/shell/Build";
import RoleCards from "@/components/shell/RoleCards";
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

