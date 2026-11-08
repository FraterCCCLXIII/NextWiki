# Centauri fleet -- versions

Four versions of the fleet exist, and all four are pinned. `parts/fleet-versions.js` holds the
numbers; `centauri-fleet.test.mjs` measures the fleet and fails if a part's mass, a mate, a mast or a
sail moves away from them. A version is therefore either reproduced exactly or re-cut on purpose -- a
published ship cannot be re-written by a later edit to the catalogue.

| Version | What it is | Classes |
| --- | --- | --- |
| v1 | The parts-and-physics rebuild of the source table: real catalogue parts, an axial mast, a square sail sized from the payload, a despun hub on the colony. | 8 |
| v2 | The three crewed classes with a spin ring sized from the crew, giving 1 g in the living and working quarters. | 3 |
| v3 | The same eight classes flown by their own engines: sail and mast off, a drive stage bolted to a rigid hardpoint, with a propellant store, an engine bay or pusher plate, and radiators sized from the heat it rejects. | 8 |
| v4 | The realism pass: every class re-cut from a stated mission (crew x days, stop or fly by, closure) with a full systems inventory -- life support and consumables, stores, shielding, fission or radioisotope power, radiators, CMGs, comms, RCS, a trim/braking stage, a magsail where the ship stops, and the sail's canister, hub drive, beacons and vanes. | 8 |

Everything below is measured by `measure()` in `parts/fleet.js` (see `CENTAURI.md` for the lab and
`CENTAURI-CAD-REVIEW.md` for the placement review that v1 closes with).

## v1 -- the eight classes, frozen

| Class | Mass | Sail (square) | Mast | Sail clearance |
| --- | --- | --- | --- | --- |
| Wafer probe | 0.002 kg | 1.94 m | hub-mounted | - |
| Small satellite | 27.1 kg | 194 m | 1.08 m | 1.08 m |
| Instrument probe | 252 kg | 612 m | 1.38 m | 1.38 m |
| Robotic lander | 1,623 kg | 1.94 km | 2.88 m | 2.88 m |
| Crewed capsule | 20.4 t | 6.12 km | 10.35 m | 10.35 m |
| Crewed habitat | 211.7 t | 19.4 km | 37.42 m | 37.42 m |
| Colony seed | 2,007 t | 61.2 km | 212.3 m | 212.3 m |
| Full colony | 20,036 t | 194 km | 23.0 m | 21.0 m |

The sail diameter is a law, not a drawing choice: `d = 2 sqrt(m / (pi sigma))` with the film mass
equal to the payload mass (Lubin), at 0.34 g/m2 for 100 nm silicon nitride.

## v2 -- what a spin ring has to be

A ring gives weight by turning, and its size is fixed by two numbers: the gravity wanted and the
spin rate the crew can live with. Gravity is `omega^2 R`, so 1 g at 4 rpm needs a 55.9 m deck
radius. Four rpm is the continuous-living limit -- above it the Coriolis cross-coupling is felt in
the inner ear on head movements -- and 6 rpm is the short-stay figure.

The ring is then sized the other way round, from the people. Long-duration deck area is taken as
30 m2 per person, split 40 % quarters (12 m2), 30 % work (9), 20 % social (6), 10 % medical and
exercise (3), with circulation inside those numbers. The tube is grown until the decks inside it
hold that area, with a 2.4 m ceiling and 3.0 m deck pitch. Floor and outfitting are 250 kg/m2,
the pressure shell 60 kg/m2, lighting 20 W/m2 and life support 100 W per person.

`parts/centrifuge.js` holds those laws (`ringFor`, `ringTrade`, `deckLayout`); `parts/parts.js`
turns the result into a `centrifuge` part, and `parts/fleet.js` mates it to the hull as a v2
variant.

### Ring size per variant

| Variant | Crew | Deck radius | Tube | Decks | Deck area | Per person | Ring mass | Rim speed | Hotel power |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `habitat-spin` | 24 | 55.9 m | 3.0 m | 1 | 843 m2 | 35.1 m2 | 409 t | 23.4 m/s | 19 kW |
| `seed-spin` | 110 | 55.9 m | 7.5 m | 2 | 4,214 m2 | 38.3 m2 | 1,550 t | 23.4 m/s | 95 kW |
| `colony-spin` | 1,000 | 55.9 m | 19.5 m | 6 | 32,870 m2 | 32.9 m2 | 9,508 t | 23.4 m/s | 757 kW |

All three sit at the same radius because all three sit at the same gravity and spin rate. What
changes is the tube: 1,000 people need 33,000 m2 of deck, which is a 19.5 m tube on six decks,
whereas 24 people fit on one 843 m2 deck inside a 3 m tube.

### The rpm/radius trade

For the same 1 g and the same 1,000 crew, spinning slower means a bigger ring:

| Spin rate | Deck radius | Ring mass |
| --- | --- | --- |
| 2 rpm | 223.6 m | 11,630 t |
| 3 rpm | 99.4 m | 9,565 t |
| 4 rpm | 55.9 m | 9,508 t |
| 6 rpm | 24.8 m | 8,845 t |

The mass falls slowly with spin rate because the shell area is proportional to radius and the
floor area is fixed by the crew, so a fast small ring saves about a quarter of the structure and
costs comfort. v2 takes the conservative 4 rpm column.

### Internal layout

Living and working decks alternate around the loop rather than stacking in one place, so no one
works a whole shift a deck away from the quarterdeck. For `colony-spin` that is three living and
three working decks of 5,478 m2 each; for `seed-spin` one of each at 2,107 m2; the habitat's single
deck is the living deck, with its 337 m2 of work area cut out of it.

Decks climb from the inner wall outward, so gravity rises across the tube: on the colony ring the
inner deck sees 8.41 m/s2 (0.86 g) and the outer deck 11.04 m/s2 (1.13 g). Every deck is inside
+/-13 % of 1 g, which is the honest consequence of a 19.5 m tube on a 55.9 m ring -- a thin ring
has a flat gravity profile, a fat one does not. The 0.8 D average chord used for floor area is the
same approximation that makes the deck area a chord sum rather than an integral.

## What changed structurally in v2

- **Habitat and seed.** The v1 hull is reused unchanged, and a 1,800 kg bearing is hung on the
  node's aft face. The ring turns on it; the stack passes through its own ring, so the sail, the
  mast, the arrays and the radiators all stay de-spun. The docking port moves onto the bearing's own
  despun aft face, on the spin axis, so the berth adds no imbalance and the crew never cross a
  rotating joint: the habitat's and the seed's CG stay on the thrust line to 1e-19 m.
- **Colony.** The ring replaces the 10 kt `ring-1g` part. The arrays and radiators come off the
  spinning ring and go onto the despun hub's four utility hardpoints, where they were always meant
  to be: a radiator hung on a rotating ring drags round the sky and cycles its own plumbing. This
  is the one assembly-level difference between v1 and v2 colony, and the test records it.
- **The sail is unchanged; the mast is re-cut.** The sail law sizes the film to the payload, as it
  does in v1, so a ring is dry mass: it shows up in the laser power the lab computes, not in the
  sail. That is why `habitat-spin` weighs three times v1 while flying the same 19.4 km film, and why
  its power-to-table ratio is worse. `colony-spin` is actually 2 % lighter than v1 because the sized
  ring (9.5 kt) is smaller than the v1 ring's stated 10 kt. The mast is 1.15 hull heights long, so
  inserting the bearing and the berth below it (habitat, seed) or shrinking the ring's tube (colony)
  re-cuts it: 37.42 to 36.84 m, 212.34 to 214.35 m, 23.0 to 22.42 m. Sail clearance follows the mast.
- **Radiators moved off the array plane.** The v1 habitat and seed hung a 6.1 m radiator and an 11 m
  array wing on opposite ends of the same +-x hinge pair, so the radiator sat inside the wing's
  swept plane (a 15.4 x 5.2 x 1.1 m overlap in the assembled model). Radiators now hang on the
  node's zenith/nadir hinge pair, wings stay on +-x, and the two no longer share a plane. The array
  builder also had its edge booms on z while the blanket spans x, which inflated the wing to an
  11 m depth; that is fixed and the wing is now a flat 11 x 34.7 m panel.

### Revision note

v1 and v2 were both re-cut once after a CAD review of the assembled models, for the radiator/array
overlap and the boom axis above. No mass or sail changed; v1's mast and clearance reproduce exactly
(37.419 m, 212.341 m, 23.0 m), so the v1 table above stands. The v2 masts and masses moved by the
amounts shown, and the pins were regenerated deliberately rather than edited by hand.

## v3 -- the driven ships, re-cut

A driven ship is the v1 hull with the sail and mast removed and a drive stage bolted where the mast
root was. The stage is sized by the rocket equation (mass ratio, propellant, crossing time) and then
built: a thrust frame from the hull's hardpoint out to the store, the store itself, the aft end and
the radiators. The 2026-11-08 re-cut replaced the first cut's hinge mount, its 3.65x-oversized tank,
its hydrogen tank standing in for a pulse-unit magazine and its invented heat rejection. Every v3
mass moved, so these pins are the re-cut.

| Variant | Wet | Propellant | Store | Aft end | Radiator | Cruise | Crossing | Closes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wafer-pellet | 1 g | 0 (1 g of pellets) | coil | -- | -- | 0.10 c | 44 yr | yes |
| smallsat-pellet | 15 kg | 0 (15 kg of pellets) | coil | -- | -- | 0.10 c | 44 yr | yes |
| instrument-ion | 34.1 t | 32 t xenon | tank, 2.2 x 6.6 m | four bells | 0.02 m2 | 0.038 % c | 11,800 yr | no |
| lander-ntr | 548 t | 521 t LH2 | tank, 11.9 x 71.7 m | four bells | 259 m2 | 0.0088 % c | 49,500 yr | no |
| capsule-orion | 1,032 t | 981 t of pulse units | magazine, 8.8 x 17.5 m | 12.7 m plate | 86 m2 | 0.039 % c | 11,200 yr | no |
| habitat-dfd | 3,990 t | 3,790 t D-He3 | tank, 20.6 x 123 m | four bells | 8.7 m2 | 0.098 % c | 4,640 yr | no |
| seed-daedalus | 34,250 t | 32,530 t of pellets | magazine, 24.6 x 148 m | 36 m plate | 6,540 m2 | 9.85 % c | 46 yr | yes |
| colony-pulse | 326,000 t | 309,700 t of pulse units | magazine, 65.7 x 197 m | 95 m plate | 3,970 m2 | 8.96 % c | 76 yr | yes |

The laws behind the table are in `CENTAURI-PROPULSION.md` ("The stage, as built"): the store diameter
from bulk density and a stated length/diameter ratio with 8 % ullage, the frame at 1 kg per 500 N of
thrust (50 kg floor), the radiator from a stated share of jet power rejected at 1000 K two-sided, and
a pusher plate 1.45x the magazine's diameter on eight shock absorbers for a pulse drive.

## v4 -- the realism pass (2026-11-08)

v1-v3 are left exactly as pinned. v4 is a new set of eight assemblies (`parts/fleet-v4.js`) built from
the same solver and the same catalogue, plus new catalogue rows with checked figures (Harmony 14,288 kg,
Destiny 14,515 kg, Quest 6,064 kg, a Crew Dragon-class capsule with TPS and nose cone, a trunk with solar
skin, an 11.7 in lightband, a 16U bus, a New Horizons-class bus, a 2.4 m stainless aero lander) and
the primitive library (`parts/primitives/`, `CENTAURI-PRIMITIVES.md`). Every item is sized from a law
with a source (`parts/inventory.js`, `CENTAURI-INVENTORY.md`). The pins are mass, hull mass, film
mass, sail, mast, clearance, part count, consumables, pressurised volume and power.

| Class | v1 mass | v4 mass | v1 sail | v4 sail | What the mission is | Why it moved |
| --- | --- | --- | --- | --- | --- | --- |
| wafer | 2.00 g | 2.13 g | 1.94 m | 2.00 m | 1 g StarChip, flyby | the chip's budget is itemised; hub ring, rim patches and vanes add 6 % |
| smallsat | 27.1 kg | 96 kg | 194 m | 420 m | 16U free-flyer on a lightband, RTG, flyby | the 6U overload is gone; bay, trim stage, canister and a film sized to all of it |
| instrument | 252 kg | 1.33 t | 612 m | 1.58 km | New Horizons class, MMRTG, flyby | an RTG (no sunlight), a 2.1 m HGA, hydrazine, bow shield, and the film to push them |
| lander | 1.62 t | 14.4 t | 1.94 km | 5.2 km | aero lander that stops and lands 250 kg | the v1 lander shipped no payload; TPS, grid fins, legs, landing and braking propellant, magsail |
| capsule | 20.4 t | 22.0 t | 6.12 km | 6.42 km | 4 crew x 30 d taxi | Dragon figures replace the draft row; the class is named for what it is |
| habitat | 212 t | 1.09 kt | 19.4 km | 45.2 km | 6 crew x 50 yr, bola | 206 t of consumables, stores modules, ECLSS, reactor, braking stage; 24 crew x nothing became 6 crew x fifty years |
| seed | 2.01 kt | 4.42 kt | 61.2 km | 91 km | 20 crew x 50 yr, greenhouse ring | 110 crew with no life support became 20 with a farm and 428 t of stores |
| colony | 20.0 kt | 165 kt | 194 km | 555 km | 1,000 crew x 50 yr, world ship | farm and stores decks triple the ring; 7.8 kt of consumables, 11 kt of spares, two 12 MWe reactors, a 20 kt braking stage |

Two laws changed for v4 only. The **mast** is a truss sized from the sail thrust it carries (audit F8),
standing the film 15 % clear of the structure forward of its mount rather than of the whole hull (the
v1 law would have bought the colony a 900 m mast for its aft spindle). The **film** is sized to
everything it pushes including the canister, iterated to the fixed point.

**A v2 finding uncovered by the v4 overlap check.** The v2 spin bearing's `dock` port sits on its
node-side face pointing back into the node, so the v2 habitat-spin and seed-spin PMAs berth inside the
node. v2 is pinned and left as recorded (the audit lists it); the v4 bearing docks on its far face.

## QA re-cuts (2026-11-08)

The geometry audit (`CENTAURI-QA.md`) moved hardpoints, bearing planes and layouts, and nine ships'
pinned numbers followed. The pins above are untouched; `parts/fleet-recuts.js` records every moved
field with the value it had, the value it has and why, and the checks compare against `pinned()`, the
pin with its re-cut applied. v1 and v3 reproduce their pins exactly. Re-cut: habitat-spin and seed-spin
(mast and mass, the bearing's ring and dock planes), instrument-v4 (mast, the HGA off the fore face),
colony-v4 (mast 98.6 -> 22.9 m, part count 20 -> 34: the radiators and reactor booms left the ring
plane for the aft spindle), and all five v5 designs (hangar and fab-bay lengths, the reactor boom, the
rail stations). Regenerate the record with `node centauri-recut.mjs --json`.

## Open items

- Neither the v1 colony nor the v2 colony-spin carries a docking port; the v4 colony berths a PMA and
  an airlock on its despun hub.
- The ring's life support, air and water are fed through rotary unions in the bearing; the 757 kW
  hotel load of the colony ring is inside the 2 MW the two reactors generate, but nothing in the
  model yet sizes the unions or the coolant loop.
- Structural mass is areal, not a stress design: the 4 MN bearing load, the ring's own bending under
  spin-up and the mast's compression are checked as loads in the lab, not solved as a structure.
