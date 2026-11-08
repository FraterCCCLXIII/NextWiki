#!/bin/sh
# Rebuild logos.json from the sheet in refs/. Needs a python venv with
# pillow numpy scipy opencv-python-headless cairosvg, and potrace (brew install potrace).
# Then run `node tools/build-logo-reel.mjs` from the repo root to rebuild the reel.
set -e
cd "$(dirname "$0")"
PY="${TEMPLEOS_PY:-venv/bin/python}"
export DYLD_FALLBACK_LIBRARY_PATH="${DYLD_FALLBACK_LIBRARY_PATH:-/opt/homebrew/lib}"
$PY segment.py
$PY trace.py --force
$PY build.py
