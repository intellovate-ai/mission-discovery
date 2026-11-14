"use client";
// Dev only: design variations for testing the team games on /dev without a room.
//   /dev?mg=trade-study&fx=over-budget   (also: clean, power, review)
// Anywhere else (the real host and phone shells) this returns ctx untouched.
import { useMemo, useSyncExternalStore } from "react";
import { simulate } from "@/lib/game/sim";
import type { ObjectiveId } from "@/lib/game/data/ember";
import type { Design, MissionState } from "@/lib/protocol";
import type { MinigameContext } from "@/lib/minigames/types";

const VARIANTS: Record<string, { design: Partial<Design>; results?: MissionState["results"] }> = {
  // Radar on a 6U frame: $60k over budget, power tight, data a little short.
  "over-budget": {
    design: { bus: "bus-6u", battery: "battery-40", instrument1: "inst-radar", radio: "radio-sband", ground: "ground-2" },
  },
  // A design that closes: S-band clears the fixture's data gap.
  clean: { design: { radio: "radio-sband" } },
  // Thermal camera plus smart computer on body cells: the panels can't keep up.
  power: { design: { computer: "computer-smart", pointing: "pointing-wheels", instrument1: "inst-thermal", radio: "radio-sband" } },
  // Several Board questions with some moves unlocked (power, eclipse, lifetime).
  review: {
    design: {
      computer: "computer-smart",
      pointing: "pointing-wheels",
      instrument1: "inst-thermal",
      instrument2: "inst-color",
      radio: "radio-sband",
      ground: "ground-2",
      orbit: "leo-400",
    },
    results: { "launch-window": { score: 0.8, note: "Clean launch. Right on target." } },
  },
};

const subscribe = () => () => {};

export function useDevCtx(ctx: MinigameContext): MinigameContext {
  const search = useSyncExternalStore(
    subscribe,
    () => (location.pathname.startsWith("/dev") ? location.search : ""),
    () => "",
  );
  return useMemo(() => {
    const fx = new URLSearchParams(search).get("fx");
    const v = fx ? VARIANTS[fx] : undefined;
    if (!v) return ctx;
    const state: MissionState = {
      ...ctx.state,
      design: { ...ctx.state.design, ...v.design },
      results: { ...ctx.state.results, ...v.results },
    };
    return { ...ctx, state, sim: simulate(state.design, state.objectiveId as ObjectiveId | null, state.rescueUsed) };
  }, [ctx, search]);
}
