"use client";
import type { MinigameResult } from "@/lib/protocol";
import type { MinigameContext, MinigameProps } from "@/lib/minigames/types";

/** Placeholder used until a mini game's real component lands. */
export function makeStub(title: string, auto: (ctx: MinigameContext) => MinigameResult) {
  return function Stub({ mode, finish, ctx }: MinigameProps) {
    return (
      <div style={{ display: "grid", placeItems: "center", alignContent: "center", height: "100%", gap: 16, color: "#ECEFF3", textAlign: "center", padding: 24 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 40 }}>{title}</div>
        <div style={{ opacity: 0.7 }}>This step is not built yet. It resolves with an average result.</div>
        {mode === "play" && (
          <button className="btn" onClick={() => finish({ ...auto(ctx), auto: true })}>
            Continue
          </button>
        )}
      </div>
    );
  };
}
