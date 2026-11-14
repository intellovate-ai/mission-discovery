"use client";
// STUB: replaced by the mini game session that owns this file.
import type { MinigameDef } from "@/lib/minigames/types";
import { makeStub } from "./Stub";

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, set: { orbit: 'sso-550' }, note: '550 km sun-synchronous: same time of day, every day.' });

const def: MinigameDef = {
  id: "ground-track",
  title: "GROUND TRACK",
  subtitle: "Choose the path you trace over the world",
  howTo: "Slide altitude and tilt; watch a week of passes paint the map.",
  owner: "prism",
  wipe: "#EFE4C8",
  Component: makeStub("GROUND TRACK", autoResolve),
  autoResolve,
};
export default def;
