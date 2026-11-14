import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-xl">
        <h1 className="display text-6xl sm:text-7xl">MISSION: DISCOVERY</h1>
        <p className="mt-3 text-xl text-dim">Design it. Launch it. Find out why.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn" href="/host">Host a Mission</Link>
          <Link className="btn btn-quiet" href="/play">Join a Mission</Link>
        </div>
      </div>
    </main>
  );
}
