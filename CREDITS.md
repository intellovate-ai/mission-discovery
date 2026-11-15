# Credits

Data, assets and references used in Mission: Discovery.

- NASA, *CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers* (game numbers)
- NASA, *Design and Develop Science Missions* (mission segments, requirements)
- PartyServer and PartySocket (Cloudflare), MIT
- Natural Earth 1:110m Admin 0 countries and land (public domain), via the world-atlas 2.0.2 TopoJSON (ISC, Mike Bostock); converted once to SVG paths and a 1 degree Africa grid in `components/minigames/ground-track-map.ts` (no runtime dependency)
- Fonts via Google Fonts (SIL Open Font License): IM Fell English (Igino Marini) for GROUND TRACK, VT323 (Peter Hull) for DOWNLINK
- GROUND TRACK orbit physics: two-body motion with the standard J2 nodal drift (sun-synchronous tilt computed from it); camera swath and daylight rule are game simplifications
- NASA Earth Observatory, *Blue Marble: Next Generation* (Reto Stöckli, NASA Earth Observatory), fetched at 4096x2048 from NASA GIBS (layer `BlueMarble_NextGeneration`), public domain. File: `public/textures/earth-day-4k.jpg` (Flight Path day side)
- NASA Earth Observatory, *Earth at Night (Black Marble) 2012* (NASA Earth Observatory / NOAA NGDC, Suomi NPP VIIRS), 3600x1800, public domain. File: `public/textures/earth-night-3600.jpg` (Flight Path city lights)
- Title screen opening shot: Earth turning from day to night over India, rendered in three.js from the two NASA textures above (Blue Marble day side, Black Marble city lights) with a sun direction that sweeps across the terminator. No third-party footage. File: `public/video/title-earth.mp4` (title screen) and the first shot of the demo video
- NASA Jet Propulsion Laboratory, *Concept Maturity Levels* (CML), listed in the challenge's resources: the mission report's maturity scale, CML 2 Initial Feasibility through CML 5 Concept Baseline. https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299
- Fonts via Google Fonts (SIL Open Font License): Barlow and Barlow Condensed (interface and demo video)
- Astronaut figure, CubeSat, rocket, gantry and clean room are built from primitives in code (no third-party models)

## Demo Video (`submission/video/`)

- Narration: SI generated voice, Google Cloud Text-to-Speech Chirp 3 HD, voice `en-US-Chirp3-HD-Alnilam` (see `SI-USAGE.md`)
- Music: "Chronos Dream" by ZeroCopyright Music Zone, Creative Commons Attribution (CC BY), https://www.youtube.com/watch?v=bCmzKfxP-4E, credited on the end card
- Sound effect: one cinematic whoosh from Pixabay (Pixabay Content License, no attribution required; credited anyway)
- Picture: gameplay and the title screen captured from the live site, opening on the title screen's day to night Earth shot above
