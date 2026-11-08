# Centauri attachment and realism pass -- nothing floats, the sail hangs on a hub, the light is the Sun's

The review that started this compared the lab renders with a photoreal render of Tiangong: white modules
with seams and flange rings, handrails and orange cable runs, docking nodes, solar wings on standoff arms,
and every piece of equipment visibly bolted to something. Against that, the Centauri ships had boxes
hovering off their hulls with a dark slit under them, tanks resting on a cylinder along one line, racks
tangent to the skin, a sail whose gimbal rings hung in the air, and flat lighting that hid all of it. This
pass audits every ship in every version (v1-v5) one level below the geometry audit -- at the meshes the
builders draw -- fixes what it found at the cause, adds the mount primitives the station photographs show,
puts the sail mechanism on a real hub and sweeps it against the hull at every quarter of its deployment,
moves the drive radiators out of the exhaust, and relights both viewers.

| What | Where |
|---|---|
| The mesh attachment audit | `centauri-mesh-audit.js` (checks), `centauri-mesh-audit.mjs` (runner: `node centauri-mesh-audit.mjs [ids] [--list]`) |
| New part-level checks | `parts/geometry-audit.js`: `plume-impingement`, `boom-open-end`, `driveRadiatorPanels`, `plumeOf` |
| Mount primitives | `parts/primitives/mesh.js`: `saddleMesh`, `seatedBlock`, `cradledCylinder`, `cradledSphere`, `standoffPlate`, `palletMesh`, `cableTrayMesh`, `dockingPortMesh`, `solarBoomMesh`, `shellPanel`, `onCylinder`, `onFace`, `copvClusterMesh` (rebuilt) |
| Mount context for builders | `parts/centauri-models.js` `mountContextFor` (seat radius, seat rotation, stack direction, parent end shape), `freeAzimuths` |
| Sail hub and rings | `parts/primitives/sail-mesh.js` (bearing housing, trunnions, mast flange; tethered tips) |
| Sail sweep against the hull | `centauri-sail.test.mjs` (k = 0, 0.25, 0.5, 0.75, 1 for every sail class in v1, v2, v4; the drum; the pack) |
| Lighting | `space-lighting.js`, used by `centauri-view.js` and `centauri-robotic.html` |
| Materials | `parts/primitives/materials.js` (panel-line AO, dark glossy cells, silver MLI tanks, radiator ribs, shadow side) |
| Checks | `centauri-geometry-audit.test.mjs` (mesh audit on all 32 ships, plume law, ring seating), `centauri-sail.test.mjs` |
| Renders | `centauri-shots/attach/before/*.jpg`, `centauri-shots/attach/after/*.jpg` (JPEG, 1280 px) |

## 1. The attachment audit

`parts/geometry-audit.js` already asked whether the *parts* fit (interpenetration, rings, mates, floating
parts, scale; CENTAURI-QA.md). The hovering blocks were not parts: they were the racks, tanks, pallets,
rings and brackets each builder draws *inside* a part. `centauri-mesh-audit.js` builds every ship headlessly
(three through `three-node-resolver.mjs`) and asks, of every mesh in every part frame:

| Check | Code | What it asks |
|---|---|---|
| (a) attachment | `fitting-floating` | does the mesh touch the part's analytic body, or a mesh that does (transitively, so a strut on a bracket on the hull is attached)? Contact is tested both ways -- the candidate's vertices and face samples against the anchor, the anchor's surface samples against the candidate's box -- so a blanket box round a gimbal or a crate standing on a beam counts, and the gap is reported |
| (b) visible underside | `underside-gap` | a flat-bottomed box seated on a curved body (its own or its parent's): do the corners of its inner face stand off the skin by more than the slit tolerance (max(3 cm, 1 % of the diameter))? A box tangent along one line fails; a box on a saddle, a cradle or embedded passes (`userData.seated`) |
| (c) extending improperly | `fitting-poke` | does a mesh of one part reach inside the analytic body of another (an antenna through a module, a vent into the next stage, a cradle through the hull), beyond what a mated pair may overlap (0.3 m) or an unmated pair may touch (12 cm)? Open frames (rails, kits, trusses, masts) are not solids |
| (a) mount chain | `part-unseated` | does a non-root part's own drawing come within tolerance of its parent's body? The solver mates the ports; this asks whether the drawn mount reaches what it is mounted on |
| sail hardware | `fitting-floating` (sail) | every piece of the mechanism hangs on the drum or on hardware that does; tips and vanes are held by the film and its tie-lines (`userData.tethered`) |

Tolerances: contact max(2 cm, 0.5 % of the part), slit max(3 cm, 1 % of the diameter). Interior fixtures
(the cutaway's racks, decks and cradles) are audited for attachment and pokes but not for undersides: they
stand on the inner wall on their own standoffs. The human-scale detail layer places on surfaces by
construction and is not re-audited.

Added to the part-level audit:

| Check | Code | What it asks |
|---|---|---|
| plume | `plume-impingement` | nothing of the ship -- any body, any deployable at any fold fraction and roll -- inside the exhaust cone of a drive (from its pusher plate or engine-bay radius, 15 degree half-angle, aft) or a braking stage; and a drive's own radiator panels end before its exit plane |
| booms | `boom-open-end` | a truss or mast whose far port carries nothing ends in nothing (a mast's far end is its sail) |

### Counts

Mesh audit, every ship in every version, as the audit is finally defined (the first cut, vertices only,
reported 1,158 and over-counted face-to-face contact):

| Code | Before | After |
|---|---|---|
| fitting-floating | 488 | 0 |
| underside-gap | 365 | 0 |
| fitting-poke | 20 | 0 |
| part-unseated | 6 | 0 |
| **total** | **879** over 37,371 meshes in 1,009 part frames | **0** over 50,307 meshes in 1,009 frames |

By ship, before: wafer 18, smallsat 12, instrument 14, lander 21, capsule 20, habitat 20, seed 20, colony 22,
habitat-spin 20, seed-spin 20, colony-spin 22, lander-ntr 6, habitat-dfd 4, seed-daedalus 8, colony-pulse 2,
wafer-v4 18, smallsat-v4 14, instrument-v4 14, lander-v4 20, capsule-v4 20, habitat-v4 20, seed-v4 22,
colony-v4 43, habitat-v5 33, seed-v5 39, colony-v5 327, colony-v5-cadre 44, seed-v5-auto 36.

Part-level audit: 0 errors before and after on the existing codes (the three v1 cargo-can warnings stay);
`plume-impingement` found three drives whose radiator panels ran past the exit plane into the plume
(habitat-v5 by 33 m, seed-v5-auto by 13 m, colony-v5 by 51 m -- the panels the user saw the colony's
pusher plate and bells poking through), now 0; `boom-open-end` 0.

## 2. Defects and fixes

Each row: what the audit found, where, why, and the fix at the cause.

| # | Defect | Where | Cause | Fix |
|---|---|---|---|---|
| 1 | External racks hovering 0.15 r off every module with a slit under them | every hull segment (v1-v5) | `hullSegmentMesh` put a box at 1.15 r on two thin rods | pallets (`palletMesh`: longerons, cross beams, ORU boxes, grapple) on saddle feet (`saddleMesh`: a shell sector at the hull radius, cheeks, a flat deck) via `onCylinder`; the floating handrail rods went (the detail pass places real ones with standoffs) |
| 2 | Airlock COPV spheres 0.1 m off the hull, their manifold 1.1 m in the air | airlocks (v1-v4) | spheres placed at 1.05 r, manifold above them | `copvClusterMesh` rebuilt: a common saddle, a cradle cup and two crossed straps per sphere, the manifold between them; two rows of two so the cluster fits inside the equipment lock's length; on the flank that faces away from the stack (`ctx.alongAz`) |
| 3 | Radiator and array root brackets floating off the hardpoint | every deployable | the bracket stood on the hardpoint point; nothing reached the curved skin | a saddle foot cut to the parent's radius (`seatR`) and turned along its axis (`seatRot`) under every bracket; arrays get the full `solarBoomMesh` (saddle, SADA, lattice yoke, trunnion, gimbal, blanket box) |
| 4 | Sail gimbal rings hanging under the drum in the air | every sail ship | two tori below the drum with no housing | a bearing housing on the drum's bottom plate, two trunnions for the inner ring, a mast-root flange: the load path is drawn |
| 5 | Tip masses, vanes and beacons "floating" | every sail ship | they ride the film and lines, which are not meshes | tagged `tethered`; the sweep checks they stay on the rim |
| 5b | The reel ring of every refoldable sail tilted 22 degrees off the hub as the drum paid out | lander, capsule, habitat, seed, colony (v1, v2, v4) | the reel's spin was written to `rotation.y` of a ring already turned by `rotation.x`, which precesses the ring instead of spinning it | spun about its own axis (`rotation.z`); the ring-seating check found it |
| 6 | Hub ring floating over the canister's domed lid | v4 canisters | ring at the dome's apex height | a boss under the ring |
| 7 | Stores pallets tangent to the module; fab-bay drums and crates hovering | stores modules, v5 fab bay | boxes and cylinders at 1.03-1.05 r | pallets and `cradledCylinder` (saddle, cradle blocks cut to the tank, strap bands, stub), at azimuths clear of the module's radial ports (`freeAzimuths`) |
| 8 | Compute racks: body corners outside the mount, fins floating | all v5 | box wider than its mount cylinder, fins spaced off the back | saddle foot turned to the module's axis; a spine the fins hang on |
| 9 | Hangar cradle frames outside the hull (back plates, clamps, chargers), robots' cradles drawn along the hangar axis | all v5 | frame offsets pointed outward; frame not turned onto the port axis | the frame stands along the cradle port's axis (radially inward, as the robot does), its hardware inboard of the skin |
| 10 | Garage doors and magazine doors as flat boxes tangent to round hulls | v5 hangar, v3/v5 drives | `box` at 1.02 r | `shellPanel` sectors at the skin, framed, with hinge bars on brackets |
| 11 | Rail heads, cryocooler and its radiator, robot lock, scout rack with gaps or floating parts | v5 | tangent boxes, a radiator on a single rod | `seatedBlock`, `standoffPlate` (four feet each reaching the curved skin), saddle feet, hinge rods |
| 12 | Tank vents on mating faces poking into the next stage | trim stages (v4) | vent on the top dome | vent on the barrel flank, P-clamps on the feed line |
| 13 | Magsail coil floating off the stage | v4 stages that stop | a torus at 1.15 r | eight standoff struts |
| 14 | Adapter ring 0.5 m clear of the despun hub | colony-v4 | a 10 m ring on a 10 m hub with rounded ends: only the 6.2 m flat face is there to stand on | the cone starts at the flat (`ctx.parentEnd`, `parentD`); rounded modules now close their ends with a mating disc |
| 15 | Ring spoke feet and spokes through the reactors on the hub, and through the stage behind the bearing | colony v1-v5, seed-v4 | 2.4 m foot flares and 1.5 m spokes in the ring plane | foot flare within the collar's width, spokes at most 1.1 m, collar no longer than a bearing (1.5 m) |
| 16 | Lander A-frames rooted inside the lander's tanks; the lander's hatch above its envelope, inside the drive | v1 lander, lander-ntr | legs at 0.16 span; hatch at 1.16 L | legs root on the lander's octagon (`ctx.parentD`); body within 0.98 L; the audit's lander body is the octagon (d / 2.7) |
| 17 | Cable runs through berths and into the next part | v1-v3 modules, systems modules | the raceway ran the hull's length at a fixed azimuth, and its cables were not centred | `cableTrayMesh` (channel, three bundles -- the outer two orange -- clamps) at an azimuth clear of radial ports, centred |
| 18 | Spin bearing's outer race floating round its drum | every bearing | ring at 0.95 r round a 0.55 r drum | a web and end flanges |
| 19 | Reactor radiator wings on a thin rod | reactors | pipes only | a drum and transverse beam |
| 20 | Drive radiator panels 13-51 m past the exit plane, into the plume, through the pusher plate | habitat-v5, seed-v5-auto, colony-v5 | panel length recomputed after the width clamp without re-clamping to the store | `driveRadiatorPanels` (shared by the drawing and the audit): panels no longer than 0.46 of the store and no wider than 1.8 store radii; eight panels at the 0/90/180/270 stations when four cannot carry the area (clear of the 45 degree rails and their crawlers); a manifold rod and three struts per panel; the shortfall is reported |
| 21 | Engine bells drawn at full size past the bay | v3 drives | a scale was computed but never applied | bells scaled into the bay |

No pinned number moved: every fix is drawing, and `parts/fleet-recuts.js` is unchanged.

## 3. Sail mechanics and rings

What was wrong (beyond CENTAURI-SAIL.md's own list): the gimbal's two rings hung under the drum with no
housing, the inner ring had no trunnions, nothing joined the gimbal to the mast root; a canister's hub ring
sat at a dome's apex; nothing checked the mechanism against the hull it is mounted on at any k.

Now: the drum's bottom plate carries a bearing housing (0.62 r drum, 0.12 r tall), the outer gimbal ring
seats on it, the inner ring turns on two trunnions, a flange below closes the load path to the mast
hardpoint. The headless check (`centauri-geometry-audit.test.mjs`) reads every torus in the mechanism of
every sail ship: concentric with the thrust axis within 1 % of its radius and perpendicular to it within
0.5 degrees beyond the gimbal's own 0.02 rad trim deflection at k = 1.

The sweep (`centauri-sail.test.mjs`): for every sail class in v1, v2 and v4, at k = 0, 0.25, 0.5, 0.75 and 1,
no film panel vertex, tip or line end is inside any hull body (the canister and mast carry the drum and are
exempt), the drum is clear of the hull, and the true film's pack fits its drum (`pack.fits`: the canister law
gives 8x the film volume, the fold 6x). The drawn-scale mechanism is swept (the true film wraps its drum
thousands of times), in the sail node's world frame; the drum is true size. Together with the existing checks
(monotone extension, fold closure, no self-intersection, every wrapped panel inside the drum, tie-lines taut
at k = 1, retraction returning to the stowed geometry) that is the "monotone and collision-free at every
quarter" the brief asked for. The lab's Mechanism bar is unchanged and was exercised in the browser.

Stowed state: unchanged from CENTAURI-SAIL.md -- the drum is the v4 canister primitive sized from film mass
and packing (`sailCanisterSpec`), the wound bundle fills it, the doors are its wall.

## 4. Tiangong-inspired primitives

All in `parts/primitives/mesh.js`, all built in a surface frame (+y the outward normal, x across the hull, z
along its axis) and posed by `onCylinder(obj, r, theta, y)` on a body of revolution or `onFace` on a flat:

| Primitive | What it is | Used on |
|---|---|---|
| `saddleMesh` | a shell sector at the hull radius with cheeks and a flat deck (`userData.top`); a plate on a flat face | under every seated block, rack, tank, pallet foot and deployable root |
| `seatedBlock` | a box on a saddle with corner bolts and a cable stub | rail heads, cryocooler |
| `cradledCylinder` | saddle, two cradle blocks cut to the tank, strap bands, stub, the tank with domes | fab-bay feedstock drums |
| `cradledSphere`, `copvClusterMesh` | saddle, cradle cup, crossed straps, manifold | airlock gas tanks |
| `standoffPlate` | a plate on four feet, each its own length to the curved skin | vault radiator |
| `palletMesh` | ExPRESS-class frame on saddle feet with ORU boxes, handles, a grapple fixture | every module's external equipment, stores pallets, fab-bay spares |
| `cableTrayMesh` | channel on clips, three bundles (orange outers), clamps | every module and node |
| `dockingPortMesh` | IDSS-class tunnel, hard-capture ring with hooks, three petals, soft-capture ring on struts, target | PMAs |
| `solarBoomMesh` | saddle, SADA, lattice yoke, trunnion, beta gimbal, blanket box | every solar array root |
| `shellPanel` | a conformal shell sector in any skin | body-mounted radiators, magazine and garage doors |
| `hullSegmentMesh` | now also flange rings at the 1.6 m bay joints and a flat mating disc on rounded ends | every module |

Modules therefore attach through the same ports and carry the same mounts whatever version they are in;
a pallet drawn on a v1 lab is the pallet drawn on a v5 hangar.

## 5. Shading

`space-lighting.js` replaces the room environment and the hand-placed lights in both viewers:

- a procedural sky run through PMREM: a Sun disc with a corona high to one side, an Earth limb below with a
  thin blue atmosphere, a faint grey ceiling so upward faces are not black in reflections;
- a key light from the Sun's direction casting PCF-soft shadow maps (2048, bias and normal bias scaled to the
  ship's span so a 1 cm wafer and a 500 m ship both self-shadow without acne), an Earth-blue fill from below,
  a rim from behind, an inverted hemisphere light (black sky, blue ground);
- ACES filmic tone mapping at exposure 1.0, sRGB output;
- every mesh casts and receives (`enableShadows`), the film and transparent glazing receive only; every
  material casts from its back faces (`shadowSide = BackSide`) so a closed double-sided hull does not shadow
  its own skin; the ground disc receives contact shadows.

Materials: the white paint's panel lines now carry an ambient-occlusion shoulder either side of a sharper
groove (height step for the normal map, matte roughness in the groove); solar cells are near-black blue with a
diagonal sheen, three bus bars per cell and a lighter grid, metalness 0.6 / roughness 0.22; tanks wear silver
MLI (the gold painter with an aluminised base); radiators show raised flow tubes with a shadowed groove, a
header manifold and a bonded edge seam, and the drive panels repeat the tile at a 3 m pitch so a 90 m panel
reads as a radiator rather than a slab. The render-mode switch is untouched: `studio` is these materials,
`livery` paints over them, the rest swap them out and back.

## 6. Visual review

`centauri-shots/attach/before/` and `after/`: overview, close and the new low view (`setView('low')`: the eye
just off the skin, looking along the hull across its mounts, on the aft side of a sail ship so it never looks
down through the film) for habitat-v4, seed-v4, colony-v4, lander-v4, instrument-v4, capsule-v4 and the v1
habitat; overview, hangar, low and drive for habitat-v5 and colony-v5. The after renders show the pallets
seated on their saddles with shadows under them, the cable trays, the cradled tanks, the colony's eight drive
radiators ending before its pusher plate, and the sail rings on their housing.

## 7. Open items

- The drive radiator shortfall: when eight panels of 0.46 store-length x 1.8 store-radii cannot carry the
  law's area, `driveRadiatorPanels().shortfall` says how much is uncarried; no current ship has a shortfall,
  but a future hull could, and the honest fix would be a radiator boom part, not a longer panel.
- The plume half-angle (15 degrees) and the pusher-plate cone are stated numbers, not a plume model; the
  check is clearance, not heating.
- The sail sweep uses the drawn-scale film (3 hull spans) against the hull; a true-size film is far larger
  and farther from the hull, so the drawn case is the conservative one, but it is not the true geometry.
- The lab's `low` view on the v5 page frames the fab bay's flank from the overview direction, not a true
  grazing shot; the lab page's is the grazing one.
- Interior fixtures (cutaway racks, cradles, decks) are checked for attachment and pokes but not for the
  slit under a flat back plate on the inner wall.
- Livery rule change: a `checkerBand` now needs two rows of cells rather than three (a 10 m can with 3.9 m
  cells has two), so the v1 habitat's cargo can wears its band again now that the tangent rack boxes that
  used to carry it are pallets.
- Not verified: the sail Mechanism bar was played in the browser on habitat-v4 and the readout updated, but
  the full per-k screenshot sweep of CENTAURI-SAIL.md was not re-rendered (disk).
