"use client";
// The Clean Room part pickers for the slots a device's roles own (SLOT_OWNER).
import { CLEANROOM_SLOTS, EMBER, OPTIONAL_SLOTS, partsForSlot, SLOT_OWNER, type ObjectiveId } from "@/lib/game/data/ember";
import { OBJECTIVE_TIP, SLOT_LABEL, SLOT_WHY } from "@/lib/game/hints";
import type { Sim } from "@/lib/game/sim";
import { ROLE_INFO, STATUS_COLOR } from "@/lib/game/roles";
import { useMission } from "@/lib/net/useMission";
import type { RoleId } from "@/lib/protocol";
import Hud from "./Hud";

export { SLOT_LABEL };

export default function Build({ myRoles, sim, showReady = true }: { myRoles: RoleId[]; sim: Sim; showReady?: boolean }) {
  const { state, send } = useMission();
  if (!state) return null;
  const slots = CLEANROOM_SLOTS.filter((s) => myRoles.includes(SLOT_OWNER[s]));
  const resources = [...new Set(myRoles.flatMap((r) => ROLE_INFO[r].resources))];
  const checks = sim.checks.filter((c) => resources.includes(c.resource));
  const obj = EMBER.objectives.find((o) => o.id === state.objectiveId);
  const missing = slots.filter((s) => !OPTIONAL_SLOTS.includes(s) && !state.design[s]);
  const closes = slots.length > 0 && missing.length === 0 && !sim.checks.some((c) => c.status === "bad" || c.status === "warn");
  const rideK = (sim.bus?.capacityU ?? 3) * 100;
  return (
    <div style={{ marginTop: 20 }}>
      <div className="display" style={{ fontSize: 36 }}>The Clean Room</div>
      {obj && (
        <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.4 }}>
          <b>Objective: {obj.title}.</b> <span style={{ color: "var(--text-dim)" }}>{OBJECTIVE_TIP[obj.id as ObjectiveId].needs}</span>
        </p>
      )}
      {resources.includes("budget") && sim.bus && (
        <p style={{ marginTop: 6, fontSize: 15, color: "var(--text-dim)", lineHeight: 1.4 }}>
          Save money for the ride: a rideshare seat costs about $100k per U, so a {sim.bus.capacityU}U frame needs about ${rideK}k.{" "}
          {sim.costK <= sim.budgetK ? `You have $${Math.round(sim.budgetK - sim.costK)}k left.` : `You are already over by $${Math.round(sim.costK - sim.budgetK)}k.`}
        </p>
      )}
      {slots.length > 0 && missing.length > 0 && (
        <p style={{ marginTop: 6, fontSize: 15, color: "var(--text-dim)" }}>Still to pick: {missing.map((s) => SLOT_LABEL[s]).join(", ")}.</p>
      )}
      {closes && (
        <div className="float-in" role="status" style={{ marginTop: 10, padding: "10px 12px", borderRadius: 6, background: "rgba(43, 182, 115, 0.16)", borderLeft: "4px solid var(--ok)", fontSize: 16, fontWeight: 600 }}>
          ✓ Your design closes. Every margin holds.
        </div>
      )}
      {resources.length > 0 && <div style={{ marginTop: 12 }}><Hud sim={sim} only={resources} size="small" /></div>}
      {checks.map((c) => (
        <div key={c.id} style={{ borderLeft: `4px solid ${STATUS_COLOR[c.status]}`, paddingLeft: 10, marginTop: 10, fontSize: 15 }}>{c.line}</div>
      ))}
      {slots.length === 0 && <p style={{ marginTop: 16, color: "var(--text-dim)" }}>Your role picks later. Help your crew decide.</p>}
      {slots.map((slot) => {
        const optional = OPTIONAL_SLOTS.includes(slot);
        const current = state.design[slot];
        const color = ROLE_INFO[SLOT_OWNER[slot]].color;
        return (
          <section key={slot} style={{ marginTop: 22 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {SLOT_LABEL[slot]}{optional ? " (Optional)" : ""}
            </div>
            {SLOT_WHY[slot] && <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.4 }}>{SLOT_WHY[slot]}</div>}
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {optional && (
                <button onClick={() => send({ t: "set", slot, value: null })} style={{ textAlign: "left", padding: 12, borderRadius: 6, background: !current ? color : "var(--track)", color: "#fff" }}>
                  None
                </button>
              )}
              {partsForSlot(slot).map((p) => (
                <button
                  key={p.id}
                  onClick={() => send({ t: "set", slot, value: p.id })}
                  style={{ textAlign: "left", padding: 12, borderRadius: 6, background: current === p.id ? color : "var(--track)", color: "#fff" }}
                >
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 14, opacity: 0.85, marginTop: 2 }}>{p.blurb}</div>
                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                    {[p.mass ? `${p.mass} kg` : null, `$${p.cost}k`, p.power ? `uses ${p.power} W` : null, p.gen ? `makes ${p.gen} W` : null].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <div style={{ display: "grid", gap: 8, marginTop: 24, marginBottom: 24 }}>
        {showReady && myRoles.map((r) => (
          <button key={r} className="btn" style={{ background: state.ready[r] ? "var(--track)" : ROLE_INFO[r].color }} onClick={() => send({ t: "ready", role: r, ready: !state.ready[r] })}>
            {state.ready[r] ? `${ROLE_INFO[r].name} Is Ready (Tap to Keep Building)` : `${ROLE_INFO[r].name} Ready`}
          </button>
        ))}
      </div>
    </div>
  );
}

