# Centauri Propulsion

The v1 fleet is a set of beam-riders: a laser (or a pellet stream) does the work and the ship carries
a film instead of an engine. That is the right answer for a gram and a bad one for ten thousand
tonnes, because the beam has to be refocused over four light years and the aperture grows with the
square root of the distance while the power grows with the payload. This note is the other half of
the trade: the same eight hulls flown by their own engines.

Nothing here is invented. Every drive is a flown thruster or a published interstellar study, with the
exhaust velocity, thrust, engine mass and tank fraction from that source, and every ship is sized by
the same relativistic rocket equation the sail lab uses.

## The law

```
mass ratio   R = ((1 + b) / (1 - b)) ^ (c / 2 ve)
cruise speed b = (R^(2 ve / c) - 1) / (R^(2 ve / c) + 1)
```

with `ve` the exhaust velocity and `b` the cruise speed as a fraction of c. Below `ve = 0.2 c` this is
Tsiolkovsky's equation to three decimal places, which the checks assert; at fusion exhaust velocities
it is not, and using the classical form there is the usual way this trade gets overstated.

Dry mass is not a free parameter. The engine and the tanks are part of the ship, and the tanks are a
fraction of the propellant they hold:

```
dry  = (hull + engine) / (1 - f (R - 1))
prop = dry (R - 1)
wet  = dry + prop
```

That closed form is why a 6 % tank fraction cannot carry a 20:1 mass ratio -- at R = 20 it would need
114 % of the dry mass in tanks -- so the ratio is capped by what the tankage allows. The solar-electric
ship therefore ends up at 16:1 rather than the nominal 20:1.

The mass ratio is capped at **20:1** (95 % propellant, 5 % ship). Nothing ever flown is close: a Saturn
V first stage is about 0.92. A drive that cannot cross in a century inside that budget is reported as
an inner-system drive, not quietly given a bigger number. The verdict is `trip <= 100 years` to
4.37 light years, so 0.09 c counts and 4,600 years does not.

## The drives

| drive | `ve` | Isp | thrust | engine | tanks | store (bulk) | waste heat | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Beamed pellet stream | 0.10 c | 3.1e6 s | -- | coil only | none | coil, no propellant | -- | pellet-beam propulsion (NIAC): momentum arrives as pellets, no sail to diffract |
| Solar-electric ion | 41.1 km/s | 4,190 s | 0.236 N | 13 kg | 6 % | tank, xenon at 1,400 kg/m3 | 50 % of jet | NASA NEXT-C, 236 mN at 4.5 kW (DART flight unit) |
| Nuclear thermal | 8.83 km/s | 900 s | 333 kN | 10.5 t | 3 % | tank, LH2 at 70 kg/m3 | 2 % | NERVA NRX/XE, liquid hydrogen |
| Fission pulse | 39.2 km/s | 4,000 s | 1 MN avg | 20 t | 2 % | magazine, 150 kg units at 1,000 kg/m3 | 0.05 % | Project Orion pulse units, pusher plate and shock absorber |
| Direct fusion | 98.1 km/s | 10,000 s | 100 N | 12 t | 2 % | tank, D-He3 at 100 kg/m3 | 20 % | Princeton PFRC direct fusion drive, 1-10 N per MW |
| Inertial fusion pulse | 0.033 c | 1.0e6 s | 7.5 MN | 40 t | 2 % | magazine, pellets at 500 kg/m3 | 0.002 % | Project Daedalus (BIS 1978), D-He3 pellets, two stages |
| Fusion pulse | 0.030 c | 9.2e5 s | 5 MN | 60 t | 2 % | magazine, 500 kg units at 500 kg/m3 | 0.002 % | Dyson, *Interstellar Transport* (1968): 10 Mt ships, 3 % c |

The `store` column is what the model draws, not a label: a liquid tank whose envelope follows from the
propellant's bulk density and a stated length/diameter ratio, or a magazine where the propellant is
discrete. `waste heat` is the share of jet power `F ve / 2` that has to be rejected rather than leaving
in the exhaust. It is an assumption, stated per drive, and it sizes the radiator at 1000 K two-sided
(113 kW/m2).

## The ships

One drive per class, chosen for the mass rather than for variety: an engine does not scale down to a
gram, and a beam does not scale up to a colony.

| class | drive | hull | wet | propellant | R | cruise | crossing | closes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wafer probe | pellet beam | 1 g | 1 g | 0 (1 g of pellets) | -- | 0.10 c | 44 yr | yes |
| smallsat | pellet beam | 15 kg | 15 kg | 0 (15 kg of pellets) | -- | 0.10 c | 44 yr | yes |
| instrument | solar-electric ion | 150 kg | 34.1 t | 32 t xenon | 16:1 | 0.038 % c | 11,800 yr | no |
| lander | nuclear thermal | 620 kg | 548 t | 521 t LH2 | 20:1 | 0.0088 % c | 49,500 yr | no |
| capsule | fission pulse | 10.0 t | 1,032 t | 981 t of pulse units | 20:1 | 0.039 % c | 11,200 yr | no |
| habitat | direct fusion | 111.6 t | 3,990 t | 3,790 t D-He3 | 20:1 | 0.098 % c | 4,640 yr | no |
| seed | inertial fusion (Daedalus) | 1,006.6 t | 34,250 t | 32,530 t of pellets | 20:1 | 9.85 % c | 46 yr | yes |
| colony | fusion pulse (Dyson) | 10,036 t | 326,000 t | 309,700 t of pulse units | 20:1 | 8.96 % c | 76 yr | yes |

The beamed rows carry no propellant at all: the momentum arrives as magnetised pellets, so the ship
is a coil and the accelerator stays home. The stream is the propellant and every pellet ends up in the
ship, so the mass that has to reach cruise is the hull plus the stream:
`stream = hull k / (1 - k)` with `k = beta c / 2u`. That is 1 g of pellets for the 1 g wafer and 15 kg
for the 15 kg smallsat, against the 0.5 g and 7.5 kg the first cut sized from the hull alone. The
station spends 450 GJ accelerating the wafer's stream and 6.8 PJ the smallsat's.

The four that close are the two beamed classes and the two fusion-pulse ships. That is the honest
result of the trade: **below about a tonne, beam the ship; above about a thousand tonnes, give it a
fusion pulse unit magazine; in between, no drive reaches 0.1 c and the mission is a different one.**
The ion, nuclear-thermal, fission-pulse and direct-fusion versions still exist as ships in the
catalogue because the same hull is what flies to Jupiter, and the lab prints their real numbers
rather than pretending they are interstellar craft.

## The stage, as built

`planFor()` sizes the whole stage, not just its mass, and `driveCAD()` draws exactly what it returns: a
thrust frame from the hull's hardpoint out to the store, the store itself, the aft bay and the
radiators.

| class | thrust frame | propellant store | aft end | radiator | heat rejected |
| --- | --- | --- | --- | --- | --- |
| instrument-ion | 50 kg | tank, 2.2 m x 6.6 m | four bells | 0.02 m2 | 2.4 kW |
| lander-ntr | 666 kg | tank, 11.9 m x 71.7 m | four bells | 259 m2 | 29.4 MW |
| capsule-orion | 2,000 kg | magazine, 8.8 m x 17.5 m, 6,538 units of 150 kg | 12.7 m pusher plate on eight absorbers | 86 m2 | 9.8 MW |
| habitat-dfd | 50 kg | tank, 20.6 m x 123 m | four bells | 8.7 m2 | 0.98 MW |
| seed-daedalus | 15,000 kg | magazine, 24.6 m x 148 m | 36 m pusher plate on eight absorbers | 6,540 m2 | 742 MW |
| colony-pulse | 10,000 kg | magazine, 65.7 m x 197 m, 619,402 units of 500 kg | 95 m pusher plate on eight absorbers | 3,970 m2 | 450 MW |

Three laws behind that table:

- **Store.** `d = cbrt(4 u V / (pi s))` for propellant volume `V`, ullage `u = 1.08` and a stated
  length/diameter ratio `s` (2 for the Orion magazine, 3 for xenon and Dyson's magazine, 6 for the
  hydrogen and Daedalus stores). The store holds the propellant plus 8 %, where the first cut drew
  2.4 to 3.6 times it -- 33.7 m across for the capsule, against 8.8 m now.
- **Frame.** `max(50 kg, F / 500 N per kg)`: 2 t for Orion's 1 MN, 15 t for Daedalus's 7.5 MN, and
  the 50 kg floor where the thrust is small enough that the frame is a bracket.
- **Heat.** `f F ve / 2` with `f` the drive's stated share, rejected at 1000 K two-sided across four
  panels, two a side on booms. It is small on a pulse ship, whose plate carries its pulse energy away
  with the plasma, and large on a fusion ship, whose losses are not in the exhaust.

## Why these drives

- **Wafer and smallsat -- pellet beam.** The film is gone, so there is no aperture to build and no
  diffraction: the stream is pellets, and the coil that catches them is microscopic. Mass matters
  more than anything else at a gram.
- **Instrument -- solar-electric ion.** A 4.5 kW thruster and tens of kilograms of xenon is what
  actually flies this class of mission today, and its arrays are already in the hull.
- **Lander -- nuclear thermal.** High thrust for a descent stage, and 900 s does not care that it is
  poor at 0.1 c, because the lander never needed to go there.
- **Capsule -- fission pulse.** A pusher plate is a capsule-shaped structure: the crew sits in the
  capsule and the pulse units are the stage the sail used to be.
- **Habitat -- direct fusion.** 10,000 s is the best specific impulse that fits in a hull this size,
  and the crew needs decades of hotel power anyway, which the same reactor supplies.
- **Seed -- Daedalus.** The only studied drive that reaches 0.1 c inside a 20:1 mass ratio. Two
  stages, D-He3 pellets, and a 1,000 t payload.
- **Colony -- fusion pulse.** Dyson's scaling law: add pulse units and the ship grows. The colony
  already weighs 10 kt, so the magazine and the pusher plate are structure it can afford.

## What changed in the model

- `parts/propulsion.js` -- the drive table (with its bulk densities, store kinds and waste-heat
  share), the relativistic rocket law and `planFor()`, which solves the whole stage: thrust frame,
  store envelope, aft bay and radiator area, as well as dry mass, propellant, boost and crossing time.
- `parts/parts.js` -- a rigid `hardpoint` port type, and `drivePart()`: frame, store, bay and
  radiators in one module whose mass and envelope come from the plan, bolted to the hardpoint.
- `parts/fleet.js` -- `PROPELLED` (v3, eight ships) and `propelledAssembly()`: the v1 hull, the sail
  and mast removed, and the host's mount retyped to a hardpoint on a copy, so v1 and v2 keep their
  hinges while the driven assembly presents a rigid interface. The capsule's jettisonable sail stage
  is gone too, so its drive is bolted to the capsule's own IDSS face.
- `parts/centauri-models.js` -- `driveCAD()` draws the frame, the tank or magazine, the nozzle cluster
  or the pusher plate on its shock absorbers, and the radiator panels; `buildCentauriModel()` has a
  no-sail path for the driven ships.
- `parts/fleet-versions.js` -- `v3`, the eight driven ships pinned by mass, hull mass, wet mass,
  cruise speed and verdict, re-cut on 2026-11-08 for the stage above.
- `vehicle-models.js`, `data/vehicles/ships.json` -- eight `centauri-<class>-<drive>` entries.

Two things are *not* in this version: the pellet stream is a momentum budget rather than a modelled
accelerator, and the waste-heat share `f` is an engineering assumption rather than a thermal model --
the panels are drawn at the size that assumption gives, and a real thermal design would move them.
Both are stated here rather than hidden in a number.
