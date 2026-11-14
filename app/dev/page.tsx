"use client";
// Dev harness: test one mini game (play and watch side by side) or one 3D scene, no room needed.
//   /dev?mg=fairing     /dev?scene=cleanroom|launch|flight
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MINIGAMES } from "@/lib/minigames/registry";
import { devState } from "@/lib/dev/fixture";
import { simulate } from "@/lib/game/sim";
import type { MinigameId, MinigameResult } from "@/lib/protocol";
import type { ObjectiveId } from "@/lib/game/data/ember";
import CleanRoom from "@/components/scenes/CleanRoom";
import LaunchSite from "@/components/scenes/LaunchSite";
import FlightPath from "@/components/scenes/FlightPath";

export default function Dev() {
  const search = useSyncExternalStore(() => () => {}, () => location.search, () => null);
  const q = useMemo(() => {
    const p = new URLSearchParams(search ?? "");
    return { mg: p.get("mg") ?? undefined, scene: p.get("scene") ?? undefined };
  }, [search]);
  const state = useMemo(() => devState(), []);
  const sim = useMemo(() => simulate(state.design, state.objectiveId as ObjectiveId), [state]);
  const [live, setLive] = useState<unknown>(null);
  const [team, setTeam] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<MinigameResult | null>(null);
  const last = useRef(0);

  if (search === null) return null;
  if (q.scene) {
    const Scene = q.scene === "launch" ? LaunchSite : q.scene === "flight" ? FlightPath : CleanRoom;
    return (
      <div style={{ position: "fixed", inset: 0 }}>
        <Scene state={state} sim={sim} activeRole="forge" />
      </div>
    );
  }
  const def = MINIGAMES[(q.mg ?? "fairing") as MinigameId];
  if (!def) return <p>Unknown mini game</p>;
  const ctx = (host: boolean) => ({ state, sim, myRoles: host ? [] : (["zenith", "forge", "prism", "vector"] as const).slice(), isHost: host });
  const sendLive = (f: unknown) => {
    const now = performance.now();
    if (now - last.current > 90) {
      last.current = now;
      setLive(f);
    }
  };
  const patchTeam = (p: Record<string, unknown>) => setTeam((t) => ({ ...t, ...p }));
  const C = def.Component;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "390px 1fr", gap: 16, padding: 16, minHeight: "100vh", background: "#0A0C10", color: "#ECEFF3" }}>
      <div>
        <div style={{ marginBottom: 8 }}>Device (play)</div>
        <div style={{ width: 390, height: 760, position: "relative", background: def.wipe, overflow: "hidden" }}>
          <C mode="play" live={null} sendLive={sendLive} finish={setResult} ctx={ctx(false)} team={team} patchTeam={patchTeam} />
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 8 }}>Big screen (watch) · {def.title}: {def.subtitle}</div>
        <div style={{ aspectRatio: "16 / 9", position: "relative", background: def.wipe, overflow: "hidden" }}>
          <C mode="watch" live={live} sendLive={() => {}} finish={() => {}} ctx={ctx(true)} team={team} patchTeam={patchTeam} />
        </div>
        <pre style={{ marginTop: 12, fontSize: 13 }}>result: {JSON.stringify(result)}</pre>
      </div>
    </div>
  );
}
