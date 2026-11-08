# Centauri Fleet Audit

A pass over all nineteen Centauri assemblies (v1 eight classes, v2 three rings, v3 eight drives),
looking for what is not legitimate in the models and what has to change for them to be real. Every
finding below is measured from the assembly, not remembered: the numbers come from `measure()` and
from the part catalogue the assembly is built out of.

This pass was written before F1-F5 were fixed and records the numbers as they stood then (590 fleet
checks, 17/17 suite, 244 vehicles validated, and the versions in `parts/fleet-versions.js` describing
the ships as built). §0 records the re-cut that followed; the findings below stand as the open list,
with the v3 notes updated to what the ships measure now.

Severity: **BLOCKER** = physically impossible as drawn; **MAJOR** = wrong by more than 2x or a
structure carrying a load it cannot; **MINOR** = wrong but not structural.

## What is legitimate

Worth saying first, because most of the model survives this:

- masses sum from the parts, including generated ones, and the CG sits on the thrust line to
  sub-millimetre on every class;
- the film is sized from its payload by an areal density, and the sail mass = payload mass rule is
  the published optimum, not a guess;
- the spin rings are sized by law (1 g at 4 rpm = 55.9 m, 30 m2/person) and the radial load they put
  on a bearing (4.0 MN, 15.2 MN, 93.2 MN) matches their masses;
- the rocket equation in v3 is the relativistic one, and the mass-ratio cap is honest;
- the mate solver catches two real port overloads (below) rather than hiding them.

## 0. Fixed in the v3 re-cut (2026-11-08)

| finding | before | now |
| --- | --- | --- |
| F1 the drive hangs on a hinge | seven modules on `hinge-1d`, the capsule on a 1.2 m IDSS ring | a `hardpoint` port type, rigid and moment-carrying, plus a thrust frame of `max(50 kg, F/500 N per kg)`; the host's mount is retyped on a copy, so v1 and v2 keep their hinges |
| F2 the tank is 3.65x the propellant | `d = 1.15 cbrt(6V/pi)`, `l = 1.6 d` | `d = cbrt(4 u V/(pi s))` with 8 % ullage and a stated length/diameter ratio; the capsule's module goes from 33.7 m to 8.8 m across |
| F3 pulse drives drawn as hydrogen tanks | LH2 at 70 kg/m3 for every drive | a magazine at its own bulk density: the capsule carries 6,538 x 150 kg units in 8.8 m x 17.5 m, behind a 12.7 m plate on eight shock absorbers |
| F4 heat rejection from wet kilograms | `wetKg * 2` read as watts, 651 MW for the pulse colony | a stated share of jet power `f F ve/2`, rejected at 1000 K: 450 MW for the colony, 9.8 MW for the capsule, drawn as four panels at that area |
| F5 beamed momentum from the hull alone | `stream = hull beta c / 2u`, 0.5 g for the wafer | `stream = hull k/(1-k)`, because the stream joins the ship: 1 g for the wafer, and `closes` needs a finite stream |

The re-cut moved every v3 mass, since a thrust frame and a denser store are mass the first cut did not
have. Both v3 tables in `CENTAURI-PROPULSION.md` were regenerated from `measure()` and the pins in
`parts/fleet-versions.js` were re-cut with them. The verdicts did not move: four of the eight close.

## 0b. Closed in v4, the realism pass (2026-11-08)

v4 does not re-cut v1-v3; it adds eight assemblies (`parts/fleet-v4.js`, `CENTAURI-INVENTORY.md`) in
which the open findings below are closed for the v4 ships:

| finding | v4 |
| --- | --- |
| F6 no life support, shielding, attitude control or comms | ECLSS, consumables for crew x days at a stated closure, storm shelter, Whipple and bow dust shields, CMGs/wheels, HGA and laser terminal, RCS, a trim/braking stage from a delta-v budget, a magsail where the ship stops -- every item sized by `parts/inventory.js` and placed in a part |
| F8 film and mast from unrelated laws | the mast is a truss sized from the sail thrust it carries (`trussSpec`), 58 kg for 548 kN on the habitat, 36 t for 33 MN on the colony |
| F9 the node is understated | v4 uses Harmony at its launch mass (14,288 kg); Destiny carries 14,515 kg; Quest 6,064 kg |
| F10 cargo cans wider than the stack | stores are chained 4.4 m (habitat) or 6.6 m Skylab-diameter (seed) modules of a stated volume, and the colony's stores are decks inside its ring |
| smallsat on an overloaded 6U dispenser | an 11.7 in motorised lightband rated to the 450 kg class |
| lander with no payload | 250 kg of instruments, TPS, grid fins, legs, landing propellant, a braking stage and a magsail |
| capsule crew with no consumables | named as the 4 crew x 30 day taxi it is, with Dragon's figures |
| bearing rating | the bearing carries thrust, imbalance and spin-up torque, not the ring's weight (a spinning ring is self-supporting in hoop tension); the colony hub scales as sqrt(ring mass) |

**New finding (v2, pinned, left as recorded).** The v2 spin bearing's `dock` port faces back into the
node, so the habitat-spin and seed-spin PMAs sit inside the node. Found by the v4 interpenetration
check; the v4 bearing docks on its far face.

## Fleet-wide findings

### F1. Every drive hangs on a deployable hinge -- BLOCKER (fixed, §0)

Seven of the eight v3 modules are mated on `hinge-1d`, the port the sail mast used, because
`propelledAssembly()` copies the host port's type. The eighth (capsule) is on `idss-1200`. So a
3,988 t fusion module, a 33,762 t Daedalus stack and a 325,679 t Dune-class pulse ship are attached
to the hull through a **one-degree-of-freedom deployable hinge**, and a 918 t propellant load is
carried through a 1.2 m docking ring (28:1 part diameter to port diameter). `PORT_TYPES` gives every
one of those ports `maxMass: null`, so `checkAssembly` cannot flag it: of nineteen assemblies only two overloads fire,
and both are on stack/rail interfaces that happen to carry a rating (a 937/1194 mm clampband and a 6U
dispenser rail).

Fix: a `hardpoint` port type (rigid, rated, moment-carrying) plus a thrust frame sized by the load it
carries (`max(50 kg, thrust/500 N per kg)`), mated between the hull and the module. Re-cut **v3**.

### F2. The tank envelope is 3.65x the propellant it holds -- MAJOR (fixed, §0)

`planFor()` set `d = 1.15 * cbrt(6V/pi)` and `l = 1.6 d`. A cylinder of that d and l has volume
`1.257 d^3`, and `d^3 = 2.9 V`, so the drawn tank was **3.65x** the propellant volume -- every driven
ship, without exception. That is why the habitat's fusion module was 54 m across and 86 m long for
3,788 t of hydrogen, and the capsule's was 33.7 m for 918 t. It is now 20.6 m and 8.8 m.

Fix: solve length from density and a stated ullage (`l = 1.15 V / (pi d^2 / 4)`), or keep d from the
volume and let l follow. Re-cut **v3**.

### F3. Pulse and fusion drives are modelled as hydrogen tanks -- MAJOR (fixed, §0)

Orion's "propellant" is a magazine of pulse units; Daedalus's is D-He3 pellets. Both are solid at
roughly 200-1,000 kg/m3, but both were given LH2's 70 kg/m3 and a 2 % tank fraction. The capsule's
magazine therefore came out 33.7 m across for a mass that would fit in about 11 m, and the model drew
a tank where the real thing has a pusher plate, a shock absorber and a magazine. It now has them.

Fix: per-drive geometry (magazine vs tank), a bulk density that matches the pulse units, and unit
count = propellant / unit mass. Re-cut **v3**.

### F4. Drive heat rejection is `2 x wet mass in kg`, read as watts -- MAJOR (fixed, §0)

`drivePart()` set `heat.rejectCapacity = plan.wetKg * 2`. That was a unit accident (kilograms became
watts), and it produced 651 MW for the pulse colony, 68 MW for the seed, 8 MW for the habitat. Nothing
checked it against the jet power it is supposed to reject.

Fix: rejected heat from the jet, `Pj = F ve / 2` less the useful fraction, and a radiator area from
that. Re-cut **v3**.

### F5. Beamed momentum uses hull mass, and "closes" is true by construction -- MAJOR (fixed, §0)

`planFor()`'s beamed branch sizes the pellet stream from `hullKg`, not the wet mass, so the wafer's
stream (0.5 g) is a third of the momentum it needs for a 1.5 g ship; and `closes` compares an input
`beta` with itself, so every beamed class "closes" no matter what the accelerator costs.

Fix: wet mass in the momentum budget, and a station-power ceiling the same way the laser trade has
one. Re-cut **v3** (numbers move, verdicts stay).

### F6. Nothing in the fleet has life support, shielding, attitude control or comms -- BLOCKER as a claim

The catalogue has no ECLSS, no consumables model, no radiation shielding, no RCS, no antenna. The
crewed classes are mass but not habitat: the capsule carries four crew for a **two-year boost in
9.3 m3** with no food, water or shielding; the habitat's 24 crew (v2) live in two Columbus labs and a
ring, with no life-support hardware anywhere in the mass. `cargoPart` is the only allowance, and for
the habitat it is exactly the payload minus the hardware (79.5 t), not a sized stores load.

Fix: a small set of derived parts sized by crew-days (ECLSS, consumables, shielding areal density,
RCS propellant by delta-v), and a stated mission duration per class. Re-cut **v1 and v2**.

### F7. The stowed sail envelope contradicts the fold -- MAJOR (fixed)

Every film stows to `0.4 m x <= 4 m` in the catalogue, but `sailFoldedFootprint()` puts the pack at
half a side, which is 8.57 km for the habitat, 27.1 km for the seed and 85.8 km for the colony. The
deployment animation and the stowed part describe two different objects.

Fix: derive it. The sail now folds as a hexagonal flasher, and `stowedEnvelope()` returns
`2 R sqrt(lambda_fold)` across by `layers x film thickness` deep, so the part, the animation and the
fold finally describe one object (see `CENTAURI-FLASHER.md`).

### F8. Film mass and mast mass come from unrelated laws -- MAJOR

`mastPart()` is 0.6 kg/m of CFRP lattice; the film is the payload mass. So:

| class | film | mast | ratio |
| --- | --- | --- | --- |
| smallsat | 10 kg | 2.1 kg | 5:1 |
| lander | 1,000 kg | 3.2 kg | 310:1 |
| capsule | 10,000 kg | 7.7 kg | 1,297:1 |
| habitat | 100,000 kg | 24.0 kg | 4,175:1 |
| seed | 1,000,000 kg | 128.9 kg | 7,758:1 |
| colony | 10,000,000 kg | 15.3 kg | 653,595:1 |

A 129 kg lattice deploying and holding 1,000 t of film, or 15 kg holding 10,000 t, is not a structure.
The film is in tension under light pressure (a few kN), but its own mass still has to be deployed and
held, and the load path into the hull is not modelled at all.

Fix: mast/boom mass scaled to film mass and tension, with spreader booms and stays for the large
classes; or, for the colony, a spin-stabilised or centrifugally deployed film instead of a mast.

### F9. The node is understated by 2.3x -- MAJOR

`node-unity` is 5,000 kg with a comment saying Unity is 11.9 t berthing mass. The habitat carries one
(under by 6.6 t) and the seed four (under by 26.5 t).

Fix: 11,612 kg, and the same audit for the other catalogue rows whose comments say "unverified".

### F10. The cargo cans are wider than the stack they are bolted to -- BLOCKER

`cargoPart()` sizes an equal-diameter can at 100 kg/m3:

| class | cargo | can | volume | port it hangs on |
| --- | --- | --- | --- | --- |
| habitat | 79.5 t | **10.04 m** dia x 10.04 m | 795 m3 | CBM (2 m hatch) |
| seed | 774.5 t | **21.44 m** dia x 21.44 m | 7,745 m3 | CBM (2 m hatch) |

A 21.4 m pressurised can on a 2 m berthing ring is not buildable, and its volume is counted as
`pressurised`, which is where the fake "154 m3 per crew" comes from. This is also the ugliest thing
in the CAD: a fat drum between the last lab and the collar.

Fix: cargo as unpressurised pallets or a chain of <= 4.4 m modules, split across several cans, with
pressurised and unpressurised volume separated. Re-cut **v1 and v2**.

## Per class

### v1

**wafer** -- 2 g total, film on the chip's own hub. Legitimate in mass; the coil (0.5 g) is an
assertion with no law behind it, and F5 applies. There is no comms or attitude hardware for a 4 m
sail, which at this scale is the whole mission. *Fix: F5, plus a stated coil mass law.*

**smallsat** -- **BLOCKER**: the solver flags `dispenser.fore carries 24.1 kg, above the cubesat-6u
rating of 14 kg`. A 6U dispenser cannot hold a 12 kg bus, a 10 kg film and itself. Also the 10 kg
"payload" is inside the 12 kg bus rather than additive, so the class is 50 % under-mass. *Fix: a 12U
or 27U bus, or a 937 mm adapter; make the payload a part.*

**instrument** -- 150 kg bus described as 100 kg payload + 50 kg bus, so the payload exists only in a
comment; there is no instrument part, no antenna. 0.54 km film on a 1.2 m bus, 2.3 kg mast. *Fix: an
instrument part; F6.*

**lander** -- **BLOCKER**: the one-tonne payload is missing. The assembly is 500 kg of lander plus
120 kg of legs, carrying a 1,000 kg film, so the "1 t lander" ships no lander. Its 1.71 km film hangs
on a 3.2 kg mast above 2.5 m legs. The NTR version is worse: 548 t wet, 82 m of stack, on four legs
sized for 1 t. *Fix: add the payload; make the drive a transfer stage that is left in orbit.*

**capsule** -- **BLOCKER**: `service.fore carries 17.4 t, above the 1.19 m rating of 8 t` -- its own
solver says so. Ten tonnes of film through a 420 kg IDSS stage on a 7 t capsule; four crew for a
two-year boost in 9.3 m3 with no consumables or shielding; and the Orion version carries 981 t of pulse
units through a **1.2 m** docking ring. The re-cut gave it an 8.8 m magazine instead of a 33.7 m tank,
but the 1.2 m interface still carries 1,032 t. *Fix: a rated thrust structure and the crew-days model.*

**habitat** -- payload is fully accounted (2 labs + cargo + node + collar + PMA + arrays + radiators
= 111.6 t) but: the 10 m cargo can (F10); **no crew quarters at all** -- a "crewed habitat" whose only
habitable volume is two laboratories with 6 bunks, which is why v2 has to add a ring for 24 people;
100 t of film on a 24 kg mast (F8); and the fusion module was 54 m across on a 73 m hull (20.6 m after
the re-cut). Power is consistent (62 kW of arrays against 0.5 kW of loads, 59 kW of radiators). *Fix: F8, F10, quarters, F6.*

**seed** -- 1,006.6 t of ship and 1,000 t of film, 20 labs and 4 nodes. The 21.4 m cargo can (F10) is
the worst in the fleet; 1 Mt of film on a 129 kg mast (F8); the Daedalus module is 34,250 t with a
24.6 m magazine around a 351 m stack, i.e. the drive outweighs the colony 34:1. *Fix: F8, F10.*

**colony** -- 20,036 t (10,000 t ship, 10,000 t film). Three things are wrong: the **194 km film hangs
on a 22 m mast** (F8, 653,595:1); **v1 hangs its arrays and radiators on the spinning ring** (v2 fixes
it, so v1 is knowingly wrong and pinned); and the 2 MW "hotel load" is an invented 2 kW/person figure
served by two 1.1 MWe reactors, while the 62 kW of blankets could never have carried it. The 10 kt
ring turns on a 4.2 t despin hub through `hinge-1d`. *Fix: F8, re-cut v1 with the despun utilities,
size the load from a stated per-crew budget, rate the bearing.*

### v2 (spin rings)

**habitat-spin** -- 622.7 t: a 409 t ring for 24 crew on a 211.7 t habitat, so the ring is twice the
ship. Ring laws check out (55.9 m, 843 m2, 35.1 m2/person, 23.4 m/s rim), but it hangs on a **1.8 t
bearing carrying 4.0 MN** (227:1) with no load rating, through a hinge port. The 24 crew also appear
nowhere in the hull: no quarters, no life support (F6). *Fix: rate the bearing, add ECLSS, re-cut.*

**seed-spin** -- 3,559 t, ring 1,550 t, 15.2 MN radial load on the same 1.8 t bearing (861:1). Ring
mass is 0.4 % of the ship, so the ring is not the problem; the bearing and the missing ECLSS are.
*Fix: bearing sizing, F6.*

**colony-spin** -- 19,544 t, ring 9,508 t on the 4.2 t despin hub: **93.2 MN** radial load, 2,264:1,
again through `hinge-1d`. This is the version that got the utilities right (arrays and radiators on
the despun hub), and it is the only reason the colony is defensible. *Fix: a real bearing sized for
93 MN, re-cut.*

### v3 (drives)

F1-F5 are fixed in the re-cut (§0). What remains, per class:

- **wafer-pellet / smallsat-pellet** -- the coil is bolted to a hardpoint with no frame, because a 1 g
  craft cannot carry one, and the stream is now sized from hull plus stream (F5). The smallsat still
  inherits the 6U overload from its hull, and the wafer's 0.5 g coil is still an assertion.
- **instrument-ion** -- 34.1 t wet on a 150 kg bus: 32 t of xenon in a 2.2 m x 6.6 m tank, and a
  0.236 N engine that cannot move it anywhere (11,800 years). The tank now holds its propellant (F2),
  but the module is still bolted to a 1.2 m bus, and an ion stage should be a transfer stage.
- **lander-ntr** -- 548 t wet on a 2.5 m lander with 1 t legs: the drive is 880x the lander's mass.
  It is now drawn as the NERVA stage it is (11.9 m x 71.7 m tank, four bells, 259 m2 of radiator),
  which makes the mismatch visible instead of hiding it. Still the least legitimate model here.
- **capsule-orion** -- 1,032 t, 981 t of pulse units in an 8.8 m x 17.5 m magazine (6,538 units of
  150 kg), behind a 12.7 m plate on eight absorbers. 1 MN on a 40 kg/m2 capsule structure is still
  unchecked, and the interface is still the capsule's 1.2 m docking ring.
- **habitat-dfd** -- 3,990 t of module on a 111.6 t habitat: the drive is 36x the ship. It is now a
  20.6 m x 123 m tank with four bells and 8.7 m2 of radiator, so the drawing no longer claims 54 m of
  hydrogen and 8 MW of cooling. A habitat still does not carry its own interstellar drive.
- **seed-daedalus** -- the one that arguably works: 34,250 t wet, 9.85 % c, 46 years, a 15 t thrust
  frame, a 24.6 m x 148 m pellet magazine and 6,540 m2 of radiator. The 40 t engine is still bolted
  to an interface rather than integrated with a designed thrust structure.
- **colony-pulse** -- 326,000 t, 8.96 % c, 76 years: 309,700 t of pulse units in a 65.7 m x 197 m
  magazine, a 95 m plate, 3,970 m2 of radiator. The 10 t frame for 5 MN is the 1 kg per 500 N rule,
  not a stress design.

## What to fix, in order

1. **Structural interfaces (F1)** -- done 2026-11-08: `hardpoint` port type and a thrust frame of
   `max(50 kg, F/500)`. Re-cut v3.
2. **Tank and magazine geometry (F2, F3)** -- done 2026-11-08: density-driven envelopes, pulse-unit
   magazines, pusher plate and shock absorbers. Re-cut v3.
3. **Drive thermal (F4)** -- done 2026-11-08: jet-power heat rejection, radiator area and four drawn
   panels. Re-cut v3.
4. **Cargo as pods (F10)** -- <= 4.4 m cans or unpressurised pallets, pressurised volume separated
   from unpressurised. Re-cuts v1 and v2, and removes the worst CAD artifact.
5. **Payload audit (lander, smallsat, instrument)** -- the lander is missing its tonne; make payload
   a part in every class. Re-cuts v1.
6. **Sail support structure (F8) and stowed envelope (F7)** -- mast mass from film mass and tension;
   a drum or boom that matches the fold. Re-cuts v1 and v2.
7. **Crew systems (F6)** -- ECLSS, consumables, shielding, RCS and comms, sized by crew-days and
   mission duration. Re-cuts v1, v2 and v3.
8. **Bearing sizing (v2)** -- a bearing rated for 4.0 / 15.2 / 93.2 MN instead of a 1.8 t placeholder.
   Re-cuts v2.
9. **Colony v1 utilities** -- arrays and radiators off the spinning ring (see the colony entry).
   Re-cuts v1, or ships as a corrected v1.1 with v1 kept as the recorded mistake.
10. **Node mass and catalogue comments (F9)** -- 11,612 kg for Unity; audit every row whose comment
    admits a guess. Re-cuts v1, v2 and v3.

Items 1-3 were code bugs with a defensible answer and no design decision, and were done in one pass
on 2026-11-08 (§0); they re-cut v3 and moved every v3 mass. Items 4-10 change what the ships are and
should be decided per class, because each one moves masses that are already pinned.
