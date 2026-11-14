// TRADE STUDY rules: find the biggest gap, list each role's real part swaps, preview with simulate().
import { simulate, type Check, type Sim } from "@/lib/game/sim";
import { findPart, ORBITS, partsForSlot, type ObjectiveId } from "@/lib/game/data/ember";
import type { Design, MissionState, RoleId, Slot } from "@/lib/protocol";

export const ROLE_INFO: Record<RoleId, { title: string; call: string; color: string; bars: string[] }> = {
  zenith: { title: "Mission Director", call: "ZENITH", color: "#D55E00", bars: ["budget", "time"] },
  forge: { title: "Spacecraft Engineer", call: "FORGE", color: "#56B4E9", bars: ["mass", "power"] },
  prism: { title: "Science Lead", call: "PRISM", color: "#CC79A7", bars: ["data"] },
  vector: { title: "Flight Controller", call: "VECTOR", color: "#009E73", bars: ["comms", "time"] },
};
export const ROLE_ORDER: RoleId[] = ["zenith", "forge", "prism", "vector"];

/** A real part swap. In `set`, an empty string means the slot is dropped. */
export interface Offer {
  id: string;
  role: RoleId;
  label: string;
  set: Design;
  rescue?: boolean;
}
export const HOLD = "hold";

export function applySet(design: Design, set: Design): Design {
  const d: Design = { ...design };
  for (const [k, v] of Object.entries(set) as [Slot, string][]) {
    if (v) d[k] = v;
    else delete d[k];
  }
  return d;
}

/** First bad check, or else the first warn. */
export function findGap(sim: Sim): Check | null {
  return sim.checks.find((c) => c.status === "bad") ?? sim.checks.find((c) => c.status === "warn") ?? null;
}

/** How big a check's shortfall is, in its own units (0 = gone). */
export function gapSize(sim: Sim, id: string): number {
  if (!sim.checks.some((c) => c.id === id)) return 0;
  const m = (() => {
    switch (id) {
      case "mass":
        return sim.massKg - sim.maxMassKg;
      case "margin":
        return 0.2 - sim.massMargin;
      case "volume":
        return sim.volumeU - sim.capacityU;
      case "power":
        return sim.useW - sim.genW;
      case "power-margin":
        return sim.useW * 1.2 - sim.genW;
      case "eclipse":
        return sim.eclipseWh - sim.usableWh;
      case "budget":
        return sim.costK - sim.budgetK;
      case "data":
        return 0.5 - sim.delivered;
      case "ride-mass":
        return sim.massKg - (sim.rocket?.maxMassKg ?? sim.massKg);
      case "life":
        return 2 - sim.lifeYears;
      case "schedule":
        return sim.months - 18;
      default:
        return 1;
    }
  })();
  return Math.max(1e-6, m);
}

export function closure(base: Sim, after: Sim, gap: Check | null): number {
  if (!gap) return 1;
  const b = gapSize(base, gap.id);
  if (b <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - gapSize(after, gap.id) / b));
}

export function newBad(base: Sim, after: Sim): Check[] {
  return after.checks.filter((c) => c.status === "bad" && !base.checks.some((b) => b.id === c.id));
}

const nameOf = (id: string | undefined) => findPart(id)?.name ?? ORBITS.find((o) => o.id === id)?.name ?? id ?? "";

function swaps(role: RoleId, design: Design, slots: Slot[], optional: Slot[]): Offer[] {
  const out: Offer[] = [];
  for (const slot of slots) {
    const cur = design[slot];
    const opts = slot === "orbit" ? ORBITS.map((o) => o.id) : partsForSlot(slot).map((p) => p.id);
    for (const id of opts) {
      if (id === cur) continue;
      out.push({ id: `${role}:${slot}=${id}`, role, label: cur ? `Swap ${nameOf(cur)} for ${nameOf(id)}` : `Add ${nameOf(id)}`, set: { [slot]: id } });
    }
    if (cur && optional.includes(slot)) out.push({ id: `${role}:${slot}=`, role, label: `Drop ${nameOf(cur)}`, set: { [slot]: "" } });
  }
  return out;
}

export function candidates(role: RoleId, state: MissionState, gap: Check | null, rescueOpen: boolean): Offer[] {
  const d = state.design;
  switch (role) {
    case "forge":
      return swaps(role, d, ["solar", "battery", "computer", "heater", "thruster"], ["heater", "thruster"]);
    case "prism": {
      const out: Offer[] = [];
      const i1 = findPart(d.instrument1);
      const i2 = findPart(d.instrument2);
      if (i1 && i2) {
        out.push({ id: "prism:drop2", role, label: `Drop ${i2.name}`, set: { instrument2: "" } });
        if (i1.cost > i2.cost) out.push({ id: "prism:drop1", role, label: `Drop ${i1.name}`, set: { instrument1: i2.id, instrument2: "" } });
      } else if (i1) {
        // One instrument: it can't go, but it can trade for a cheaper or lighter one.
        for (const p of partsForSlot("instrument1")) {
          if (p.id !== i1.id && (p.cost < i1.cost || p.mass < i1.mass || (p.power ?? 0) < (i1.power ?? 0)))
            out.push({ id: `prism:instrument1=${p.id}`, role, label: `Swap ${i1.name} for ${p.name}`, set: { instrument1: p.id } });
        }
      }
      return [...out, ...swaps(role, d, ["pointing"], [])];
    }
    case "vector":
      // Radio and ground segment; the orbit too when the gap is about the ride or lifetime.
      return swaps(role, d, gap?.resource === "time" ? ["radio", "ground", "orbit"] : ["radio", "ground"], []);
    case "zenith":
      return rescueOpen ? [{ id: "zenith:rescue", role, label: "Use the Budget Rescue: $150k More", set: {}, rescue: true }] : [];
  }
}

export interface Ranked extends Offer {
  closure: number;
  after: Sim;
  problems: Check[];
}

/** Up to three offers per role that close the gap, safest first. */
export function offersFor(role: RoleId, state: MissionState, base: Sim, gap: Check | null, rescueOpen: boolean): Ranked[] {
  const obj = state.objectiveId as ObjectiveId | null;
  const ranked = candidates(role, state, gap, rescueOpen).map((o) => {
    const after = simulate(applySet(state.design, o.set), obj, state.rescueUsed || !!o.rescue);
    return { ...o, after, closure: closure(base, after, gap), problems: newBad(base, after) };
  });
  // ZENITH's rescue stays on the table even when money is not the gap: it pays for other swaps.
  const useful = ranked.filter((o) => o.closure > 0.001 || o.rescue);
  useful.sort((a, b) => a.problems.length - b.problems.length || b.closure - a.closure || a.after.costK - b.after.costK);
  return useful.slice(0, 3);
}

/** Every chosen offer applied together. */
export function merged(state: MissionState, chosen: Offer[]) {
  let set: Design = {};
  for (const o of chosen) set = { ...set, ...o.set };
  const rescue = chosen.some((o) => o.rescue);
  const design = applySet(state.design, set);
  const sim = simulate(design, state.objectiveId as ObjectiveId | null, state.rescueUsed || rescue);
  return { set, rescue, sim };
}

export function tradeScore(close: number, contributors: number, roles: number, problems: number, hasGap: boolean): number {
  if (!hasGap) return Math.min(1, 0.8 + 0.2 * (contributors / Math.max(1, roles)));
  return Math.max(0, Math.min(1, 0.7 * close + 0.3 * (contributors / Math.max(1, roles)) - 0.15 * problems));
}

export const fmtK = (n: number) => `${n < 0 ? "−" : "+"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}k`;
export const fmtKg = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(Math.round(n * 100) / 100)} kg`;
