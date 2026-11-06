# Real SpaceX models for the flight labs

The labs work with no files here: every vehicle has a procedural model. Drop a `.glb` next to `manifest.json` and the labs use it automatically
(Shipyard and Landing Lab for the Falcon 9 booster, the catalogue viewer `spacecraft.html` for Falcon 9 / Falcon Heavy / Starship HLS). If a file is missing or fails to
load, the procedural model is used. Code: `../../vehicle-glb.js`; mapping and attribution: `manifest.json`.

## Files in this folder
| File | Model | Source | Faces / size |
|---|---|---|---|
| `spacex_falcon_9_block_5.glb` | SpaceX Falcon 9 Block 5 | https://sketchfab.com/3d-models/spacex-falcon-9-block-5-61067a8b341c4b4b96053d5fa607f232 | 28.5k unique faces, 4.65 MB |
| `spacex_falcon_9_block_5.web.glb` | same, meshopt + WebP textures, node names kept | | 0.88 MB |
| `spacex_falcon_heavy.glb` / `.web.glb` | SpaceX Falcon Heavy (merged mesh, legs baked in stowed) | https://sketchfab.com/3d-models/spacex-falcon-heavy-2f11453207944cedba00e2c6c1aa1269 | 25.6k faces, 1.61 MB -> 0.34 MB |
| `spacex_starship-with_landing_legs_deployed.glb` / `.web.glb` | Starship (old design, 52 m, legs deployed, merged) | https://sketchfab.com/3d-models/spacex-starship-with-landing-legs-deployed-168d98f7b4d747f88d301050ae645560 | 343k -> 51k faces, 28.6 MB -> 0.23 MB |

The loader tries `file` (the `.web.glb`) first and then `fallbackFiles` (the original). Never edit the originals; regenerate the web copies:

    mkdir -p ~/glb-tools && cd ~/glb-tools && npm init -y && npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
    GLB_TOOLS_DIR=~/glb-tools node apps/web/scripts/optimize-glb.mjs spacex_falcon_9_block_5.glb --ratio 1 --tex 2048
    GLB_TOOLS_DIR=~/glb-tools node apps/web/scripts/optimize-glb.mjs spacex_starship-with_landing_legs_deployed.glb --soup --ratio 0.15 --error 0.02

`--soup` is for flat-shaded exports (no shared vertices); the simplifier cannot collapse those otherwise. `--ratio 1` keeps all triangles (use it where node names matter: the
Falcon 9 model's leg and grid-fin nodes are found by name).

## How each model is used
* **Falcon 9 Block 5** (`falcon9-block5`): modes `tank` (Shipyard: first-stage tank, engines and octaweb), `firstStage` (Landing Lab, with the interstage), `full` (catalogue, 70 m). The model's own
  legs (`Landing Leg*`) and grid fins (`Grid Fin Curve`) are removed and the lab's animated legs and fins are drawn instead, so nothing doubles up. Legs: 4, stowed -> deployed, 18 m span.
* **Falcon Heavy**: one merged mesh, legs baked in stowed, no animation: catalogue display only. Its exploded view (see below) splits the mesh into triangle islands and cuts the welded centre core.
* **Starship legs deployed**: one merged mesh with deployed legs; mapped to the catalogue's "Starship HLS" (a legged lander). Current Earth-return Starship and Super Heavy have no legs (see `../SPACEX_GEAR.md`);
  do not use it for a catch.

## Exploded view (`explode`)
The catalogue's **explode** slider works for every vehicle in this manifest that has an optional `explode` block (Falcon 9, Falcon Heavy, Starship legs and the ten rocket models). The block lists `parts` (`stage: n` bottom to top, or `booster: true`, each matched by node-name regexes and/or by the bounding-box centre in metres of the normalised model), plus optional `split` (split merged meshes into triangle islands), `cut` planes and `axis`. `vehicleModel(id, { explode: true })` turns it into `userData.stages` / `userData.top` / a `boosters` group (the same structure the procedural models in `vehicle-models.js` have) and does nothing unless asked: the Shipyard and Landing Lab call `vehicleModel` without `explode`. Format, per-vehicle stage lists and doubts: `../rockets/README.md` ("Exploded view"). Falcon 9 stages: first stage with engines and legs, interstage with grid fins, second stage, fairing; Falcon Heavy: two side-core boosters plus centre core / interstage and second stage / fairing; Starship: engines and feet, tank section, nose.

## Rocket models
Ten more models (Saturn V, Shuttle stack, SLS, Atlas V, Ariane 6, Vulcan, New Glenn, N1, Electron, Super Heavy B18) live in `../rockets/` and are wired through this same `manifest.json`: see `../rockets/README.md` for sizes, mapping and doubts.

The Starship (legs) model rendered very dark because its materials were metallic with no environment: the loader now caps its metalness (`maxMetalness`) and the catalogue viewer has an environment, and the catalogue tier shows "detailed model" for any vehicle with a loaded GLB.

## Adding another model
1. Put `name.glb` here. 2. Add an entry under `vehicles` in `manifest.json`: `file`, `axis` (the model's long axis after loading: `y`, `x` or `z`), `noseSign`, `lengthM`, `diameterM`, `modes` (`hideNodes` = regexes on node names to drop, `refNode`
to scale by a sub-part), `gear` (named groups of nodes the lab animates itself, e.g. `legs`, `gridFins`) and the attribution fields. 3. Optionally add an `explode` block (see above). 4. Map it under `labs.landing` (Landing Lab vehicle id), `labs.shipyard` or `labs.catalog` (catalogue id).

## Collection map (Sketchfab "spacex" by sunnychen753, 23 models, all by AllThingsSpace)
Recommended (downloaded): Falcon 9 Block 5 for current boosters, Falcon Heavy, "SpaceX Starship-With landing legs deployed".

| Name | uid | Faces | Use |
|---|---|---|---|
| SpaceX Falcon 9 Block 5 | 61067a8b341c4b4b96053d5fa607f232 | 28,554 | `falcon9-block5` (in use) |
| SpaceX Falcon Heavy | 2f11453207944cedba00e2c6c1aa1269 | 25,568 | `falcon-heavy` (in use) |
| SpaceX Starship-With landing legs deployed | 168d98f7b4d747f88d301050ae645560 | 343,416 | `starship-legs` (in use) |
| SpaceX Falcon 9 Block 1.2 (Full Thrust) | 29de02d5e97a4b29b5f025e7c5aff326 | 157,892 | older booster, optional |
| Falcon 9 | 75870dfaba5d4e3ea513563522951a40 | 157,892 | same mesh class |
| SpaceX Falcon 9 Block 4 | 07b472ff63ac4dfba84cfe5a03cd5969 | 117,775 | optional |
| SpaceX Starship (4 versions) | d4204f8cf2ad499fb062a80cc4b1e13e (329,592), 67ebe2e0eb4848768e71a4c582f95877 (116,163), 2d5f55029fa94cb1a8dd00c09e12b493 (530,380, NOT downloadable) | | ship without legs candidates (67ebe2e0 is the lightest) |
| SpaceX Starship Cargo (x3) | 3336a64acaa9420a8999e3b87a5a9754, 0c0b3a7708d04ee995e304f899d7b52b, 55a881ae224a45518523a945e56be197 | 69,018 | |
| SpaceX BFR (x2) | 1cdf3d7b17ac4939af684007978b613b, a9e92cc5f35b4cd2b49dc4f93c81754f | 166,920 | 2017 design |
| SpaceX BFR Crew / With Booster / Full Stack | d9d876062cdc4f7bbda1852ab2eaac4b (48,242), 570331c756b640f3967b0aabce3b575b (258,070), 241487a2f6c5439a9c40fcfe2054f5bc (348,090) | | |
| SpaceX BFR Cargo (x5) | bd0a85bc9c2942a0833ba963f2188809, e0bde1d111a1489ebd1bcc6b4ce071c8, 7c505fd28d464cb7a2fc5034427992e6, 6028ba413a334144aba7d4be736568a8, 6524a6e8af884fbfbbf034b4ae90bfd5 | 22,666 | |
| SpaceX-Wing | 2adb82d1dd9f43978107bbdd1c167c7d | 9,862 | |

Viewer URLs have the form `https://sketchfab.com/3d-models/<slug>-<uid>`.

## Licence (CC BY 4.0)
Author AllThingsSpace (https://sketchfab.com/sunnychen753); licence https://creativecommons.org/licenses/by/4.0/. You may use, modify and redistribute (including the optimised copies) if you
give credit: title, author, licence and a link, and say if you changed it. The labs print that line automatically whenever a GLB model is on screen (from the manifest `title`, `author`, `source`,
`license`). The `.web.glb` files are modified copies (decimated, compressed, nodes removed at load): the credit line covers it; mention "modified" if you republish them elsewhere.
The one non-downloadable Starship model (2d5f55029fa94cb1a8dd00c09e12b493) must not be used.

## Engine library (`engines/`)
Five standalone rocket-engine GLBs (1k textures, as downloaded, all CC BY 4.0 on Sketchfab). Listed under `engines` in `manifest.json` with author, source and licence; credit the author when one is shown.
| File | Model | Author | Faces |
|---|---|---|---|
| merlin_1d_vacuum.glb | Merlin 1D Vacuum | MartianDays | 13,422 |
| raptor.glb | Raptor | MartianDays | 16,667 |
| merlin_engine.glb | Merlin Engine (light) | hoahluke | 3,987 |
| j-2s.glb | J-2S | MartianDays | 48,710 |
| rocket_engine.glb | Rocket Engine (generic) | ~Drift~ | 11,033 |
Placed on the vehicles and shown alone in the catalogue: see "Engines placed" in `../SPACEX_GEAR.md` (code `engineModel` / `engineCluster` in `../../vehicle-glb.js`; catalogue data `../../../data/vehicles/engines.json`).
Skipped on purpose: Raptor-SL (CC BY-NonCommercial), and the 180k-262k-face Merlin 1D / Raptor 3 models (too heavy for the web without decimating).
