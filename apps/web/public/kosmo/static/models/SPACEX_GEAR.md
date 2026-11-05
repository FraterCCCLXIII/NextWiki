# SpaceX landing gear: what the labs model, and the sources

Audit done for the Shipyard (`craftModel`), the Landing Lab 3D view (`view3d.js`), the catalogue viewer (`vehicle-models.js`) and the Landing Lab vehicles in `landing-sim.js`.
Confidence: "sourced" = stated in the cited page; "common knowledge" = widely documented but not stated in the page I could fetch (check before quoting).

| Vehicle | Real landing gear | In the labs now |
|---|---|---|
| Falcon 9 first stage | 4 deployable legs, carbon fibre / aluminium honeycomb, stowed folded along the side of the stage during ascent, swung down and out for landing; 18 m (60 ft) wide span; 4 titanium lattice grid fins in an X layout, stowed on ascent, deployed on re-entry. | 4 legs at 45 degrees between the fins, hinged ~4.8 m above the nozzle plane (Landing Lab) / 0.117 x stage length (Shipyard). Stowed folded UP the body (foot end high), they swing down and out over ~3 s of sim time to a foot radius of 9 m (Landing Lab, `legRadius` 9) = 2.45 body diameters (Shipyard), landing pads flat on the ground. 4 grid fins. Expendable first stages (preset `f9exp`) get no legs and no fins. |
| Falcon Heavy side boosters | Each is a Falcon 9 first stage with its own 4 legs and 4 grid fins plus a nose cone instead of the interstage. | Not a lab vehicle. The catalogue viewer shows the real model (stowed legs baked into the mesh) when the GLB is present, else the procedural stack. |
| Falcon Heavy centre core | Also has 4 legs and 4 grid fins when recovered (2018 and 2019 flights; lost both times); expended on flights 4 to 14, then without legs and fins. | Same, catalogue only. |
| Dragon (Crew / Cargo) | No landing legs. Parachute splashdown in the ocean. A propulsive landing on SuperDracos with legs was planned for Dragon 2, then cancelled; SuperDracos are now only an abort backup. | Capsules in the Shipyard (`landing.mode: 'chute'`) have no legs or fins: correct. |
| Starship (ship, current) | No landing legs on the Earth-return ship; it is designed to be caught by the tower arms. 4 flaps (2 forward, 2 aft). Early prototypes (Starhopper, SN5 to SN15) had legs; the HLS lunar variant has landing legs. | Not a lab vehicle. The catalogue entry "Starship HLS" uses the legged model. Leg counts of the prototypes (I recall 3 on SN5/6 and 6 on SN8 to SN15) are NOT sourced, so they are not modelled. |
| Super Heavy | No landing legs (they were "undesigned" in favour of catching). Caught by the launch tower's two arms ("chopsticks") on two catch pins/hardpoints, and the grid fins double as lift and catch points. 33 Raptors, 9 m diameter, 71 m (Block 1/2) or 72.3 m (Block 3). Grid fins: 4 on Block 1/2, 3 larger fixed ones on Block 3 (two with catch hardpoints). | Landing Lab `superheavy`: `legRadius: 0` so no legs are built; 4 grid fins, 2 catch pins at the upper body, tower catch target at 70 m. Block 3's three fins are NOT modelled (the catches so far were Block 1/2, 4 fins). |

## Findings that changed code
1. **Shipyard legs were half size.** `craftModel` put the foot at `2.2 * R0` (radius), i.e. a ~8 m span for a 3.7 m stage, while the Landing Lab and `vehicleFromStage` use 2.2 x *diameter* (radius). It is now 2.45 x diameter (9 m radius for Falcon 9) with the legs built from one rigid length, as on the real vehicle.
2. **Legs were hidden until the landing burn and slid sideways when "deployed".** Real legs are visible on the stowed stage, folded up along the body with the foot end high, and swing down about a low hinge. Both labs now pose the leg by rotating it about the hinge (`legs.userData.update(k)` in the Shipyard; `T3.dep` in `view3d.js`).
3. **Landing Lab Falcon hinge height** is now 4.8 m (leg length ~8.3 m, matching the 18 m span) instead of the generic 16 % of length (6.6 m).
4. `view3d.js` leg count is now data (`veh.legCount`, default 4); New Glenn (not SpaceX) still draws 4.

## Sim values
No physics value was changed. `legRadius: 9` for both Falcon 9 vehicles, `0` for Super Heavy, and 4 m for the lunar lander stay as they were. `vehicleFromStage` still uses `legRadius = 2.2 * D` (8.1 m for a 3.7 m stage, 10 % under the real 9 m); I left it because it feeds touchdown physics.

## Sources
- Falcon 9 first-stage landing tests (4 legs, 18 m span, 4 grid fins in an X, stowed on ascent): https://en.wikipedia.org/wiki/Falcon_9_first-stage_landing_tests
- Legs are carbon fibre with aluminium honeycomb, stowed along the side, deployed after separation: https://www.spaceflightnow.com/falcon9/009/140223legs/
- Falcon 9 (SpaceX): https://www.spacex.com/vehicles/falcon-9/ (the page is script-rendered; I could not extract text from it, so the figures above come from the references)
- Falcon Heavy, four legs and four grid fins per core, side-booster nose cones, centre-core outcomes: https://en.wikipedia.org/wiki/Falcon_Heavy
- Dragon 2, parachute splashdown, propulsive landing cancelled: https://en.wikipedia.org/wiki/SpaceX_Dragon_2
- Super Heavy, tower catch, no legs, three fins with catch hardpoints on Block 3, 33 Raptors: https://en.wikipedia.org/wiki/SpaceX_Super_Heavy
- Super Heavy V3 grid fins reduced from four to three and enlarged 50 %: https://payloadspace.com/spacex-launches-starship-v3-for-the-first-time/
- Super Heavy originally drawn with fixed legs, then changed to catching: https://thespacebucket.com/will-spacexs-starship-have-landing-legs/
- Starship, four flaps, tower catch, HLS legs: https://en.wikipedia.org/wiki/SpaceX_Starship (and https://en.wikipedia.org/wiki/Starship_(spacecraft))

## Not modelled
Falcon grid fins are drawn deployed at all times (the real ones are folded flat until after separation). Starship prototype legs. Block 3 Super Heavy fins.

## Engines placed
Code: `engineModel` / `engineCluster` in `../vehicle-glb.js` (`spacex/manifest.json` `engines` section, files in `spacex/engines/`). Every file is stored Y-up with the nozzle exit at the -y end and units of
centimetres (Raptor 309 units long, 130 across the bell); the loader measures the exit ring from the geometry (lowest 2 % of the height), centres on it, puts the origin at the top
(throat / gimbal) and scales so the exit is `exitDiameterM` wide. Raw sizes (units): Raptor 309 tall / 130 exit, Merlin 1D Vacuum 496 / 288, J-2S 323 / ~201, Merlin light 572 / ~190; the
generic engine is in metres (2.8 tall). A missing or corrupt file returns null and the procedural bells stay.

| Lab engine | Model | Exit diameter used | Where |
|---|---|---|---|
| `merlin-1d` | Merlin (light, hoahluke) | 0.92 m (shrunk to fit the cluster: octaweb ring at 0.66 R, never overlapping) | Shipyard first stage when the Falcon 9 booster GLB is not used (other engine counts/diameters); Landing Lab Falcon vehicles only if their vehicle GLB fails |
| `merlin-vac` | Merlin 1D Vacuum (MartianDays) | 2.4 m (model is then 4.1 m long) | Shipyard, any stage that is the bottom of a craft (e.g. the second stage after separation) |
| `raptor-2` | Raptor (MartianDays) | 1.3 m (about 1.2 m at 9 m diameter x 33, to fit) | Shipyard (any count; exactly 33 = 3 centre / 10 inner / 20 outer rings at 0.17 / 0.46 / 0.88 R); Landing Lab Super Heavy draws its 33-engine cluster (`cluster`), not just the 3 landing engines |
| `j-2` | J-2S (MartianDays) | 2.0 m | Shipyard Saturn V S-II (5) and S-IVB (1) once they are the bottom stage. J-2S is a close cousin of the J-2, used as its stand-in |
| generic-engine | Rocket Engine (~Drift~) | 1.0 m (arbitrary) | not placed on any vehicle; only viewable in the catalogue |

Not changed: the nozzle EXIT plane stays on the procedural exit plane (Shipyard y = -R/2 under the stage, Landing Lab bell centre minus 0.225 R), so plume, leg hinge, ground contact, camera framing
and the sims are identical; the engines hang up into the stage from there, and only the part below the stage's own skin is visible. Falcon 9 booster GLB keeps its own engines. Raptor Vacuum and Starship's
3+3 layout are not modelled (the labs have no Starship stage; a 6-engine Raptor stage gets centre + ring of 5). The Shipyard preset list has no Starship / Super Heavy preset: pick engine Raptor 2, count 33.
Clones share geometry and materials (no instancing); the 33-engine cluster is about 550k triangles, shadows off.

Real figures (Wikipedia, read 2026-11): Merlin 1D 845 kN SL, 282 s, 0.92 m diameter, 470 kg; Merlin 1D Vacuum 981 kN, 348 s (infobox says 311), listed diameter 3.3 m (we use the 2.4 m
exit from the brief because the model's proportions match it); Raptor 2 2,256 kN, 347 s, 3.1 m long, 1,630 kg, the 1.3 m bell exit is the 2018 design figure; J-2S 1,138.5 kN vac, 436 s, 3.38 m long, 2.01 m diameter.
Credits: the on-screen credit line lists every engine author whenever an engine model is shown (Shipyard #glbcredit, Landing Lab credit box, catalogue).

### Catalogue (engines alone)
`spacecraft.html` lists them under "Engines" (`../../data/vehicles/engines.json`, category `engine`; ids `engine-merlin`, `engine-merlin-1d-vacuum`, `engine-raptor`, `engine-j-2s`, `engine-generic`), mapped in
`spacex/manifest.json` `labs.catalog` to the engine ids, scaled by bell exit diameter (not fitted to a height). Specs there are drafts with sources in each entry; `node ../../data/vehicles/validate.mjs` rebuilds `index.json`.
