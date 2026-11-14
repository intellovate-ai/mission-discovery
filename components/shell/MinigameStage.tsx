"use client";
// Hosts one mini game inside a shell: the wipe into its own world, the intro card, and the
// wiring from the kit contract (sendLive / finish / patchTeam) to the room.
import { useCallback, useEffect, useRef, useState } from "react";
import { MINIGAMES } from "@/lib/minigames/registry";
import { useMission } from "@/lib/net/useMission";
import type { MinigameId, MinigameResult, MissionState, RoleId } from "@/lib/protocol";
import type { Sim } from "@/lib/game/sim";
import { ROLE_INFO } from "@/lib/game/roles";

interface Props {
  id: MinigameId;
  mode: "play" | "watch";
  state: MissionState;
  sim: Sim;
  myRoles: RoleId[];
  isHost: boolean;
}

export default function MinigameStage({ id, mode, state, sim, myRoles, isHost }: Props) {
  const def = MINIGAMES[id];
  const send = useMission((s) => s.send);
  const live = useMission((s) => s.live[id] ?? null);
  // Players tap Start on their intro card; the big screen shows its card briefly, then the game.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (mode !== "watch") return;
    const t = setTimeout(() => setStarted(true), 2600);
    return () => clearTimeout(t);
  }, [mode]);

  // Throttle live frames to about 10 a second, always delivering the last one.
  const lastSent = useRef(0);
  const pending = useRef<unknown>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendLive = useCallback(
    (frame: unknown) => {
      pending.current = frame;
      const flush = () => {
        lastSent.current = performance.now();
        timer.current = null;
        send({ t: "mg:live", id, data: pending.current });
      };
      const wait = 100 - (performance.now() - lastSent.current);
      if (wait <= 0) flush();
      else if (!timer.current) timer.current = setTimeout(flush, wait);
    },
    [id, send],
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const done = useRef(false);
  const finish = useCallback(
    (result: MinigameResult) => {
      if (done.current || mode !== "play") return;
      done.current = true;
      send({ t: "mg:done", id, result });
    },
    [id, mode, send],
  );
  const team = (state.team[id] ?? {}) as Record<string, unknown>;
  const patchTeam = useCallback((patch: Record<string, unknown>) => send({ t: "mg:team", id, patch }), [id, send]);

  if (!def) return null;
  const C = def.Component;
  const owner = def.owner === "team" ? "The Whole Crew" : `${ROLE_INFO[def.owner].title} ${ROLE_INFO[def.owner].name}`;

  return (
    <div className="wipe-in" style={{ position: "absolute", inset: 0, background: def.wipe, overflow: "hidden" }}>
      {started ? (
        <C
          mode={mode}
          live={live}
          sendLive={sendLive}
          finish={finish}
          ctx={{ state, sim, myRoles, isHost }}
          team={team}
          patchTeam={patchTeam}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 640 }}>
            <div className="display" style={{ fontSize: mode === "watch" && isHost ? 120 : 56, color: "#fff" }}>
              {def.title}
            </div>
            <div style={{ fontSize: mode === "watch" && isHost ? 34 : 22, marginTop: 12, color: "#fff" }}>{def.subtitle}</div>
            <div style={{ fontSize: mode === "watch" && isHost ? 22 : 17, marginTop: 16, color: "rgba(255,255,255,.8)" }}>{def.howTo}</div>
            <div style={{ fontSize: 15, marginTop: 20, color: "rgba(255,255,255,.7)" }}>{owner}</div>
            {mode === "play" && (
              <button className="btn" style={{ marginTop: 28, background: "#fff", color: "#0A0C10" }} onClick={() => setStarted(true)}>
                Start
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
