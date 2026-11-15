// Hints: "what do I do next?" for every step of the mission, plus a short "why this matters"
// tied to the real numbers in the game. Pure: the shells pass in where the player is (step,
// room state, the sim, and the mini game's live frame) and get back escalating help.
//
// Each hint has:
//   goal  one line: what this screen is for (always shown first)
//   steps escalating help, from a nudge to a direct instruction ("Tap X, then Y")
//   why   the real-world reason, from NASA CubeSat 101, Design and Develop Science Missions,
//         and JPL Concept Maturity Levels (the sources the game's numbers come from)
//
// Mini games are read through their live frames (play mode streams one to the room about ten
// times a second) and team games through shared team state, so hints follow each game's phase
// without any change inside the mini game files.
import type { MinigameId, MissionState, RoleId, Slot, Step } from "../protocol";
import { CLEANROOM_SLOTS, EMBER, findPart, OPTIONAL_SLOTS, ROCKETS, SLOT_OWNER, type ObjectiveId } from "./data/ember";
import type { ResourceKey, Sim } from "./sim";
import { ROLE_INFO } from "./roles";
import { findGap, offersFor } from "@/components/minigames/trade-study-logic";
import { battleOf, movesFor, questionsFor } from "@/components/minigames/design-review-logic";

export interface Hint {
  goal: string;
  steps: string[];
  why?: string;
}

export interface HintInput {
  /** solo: one screen, all roles. host: the big screen. phone: a crew device. */
  where: "solo" | "host" | "phone";
  step: Step | undefined;
  state: MissionState | null;
  sim: Sim | null;
  myRoles: RoleId[];
  /** The current mini game's last live frame (null before the owner taps Start). */
  live?: unknown;
  /** Phone only: not yet in a room. */
  joining?: boolean;
}

export const SLOT_LABEL: Record<Slot, string> = {
  bus: "Frame",
  solar: "Solar Power",
  battery: "Battery",
  computer: "Flight Computer",
  heater: "Battery Heater",
  thruster: "Thruster",
  pointing: "Pointing",
  instrument1: "Instrument",
  instrument2: "Second Instrument",
  radio: "Radio",
  ground: "Ground Stations",
  rocket: "Rocket",
  orbit: "Orbit",
};

/** Why each Clean Room choice matters. Shown under each slot and used by the hints. */
export const SLOT_WHY: Partial<Record<Slot, string>> = {
  bus: "CubeSats are built from 10 cm cubes called units (U). A bigger frame carries more, but a rideshare launch is priced per U.",
  solar: "Sunlight is the only power in orbit. The panels must cover every part you switch on, with about 20% to spare.",
  battery: "About a third of every orbit is in Earth's shadow. The battery keeps everything running through the dark.",
  computer: "The flight computer runs the spacecraft and stores data until the next ground station pass.",
  heater: "Shadow is cold. A battery that freezes can lose power or fail.",
  thruster: "A thruster can keep a low orbit up longer, or bring the spacecraft down at the end so it does not become space junk.",
  pointing: "Instruments must point steadily. Sharp instruments need fine pointing or their pictures blur.",
  instrument1: "The instrument answers your science question. Match it to the objective: heat for fires, plant health for crops, radar for clouds.",
  instrument2: "A second instrument adds science, but also mass, power, cost and data to send home.",
  radio: "Data only counts once it reaches the ground. A faster radio sends more each pass.",
  ground: "A ground station sees your spacecraft for only a few minutes per pass. More stations mean more passes a day.",
};

/** What each objective needs, and how hard it is (checked against lib/game/sim). */
export const OBJECTIVE_TIP: Record<ObjectiveId, { needs: string; level: string }> = {
  wildfires: { needs: "Needs a camera that sees heat. The Thermal Infrared Camera is best.", level: "Good First Mission" },
  crops: { needs: "Needs to see plant health (Multispectral Imager) and a sun-synchronous orbit.", level: "Medium" },
  floods: { needs: "Needs radar to see through clouds. Radar only fits a 6U frame, and no flood design fits $1 million without the budget rescue.", level: "Hard" },
};

/** A design that closes for each objective, verified with simulate() and score(). The direct hints steer toward it. */
const STARTER: Record<ObjectiveId, Partial<Record<Slot, string>>> = {
  wildfires: { bus: "bus-3u", solar: "solar-wings", battery: "battery-40", computer: "computer-basic", pointing: "pointing-wheels", instrument1: "inst-thermal", radio: "radio-sband", ground: "ground-1" },
  crops: { bus: "bus-3u", solar: "solar-wings", battery: "battery-40", computer: "computer-basic", pointing: "pointing-wheels", instrument1: "inst-multi", radio: "radio-sband", ground: "ground-2" },
  floods: { bus: "bus-6u", solar: "solar-body", battery: "battery-20", computer: "computer-basic", pointing: "pointing-mtq", instrument1: "inst-radar", radio: "radio-sband", ground: "ground-net" },
};

/** Slots most likely to fix a problem with each resource, first choice first. */
const FIX_SLOTS: Record<ResourceKey, Slot[]> = {
  mass: ["instrument2", "bus", "thruster", "battery", "instrument1", "solar"],
  power: ["solar", "battery", "instrument2", "heater", "computer", "pointing"],
  budget: ["instrument2", "ground", "instrument1", "pointing", "solar", "thruster", "bus", "computer"],
  data: ["ground", "radio", "computer", "pointing", "instrument2"],
  comms: ["ground", "radio", "computer"],
  time: ["instrument2", "thruster", "computer", "solar", "radio", "pointing", "bus"],
};

const WHY: Record<string, string> = {
  lobby: "Real missions are run by teams. Each role here guards different resources, just like a real spacecraft team, so you will need to talk to each other.",
  objective: "Every real mission starts from one science question. NASA calls it the science objective, and every later choice, from the instrument to the orbit, has to serve it.",
  cleanroom: "Engineers keep a budget for every resource at once: mass, power, volume, money, data and time. Each part you add draws on several of them. The part numbers here come from NASA's CubeSat 101 guide.",
  launch: "Most CubeSats are not launched alone. They ride along on someone else's rocket inside a dispenser, so they must fit a standard size and be ready on the rocket's date.",
  flight: "After launch, the team flies the mission. The orbit decides what the spacecraft can see, and the ground stations decide how much of it comes home.",
  fairing: "Every CubeSat must fit inside a standard dispenser on the rocket. If the parts do not fit the frame, it does not fly. That is why engineers plan volume, not just mass.",
  "launch-vehicle": "Most CubeSats ride as extra passengers on a shared rocket and pay by size: about $100k per U in this game, from NASA's CubeSat 101. A dedicated rocket goes anywhere, any day, but costs millions.",
  "launch-window": "Earth turns under the rocket, so the target orbit lines up with the launch pad only for a short window. Launch late and the orbit is off, and fixing it later costs fuel.",
  "ground-track": "Altitude trades sharpness for lifetime: lower orbits see more detail, but thin air drags them down sooner. Sun-synchronous orbits pass over each place at the same local time every day, so pictures can be compared. The 25 year rule keeps dead satellites from becoming space junk.",
  downlink: "A spacecraft can only send data while a ground station can see it, for a few minutes per pass. Data that cannot be sent waits in storage, and when storage is full, new data is lost.",
  "trade-study": "Engineers call this a trade study: to gain margin in one place, you give some up somewhere else. Real teams decide together, because every choice touches someone else's budget.",
  "design-review": "Before a NASA mission is allowed to fly, it passes design reviews. A board asks hard questions, and the team answers with evidence: numbers, tests and margins.",
  report: "JPL's Concept Maturity Levels (CML) rate how far a mission idea has come, from CML 1, an idea on a napkin, to CML 5, a baseline design ready to propose. Real proposals are judged the same way: does the design close, and can you prove it?",
};

const roleName = (r: RoleId) => ROLE_INFO[r].name;
const partName = (id: string | undefined) => findPart(id)?.name ?? "None";
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The next Clean Room choice that moves this design toward one that closes. */
function nextBuildMove(state: MissionState, sim: Sim, slots: Slot[]): { slot: Slot; part: string | null; reason: "missing" | "fix" } | null {
  const obj = (state.objectiveId as ObjectiveId | null) ?? "wildfires";
  const starter = STARTER[obj];
  const required = slots.filter((s) => !OPTIONAL_SLOTS.includes(s));
  const missing = required.find((s) => !state.design[s]);
  if (missing) return { slot: missing, part: starter[missing] ?? null, reason: "missing" };
  const problem = sim.checks.find((c) => c.status === "bad") ?? sim.checks.find((c) => c.status === "warn");
  if (!problem) return null;
  const order = [...FIX_SLOTS[problem.resource], ...CLEANROOM_SLOTS];
  for (const s of order) {
    if (!slots.includes(s)) continue;
    const want = starter[s] ?? null; // optional slots in the starter are left empty
    if ((state.design[s] ?? null) !== want) return { slot: s, part: want, reason: "fix" };
  }
  return null;
}

function cleanroomHint(i: HintInput, state: MissionState, sim: Sim): Hint {
  const slots = i.where === "host" ? CLEANROOM_SLOTS : CLEANROOM_SLOTS.filter((s) => i.myRoles.includes(SLOT_OWNER[s]));
  const obj = EMBER.objectives.find((o) => o.id === state.objectiveId);
  const goal = "Build a CubeSat that fits, has power, stays in budget and gets its data home. Aim for every bar green.";
  const doneLine =
    i.where === "solo" ? "Tap Continue at the bottom right." : i.where === "phone" ? (i.myRoles.length > 1 ? `Scroll to the bottom and tap the Ready button for each of your roles (${i.myRoles.map(roleName).join(", ")}).` : `Scroll to the bottom and tap ${roleName(i.myRoles[0])} Ready.`) : "Each crew member taps Ready on their phone.";

  if (i.where !== "host" && slots.length === 0) {
    return { goal, steps: ["Your role picks later. Look at the big screen and help your crew decide.", "Ask: does every bar stay green? Is there money left for the rocket?"], why: WHY.cleanroom };
  }
  const move = nextBuildMove(state, sim, slots);
  const missingCount = slots.filter((s) => !OPTIONAL_SLOTS.includes(s) && !state.design[s]).length;
  const bad = sim.checks.find((c) => c.status === "bad");
  const warn = sim.checks.find((c) => c.status === "warn");
  const units = sim.bus?.capacityU ?? 3;
  const rideK = units * 100;
  const left = Math.round(sim.budgetK - sim.costK);
  const leftLine = left >= 0 ? `you have $${left}k left` : `you are over by $${-left}k`;
  const problem = bad ?? warn;

  if (!move && problem) {
    // The design already matches the starter build for this slot set; nothing here fixes it alone.
    return {
      goal,
      steps: [
        `One bar is ${bad ? "red" : "yellow"}. Read the warning line.`,
        problem.line,
        bad
          ? "Your parts already match a good build for this objective, so the Clean Room alone cannot fix this. In the Trade Study, ZENITH's budget rescue or a crew swap can close it."
          : `A yellow warning still flies, but it costs points. ${doneLine}`,
      ],
      why: WHY.cleanroom,
    };
  }
  if (!move) {
    return {
      goal,
      steps: [
        "Your design closes: no red or yellow warnings.",
        `Remember the ride: a rideshare seat for a ${units}U frame costs about $${rideK}k, and ${leftLine}.`,
        doneLine,
      ],
      why: WHY.cleanroom,
    };
  }
  const label = SLOT_LABEL[move.slot];
  const direct = move.part ? `Pick ${partName(move.part)} under ${label}.` : `Set ${label} to None.`;
  if (move.reason === "missing") {
    const objLine = obj && move.slot === "instrument1" ? ` Your objective is ${obj.title}. ${OBJECTIVE_TIP[obj.id].needs}` : "";
    return {
      goal,
      steps: [
        `${missingCount} required ${missingCount === 1 ? "choice is" : "choices are"} left. Next: ${label}.`,
        `${SLOT_WHY[move.slot] ?? ""}${objLine}`.trim(),
        `${direct} It works well for ${obj?.title ?? "this mission"}.`,
      ],
      why: WHY.cleanroom,
    };
  }
  return {
    goal,
    steps: [
      `Every part is picked, but one bar is ${bad ? "red" : "yellow"}. Read the warning line.`,
      problem?.line ?? "",
      `${direct} Then check the bars again.`,
    ],
    why: WHY.cleanroom,
  };
}

function fairingHint(live: unknown): Hint {
  const l = live as { phase: string; ghost: unknown; pieces: { code: string; placed: boolean }[]; sel: number; capU: number; volumeU: number; timeLeft: number } | null;
  const goal = "Pack every part block into the frame before the clock runs out.";
  if (!l) return { goal, steps: ["Read how to play, then tap Start.", "You will drop each part, biggest first, into the outline of the frame."], why: WHY.fairing };
  if (l.phase !== "play") return { goal, steps: ["The packing is done. Tap Continue."], why: WHY.fairing };
  const sel = l.pieces[l.sel];
  if (l.volumeU > l.capU)
    return {
      goal,
      steps: [
        `These parts take ${l.volumeU}U, but the frame holds ${l.capU}U. They cannot all fit.`,
        "Pack what you can. This is what happens when a design outgrows its frame.",
        "Next mission, choose a bigger frame or fewer parts in the Clean Room.",
      ],
      why: WHY.fairing,
    };
  if (!l.ghost)
    return {
      goal,
      steps: [
        "Drop is gray because this column has no room for the selected part.",
        "Move the part sideways to a column with space, or tap Rotate.",
        `Tap the ▶ or ◀ arrows until a dotted outline appears, then tap Drop.`,
      ],
      why: WHY.fairing,
    };
  return {
    goal,
    steps: [
      "Place big parts first, then fill the gaps with the small ones.",
      `The dotted outline shows where the ${sel?.code ?? "part"} will land. Move it with ◀ ▶ or tap a column on the drawing.`,
      "When the outline sits low and leaves no gaps under it, tap Drop.",
    ],
    why: WHY.fairing,
  };
}

function launchVehicleHint(live: unknown, sim: Sim): Hint {
  const l = live as { rows: { name: string; flight: string; rocketId: string; costK: number; open: boolean }[]; sel: number | null; booked: number | null; why: string | null; budgetLeftK: number; massKg: number } | null;
  const goal = "Book a rocket ride that can carry your CubeSat and that you can afford.";
  if (!l) return { goal, steps: ["Read how to play, then tap Start.", "Rideshare seats sell out fast once the board opens."], why: WHY["launch-vehicle"] };
  if (l.booked != null) return { goal, steps: ["You are booked. Tap Continue."], why: WHY["launch-vehicle"] };
  const best = l.rows.find((r) => {
    const rk = ROCKETS.find((x) => x.id === r.rocketId);
    return r.open && rk && l.massKg <= rk.maxMassKg && r.costK <= l.budgetLeftK && (!sim.orbit || rk.orbits.includes(sim.orbit.id));
  });
  const direct = best ? `Tap the ${best.name.toLowerCase()} row (${best.flight}), then tap Book This Ride.` : "No ride fits your budget. Pick the cheapest row and book it anyway; the Trade Study can fix the money later.";
  return {
    goal,
    steps: [
      l.sel == null ? "Tap a row on the board to select it. Book This Ride stays gray until you do." : l.why ? "This ride does not work for you. Read the red line, then try another row." : "This ride works. Book it before the price climbs.",
      `${l.budgetLeftK >= 0 ? `You have $${Math.round(l.budgetLeftK)}k left for the ride.` : `Your parts are already $${Math.round(-l.budgetLeftK)}k over budget.`} Rideshare seats sell every few seconds and the price goes up.`,
      direct,
    ],
    why: WHY["launch-vehicle"],
  };
}

function launchWindowHint(live: unknown): Hint {
  const l = live as { phase: string; massKg: number; limitKg: number; width: number } | null;
  const goal = "Launch at the right moment: tap Launch while the needle is inside the green window.";
  if (!l) return { goal, steps: ["Read how to play, then tap Start.", "The count starts as soon as you tap Start."], why: WHY["launch-window"] };
  if (l.phase !== "count") return { goal, steps: ["Liftoff. Tap Continue."], why: WHY["launch-window"] };
  return {
    goal,
    steps: [
      "Watch the needle sweep across the bar. Tap the big red Launch button when it is inside the green.",
      `The green window is narrower when the payload is heavy: yours is ${l.massKg.toFixed(1)} kg of the ${l.limitKg} kg this rocket can lift.`,
      "The needle speeds up near zero. Tap just as it enters the green, not when it is already there.",
    ],
    why: WHY["launch-window"],
  };
}

function groundTrackHint(live: unknown, state: MissionState): Hint {
  const l = live as { orbitId: string; allowed: string[]; locked: boolean; e: { lifeOk: boolean; debris: boolean; fitOk: boolean } } | null;
  const goal = "Choose the orbit your CubeSat will fly. Watch the map paint a week of passes.";
  const obj = state.objectiveId as ObjectiveId | null;
  if (!l) return { goal, steps: ["Read how to play, then tap Start.", "You will slide Altitude and Tilt and watch the coverage map."], why: WHY["ground-track"] };
  if (l.locked) return { goal, steps: ["Orbit chosen. The game moves on in a moment."], why: WHY["ground-track"] };
  const fix = !l.e.lifeOk
    ? "This orbit is too low: thin air drags it down before 2 years. Slide Altitude higher."
    : l.e.debris
      ? "This orbit is so high your CubeSat would stay up 25+ years after it dies. Slide Altitude lower."
      : !l.e.fitOk
        ? "Your objective needs the same time of day every pass. Slide Tilt to Sun Sync."
        : "This orbit works. Scroll down to compare the readouts, or try another.";
  const best = l.allowed.includes("sso-550") ? "Set Altitude to 550 km and Tilt to Sun Sync, then tap Choose This Orbit." : "Pick any orbit that is not struck out and has no ✗ in the readouts, then tap Choose This Orbit.";
  return {
    goal,
    steps: [obj === "crops" ? "Crops need pictures at the same time of day every pass. That means a sun-synchronous tilt." : "Slide Altitude and Tilt. Struck out stops are places your rocket cannot reach.", fix, best],
    why: WHY["ground-track"],
  };
}

function downlinkHint(live: unknown): Hint {
  const l = live as { phase: string; cfg: { link: boolean; passesPerDay: number } } | null;
  const goal = "Send your science data home while a ground station can see your CubeSat.";
  if (!l) return { goal, steps: ["Read how to play, then tap Start.", "After that you get a second screen with your radio numbers. Tap Start Downlink there."], why: WHY.downlink };
  if (l.phase === "intro")
    return l.cfg.link
      ? { goal, steps: ["Read your radio and ground station numbers, then tap Start Downlink.", "More passes a day and a faster radio mean more data home."], why: WHY.downlink }
      : { goal, steps: ["There is no radio link, so no data can come home. Tap Continue.", "Next mission, pick a radio and a ground station in the Clean Room."], why: WHY.downlink };
  if (l.phase === "done") return { goal, steps: ["The day is over. Tap Continue."], why: WHY.downlink };
  return {
    goal,
    steps: [
      "Tap Transmit (or press Space) in time with the beat, but only while the screen says Station Overhead.",
      "Each bar that reaches the line is a packet. Tap as it touches the line. Tapping with no station in view sends nothing.",
      "Between passes, wait. Watch the Storage bar: when it fills, new data is lost.",
    ],
    why: WHY.downlink,
  };
}

function tradeStudyHint(i: HintInput, state: MissionState, sim: Sim): Hint {
  const team = (state.team["trade-study"] ?? {}) as Record<string, unknown>;
  const goal = "Close the gap: each role offers a swap from its own parts so the whole design works.";
  if (!team.t0 && i.where !== "host") return { goal, steps: ["Read how to play, then tap Start.", "Everyone plays this one together."], why: WHY["trade-study"] };
  if (team.final) return { goal, steps: ["The table is locked. The game moves on in a moment."], why: WHY["trade-study"] };
  const gap = findGap(sim);
  const roles = (["zenith", "forge", "prism", "vector"] as RoleId[]).filter((r) => state.roles[r]);
  const mine = i.where === "host" ? roles : i.myRoles;
  const unlocked = mine.filter((r) => team[`lock:${r}`] !== true);
  const lockLine =
    i.where === "solo"
      ? `Tap Lock In on every role tab at the top (${unlocked.map(roleName).join(", ") || "all done"}).`
      : i.where === "phone"
        ? unlocked.length > 1
          ? `Tap Lock In on each of your role tabs (${unlocked.map(roleName).join(", ")}).`
          : `Tap Lock In${unlocked.length ? ` for ${roleName(unlocked[0])}` : ""}.`
        : "Every crew member taps Lock In on their phone.";
  if (!gap) return { goal: "Every margin already holds. Each role just confirms its numbers.", steps: ["Nothing needs to change. Your design closes.", lockLine], why: WHY["trade-study"] };
  const rescueOpen = !state.rescueUsed || team.rescue === true;
  let best: { role: RoleId; label: string; closure: number } | null = null;
  for (const r of roles) {
    for (const o of offersFor(r, state, sim, gap, rescueOpen)) {
      if (o.problems.length) continue;
      if (!best || o.closure > best.closure) best = { role: r, label: o.label, closure: o.closure };
    }
  }
  const resLabel = { mass: "Mass", power: "Power", budget: "Budget", data: "Data", comms: "Comms", time: "Time" }[gap.resource];
  return {
    goal,
    steps: [
      `The gap is ${resLabel}. Look at each offer card: the % shows how much of the gap it closes.`,
      `${gap.line} Pick offers that reach 100% without a New Problem warning. Roles with nothing useful choose Hold.`,
      best ? `${roleName(best.role)} plays "${best.label}" (${Math.round(best.closure * 100)}% closed). ${lockLine}` : lockLine,
    ],
    why: WHY["trade-study"],
  };
}

function designReviewHint(i: HintInput, state: MissionState, sim: Sim): Hint {
  const team = (state.team["design-review"] ?? {}) as Record<string, unknown>;
  const goal = "Convince the Review Board your mission is ready to fly, one question at a time.";
  const questions = questionsFor(sim);
  const b = battleOf(team, questions);
  if (b.over || questions.length === 0)
    return { goal, steps: [questions.length === 0 ? "Your design had no weak spots, so the Board has no questions. Tap Continue." : "The review is over. Read the verdict, then tap Continue."], why: WHY["design-review"] };
  const q = questions[b.turn];
  const moves = movesFor(state, sim).filter((m) => m.unlocked && !b.spent.has(m.id) && m.answers.includes(q.id));
  const pickLine = i.where === "solo" ? "Pick one card on each role tab." : i.where === "phone" ? "Pick one card for each of your roles." : "Each crew member picks a card on their phone.";
  return {
    goal,
    steps: [
      `The Board asks: "${q.line}" ${pickLine}`,
      `Only evidence that answers this question counts. The question comes from a real weak spot: ${lower(q.checks[0]?.line ?? "")}`,
      moves.length
        ? `${roleName(moves[0].role)} plays ${moves[0].name} (${moves[0].evidence}). The other roles can pick anything.`
        : "No unlocked evidence answers this one. Pick anything; the Board will note it as a weakness.",
    ],
    why: WHY["design-review"],
  };
}

const MG_HINT: Record<MinigameId, (i: HintInput, state: MissionState, sim: Sim) => Hint> = {
  fairing: (i) => fairingHint(i.live ?? null),
  "launch-vehicle": (i, _s, sim) => launchVehicleHint(i.live ?? null, sim),
  "launch-window": (i) => launchWindowHint(i.live ?? null),
  "ground-track": (i, s) => groundTrackHint(i.live ?? null, s),
  downlink: (i) => downlinkHint(i.live ?? null),
  "trade-study": tradeStudyHint,
  "design-review": designReviewHint,
};

/** Help for whatever the player is looking at right now. */
export function hintFor(i: HintInput): Hint {
  const { step, state, sim } = i;
  if (i.joining)
    return {
      goal: "Join your crew's mission from this phone.",
      steps: ["Look at the big screen for a 4 letter room code.", "Type the code and your name, then tap Join a Mission."],
      why: WHY.lobby,
    };
  if (!state || !sim) return { goal: "Getting ready.", steps: ["Wait a moment while the mission loads."] };

  if (!step) {
    if (i.where === "host") {
      const url = typeof location !== "undefined" ? `${location.host}/play` : "this site /play";
      return {
        goal: "Get your crew onto their phones, then start the mission.",
        steps: [
          `Each crew member opens ${url} on a phone and types the room code.`,
          "On their phones, each person taps a role. With fewer than 4 people, someone takes two roles.",
          "Name your crew, then tap Start Mission.",
        ],
        why: WHY.lobby,
      };
    }
    return {
      goal: "Choose your role on the crew.",
      steps: [
        "Tap a role card to take it. Each role guards different resources.",
        "With fewer than 4 people, tap a second open role too, so every job is covered.",
        "Then wait: the host starts the mission from the big screen.",
      ],
      why: WHY.lobby,
    };
  }

  if (step.kind === "objective") {
    const act = i.where === "solo" ? "Tap one objective card." : i.where === "phone" ? "Tap an objective on your phone to vote." : "Vote on your phones, then tap Lock In Objective here.";
    return {
      goal: "Choose what your mission will study. Every later choice has to serve it.",
      steps: [
        act,
        `Each objective needs different tools. ${OBJECTIVE_TIP.wildfires.needs} ${OBJECTIVE_TIP.crops.needs}`,
        `First mission? Pick Spot Wildfires Early. Track Floods is the hardest: ${lower(OBJECTIVE_TIP.floods.needs)}`,
      ],
      why: WHY.objective,
    };
  }

  if (step.kind === "cleanroom") return cleanroomHint(i, state, sim);

  if (step.kind === "scene") {
    const launch = step.scene === "launch";
    return {
      goal: launch ? "Your CubeSat is on its way to the launch pad." : "Your CubeSat is in orbit.",
      steps: [
        `This scene plays by itself for a few seconds.${i.where === "solo" ? " Tap Continue to skip it." : ""}`,
        launch ? "Next, ZENITH books a rocket, then VECTOR times the launch." : "Next, PRISM picks the orbit, then VECTOR sends the data home.",
      ],
      why: launch ? WHY.launch : WHY.flight,
    };
  }

  if (step.kind === "mg") {
    if (i.where === "phone" && !i.myRoles.length) return { goal: "Watch your crew play.", steps: ["Cheer them on with the buttons at the bottom."] };
    const h = MG_HINT[step.id](i, state, sim);
    if (i.where === "host") return { ...h, steps: h.steps.map((s) => s.replace(/^Read how to play, then tap Start\./, "The owner taps Start on their phone.")) };
    return h;
  }

  // Report
  const res = sim.checks.find((c) => c.status === "bad") ?? sim.checks.find((c) => c.status === "warn");
  return {
    goal: "See how your mission did, and what to change next time.",
    steps: [
      "Read What Hurt and Try This Next. They point at the one change worth the most points.",
      res ? `Your biggest problem: ${lower(res.line)}` : "Science is worth up to 400 points: a sharper orbit, a better matched instrument and more data home all raise it.",
      i.where === "phone" ? "The full report is on the big screen. Fly It Again starts there." : "Tap Fly It Again to keep your objective and rebuild, or New Mission to start over.",
    ],
    why: WHY.report,
  };
}

/** The JPL Concept Maturity Levels the report uses, lowest first (score thresholds from score()). */
export const CML_LADDER: { min: number; name: string; meaning: string }[] = [
  { min: 0, name: "CML 2: Initial Feasibility", meaning: "It could work, but not like this" },
  { min: 400, name: "CML 3: Trade Space", meaning: "You explored the options" },
  { min: 600, name: "CML 4: Point Design", meaning: "A real design that closes" },
  { min: 800, name: "CML 5: Concept Baseline", meaning: "Ready to propose" },
];

/** Up to three concrete changes worth the most points next time. */
export function reportTips(sim: Sim, state: MissionState, skill: number): string[] {
  const tips: string[] = [];
  const obj = EMBER.objectives.find((o) => o.id === state.objectiveId);
  const bad = sim.checks.find((c) => c.status === "bad");
  if (bad) tips.push(`Fix the red problem first: ${lower(bad.line)}`);
  if (obj?.wants.seesHeat && !sim.instruments.some((x) => x.id === "inst-thermal" || x.id === "inst-multi"))
    tips.push("Your instrument cannot see heat, so fire science scores half. Try the Thermal Infrared Camera.");
  if (obj?.wants.seesThroughCloud && !sim.instruments.some((x) => x.id === "inst-radar")) tips.push("Floods hide under clouds. Only the Mini Radar sees through them.");
  if (obj?.wants.sunSync && sim.orbit && !sim.orbit.sunSync) tips.push("Crops need the same time of day every pass. Choose a sun-synchronous orbit in Ground Track.");
  const pointing = sim.parts.find((p) => p.pointing)?.pointing;
  if (sim.instruments.some((x) => x.needsPointing === "fine") && pointing !== "fine") tips.push("Your instrument needs Reaction Wheels + Star Tracker to point steadily. Without them its pictures blur and score half.");
  if (sim.delivered > 0 && sim.delivered < 0.95) tips.push(`Only ${Math.round(sim.delivered * 100)}% of your data reached the ground. A second ground station or onboard compression sends more home.`);
  if (sim.instruments.length === 1 && sim.capacityU >= 6) tips.push("Your 6U frame has room for a second instrument. A matched pair can nearly double your science.");
  if (sim.orbit && sim.orbit.sharpness < 1 && tips.length < 2) tips.push(`At ${sim.orbit.altitudeKm} km your pictures are ${Math.round(sim.orbit.sharpness * 100)}% sharp. Lower orbits see more detail, but 400 km needs a thruster to last 2 years.`);
  if (skill < 70) tips.push("Skill is the average of your mini game results. Each one you ace adds points.");
  return tips.slice(0, 3);
}
