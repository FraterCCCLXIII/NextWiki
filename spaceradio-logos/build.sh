#!/bin/sh
# Rebuild sheet.html from the source sheets in refs/.  Needs: python venv with pillow numpy scipy opencv-python-headless cairosvg
# (cairosvg only for the IoU report), and potrace (brew install potrace).
set -e
cd "$(dirname "$0")"
PY="${SPACERADIO_PY:-python3}"
export DYLD_FALLBACK_LIBRARY_PATH="${DYLD_FALLBACK_LIBRARY_PATH:-/opt/homebrew/lib}"
$PY segment.py
$PY trace.py --force
$PY build.py
