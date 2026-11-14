"use client";
// Cheer / Careful! / Ask Why: buttons on devices, floating chips on the big screen.
import { useMission } from "@/lib/net/useMission";
import { ROLE_INFO } from "@/lib/game/roles";

const LABEL = { cheer: "Cheer", careful: "Careful!", why: "Ask Why" } as const;

export function ReactionButtons() {
  const send = useMission((s) => s.send);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => (
        <button key={k} className="btn btn-quiet" style={{ flex: 1, padding: "10px 8px", fontSize: 15 }} onClick={() => send({ t: "react", kind: k })}>
          {LABEL[k]}
        </button>
      ))}
    </div>
  );
}

export function ReactionFeed() {
  const reactions = useMission((s) => s.reactions);
  return (
    <div style={{ position: "absolute", right: 24, bottom: 24, display: "grid", gap: 8, justifyItems: "end", pointerEvents: "none", zIndex: 30 }}>
      {reactions.map((r) => (
        <div
          key={r.id}
          className="float-in"
          style={{ background: "var(--panel)", padding: "8px 14px", borderRadius: 6, fontSize: 20, borderLeft: `4px solid ${r.role ? ROLE_INFO[r.role].color : "var(--text-dim)"}` }}
        >
          <b>{r.role ? ROLE_INFO[r.role].name : r.name}</b> {LABEL[r.kind]}
        </div>
      ))}
    </div>
  );
}
