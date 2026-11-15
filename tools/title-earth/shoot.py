"""Render earth.html deterministically.
stills: python shoot.py stills OUTDIR 'p,d;p,d;...' [json overrides]
frames: python shoot.py frames OUTDIR SECONDS HOLD_IN SWEEP HOLD_OUT [json overrides]
  sweep p runs 0->1 between HOLD_IN and HOLD_IN+SWEEP; drift d runs 0->1 over the whole clip.
"""
import json, mimetypes, pathlib, sys
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
CHROME = "/Users/phillipkaraya/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell"
mode, out = sys.argv[1], pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)


def serve(route):
    name = route.request.url.split("earth.local/")[1].split("?")[0]
    f = HERE / name
    route.fulfill(status=200, body=f.read_bytes(), content_type=mimetypes.guess_type(name)[0] or "application/octet-stream")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"])
    try:
        pg = b.new_page(viewport={"width": 1920, "height": 1080})
        pg.route("http://earth.local/**", serve)
        pg.goto("http://earth.local/earth.html")
        pg.wait_for_function("window.ready === true", timeout=60000)
        overrides = sys.argv[3] if mode == "stills" and len(sys.argv) > 4 else (sys.argv[7] if mode == "frames" and len(sys.argv) > 7 else None)
        if mode == "stills" and len(sys.argv) > 4:
            overrides = sys.argv[4]
        if overrides:
            pg.evaluate(f"Object.assign(window.P, {overrides})")
        canvas = pg.locator("canvas")
        if mode == "stills":
            for i, pair in enumerate(sys.argv[3].split(";")):
                pp, dd = map(float, pair.split(","))
                pg.evaluate(f"renderAt({pp},{dd})")
                pg.screenshot(path=str(out / f"s{i}_{pp}_{dd}.png"), timeout=60000)
        else:
            secs, hin, sweep, hout = map(float, sys.argv[3:7])
            n = round(secs * 30)
            for i in range(n):
                t = i / 30
                pp = min(max((t - hin) / sweep, 0), 1)
                dd = t / secs
                fp = out / f"f{i:05d}.png"
                if fp.exists():
                    continue
                pg.evaluate(f"renderAt({pp},{dd})")
                pg.screenshot(path=str(fp), timeout=60000)
                if i % 60 == 0:
                    print("frame", i, "/", n, flush=True)
    finally:
        b.close()
