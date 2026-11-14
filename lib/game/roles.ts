// Character copy and colors (Words Bible section 3, Art Bible section 1). Used by both shells.
import type { MinigameId, RoleId } from "../protocol";
import type { ResourceKey } from "./sim";

export interface RoleInfo {
  name: string;
  title: string;
  color: string;
  line: string;
  strength: string;
  resources: ResourceKey[];
  voice: { pick: string; start: string; worried: string };
}

export const ROLE_INFO: Record<RoleId, RoleInfo> = {
  zenith: {
    name: "ZENITH",
    title: "Mission Director",
    color: "#D55E00",
    line: "Sees the whole mission. Guards the money and the clock.",
    strength: "One budget rescue per mission",
    resources: ["budget", "time"],
    voice: { pick: "Let's make this mission count.", start: "Can we afford that?", worried: "We're running out of runway." },
  },
  forge: {
    name: "FORGE",
    title: "Spacecraft Engineer",
    color: "#56B4E9",
    line: "Builds the spacecraft. Guards mass and power.",
    strength: "Sees exact margins; can swap a part for a lighter one",
    resources: ["mass", "power"],
    voice: { pick: "If it fits, it flies.", start: "That adds weight.", worried: "We're too heavy for this rocket." },
  },
  prism: {
    name: "PRISM",
    title: "Science Lead",
    color: "#CC79A7",
    line: "Decides what the mission learns. Guards the data.",
    strength: "Instruments matched to the objective score extra",
    resources: ["data"],
    voice: { pick: "What question are we answering?", start: "This instrument is perfect.", worried: "We're losing our pictures." },
  },
  vector: {
    name: "VECTOR",
    title: "Flight Controller",
    color: "#009E73",
    line: "Flies the mission. Guards the link home.",
    strength: "Sees ground passes and launch windows early",
    resources: ["comms", "time"],
    voice: { pick: "Ready when you are.", start: "Pass in five minutes.", worried: "We can't get it all home." },
  },
};

/** "Watching: {role} is {action}." (Words Bible section 3) */
export const MG_ACTION: Record<MinigameId, string> = {
  fairing: "packing the fairing",
  "launch-vehicle": "booking the rocket",
  "launch-window": "timing the launch",
  "ground-track": "choosing the orbit",
  downlink: "sending the data home",
  "trade-study": "making a trade",
  "design-review": "facing the Review Board",
};

export const RESOURCE_TIP: Record<ResourceKey, string> = {
  mass: "How heavy the spacecraft is. Heavier needs a bigger, pricier rocket.",
  power: "Electricity from the solar panels. Every part uses some, and the batteries must last through the dark.",
  budget: "The money to build, launch and run the mission.",
  data: "What the instruments collect. Data that never reaches the ground is worth nothing.",
  comms: "How much data you can send home each day.",
  time: "Months to build before the launch date, and years the mission must last.",
};

export const STATUS_COLOR = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", empty: "var(--track)" } as const;
