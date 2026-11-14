import type { MinigameId } from "../protocol";
import type { MinigameDef } from "./types";
import fairing from "@/components/minigames/fairing";
import launch_vehicle from "@/components/minigames/launch-vehicle";
import launch_window from "@/components/minigames/launch-window";
import ground_track from "@/components/minigames/ground-track";
import downlink from "@/components/minigames/downlink";
import trade_study from "@/components/minigames/trade-study";
import design_review from "@/components/minigames/design-review";

export const MINIGAMES: Record<MinigameId, MinigameDef> = {
  "fairing": fairing,
  "launch-vehicle": launch_vehicle,
  "launch-window": launch_window,
  "ground-track": ground_track,
  "downlink": downlink,
  "trade-study": trade_study,
  "design-review": design_review,
};
