// The mini game kit contract. Every mini game is ONE component that renders in two modes:
//   play  : on the owner's device. Runs the game, calls sendLive() with everything needed to
//           draw the current frame (about 10 times a second, the kit throttles), then finish().
//   watch : on the big screen and other devices. Draws ONLY from `live` (the owner's last frame).
// So the big screen mirrors the owner live with no extra code per game.
// Team games (owner "team") instead read `team` (shared room state) and write with patchTeam().
import type { ComponentType } from "react";
import type { MinigameId, MinigameResult, MissionState, RoleId } from "../protocol";
import type { Sim } from "../game/sim";

export interface MinigameContext {
  state: MissionState;
  sim: Sim;
  /** Roles this device holds (empty on the big screen). */
  myRoles: RoleId[];
  isHost: boolean;
}

export interface MinigameProps<L = unknown> {
  mode: "play" | "watch";
  live: L | null;
  sendLive: (frame: L) => void;
  finish: (result: MinigameResult) => void;
  ctx: MinigameContext;
  team: Record<string, unknown>;
  patchTeam: (patch: Record<string, unknown>) => void;
}

export interface MinigameDef {
  id: MinigameId;
  /** Words Bible: real term, plain subtitle, one line on how to play. */
  title: string;
  subtitle: string;
  howTo: string;
  owner: RoleId | "team";
  /** Art Bible section 3: wipe color and fonts for this mini game's own world. */
  wipe: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each game picks its own live frame type
  Component: ComponentType<MinigameProps<any>>;
  /** Average result used when the game is skipped. Must never break a run. */
  autoResolve: (ctx: MinigameContext) => MinigameResult;
}
