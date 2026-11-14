"use client";
// One live connection to a room. The room owns the state; this store mirrors it.
import PartySocket from "partysocket";
import { create } from "zustand";
import type { ClientMsg, MinigameId, MissionState, RoleId, ServerMsg } from "../protocol";

export const PARTY_HOST = process.env.NEXT_PUBLIC_PARTY_HOST ?? "mission-discovery-rooms.intellovate.workers.dev";

export interface Reaction {
  id: number;
  role: RoleId | null;
  name: string;
  kind: "cheer" | "careful" | "why";
}

interface MissionStore {
  code: string | null;
  isHost: boolean;
  playerId: string;
  state: MissionState | null;
  error: string | null;
  connected: boolean;
  live: Partial<Record<MinigameId, unknown>>;
  reactions: Reaction[];
  connect: (code: string, as: "host" | "player", name?: string) => void;
  send: (msg: ClientMsg) => void;
  clearLive: () => void;
}

let socket: PartySocket | null = null;
let reactionId = 0;

export function getPlayerId(): string {
  try {
    const k = "md-player-id";
    let id = localStorage.getItem(k);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return "p-" + Math.random().toString(36).slice(2);
  }
}

export const useMission = create<MissionStore>((set, get) => ({
  code: null,
  isHost: false,
  playerId: "",
  state: null,
  error: null,
  connected: false,
  live: {},
  reactions: [],
  connect: (code, as, name) => {
    socket?.close();
    const playerId = as === "host" ? "host-" + getPlayerId() : getPlayerId();
    set({ code, isHost: as === "host", playerId, error: null, state: null });
    const ws = new PartySocket({ host: PARTY_HOST, party: "mission-room", room: code });
    socket = ws;
    ws.addEventListener("open", () => {
      set({ connected: true });
      ws.send(JSON.stringify({ t: "hello", as, playerId, name } satisfies ClientMsg));
    });
    ws.addEventListener("close", () => set({ connected: false }));
    ws.addEventListener("message", (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string) as ServerMsg;
      if (msg.t === "state") set({ state: msg.state });
      else if (msg.t === "error") set({ error: msg.message });
      else if (msg.t === "mg:live") set({ live: { ...get().live, [msg.id]: msg.data } });
      else if (msg.t === "react") {
        const r: Reaction = { id: ++reactionId, role: msg.role, name: msg.name, kind: msg.kind };
        set({ reactions: [...get().reactions.slice(-5), r] });
        setTimeout(() => set({ reactions: get().reactions.filter((x) => x.id !== r.id) }), 3500);
      }
    });
  },
  send: (msg) => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  },
  clearLive: () => set({ live: {} }),
}));
