// The one place the game's physics and scoring live. Pure: design in, numbers and plain
// feedback out. Every screen (big screen, devices, mini games, report) calls this.
import type { Design, MinigameId, MinigameResult } from "../protocol";
import { EMBER, findPart, ORBITS, ROCKETS, type Bus, type ObjectiveId, type Orbit, type Part, type Rocket } from "./data/ember";

export type Status = "ok" | "warn" | "bad" | "empty";
export type ResourceKey = "mass" | "power" | "budget" | "data" | "comms" | "time";

export interface Bar {
  key: ResourceKey;
  label: string;
  value: string; // "1.1 of 4.0 kg"
  fill: number; // 0..1 of the limit used (data/comms: delivered share)
  status: Status;
}

export interface Check {
  id: string;
  status: Status;
  resource: ResourceKey;
  /** What happened, why, what to try (Words Bible section 8). */
  line: string;
}

export interface Sim {
  bus?: Bus;
  orbit?: Orbit;
  rocket?: Rocket;
  parts: Part[];
  instruments: Part[];
  massKg: number;
  maxMassKg: number;
  massMargin: number;
  volumeU: number;
  capacityU: number;
  genW: number;
  useW: number;
  eclipseWh: number;
  usableWh: number;
  costK: number;
  budgetK: number;
  dataGenMBday: number;
  dataSentMBday: number;
  delivered: number; // 0..1
  passesPerDay: number;
  perPassMB: number;
  months: number;
  lifeYears: number;
  bars: Bar[];
  checks: Check[];
  science: number; // 0..400
}

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("en-US");

export function simulate(design: Design, objectiveId: ObjectiveId | null, rescueUsed = false): Sim {
  const bus = findPart(design.bus) as Bus | undefined;
  const orbit = ORBITS.find((o) => o.id === design.orbit);
  const rocket = ROCKETS.find((r) => r.id === design.rocket);
  const slots = ["solar", "battery", "computer", "heater", "thruster", "pointing", "instrument1", "instrument2", "radio", "ground"] as const;
  const parts = slots.map((s) => findPart(design[s])).filter(Boolean) as Part[];
  const instruments = parts.filter((p) => p.slot === "instrument1");

  const massKg = (bus?.mass ?? 0) + parts.reduce((a, p) => a + p.mass, 0);
  const maxMassKg = bus?.maxMass ?? 4;
  const massMargin = 1 - massKg / maxMassKg;
  const volumeU = parts.reduce((a, p) => a + p.volume, 0);
  const capacityU = bus?.capacityU ?? 3;

  const genRaw = parts.reduce((a, p) => a + (p.gen ?? 0), 0);
  const genW = genRaw * (orbit?.dawnDusk ? 1.15 : 1); // dawn-dusk sees the Sun almost all orbit
  const useW = parts.reduce((a, p) => a + (p.power ?? 0), 0);
  const eclipseWh = (useW * (orbit?.eclipseMin ?? 35)) / 60;
  const usableWh = parts.reduce((a, p) => a + (p.batteryWh ?? 0), 0) * 0.3;

  const units = bus?.capacityU ?? 3;
  const rideK = rocket ? (rocket.flatCost ?? (rocket.costPerU ?? 0) * units) : 0;
  const costK = (bus?.cost ?? 0) + parts.reduce((a, p) => a + p.cost, 0) + rideK;
  const budgetK = EMBER.budgetK + (rescueUsed ? 150 : 0);

  const compress = parts.find((p) => p.compress)?.compress ?? 1;
  const dataGenMBday = instruments.reduce((a, p) => a + (p.dataMBday ?? 0), 0);
  const radio = parts.find((p) => p.slot === "radio");
  const ground = parts.find((p) => p.slot === "ground");
  const perPassMB = radio?.rateKbps ? (radio.rateKbps * 480) / 8 / 1000 : 0;
  const passesPerDay = ground?.passesPerDay ?? 0;
  const dataSentMBday = Math.min(dataGenMBday / compress, passesPerDay * perPassMB) * compress;
  const delivered = dataGenMBday > 0 ? Math.min(1, dataSentMBday / dataGenMBday) : 0;

  const advanced = [bus, ...parts].filter((p) => p?.tier === "advanced").length;
  const months = 9 + 2 * advanced;
  const hasThruster = !!design.thruster;
  const lifeYears = orbit ? (orbit.lifeYears[0] + orbit.lifeYears[1]) / 2 + (hasThruster && orbit.altitudeKm <= 400 ? 2 : 0) : 0;

  const checks: Check[] = [];
  const add = (id: string, status: Status, resource: ResourceKey, line: string) => checks.push({ id, status, resource, line });

  if (bus) {
    if (massKg > maxMassKg) add("mass", "bad", "mass", `Too heavy by ${fmt(massKg - maxMassKg)} kg. Every part adds up. Try a smaller battery, drop an instrument, or a bigger frame.`);
    else if (massMargin < 0.2) add("margin", "warn", "mass", `You fit, with only ${Math.round(massMargin * 100)}% to spare. Real parts come in heavier than planned. Engineers keep 20 to 30%.`);
    if (volumeU > capacityU) add("volume", "bad", "mass", `The parts take ${fmt(volumeU, 2)}U and the frame holds ${capacityU}U. Something bigger needs a bigger frame, or something has to go.`);
    for (const i of instruments) if (i.requires6U && capacityU < 6) add("radar6u", "bad", "mass", `The ${i.name} only fits a 6U frame.`);
  }
  if (genW > 0 || useW > 0) {
    if (genW < useW) add("power", "bad", "power", `Your parts need ${fmt(useW)} W and the panels make ${fmt(genW)} W. Add deployable wings, or switch something off.`);
    else if (genW < useW * 1.2) add("power-margin", "warn", "power", `Power is tight: ${fmt(useW)} W used of ${fmt(genW)} W. Keep about 20% spare for aging panels.`);
    if (usableWh > 0 && eclipseWh > usableWh) add("eclipse", "bad", "power", `The batteries run flat in the dark. Every ${fmt(orbit?.periodMin ?? 92, 0)} minutes the planet hides the Sun for ${orbit?.eclipseMin ?? 35}. Add battery, or use less power.`);
    if (usableWh === 0 && useW > 0) add("no-battery", "bad", "power", "No battery: everything switches off each time you pass into Earth's shadow.");
  }
  if (costK > budgetK) add("budget", "bad", "budget", `Over by $${fmt(costK - budgetK, 0)}k. Ask ZENITH for the budget rescue, or find cheaper parts.`);
  if (dataGenMBday > 0) {
    if (delivered < 0.5) add("data", delivered < 0.1 ? "bad" : "warn", "data", `You collect ${fmt(dataGenMBday, 0)} MB a day and send home ${fmt(dataSentMBday)}. The rest is lost. Add a ground station, a faster radio, or compress on board.`);
  }
  const pointing = parts.find((p) => p.pointing)?.pointing;
  for (const i of instruments) if (i.needsPointing === "fine" && pointing !== "fine") add(`point-${i.id}`, "warn", "data", `Your ${i.name} needs steady pointing. With magnetorquers its pictures blur, so it scores half.`);
  if (rocket && orbit && !rocket.orbits.includes(orbit.id)) add("ride", "bad", "time", `This rocket doesn't go to ${orbit.name}. Pick another ride or another orbit.`);
  if (rocket && massKg > rocket.maxMassKg) add("ride-mass", "bad", "mass", `Too heavy for the ${rocket.name}.`);
  if (orbit) {
    if (lifeYears < EMBER.requiredLifeYears) add("life", "bad", "time", `At ${orbit.altitudeKm} km the thin air drags you down in about ${fmt(lifeYears)} years. You need ${EMBER.requiredLifeYears}. Fly higher, or add a thruster.`);
    if (orbit.lifeYears[0] >= EMBER.debrisLimitYears && !hasThruster) add("debris", "bad", "time", `At ${orbit.altitudeKm} km your spacecraft stays up for 25+ years after it dies. Add a thruster to bring it down, or fly lower.`);
  }
  if (months > EMBER.deadlineMonths) add("schedule", "bad", "time", `Building this takes ${months} months and the ride leaves at ${EMBER.deadlineMonths}. Advanced parts take longer to get.`);

  // Science (0..400): Balance Sheet section 4.
  let science = 0;
  if (objectiveId) {
    const obj = EMBER.objectives.find((o) => o.id === objectiveId)!;
    let raw = 0;
    for (const i of instruments) {
      const v = i.science?.[objectiveId] ?? 0;
      const pf = i.needsPointing === "fine" && pointing !== "fine" ? 0.5 : 1;
      raw += v * pf;
    }
    const sharp = orbit ? orbit.sharpness * (orbit.dawnDusk ? 0.7 : 1) : 0.8;
    let fit = 1;
    if (obj.wants.sunSync && orbit && !orbit.sunSync) fit *= 0.6;
    if (obj.wants.seesHeat && !instruments.some((i) => i.id === "inst-thermal" || i.id === "inst-multi")) fit *= 0.5;
    if (obj.wants.seesThroughCloud && !instruments.some((i) => i.id === "inst-radar")) fit *= 0.5;
    const life = orbit ? Math.min(1, lifeYears / EMBER.requiredLifeYears) : 1;
    // 5 points from one perfect instrument, about 8 from a great pair: normalize to 400.
    science = Math.min(400, (raw / 8) * 400 * sharp * fit * delivered * life);
  }

  const sev = (k: ResourceKey): Status => {
    const cs = checks.filter((c) => c.resource === k);
    if (cs.some((c) => c.status === "bad")) return "bad";
    if (cs.some((c) => c.status === "warn")) return "warn";
    return "ok";
  };
  const bars: Bar[] = [
    { key: "mass", label: "Mass", value: `${fmt(massKg)} of ${fmt(maxMassKg)} kg`, fill: massKg / maxMassKg, status: bus ? sev("mass") : "empty" },
    { key: "power", label: "Power", value: `${fmt(useW)} of ${fmt(genW)} W`, fill: genW ? useW / genW : 0, status: genW || useW ? sev("power") : "empty" },
    { key: "budget", label: "Budget", value: `$${fmt(costK, 0)}k of $${fmt(budgetK, 0)}k`, fill: costK / budgetK, status: sev("budget") },
    { key: "data", label: "Data", value: `${fmt(dataSentMBday)} of ${fmt(dataGenMBday, 0)} MB a day`, fill: delivered, status: dataGenMBday ? sev("data") : "empty" },
    { key: "comms", label: "Comms", value: passesPerDay ? `${passesPerDay} passes, ${fmt(perPassMB)} MB each` : "No link yet", fill: Math.min(1, (passesPerDay * perPassMB) / Math.max(1, dataGenMBday)), status: passesPerDay && perPassMB ? (delivered < 0.5 ? "warn" : "ok") : "empty" },
    { key: "time", label: "Time", value: orbit ? `${months} of ${EMBER.deadlineMonths} months · ${fmt(lifeYears)} yr life` : `${months} of ${EMBER.deadlineMonths} months`, fill: months / EMBER.deadlineMonths, status: sev("time") },
  ];

  return { bus, orbit, rocket, parts, instruments, massKg, maxMassKg, massMargin, volumeU, capacityU, genW, useW, eclipseWh, usableWh, costK, budgetK, dataGenMBday, dataSentMBday, delivered, passesPerDay, perPassMB, months, lifeYears, bars, checks, science };
}

export interface Score {
  total: number;
  science: number;
  efficiency: number;
  decisions: number;
  collaboration: number;
  skill: number;
  go: boolean;
  cml: string;
  meaning: string;
}

/** Balance Sheet section 4. */
export function score(sim: Sim, results: Partial<Record<MinigameId, MinigameResult>>, objectiveId: ObjectiveId | null): Score {
  const bad = sim.checks.filter((c) => c.status === "bad");
  const obj = EMBER.objectives.find((o) => o.id === objectiveId);
  const go = bad.length === 0 && sim.delivered >= (obj?.wants.minDelivered ?? 0.5) && sim.lifeYears >= EMBER.requiredLifeYears;
  const left = Math.max(0, 1 - sim.costK / sim.budgetK);
  const healthy = (m: number) => (m >= 0.2 && m <= 0.45 ? 1 : m > 0 ? 0.5 : 0);
  const powerMargin = sim.genW ? 1 - sim.useW / sim.genW : 0;
  const efficiency = Math.round(250 * (0.4 * Math.min(1, left * 2) + 0.3 * healthy(sim.massMargin) + 0.3 * healthy(powerMargin)));
  const decisions = Math.round(150 * Math.max(0, 1 - bad.length * 0.25 - sim.checks.filter((c) => c.status === "warn").length * 0.08));
  const trade = results["trade-study"]?.score ?? 0.5;
  const collaboration = Math.round(100 * trade);
  const rs = Object.values(results).filter(Boolean) as MinigameResult[];
  const skill = Math.round(100 * (rs.length ? rs.reduce((a, r) => a + r.score, 0) / rs.length : 0.5));
  const science = Math.round(sim.science);
  const total = science + efficiency + decisions + collaboration + skill;
  const [cml, meaning] =
    total >= 800 ? ["CML 5: Concept Baseline", "Ready to propose"] : total >= 600 ? ["CML 4: Point Design", "A real design that closes"] : total >= 400 ? ["CML 3: Trade Space", "You explored the options"] : ["CML 2: Initial Feasibility", "It could work, but not like this"];
  return { total, science, efficiency, decisions, collaboration, skill, go, cml, meaning };
}
