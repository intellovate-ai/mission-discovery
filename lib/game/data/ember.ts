// EMBER (Earth) catalog. Every number is from the Balance Sheet; the `src` tag says where it
// comes from: C101 = NASA CubeSat 101, DDSM = NASA "Design and Develop Science Missions",
// Phys = standard physics, Typ = typical small-satellite value (approximate), Game = tuned for play.
import type { RoleId, Slot } from "../../protocol";

export type Src = "C101" | "DDSM" | "Phys" | "Typ" | "Game";
export type Pointing = "coarse" | "fine";
export type ObjectiveId = "wildfires" | "crops" | "floods";

export interface Part {
  id: string;
  slot: Slot;
  name: string;
  tier: "simple" | "advanced";
  mass: number; // kg
  volume: number; // U
  cost: number; // $k
  power?: number; // W average draw
  gen?: number; // W orbit-average generation
  batteryWh?: number;
  storageGB?: number;
  compress?: number; // onboard compression factor
  pointing?: Pointing; // what a pointing part provides
  needsPointing?: Pointing; // what an instrument needs
  dataMBday?: number;
  science?: Record<ObjectiveId, number>;
  rateKbps?: number;
  passesPerDay?: number;
  requires6U?: boolean;
  src: Src;
  blurb: string;
}

export interface Bus extends Part {
  maxMass: number;
  capacityU: number;
}

export const BUSES: Bus[] = [
  { id: "bus-1u", slot: "bus", name: "1U Frame", tier: "simple", mass: 0.1, volume: 0, cost: 20, maxMass: 1.33, capacityU: 1, src: "C101", blurb: "One 10 cm cube. Barely fits one instrument." },
  { id: "bus-3u", slot: "bus", name: "3U Frame", tier: "simple", mass: 0.3, volume: 0, cost: 40, maxMass: 4.0, capacityU: 3, src: "C101", blurb: "The classic student CubeSat: three cubes long." },
  { id: "bus-6u", slot: "bus", name: "6U Frame", tier: "advanced", mass: 0.6, volume: 0, cost: 70, maxMass: 8.0, capacityU: 6, src: "C101", blurb: "Room for radar or two instruments." },
];

export const PARTS: Part[] = [
  // Power (FORGE)
  { id: "solar-body", slot: "solar", name: "Body-Mounted Solar Cells", tier: "simple", mass: 0.15, volume: 0, cost: 15, gen: 7, src: "Typ", blurb: "Cells on the outside. About 7 W on average." },
  { id: "solar-wings", slot: "solar", name: "Deployable Solar Wings", tier: "advanced", mass: 0.55, volume: 0.25, cost: 60, gen: 14, src: "C101", blurb: "Unfold after launch. Nearly double the power." },
  { id: "battery-20", slot: "battery", name: "Battery 20 Wh", tier: "simple", mass: 0.15, volume: 0.25, cost: 8, batteryWh: 20, src: "Typ", blurb: "Use 30% per eclipse: 6 Wh." },
  { id: "battery-40", slot: "battery", name: "Battery 40 Wh", tier: "simple", mass: 0.3, volume: 0.5, cost: 15, batteryWh: 40, src: "Typ", blurb: "Use 30% per eclipse: 12 Wh." },
  { id: "computer-basic", slot: "computer", name: "Basic Flight Computer", tier: "simple", mass: 0.1, volume: 0.25, cost: 10, power: 0.5, storageGB: 2, compress: 1, src: "Typ", blurb: "Runs the spacecraft. Stores 2 GB." },
  { id: "computer-smart", slot: "computer", name: "Smart Computer", tier: "advanced", mass: 0.2, volume: 0.25, cost: 35, power: 2, storageGB: 32, compress: 4, src: "Typ", blurb: "Shrinks data 4 times before sending it home." },
  { id: "heater", slot: "heater", name: "Battery Heater", tier: "simple", mass: 0.05, volume: 0, cost: 3, power: 1, src: "Typ", blurb: "Keeps the battery warm in the dark." },
  { id: "thruster", slot: "thruster", name: "Small Thruster", tier: "advanced", mass: 0.5, volume: 0.5, cost: 50, src: "Typ", blurb: "Raise your orbit, or bring the spacecraft down at the end." },
  // Pointing and instruments (PRISM)
  { id: "pointing-mtq", slot: "pointing", name: "Magnetorquers", tier: "simple", mass: 0.1, volume: 0.25, cost: 15, power: 0.5, pointing: "coarse", src: "Typ", blurb: "Push against Earth's magnetic field. Pointing within about 10 degrees." },
  { id: "pointing-wheels", slot: "pointing", name: "Reaction Wheels + Star Tracker", tier: "advanced", mass: 0.4, volume: 0.5, cost: 60, power: 2, pointing: "fine", src: "Typ", blurb: "Spinning wheels and a star camera. Pointing within 0.1 degrees." },
  { id: "inst-color", slot: "instrument1", name: "Color Camera", tier: "simple", mass: 0.2, volume: 0.5, cost: 20, power: 2, dataMBday: 200, needsPointing: "coarse", science: { wildfires: 2, crops: 3, floods: 3 }, src: "Typ", blurb: "Pictures like your eyes see." },
  { id: "inst-multi", slot: "instrument1", name: "Multispectral Imager", tier: "advanced", mass: 0.5, volume: 1, cost: 80, power: 5, dataMBday: 600, needsPointing: "fine", science: { wildfires: 3, crops: 5, floods: 4 }, src: "Typ", blurb: "Sees colors beyond human eyes. Great for plant health." },
  { id: "inst-thermal", slot: "instrument1", name: "Thermal Infrared Camera", tier: "advanced", mass: 0.6, volume: 1, cost: 120, power: 6, dataMBday: 300, needsPointing: "fine", science: { wildfires: 5, crops: 3, floods: 2 }, src: "Typ", blurb: "Sees heat. Spots fires before the smoke spreads." },
  { id: "inst-radar", slot: "instrument1", name: "Mini Radar", tier: "advanced", mass: 2, volume: 2, cost: 250, power: 5, dataMBday: 1000, needsPointing: "coarse", requires6U: true, science: { wildfires: 2, crops: 3, floods: 5 }, src: "Typ", blurb: "Sees through clouds. 6U only." },
  // Comms and ground (VECTOR)
  { id: "radio-uhf", slot: "radio", name: "UHF Radio", tier: "simple", mass: 0.1, volume: 0.25, cost: 10, power: 0.5, rateKbps: 9.6, src: "Typ", blurb: "9.6 kbps. About 0.6 MB per pass." },
  { id: "radio-sband", slot: "radio", name: "S-Band Radio", tier: "advanced", mass: 0.2, volume: 0.25, cost: 40, power: 1, rateKbps: 1000, src: "Typ", blurb: "1 Mbps. About 60 MB per pass." },
  { id: "ground-1", slot: "ground", name: "One University Station", tier: "simple", mass: 0, volume: 0, cost: 20, passesPerDay: 4, src: "Typ", blurb: "4 passes a day, up to about 8 minutes each." },
  { id: "ground-2", slot: "ground", name: "Two Stations", tier: "simple", mass: 0, volume: 0, cost: 45, passesPerDay: 8, src: "Typ", blurb: "Add one near the equator. 8 passes a day." },
  { id: "ground-net", slot: "ground", name: "Commercial Network", tier: "advanced", mass: 0, volume: 0, cost: 120, passesPerDay: 20, src: "Typ", blurb: "Antennas around the world. 20 passes a day." },
];

/** instrument2 uses the same instrument catalog. */
export function partsForSlot(slot: Slot): Part[] {
  if (slot === "bus") return BUSES;
  const s = slot === "instrument2" ? "instrument1" : slot;
  return PARTS.filter((p) => p.slot === s);
}

export function findPart(id: string | undefined): Part | Bus | undefined {
  if (!id) return undefined;
  return BUSES.find((b) => b.id === id) ?? PARTS.find((p) => p.id === id);
}

export interface Rocket {
  id: string;
  name: string;
  costPerU?: number; // $k
  flatCost?: number; // $k
  orbits: string[];
  maxMassKg: number;
  src: Src;
  blurb: string;
}

export const ROCKETS: Rocket[] = [
  { id: "rideshare", name: "Rideshare Seat", costPerU: 100, orbits: ["leo-400", "sso-550"], maxMassKg: 12, src: "C101", blurb: "Share a rocket. About $300k for a 3U. Fixed launch date." },
  { id: "dedicated", name: "Dedicated Small Launcher", flatCost: 7500, orbits: ["leo-400", "sso-550", "sso-700", "sso-dd-550"], maxMassKg: 200, src: "Typ", blurb: "Your own rocket, any orbit, when you're ready. $7.5 million." },
];

export interface Orbit {
  id: string;
  name: string;
  altitudeKm: number;
  periodMin: number;
  sharpness: number;
  lifeYears: [number, number];
  eclipseMin: number;
  sunSync: boolean;
  dawnDusk?: boolean;
  coverage: string;
  src: Src;
}

export const ORBITS: Orbit[] = [
  { id: "leo-400", name: "400 km, 51.6° tilt", altitudeKm: 400, periodMin: 92.6, sharpness: 1, lifeYears: [1, 2], eclipseMin: 35, sunSync: false, coverage: "Misses the far north and south. Covers all of Africa.", src: "Phys" },
  { id: "sso-550", name: "550 km sun-synchronous", altitudeKm: 550, periodMin: 95.6, sharpness: 0.73, lifeYears: [5, 10], eclipseMin: 35, sunSync: true, coverage: "Whole Earth, same local time every day.", src: "Phys" },
  { id: "sso-700", name: "700 km sun-synchronous", altitudeKm: 700, periodMin: 98.8, sharpness: 0.57, lifeYears: [25, 40], eclipseMin: 35, sunSync: true, coverage: "Whole Earth. Stays up 25+ years.", src: "Phys" },
  { id: "sso-dd-550", name: "550 km dawn-dusk", altitudeKm: 550, periodMin: 95.6, sharpness: 0.73, lifeYears: [5, 10], eclipseMin: 2, sunSync: true, dawnDusk: true, coverage: "Almost never in shadow, but the low Sun dims pictures.", src: "Phys" },
];

export interface Objective {
  id: ObjectiveId;
  title: string;
  signature?: boolean;
  must: string[];
  nice: string;
  wants: { sunSync?: boolean; minDelivered: number; seesHeat?: boolean; seesThroughCloud?: boolean };
}

export const EMBER = {
  id: "ember" as const,
  codename: "EMBER",
  level: "Level 1: Earth",
  budgetK: 1000,
  deadlineMonths: 18,
  requiredLifeYears: 2,
  debrisLimitYears: 25,
  briefing:
    "Fires are spreading faster every year. Spot them early from orbit, before they grow. You have $1 million, 18 months to the launch date, and a crew of four.",
  objectives: [
    { id: "wildfires", title: "Spot Wildfires Early", signature: true, must: ["See heat from fires", "Check Africa every day", "Get at least half the data home", "Last 2 years"], nice: "Sharp enough to see a single field", wants: { minDelivered: 0.5, seesHeat: true } },
    { id: "crops", title: "Watch Crops and Drought", must: ["See plant health", "Same time of day every pass", "Get at least half the data home", "Last 2 years"], nice: "Cover several countries", wants: { minDelivered: 0.5, sunSync: true } },
    { id: "floods", title: "Track Floods", must: ["See through clouds", "Revisit within 2 days", "Get at least half the data home", "Last 2 years"], nice: "Map flooded roads", wants: { minDelivered: 0.5, seesThroughCloud: true } },
  ] satisfies Objective[],
};

/** Which role owns each build slot (who picks it on their device). */
export const SLOT_OWNER: Record<Slot, RoleId> = {
  bus: "forge",
  solar: "forge",
  battery: "forge",
  computer: "forge",
  heater: "forge",
  thruster: "forge",
  pointing: "prism",
  instrument1: "prism",
  instrument2: "prism",
  radio: "vector",
  ground: "vector",
  orbit: "vector",
  rocket: "zenith",
};

/** Slots picked in the Clean Room. Rocket and orbit are chosen in their mini games. */
export const CLEANROOM_SLOTS: Slot[] = ["bus", "solar", "battery", "computer", "heater", "thruster", "pointing", "instrument1", "instrument2", "radio", "ground"];
export const OPTIONAL_SLOTS: Slot[] = ["heater", "thruster", "instrument2"];
