"use client";
// Mission report and leaderboard (Words Bible section 11). Big screen and single player.
import { useEffect, useState } from "react";
import { boardName, type FinishedEntry } from "@/lib/protocol";
import { PARTY_HOST, useMission } from "@/lib/net/useMission";
import type { ResourceKey, Score } from "@/lib/game/sim";
import { CML_LADDER } from "@/lib/game/hints";
import { Confetti } from "./Celebrate";

const isLocal = () => ["localhost", "127.0.0.1"].includes(location.hostname);

const REAL_WORLD: Record<ResourceKey, string> = {
  mass: "parts usually come in heavier than planned, which is why engineers keep margin.",
  power: "solar panels slowly lose power as they age in space.",
  budget: "missions are reviewed for cost at every stage, and some get cut when they grow.",
  data: "many satellites collect far more than their radios can send home.",
  comms: "many satellites collect far more than their radios can send home.",
  time: "launch dates are fixed, and a late spacecraft waits for the next ride.",
};

export default function Report({ result, worked, hurt, tips = [], onNew }: { result: Score; worked: string[]; hurt?: { line: string; resource: ResourceKey }; tips?: string[]; onNew: () => void }) {
  const { state, send, boardPostedAt } = useMission();
  const [board, setBoard] = useState<FinishedEntry[] | null>(null);
  const finishedAt = state?.finished?.at;
  // Multiplayer: the room posts the run, so a short wait is enough. Single player posts from
  // this browser and re-reads once that post lands (boardPostedAt), so the run always shows.
  useEffect(() => {
    if (!finishedAt) return;
    const t = setTimeout(() => {
      fetch(`https://${PARTY_HOST}/parties/leaderboard/${boardName(isLocal() ? "dev" : "live")}?mission=${state?.missionId ?? "ember"}`)
        .then((r) => r.json())
        .then((d: FinishedEntry[]) => setBoard(d))
        .catch(() => setBoard([]));
    }, 800);
    return () => clearTimeout(t);
  }, [finishedAt, boardPostedAt, state?.missionId]);
  if (!state) return null;
  const rows: [string, number, number][] = [
    ["Science", result.science, 400],
    ["Efficiency", result.efficiency, 250],
    ["Decisions", result.decisions, 150],
    ["Collaboration", result.collaboration, 100],
    ["Skill", result.skill, 100],
  ];
  return (
    <div style={{ position: "absolute", inset: "20px 24px 72px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20, zIndex: 20, overflowY: "auto" }}>
      {result.go && <Confetti />}
      <div className="panel" style={{ overflow: "auto" }}>
        <div className="display" style={{ fontSize: 46 }}>
          {state.crew || "Unnamed Crew"} reached {result.cml}: {result.meaning}.
        </div>
        <div style={{ fontSize: 28, marginTop: 10, color: result.go ? "var(--ok)" : "var(--bad)", fontWeight: 700 }}>
          The Board said {result.go ? "GO" : "NO GO"}.
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 18 }}>
          <span className="display" style={{ fontSize: 96 }}>{result.total}</span>
          <span style={{ color: "var(--text-dim)", fontSize: 22 }}>of 1,000</span>
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {rows.map(([label, v, max]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "140px 1fr 90px", alignItems: "center", gap: 12 }}>
              <span>{label}</span>
              <div style={{ height: 8, background: "var(--track)", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${(v / max) * 100}%`, background: "var(--text)", borderRadius: 4 }} />
              </div>
              <span style={{ color: "var(--text-dim)", textAlign: "right" }}>{v} of {max}</span>
            </div>
          ))}
        </div>
        {worked.length > 0 && <p style={{ marginTop: 18, fontSize: 18 }}><b>What worked:</b> {worked.join(". ")}.</p>}
        {hurt && <p style={{ marginTop: 10, fontSize: 18 }}><b>What hurt:</b> {hurt.line}</p>}
        {hurt && <p style={{ marginTop: 10, fontSize: 18, color: "var(--text-dim)" }}>Real missions face this too: {REAL_WORLD[hurt.resource]}</p>}
        {tips.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Try This Next</div>
            <ul style={{ marginTop: 6, paddingLeft: 20, listStyle: "disc", display: "grid", gap: 4, fontSize: 17, lineHeight: 1.4 }}>
              {tips.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>What Your Level Means</div>
          <p style={{ marginTop: 4, fontSize: 15, color: "var(--text-dim)", lineHeight: 1.45 }}>
            JPL rates mission ideas with Concept Maturity Levels (CML), from an idea on a napkin to a design ready to propose.
          </p>
          <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
            {CML_LADDER.map((c, i) => {
              const next = CML_LADDER[i + 1];
              const here = result.total >= c.min && (!next || result.total < next.min);
              return (
                <div key={c.name} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 10, fontSize: 16, color: here ? "var(--text)" : "var(--text-dim)", fontWeight: here ? 700 : 400 }}>
                  <span>{c.min}+</span>
                  <span>
                    {c.name}: {c.meaning}{here ? " (You Are Here)" : ""}
                    {here && next ? `. ${next.min - result.total} more points to reach ${next.name.split(":")[0]}.` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button className="btn" onClick={() => send({ t: "again" })}>Fly It Again</button>
          <button
            className="btn btn-quiet"
            onClick={onNew}
          >
            New Mission
          </button>
        </div>
      </div>
      <div className="panel" style={{ overflow: "auto" }}>
        <div className="display" style={{ fontSize: 32 }}>Leaderboard</div>
        {!board && <p style={{ color: "var(--text-dim)", marginTop: 12 }}>Loading every crew&apos;s missions.</p>}
        {board?.length === 0 && <p style={{ color: "var(--text-dim)", marginTop: 12 }}>You are the first crew to finish.</p>}
        <ol style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {board?.slice(0, 10).map((e, i) => {
            const mine = e.at === finishedAt && e.crew === (state.crew || "Unnamed Crew");
            return (
              <li key={`${e.crew}-${e.at}`} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 10, fontSize: 18, color: mine ? "var(--accent)" : undefined, fontWeight: mine ? 700 : 400 }}>
                <span>{i + 1}</span>
                <span>{e.crew}{e.go ? "" : " (No Go)"}</span>
                <span>{e.score}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
