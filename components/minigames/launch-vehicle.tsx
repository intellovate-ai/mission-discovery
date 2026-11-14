"use client";
// STUB: replaced by the mini game session that owns this file.
import type { MinigameDef } from "@/lib/minigames/types";
import { makeStub } from "./Stub";

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, set: { rocket: 'rideshare' }, note: 'Booked a rideshare seat.' });

const def: MinigameDef = {
  id: "launch-vehicle",
  title: "LAUNCH VEHICLE",
  subtitle: "Buy a ride that can carry you",
  howTo: "Pick a rocket before the seats sell out.",
  owner: "zenith",
  wipe: "#111111",
  Component: makeStub("LAUNCH VEHICLE", autoResolve),
  autoResolve,
};
export default def;
