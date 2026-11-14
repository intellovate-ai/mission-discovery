"use client";
// Resource bars (Words Bible section 4). Big screen shows all six; a device shows its role's.
import type { ResourceKey, Sim } from "@/lib/game/sim";
import { RESOURCE_TIP, STATUS_COLOR } from "@/lib/game/roles";

export default function Hud({ sim, only, size = "big" }: { sim: Sim; only?: ResourceKey[]; size?: "big" | "small" }) {
  const bars = only ? sim.bars.filter((b) => only.includes(b.key)) : sim.bars;
  const big = size === "big";
  return (
    <div style={{ display: "grid", gap: big ? 10 : 8, width: big ? 340 : "100%" }}>
      {bars.map((b) => (
        <div key={b.key} title={RESOURCE_TIP[b.key]}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: big ? 16 : 14 }}>
            <span style={{ fontWeight: 600 }}>{b.label}</span>
            <span style={{ color: "var(--text-dim)" }}>{b.value}</span>
          </div>
          <div style={{ height: big ? 8 : 6, background: "var(--track)", borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max(2, Math.min(100, b.fill * 100))}%`,
                background: STATUS_COLOR[b.status],
                transition: "width .4s ease, background .4s ease",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
