import Link from "next/link";

export default function Home() {
  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000" }}>
      {/* Earth turning from day to night over India, rendered in three.js from NASA Blue Marble and Black Marble (public domain). */}
      <video
        src="/video/title-earth.mp4"
        poster="/video/title-earth.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* Dark scrims (bottom and left) so the title reads while the Earth is still in daylight. */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(0deg, rgba(0,0,3,.8) 0%, rgba(0,0,3,.4) 30%, rgba(0,0,3,0) 55%), linear-gradient(90deg, rgba(0,0,3,.6) 0%, rgba(0,0,3,.3) 40%, rgba(0,0,3,0) 62%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: "clamp(16px, 5vw, 72px)", bottom: "clamp(24px, 8vh, 96px)", right: 16, maxWidth: 760 }}>
        <h1 className="display" style={{ fontSize: "clamp(48px, 8vw, 104px)", textShadow: "0 2px 18px rgba(0,0,3,.7)" }}>MISSION: DISCOVERY</h1>
        <p style={{ fontSize: "clamp(18px, 2vw, 24px)", marginTop: 10, color: "var(--text)", textShadow: "0 1px 3px rgba(0,0,3,.95), 0 0 14px rgba(0,0,3,.9)" }}>Design it. Launch it. Find out why.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 28 }}>
          <div className="panel">
            <div className="display" style={{ fontSize: 30 }}>Single Player</div>
            <p style={{ color: "var(--text-dim)", marginTop: 6, minHeight: 48 }}>Play all four roles yourself, on this screen.</p>
            <Link className="btn" href="/solo" style={{ display: "inline-block", marginTop: 14 }}>Play Solo</Link>
          </div>
          <div className="panel">
            <div className="display" style={{ fontSize: 30 }}>Multiplayer</div>
            <p style={{ color: "var(--text-dim)", marginTop: 6, minHeight: 48 }}>One big screen. Up to 4 crew join on their phones with a code.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <Link className="btn" href="/host">Host a Mission</Link>
              <Link className="btn btn-quiet" href="/play">Join a Mission</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
