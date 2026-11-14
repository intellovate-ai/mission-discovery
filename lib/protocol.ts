// Shared between the room server (party/), the big screen (/host) and devices (/play).
// The room owns this state; screens are views of it.

export type RoleId = "zenith" | "forge" | "prism" | "vector";
export const ROLES: RoleId[] = ["zenith", "forge", "prism", "vector"];

export type MissionId = "ember" | "coldtrap" | "dustdevil";

export type MinigameId =
  | "fairing"
  | "launch-vehicle"
  | "launch-window"
  | "ground-track"
  | "downlink"
  | "trade-study"
  | "design-review";

/** One build choice per slot. Values are part ids from lib/game/data. */
export type Slot =
  | "bus"
  | "solar"
  | "battery"
  | "computer"
  | "pointing"
  | "instrument1"
  | "instrument2"
  | "heater"
  | "thruster"
  | "radio"
  | "ground"
  | "rocket"
  | "orbit";
export type Design = Partial<Record<Slot, string>>;

export type Step =
  | { kind: "objective" }
  | { kind: "cleanroom" }
  | { kind: "scene"; scene: "launch" | "flight" }
  | { kind: "mg"; id: MinigameId }
  | { kind: "report" };

export interface Player {
  id: string;
  name: string;
  connected: boolean;
}

export interface MinigameResult {
  /** 0..1 skill result; 0.5 is what auto-resolve gives. */
  score: number;
  /** Design choices the mini game made (rocket, orbit, ...). */
  set?: Design;
  /** One plain line for the big screen, from the Words Bible. */
  note: string;
  auto?: boolean;
}

export interface FinishedEntry {
  crew: string;
  missionId: MissionId;
  objectiveId: string;
  score: number;
  cml: string;
  science: number;
  cost: number;
  go: boolean;
  at: number;
  /** "dev" keeps local test runs off the live board the audience sees. */
  board?: "live" | "dev";
}

export interface MissionState {
  code: string;
  hostConnected: boolean;
  crew: string;
  missionId: MissionId;
  players: Player[];
  roles: Record<RoleId, string | null>;
  stepIndex: number; // -1 = lobby
  objectiveId: string | null;
  /** votes[key][playerId] = option */
  votes: Record<string, Record<string, string>>;
  design: Design;
  ready: Partial<Record<RoleId, boolean>>;
  results: Partial<Record<MinigameId, MinigameResult>>;
  /** Shared state for team mini games (trade study, design review), keyed by mini game. */
  team: Partial<Record<MinigameId, Record<string, unknown>>>;
  rescueUsed: boolean;
  finished: FinishedEntry | null;
  updatedAt: number;
}

export type ClientMsg =
  | { t: "hello"; as: "host" | "player"; playerId: string; name?: string }
  | { t: "claim"; role: RoleId }
  | { t: "release"; role: RoleId }
  | { t: "crew"; name: string }
  | { t: "start"; missionId: MissionId }
  | { t: "vote"; key: string; option: string }
  | { t: "set"; slot: Slot; value: string | null }
  | { t: "ready"; role: RoleId; ready: boolean }
  | { t: "objective"; objectiveId: string }
  | { t: "next" }
  | { t: "back" }
  | { t: "mg:live"; id: MinigameId; data: unknown }
  | { t: "mg:done"; id: MinigameId; result: MinigameResult }
  | { t: "mg:team"; id: MinigameId; patch: Record<string, unknown> }
  | { t: "rescue" }
  | { t: "react"; kind: "cheer" | "careful" | "why" }
  | { t: "finish"; entry: FinishedEntry }
  | { t: "again" };

export type ServerMsg =
  | { t: "state"; state: MissionState }
  | { t: "mg:live"; id: MinigameId; data: unknown }
  | { t: "react"; role: RoleId | null; name: string; kind: "cheer" | "careful" | "why" }
  | { t: "error"; code: "no-room" | "full" | "bad"; message: string };

/** Leaderboard room names. The live board starts fresh for the event. */
export function boardName(board: FinishedEntry["board"]): string {
  return board === "dev" ? "dev" : "live-2026";
}

export function stepsFor(missionId: MissionId): Step[] {
  // EMBER is the playable level for the hackathon; COLDTRAP and DUSTDEVIL reuse the flow.
  void missionId;
  return [
    { kind: "objective" },
    { kind: "cleanroom" },
    { kind: "mg", id: "fairing" },
    { kind: "scene", scene: "launch" },
    { kind: "mg", id: "launch-vehicle" },
    { kind: "mg", id: "launch-window" },
    { kind: "scene", scene: "flight" },
    { kind: "mg", id: "ground-track" },
    { kind: "mg", id: "downlink" },
    { kind: "mg", id: "trade-study" },
    { kind: "mg", id: "design-review" },
    { kind: "report" },
  ];
}

export function emptyState(code: string): MissionState {
  return {
    code,
    hostConnected: false,
    crew: "",
    missionId: "ember",
    players: [],
    roles: { zenith: null, forge: null, prism: null, vector: null },
    stepIndex: -1,
    objectiveId: null,
    votes: {},
    design: {},
    ready: {},
    results: {},
    team: {},
    rescueUsed: false,
    finished: null,
    updatedAt: 0, // the room stamps this on every save
  };
}

/** Roles held by a player (players double up when fewer than 4 join). */
export function rolesOf(state: MissionState, playerId: string): RoleId[] {
  return ROLES.filter((r) => state.roles[r] === playerId);
}

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newRoomCode(): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  return s;
}
