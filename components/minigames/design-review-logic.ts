// DESIGN REVIEW rules: the Board's questions come from the design's real weaknesses (sim checks);
// moves are evidence unlocked by good decisions earlier. Words Bible section 9.
import { EMBER, SLOT_OWNER, type ObjectiveId } from "@/lib/game/data/ember";
import type { Check, Sim } from "@/lib/game/sim";
import type { MissionState, RoleId, Slot } from "@/lib/protocol";

export type QId = "margin" | "data" | "eclipse" | "overrun" | "ride" | "life" | "debris";

const QUESTION_DEFS: { id: QId; line: string; checks: string[] }[] = [
  { id: "margin", line: "Your margins are paper thin.", checks: ["mass", "margin", "volume", "radar6u", "power", "power-margin", "ride-mass"] },
  { id: "data", line: "Where does the data go?", checks: ["data"] },
  { id: "eclipse", line: "Will it survive the dark?", checks: ["eclipse", "no-battery"] },
  { id: "overrun", line: "Who pays for the overrun?", checks: ["budget", "schedule"] },
  { id: "ride", line: "Can it even reach that orbit?", checks: ["ride"] },
  { id: "life", line: "Two years? Prove it.", checks: ["life"] },
  { id: "debris", line: "What happens when it dies?", checks: ["debris"] },
];

export interface Question {
  id: QId;
  line: string;
  checks: Check[];
}

/** One question per weakness that exists, in Words Bible order. Board HP = how many. */
export function questionsFor(sim: Sim): Question[] {
  return QUESTION_DEFS.map((q) => ({ id: q.id, line: q.line, checks: sim.checks.filter((c) => q.checks.includes(c.id)) })).filter((q) => q.checks.length > 0);
}

export interface Move {
  id: string;
  role: RoleId;
  name: string;
  /** The number that backs the claim, shown under the move name. */
  evidence: string;
  answers: QId[];
  unlocked: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function movesFor(state: MissionState, sim: Sim): Move[] {
  const obj = state.objectiveId as ObjectiveId | null;
  const d = state.design;
  const best = obj ? sim.instruments.reduce<{ name: string; v: number } | null>((b, i) => ((i.science?.[obj] ?? 0) > (b?.v ?? 0) ? { name: i.name, v: i.science?.[obj] ?? 0 } : b), null) : null;
  const pointing = sim.parts.find((p) => p.pointing)?.pointing;
  const lw = state.results["launch-window"]?.score ?? 0;
  const tradeSet = state.results["trade-study"]?.set ?? {};
  const forgeSwap = (Object.keys(tradeSet) as Slot[]).some((s) => SLOT_OWNER[s] === "forge");
  const left = sim.budgetK - sim.costK;

  return [
    // FORGE
    { id: "healthy-margin", role: "forge", name: "Healthy Margin", evidence: `Mass margin ${Math.round(sim.massMargin * 100)}%`, answers: ["margin"], unlocked: Math.round(sim.massMargin * 100) >= 20 && Math.round(sim.massMargin * 100) <= 45 },
    { id: "eclipse-proof", role: "forge", name: "Eclipse Proof", evidence: `${r1(sim.usableWh)} Wh for ${r1(sim.eclipseWh)} Wh of dark`, answers: ["eclipse", "margin"], unlocked: sim.usableWh > 0 && sim.eclipseWh <= sim.usableWh },
    { id: "lightweight-swap", role: "forge", name: "Lightweight Swap", evidence: "Traded a part in the Trade Study", answers: ["margin"], unlocked: forgeSwap },
    // PRISM
    { id: "perfect-match", role: "prism", name: "Perfect Match", evidence: best ? `${best.name} scores ${best.v} of 5` : "No instrument yet", answers: ["overrun"], unlocked: (best?.v ?? 0) >= 4 },
    { id: "sharp-eyes", role: "prism", name: "Sharp Eyes", evidence: "Pointing within 0.1 degrees", answers: ["data"], unlocked: pointing === "fine" },
    { id: "compressed-data", role: "prism", name: "Compressed Data", evidence: "Shrinks data 4 times", answers: ["data"], unlocked: d.computer === "computer-smart" },
    // VECTOR
    { id: "two-stations", role: "vector", name: "Two Stations", evidence: `${sim.passesPerDay} passes a day`, answers: ["data"], unlocked: d.ground === "ground-2" || d.ground === "ground-net" },
    { id: "clean-insertion", role: "vector", name: "Clean Insertion", evidence: `Launch window ${Math.round(lw * 100)}%`, answers: ["ride", "life"], unlocked: lw >= 0.7 },
    {
      id: "safe-deorbit",
      role: "vector",
      name: "Safe Deorbit",
      evidence: d.thruster ? "A thruster brings it down" : sim.orbit ? `Falls within ${sim.orbit.lifeYears[1]} years` : "No orbit yet",
      answers: ["debris"],
      unlocked: !!d.thruster || (!!sim.orbit && sim.orbit.lifeYears[0] < EMBER.debrisLimitYears),
    },
    // ZENITH
    { id: "budget-reserve", role: "zenith", name: "Budget Reserve", evidence: `$${Math.round(left)}k left`, answers: ["overrun"], unlocked: sim.costK <= 0.85 * sim.budgetK },
    { id: "schedule-slack", role: "zenith", name: "Schedule Slack", evidence: `${sim.months} of ${EMBER.deadlineMonths} months`, answers: ["overrun"], unlocked: sim.months <= 16 },
    { id: "budget-rescue", role: "zenith", name: "Budget Rescue", evidence: "$150k in reserve", answers: ["overrun"], unlocked: !state.rescueUsed },
  ];
}

export const NONE = "none";

export interface Res {
  q: QId;
  by: string | null;
  role: RoleId | null;
}

/** First unspent picked move that answers the question, in seat order. */
export function resolveTurn(q: Question, picks: Partial<Record<RoleId, string>>, moves: Move[], spent: Set<string>, order: RoleId[]): Res {
  for (const r of order) {
    const m = moves.find((x) => x.id === picks[r]);
    if (m && m.unlocked && !spent.has(m.id) && m.answers.includes(q.id)) return { q: q.id, by: m.id, role: r };
  }
  return { q: q.id, by: null, role: null };
}

export const CRED_MAX = 4;

/** Battle so far, read from team state. One resolution per turn under `res:<turn>`. */
export function battleOf(team: Record<string, unknown>, questions: Question[]) {
  const res: Res[] = [];
  for (let i = 0; i < questions.length; i++) {
    const r = team[`res:${i}`] as Res | undefined;
    if (!r) break;
    res.push(r);
  }
  const turn = res.length;
  const misses = res.filter((r) => !r.by).length;
  const cred = CRED_MAX - misses;
  const spent = new Set(res.map((r) => r.by).filter(Boolean) as string[]);
  const answered = new Set(res.filter((r) => r.by).map((r) => r.q));
  return { res, turn, cred, spent, answered, over: turn >= questions.length || cred <= 0 };
}
