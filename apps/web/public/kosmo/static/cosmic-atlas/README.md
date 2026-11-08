# Cosmic Atlas — complete app

## Run locally

Requires Python 3 and a modern browser. No build or package installation is needed.

1. Unzip this archive.
2. Open a terminal in the cosmic-atlas folder.
3. Run: python3 -m http.server 8000 --directory dist
4. Open http://localhost:8000

Serve over HTTP: opening index.html directly as a file will prevent JavaScript module loading.
Three.js and its license are bundled. The app includes a Canvas fallback when WebGL is unavailable.

## Included

- Three.js procedural universe and Milky Way map
- Scriptable probability models and scenario inputs
- Time-window heat maps, expansion fronts, clustering and 12-history ensembles
- Fermi-scenario toggles and dynamics JSON export
- 111 nearby communication targets, comparisons, plots and CSV export
- Radio/laser link budgets, annual operating-cost inputs and travel-time scenarios

## Scientific interpretation

The large-scale map is procedural, not an observed catalog. Life/civilization probabilities and dynamics are conditional assumptions, not detections or calibrated forecasts. Nearby distances use an archived RECONS snapshot with two later brown-dwarf supplements. Assumed ages are labeled. Warp and gates are hypothetical. Link rates are idealized estimates, not verified interstellar performance or error rates. See the in-app model notes and equations for full limitations and source links.

## Source layout

The dist directory contains the editable source and bundled runtime: app.js, temporal.js, neighborhood.js, neighbors-data.js, neighbors.json, index.html, style.css, three.module.js and THREE-LICENSE.txt.

This export matches source revision 4e7a59f3e0751afad4bfa5ea21616afeacf275dc. Hosting credentials, deployment identity and Git metadata are excluded.
