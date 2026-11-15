"use client";
// End of mission: one card per role this device held (Words Bible section 11).
import type { Bar } from "@/lib/game/sim";
import { ROLE_INFO } from "@/lib/game/roles";
import type { RoleId } from "@/lib/protocol";
import { ReactionButtons } from "./Reactions";

const RANK = { ok: 0, empty: 1, warn: 2, bad: 3 } as const;

export default function RoleCards({ myRoles, bars, total }: { myRoles: RoleId[]; bars: Bar[]; total: number }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div className="display" style={{ fontSize: 36 }}>Mission Report</div>
      <p style={{ color: "var(--text-dim)" }}>Crew score: {total} of 1,000. The full report is on the big screen.</p>
      {myRoles.map((r) => {
        const mine = bars.filter((b) => ROLE_INFO[r].resources.includes(b.key)).sort((a, b) => RANK[a.status] - RANK[b.status]);
        const best = mine[0];
        const worst = mine[mine.length - 1];
        return (
          <div key={r} className="panel" style={{ marginTop: 14, borderLeft: `6px solid ${ROLE_INFO[r].color}` }}>
            <div className="display" style={{ fontSize: 24 }}>{ROLE_INFO[r].name}</div>
            <p style={{ marginTop: 6 }}>
              As {ROLE_INFO[r].name}, you {best?.status === "ok" ? `kept ${best.label.toLowerCase()} healthy` : "kept the mission moving"}.{" "}
              {worst && worst.status !== "ok" && worst !== best ? `Next time, watch your ${worst.label.toLowerCase()}.` : "Keep that margin next time."}
            </p>
          </div>
        );
      })}
      <div style={{ marginTop: 20 }}><ReactionButtons /></div>
    </div>
  );
}
