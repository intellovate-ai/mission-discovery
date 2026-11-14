"use client";
// STUB: replaced by the mini game session that owns this file.
import type { MinigameDef } from "@/lib/minigames/types";
import { makeStub } from "./Stub";

const autoResolve: MinigameDef["autoResolve"] = () => ({ score: 0.5, note: 'Packed, with a little room to spare.' });

const def: MinigameDef = {
  id: "fairing",
  title: "FAIRING",
  subtitle: "Fit it inside the rocket",
  howTo: "Rotate and drop each part into the frame.",
  owner: "forge",
  wipe: "#123A63",
  Component: makeStub("FAIRING", autoResolve),
  autoResolve,
};
export default def;
