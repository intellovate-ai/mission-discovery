"use client";
// Single player: one screen, one player holding all four roles. The room runs in the browser
// (lib/net/localRoom.ts), so there is no code to share and no second device.
import { useEffect, useMemo, useRef, useState } from "react";
import { ROLES, stepsFor, type FinishedEntry } from "@/lib/protocol";
import { useMission } from "@/lib/net/useMission";
import { score, simulate } from "@/lib/game/sim";
import { CLEANROOM_SLOTS, EMBER, OPTIONAL_SLOTS, type ObjectiveId } from "@/lib/game/data/ember";
import { MINIGAMES } from "@/lib/minigames/registry";
import Build from "@/components/shell/Build";
import MinigameStage from "@/components/shell/MinigameStage";
import Report from "@/components/shell/Report";
import CleanRoom from "@/components/scenes/CleanRoom";
import LaunchSite from "@/components/scenes/LaunchSite";
import FlightPath from "@/components/scenes/FlightPath";

const REQUIRED = CLEANROOM_SLOTS.filter((s) => !OPTIONAL_SLOTS.includes(s));

export default function Solo() {
  const { state, local, send, startLocal, clearLive } = useMission();
  const [crew, setCrew] = useState("");
  const sim = useMemo(
    () => (state ? simulate(state.design, state.objectiveId as ObjectiveId | null, state.rescueUsed) : null),
    [state],
  );
  const steps = useMemo(() => stepsFor(state?.missionId ?? "ember"), [state?.missionId]);
  const stepIndex = state?.stepIndex ?? -1;
  const step = stepIndex >= 0 ? steps[stepIndex] : undefined;

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

  // Scenes play, then move on by themselves.
  useEffect(() => {
    if (step?.kind !== "scene") return;
    const t = setTimeout(advance, 10000);
    return () => clearTimeout(t);
  });

  // Team games ask for the budget rescue through shared state.
  const wantsRescue = !!state?.team["trade-study"]?.rescue || !!state?.team["design-review"]?.rescue;
  useEffect(() => {
    if (wantsRescue && state && !state.rescueUsed) send({ t: "rescue" });
  }, [wantsRescue, state, send]);

  // Report: post the run to the leaderboard once.
  const result = state && sim ? score(sim, state.results, state.objectiveId as ObjectiveId | null) : null;
  useEffect(() => {
    if (step?.kind !== "report" || !state || !sim || !result || state.finished) return;
    const entry: FinishedEntry = {
      crew: state.crew || "Solo Explorer",
      missionId: state.missionId,
      objectiveId: state.objectiveId ?? "",
      score: result.total,
      cml: result.cml,
      science: result.science,
      cost: Math.round(sim.costK),
      go: result.go,
      at: Date.now(),
    };
    send({ t: "finish", entry });
  });

  if (!local || !state || !sim) {
    const begin = () => {
      startLocal(crew.trim() || "Solo Explorer");
      useMission.getState().send({ t: "start", missionId: "ember" });
    };
    return (
      <main style={{ position: "fixed", inset: 0 }}>
        <div className="panel" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(520px, calc(100vw - 32px))" }}>
          <div className="display" style={{ fontSize: 44 }}>MISSION: DISCOVERY</div>
          <p style={{ color: "var(--text-dim)", marginTop: 6 }}>Single Player. You hold all four roles on this screen.</p>
          <label style={{ display: "block", marginTop: 20, color: "var(--text-dim)", fontSize: 15 }}>
            Name your crew (shown on the leaderboard)
            <input
              value={crew}
              onChange={(e) => setCrew(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && begin()}
              maxLength={28}
              autoFocus
              style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 6, background: "var(--track)", color: "var(--text)", fontSize: 18 }}
            />
          </label>
          <button className="btn" style={{ marginTop: 16 }} onClick={begin}>Start Mission</button>
        </div>
      </main>
    );
  }

  const sceneProps = { state, sim, activeRole: undefined };
  const missing = REQUIRED.filter((s) => !state.design[s]);
  const myRoles = [...ROLES];

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      {(step?.kind === "objective" || step?.kind === "report") && <FlightPath {...sceneProps} />}
      {step?.kind === "cleanroom" && <CleanRoom {...sceneProps} />}
      {step?.kind === "scene" && (step.scene === "launch" ? <LaunchSite {...sceneProps} /> : <FlightPath {...sceneProps} />)}

      {step?.kind === "mg" && (
        // The mini game is played right here, in a column sized like the device it was designed for.
        <div style={{ position: "absolute", inset: "0 0 64px 0", background: MINIGAMES[step.id].wipe, display: "grid", justifyItems: "center" }}>
          <div style={{ position: "relative", width: "min(100%, 560px)", height: "100%" }}>
            <MinigameStage key={`${stepIndex}-${step.id}`} id={step.id} mode="play" state={state} sim={sim} myRoles={myRoles} isHost={false} />
          </div>
        </div>
      )}

      {step?.kind === "objective" && (
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "min(1100px, 92vw)", maxHeight: "86vh", overflow: "auto" }}>
          <div className="panel">
            <div className="display" style={{ fontSize: 56 }}>{EMBER.codename}</div>
            <div style={{ color: "var(--text-dim)", fontSize: 18 }}>{EMBER.level}</div>
            <p style={{ fontSize: 22, marginTop: 10, maxWidth: 820 }}>{EMBER.briefing}</p>
            <p style={{ color: "var(--text-dim)", marginTop: 14 }}>Pick your objective.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 16 }}>
            {EMBER.objectives.map((o) => (
              <button
                key={o.id}
                className="panel"
                style={{ textAlign: "left", color: "var(--text)", cursor: "pointer" }}
                onClick={() => {
                  send({ t: "objective", objectiveId: o.id });
                  advance();
                }}
              >
                <div className="display" style={{ fontSize: 28 }}>{o.title}</div>
                <ul style={{ marginTop: 10, paddingLeft: 18, listStyle: "disc", color: "var(--text-dim)" }}>
                  {o.must.map((m) => <li key={m}>{m}</li>)}
                </ul>
                <p style={{ marginTop: 8, fontSize: 15 }}>Nice to have: {o.nice}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step?.kind === "cleanroom" && (
        <div className="panel" style={{ position: "absolute", top: 20, right: 24, bottom: 84, width: "min(440px, calc(100vw - 48px))", overflow: "auto", paddingTop: 4 }}>
          <Build myRoles={myRoles} sim={sim} showReady={false} />
        </div>
      )}

      {step?.kind === "scene" && (
        <div className="panel" style={{ position: "absolute", left: 24, bottom: 84 }}>
          <div className="display" style={{ fontSize: 72 }}>{step.scene === "launch" ? "Launch Site" : "The Flight Path"}</div>
          <div style={{ fontSize: 22, color: "var(--text-dim)", marginTop: 8 }}>
            {step.scene === "launch" ? "Time to choose a ride to space." : "In orbit. Now make the mission work."}
          </div>
        </div>
      )}

      {step?.kind === "report" && result && (
        <Report
          result={result}
          worked={sim.bars.filter((b) => b.status === "ok").slice(0, 2).map((b) => `${b.label}: ${b.value}`)}
          hurt={sim.checks.find((c) => c.status === "bad") ?? sim.checks.find((c) => c.status === "warn")}
          onNew={() => useMission.setState({ local: false, state: null })}
        />
      )}

      {/* Bottom strip: progress and the controls the big screen host would normally have */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64, padding: "0 24px", display: "flex", alignItems: "center", gap: 16, background: step?.kind === "mg" ? "var(--surface)" : undefined }}>
        <div style={{ display: "flex", gap: 6, flex: 1 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ height: 6, flex: 1, borderRadius: 3, background: i < stepIndex ? "var(--text-dim)" : i === stepIndex ? "var(--accent)" : "var(--track)" }} />
          ))}
        </div>
        {step?.kind === "mg" && (
          <button
            className="btn btn-quiet"
            onClick={() => send({ t: "mg:done", id: step.id, result: { ...MINIGAMES[step.id].autoResolve({ state, sim, myRoles, isHost: false }), auto: true } })}
          >
            Skip With Average Result
          </button>
        )}
        {(step?.kind === "scene" || step?.kind === "cleanroom") && (
          <button className="btn" onClick={advance} disabled={step.kind === "cleanroom" && missing.length > 0}>
            {step.kind === "cleanroom" && missing.length > 0 ? `Still to Pick: ${missing.length}` : "Continue"}
          </button>
        )}
      </div>
    </main>
  );
}
