# Centauri fleet -- systems inventory (v4, the realism pass)

What each of the eight classes has to carry, sized from its mission, with the law and the source
behind every number. The numbers here are the ones `parts/fleet-v4.js` produces through
`parts/inventory.js` and `parts/primitives/spec.js`; the node checks (`centauri-fleet.test.mjs`,
v4 section) hold them to the laws, and `parts/fleet-versions.js` pins them as v4. The master list of
component types is `CENTAURI-COMPONENT-INVENTORY.md`; the primitive API is `CENTAURI-PRIMITIVES.md`;
what moved against v1-v3 and why is in `CENTAURI-VERSIONS.md`.

## 0. The laws, once

**Per person-day** (NASA-STD-3001 Vol 2; BVAD, NASA/TP-2015-218570): O2 0.84 kg, CO2 1.04 kg,
water 3.6 kg (2.0 drink, 0.5 food preparation, 1.1 hygiene), dry food 0.62 kg taken as 1.2 kg of
packaged dehydrated food (BVAD gives 1.83 kg wet with packaging; the dehydrated figure assumes the water
is recovered), crew supplies 0.3 kg (clothing, hygiene, wipes), stored waste 0.12 kg (volume only;
its mass is the food and supplies already counted), nitrogen leakage 0.0005 kg per m3 of cabin per
day (ISS ~0.1 kg/d over ~900 m3).

**Closure** (`CLOSURE`): the ISS as flown is 90 % water and 50 % O2 from CO2; NASA's Mars-class targets
are 98 % water and 75 % O2 (`advanced`); `greenhouse` adds 90 % O2 and half the diet grown; `closed`
(world ship) is 99 % water, 95 % O2, 90 % of the diet grown and 80 % of textiles and consumables
remanufactured. On a mission longer than a year the O2 make-up is carried as **water** and
electrolysed (0.89 kg O2 per kg), because a COPV weighs half its contents and a water bladder 8 %;
the gas tanks then hold one cabin fill plus 30 days.

**ECLSS hardware**: 1,500 kg + 500 kg/person (the ISS US-segment OGA, CDRA, WRS x2 and TCCS racks are
~2.5 t for six), 1.4 kW/person. **Greenhouse** (BVAD): 50 m2/person for a full diet, 100 kg/m2 wet with
trays, 350 W/m2 of LED lighting. **Hotel load**: 2 kW/person plus the ECLSS plus the greenhouse.
**Volume** (NASA-STD-3001): 30 m3/person pressurised for years, 25 for months, 2.3 for weeks (Orion).
**Crew fittings** (ISS, JSC-65828 class): CQ 200 kg each, WHC 1,400 kg per four, galley 300 kg per
six, ARED 300 kg + T2 1,000 kg per six on a long mission, CHeCS medical 300 kg + 50 kg/person, xEMU
suits 180 kg each for up to four plus 200 kg of tools. **Storm shelter** (DRA 5.0): 20 g/cm2 of water
over 1.5 m3/person, the water being the stores water, so the shelter carries only bladders (8 %).
**Spares**: 10 % of dry hardware, +1 %/yr past a decade, capped at 30 % where a workshop remanufactures
(ISS ORU experience is 1-2 %/yr with 1990s hardware).

**Power**: there is no sunlight on this route, so a crewed class carries a fission reactor sized at
1.25x the hotel load with a specific mass of `150 sqrt(40 kWe / P)` kg/kWe (FSP 40 kWe ~ 6 t,
Kilopower 10 kWe 1.5 t, MW-class studies 10-20 kg/kWe), 25 % conversion, its own 600 K heat-pipe
radiator at 5 kg/m2, on a truss boom behind a shadow shield; a probe carries an MMRTG (2.4 We/kg,
Pu-238 decay over the cruise); the wafer a 0.1 W radioisotope source in its gram. **Thermal**: the
hotel load leaves through two-sided radiators at 290 K (eps 0.9, fin efficiency 0.85, 614 W/m2,
8.8 kg/m2 ISS PVR class). **MMOD**: stuffed Whipple 10 kg/m2 over the pressurised hull (plain 5 kg/m2 on
a probe), 20-layer MLI 0.5 kg/m2, and a bow dust shield at `60 (beta/0.12)^2` kg/m2 (Daedalus's 50 t
beryllium disc), 42 kg/m2 at 0.1 c. **GNC**: star trackers, IMU, sun sensors, redundant computers,
rendezvous lidar on the crewed classes (6 kg probe / 60 kg crewed, scaled by cube root of dry mass);
reaction wheels below 50 N m s (0.6 kg per N m s), CMGs above (272 kg per 4,760 N m s, ISS DGCMG),
with a slew requirement that falls as 1/sqrt(I) so a world ship slews at 1e-5 rad/s. **Comms**: an
X-band dish at 6 kg/m2 (Voyager 3.7 m ~ 50 kg) and a laser terminal at 60 kg/m2 of aperture (DSOC
0.22 m ~ 30 kg). **RCS**: 5 mN per kg of ship in total authority (ISS 0.3, Dragon 700), in quads of
at most 25 kN, never fewer than two, R-4D-class thrusters (3.6 kg per 490 N, 30 g floor) x 6 for the pod.

**Delta-v the sail cannot give** (`deltaVBudget`): 15 m/s post-boost trim and sail separation, 2 m/s
per cruise year of mid-course correction (New Horizons used ~20 m/s in 9 years), 20 m/s terminal
pointing, 1 m/s per year of attitude propellant equivalent, and for a ship that stops 400 m/s of
chemical residual after a **magsail** has shed the cruise speed (a chemical stage cannot shed 0.1 c;
Zubrin & Andrews 1991 and Perakis & Hein 2016 size a magsail/electric-sail brake at the order of
10 % of the decelerated mass, which is the figure used, as a mass only). The trim/braking stage is a
storable bipropellant stage (Isp 320 s; 230 s hydrazine on the probe; 70 s cold gas on the smallsat)
sized by the rocket equation on everything it pushes after the film, mast and canister are gone, with
tanks at 10 % of the propellant and an engine at 0.05 g.

**The sail's own systems** (`sailSystemsFor`): the film is a spin-stabilised hexagonal flasher
(parts/flasher.js); the fold law gives the planar intermediate at 1/sqrt(lambda) of the span across,
and the gores are then rolled onto the hub drum, so the stowed volume is the film volume x 8 (LightSail
2 packs 32 m2 of 4.5 um film about 10:1). The **canister** is a CFRP drum of that volume with l = d,
0.1 % of the diameter in wall (0.8 mm floor, 30 mm cap), hub winding motors at 0.12 kg x film^0.8 and
latches at 2 % of the film; **tip masses, retroreflectors and beacons** at the six rim corners (20 g at
10 m radius, scaling sqrt(R)) give the station the film's edge; **tension actuators and tip vanes** at
2 % of the film trim the sail with photon pressure; the **hub gimbal** (1 % of the film) is the load path
into the mast and the jettison plane, with separation nuts. The **mast** is a lattice truss sized from
the sail thrust `2 eta P / c` it carries in compression (audit F8), standing the film 15 % clear of the
structure forward of its mount. The **film temperature** is the two-sided grey-body equilibrium at the
boost flux with absorptance 1e-5 and emissivity 0.5 (Atwater et al. 2018), against a 1000 K limit. The
film is refolded onto the hub before planetary approach and for dust storms, shadows the payload during
the boost (which is why no sail version relies on arrays), and is cut free at the hub if it cannot be
refolded. Rim booms and shroud lines exist in the library for boom-supported small sails; the v4 sails
are all spin-stabilised and use neither.

## 1. Wafer probe (`wafer-v4`) -- 1 g StarChip, 44-year flyby

| Item | Mass | Source |
| --- | --- | --- |
| processor and memory | 200 mg | Starshot sub-gram SoC |
| 4 cameras | 100 mg | Starshot |
| 1 W laser transmitter, film-as-aperture receiver | 200 mg | Parkin 2018 |
| Pu-238/Am-241 RTG 0.1 W and battery | 150 mg | Starshot |
| 4 LED photon thrusters | 100 mg | Starshot |
| leading-edge Be-Cu dust shield | 150 mg | Starshot (ISM dust at 0.2 c) |
| retroreflector and beacon | 100 mg | derived |
| hub ring and spin release, rim patches, tip vanes | 64 mg | 3 %, 1 %, 2 % of film |
| **film** | **1.06 g** | Lubin: film = payload |

Total **2.13 g** (v1 2.00 g), sail **2.00 m** (v1 1.94 m), laser **18.7 GW** at the sail for 600 s.
Film temperature **1013 K** at 6.0 GW/m2: within 1.3 % of the 1000 K limit, which is the known
Starshot constraint (the suite asserts "within 5 %" and the lab flags it). No mast, no canister, no
propellant: the chip rides at the hub of its own film.

## 2. Small satellite (`smallsat-v4`) -- 16U free-flyer, 44-year flyby

| Part | Mass | What |
| --- | --- | --- |
| bus-16u | 16 kg | structure 4.5, avionics 2.5, radio + 0.1 m laser terminal 1.2, 5 We RPS 2.2, star tracker/IMU 0.8, harness/thermal 1.8, instrument 3.0 |
| systems bay | 14 kg | PMAD 0.04, radiator 0.05, MLI 0.12, Whipple 1.17, bow dust shield 3.56, GNC 1.5, 4 reaction wheels 0.4, 2 cold-gas quads 1.44, spares 2.4, lightband separation half 3.3 |
| trim stage | 9.4 kg | 8.5 kg of cold gas for 167 m/s at Isp 70 s, tank, 19 N thruster |
| mast | 1.8 kg | 0.8 m truss for 34.5 kN of sail thrust |
| canister | 7.7 kg | 0.52 m drum (0.111 m3 for 0.014 m3 of film), motors, tip masses, vanes, gimbal |
| **film** | **47.1 kg** | 420 m across |

Total **96 kg** (v1 27.1 kg; table 10 kg), sail **420 m** (v1 194 m), laser **5.9 TW** for one day,
film 292 K. The 6U dispenser that carried 24 kg at a 14 kg rating (audit, smallsat) is replaced by an
11.7 in motorised lightband rated to the 450 kg class, so the overload is gone.

## 3. Instrument probe (`instrument-v4`) -- New Horizons class, MMRTG, 44-year flyby

| Part | Mass | What |
| --- | --- | --- |
| bus-probe | 190 kg | structure 80, instruments 30 (imager, spectrometers, dust counter, plasma), avionics 35, thermal 20, harness 25 |
| MMRTG | 72 kg | 110 We at EOL after 44 years of Pu-238 decay (2.4 We/kg at BOL) |
| 2.1 m HGA | 25 kg | 42 dBi at X band, 6 kg/m2 |
| systems bay | 254 kg | 0.3 m laser terminal 14, wheels, PMAD, radiator, MLI, Whipple, bow dust shield (42 kg/m2 over 3.5 m2 = 145 kg), GNC, 2 hydrazine quads, spares |
| trim stage | 47 kg | 42 kg hydrazine for 167 m/s, Isp 230 s |
| mast | 6 kg | 1.2 m truss |
| canister | 76 kg | 1.26 m drum, motors, tip masses, vanes, gimbal |
| **film** | **666 kg** | 1.58 km across |

Total **1.33 t** (v1 252 kg; table 100 kg), sail **1.58 km** (v1 612 m), laser **2.7 TW** for a month,
film 125 K. The RTG hangs on +x and the HGA is offset to -x so the centre of pressure stays 0.16 m from
the thrust line.

## 4. Robotic lander (`lander-v4`) -- aero-capable, stops with a magsail, lands on methalox

| Part | Mass | What |
| --- | --- | --- |
| lander-aero | 4.4 t | 2.4 m x 6.5 m 304L cylinder with a Haack nose: structure 480, nose 90, two 10 kN methalox engines 110, header tanks 70, 250 kg of instruments and sampler, avionics/radar/lidar 60, harness/thermal 90; TPS tiles on the windward half and nose (10 kg/m2 over 28 m2) 280; **landing propellant 1,000 m/s** at Isp 330 s 585 kg and tankage; plus the systems items: wheels, PMAD, radiator, MLI, Whipple, bow dust shield (42 kg/m2 over 4.5 m2), GNC, 2 RCS quads, 0.2 m laser terminal, spares |
| landing gear | 94 kg | four Falcon-style legs, 5.9 m span, 4 % of landed mass at 1.1 g |
| grid fins | 516 kg | four titanium fins scaled from Falcon 9 by (2.4/3.66)^2 |
| MMRTG | 72 kg | 110 We EOL |
| 1.0 m HGA | 9 kg | |
| trim/braking stage | 1.4 t | 1.04 t of storable propellant for 567 m/s (incl. 400 m/s insertion residual), tank, 4 kN engine, **magsail 10 % of the pushed mass** |
| mast | 5 kg | 1.0 m truss for 56 kN |
| canister | 721 kg | 2.76 m drum |
| **film** | **7.21 t** | 5.2 km across |

Total **14.4 t** (v1 1.62 t; table 1 t), sail **5.2 km** (v1 1.94 km), laser **2.4 TW** for a year,
film 67 K. The v1 lander shipped no payload at all (audit, lander); this one carries 250 kg of
instruments and lands them. Open: the interface between the braking stage and the lander (1,575 mm
clampband, 10.9 t rating) carries 12.6 t and is flagged as a load, as the v1 capsule's always was.

## 5. Crewed capsule (`capsule-v4`) -- 4 crew x 30 days, the destination taxi

| Part | Mass | What |
| --- | --- | --- |
| capsule-tps | 7.7 t | Crew Dragon class: pressure vessel 2,400, PICA-X heat shield (12.6 m2 at 15 kg/m2) and backshell quilt 600, nose cone with hinge and NDS active docking system 520, open-loop ECLSS for 4 x 30 d with seats and displays 900, 16 Draco thrusters with 1,400 kg of NTO/MMH 1,900, avionics/batteries/parachutes 880, windows/hatch/30 d of provisions 500 |
| trunk-solar | 1.8 t | body-mounted cells (4 kW) and radiators |
| sail stage | 420 kg | IDSS ring and mast root, jettisoned after the boost |
| mast | 6 kg | 1.1 m |
| canister | 1.08 t | 3.2 m drum |
| **film** | **11.0 t** | 6.42 km across |

Total **22.0 t** (v1 20.4 t; table 10 t), sail **6.42 km** (v1 6.12 km), laser **1.8 TW** for two years,
film 56 K. 9.3 m3 pressurised is **2.3 m3/person**, Orion's figure for three weeks and the standard's
floor for a 30-day endurance. This class **cannot** carry a crew across 4.37 light years -- the audit's
"four crew for a two-year boost in 9.3 m3 with no consumables" stands -- so v4 states what it is: the
destination transfer and landing taxi the habitat and seed carry, flown on its own sail as a stage
demonstrator. Its Dracos cover its own 400 m/s, so it carries no separate trim stage.

## 6. Crewed habitat (`habitat-v4`) -- 6 crew for 50 years, 1 g bola

Mission: 2 years of boost, 44 of coast, 4 at the destination; 98 % water / 75 % O2 closure, stored
food, stops with a magsail. 109,575 person-days.

| Part | Mass | What |
| --- | --- | --- |
| node-harmony | 14.3 t | six CBM berths: lab forward, systems module port, airlock nadir, PMA zenith, bearing aft |
| Destiny lab | 29.6 t | 14.5 t module + **ECLSS 4.5 t** (seven functions), crew quarters 1.2 t, WHC 2.8 t, galley 0.3 t, ARED + T2 1.3 t, medical 0.6 t, EVA suits 0.9 t, storm shelter bladders 0.38 t (the 9 m3 shelter is walled by the stores water), O2 COPVs 80 kg, N2 COPVs 2.6 t, water bladders 0.38 t |
| 6 stores modules | 6 x 46.4 t | 4.4 m x 8.2 m each: shell 7.6 t, and per module 6.1 t of water (incl. the O2 make-up as water), 26 kg O2, 753 kg N2, **21.9 t of food**, 5.5 t of crew supplies, 4.5 t of spares |
| bow dust shield | 663 kg | 42 kg/m2 over the 4.4 m stack face |
| thrust collar | 900 kg | |
| systems module | 9.9 t | 4 CMGs, PMAD and batteries, 3 m HGA, 1 m laser terminal, 8 RCS quads, Whipple and MLI over the hull |
| Quest airlock | 6.1 t | |
| PMA | 1.9 t | docking for the taxi, on the zenith berth |
| spin bearing (v4) | 1.8 t | docks the braking stage on its far face |
| **1 g bola** | **21 t** | two 4.4 x 8.5 m domed pods on two 51 m lattice spokes at 55.9 m, 4 rpm, 23.4 m/s rim |
| 25 m reactor boom + 25.5 kWe reactor | 4.8 t | 1.25x the 20 kW hotel load; shadow shield; 600 K radiator |
| 2 radiator wings | 2 x 146 kg | 17 m2 each at 290 K |
| trim/braking stage | 129 t | 83 t of storable propellant for 573 m/s on the hull after sail jettison, tanks, engine, magsail (10 %) |
| mast | 58 kg | 9.2 m truss for 548 kN |
| canister | 48 t | 11.8 m drum (1,290 m3 for 161 m3 of film), motors, tip masses, vanes, gimbal |
| **film** | **546 t** | 45.2 km across |

Roll-up: **1.09 kt** total (v1 212 t; table 100 t), hull 498 t, **206 t of consumables** (1.88 kg per
person-day), 411 m3 pressurised (**68 m3/person**, needs 30), stores 597 m3 for 519 m3, power 26 kW
generated for 20 kW of load, sail **45.2 km** (v1 19.4 km), laser **91 TW** for two years (v1 18 TW),
film 56 K. The bola replaces a full 3 m torus (409 t in v2 for 24 crew) because six people do not
need 843 m2 of deck: two Destiny-class pods on spokes give 1 g at 70 t less.

## 7. Colony seed (`seed-v4`) -- 20 crew for 50 years, half-diet greenhouse in a 1 g ring

365,250 person-days; 98 % water / 90 % O2, half the diet grown; stops.

| Part | Mass | What |
| --- | --- | --- |
| node-harmony, Destiny lab, Columbus lab, second Harmony | 106 t | the lab carries ECLSS 11.5 t, fittings, shelter, gas and water tanks (67 t fitted) |
| 6 stores modules | 6 x 125 t | **6.6 m (Skylab) x 10.8 m** each: shell 16 t, and per module 11 t of water, 1.1 t N2, 36.5 t of food, 18 t of supplies, 14 t of spares |
| bow dust shield, collar | 1.6 t | |
| systems module | 16.3 t | CMGs, PMAD, comms, 8 RCS quads, bumpers |
| airlock, PMA, bearing | 9.8 t | |
| **1 g ring** | **596 t** | 55.9 m radius, **4.0 m tube**, one deck of 1,124 m2 (56 m2/person: 30 habitation + 25 of **greenhouse, 500 m2, 50 t**), 23.4 m/s rim |
| reactor boom + 304 kWe reactor | 17 t | 1.25x the 243 kW hotel load (175 kW of it greenhouse lighting) |
| 2 radiator wings | 2 x 1.74 t | 198 m2 each |
| trim/braking stage | 524 t | 337 t of propellant for 573 m/s, magsail |
| mast | 229 kg | 13.8 m truss for 1.48 MN |
| canister | 190 t | 18.8 m drum |
| **film** | **2.21 kt** | 91 km across |

Roll-up: **4.42 kt** (v1 2.01 kt; table 1 kt), hull 2.02 kt, **428 t of consumables** (1.17 kg/pd with
half the food grown), 3,063 m3 pressurised (**153 m3/person**), stores 1,772 m3 for 1,124 m3, power
304 kW for 237 kW, sail **91 km** (v1 61 km), laser **246 TW** for three years (v1 112 TW), film 51 K.
The v2 seed-spin carried 110 crew in 20 Columbus labs with no life support at all; 20 crew with a
greenhouse and the stores to feed them for fifty years is what a one-kilotonne-class ship actually is.

## 8. Full colony (`colony-v4`) -- 1,000 crew for 50 years, world-ship closure

18.3 million person-days; 99 % water, 95 % O2, 90 % of the diet grown, 80 % of textiles remade; stops.

| Part | Mass | What |
| --- | --- | --- |
| **1 g ring** | **55.6 kt** | 55.9 m radius, **34.5 m tube, 11 decks, 106,600 m2** (107 m2/person: 30 habitation + 45 **farm** (45,000 m2 greenhouse, 4.5 kt, 15.8 MW of lighting) + 32 of stores decks at 2.4 m), 23.4 m/s rim; carries ECLSS 502 t, quarters 200 t, WHC 350 t, galleys 50 t, exercise 217 t, medical 50 t, shelter bladders 12 t, O2/N2 COPVs 196 t, water bladders 17 t, and the stores: 1.65 kt of water, 330 t of N2, **2.19 kt of food**, 1.1 kt of supplies, **11.3 kt of spares** |
| despun hub (fore) and despun aft hub | 2 x 7.1 t | 4.2 t scaled by sqrt(ring mass / 10 kt): the ring is self-supporting in hoop tension; the bearing carries thrust, imbalance and spin-up torque |
| bow dust shield | 4.7 t | 42 kg/m2 over the 12 m hub face |
| collar, two hub adapters | 3.9 t | |
| systems module | 635 t | CMGs 34 t (slewing at 1e-5 rad/s), PMAD and batteries 160 t, 5 m HGA, 2 m laser terminal, 10 RCS quads of 23 kN 41 t, bumpers 400 t |
| airlock, PMA | 8 t | on the hub's two berths |
| two 60 m booms, **two 12 MWe reactors** | 272 t | 1.25x the 19.2 MW hotel load; 11.3 kg/kWe at this size |
| 2 radiator wings | 2 x 137 t | 15,600 m2 each at 290 K |
| trim/braking stage | 19.9 kt | 12.8 kt of propellant for 573 m/s, magsail 5.7 kt |
| mast | 36 t | 99 m truss for 33 MN |
| canister | 5.5 kt | 62.7 m drum (194,000 m3 for 24,200 m3 of film) |
| **film** | **82.2 kt** | 555 km across |

Roll-up: **165 kt** (v1 20 kt; table 10 kt), hull 76.7 kt, **7.8 kt of consumables** (0.43 kg/pd),
257,000 m3 pressurised (257 m3/person), stores 57,800 m3 for 15,200 m3 (the farm and stores decks),
power 23.9 MW for 19.5 MW, sail **555 km** (v1 194 km), laser **5.5 PW** for five years (v1 0.67 PW),
film 45 K. World-ship studies (Hein et al.) put a thousand-person generation ship at 10^5-10^8 t; a
closure-driven 165 kt with 82 kt of it film sits at the light end, and the lab says why: the film is
half of everything, and the stores decks are a third of the ring.

## 9. What v4 does not close, honestly

- The **capsule** cannot cross as a crewed vehicle; it is the taxi, and the lab prints its 30-day
  endurance rather than pretending.
- The **wafer's film** sits 1 % over its 1000 K limit at the table's 600 s boost -- the Starshot
  material problem, reported, not fixed.
- The **magsail** is a mass fraction and a coil drum, not a sized superconducting loop; the 400 m/s
  chemical residual assumes it works.
- The **mast** carries the thrust in compression but is not a stability design; the hub gimbal is a
  mass, not a mechanism.
- The **seed and colony laser powers** (246 TW, 5.5 PW) and sails (91 km, 555 km) are what Lubin's
  film = payload law gives for ships this heavy; the beam trade still says they do not close, and the
  v3 fusion drives remain the answer for those two classes.
- Harness, heat exchangers and pump packages are lumped into their hosts; a manipulator arm is not
  modelled; see the flagged rows of `CENTAURI-COMPONENT-INVENTORY.md`.
