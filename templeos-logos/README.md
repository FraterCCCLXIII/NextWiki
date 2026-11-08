# TempleOS logos

The TempleOS brand in the logo reel (`apps/web/public/logo-reel`). One sheet of nine logos
on white is cut into crops, every crop is redrawn as layered vector paths, and
`tools/build-logo-reel.mjs` compiles `logos.json` into `apps/web/public/logo-reel/templeos-reel.js`.

## Tools

- `potrace` (`brew install potrace`) does the curve fitting
- `segment.py` cuts `refs/<sheet>.png|webp|jpg` on a 3x3 grid into `.cache/crops/`
- `trace.py` is the SpaceRadio tracer (same method): Lab colour clustering, one potrace path
  per colour piece, straight sides snapped to exact polygons and round ones to ellipses, and
  wordmark letters tagged with their row so a reveal can run them in turn
- `build.py` writes `logos.json` (the reel's vector data) and `sheet-numbers.json` (per-logo report)

## Rebuild

```sh
templeos-logos/build.sh          # segment -> trace -> build
node tools/build-logo-reel.mjs   # regenerate spaceradio-reel.js, modern-telepathy-reel.js, templeos-reel.js
```

The venv, once:

```sh
python3 -m venv templeos-logos/venv
templeos-logos/venv/bin/pip install pillow numpy scipy opencv-python-headless cairosvg
```

`TEMPLEOS_PY` picks another interpreter. The crop order is the sheet's reading order, so logo
number 1 is the top left logo. Animations come from the shared reveal planner
(`plan()` in `spaceradio-logos/sheet.template.html`), which picks a different reveal per logo
from the shape of its parts; jingles come from the loader's ambient set, one per logo,
assigned by `assignSounds()` in the reel.
