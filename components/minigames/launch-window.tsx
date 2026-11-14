"use client";
// STUB: replaced by the mini game session that owns this file.
import type { MinigameDef } from "@/lib/minigames/types";
import { makeStub } from "./Stub";

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, note: 'A clean enough launch.' });

const def: MinigameDef = {
  id: "launch-window",
  title: "LAUNCH WINDOW",
  subtitle: "Go at exactly the right moment",
  howTo: "Tap when the needle is in the green.",
  owner: "vector",
  wipe: "#0F0F1B",
  Component: makeStub("LAUNCH WINDOW", autoResolve),
  autoResolve,
};
export default def;
