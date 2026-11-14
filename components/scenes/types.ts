import type { MissionState, RoleId } from "@/lib/protocol";
import type { Sim } from "@/lib/game/sim";

/** Every 3D scene is a full-size R3F <Canvas> on the big screen, driven by room state. */
export interface SceneProps {
  state: MissionState;
  sim: Sim;
  /** Role whose turn it is (spotlight them), if any. */
  activeRole?: RoleId | null;
}
