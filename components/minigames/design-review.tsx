"use client";
// STUB: replaced by the mini game session that owns this file.
import type { MinigameDef } from "@/lib/minigames/types";
import { makeStub } from "./Stub";

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, note: 'The Board heard your case.' });

const def: MinigameDef = {
  id: "design-review",
  title: "DESIGN REVIEW",
  subtitle: "Prove it's ready to fly",
  howTo: "Each turn, pick your role's best evidence against the Board's questions.",
  owner: "team",
  wipe: "#2A1E5C",
  Component: makeStub("DESIGN REVIEW", autoResolve),
  autoResolve,
};
export default def;
