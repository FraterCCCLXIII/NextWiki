# Rocket models (ten Sketchfab GLBs, CC BY 4.0)

Wired through `../spacex/manifest.json` (`vehicles` + `labs.catalog | landing | shipyard`), loaded by `../../vehicle-glb.js`. The `*.glb` originals are untouched; the loader uses the `.web.glb` copy
(`file`) and falls back to the original (`fallbackFiles`), then to the procedural model. Source records (title, author, link): `manifest.json` here. The credit line (title, author, licence, link, "modified: optimised
copy" and a short note) is printed by `attributionHTML` under every view that shows one of these models. Author profile links were not recorded, so only the model page is linked.

Regenerate a web copy (tooling in `~/glb-tools`, see `../spacex/README.md`):

    GLB_TOOLS_DIR=~/glb-tools node apps/web/scripts/optimize-glb.mjs <file>.glb --ratio 1 --tex 1024     # atlas_v.glb also needs --metalrough

All ten were optimised with `--ratio 1` (welded, meshopt-compressed, textures to WebP at most 1024 px; node names kept). No triangles are decimated on purpose; the counts below drop only where the weld removed duplicates/degenerates.

| Model (original) | Catalogue id | Lab use | Original -> web | Triangles | Orientation / scale | Notes and doubts |
|---|---|---|---|---|---|---|
| `apollo__saturn_v_launch_vehicle.glb` (devPilot) | `saturn-v` | catalogue | 8.41 -> 1.45 MB | 106k -> 67k | y up, 88.1 m (1:1) | Ends at the Instrument Unit: **no Apollo CSM / spacecraft-LM adapter / escape tower** (`noFit`, so it is not stretched). Measured after `assemble` (checked numerically, node by node): S-IC 0-42.0 m, interstage 42.0-47.3, S-II (with its J-2s) 43.0-67.9, S-II/S-IVB skirt 67.9-73.4, S-IVB (with its J-2) 68.9-86.8, IU 86.8-88.1: 88.1 m in all and no gap or overlap between consecutive stages (the engines of S-II / S-IVB sit inside the skirts, as on the real stack), against ~85.6 m real for stages + IU (NASA: 363 ft total, 82 ft spacecraft incl. LES) so the file is ~3 % long (probably its 5.5 m S-II/S-IVB skirt piece on top of a full-length S-II); adding a procedural CSM/SLA/LES (~25 m) would give ~116 m, not 110.6, so it was NOT added. The credit note says so. The author left the interstage, S-II/S-IVB skirt and Instrument Unit 20 m beside the stack with ~1 m gaps between the stages; `assemble` moves them back and closes the gaps (interstage / S-II y -1.0, skirt / S-IVB y -2.0, IU y -2.9 m). |
| `geofs_official_space_shuttle_atlantis_ov-104.glb` (AF267) | `space-shuttle-stack` | catalogue | 1.50 -> 0.38 MB | 23k -> 19k | long axis x, nose +x, stack 56.1 m | **Full stack: orbiter + External Tank + two SRBs** (launch configuration), so it replaces the procedural stack. Scaled to 56.1 m overall; the orbiter comes out about 12 % short against the tank and boosters (the author's proportions). |
| `nasa_sls_block_1_crew_v4.glb` (Clarence365) | `sls-block-1` | catalogue | 6.54 -> 1.86 MB | 131k -> 123k | y up, 98 m | Crew version with launch abort system and Orion. Scaled up 6.9 % from the file's 91.65 m. Measured after scaling: core 8.65 m (real 8.4, +3 %), SRB body 4.0 m (real 3.7, +8 %), Orion 5.4 m (5.0), core length 64.2 m (64.6, ok), SRB 54 m (54, ok). Manifest `widthScale: 0.96` squeezes x/z about the axis (core 8.3, SRB 3.84, SRB offset scales too so the boosters stay attached). |
| `atlas_v.glb` (SunnyChen754) | `atlas-v` | catalogue | 3.08 -> 0.41 MB | 108k | y up, 58.3 m | Spec/gloss materials converted to metal/rough (`--metalrough`; current three.js would show them wrong). **Earlier note was wrong: the model has FIVE solid boosters** (mesh clusters: 2 + 2 + 1, each ~20 m; the node is named `AtlasV551`) and a 5.45 m wide fairing, so it is an Atlas V 551, matching the catalogue figures (5.4 m fairing). |
| `esa_ariane_6_64.glb` (Clarence365) | `ariane-6` | catalogue | 5.47 -> 1.37 MB | 134k -> 98k | y up, 63 m | Four boosters: matches the catalogue's A64. |
| `vulcan_centaur_rocket.glb` (Lucas Ko) | `vulcan-centaur` | catalogue | 5.50 -> 0.60 MB | 124k -> 99k | y up, 61.6 m | Six boosters: matches VC6. |
| `new_glenn_better_version.glb` (Wolfpack278) | `new-glenn` | catalogue + Landing Lab `newglenn` | 1.11 -> 0.20 MB | 24k | y up; 98 m stack, booster alone 57 m (lab length) | Stylised, low detail. The author supplies the booster and the upper stage + fairing as two objects side by side; `assemble` stacks them (catalogue). Landing Lab shows the booster only (`firstStage` hides `Sphere_1`). Strakes/flaps are in the merged booster mesh, so the Landing Lab skips its own strakes and flaps for this model (they would double up); the lab still draws its own 4 legs (the real legs fold inside the aft skirt, none are modelled). |
| `n1_rocket.glb` (Soviet Model Magic) | `n1` | catalogue | 9.34 -> 1.31 MB | 135k | y up, 105 m | No pad or gantry in the file. Measured: 105.05 m tall, base cone R 8.1 m (fins reach 20 m), 24 outer + 6 inner engine bells counted at the base, thin escape-tower spike on top: it is the N1-L3 (Moon version) with launch escape tower, as in the catalogue. Block-by-block lengths not checked. |
| `electron_-_rocket_lab.glb` (Stanley Creative) | `electron` | catalogue + Shipyard Electron preset (stage 1) | 3.84 -> 0.51 MB | 53k -> 31k | y up, 18 m; as stage 1 `Electron First Stage` scaled to the lab's tank length with the horizontal size forced to the lab diameter | Textured, metalness 1 in the file = black without an environment; capped at 0.35. The real vehicle is black anyway. Shipyard: only stage 1 is the real model (as for Falcon 9); stage 2 and fairing stay procedural. The stage-1 node also contains an interstage section, so its length/diameter are approximations. |
| `booster_18_b18.glb` (Wolfpack278) | `super-heavy-booster` (new catalogue entry) + Landing Lab `superheavy` | catalogue + Landing Lab | 1.18 -> 0.17 MB | 21k | y up, 71 m, centred on the body (`centerBand`) | Single merged mesh, flat white in the file: given a steel look (metalness 0.7, colour x0.75). Grid fins are baked in (the Landing Lab skips its own grid fins for it; catch pins and the engine plume remain). Block 3 (V3) booster scaled to the lab's 71 m (real Block 3 is 72.3 m, Block 1/2 71 m). The real Booster 18 was scrapped after a cryo-test anomaly on 21 Nov 2025 and never flew; B19 flew first (flight 12, 22 May 2026), so the name is the author's. No legs, as on the real booster. |
| `ares1a.glb` (NASA, Draco, public domain) | `ares-i` | catalogue | 0.39 -> 0.05 MB | 4.7k -> 3.9k | y up, 94 m (9.73 m per unit) | Ares I-A rocket only. Four detached duplicate meshes outside the rotated root are hidden (`hideNodes`). Body ~5.9 m across (real 5.5 m), not corrected. Stage bands (63, 82 m) approximate. The original is Draco-compressed: only the web copy loads in the lab. |
| `jupiter-c.glb` (NASA, Draco, public domain) | `jupiter-c` | catalogue | 0.31 -> 0.10 MB | 8.9k | y up, 21.2 m (1.2137 m per unit) | Rocket only. Base fins, body, nose. Body 1.83 m across (real 1.78). Stage bands approximate. Draco original, as above. |
| `mercury-_redstone_launch_vehicle.glb` (Stanley Creative, CC BY 4.0) | `redstone` | catalogue | 0.93 -> 0.22 MB | 18.4k | y up, 25.4 m (1:1) | Mercury-Redstone: includes the Mercury capsule and launch escape tower. Booster 1.78 m across. Not the NASA Redstone file. |
| `atlas_lv-3b_mercury.glb` (Stanley Creative, CC BY 4.0) | `atlas-lv-3b` | catalogue | 1.68 -> 0.40 MB | 41.5k -> 38.5k | y up, 29 m (0.0741 m per unit) | Mercury-Atlas with capsule and escape tower, two XLR-89 boosters, XLR-105 sustainer. Booster pods are one node (move together in explode). |
| `v-2_rocket.glb` (person, CC BY 4.0) | `v-2` | catalogue | 3.86 -> 0.51 MB | 52.9k | y up, 14 m (13.7 m in file, +2 %) | Untextured, tail fins at the base. Body 1.65 m, matches. Two explode sections, approximate. |
| `energia_rocket_untextured.glb` (Soviet Model Magic, CC BY 4.0) | `energia` | catalogue | 0.16 -> 0.02 MB | 1.3k -> 0.3k | y up, 58.8 m (1.0155 m per unit) | Core with four strap-on boosters and nozzles only: **no Buran, no Polyus**. Core ~7.9 m across. Triangle drop by the weld (1.3k -> 0.3k) not checked on close view; shape checked at distance. |
| `jaxa_epsilon_rocket.glb` (rocket0314, CC BY 4.0) | `epsilon` | catalogue | 1.24 -> 0.21 MB | 17.9k | y up, 24.4 m (5.07 m per unit) | Three sections, nozzle at base. Body ~3.1 m vs catalogue 2.6 m, not corrected. Bands approximate. |
| `pslv_c40.glb` (Neel3Dartist, CC BY 4.0) | `pslv` | catalogue | 2.17 -> 0.30 MB | 10.9k | y up, 44 m (0.1729 m per unit) | XL with six strap-ons (islands, shown as boosters). Core and upper stages one merged mesh: cuts at 20 m and 40 m approximate. `hideNodes` `^Plane001`: a 28-quad lattice 10 m below the base, taken for a launch-pad frame; not confirmed by drawing, removed from view. A thin spike on one strap-on side remains unexplained. |
| `gslv_mk3.glb` (Jainesh Pathak, CC BY 4.0) | `lvm3` | catalogue | 4.49 -> 0.39 MB | 15.9k | y up, 43.5 m (0.0183 m per unit) | GSLV Mk III = LVM3, two S200 boosters (split by island). Core ~4.0 m after `widthScale` 0.87 (file core ~4.6 m). Fairing and core one mesh; bands approximate. |
| `long_march_5_rocket.glb` (andertan, CC BY 4.0) | `long-march-5` | catalogue | 2.89 -> 0.43 MB | 52.9k -> 46.1k | y up, 56.97 m (3.58 m per unit) | Four boosters (merged in file; split by island and corner) and core. Core ~5.4 m (catalogue 5). Core/fairing split at 40 m approximate. |
| `relativity_space_terran_1.glb` (Clarence365, CC BY 4.0) | `terran-1` | catalogue | 1.08 -> 0.22 MB | 23.7k | y up, 33.5 m (3.70 m per unit) | Body in file 2.75 m; `widthScale` 0.82 gives the catalogue 2.25 m (~18 % narrower than the file). Bands approximate. |
| `rocketlab_neutron_rocket.glb` (Clarence365, CC BY 4.0) | `neutron` | catalogue | 1.60 -> 0.26 MB | 33.3k -> 13.3k | y up, 43 m (9.4 m per unit at the body) | Early design: nine engines, cargo fairing. Body ~6.1 m vs catalogue 7 m (not stretched). Triangle drop by the weld not checked. Bands approximate. |
| `firefly_alpha_rocket.glb` (rocket0314, CC BY 4.0) | `firefly-alpha` | catalogue | 3.51 -> 0.52 MB | 49.4k -> 32.6k | y up, 29 m (5.80 m per unit) | Nine engine bells, second stage, fairing. 1.81 m across (catalogue 1.8). Bands approximate. |
| `falcon_9_-_spacex.glb` (Stanley Creative, CC BY 4.0) | `falcon-9-full-thrust` | catalogue | 5.69 -> 0.94 MB | 157.9k -> 147.2k | y up, 70 m (59.3 m in file, +18 % uniform) | Full Thrust with fairing; legs deployed (out beyond the body), grid fins extended. Body ~3.6 m, real 3.66. Not the `falcon-9-v1-0/1` ids (no model there). |

## Exploded view (`explode`, catalogue slider)
Every vehicle here has an optional `explode` block in `../spacex/manifest.json`. `vehicleModel(id, { explode: true })` (only `spacecraft.html` asks for it, through `useGlbModels`; the Shipyard and Landing Lab get the untouched model) turns it into the structure the catalogue's **explode** slider already reads for the procedural models: `userData.stages` (Map stage -> Group, the page lifts stage *n* by *n* x 7 % of the height), `userData.top` (height in metres) and a child Group with `userData.boosters = true` whose children carry `userData.dir = [dx, dz]` (unit vector away from the axis; the page slides them outward by 12 % of the height). Parts are re-parented with `attach()`, so at slider 0 every world transform is unchanged (checked: bounding boxes identical to 1e-7 m, same triangle count unless a cut was made). Engines are not exploded (`engine-*` models have no `stages`; the slider does nothing for them); the page keeps the camera framed on the stack as it opens.

    "explode": {
      "split": ["^Object_4$"],        // optional: merged meshes (regex on the node name) are split into their triangle islands (connected components, vertices welded by position)
      "cut": [38, 66.5],              // optional: planes (m, y of the normalised model) at which tall islands are clipped into sections
      "cutMin": 6,                    // optional: only islands taller than this (m) are cut
      "axis": [0, -0.71],             // optional: where the vehicle's vertical axis is, in metres of the x/z of the normalised model (default 0, 0)
      "parts": [                      // first matching part wins
        { "name": "Left SRB", "booster": true, "nodes": ["^SRBL_1$"] },
        { "name": "LOX tank", "stage": 2, "y": [38, 66.5], "cut": true }
      ]
    }

A part is `stage: n` (bottom to top; numbers are renumbered 0..N-1) or `booster: true` (one booster per distinct `name`). Conditions: `nodes` (regexes on the item's own node name or any ancestor, same space/underscore rule as `hideNodes`), and the item's bounding-box centre in `y`, `x`, `z`, `r` (distance from the axis), each `[lo, hi)` in metres of the normalised model (base at y = 0, centred on the axis). `cut: true` on a part allows an island whose centre falls in it to be clipped at the `cut` planes; the cut pieces are then matched again, so the planes and the `y` ranges of the parts must agree. Items no part claims join the stage whose height range is nearest. Merged meshes are rebuilt as one mesh per part sharing the original material (cut pieces get a two-sided copy of it because the cut leaves them open), cached per vehicle. Names are those GLTFLoader gives: `.` is dropped (`J2.001` is `J2001`) and spaces become `_`.
Development aid: `explodeProbe(id, splitRegexes)` in `vehicle-glb.js` lists every item (name, node path, y range, radius, centre, size, triangles) in the normalised frame, which is how the bands below were chosen.

| Vehicle | How it is split | Stages (bottom to top) and boosters |
|---|---|---|
| `saturn-v` | node names | S-IC (+5 F-1), interstage, S-II (+5 J-2), S-II/S-IVB skirt, S-IVB (+J-2), Instrument Unit |
| `space-shuttle-stack` | node names | External Tank; boosters: left SRB, right SRB and the orbiter (slides away from the tank; `axis` is the tank axis, the stack is not centred on its box) |
| `sls-block-1` | node names | core (+4 RS-25), ICPS (+RL10), Orion stage adapter, Orion (service module, capsule, panels, chutes), launch abort tower; boosters: 2 SRBs |
| `atlas-v` | islands (ten generic `Object_N` meshes) | Common Core Booster (+RD-180), Centaur adapter, payload fairing (y bands); 5 SRBs picked out of the three merged SRB meshes by their x/z position |
| `ariane-6` | node names | core (+Vulcain), upper stage (+Vinci), payload fairing; 4 P120C boosters |
| `vulcan-centaur` | node names + islands | boosters by name (6 GEM 63XL); the core / Centaur / fairing meshes are merged, so their islands are banded by y (core < 35.8 m, Centaur and interstage 35.8-42.1, fairing above) |
| `new-glenn` | node names + y band | first stage (+7 BE-4), booster interstage and grid fins (y > 48 m of the booster node), second stage and fairing (`Sphere_1`) |
| `n1` | islands (44 generic meshes, 1865 islands) + cuts | bands read off the radius profile: Block A < 28 m, Block B 28-50, Block V 50-64, Block G/D, L3 and shroud 64-92, escape tower > 92; tall pipes and rings are cut at those planes. The block boundaries come from the model's diameter steps, not from drawings |
| `electron` | node names | first stage (+9 Rutherford), second stage, fairing |
| `falcon9-block5` (and Shipyard / Landing Lab, unchanged) | node names | first stage (+engines, legs), interstage with grid fins, second stage, fairing |
| `falcon-heavy` | one merged mesh: 176 islands + cuts | boosters: the two side cores (islands with \|x\| > 2.5 m); the centre core is one welded island, cut at 41 m and 52 m into centre core (+ its 9 engines), interstage / second stage, fairing. The cuts are rough (planes read off the silhouette) and leave the sections open |
| `super-heavy-b18` | one merged mesh: 109 islands + cuts | the 33 Raptors (y < 3.2 m), methane tank and engine bay, LOX tank, hot-stage ring and forward dome; boosters: the 4 grid fins (outward). The barrel is one island, cut at 38 m and 66.5 m: the tank boundary is approximate, not from the real tank layout |
| `starship-legs` | 30 generic meshes, banded by y | Raptors + thrust structure + leg feet (y < 7.4 m), tank section with the aft flaps, nose with header tank and forward flaps (y > 37.5 m). The leg struts are inside the big tank mesh, so the legs do not move on their own |
| `ares-i` | islands (one cylinder) + cuts at 63 and 82 m | First stage, upper stage, abort system and Orion (y bands, approximate) |
| `jupiter-c` | y bands | base, body, nose (approximate) |
| `redstone` | node names | booster (+engine, fins); capsule ring + Mercury capsule; escape tower |
| `atlas-lv-3b` | node names | sustainer; capsule and escape tower; booster pods (one group, no sideways slide) |
| `v-2` | node names | tail + fins; body + nose |
| `energia` | node names | core; 4 boosters (one per booster, slide outward) |
| `epsilon` | y bands | three sections (approximate) |
| `pslv` | six strap-on islands + cuts at 20 and 40 m | strap-ons (boosters); core lower, middle, upper (cuts approximate) |
| `lvm3` | two booster islands + cuts at 32 and 40 m | S200 +X and -X; core lower, upper core and fairing, nose (approximate) |
| `long-march-5` | four booster islands + core split at 40 m | four boosters; core; upper stage and fairing |
| `terran-1` | y bands | base, tank, nose (approximate) |
| `neutron` | islands + cuts at 22.4 and 36.8 m | first stage (nine engines), upper stage, cargo fairing (approximate) |
| `firefly-alpha` | y bands | first stage (engines), second stage, fairing |
| `falcon-9-full-thrust` | node names + y band | first stage, engines and legs; interstage and grid fins; second stage and fairing |

Draw calls: nodes keep their own meshes, merged meshes become one mesh per part, so a split model has up to a few times its original mesh count (N1 45 -> 131, Falcon Heavy 1 -> 8, Super Heavy 1 -> 10; the rest unchanged). Building the structure takes a few ms per vehicle (first time, including the island search); nothing is done unless `explode: true` is passed.

## Catalogue entry for the booster
The catalogue `starship` entry is the whole stack, so the booster got its own entry `super-heavy-booster` in `data/vehicles/launch-vehicles.json` (re-sourced from Wikipedia: Block 3 72.3 m, 9 m, 33 Raptor 3, 80.8 MN, 3,650 t propellant; Block 1/2 figures in the notes; `data_quality: draft`; `index.json` rebuilt with `validate.mjs`). Starship (the upper stage) is not touched.

## Loader additions (`../../vehicle-glb.js`)
* Node-name regexes in manifests now match what GLTFLoader produces (spaces become `_`): a pattern written with spaces such as `^Second Stage$` also matches `Second_Stage`. Before this, the Falcon 9 `hideNodes`/`refNode` regexes (with spaces) matched nothing.
* `widthScale` (fixed x/z squash about the vertical axis, used by SLS), `assemble` (move nodes back into place), `centerBand`, `noFit`, `maxMetalness`, `metalness`, `roughness`, `colorScale`, `envMapIntensity`, `note`, `modified`, and `opts.diameter` (see the doc comments). Material repair is done in memory; the files are never edited.
* The catalogue viewer (`spacecraft.html`) now has an image-based environment (RoomEnvironment), reads the tier from the loaded GLB (so a GLB vehicle shows "detailed model") and wraps a long credit line. `vehicle-models.js` had an `else` swallowed by a comment, which made every hand-written spec fall through to the generic model; that is fixed.

## Not verified
* Real-dimension agreement was checked against the catalogue heights only; component-level accuracy (stage lengths, engine counts, N1 variant, Saturn V part placement, B18 vs Block 3 details) was judged by eye.
* Author profile URLs are missing (only the model page link is printed).
* Shipyard Electron stage 1 was inspected from the pad camera through the gantry lattice, not close up.

## Tier B (catalogue wiring, second batch)

Same wiring as above (`../spacex/manifest.json` `vehicles` + `labs.catalog`, credit line from the entry's `note`). Web copies were made with `optimize-glb.mjs` unless noted; the originals are the files without `.web`. Sizes are the web copy. Catalogue heights are the `lengthM` values. Stand-ins are one model for several catalogue ids: the credit line prints the note for every id, so each note names the ids it stands in for.

| Vehicle key (catalogue ids) | Source file (author) | Web size, triangles | lengthM | Hidden / cut | Explode | Doubts |
|---|---|---|---|---|---|---|
| `proton-m` (`proton-m`) | `proton_k_with_zarya_iss_module.glb` (Soviet Model Magic) | 0.63 MB, 147k | 58.2 | none (Zarya payload kept) | 4 bands, split islands at 17.5/36/46 m | Proton-K with Zarya standing in for Proton-M. Boosters are merged into the core mesh, so they cannot be split off. |
| `ariane-5` (`ariane-5`) | `ariane_5_model.glb` (Yanis) | 0.95 MB, 83k (`--ratio 0.25`) | 50.5 | none | SRB A and B by node, core cut at 32 and 42 m | Author says not 100 % accurate. The core and fairing read wider than the real 5.4 m; not corrected. |
| `soyuz-fg` (`soyuz-fg`, `soyuz-u`, `soyuz-2-1a`, `soyuz-2-1b`) | `soyuz-fg.glb` (Paculino) | 0.04 MB, 5k | 49.5 | none | boosters, core, upper stage, fairing (by node) | Stand-in for Soyuz-U (51.1 m), Soyuz-2.1a and 2.1b (46.3 m each); the viewer draws it at their heights. Low detail. |
| `titan-iv` (`titan-iv`) | `titan_iv.glb` (AllThingsSpace) | 0.29 MB, 58k (was 115k) | 44 | web copy cropped: all triangles with centroid x > 0 removed from `Object_2` and `Object_3` (the exploded-view arrangement beside the stack) | two SRMUs (radial band), core, upper and nose bands | Spec-gloss converted to metal-rough. The crop is by the file's x axis, not by a drawing. |
| `h-iia` (`h-iia`, `h-ii`, `h-iib`) | `h-iia_rocket.glb` (MarioK) | 0.19 MB, 22k | 53 | none | SRBs, core, second stage, fairing (by node) | Stylised toy-like model, variant not stated. Stand-in for H-II (49 m, about 7 % shorter drawn) and H-IIB (56.6 m, about 7 % longer). |
| `long-march-2f` (`long-march-2f`) | `long_march_2f_shenjian.glb` (converted by us from the Wikimedia STL, AmethystY98, CC BY-SA 4.0) | 0.04 MB, 3.2k | 58.34 | none | four strap-ons (radius and height), core and nose bands | Simple single mesh, untextured. The four strap-ons are split from the one mesh by radius, so the split is approximate. ShareAlike applies. |
| `safir` (`safir`) | `safir_satellite_launch_vehicle.glb` (JamesMartinCNS) | 0.08 MB, 5k (`--ratio 1`) | 22 | none | two bands (approximate) | File is upside down in its own axes: `noseSign -1` (fins at the base). Accuracy of the real Safir unverified (no description). |
| `sea-dragon` (`sea-dragon`) | `sea_dragon_rocket.glb` (IkaetieIke) | 2.44 MB, 249k (from 471k) | 150 | the author's escape tower (`^crappy`, marked incomplete) | first and second stage by node | Concept, never built. Explode: the stage groups are set up, but the separation was **not** seen in the viewer (not resolved). |
| `vega-c` (`vega-c`) | `vega-c.glb` (SethAlevy) | 0.54 MB, 123k (sloppy simplifier, ratio 0.6) | 35 | none | three approximate bands | Concept CAD inspired by Vega-C, accuracy doubtful. The normal decimator could not reduce it (topology), so the sloppy one was used: some surfaces may be open. |
| `starship-stack` (`starship`) | `starship_stack_merged.glb`, made by us from `super_heavy_rocket_stage_for_starship.glb` (Sharpraptor) and `starship.glb` (Sharpraptor) | 0.21 MB, 47k | 121 | none | booster (stage 0), Starship (stage 1) | **Crude, low detail.** Booster 72.3 m, 9 m across (its barrel is narrower, the author's shell defines 9 m); Starship 48.7 m, body 9 m, flaps about 22 m across. No hot-staging ring or interstage modelled separately. The Super Heavy catalogue entry (`super-heavy-b18`) is unchanged. |

Not wired:
* **Delta II** (`delta-ii`, Sol, 580 faces): the silhouette lies horizontally and reads as a boat or wing, not a Delta II. Removed.
* **Saturn IB** (`saturn-ib`, johnnokomis): a photogrammetry scan of the launch pad with terrain and buildings; the rocket is a small spike inside it. Not separable cleanly. Removed (and Saturn I was not mapped to it).

Merged-file build (Starship stack): `scratchpad/wireB/build-starship.cjs` (outside the repo); the original is `starship_stack_merged.glb` in this folder.
