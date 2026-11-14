"use client";
// STUB: replaced by the mini game session that owns this file.
import type { MinigameDef } from "@/lib/minigames/types";
import { makeStub } from "./Stub";

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, note: 'Some of the data made it home.' });

const def: MinigameDef = {
  id: "downlink",
  title: "DOWNLINK",
  subtitle: "Get the data home",
  howTo: "Tap to the beat while the station is overhead.",
  owner: "vector",
  wipe: "#031208",
  Component: makeStub("DOWNLINK", autoResolve),
  autoResolve,
};
export default def;
