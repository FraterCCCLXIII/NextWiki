# Micro Ascent — spacecraft concept explorer

Complete static HTML / JavaScript / Three.js project, exported from commit
095c0eeb896c4d192281b23bc6e7acd72aaf8e84.

## Run locally

Unzip the project, open a terminal in the micro-ascent folder, then run:

    python3 -m http.server 8000 --directory dist

Open http://localhost:8000 in a modern browser with WebGL enabled.
Do not open index.html directly via file://: the application uses ES modules.
No build step or npm installation is required. Three.js is included locally.
Without WebGL, the app uses its built-in SVG elevation fallback.

## Contents

- dist/index.html — application entry point
- dist/app.js — interactive Three.js scene and model construction
- dist/*-model.js — preliminary physics and sizing calculations
- dist/*-ui.js, dist/hud.js — controls, catalog and HUD
- dist/engines/ — procedural engine catalog and OBJ export
- checks/leg-fin-clearance.mjs — geometric leg/fin clearance check

Optional clearance check (requires Node.js with ES-module support):

    node checks/leg-fin-clearance.mjs

## Included concepts

Reusable rockets, stage hardware and structural interstages; payload and cabin
variants; engine families; orbit-to-orbit spacecraft; rotating habitats;
solar sails; a station cluster; a speculative space elevator; stratospheric
balloons with cabin pods and ring observation decks.

## Important model limits

This is an educational concept explorer, not a flight design or engineering
certification tool. Mass allowances, hardware dimensions, engine models,
aerodynamics, structural connections, docking geometry, recovery systems and
mission calculations contain assumptions and incomplete models. Read the
limitations and source links in each panel. Hardware is not IDSS-certified.
Engine-family models are illustrative, not manufacturing drawings.

Hosting-specific identifiers and Git history are excluded from this portable
archive. Third-party Three.js retains its MIT license notice.
