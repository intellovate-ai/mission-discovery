"use client";
// Shared helpers for the 3D scenes: role colors, a pop-in wrapper for parts, a seeded random,
// and the /dev query overrides (only active on the /dev page, so the real game never sees them).
import { useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Design, MissionState, RoleId, Slot } from "@/lib/protocol";
import { simulate, type Sim } from "@/lib/game/sim";
import type { ObjectiveId } from "@/lib/game/data/ember";

export const ROLE_COLOR: Record<RoleId, string> = {
  zenith: "#D55E00",
  forge: "#56B4E9",
  prism: "#CC79A7",
  vector: "#009E73",
};

/** Deterministic PRNG so scene layout is pure (same every render). */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scales its children in from zero when mounted. Key it by part id so a swap pops again. */
export function Pop({ children, speed = 7 }: { children: ReactNode; speed?: number }) {
  const ref = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g || t.current >= 1) return;
    t.current = Math.min(1, t.current + dt * (speed / 3));
    // ease out back: a small overshoot reads as "clicked into place"
    const x = t.current;
    const c = 1.70158;
    const s = 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
    g.scale.setScalar(Math.max(0.001, s));
  });
  return (
    <group ref={ref} scale={0.001}>
      {children}
    </group>
  );
}

const noSub = () => () => {};
function useSearch(): string | null {
  return useSyncExternalStore(
    noSub,
    () => (location.pathname.startsWith("/dev") ? location.search : ""),
    () => null,
  );
}

const DESIGN_KEYS: Record<string, Slot> = {
  bus: "bus",
  solar: "solar",
  battery: "battery",
  computer: "computer",
  heater: "heater",
  thruster: "thruster",
  pointing: "pointing",
  inst1: "instrument1",
  inst2: "instrument2",
  radio: "radio",
  ground: "ground",
  rocket: "rocket",
  orbit: "orbit",
};

export interface DevOverrides {
  state: MissionState;
  sim: Sim;
  activeRole: RoleId | null | undefined;
  /** /dev?cycle=1: scenes may cycle through sample designs. */
  cycle: boolean;
}

/**
 * On /dev only, lets the URL vary the fixture:
 *   bus=bus-6u solar=solar-wings inst1=inst-thermal inst2=inst-multi radio=radio-sband
 *   pointing=pointing-wheels thruster=thruster orbit=leo-400 rocket=dedicated (value "none" clears)
 *   step=7  lobby=1  claimed=zenith,prism  active=prism  cycle=1
 */
export function useDevOverrides(state: MissionState, sim: Sim, activeRole?: RoleId | null): DevOverrides {
  const search = useSearch();
  return useMemo(() => {
    if (!search) return { state, sim, activeRole, cycle: false };
    const p = new URLSearchParams(search);
    let s = state;
    let design: Design = state.design;
    let changed = false;
    for (const [k, slot] of Object.entries(DESIGN_KEYS)) {
      const v = p.get(k);
      if (v === null) continue;
      design = { ...design };
      if (v === "none") delete design[slot];
      else design[slot] = v;
      changed = true;
    }
    if (changed) s = { ...s, design };
    const step = p.get("step");
    if (step !== null) s = { ...s, stepIndex: Number(step) };
    if (p.get("lobby") === "1") s = { ...s, stepIndex: -1 };
    const claimed = p.get("claimed");
    if (claimed !== null) {
      const set = new Set(claimed.split(","));
      s = {
        ...s,
        roles: {
          zenith: set.has("zenith") ? "dev" : null,
          forge: set.has("forge") ? "dev" : null,
          prism: set.has("prism") ? "dev" : null,
          vector: set.has("vector") ? "dev" : null,
        },
      };
    }
    const a = p.get("active");
    const active = a === "none" ? null : a ? (a as RoleId) : activeRole;
    const newSim = changed ? simulate(design, s.objectiveId as ObjectiveId | null) : sim;
    return { state: s, sim: newSim, activeRole: active, cycle: p.get("cycle") === "1" };
  }, [search, state, sim, activeRole]);
}
