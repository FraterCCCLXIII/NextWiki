# The sail mechanism

`parts/sail-mechanics.js` is how a Centauri sail stows, deploys, carries its load and stows again.
`parts/primitives/sail-mesh.js` draws it; `centauri-sail.test.mjs` holds it; the lab's **Mechanism**
bar plays it. This note says what was wrong, what was chosen and why, how the kinematics work, and
what the numbers come out as.

## What was wrong

The film was a fold *pattern* (`parts/flasher.js`, `CENTAURI-FLASHER.md`), not a mechanism. The viewer's
unfold control scaled a flat hexagon by `sqrt(lambda)` with a small twist buckle. Screenshots in
`centauri-shots/sails/before-*.jpg` show the consequences:

- at k = 0 ("stowed") the film was a flat hexagon one sixth of the span, hovering over the canister;
  nothing was in the canister and the canister never opened (`before-smallsat-v4-k0.jpg`);
- the hub ring and the six rim arms did not scale with the film, so at k = 0.1 the ring floated outside
  a film smaller than itself (`before-smallsat-v4-k0.1-top.jpg`);
- there were no booms, reels, lines, tip masses, doors or spools, so nothing carried the film to the hull
  and nothing paid it out or back in -- "retraction" was the same cosmetic shrink in reverse;
- the wafer's 2 m disc was scaled like the rest and had no release path (`before-wafer-v4-*.jpg`).

The mechanism's own sweep is in the same folder: for every v4 class `<id>-deploy-k<k>-iso.jpg` at
k = 0, 0.1, 0.25, 0.5, 0.75, 1 framed on the deployed film, `-close.jpg` on the drum at k = 0, 0.1, 0.25,
`-top.jpg` at k = 0.5, 0.75, 1, then `-retract-k<k>-iso.jpg` (k = 0.75, 0.5, 0.25, 0) for the refoldable
classes or `-cutaway-j<j>-iso.jpg` (j = 0.3, 1) for the one-shot ones, and `smallsat-v4-boom-square-*.jpg`
for the boom comparison.

## The architectures, and why

| Class (base) | Mechanism | Real analogue | Why |
| --- | --- | --- | --- |
| wafer | `starchip-disc` | Breakthrough Starshot (Lubin 2016; Parkin 2018); Manchester & Loeb 2017 beam-riding dish | a 1 g chip has no mechanism budget. The disc is bonded to the chip and **released** from the mother ship's dispenser tray: stow = flat in the tray, release = a spring pushes the tray away at 0.1 m/s, the stiff multilayer disc then takes the 4 % dish that makes it ride the beam. No lines, no booms, nothing to refold. |
| smallsat, instrument | `spin-square` | JAXA IKAROS (2010): 14 m square, four petals, tip masses, two-stage spin deployment | flyby classes never need the film back. The square is cut into four petals along the hub-to-midside lines; each petal is accordion-folded on lines parallel to its diagonal into a strip with a tip mass at the corner; the four strips are wrapped around the hub drum. **One-shot**: the drum is not motorised and the pleats have no furling, so the retraction path is a cut-away at the hub (`jettison`). |
| lander, capsule, habitat, seed, colony | `reeled-gore` | JPL Halley heliogyro (1977), 12 blades of 7.5 km on reels; Wilkie HELIOS (2014); the IKAROS fold | these stop (magsail), carry crew, or approach a planet, so the film must stow for the braking phase, approach and dust. Six gores on a hexagonal rim, the same pleat-and-wrap as IKAROS but on a **motorised drum** (a heliogyro's reel) with furling cords across the pleats, so the gores close again as the drum rewinds them. **Refoldable.** Spin-stabilised, because spin is the only structure that closes at 0.34 g/m2. |
| (library, lab selector) | `boom-square` | NanoSail-D2, LightSail 2, NEA Scout, ACS3 (2024), Solar Cruiser | four booms (TRAC tape-springs under 12 m, coilable lattice masts above) extend from the canister along the diagonals; each quadrant is Z-folded parallel to its base, rolled apex-out on a spool, and pays out as the boom tips pull its corners. Retractable. **Not the fleet default**, because the booms never close: `boomClosure()` says four lattice booms for the smallsat's 526 m sail would weigh 1,490 kg against a 47 kg film (32x), with an Euler buckling margin of 0.001 against the film tension. The lab draws it on request so the comparison can be seen. |

v1 and v2 classes take the same mechanism as their base class. They have no canister part, so the drum
is derived from `sailCanisterSpec(filmKg)` and **drawn, never counted**: their masses are pinned. If a
re-cut ever adds the drum, the v1 smallsat gains 1.6 kg, the v1 habitat 15 t, the v1 colony 1.0 kt (the
canister law's figures); this note records it instead of editing the pins.

## Kinematics

One parameter k in [0, 1] drives everything (the viewer's existing control). Each architecture is a
stage machine; k is split between stages by fixed fractions so the slider shows every stage, and
`timeAt(k)` maps progress to seconds through each stage's physical duration. The film geometry is a pure
function of k, so **scrubbing backwards is the retraction** for a refoldable mechanism; a one-shot
mechanism reports `canRefold = false` and offers `jettison(j)` instead.

### reeled-gore and spin-square

| Stage | k | Duration | What happens |
| --- | --- | --- | --- |
| stowed | 0.00-0.05 | 300 s | latched, the hub spins up to the release rate (1 m/s2 at the drum rim: IKAROS released at ~25 rpm on a 1.6 m body; the smallsat's 0.52 m drum gives 18.7 rpm) |
| release | 0.05-0.12 | 120 s | the N door petals (the drum wall, hinged at the bottom rim) swing out; the tip-mass hold-downs release |
| payout | 0.12-0.62 | strip length / reel rate | each strip unwinds off the N-start spiral on the tangent (yo-yo geometry): departure point `rho(sigma) = sqrt(rho0^2 + p sigma / pi)`, straight part of length s on the tangent; the spin falls as `I omega` is conserved until the tip acceleration would drop under 0.1 m/s2, then the hub RCS holds it (`spinAt(k).addedNms` is the momentum added) |
| swing | 0.62-0.70 | a quarter turn at the release rate | the straight strips pivot about their root from tangential to radial |
| open | 0.70-0.90 | half-width / 2 m/s, at least 10 s | hold-downs release and the pleats open laterally from the stack angle `asin(stack / 2 vMax)` to flat; the gores meet edge to edge; the rim tie-lines come taut |
| trim | 0.90-1.00 | 600 s | the hub brings the spin to the design rate, the film takes its dish under the beam, vanes and gimbal trim |

Reel rate: `0.05 sqrt(R / 100 m)` m/s clamped to [0.02, 1] for the reeled gores (heliogyro blade
deployment is cm/s on an 8 m blade; a 300 km gore gets a metre a second), 0.02 m/s for IKAROS (its first
stage was quasi-static, stepped over days; the motion between steps was cm/s).

**The fold.** Gore i is the kite between the hub and corner i: at radius u it spans
`|v| <= min(u tan(pi/N), (R - u) / tan(pi/N))`. Pleats are strips parallel to the gore axis, each as wide
as the band the drum allows (`0.92 x drum length`), an even count so a crease lies on the axis and the tip
mass sits on it. Folded, pleat j is at lateral offset `V_j = (-vMax + j w) sin(theta)` and height
`N_j in {0, -w cos(theta)}` alternating; open, `theta = pi/2`, `V = v` and `N = 0`. Rigid: every panel is a
planar slice of one pleat, panels share their fold-line vertices exactly, widths never change. Wrapped,
the bundle's length direction runs along the spiral, its pleat width along the drum axis (the band) and
its stack across the layers (`rho + V`), which is how IKAROS's photographs show it: a tape as tall as the
pleat, as thick as the stack. Every pleat is sliced on the same `u` levels, trimmed to the gore boundary
per slice, so no chord spans more than one slice of the wrap.

**The pack.** `A (t + g)` with `g = 5 t` (6x packing; LightSail 2 packs 4.5 um Mylar about 10x; a 100 nm
film sits flatter) against the drum annulus `pi (r^2 - (0.25 r)^2) x 0.92 l`. The canister law gives 8x
the film volume, so the pack fits with 13 % to spare on every class (table). A drawn-down film (the viewer
draws large sails at 3 hull spans) fills 80 % of the true drum with a bigger fold gap so the pack is
visible when the doors open; the true numbers are the true film's.

**Spin.** The film's hoop stress spinning at omega is `rho omega^2 R^2`; its tension `T = sigma t` holds the
beam pressure `p = 2 eta P / (c A)` with a dish `delta0 = p R^2 / 4 T`. The spin is sized for a 5 % dish
unless the allowable (6 GPa / 3) stops it, in which case the dish is larger and said so. Rim speed is
`sqrt(sigma / rho)`: 767 m/s at the allowable, whatever the radius. Tip masses are 1 % of the film over N.

### boom-square

stowed 0.05 (60 s) -> release 0.08 (60 s, doors) -> extend 0.62 (`L / rate`: TRAC 0.022 m/s as LightSail 2's
4 m in 3 min, lattice 0.06 m/s as SRTM's 60 m in 17 min) -> tension 0.15 (300 s, actuators take up the
residual pleat zigzag) -> trim 0.10 (300 s, halyards taut, billow). During extension the deployed film is
the triangle hub -> tipA -> tipB (the quadrant pays out apex-first off its spool, rolled apex-out), the
remainder is a roll on the spool whose radius follows the remaining area, so film on the booms plus film
on the spools is always the sail area. Boom stiffness `EI` (60 N m2 at 4 m TRAC scaling with (L/4)^2;
1e5 N m2 at 60 m lattice), first cantilever frequency with the quadrant as tip mass, Euler load against
the film's edge tension, and the tape's stored strain energy on its spool are reported.

### starchip-disc

stowed 0.20 (tray) -> release 0.35 (`4 R / 0.1 m/s`) -> dish 0.30 (20 s) -> trim 0.15 (60 s). The tray (a
frame with a slot and four posts) recedes along -y and disappears when it has gone; the disc is a 48 x 24
polygon that takes its 4 % dish.

## Loads and pointing

`F = 2 eta P / c` (the lab's law; `cos^2(alpha)` off-axis). The disturbance torque is `F x (CP - CM)`,
with the offset from `measure().geometry.offAxisM` (floor 0.1 % of R). Authority: tip vanes (2 % of the
film area at the rim, 35 deg), the hub gimbal (5 deg over the mast lever), and for the reeled gores the
heliogyro's cyclic pitch (0.1 rad). Margins are 19x on the vane-only classes and 69x with gore pitch; the
check is in the suite. The film temperature is the inventory's (`filmTemperatureK`), 1000 K limit.

## The numbers

| Class | Mechanism | Rim span | Drum (d x l) | Pack / annulus | Pleats per gore | Turns per strip | Rate | Deploy time | Design spin | Dish under load | Trim margin | Refolds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `wafer-v4` | starchip-disc | 2.00 m | tray | 0.31 mL (one disc) | - | - | 0.1 m/s | 2.0 min | - | 4 % dish | 19x | no |
| `smallsat-v4` | spin-square | 526 m | 0.52 x 0.52 m | 83 L / 96 L | 550 | 271 | 0.02 m/s | 4.0 h | 27.8 rpm, 767 m/s | 8.4 % (stress-limited) | 19x | no |
| `instrument-v4` | spin-square | 1.98 km | 1.26 x 1.26 m | 1.17 / 1.35 m3 | 856 | 421 | 0.02 m/s | 14.1 h | 3.3 rpm, 345 m/s | 5.0 % | 19x | no |
| `lander-v4` | reeled-gore | 5.71 km | 2.79 x 2.79 m | 12.7 / 14.6 m3 | 966 | 550 | 0.27 m/s | 3.4 h | 0.57 rpm, 169 m/s | 5.0 % | 69x | yes |
| `capsule-v4` | reeled-gore | 7.06 km | 3.21 x 3.21 m | 19.4 / 22.3 m3 | 1038 | 590 | 0.30 m/s | 3.8 h | 0.36 rpm, 133 m/s | 5.0 % | 69x | yes |
| `habitat-v4` | reeled-gore | 49.7 km | 11.8 x 11.8 m | 964 / 1,110 m3 | 1988 | 1131 | 0.79 m/s | 10.5 h | 0.14 rpm, 353 m/s | 5.0 % | 69x | yes |
| `seed-v4` | reeled-gore | 100 km | 18.8 x 18.8 m | 3,900 / 4,490 m3 | 2508 | 1429 | 1.00 m/s | 17.2 h | 0.078 rpm, 409 m/s | 5.0 % | 69x | yes |
| `colony-v4` | reeled-gore | 610 km | 62.7 x 62.7 m | 145,000 / 167,000 m3 | 4582 | 2610 | 1.00 m/s | 4.3 d | 0.024 rpm, 767 m/s | 5.2 % (stress-limited) | 69x | yes |
| `wafer` (v1) | starchip-disc | 1.94 m | tray | 0.29 mL | - | - | 0.1 m/s | 2.0 min | - | 4 % dish | 19x | no |
| `smallsat` (v1) | spin-square | 243 m | 0.31 x 0.31 m (derived) | 17.6 / 20.2 L | 426 | 209 | 0.02 m/s | 2.0 h | 60.4 rpm, 767 m/s | 5.1 % (stress-limited) | 20x | no |
| `instrument` (v1) | spin-square | 767 m | 0.67 x 0.67 m (derived) | 176 / 203 L | 624 | 307 | 0.02 m/s | 5.6 h | 6.0 rpm, 241 m/s | 5.0 % | 19x | no |
| `lander` (v1) | reeled-gore | 2.13 km | 1.44 x 1.44 m (derived) | 1.76 / 2.03 m3 | 696 | 395 | 0.16 m/s | 2.2 h | 0.84 rpm, 93 m/s | 5.0 % | 69x | yes |
| `capsule` (v1) | reeled-gore | 6.73 km | 3.11 x 3.11 m (derived) | 17.6 / 20.3 m3 | 1020 | 581 | 0.29 m/s | 3.7 h | 0.37 rpm, 131 m/s | 5.0 % | 69x | yes |
| `habitat` (v1) | reeled-gore | 21.3 km | 6.69 x 6.69 m (derived) | 176 / 203 m3 | 1498 | 852 | 0.52 m/s | 6.7 h | 0.21 rpm, 238 m/s | 5.0 % | 69x | yes |
| `seed` (v1) | reeled-gore | 67.3 km | 14.4 x 14.4 m (derived) | 1,760 / 2,030 m3 | 2198 | 1251 | 0.92 m/s | 12.5 h | 0.095 rpm, 336 m/s | 5.0 % | 69x | yes |
| `colony` (v1) | reeled-gore | 213 km | 31.1 x 31.1 m (derived) | 17,600 / 20,300 m3 | 3226 | 1837 | 1.00 m/s | 1.5 d | 0.041 rpm, 462 m/s | 5.0 % | 69x | yes |
| `habitat-spin`, `seed-spin`, `colony-spin` (v2) | reeled-gore | as v1 | as v1 (derived) | as v1 | as v1 | as v1 | as v1 | as v1 | 0.37 / 0.13 / 0.041 rpm | 5.0 % | 69x | yes |

The drum columns are the v4 canister primitive (`sailCanisterSpec`) where the class has one. "Turns per
strip" is how many times each strip goes round the drum: a 555 km colony film wraps 2,600 turns, which
is why the geometry checks run on the drawn-scale film (see the test file's header) while these numbers
are the true film's. The rim span is the N-gon's circumscribed diameter, `rimRadius(A, N, hubR)`, so the
hexagon around the drum carries exactly the sail law's area; the square (`sailSquareSide`) and the circle
(`dims.d`) the beam trade uses are the same area in other shapes, as before.

## What the lab shows

Under the viewer: **Mechanism** (class default or an override), **Path** (deploy / retract / cut-away),
**play** / pause, **loop** (ping-pong for a refoldable mechanism, restart for a one-shot), **speed**,
**frame sail** / **frame hull**. The readout at the top right prints the stage, k, time of total, strip or
boom extension, film area deployed of total, tension (and boom compression), spin, dish and how many lines
are taut -- the true sail's numbers, with the drawn-down ratio when the film is not at true size. The
label under the model names the mechanism and says why in one line. The shipyard's wrapped Centauri
models carry `userData.sail` and `setJettison` next to `setDeploy`, so a shipyard control can drive the
same mechanism.

Hardware skins (drum, doors, core, reel, latches, tips, vanes, booms, spools, gimbal, tray) come from
`primitives/materials.js` by kind (`SAIL_SKINS` in `sail-mesh.js`), so the shared livery layer dresses
them; the film is its own `MeshPhysicalMaterial` (metallic, 88 % opaque, double-sided, iridescence
option) because a film is not a painted surface.

## What is checked

`centauri-sail.test.mjs` (3,971 checks, discovered by `run-tests.mjs`), for every sail class in v1, v2 and
v4 over k = 0 -> 1 -> 0: area conservation
(0.35 % heavy / 0.6 % light from the chord error of the wound arcs; 3 % in the trim stage where the billow
is drawn as a deflected shape), fold-line closure (shared vertices to 1e-9 R), no film panel crossing
another (the heavy sweep: one class per architecture and a v1, with a tolerant triangle test and a
spatial hash), every wrapped panel inside the drum and nothing below it, extension monotone and within
the strip or boom length, deployment time equal to the stage sum and the payout equal to length over
rate, no line ever longer than what was paid out and every line taut at k = 1, retraction returning to
the stowed geometry (refoldable) or a stated cut-away path (one-shot), trim authority covering the CP-CM
torque, hoop stress within the allowable, `I omega = L0 + added` with spin falling during payout and
reaching the design rate at k = 1, booms on the corners and spool area accounting for the rest.

## Still approximate

- The wound bundle is drawn at full stack thickness along its whole length; the real bundle thins where
  the short edge pleats are absent. The pack *volume* is exact; the spiral the viewer shows is the bundle's
  bounding envelope.
- Spin is quasi-static rigid co-rotation with a floor held by the hub RCS; the yo-yo's true two-body
  dynamics, tether whip and the IKAROS second-stage dynamics are not integrated.
- The dish under load is a parabolic deflected shape (a few per cent of area in the drawn geometry); the
  real film takes it from edge catenaries and wrinkles, which are not modelled.
- Reel and boom rates are stated laws with sources, not motor models; boom `EI` is a two-point scaling.
- The one-shot cut-away is a separation at 0.5 m/s along the thrust axis; the released film's own tumble
  is not modelled.
- Nothing here changes a pinned mass: the derived v1/v2 drums are drawn and recorded above, not counted.
