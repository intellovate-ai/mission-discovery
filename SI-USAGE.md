# Use of SI (Super Intelligence / AI)

Space Apps requires every SI-generated asset to be acknowledged. The idea, the game design
decisions and every name choice are the team's (Phillip Karaya). SI helped as follows.

| When | Tool | What it did | Where it shows up |
|---|---|---|---|
| Fri 2026-11-13 | Higgsfield (Nano Banana Pro) | Team logo | Team page photo, watermarked "SI generated" |
| Fri 2026-11-13 | Groq whisper-large-v3 | Transcribed the challenge video | Reference only |
| Fri 2026-11-13 | Claude (Anthropic) | Offered design options and name sets; drafted game numbers from NASA CubeSat 101 and "Design and Develop Science Missions" (each value tagged with its source); drafted on-screen text; built a font and color comparison page. The team chose every option | `lib/game/data`, `content/`, `DESIGN.md` |
| Sat 2026-11-14 | Claude Code (Anthropic) | Wrote application code under the team's direction | Throughout the repo; commits are co-authored "Claude" |
| Sun 2026-11-15 | Google Cloud Text-to-Speech, Chirp 3 HD (voice `en-US-Chirp3-HD-Alnilam`) | Spoke the demo video's narration, from a script the team approved | Demo video. Stated on its end card, in the MP4's title, comment and description metadata, and in the submission's Use of SI field |
| Sun 2026-11-15 | Local Whisper model and Groq whisper-large-v3 | Timed the demo video's cuts to the narration | `submission/video/` (reference only, nothing shown on screen) |
| Sun 2026-11-15 | Claude Code (Anthropic) | Built the demo video (HyperFrames composition), the pitch deck and the submission drafts under the team's direction; wrote the three.js code that renders the title screen's day to night Earth shot from NASA Blue Marble and Black Marble data | `submission/`, `public/video/title-earth.mp4` |
| Sun 2026-11-15 | Claude Code (Anthropic) | Playtested the game and drafted the hints, the "Why This Matters" lines and the report's next step tips from the game's existing NASA sourced numbers, under the team's direction. Text only, no generated images | `lib/game/hints.ts`, Hint button on every screen |

SI-generated images or video, if any, carry a visible "SI generated" watermark. The title screen's Earth shot is not generated imagery: it is a rendering of NASA data by code, like the game's other 3D scenes. SI-generated audio (the demo narration) is disclosed in text and in the file's metadata, as Space Apps requires for audio.
