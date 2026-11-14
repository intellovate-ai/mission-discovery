# Building Mission: Discovery (Hackathon Contract)

Several Claude Code sessions build slices in parallel, each on its own branch. This page is the
contract between them. **Only edit the files your slice owns.** If you need a change in a shared
file, say so in your final report instead of editing it.

## Design sources (read before writing UI)

- `DESIGN.md`: main UI tokens and rules (Phil's picks). CSS variables live in `app/globals.css`.
- Vault notes (same Mac, read-only):
  - `/Users/phillipkaraya/Obsidian Vault/Projects/Space Apps 2026 Game Design.md` (section 0 = summary, section 10 = mini game catalog)
  - `/Users/phillipkaraya/Obsidian Vault/Projects/Space Apps 2026 Words Bible.md` (every on-screen line; use it verbatim)
  - `/Users/phillipkaraya/Obsidian Vault/Projects/Space Apps 2026 Art Bible.md` (figures, scenes, each mini game's palette and font)
  - `/Users/phillipkaraya/Obsidian Vault/Projects/Space Apps 2026 Balance Sheet.md` (numbers; already in `lib/game/data/ember.ts`)

## Shared contract (owned by the main session, do not edit)

| File | What it is |
|---|---|
| `lib/protocol.ts` | Room state, messages, step list |
| `lib/game/data/ember.ts` | Parts, rockets, orbits, objectives (sourced) |
| `lib/game/sim.ts` | `simulate(design, objective)` → bars, checks with feedback lines, science; `score()` |
| `lib/minigames/types.ts` | The mini game kit contract (read the header comment) |
| `lib/minigames/registry.ts` | id → definition |
| `lib/net/useMission.ts` | Live room connection (zustand) |
| `components/scenes/types.ts` | `SceneProps` |
| `party/` | Room server (Cloudflare Durable Objects), deployed at `mission-discovery-rooms.intellovate.workers.dev` |
| `app/host`, `app/play`, `app/page.tsx`, `app/globals.css`, `app/layout.tsx` | Big screen and device shells |

## Slices and the files they own

| Slice | Owns |
|---|---|
| 3D scenes | `components/scenes/CleanRoom.tsx`, `LaunchSite.tsx`, `FlightPath.tsx`, new files under `components/scenes/` (e.g. `Astronaut.tsx`), assets under `public/textures/` |
| Mini games A | `components/minigames/fairing.tsx`, `launch-vehicle.tsx`, `launch-window.tsx`, plus any helper files named `components/minigames/fairing-*.tsx` etc. |
| Mini games B | `components/minigames/ground-track.tsx`, `downlink.tsx` (+ helpers prefixed the same) |
| Team games | `components/minigames/trade-study.tsx`, `design-review.tsx` (+ helpers prefixed the same) |
| Main session | everything else |

A mini game file default-exports a `MinigameDef` (see a stub for the shape). Keep `id`, `title`,
`subtitle`, `howTo`, `owner` as they are unless the Words Bible says otherwise.

## How to test your slice without the full game

```bash
pnpm install
pnpm dev -p <a free port>
```

- `/dev?mg=fairing` shows your mini game in **play** mode (phone frame) and **watch** mode (big
  screen) side by side, wired through a fake `sendLive`, with a sample design from the Balance Sheet.
- `/dev?scene=cleanroom` (or `launch`, `flight`) shows a 3D scene full screen.

## House rules

- Before you finish: `npx tsc --noEmit` and `pnpm lint` must pass. Do **not** run `next build`
  (memory-heavy; the main session builds). If you must, prefix it with `heavy`.
- No new dependencies without saying why in your report; prefer what is installed (three, R3F,
  drei, postprocessing, zustand, Tailwind). Pin exact versions if you add one.
- No dashes in on-screen copy. Title Case for buttons and labels. Copy comes from the Words Bible.
- Mini games: **watch mode must draw only from `live`** (or `team` for team games) so the big
  screen mirrors the owner. Must work by touch on a phone (390 wide) and look right at 16:9.
- Any SI-generated asset (image, audio) needs a visible "SI generated" watermark and a row in
  `SI-USAGE.md` (you may append a row there). Prefer real NASA data or CC0 assets; credit them in
  `CREDITS.md` (append).
- Commit on your branch with a clear message ending in
  `Co-Authored-By: Claude <noreply@anthropic.com>`. Never push to `main`; never force-push.
