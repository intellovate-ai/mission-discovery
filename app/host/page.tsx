"use client";
// The big screen. Opens a room, shows the code, then follows the room's step list:
// objective vote, Clean Room build, scenes, mini games (mirrored live), report and leaderboard.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { newRoomCode, ROLES, stepsFor, type FinishedEntry, type RoleId, type Step } from "@/lib/protocol";
import { useMission } from "@/lib/net/useMission";
import { score, simulate } from "@/lib/game/sim";
import { CLEANROOM_SLOTS, EMBER, OPTIONAL_SLOTS, type ObjectiveId } from "@/lib/game/data/ember";
import { MG_ACTION, ROLE_INFO, STATUS_COLOR } from "@/lib/game/roles";
import { MINIGAMES } from "@/lib/minigames/registry";
import Hud from "@/components/shell/Hud";
import MinigameStage from "@/components/shell/MinigameStage";
import { ReactionFeed } from "@/components/shell/Reactions";
import Report from "@/components/shell/Report";
import CleanRoom from "@/components/scenes/CleanRoom";
import LaunchSite from "@/components/scenes/LaunchSite";
import FlightPath from "@/components/scenes/FlightPath";

const CODE_KEY = "md-host-code";
function hostCode(): string {
  let c = sessionStorage.getItem(CODE_KEY);
  if (!c) {
    c = newRoomCode();
    sessionStorage.setItem(CODE_KEY, c);
  }
  return c;
}

const isLocal = () => ["localhost", "127.0.0.1"].includes(location.hostname);

const REQUIRED = CLEANROOM_SLOTS.filter((s) => !OPTIONAL_SLOTS.includes(s));


function stepLabel(step: Step | undefined): string {
  if (!step) return "";
  if (step.kind === "objective") return "Objective";
  if (step.kind === "cleanroom") return "The Clean Room";
  if (step.kind === "scene") return step.scene === "launch" ? "Launch Site" : "The Flight Path";
  if (step.kind === "mg") return MINIGAMES[step.id].title;
  return "Mission Report";
}

export default function Host() {
  const code = useSyncExternalStore(() => () => {}, hostCode, () => null);
  const { connect, send, clearLive, state, connected } = useMission();

  useEffect(() => {
    if (code) connect(code, "host");
  }, [code, connect]);

  const sim = useMemo(
    () => (state ? simulate(state.design, state.objectiveId as ObjectiveId | null, state.rescueUsed) : null),
    [state],
  );
  const steps = useMemo(() => stepsFor(state?.missionId ?? "ember"), [state?.missionId]);
  const stepIndex = state?.stepIndex ?? -1;
  const step = stepIndex >= 0 ? steps[stepIndex] : undefined;

  // One advance per step, whether it came from a button or an automatic rule.
  const advancedFrom = useRef<number | null>(null);
  const advance = () => {
    if (advancedFrom.current === stepIndex) return;
    advancedFrom.current = stepIndex;
    send({ t: "next" });
  };
  useEffect(() => {
    advancedFrom.current = null;
    clearLive();
  }, [stepIndex, clearLive]);

  // Objective: lock in once every connected player has voted.
  const votes = state?.votes.objective ?? {};
  const tally = (id: string) => Object.values(votes).filter((v) => v === id).length;
  const lockObjective = () => {
    if (!state) return;
    const zenithVote = state.roles.zenith ? votes[state.roles.zenith] : undefined;
    const ranked = [...EMBER.objectives].sort(
      (a, b) => tally(b.id) - tally(a.id) || (b.id === zenithVote ? 1 : 0) - (a.id === zenithVote ? 1 : 0),
    );
    send({ t: "objective", objectiveId: ranked[0].id });
    advance();
  };
  const online = state?.players.filter((p) => p.connected) ?? [];
  const allVoted = online.length > 0 && online.every((p) => votes[p.id]);
  useEffect(() => {
    if (step?.kind !== "objective" || !allVoted) return;
    const t = setTimeout(lockObjective, 1500);
    return () => clearTimeout(t);
  });

  // Clean Room: continue once every required slot is filled and all four roles say ready.
  const missing = state ? REQUIRED.filter((s) => !state.design[s]) : [];
  const allReady = state ? ROLES.every((r) => state.ready[r]) : false;
  useEffect(() => {
    if (step?.kind === "cleanroom" && allReady && missing.length === 0) advance();
  });

  // Cinematic scenes play, then move on by themselves.
  useEffect(() => {
    if (step?.kind !== "scene") return;
    const t = setTimeout(advance, 10000);
    return () => clearTimeout(t);
  });

  // Team games ask for the budget rescue through shared state; the host spends it once.
  const wantsRescue = !!state?.team["trade-study"]?.rescue || !!state?.team["design-review"]?.rescue;
  useEffect(() => {
    if (wantsRescue && state && !state.rescueUsed) send({ t: "rescue" });
  }, [wantsRescue, state, send]);

  // Report: post the run to the leaderboard once, then show the board.
  const result = state && sim ? score(sim, state.results, state.objectiveId as ObjectiveId | null) : null;
  const posted = useRef(false);
  useEffect(() => {
    if (step?.kind !== "report" || !state || !sim || !result || state.finished || posted.current) return;
    posted.current = true;
    const entry: FinishedEntry = {
      crew: state.crew || "Unnamed Crew",
      missionId: state.missionId,
      objectiveId: state.objectiveId ?? "",
      score: result.total,
      cml: result.cml,
      science: result.science,
      cost: Math.round(sim.costK),
      go: result.go,
      at: Date.now(),
      board: isLocal() ? "dev" : "live",
    };
    send({ t: "finish", entry });
  });
  useEffect(() => {
    if (step?.kind !== "report") posted.current = false;
  }, [step?.kind]);

  if (!code) return null;
  if (!state || !sim) {
    return (
      <main className="min-h-screen grid place-items-center text-dim">
        {connected ? "Opening the mission room." : "Connecting to the mission room."}
      </main>
    );
  }

  const ownerRole = step?.kind === "mg" && MINIGAMES[step.id].owner !== "team" ? (MINIGAMES[step.id].owner as RoleId) : null;
  const ownerPlayer = ownerRole ? state.players.find((p) => p.id === state.roles[ownerRole]) : undefined;
  const sceneProps = { state, sim, activeRole: ownerRole ?? undefined };

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      {/* World layer */}
      {stepIndex === -1 && <LaunchSite {...sceneProps} />}
      {step?.kind === "objective" && <FlightPath {...sceneProps} />}
      {step?.kind === "cleanroom" && <CleanRoom {...sceneProps} />}
      {step?.kind === "scene" && (step.scene === "launch" ? <LaunchSite {...sceneProps} /> : <FlightPath {...sceneProps} />)}
      {step?.kind === "report" && <FlightPath {...sceneProps} />}
      {step?.kind === "mg" && (
        // The game gets the whole frame above the bottom strip, so no shell chrome covers it.
        <div style={{ position: "absolute", inset: "0 0 64px 0" }}>
          <MinigameStage key={`${stepIndex}-${step.id}`} id={step.id} mode="watch" state={state} sim={sim} myRoles={[]} isHost />
        </div>
      )}

      {/* Top right: who and where (the lobby and report show the code themselves) */}
      {stepIndex >= 0 && step?.kind !== "report" && step?.kind !== "mg" && <div style={{ position: "absolute", top: 20, right: 24, textAlign: "right", zIndex: 20 }}>
        <div className="display" style={{ fontSize: 40, letterSpacing: 2 }}>{state.code}</div>
        <div style={{ color: "var(--text-dim)" }}>{state.crew || "Unnamed Crew"} · {stepLabel(step)}</div>
      </div>}

      {stepIndex === -1 && <Lobby />}
      {step?.kind === "objective" && <ObjectiveVote tally={tally} votes={Object.keys(votes).length} online={online.length} onLock={lockObjective} />}

      {step && (step.kind === "cleanroom" || step.kind === "scene") && (
        <div className="panel" style={{ position: "absolute", top: 20, left: 24, zIndex: 20 }}>
          <Hud sim={sim} />
        </div>
      )}

      {step?.kind === "cleanroom" && (
        <div className="panel" style={{ position: "absolute", top: 20, right: 24, marginTop: 84, width: 420, zIndex: 20, maxHeight: "60vh", overflow: "auto" }}>
          <div className="display" style={{ fontSize: 28 }}>The Clean Room</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {ROLES.map((r) => (
              <span key={r} style={{ padding: "4px 10px", borderRadius: 4, background: state.ready[r] ? ROLE_INFO[r].color : "var(--track)", color: "#fff", fontWeight: 600 }}>
                {ROLE_INFO[r].name} {state.ready[r] ? "Ready" : "Building"}
              </span>
            ))}
          </div>
          {missing.length > 0 && <p style={{ color: "var(--text-dim)", marginTop: 12 }}>Still to pick: {missing.join(", ")}</p>}
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {sim.checks.length === 0 && <p style={{ color: "var(--text-dim)" }}>No problems found yet.</p>}
            {sim.checks.map((c) => (
              <div key={c.id} style={{ borderLeft: `4px solid ${STATUS_COLOR[c.status]}`, paddingLeft: 10, fontSize: 16 }}>{c.line}</div>
            ))}
          </div>
        </div>
      )}

      {step?.kind === "scene" && (
        <div className="panel" style={{ position: "absolute", left: 24, bottom: 84, zIndex: 20 }}>
          <div className="display" style={{ fontSize: 72 }}>{step.scene === "launch" ? "Launch Site" : "The Flight Path"}</div>
          <div style={{ fontSize: 22, color: "var(--text-dim)", marginTop: 8 }}>
            {step.scene === "launch" ? "Time to choose a ride to space." : "In orbit. Now make the mission work."}
          </div>
        </div>
      )}

      {step?.kind === "report" && result && (
        <Report result={result} worked={sim.bars.filter((b) => b.status === "ok").slice(0, 2).map((b) => `${b.label}: ${b.value}`)} hurt={sim.checks.find((c) => c.status === "bad") ?? sim.checks.find((c) => c.status === "warn")} onNew={() => { sessionStorage.removeItem(CODE_KEY); location.reload(); }} />
      )}

      {/* Bottom bar: progress and host controls */}
      {stepIndex >= 0 && (
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: 64, padding: "0 24px", display: "flex", alignItems: "center", gap: 16, zIndex: 25,
            background: step?.kind === "mg" ? "var(--surface)" : undefined,
          }}
        >
          {step?.kind === "mg" && (
            <div style={{ whiteSpace: "nowrap", borderLeft: `4px solid ${ownerRole ? ROLE_INFO[ownerRole].color : "var(--text-dim)"}`, paddingLeft: 10 }}>
              {ownerRole ? <>Watching: <b>{ROLE_INFO[ownerRole].name}</b> is {MG_ACTION[step.id]}.</> : <>The whole crew is {MG_ACTION[step.id]}.</>}
              {ownerPlayer && !ownerPlayer.connected && <span style={{ color: "var(--warn)" }}> Their device is offline.</span>}
              <span className="display" style={{ marginLeft: 16, letterSpacing: 2, color: "var(--text-dim)" }}>{state.code}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flex: 1 }}>
            {steps.map((s, i) => (
              <div key={i} title={stepLabel(s)} style={{ height: 6, flex: 1, borderRadius: 3, background: i < stepIndex ? "var(--text-dim)" : i === stepIndex ? "var(--accent)" : "var(--track)" }} />
            ))}
          </div>
          {step?.kind === "mg" && (
            <button
              className="btn btn-quiet"
              onClick={() => {
                const def = MINIGAMES[step.id];
                send({ t: "mg:done", id: step.id, result: { ...def.autoResolve({ state, sim, myRoles: [], isHost: true }), auto: true } });
              }}
            >
              Skip With Average Result
            </button>
          )}
          {(step?.kind === "scene" || step?.kind === "cleanroom") && (
            <button className="btn" onClick={advance} disabled={step.kind === "cleanroom" && missing.length > 0}>
              Continue
            </button>
          )}
        </div>
      )}
      <ReactionFeed />
    </main>
  );
}

function Lobby() {
  const { state, send } = useMission();
  const [crew, setCrew] = useState("");
  if (!state) return null;
  const joinUrl = `${location.host}/play`;
  const start = () => {
    if (crew.trim()) send({ t: "crew", name: crew.trim() });
    send({ t: "start", missionId: "ember" });
  };
  return (
    <div className="panel" style={{ position: "absolute", top: 20, right: 24, width: 440, zIndex: 20 }}>
      <div className="display" style={{ fontSize: 44 }}>MISSION: DISCOVERY</div>
      <p style={{ color: "var(--text-dim)", marginTop: 6 }}>Design it. Launch it. Find out why.</p>
      <p style={{ marginTop: 20, fontSize: 18 }}>Go to <b>{joinUrl}</b> and enter</p>
      <div className="display" style={{ fontSize: 120, letterSpacing: 8, color: "var(--accent)" }}>{state.code}</div>
      <p style={{ color: "var(--text-dim)" }}>Waiting for your crew. Up to 4 can join.</p>
      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {state.players.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", opacity: p.connected ? 1 : 0.5 }}>
            <span style={{ fontWeight: 600 }}>{p.name}</span>
            <span>
              {ROLES.filter((r) => state.roles[r] === p.id).map((r) => (
                <span key={r} style={{ color: ROLE_INFO[r].color, marginLeft: 10, fontWeight: 700 }}>{ROLE_INFO[r].name}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <label style={{ display: "block", marginTop: 20, color: "var(--text-dim)", fontSize: 15 }}>
        Name your crew (shown on the leaderboard)
        <input
          value={crew}
          onChange={(e) => setCrew(e.target.value)}
          maxLength={28}
          style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 6, background: "var(--track)", color: "var(--text)", fontSize: 18 }}
        />
      </label>
      <button className="btn" style={{ marginTop: 16 }} disabled={state.players.length === 0} onClick={start}>
        Start Mission
      </button>
    </div>
  );
}

function ObjectiveVote({ tally, votes, online, onLock }: { tally: (id: string) => number; votes: number; online: number; onLock: () => void }) {
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "min(1100px, 92vw)", zIndex: 20 }}>
      <div className="display" style={{ fontSize: 64 }}>{EMBER.codename}</div>
      <div style={{ color: "var(--text-dim)", fontSize: 20 }}>{EMBER.level}</div>
      <p style={{ fontSize: 24, marginTop: 12, maxWidth: 820 }}>{EMBER.briefing}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
        {EMBER.objectives.map((o) => (
          <div key={o.id} className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="display" style={{ fontSize: 28 }}>{o.title}</div>
              <div className="display" style={{ fontSize: 36, color: "var(--accent)" }}>{tally(o.id)}</div>
            </div>
            <ul style={{ marginTop: 10, paddingLeft: 18, listStyle: "disc", color: "var(--text-dim)" }}>
              {o.must.map((m) => <li key={m}>{m}</li>)}
            </ul>
            <p style={{ marginTop: 8, fontSize: 15 }}>Nice to have: {o.nice}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 20 }}>
        <span style={{ color: "var(--text-dim)" }}>{votes} of {online} voted on their devices.</span>
        <button className="btn" disabled={votes === 0} onClick={onLock}>Lock In Objective</button>
      </div>
    </div>
  );
}

