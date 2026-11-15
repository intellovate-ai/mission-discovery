"use client";
// The Hint button: on every screen, gives step-aware help that escalates from a nudge to a
// direct instruction, plus "Why This Matters". After a stretch with no taps it nudges once
// ("Stuck? Tap Hint."). Content comes from lib/game/hints.ts.
import { useEffect, useRef, useState } from "react";
import type { Hint } from "@/lib/game/hints";

const IDLE_MS = 25000;

interface Props {
  hint: Hint;
  /** Changing this (a new step) closes the panel and starts the help over from the nudge. */
  resetKey: string;
  /** Show "Stuck? Tap Hint." after a stretch with no taps. Off on the big screen. */
  autoPrompt?: boolean;
  /** Where the panel opens: above the button (bottom strips) or below it (top bars). */
  opens?: "up" | "down";
  /** Bigger type for the projector. */
  big?: boolean;
}

export default function HintButton(props: Props) {
  // Remount on a new step, so the panel closes and the help starts over from the nudge.
  return <HintInner key={props.resetKey} {...props} />;
}

function HintInner({ hint, autoPrompt = true, opens = "up", big = false }: Props) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const [idle, setIdle] = useState(false);
  const last = useRef(0);

  // Idle nudge: any tap or key press counts as activity.
  useEffect(() => {
    if (!autoPrompt) return;
    last.current = Date.now();
    const touch = () => {
      last.current = Date.now();
      setIdle(false);
    };
    window.addEventListener("pointerdown", touch, true);
    window.addEventListener("keydown", touch, true);
    const id = setInterval(() => {
      if (Date.now() - last.current > IDLE_MS) setIdle(true);
    }, 1000);
    return () => {
      window.removeEventListener("pointerdown", touch, true);
      window.removeEventListener("keydown", touch, true);
      clearInterval(id);
    };
  }, [autoPrompt]);

  // H toggles the panel on a keyboard (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "h" || e.key === "H") setOpen((o) => !o);
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const steps = hint.steps.filter(Boolean);
  const shown = Math.min(level, Math.max(0, steps.length - 1));
  const fs = big ? 20 : 16;

  const panelPos: React.CSSProperties =
    opens === "up" ? { bottom: big ? 76 : 72, right: 12 } : { top: 52, right: 8 };

  return (
    <>
      <span style={{ position: "relative", display: "inline-flex", flex: "none" }}>
        <button
          className={`btn btn-quiet${idle && !open ? " hint-pulse" : ""}`}
          aria-expanded={open}
          aria-controls="hint-panel"
          onClick={() => {
            setOpen((o) => !o);
            setIdle(false);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: big ? "12px 20px" : "9px 14px", fontSize: big ? 20 : 16, minHeight: 44 }}
        >
          <span aria-hidden style={{ width: big ? 24 : 20, height: big ? 24 : 20, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: big ? 16 : 14, fontWeight: 700 }}>?</span>
          Hint
        </button>
        {idle && !open && (
          <span
            className="float-in"
            role="status"
            style={{
              position: "absolute",
              [opens === "up" ? "bottom" : "top"]: "calc(100% + 8px)",
              right: 0,
              whiteSpace: "nowrap",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              padding: "6px 12px",
              borderRadius: 6,
              pointerEvents: "none",
            }}
          >
            Stuck? Tap Hint.
          </span>
        )}
      </span>
      {open && (
        <div
          id="hint-panel"
          role="dialog"
          aria-label="Hint"
          className="float-in"
          style={{
            position: "fixed",
            ...panelPos,
            zIndex: 80,
            width: big ? "min(560px, calc(100vw - 24px))" : "min(400px, calc(100vw - 16px))",
            maxHeight: opens === "up" ? "calc(100dvh - 96px)" : "calc(100dvh - 64px)",
            overflowY: "auto",
            background: "rgba(10, 12, 16, 0.96)",
            color: "var(--text)",
            borderRadius: 8,
            padding: big ? 22 : 16,
            boxShadow: "0 12px 32px rgba(0,0,0,.5)",
            fontFamily: "var(--font-body), system-ui, sans-serif",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div className="display" style={{ fontSize: big ? 30 : 24 }}>Hint</div>
            <div style={{ color: "var(--text-dim)", fontSize: 14 }}>
              Help {shown + 1} of {steps.length}
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: fs, fontWeight: 600, lineHeight: 1.35 }}>{hint.goal}</p>
          <ol aria-live="polite" style={{ marginTop: 10, display: "grid", gap: 8, listStyle: "none", padding: 0 }}>
            {steps.slice(0, shown + 1).map((s, i) => (
              <li key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 8, fontSize: fs, lineHeight: 1.4 }}>
                <span aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", background: i === shown ? "var(--accent)" : "var(--track)", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {showWhy && hint.why && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--track)", borderRadius: 6 }}>
              <div style={{ fontWeight: 700, fontSize: fs - 1 }}>Why This Matters</div>
              <p style={{ marginTop: 4, fontSize: fs - 1, lineHeight: 1.45, color: "var(--text)" }}>{hint.why}</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {shown < steps.length - 1 && (
              <button className="btn" style={{ padding: "10px 16px", fontSize: 16, minHeight: 44 }} onClick={() => setLevel(shown + 1)}>
                {shown === steps.length - 2 ? "Show Me Exactly" : "More Help"}
              </button>
            )}
            {hint.why && (
              <button className="btn btn-quiet" style={{ padding: "10px 16px", fontSize: 16, minHeight: 44 }} aria-pressed={showWhy} onClick={() => setShowWhy((w) => !w)}>
                {showWhy ? "Hide Why" : "Why This Matters"}
              </button>
            )}
            <button className="btn btn-quiet" style={{ padding: "10px 16px", fontSize: 16, minHeight: 44, marginLeft: "auto" }} onClick={() => setOpen(false)}>
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
