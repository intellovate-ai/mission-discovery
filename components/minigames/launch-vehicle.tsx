"use client";
// LAUNCH VEHICLE (owner ZENITH). A split-flap departures board in Overpass Mono.
// The real rides from ROCKETS, priced for this bus. Rideshare seats sell out and the price
// climbs while you think. Picking a ride that can't carry you, or that you can't afford,
// shows why. The orbit is picked later, in GROUND TRACK.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Overpass_Mono } from "next/font/google";
import type { MinigameContext, MinigameDef, MinigameProps } from "@/lib/minigames/types";
import type { MinigameResult } from "@/lib/protocol";
import { ORBITS, ROCKETS, type Rocket } from "@/lib/game/data/ember";
import type { Sim } from "@/lib/game/sim";

const mono = Overpass_Mono({ subsets: ["latin"], weight: ["400", "700"] });

const BOARD = "#111111";
const FLAP = "#1C1C1C";
const TEXT = "#F4F4F4";
const AMBER = "#FFB300";
const DIM = "#8A8A8A";

const TITLE = "LAUNCH VEHICLE";
const SUBTITLE = "Buy a ride that can carry you";
const HOW_TO = "Pick a rocket before the seats sell out.";
const WIN = "Booked. Your spacecraft fits and the orbit is on the menu.";
const ORBIT_MISS = "That rocket can't reach your orbit. Every rocket has places it can and can't go.";
const massLine = (x: number) => `Too heavy by ${x.toFixed(1)} kg. Every part adds up. Try a smaller battery, drop an instrument, or a bigger frame (but a bigger ride costs more).`;
const budgetLine = (x: number) => `Over by $${Math.round(x).toLocaleString("en-US")}k. Ask ZENITH for the budget rescue, or find cheaper parts.`;

const SEATS = 6;
const SALE_MS = 3200; // a seat sells this often
const STEP_K = 10; // rideshare price per U rises this much per seat sold
const WAIT_K = 50; // Balance Sheet: miss the rideshare date, wait 6 months, +$50k team cost

const ORBIT_SHORT: Record<string, string> = { "leo-400": "400 KM", "sso-550": "550 KM SSO", "sso-700": "700 KM SSO", "sso-dd-550": "550 KM DAWN DUSK" };

interface Row {
  key: string;
  rocketId: string;
  flight: string;
  name: string;
  orbits: string;
  carries: string;
  price: string;
  status: string;
  costK: number;
  perUK: number | null;
  open: boolean;
}

export interface LaunchVehicleLive {
  rows: Row[];
  sel: number | null;
  booked: number | null;
  why: string | null;
  note: string;
  budgetLeftK: number;
  massKg: number;
  seats: number;
}

const k = (n: number) => `$${Math.round(n).toLocaleString("en-US")}K`;

function orbitsLabel(r: Rocket) {
  return r.orbits.length >= ORBITS.length ? "ANY ORBIT" : r.orbits.map((o) => ORBIT_SHORT[o] ?? o.toUpperCase()).join(", ");
}

/** What the spacecraft costs without any ride, so every row can be priced against the budget. */
function baseCostK(sim: Sim) {
  const r = sim.rocket;
  const units = sim.bus?.capacityU ?? sim.capacityU;
  const rideK = r ? (r.flatCost ?? (r.costPerU ?? 0) * units) : 0;
  return sim.costK - rideK;
}

function buildRows(sim: Sim, seats: number): Row[] {
  const units = sim.bus?.capacityU ?? sim.capacityU;
  const sold = SEATS - seats;
  const rows: Row[] = [];
  for (const r of ROCKETS) {
    if (r.costPerU != null) {
      const perU = r.costPerU + sold * STEP_K;
      rows.push({
        key: `${r.id}-1`,
        rocketId: r.id,
        flight: "RS 1",
        name: r.name.toUpperCase(),
        orbits: orbitsLabel(r),
        carries: `${r.maxMassKg} KG`,
        price: k(perU * units),
        status: seats > 0 ? `SEATS ${seats}` : "SOLD OUT",
        costK: perU * units,
        perUK: perU,
        open: seats > 0,
      });
      if (seats <= 0)
        rows.push({
          key: `${r.id}-2`,
          rocketId: r.id,
          flight: "RS 2",
          name: r.name.toUpperCase(),
          orbits: orbitsLabel(r),
          carries: `${r.maxMassKg} KG`,
          price: k(r.costPerU * units + WAIT_K),
          status: "+6 MONTHS",
          costK: r.costPerU * units + WAIT_K,
          perUK: r.costPerU,
          open: true,
        });
    } else {
      rows.push({
        key: r.id,
        rocketId: r.id,
        flight: "DL 1",
        name: r.name.toUpperCase(),
        orbits: orbitsLabel(r),
        carries: `${r.maxMassKg} KG`,
        price: k(r.flatCost ?? 0),
        status: "ANY DATE",
        costK: r.flatCost ?? 0,
        perUK: null,
        open: true,
      });
    }
  }
  return rows;
}

/** Why this ride can't take you, as the Words Bible line, or null if it can. */
function whyNot(sim: Sim, row: Row, budgetLeftK: number): string | null {
  const r = ROCKETS.find((x) => x.id === row.rocketId);
  if (!r) return null;
  if (sim.massKg > sim.maxMassKg) return massLine(sim.massKg - sim.maxMassKg);
  if (sim.massKg > r.maxMassKg) return massLine(sim.massKg - r.maxMassKg);
  if (sim.orbit && !r.orbits.includes(sim.orbit.id)) return ORBIT_MISS;
  if (row.costK > budgetLeftK) return budgetLine(row.costK - budgetLeftK);
  return null;
}

// --- Sound sting: flap clatter (short noise clicks, no audio files) ---
let ac: AudioContext | null = null;
function clatter(count = 8) {
  try {
    ac ??= new AudioContext();
    if (ac.state === "suspended") void ac.resume();
    const t0 = ac.currentTime;
    const n = Math.floor(ac.sampleRate * 0.012);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    for (let i = 0; i < count; i++) {
      const src = ac.createBufferSource();
      src.buffer = buf;
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800 + Math.random() * 1200;
      const g = ac.createGain();
      g.gain.value = 0.18;
      src.connect(hp).connect(g).connect(ac.destination);
      src.start(t0 + i * 0.028 + Math.random() * 0.008);
    }
  } catch {
    /* no audio: fine */
  }
}

// --- Split-flap text ---
const FLAP_CSS = `
@keyframes lv-flip { 0% { transform: rotateX(90deg); filter: brightness(0.5); } 60% { transform: rotateX(-12deg); } 100% { transform: rotateX(0); filter: none; } }
.lv-cell { display: inline-grid; place-items: center; background: ${FLAP}; position: relative; perspective: 200px; border-radius: 2px; }
.lv-cell::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: ${BOARD}; }
.lv-ch { display: block; animation: lv-flip 260ms ease-out both; transform-origin: 50% 50%; }
`;

function Flaps({ text, len, cell, color = TEXT, delay = 0 }: { text: string; len: number; cell: string; color?: string; delay?: number }) {
  const chars = text.toUpperCase().padEnd(len, " ").slice(0, len).split("");
  return (
    <span style={{ display: "inline-flex", gap: `calc(${cell} * 0.08)`, fontSize: `calc(${cell} * 1.18)`, fontWeight: 700, lineHeight: 1 }}>
      {chars.map((c, i) => (
        <span key={i} className="lv-cell" style={{ width: cell, height: `calc(${cell} * 1.55)` }}>
          <span key={c} className="lv-ch" style={{ color, animationDelay: `${delay + i * 18}ms` }}>
            {c === " " ? " " : c}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Plays the clatter when the board's text changes (both on the phone and the big screen). */
function useClatter(signature: string) {
  const prev = useRef("");
  useEffect(() => {
    if (prev.current && prev.current !== signature) clatter(10);
    prev.current = signature;
  }, [signature]);
}

const sig = (rows: Row[], booked: number | null) => rows.map((r) => r.price + r.status).join("|") + (booked ?? "");

// --- Play: ZENITH's phone ---
function Play({ ctx, sendLive, finish }: Pick<MinigameProps<LaunchVehicleLive>, "ctx" | "sendLive" | "finish">) {
  const sim = ctx.sim;
  const budgetLeftK = sim.budgetK - baseCostK(sim);
  const [seats, setSeats] = useState(SEATS);
  // Selection and booking are kept by flight key, so they stay put when rows shift.
  const [selKey, setSelKey] = useState<string | null>(null);
  const [bookedKey, setBookedKey] = useState<string | null>(null);
  const [result, setResult] = useState<MinigameResult | null>(null);
  const done = useRef(false);
  const rows = useMemo(() => buildRows(sim, seats), [sim, seats]);
  const idx = (key: string | null) => {
    const i = key ? rows.findIndex((r) => r.key === key) : -1;
    return i < 0 ? null : i;
  };
  const sel = idx(selKey);
  const booked = idx(bookedKey);
  const selRow = sel != null ? rows[sel] : null;
  const why = selRow ? whyNot(sim, selRow, budgetLeftK) : null;
  const anyBookable = rows.some((r) => r.open && !whyNot(sim, r, budgetLeftK));

  // Seats sell on a timer until you book.
  useEffect(() => {
    if (bookedKey != null) return;
    const id = setInterval(() => setSeats((s) => Math.max(0, s - 1)), SALE_MS);
    return () => clearInterval(id);
  }, [bookedKey]);

  useClatter(sig(rows, booked));

  const finishNow = useCallback(() => {
    if (done.current || !result) return;
    done.current = true;
    finish(result);
  }, [finish, result]);

  useEffect(() => {
    if (!result) return;
    const id = setTimeout(finishNow, 4000);
    return () => clearTimeout(id);
  }, [result, finishNow]);

  const book = () => {
    if (sel == null || !selRow || booked != null || !selRow.open) return;
    if (why && anyBookable) return;
    let score: number;
    if (why) score = 0.25; // nothing could take you; booked anyway
    else if (selRow.flight === "RS 1") score = 1 - 0.1 * (SEATS - seats);
    else if (selRow.flight === "RS 2") score = 0.35;
    else score = 0.6;
    setBookedKey(selRow.key);
    setResult({ score: Math.round(score * 100) / 100, set: { rocket: selRow.rocketId }, note: why ?? WIN });
  };

  const live = useMemo<LaunchVehicleLive>(
    () => ({ rows: rows.map((r, i) => (i === booked ? { ...r, status: "BOOKED" } : r)), sel, booked, why, note: result?.note ?? "", budgetLeftK, massKg: sim.massKg, seats }),
    [rows, sel, booked, why, result, budgetLeftK, sim.massKg, seats],
  );
  const latest = useRef(live);
  useEffect(() => {
    latest.current = live;
    sendLive(live);
  }, [live, sendLive]);
  useEffect(() => {
    const id = setInterval(() => sendLive(latest.current), 300);
    return () => clearInterval(id);
  }, [sendLive]);

  const cell = "12.6px";
  const units = sim.bus?.capacityU ?? sim.capacityU;
  const canBook = !!selRow && selRow.open && booked == null && (!why || !anyBookable);

  return (
    <div className={mono.className} style={{ position: "absolute", inset: 0, background: BOARD, color: TEXT, display: "flex", flexDirection: "column", padding: 14, gap: 10 }}>
      <style>{FLAP_CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1, color: AMBER }}>{TITLE}</div>
          <div style={{ fontSize: 15, color: DIM }}>{SUBTITLE}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: DIM, lineHeight: 1.3 }}>
          BUDGET LEFT
          <div style={{ fontSize: 18, color: TEXT, fontWeight: 700 }}>{k(budgetLeftK)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, overflowY: "auto", minHeight: 0 }}>
        {live.rows.map((r, i) => {
          const isSel = i === sel;
          return (
            <button
              key={r.key}
              onClick={() => booked == null && setSelKey(r.key)}
              style={{
                textAlign: "left",
                background: "transparent",
                border: `2px solid ${isSel ? AMBER : "#2A2A2A"}`,
                borderRadius: 4,
                padding: 7,
                display: "grid",
                gap: 4,
                opacity: r.open || i === booked ? 1 : 0.55,
                fontFamily: "inherit",
                touchAction: "manipulation",
              }}
            >
              <Flaps text={r.name} len={24} cell={cell} />
              <span style={{ display: "flex", gap: 6 }}>
                <Flaps text={r.price} len={7} cell={cell} color={AMBER} />
                <Flaps text={r.carries} len={6} cell={cell} />
                <Flaps text={r.status} len={9} cell={cell} color={r.open ? TEXT : "#E5484D"} />
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                <Flaps text={r.flight} len={4} cell={cell} color={DIM} />
                <Flaps text={r.orbits} len={19} cell={cell} />
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
        {result ? (
          <div style={{ fontSize: 17, lineHeight: 1.4, fontWeight: 700, color: why ? "#FF8A80" : AMBER }}>{result.note}</div>
        ) : selRow ? (
          <div style={{ fontSize: 15, lineHeight: 1.45, display: "grid", gap: 4 }}>
            <div style={{ color: DIM }}>
              {selRow.perUK != null ? `$${selRow.perUK}k per U × ${units}U` : "Whole rocket, flat price"}
              {selRow.flight === "RS 2" ? ` + $${WAIT_K}k to wait 6 months` : ""} · Mass {sim.massKg.toFixed(1)} of {selRow.carries.toLowerCase()}
            </div>
            {why && <div style={{ color: "#FF8A80", fontWeight: 700 }}>{why}</div>}
            {!selRow.open && <div style={{ color: "#FF8A80", fontWeight: 700 }}>{HOW_TO}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 15, color: DIM, lineHeight: 1.45 }}>{HOW_TO}</div>
        )}
        {result ? (
          <button onClick={finishNow} style={{ minHeight: 56, background: AMBER, color: BOARD, border: "none", borderRadius: 4, fontSize: 18, fontWeight: 700, fontFamily: "inherit" }}>
            Continue
          </button>
        ) : (
          <button
            onClick={book}
            disabled={!canBook}
            style={{
              minHeight: 56,
              background: canBook ? AMBER : "#2A2A2A",
              color: canBook ? BOARD : DIM,
              border: "none",
              borderRadius: 4,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "inherit",
              touchAction: "manipulation",
            }}
          >
            {why && !anyBookable && selRow?.open ? "Book Anyway" : "Book This Ride"}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Watch: the big screen ---
// Two flap lines per flight so the letters stay big enough for a projector.
const L1: [keyof Row, number][] = [
  ["flight", 4],
  ["name", 24],
  ["price", 7],
  ["status", 9],
];
const L1_LEN = L1.reduce((a, c) => a + c[1], 0);

function Watch({ live }: { live: LaunchVehicleLive | null }) {
  useClatter(live ? sig(live.rows, live.booked) : "");
  const box: React.CSSProperties = { position: "absolute", inset: 0, background: BOARD, color: TEXT, containerType: "size", padding: "4cqh 3cqw", display: "flex", flexDirection: "column", gap: "3cqh" };
  if (!live)
    return (
      <div className={mono.className} style={{ ...box, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontSize: "10cqh", fontWeight: 700, color: AMBER, letterSpacing: "0.3cqh" }}>{TITLE}</div>
        <div style={{ fontSize: "4.4cqh", color: DIM }}>{SUBTITLE}</div>
        <div style={{ fontSize: "4cqh" }}>{HOW_TO}</div>
        <div style={{ fontSize: "3.4cqh", color: DIM, marginTop: "3cqh" }}>Watching: ZENITH is buying a ride.</div>
      </div>
    );
  const cell = `calc(90cqw / ${L1_LEN * 1.1})`;
  const sel = live.sel != null ? live.rows[live.sel] : null;
  const gap = "1.4cqw";
  const w = (len: number) => `calc(${cell} * ${len} * 1.08)`;
  const colorFor = (r: Row, i: number, key: keyof Row) =>
    key === "price" ? AMBER : key === "status" ? (i === live.booked ? AMBER : r.open ? TEXT : "#E5484D") : key === "flight" ? DIM : TEXT;
  return (
    <div className={mono.className} style={box}>
      <style>{FLAP_CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "8cqh", fontWeight: 700, color: AMBER, letterSpacing: "0.3cqh", lineHeight: 1 }}>{TITLE}</div>
          <div style={{ fontSize: "3.6cqh", color: DIM, marginTop: "1cqh" }}>{SUBTITLE}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: "2.8cqh", color: DIM }}>
          BUDGET LEFT
          <div style={{ fontSize: "6cqh", color: TEXT, fontWeight: 700, lineHeight: 1.1 }}>{k(live.budgetLeftK)}</div>
        </div>
      </div>
      <div style={{ display: "grid", gap: "2.6cqh" }}>
        <div style={{ display: "flex", gap, fontSize: "2.6cqh", color: AMBER, fontWeight: 700 }}>
          <span style={{ width: w(4) }}>FLIGHT</span>
          <span style={{ width: w(24) }}>RIDE · ORBITS · CARRIES</span>
          <span style={{ width: w(7) }}>PRICE</span>
          <span style={{ width: w(9) }}>STATUS</span>
        </div>
        {live.rows.map((r, i) => (
          <div
            key={r.key}
            style={{
              display: "grid",
              gap: "1cqh",
              outline: i === live.sel ? `0.4cqh solid ${AMBER}` : "none",
              outlineOffset: "1cqh",
              opacity: r.open || i === live.booked ? 1 : 0.55,
            }}
          >
            <div style={{ display: "flex", gap }}>
              {L1.map(([key, len]) => (
                <Flaps key={key} text={String(r[key])} len={len} cell={cell} color={colorFor(r, i, key)} />
              ))}
            </div>
            <div style={{ display: "flex", gap }}>
              <span style={{ width: w(4) }} />
              <Flaps text={r.orbits} len={18} cell={cell} />
              <Flaps text={r.carries} len={6} cell={cell} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto", fontSize: "4.4cqh", fontWeight: 700, lineHeight: 1.35, minHeight: "12cqh", color: live.note ? (live.why ? "#FF8A80" : AMBER) : live.why ? "#FF8A80" : TEXT }}>
        {live.note || live.why || (sel ? `${sel.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}: ${sel.price}, carries ${sel.carries.toLowerCase()}` : HOW_TO)}
      </div>
    </div>
  );
}

function LaunchVehicle({ mode, live, sendLive, finish, ctx }: MinigameProps<LaunchVehicleLive>) {
  return mode === "play" ? <Play ctx={ctx} sendLive={sendLive} finish={finish} /> : <Watch live={live} />;
}

const autoResolve = (ctx: MinigameContext): MinigameResult => {
  void ctx;
  return { score: 0.5, set: { rocket: "rideshare" }, note: "Booked a rideshare seat." };
};

const def: MinigameDef = {
  id: "launch-vehicle",
  title: TITLE,
  subtitle: SUBTITLE,
  howTo: HOW_TO,
  owner: "zenith",
  wipe: BOARD,
  Component: LaunchVehicle,
  autoResolve,
};
export default def;
