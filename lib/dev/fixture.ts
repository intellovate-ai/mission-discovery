// Sample room state for /dev harness pages: the Balance Sheet's worked example.
import { emptyState, type MissionState } from "../protocol";

export function devState(): MissionState {
  const s = emptyState("DEV1");
  s.crew = "Dev Crew";
  s.players = [{ id: "dev", name: "Dev", connected: true }];
  s.roles = { zenith: "dev", forge: "dev", prism: "dev", vector: "dev" };
  s.stepIndex = 2;
  s.objectiveId = "wildfires";
  s.hostConnected = true;
  s.design = {
    bus: "bus-3u",
    solar: "solar-body",
    battery: "battery-20",
    computer: "computer-basic",
    pointing: "pointing-mtq",
    instrument1: "inst-color",
    radio: "radio-uhf",
    ground: "ground-1",
    rocket: "rideshare",
    orbit: "sso-550",
  };
  return s;
}
