# Title Screen Earth Shot

Renders `public/video/title-earth.mp4`: Earth over India turning from day to night, from the NASA
Blue Marble (day) and Black Marble (night) textures in `public/textures/`. Deterministic: the page
exposes `renderAt(sweep, drift)` and `shoot.py` screenshots one frame per call.

```bash
cd tools/title-earth
cp ../../node_modules/three/build/three.module.js ../../node_modules/three/build/three.core.js .
cp ../../public/textures/earth-day-4k.jpg ../../public/textures/earth-night-3600.jpg .
O='{camLat:2,camLon:92,dist:1.75,tLat:24,tLon:77,sunLon0:48,sunLon1:-22}'
uv run --with playwright python shoot.py frames site 18 2 12 4 "$O"   # 540 frames
ffmpeg -framerate 30 -i site/f%05d.png -filter_complex "[0]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p" \
  -c:v libx264 -preset slow -crf 24 -movflags +faststart -an title-earth.mp4   # 36 s loop, forward then back
```

`shoot.py` expects Playwright's Chromium headless shell; edit `CHROME` for your machine.
