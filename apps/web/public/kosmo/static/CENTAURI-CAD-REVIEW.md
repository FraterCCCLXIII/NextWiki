# Centauri fleet: CAD review against real spacecraft practice

A space-systems review of the eight catalogue models (`parts/centauri-models.js`) and the assemblies
behind them, written the way a CAD review would be: every finding below is a number computed from
the solved assembly, not an impression. Reproduce the tables with the two scripts in §9.

Scope: what the geometry and the part catalogue are still missing for these to read as real ships,
with the physics that drives each item. Findings are ordered by whether they change the design, not
by how easy they are to draw.

---

## 0. Status: what has since been fixed

Implemented in `parts/parts.js` and `parts/fleet.js`, measured by `centauri-fleet.test.mjs`:

| finding | before | now |
|---|---|---|
| habitat and seed film through the module stack | −24.9 m, −177 m | **+37.4 m, +212.3 m clear**, on a deployable mast |
| habitat and seed centre of pressure off the thrust line | 1.97 m, 1.91 m | **0 m** (arrays and radiators on symmetric mount pairs, docking port aft) |
| colony film bisecting the rotating ring | ring mid-plane, −10 m | **+21.0 m**, on a non-rotating despin hub |
| five classes' film coplanar with the fore face | 0 m | **1.08 m to 10.3 m** of mast |
| sail mounted on a radiator hinge | habitat, seed | axial thrust collar into the CBM stack |
| colony power | 62 kW against a 2.0 MW load | 2.26 MW from two 1.1 MWe reactors, gen > load |
| capsule docking axis occupied by the sail | could not dock or be entered | sail flies as a jettisonable IDSS stage; crew undock at arrival |
| habitat and seed had no docking port | none | PMA (CBM to IDSS) on a node berth |
| wafer | film at the chip | unchanged and correct: hub-mounted, 1 g cannot deploy a mast |

The new hardware is in the catalogue with sources: `thrust-collar`, `despin-hub`, `reactor-1mw`,
`pma`, `sail-stage`, and a derived `mastPart(len)` (1.5 kg deployer + 0.6 kg/m of CFRP lattice).
The mast length is measured, not chosen: 1.15 x the hull's height along the thrust axis, so the film
clears the tallest structure by 15 %.

### v2 spin rings (`CENTAURI-VERSIONS.md`)

| finding | v1 | v2 |
|---|---|---|
| crewed classes had no weight in the living and working quarters | none | 1 g at 4 rpm on a 55.9 m deck radius; 843 m2 / 4,214 m2 / 32,870 m2 for 24 / 110 / 1,000 crew |
| the colony's arrays and radiators hung on the spinning ring | ring mounts 1-4 | **despun hub mounts c-f**: a utility on a rotating ring drags round the sky and cycles its plumbing |
| a ring hung on a non-rotating stack needs a rotating joint | none | `spin-bearing` (1,800 kg roller/magnetic pair with slip rings and rotary unions), fixed side to the node, rotating side to the ring hub |
| the habitat's and seed's berth sat where the bearing goes | PMA on the aft face | PMA on the bearing's despun aft face, on the spin axis: no imbalance to trim, and no rotating joint between the hatch and the cabin |
| radiator inside the array wing | 15.4 x 5.2 x 1.1 m of overlap, both on the same +-x hinge pair | radiators on the node's zenith/nadir pair, wings on +-x, no shared plane |
| array wing 11 m deep | edge booms ran on z while the blanket spans x | booms on the blanket edge; the wing is a flat 11 x 34.7 m panel |
| ring tube | the v1 ring's stated 20 m at 10 kt | sized from the crew: 3.0 m, 7.5 m and 19.5 m tubes, 409 t / 1.55 kt / 9.51 kt of ring |
| deck layout | none | living and working decks alternate; six deck colony ring runs 0.86 g inner to 1.13 g outer |

Still open for v2: a berth on the colony's despun hub (neither colony version has a docking port), the
rotary unions and coolant loop at 757 kW of ring hotel load, and a stress design of the ring and
bearing rather than an areal-mass estimate.

Still open: rim-spar mass, the film's coating stack, tip-vane control authority, harness and fluid
routing, MLI on every part, separation hardware, the seed's spine truss, the colony's deck cutaway.

---

## 1. What the models get right

Stating this first because it bounds the review: the film area is the measured film area (a square
of `sqrt(A)` per class, so the mass and areal density close), the hull is drawn at true size, the
CG is computed rather than assumed, and the beam's shadowing by the hull is negligible:

| Quantity | Worst case | Why it matters |
|---|---|---|
| Hull silhouette / sail area | wafer 2.7 × 10⁻⁵ | the payload never shades a meaningful part of the film, so hub mounting is radiometrically safe |
| Film area vs measured sail | exact by construction | the sail law and the drawing cannot disagree |
| Thrust axis vs sail normal | aligned to 0° (single hinge) | the beam hits the film square-on |

Everything below is what is *not* there.

---

## 2. Computed findings (all eight classes)

`F` is the thrust at rest, `lateral` the CG offset from the film centre in the plane normal to the
thrust axis, `α` the resulting angular acceleration with `I ≈ m L²/12`, `trim` the ballast at the rim
that would cancel it.

| class | mass | sail mass frac | lateral CG | sail plane vs hull | F | torque | α | trim |
|---|---|---|---|---|---|---|---|---|
| wafer | 2 g | 0.50 | 0 m | −1 mm (at the chip) | 105 N | 0 | 0 | 0 |
| smallsat | 25 kg | 0.40 | 0 m | 0 (touching fore face) | 9.16 kN | 0 | 0 | 0 |
| instrument | 250 kg | 0.40 | 0 m | 0 | 3.01 kN | 0 | 0 | 0 |
| lander | 1.62 t | 0.62 | 0 m | 0 | 1.62 kN | 0 | 0 | 0 |
| capsule | 20 t | 0.50 | 0 m | 0 | 10.0 kN | 0 | 0 | 0 |
| habitat | 209 t | 0.48 | **1.97 m** | **−24.9 m (through the module stack)** | 105 kN | **207 kN·m** | 4.4 × 10⁻³ rad/s² | **6.0 t** |
| seed | 2.00 kt | 0.50 | **1.91 m** | **−177 m (through the module stack)** | 670 kN | **1.28 MN·m** | 4.4 × 10⁻⁴ rad/s² | **20.6 t** |
| colony | 20.0 kt | 0.50 | 0 m | **−10 m (bisects the 20 m ring deck)** | 4.01 MN | 0 | 0 | 0 |

The film flux and the reflectivity the film would need to survive it (two-sided radiation at
1000 K is 1.13 × 10⁵ W/m², so the allowable absorptivity is `1.13e5 / flux`):

| class | incident flux W/m² | max absorptivity | absorbed at η = 0.90 | acceleration |
|---|---|---|---|---|
| wafer | 5.97 × 10⁹ | **1.9 × 10⁻⁵** | 5.97 × 10⁸ W/m² | **5 380 g** |
| smallsat | 5.18 × 10⁷ | **2.2 × 10⁻³** | 5.18 × 10⁶ | 37 g |
| instrument | 1.70 × 10⁶ | 0.067 | 1.70 × 10⁵ | 1.2 g |
| lander | 9.20 × 10⁴ | 1.2 | 9.20 × 10³ | 0.10 g |
| capsule | 5.68 × 10⁴ | 2.0 | 5.68 × 10³ | 0.051 g |
| habitat | 5.93 × 10⁴ | 1.9 | 5.93 × 10³ | 0.051 g |
| seed | 3.79 × 10⁴ | 3.0 | 3.79 × 10³ | 0.034 g |
| colony | 2.27 × 10⁴ | 5.0 | 2.27 × 10³ | 0.020 g |

Aperture for 90 % coupling at the end of each boost (standoff 1.5 000 km + boost track), which is
not monotonic in class size — the big sails are easier to hit:

| class | aperture | class | aperture |
|---|---|---|---|
| wafer | 11.6 km | capsule | 386 km |
| smallsat | 16.7 km | habitat | 122 km |
| instrument | 161 km | seed | 57.9 km |
| lander | 611 km | colony | 30.5 km |

Power and heat, straight from `summarize()`:

| class | generation | load | rejection fitted | note |
|---|---|---|---|---|
| capsule | 1.2 kW | 1.5 kW | 2.7 kW | deficit at the source |
| habitat | 62 kW | 0.5 kW | 59 kW | 2 × SAW carry it |
| seed | 62 kW | 0.5 kW | **455 kW** | rejecting 7× what it generates |
| colony | 62 kW | **2.0 MW** | 4.0 MW | **32× generation deficit** |

---

## 3. The sail system: what is missing (P0 — changes the design)

This is the part of the ship that decides whether it flies, and the models currently have a film, a
hub and a single hinge. (Items 1 and 2 below are now fixed — see §0; the rest stand.)

1. **No mast between film and spacecraft.** `sailGap` is 0 m for four classes and *negative* for
   three: the film plane is not ahead of the hull on a standoff, it is coincident with the hull's
   fore face or cutting through the structure. The habitat's film passes 24.9 m behind the front of
   the module stack, the seed's 177 m behind, and the colony's bisects the 20 m ring deck. A real
   assembly has a mast or truss of tens to thousands of metres between the sail hub and the payload,
   with the film clear of every structure. **Fix in `fleet.js`:** add a `mast` part (a boom with a
   sourced areal mass) and mate `mast.fore → sail.hub`, `mast.aft → <hull>.sailmount`.
2. **The sail is mounted on a side port where it should be on the axis.** The habitat and the seed
   mate the sail to `node.mount-1` at (1.9, 4.4, 0) — a radiator hinge, not a sail mount. That is the
   whole of the 1.97 m / 1.91 m CG offset, the 207 kN·m and 1.28 MN·m torques, and the 6.0 t / 20.6 t
   of trim ballast in §2. A laser sail's centre of pressure must sit on the thrust line through the
   CG; no amount of pointing authority fixes a force offset like that.
3. **No rim structure or tensioning.** The catalogue's sail is a bare film at 0.34 g/m². A rim spar
   or boom set is not modelled at all. Illustratively, four booms at 50 g/m along the radius add
   0.194 kg to the wafer (9 680 % of its mass), 19.4 kg to the smallsat (77 %), 61 kg to the
   instrument (25 %), 194 kg to the lander (12 %), 612 kg to the capsule (3 %), and under 1 % for the
   three largest classes. **The "sail mass = payload mass" optimum only holds once the sail is large
   enough to amortise its own structure**; for the wafer and smallsat it is off by an order of
   magnitude. That is a finding about the design, not about the drawing.
4. **No hub, no cut-out, no attachment detail.** The film is drawn continuous through its centre.
   Real sails have a hub ring, a reinforced centre and either a hole or a spider for the payload
   umbilical; the wafer's film is 171 × its 1 cm chip and cannot be attached at a point.
5. **No coating differentiation.** One translucent sheet stands in for a two-sided film: a
   dielectric mirror on the beam face and a high-emissivity back. At the wafer's 5.97 GW/m² the
   allowable absorptivity is 1.9 × 10⁻⁵ — the model's own 0.90 reflectivity would put 5.97 × 10⁸
   W/m² into a 100 nm film and vaporise it. **The photon budget and the thermal budget want different
   numbers**, and the CAD should show the coating stack (SiN/Al on one face, ε ≈ 0.9 on the other).
6. **No tip vanes, no attitude system.** Starshot's baseline controls attitude with reflectivity-
   modulated tip vanes on the film; nothing on the model does. Nor is there a star tracker, sun
   sensor, IMU, reaction wheel, CMG or RCS on any hull except the capsule's eight nozzles. A sail
   craft without tip vanes or thrusters cannot hold the ~microradian incidence the beam demands.
7. **No spin.** Large films are tensioned centrifugally; smaller ones cannot be without a heavy
   spin-up system. Rim speed for 1 % of g at the rim runs from 0.31 m/s (wafer) to 97 m/s (colony) —
   the colony would need 97 m/s at 97 km radius, i.e. a rim latitude problem as well as a mass one.
   The models show no spin axis, no spin-up thrusters and no despin.
8. **No stowage hardware.** The catalogue gives the sail a stowed envelope (0.4 m thick) and the
   model folds to half a side, but there is no canister, lid, ripcord, release nut, tie-down or
   deployment sequencer. Deployment is the highest-risk event on the mission and the CAD shows none
   of the mechanism.
9. **No beam-side hardware.** No retroreflector or beacon on the film, no wavefront sensor, no
   pointing reference. The beam needs something to point at besides a 100 nm sheet.

---

## 4. Structure and mechanism (P0/P1)

- **No primary structure.** No truss, spine, keel or longerons anywhere except the ARRAY's mast.
  The seed's 20 identical lab modules are chained end to end into a ~130 m cantilever with no load
  path to the sail; the colony's ring has six spokes but no pressurised spine to the hub.
- **No separation or launch interface detail.** PAF mating planes are drawn as rings, which is
  right, but there are no clampbands, bolts (the 1 194 mm class is 120 bolts), pyros, separation
  springs, umbilical connectors or connector brackets. `parts.js` has the port *types* and their
  mass ratings but no hardware geometry.
- **No harness, no fluid lines, no waveguides.** Nothing routes power, data, coolant or propellant
  anywhere on any class. This is the single most visible CAD difference between a concept model and
  a real vehicle: real spacecraft are mostly plumbing.
- **No thermal control hardware on most parts.** MLI is drawn as three bands on the module and
  nowhere else; no blankets on tanks or cargo cans, no louvers, no heat pipes, no sun shields for
  instruments, no radiator on the capsule beyond two body panels.
- **No mass properties on the drawing.** No CG marker, no inertia dyad, no principal axes, no
  thrust-axis datum, no coordinate triad, no alignment cube — all of which a real drawing carries
  because the GNC team needs them.
- **No secondary structure.** No brackets, stanchions, cable trays, access panels, EVA handrails
  (except the Columbus module's), worksite interfaces, foot restraints, or mirror/antenna mounts.
- **Nothing is hinged where it should articulate.** Landing gear is static; array and radiator roots
  have one hinge; the capsule's parachute bay, hatch and docking mechanism are solid.

---

## 5. Power, thermal, avionics (P0 for the top of the fleet)

- **The colony cannot power itself**: 2.0 MW of load against 62 kW of arrays (32× short) and no
  reactor, RTG or beamed-power receiver. Adding a reactor block is the missing element that would
  make the class credible.
- **The seed rejects 455 kW on 62 kW of generation** — a thermal architecture that cannot close;
  the radiators are sized from the part's fixed 7.5 kW rating, not from the load.
- **No avionics at all**: no star trackers, sun sensors, IMUs, GPS receivers, deep-space transponders,
  optical comm terminals or high-gain antennas on the habitat, seed, colony or lander. The 100 kg bus
  has a dish and nothing behind it.
- **No battery or power distribution** on any class; arrays are shown without shunt radiators,
  drive motors or battery boxes.

---

## 6. Per-class notes

- **wafer** — 1 cm StarChip against a 1.71 m film (171:1): needs a hub/spider, tip vanes, a laser
  comm terminal, photon-thruster nozzles (the four pads are placeholders) and a coating stack. At
  5 380 g the payload mount is a structural problem in its own right.
- **smallsat** — the 6U cage is credible; missing deployment door detail, separation switches,
  thermal blanket, antenna, star tracker, harness. Structure dominates mass (§3.3).
- **instrument** — no optical bench, baffle, cryocooler or radiator for the focal plane; no
  propellant tank or thruster set; the dish has no feed or gimbal.
- **lander** — legs are static (no stowed pose, no crush cores), engine has no gimbal or plume
  shield, tanks have no plumbing or pressurant, no science deck, no sample handling, no comms.
- **capsule** — **the sail mount occupies the docking axis**, which is exactly where the IDSS port
  and crew hatch belong: the model as assembled can neither dock nor be entered. Also missing: seats
  and displays, launch-abort interface, TPS tiles, parachute bay mechanism, nose cone separation.
- **habitat** — film cuts through the stack and is mounted off-axis (§3.1–3.2); no cupola, no EVA
  hatch, no docking adapters on the node, no windows beyond two per module, no CMGs for the 2 MW
  load's momentum, no storm shelter.
- **seed** — a 130 m straight chain of 20 labs is not a structure; needs a spine truss, a
  counter-rotating pair or a ring, a reactor, and a thermal architecture that closes (§5).
- **colony** — ring, spokes and hub exist; missing are the deck cutaway and compartments, a
  pressurised spine to the hub, docking ports on the hub face (one ring is drawn), a reactor and
  shield, and any agriculture or storage volume.

---

## 7. Fidelity ladder: what "complete CAD" would mean here

1. **Tier 1 — system CAD (what this is now, plus P0 items).** Mast, rim spars, hub, tip vanes,
   coating split, reactor and power architecture, IDSS on the capsule, on-axis sail mounts, harness
   and fluid routing, MLI on every tank and can, CG/inertia datum. Costs mass, so `measure()` changes
   and the fleet table will show more classes failing — which is the honest outcome.
2. **Tier 2 — manufacturing CAD.** Bolted joints, brackets, access panels, connector savers,
   quilting seams, gores and bond lines, tolerance and alignment callouts. Procedural builders
   plateau here; this is where the repo's GLB path (`vehicle-glb.js`, currently with no manifest
   present) would take over with authored meshes.
3. **Tier 3 — analysis CAD.** Inertia tensor, mode shapes, thermal math model nodes, deployment
   kinematics with hinge torques and latch-up, plume impingement. Nothing in this repo is at this
   tier for any vehicle, so it is not a fair bar for the fleet.

---

## 8. Ranked next changes

| # | Change | Why it is first | Where |
|---|---|---|---|
| 1 | On-axis sail mounts for habitat and seed | removes 207 kN·m and 1.28 MN·m of uncompensated torque | `parts/fleet.js` |
| 2 | Mast between hull and film | the film currently intersects the structure on three classes | `parts/parts.js`, `parts/fleet.js` |
| 3 | Rim spar part with a sourced areal mass | the small classes are structure-dominated, not film-dominated | `parts/parts.js` |
| 4 | Coating stack + thermal split on the film | the wafer's film needs ε ≤ 1.9 × 10⁻⁵ | geometry + `beam.js` assumptions |
| 5 | Tip vanes and an attitude system | nothing on the model can hold beam incidence | `parts/parts.js` |
| 6 | Reactor and power/thermal architecture for seed and colony | 32× and 7× mismatches | `parts/parts.js` |
| 7 | IDSS on the capsule, sail moved off the docking axis | the crewed class cannot be entered as drawn | `parts/parts.js`, `fleet.js` |
| 8 | Harness, fluid lines and MLI on every part | the largest visual gap to a real vehicle | `parts/centauri-models.js` |
| 9 | CG, inertia and thrust-axis datums | the drawing should carry its mass properties | `centauri-models.js` |
| 10 | Spine truss for the seed, deck cutaway for the colony | structural and interior credibility | `fleet.js`, `centauri-models.js` |

---

## 9. Reproducing the numbers

From `apps/web/public/kosmo/static`:

```bash
node --input-type=module -e "$(cat <<'EOF'
import { CLASSES, measure } from './parts/fleet.js';
import { summarize } from './parts/assembly.js';
const C = 299792458;
for (const cls of CLASSES) {
  const m = measure(cls.id);
  const hull = summarize(m.solved.nodes.filter((n) => n.part.kind !== 'sail'));
  const p = m.solved.nodes.find((n) => n.part.kind === 'sail').world.position;
  const flux = m.powerW / m.sail.sail.areaM2;
  const lateral = Math.hypot(hull.cg[0] - p[0], hull.cg[2] - p[2]);
  console.log(cls.id, { flux, alphaMax: 2 * 5.670374419e-8 * 1000 ** 4 / flux, lateral,
    sailGap: p[1] - hull.bounds.max[1], gen: hull.power.gen, load: hull.power.load, reject: hull.heat.rejectCapacity });
}
EOF
)"
```

Assumptions stated where used: rim booms 50 g/m (illustrative, four of them); `I ≈ m L²/12`;
radiator limit 1000 K two-sided; aperture target 90 % coupling with a 1.5 000 km standoff. Everything
else is read from the catalogue and the solved assembly.
