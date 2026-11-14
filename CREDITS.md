# Credits

Data, assets and references used in Mission: Discovery.

- NASA, *CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers* (game numbers)
- NASA, *Design and Develop Science Missions* (mission segments, requirements)
- PartyServer and PartySocket (Cloudflare), MIT
- Natural Earth 1:110m Admin 0 countries and land (public domain), via the world-atlas 2.0.2 TopoJSON (ISC, Mike Bostock); converted once to SVG paths and a 1 degree Africa grid in `components/minigames/ground-track-map.ts` (no runtime dependency)
- Fonts via Google Fonts (SIL Open Font License): IM Fell English (Igino Marini) for GROUND TRACK, VT323 (Peter Hull) for DOWNLINK
- GROUND TRACK orbit physics: two-body motion with the standard J2 nodal drift (sun-synchronous tilt computed from it); camera swath and daylight rule are game simplifications
