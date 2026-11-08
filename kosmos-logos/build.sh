#!/bin/sh
# Rebuild logos.json from the sheet in refs/. Uses the tracing venv that templeos-logos
# already has (pillow numpy scipy opencv-python-headless cairosvg) and potrace.
set -e
cd "$(dirname "$0")"
PY="${KOSMOS_PY:-../templeos-logos/venv/bin/python}"
export DYLD_FALLBACK_LIBRARY_PATH="${DYLD_FALLBACK_LIBRARY_PATH:-/opt/homebrew/lib}"
$PY segment.py
$PY trace.py --force
$PY build.py
