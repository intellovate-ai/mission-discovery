// Single player: the room runs in the browser instead of on the server.
// This mirrors MissionRoom.onMessage in party/index.ts for the messages a solo game sends.
// Keep the two in step if either changes. (The server is left untouched so multiplayer
// keeps the exact behavior it was tested with.)
import { emptyState, ROLES, stepsFor, type ClientMsg, type MissionState } from "../protocol";

export function soloState(playerId: string, crew: string): MissionState {
  const s = emptyState("SOLO");
  s.hostConnected = true;
  s.crew = crew.slice(0, 28);
  s.players = [{ id: playerId, name: crew.slice(0, 24) || "Crew", connected: true }];
  for (const r of ROLES) s.roles[r] = playerId;
  return s;
}

/** Applies one message to a copy of the state. Returns null when nothing changed. */
export function applyLocal(prev: MissionState, msg: ClientMsg, playerId: string): MissionState | null {
  const s = structuredClone(prev);
  const steps = stepsFor(s.missionId);
  switch (msg.t) {
    case "crew":
      s.crew = msg.name.slice(0, 28);
      break;
    case "start":
      s.missionId = msg.missionId;
      for (const r of ROLES) if (!s.roles[r]) s.roles[r] = playerId;
      s.stepIndex = 0;
      break;
    case "vote":
      s.votes[msg.key] = { ...(s.votes[msg.key] ?? {}), [playerId]: msg.option };
      break;
    case "objective":
      s.objectiveId = msg.objectiveId;
      break;
    case "set":
      if (msg.value === null) delete s.design[msg.slot];
      else s.design[msg.slot] = msg.value;
      break;
    case "ready":
      s.ready[msg.role] = msg.ready;
      break;
    case "next":
      s.stepIndex = Math.min(s.stepIndex + 1, steps.length - 1);
      s.ready = {};
      break;
    case "back":
      s.stepIndex = Math.max(s.stepIndex - 1, 0);
      break;
    case "mg:done": {
      const step = steps[s.stepIndex];
      if (step?.kind !== "mg" || step.id !== msg.id || s.results[msg.id]) return null;
      s.results[msg.id] = msg.result;
      for (const [slot, value] of Object.entries(msg.result.set ?? {}) as [keyof typeof s.design, string | null | undefined][]) {
        if (value) s.design[slot] = value;
        else delete s.design[slot];
      }
      s.stepIndex = Math.min(s.stepIndex + 1, steps.length - 1);
      break;
    }
    case "mg:team":
      s.team[msg.id] = { ...(s.team[msg.id] ?? {}), ...msg.patch };
      break;
    case "rescue":
      s.rescueUsed = true;
      break;
    case "finish":
      if (s.finished) return null;
      s.finished = msg.entry;
      break;
    case "again":
      s.stepIndex = 0;
      s.results = {};
      s.team = {};
      s.votes = {};
      s.ready = {};
      s.finished = null;
      s.rescueUsed = false;
      break;
    default:
      // claim, release, hello, mg:live, react: no shared state to change in a solo game.
      return null;
  }
  s.updatedAt = Date.now();
  return s;
}
