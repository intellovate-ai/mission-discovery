# Mission: Discovery Design

Copy this file to the repo root on Saturday. Gates from `/unslop`.

## Reference (Gate 1, Phil's pick Fri 2026-11-13)

**https://earth.nullschool.net**: dark cinematic data globe. Measured in the browser, not eyeballed:

| | Measured |
|---|---|
| Ground | `rgb(0, 0, 5)` |
| Text | One color, `#979797`, weight 400 |
| Type sizes on screen | 18/27 and 13/19.5; no letter spacing; no uppercase transforms |
| Visible UI | Two words ("earth", "get the app!"); the menu opens as a panel |
| Panels | `rgba(0, 0, 5, 0.85)` overlay, only when opened |
| Borders | None anywhere |
| Corner radius | 4 to 8 px |
| Hero | The 3D globe with live data fills the screen |

**What we take from it:** the 3D world is the hero; UI is quiet, sparse and dark; panels appear on demand; no borders; small radii; one text color plus a dimmer one.

Other options shown (not chosen): Planet, Kahoot, Jackbox, Teenage Engineering, Windy. Sheet: `reference-directions.jpg`.

## Chosen (Gate 2, Phil's pick: Variant A)

| Token | Value | Use |
|---|---|---|
| `--surface` | `#0A0C10` | Page and panel ground |
| `--panel` | `rgba(10, 12, 16, 0.85)` | On-demand panels over the 3D world (reference pattern) |
| `--text` | `#ECEFF3` | Primary text |
| `--text-dim` | `#979797` | Secondary text (the reference's own gray) |
| `--accent` | `#E12128` | One accent: primary buttons, the room code highlight |
| `--track` | `#23272E` | Empty bar track |
| `--display` | Barlow Condensed 600/700 | Title, room code, callsigns, mini game titles |
| `--body` | Barlow 400/600 | Everything else |

**Functional colors (not decoration, fixed in every scene):**

| Token | Value | Meaning |
|---|---|---|
| `--zenith` | `#D55E00` | Mission Director |
| `--forge` | `#56B4E9` | Spacecraft Engineer |
| `--prism` | `#CC79A7` | Science Lead |
| `--vector` | `#009E73` | Flight Controller |
| `--ok` / `--warn` / `--bad` | `#2BB673` / `#E8A317` / `#E5484D` | Resource bar status, always paired with a label or icon (never color alone) |

Role colors are the Okabe-Ito colorblind-safe set.

Comparison page: `design-variants.html` (screenshot `design-variants.png`).

## Licensed by Design (Not by Reference)

The mini games' own art styles (blueprint, 8-bit, green terminal, vintage map, card table, retro battle, and so on) **are the game's core idea**, Phil's concept: each mini game must look completely different. Inside a mini game only, its listed style is allowed even where the main UI ban list says no (pixel art, terminal type, scanlines). The main UI (lobby, HUD, character select, reports) follows the ban list in full.

## Main UI Rules

- No eyebrows, no pills, no section numbers, no bordered card grids, no gradient surfaces, no glow on UI text, no dashes in copy, no periods on headings.
- Uppercase only for the wordmark, callsigns and mini game titles (proper names in this game); everything else Title Case or sentences.
- HUD sits at the screen edge over the 3D world in `--panel`. Text minimum: 20 px on the big screen (projectors), 15 px on phones. The reference's 13 px is too small for a room.

## Audit (Gate 3)

Not run yet. Saturday: run `audit.js` on the lobby, the HUD over the Clean Room, and a phone controller, at 1280 and 375 wide; license nothing beyond the mini game styles above.
