"use client";
// Small celebrations: a toast when a mini game ends (stars from its 0..1 score, plus its own
// result line), and confetti when the Board says GO. Both read the room state, so the solo
// screen, the big screen and phones all show the same moment.
import { useEffect, useState } from "react";
import { useMission } from "@/lib/net/useMission";
import { MINIGAMES } from "@/lib/minigames/registry";
import type { MinigameId, MinigameResult } from "@/lib/protocol";

interface Toast {
  key: number;
  title: string;
  note: string;
  stars: number;
}

const starsFor = (score: number) => (score >= 0.85 ? 3 : score >= 0.6 ? 2 : 1);
const PRAISE = ["Done", "Nice Work", "Great Work"];

export function ResultToast({ big = false }: { big?: boolean }) {
  const [toast, setToast] = useState<Toast | null>(null);

  // Watch the store directly, so a new result raises a toast exactly once.
  useEffect(() => {
    let prev = useMission.getState().state?.results ?? {};
    return useMission.subscribe((s) => {
      const results = s.state?.results ?? {};
      if (results === prev) return;
      for (const [id, r] of Object.entries(results) as [MinigameId, MinigameResult][]) {
        if (!r || prev[id] || r.auto) continue;
        setToast({ key: Date.now(), title: MINIGAMES[id]?.title ?? id, note: r.note, stars: starsFor(r.score) });
      }
      prev = results;
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      key={toast.key}
      role="status"
      className="toast-in"
      style={{
        position: "fixed",
        top: big ? 24 : 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 70,
        width: big ? "min(720px, 90vw)" : "min(440px, calc(100vw - 24px))",
        background: "rgba(10, 12, 16, 0.94)",
        color: "var(--text)",
        borderRadius: 8,
        padding: big ? "16px 22px" : "12px 16px",
        boxShadow: "0 10px 28px rgba(0,0,0,.45)",
        borderLeft: "5px solid var(--ok)",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span className="display" style={{ fontSize: big ? 32 : 22 }}>
          {toast.title} Complete
        </span>
        <span aria-label={`${toast.stars} of 3 stars`} style={{ fontSize: big ? 28 : 20, color: "var(--warn)", letterSpacing: 2, whiteSpace: "nowrap" }}>
          {"★".repeat(toast.stars)}
          <span style={{ color: "var(--track)" }}>{"★".repeat(3 - toast.stars)}</span>
        </span>
      </div>
      <div style={{ fontSize: big ? 20 : 15, marginTop: 4, lineHeight: 1.4 }}>
        <b>{PRAISE[toast.stars - 1]}.</b> {toast.note}
      </div>
    </div>
  );
}

const COLORS = ["#D55E00", "#56B4E9", "#CC79A7", "#009E73", "#E8A317", "#ECEFF3"];

/** One burst of confetti in the role colors. Hidden for reduced motion (globals.css). */
export function Confetti() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 15 }}>
      {Array.from({ length: 48 }, (_, i) => {
        const left = (i * 37) % 100;
        const delay = ((i * 53) % 90) / 100;
        const dur = 2.4 + ((i * 29) % 12) / 10;
        return (
          <span
            key={i}
            className="confetti"
            style={{ left: `${left}%`, background: COLORS[i % COLORS.length], animationDelay: `${delay}s`, animationDuration: `${dur}s`, transform: `rotate(${i * 23}deg)` }}
          />
        );
      })}
    </div>
  );
}
