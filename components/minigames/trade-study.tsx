"use client";
// STUB: replaced by the mini game session that owns this file.
import type { MinigameDef } from "@/lib/minigames/types";
import { makeStub } from "./Stub";

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, note: 'The team met in the middle.' });

const def: MinigameDef = {
  id: "trade-study",
  title: "TRADE STUDY",
  subtitle: "Give something to get something",
  howTo: "Everyone offers something from their own resources. Close the gap before the timer.",
  owner: "team",
  wipe: "#0F5132",
  Component: makeStub("TRADE STUDY", autoResolve),
  autoResolve,
};
export default def;
