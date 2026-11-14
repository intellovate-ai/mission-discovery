import { getServerByName, routePartykitRequest, Server, type Connection } from "partyserver";
import {
  emptyState,
  ROLES,
  stepsFor,
  type ClientMsg,
  type FinishedEntry,
  type MissionState,
  type ServerMsg,
} from "../lib/protocol";

interface Env {
  MissionRoom: DurableObjectNamespace<MissionRoom>;
  Leaderboard: DurableObjectNamespace<Leaderboard>;
}

type ConnInfo = { playerId: string; host: boolean };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** One room per 4-letter code. The room owns the game state; screens are views. */
export class MissionRoom extends Server<Env> {
  static options = { hibernate: true };
  state!: MissionState;

  async onStart() {
    const saved = await this.ctx.storage.get<MissionState>("state");
    this.state = saved ?? emptyState(this.name);
  }

  private save() {
    this.state.updatedAt = Date.now();
    void this.ctx.storage.put("state", this.state);
    this.broadcastState();
  }

  private send(conn: Connection, msg: ServerMsg) {
    conn.send(JSON.stringify(msg));
  }

  private broadcastState() {
    this.broadcast(JSON.stringify({ t: "state", state: this.state } satisfies ServerMsg));
  }

  private refreshPresence() {
    const live = new Set<string>();
    let host = false;
    for (const c of this.getConnections<ConnInfo>()) {
      const info = c.state;
      if (!info) continue;
      if (info.host) host = true;
      else live.add(info.playerId);
    }
    this.state.hostConnected = host;
    for (const p of this.state.players) p.connected = live.has(p.id);
  }

  onClose() {
    this.refreshPresence();
    this.save();
  }

  onMessage(conn: Connection<ConnInfo>, raw: string | ArrayBuffer) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    const s = this.state;
    const me = conn.state;

    if (msg.t === "hello") {
      if (msg.as === "host") {
        conn.setState({ playerId: msg.playerId, host: true });
        if (!s.code) s.code = this.name;
        this.refreshPresence();
        this.save();
        return;
      }
      // A device can only join a room a host has opened.
      const known = s.players.some((p) => p.id === msg.playerId);
      if (!s.hostConnected && !known && s.players.length === 0 && s.stepIndex === -1) {
        const anyHost = [...this.getConnections<ConnInfo>()].some((c) => c.state?.host);
        if (!anyHost) {
          this.send(conn, { t: "error", code: "no-room", message: "No mission with that code. Check the big screen and try again." });
          return;
        }
      }
      if (!known) {
        if (s.players.length >= 4) {
          this.send(conn, { t: "error", code: "full", message: "This crew is full. Ask the host to start a new mission." });
          return;
        }
        s.players.push({ id: msg.playerId, name: (msg.name || "Crew").slice(0, 24), connected: true });
      } else if (msg.name) {
        const p = s.players.find((x) => x.id === msg.playerId);
        if (p) p.name = msg.name.slice(0, 24);
      }
      conn.setState({ playerId: msg.playerId, host: false });
      this.refreshPresence();
      this.save();
      return;
    }

    if (!me) return; // must say hello first
    const steps = stepsFor(s.missionId);

    switch (msg.t) {
      case "claim": {
        if (s.roles[msg.role] && s.roles[msg.role] !== me.playerId) return;
        s.roles[msg.role] = me.playerId;
        break;
      }
      case "release": {
        if (s.roles[msg.role] === me.playerId) s.roles[msg.role] = null;
        break;
      }
      case "crew":
        s.crew = msg.name.slice(0, 28);
        break;
      case "start": {
        s.missionId = msg.missionId;
        // Unclaimed roles go to whoever joined first, so every job has an owner.
        const first = s.players[0]?.id ?? null;
        for (const r of ROLES) if (!s.roles[r]) s.roles[r] = first;
        s.stepIndex = 0;
        break;
      }
      case "vote":
        s.votes[msg.key] = { ...(s.votes[msg.key] ?? {}), [me.playerId]: msg.option };
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
      case "mg:live":
        // Relay the owner's live mini game frame to every other screen; not stored.
        this.broadcast(JSON.stringify({ t: "mg:live", id: msg.id, data: msg.data } satisfies ServerMsg), [conn.id]);
        return;
      case "mg:done": {
        const step = steps[s.stepIndex];
        if (step?.kind !== "mg" || step.id !== msg.id || s.results[msg.id]) return;
        s.results[msg.id] = msg.result;
        if (msg.result.set) Object.assign(s.design, msg.result.set);
        s.stepIndex = Math.min(s.stepIndex + 1, steps.length - 1);
        break;
      }
      case "mg:team":
        s.team[msg.id] = { ...(s.team[msg.id] ?? {}), ...msg.patch };
        break;
      case "rescue":
        s.rescueUsed = true;
        break;
      case "react": {
        const role = ROLES.find((r) => s.roles[r] === me.playerId) ?? null;
        const name = s.players.find((p) => p.id === me.playerId)?.name ?? "Host";
        this.broadcast(JSON.stringify({ t: "react", role, name, kind: msg.kind } satisfies ServerMsg));
        return;
      }
      case "finish": {
        if (s.finished) return;
        s.finished = msg.entry;
        void this.submitToLeaderboard(msg.entry);
        break;
      }
      case "again": {
        // Fly it again: keep crew and roles, keep the design, clear results.
        s.stepIndex = 0;
        s.results = {};
        s.team = {};
        s.votes = {};
        s.ready = {};
        s.finished = null;
        s.rescueUsed = false;
        break;
      }
    }
    this.save();
  }

  onConnect(conn: Connection) {
    this.send(conn, { t: "state", state: this.state });
  }

  private async submitToLeaderboard(entry: FinishedEntry) {
    const board = await getServerByName(this.env.Leaderboard, "global");
    await board.fetch(new Request("https://leaderboard/submit", { method: "POST", body: JSON.stringify(entry) }));
  }
}

/** One shared board for every room: finished missions, best first, per mission. */
export class Leaderboard extends Server<Env> {
  async onRequest(req: Request) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const entries = (await this.ctx.storage.get<FinishedEntry[]>("entries")) ?? [];
    if (req.method === "POST") {
      const e = (await req.json()) as FinishedEntry;
      if (typeof e?.score !== "number" || !e.missionId) return new Response("bad", { status: 400, headers: CORS });
      entries.push({ ...e, crew: String(e.crew || "Unnamed Crew").slice(0, 28) });
      entries.sort((a, b) => b.score - a.score);
      await this.ctx.storage.put("entries", entries.slice(0, 200));
      return new Response("ok", { headers: CORS });
    }
    const mission = new URL(req.url).searchParams.get("mission");
    const list = mission ? entries.filter((e) => e.missionId === mission) : entries;
    return new Response(JSON.stringify(list.slice(0, 20)), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    return (await routePartykitRequest(request, env as unknown as Record<string, unknown>)) || new Response("Not Found", { status: 404, headers: CORS });
  },
} satisfies ExportedHandler<Env>;
