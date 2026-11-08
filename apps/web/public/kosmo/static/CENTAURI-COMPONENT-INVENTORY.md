# Centauri component inventory -- the master list

Every component type a real spacecraft of these eight classes needs, organised by subsystem, with a
flown or studied reference for each, the classes and versions that need it, the primitive that builds
it (`parts/primitives/spec.js` for the numbers, `parts/primitives/mesh.js` for the geometry) and its
status in this repository. The per-ship sizing that follows from this list is `CENTAURI-INVENTORY.md`;
the primitive API is `CENTAURI-PRIMITIVES.md`.

Sources used throughout: NASA-STD-3001 Vol 2 (habitable volume, consumables), the Baseline Values and
Assumptions Document (NASA/TP-2015-218570, BVAD 2018), NASA-STD-5005 (ground systems -- out of scope
here but cited where a GSE interface drives a flight part), JSC-65828 (ISS hardware masses: ORUs, racks,
CQ, WHC, ARED, CMG), ISS press kits (Columbus, Destiny, Harmony, Quest, SAW, PVR), SpaceX Crew Dragon
and Starship public figures, Orion/ESM (ESA), Soyuz, Gateway (PPE/HALO), the Mars DRA 5.0 and Deep
Space Transport studies, IDSS IDD Rev F, ECSS-E-ST-32 (structures) and ISO 24113 (debris) for the
MMOD/EOL rows, and for the interstellar classes Project Daedalus (BIS 1978), Project Icarus, Dyson's
*Interstellar Transport*, Lubin's *A Roadmap to Interstellar Flight*, Parkin's Starshot system model
(2018) and Atwater et al. (2018) on the lightsail material.

Classes: **W** wafer, **S** smallsat, **I** instrument probe, **L** lander, **C** capsule, **H** habitat,
**Se** seed, **Co** colony. Versions: v1 sail, v2 spin ring, v3 own drive, v4 realism pass. Status:
**exists** (in the catalogue or a builder before this pass), **extend** (existed, now sized by a
primitive or given a real figure), **new** (added in v4), **flagged** (required by a standard, not yet
modelled -- listed so it is not an afterthought).

## 1. Structure

| Component | Reference (mass / size / power) | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Primary structure, pressure-hull barrel | Columbus 10,275 kg / 6.9 x 4.5 m; Destiny 14,515 kg / 8.5 x 4.2 m | H, Se, Co (v1-v4) | `hullSegmentSpec` -> `hullSegmentMesh` | extend |
| Secondary structure (racks, standoffs) | ISS ISPR 104 kg empty; 35 kg/m2 fit-out | H, Se, Co | inside `hullSegmentSpec.fitOutKgM2` | extend |
| Node with radial berths | Unity 11,612 kg (6 CBM); Harmony 14,288 kg / 7.2 x 4.4 m | H, Se (v1-v4) | catalogue `node-unity`, `node-harmony` (new) | extend |
| Interstage / thrust frame | S-IVB forward skirt 1,600 kg; 1 kg per 500 N law | all v3; L, I v4 stage | `thrustFrameSpec` | exists |
| Lattice truss / deployable boom | ISS ITS P1 ~ 14 t / 13.6 m; ADAM mast 1-3 kg/m | H, Se, Co v4 (reactor booms, bola spokes, mast) | `trussSpec` -> `trussMesh` | new |
| Bulkheads, end cones / domes | Columbus end cones; Starship 304L domes | all pressurised; L v4 | `domeProfile`, `hullSegmentSpec.endKind` | new |
| Hardpoints | drive hardpoint (v3), mast root, reactor boom root | all | port type `hardpoint`, `hinge-1d` mounts | exists |
| Separation systems | PSC Mark II MLB 11.7 in 3.3 kg (450 kg class); 937/1194/1575 clampbands (RUAG) | S, I, L, C | port types `lightband-12` (new), `paf-*` | extend |
| Shock absorbers (pulse plate) | Orion two-stage absorber; 8 struts in the v3 CAD | C-orion, Se-daedalus, Co-pulse (v3) | `driveCAD` | exists |
| Gimbals | sail hub gimbal (1 % of film); engine gimbal (in bell T/W) | all sail; v3 | `sailSystemsFor` item | new |
| Spin bearing / despun hub | 4 m roller + magnetic bearing 1.8 t; 10 m hub 4.2 t scaled by sqrt(ring mass) | H, Se, Co (v2, v4) | catalogue `spin-bearing`, `despin-hub`, `BEARING_V4` | extend |
| Hub-to-stack adapter ring | 10 m hub face to 4.6 m CBM, 1.5 t | Co v4 | derived in `fleet-v4.js` | new |

## 2. Pressure vessels and hull segments

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| MPLM / stores module | Leonardo PMM 9,896 kg / 6.4 x 4.6 m, 31 m3 cargo | H, Se v4 | `storesModules()` on `hullSegmentSpec` (shell 45 + 15 kg/m2) | new |
| Inflatable module | BEAM 1,413 kg, 16 m3; B330 20 t / 330 m3 | -- | `hullSegmentSpec` with low shellKgM2 | flagged (not used: no flown long-duration data) |
| Node | see 1 | H, Se | catalogue | extend |
| Cupola | ISS Cupola 1,805 kg, 7 windows | -- | `windowSpec` x7 | flagged |
| Airlock | Quest 6,064 kg / 5.5 x 4.0 m, 34 m3 | H, Se, Co v4 | catalogue `airlock-quest` (new) | new |
| Spin-ring deck | Stanford torus 1.8 km / 130 m tube; v2 law 250 kg/m2 floor, 60 kg/m2 shell | H (v2), Se, Co (v2, v4) | `torusDeckSpec` / `centrifugePart` -> `torusDeckMesh` | extend |
| Two-pod bola | Mars tether / bola studies; two Destiny-class pods on 55 m spokes | H v4 | `bolaPart()` on `hullSegmentSpec` + `trussSpec` | new |
| Capsule pressure vessel | Crew Dragon 9.3 m3, ~7.7 t dry capsule; Orion CM 8.95 t | C (v1-v4) | catalogue `capsule-4m`, `capsule-tps` (new) | extend |

## 3. Tankage

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Cryogenic tank (LH2, LCH4, LOX) | Starship 304L 1.5-4 mm; S-IVB 2219; 70 kg/m3 LH2 | L v3 (NERVA), L v4 landing methalox | `tankSpec` (material, pressure, insulation) -> `tankMesh` | new |
| Storable propellant tank | Dragon NTO/MMH, ~1,400 kg load; Orion ESM 8.6 t | C, I, L, H, Se, Co v4 (trim stage) | `kickStageSpec` -> `tankSpec` | new |
| High-pressure gas (COPV) | ISS NORS tanks 25 MPa; Type IV ~150-300 kJ/kg | H, Se, Co v4 (O2, N2) | `copvSpec` -> `copvClusterMesh` | new |
| Water tanks / bladders | ISS CWC 20 L bags; Shuttle 75 kg tanks | H, Se, Co v4 | `tankSpec` at 150 kPa, doubling as the storm-shelter wall | new |
| Waste tanks | ISS UPA brine, WHC solid waste cans | H, Se, Co v4 | volume in `consumablesFor` (waste storage allowance) | new |
| Pulse-unit magazine | Orion 150 kg units at 1,000 kg/m3; Daedalus pellets 500 kg/m3 | C, Se, Co v3 | `storeFor` in propulsion.js | exists |
| Feedlines, valves, pumps, PMD, baffles, vents | ~25 % of shell mass (tank fittings fraction) | all tanks | `tankSpec.fittingsFraction` | new (lumped) |
| Pressurant (He) | ~1-3 % of propellant | trim stages | `kickStageSpec.tankFraction` (lumped) | new (lumped) |

## 4. Propulsion

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Main engine bell / nozzle extension | RL10 (T/W 60, Ae/At 280); Raptor; NERVA 10.5 t | L v4 (2 x 10 kN), all v3 | `bellSpec` -> `bellMesh` | new |
| RCS quads / thrusters | Draco 400 N; R-4D 490 N 3.6 kg; cold-gas 30 g microthrusters | all v4 | `rcsQuadSpec` -> `rcsQuadMesh` | new |
| Ion / Hall thrusters | NEXT-C 236 mN, 4.5 kW, 13 kg | I v3 | propulsion.js DRIVES.ion | exists |
| Nuclear thermal | NERVA NRX/XE 333 kN, Isp 900 | L v3 | DRIVES.ntr | exists |
| Pulse plate | Orion 1 MN avg, Dyson 5 MN | C, Co v3 | DRIVES + `driveCAD` plate | exists |
| Fusion drives | PFRC DFD, Daedalus | H, Se v3 | DRIVES.dfd, DRIVES.daedalus | exists |
| Kick / trim / braking stage | Star 48 class; Orion ESM OMS-E 26.7 kN | S, I, L, H, Se, Co v4 | `kickStageSpec` -> `trimStageCAD` | new |
| Magsail deceleration | Zubrin & Andrews 1991; Perakis & Hein 2016 -- 10 % of decelerated mass | L, H, Se, Co v4 | item on the braking stage (coil drum drawn) | new (mass only, loop not modelled) |
| Sail drive (film) | Lubin: film mass = payload, 0.34 g/m2 SiN | all v1, v2, v4 | `sail()` in parts.js, flasher law | exists |
| Beamed pellet coil | NIAC pellet beam | W, S v3 | DRIVES.pellet | exists |
| Ullage motors | Saturn S-IVB APS ullage | -- | `rcsQuadSpec` (RCS settles the tanks) | flagged |
| Landing propellant | Mars-class terminal descent ~1 km/s | L v4 | `kickStageSpec` absorbed into the lander | new |

## 5. Aero and landing

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Ogive / Haack nose, fairing | Falcon 9 fairing 1,750 kg / 13.1 x 5.2 m; Starship nose | L v4 (Haack), C v4 (nose cone) | `ogiveProfile`, `haackProfile`, `fairingSpec` -> `fairingMesh` | new |
| Grid fins | Falcon 9 Ti fins 4 x ~300 kg, 1.5 x 1.2 m | L v4 | `gridFinSpec` -> `gridFinMesh` | new |
| Body flaps | Starship 4 flaps | -- | -- | flagged (lander uses grid fins; flaps if the body is flown lifting) |
| Heat shield (ablator) | PICA-X ~15 kg/m2 at Dragon thickness; Orion Avcoat | C (v1-v4) | `tpsSpec({kind:'ablator'})`; `capsuleCAD` shield lathe | new |
| Base heat shield | Starship skirt; Saturn base heat shield | L v4 | `landerAeroCAD` skirt | new (visual) |
| TPS tiles | Shuttle HRSI ~9 kg/m2; Starship hex tiles ~10 kg/m2 | L v4 windward half + nose | `tpsSpec({kind:'tile'})`, material `tpsHalf` | new |
| TPS quilts / FRSI | 2-4 kg/m2 | C backshell | `tpsSpec({kind:'quilt'})` | new |
| Aero covers | New Horizons RTG cover; sensor covers | -- | -- | flagged |
| Parachutes | Dragon 2 drogues + 4 mains ~3.5 % of landed mass | C (in inventory) | `parachuteSpec` | new |
| Landing legs | Falcon 9 4 legs, 2.45 D span; Apollo LM 4 % of landed mass | L (v1 A-frames; v4 Falcon-style) | `landingLegSpec` -> `landingLegMesh` (ported from the shipyard) | extend |
| Crush cores / footpads | Apollo LM Al honeycomb | L v4 | in `landingLegMesh` (pad + ball) | new (visual) |

## 6. Power

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Solar array wing + SADA | ISS SAW 31 kW, 1,090 kg, 374 m2 | H, Se, Co v1-v3 (1 AU figures; useless on the route) | catalogue `array-saw`; `solarArraySpec` -> `solarArrayMesh` | extend |
| Roll-out array | iROSA 20 kW, 340 kg | -- | `solarArraySpec` (kgPerM2 override) | flagged |
| RTG / radioisotope | MMRTG 45 kg 110 We; GPHS 1.44 kg / 250 Wth | I, L v4 (MMRTG); S v4 (5 We RPS in the bus); W (0.1 W) | `rtgSpec` -> `rtgCAD` | new |
| Fission reactor + shadow shield + boom | Kilopower 10 kWe 1.5 t; FSP 40 kWe ~6 t; MW studies 10-20 kg/kWe | H (50 kWe), Se (300 kWe), Co (2 x 12 MWe) v4 | `reactorSpec` -> `reactorCAD`; `trussSpec` boom | extend (law replaces the fixed 14 t row) |
| Batteries | ISS Li-ion ORU 194 kg, ~150 Wh/kg | all v4 | `powerStoreSpec` | new |
| PMAD | ISS MBSU/DDCU ~5 kg/kW | all v4 | `powerStoreSpec.pmadKg` | new |
| Cabling / harness | 5-10 % of dry mass (ECSS-E-ST-20) | all | inside bus inventories; lumped | flagged (not separately sized) |
| Power-beaming rectenna | -- | -- | -- | flagged (not needed: the beam is momentum, not power) |

## 7. Thermal

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Deployable pumped-loop radiator | ISS PVR 93 m2 / 7.5 kW / 818 kg (8.8 kg/m2) | all crewed | catalogue `radiator-pvr`; `radiatorSpec` -> `radiatorMesh` | extend |
| High-temperature heat-pipe radiator | reactor radiators 5 kg/m2 at 600 K; drive radiators 1000 K | reactors (v4), drives (v3) | `reactorSpec.radiator`, propulsion.js `radiatorFor` | extend |
| Heat exchangers, pumps | ISS ITCS/ETCS | all | lumped in ECLSS hardware and radiator kg/m2 | flagged |
| MLI | 20-layer 0.5 kg/m2 | all | `mliSpec`, material `mli` | new |
| Louvers, heaters | New Horizons louvers | I, S | in bus inventory thermal item | new (lumped) |
| Cryocoolers | -- | -- | -- | flagged (no cryogenic payloads) |
| Sunshade | -- | -- | -- | flagged (the sail is the sunshade during boost) |

## 8. ECLSS

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| O2 generation (electrolysis) | ISS OGA 113 kg, 9 kg O2/day | C (open loop), H, Se, Co v4 | `eclssFor` hardware (1.5 t + 500 kg/person) | new |
| CO2 removal and reduction | CDRA ~200 kg; Sabatier 100 kg | H, Se, Co v4 | `eclssFor` | new |
| Trace contaminant control | TCCS 80 kg | H, Se, Co v4 | `eclssFor` | new |
| Water recovery, urine processor | WRS 2 racks ~1,400 kg | H, Se, Co v4 | `eclssFor`; closure in `CLOSURE` | new |
| Waste management | WHC 1,400 kg per 4 crew | H, Se, Co v4 | `crewFittingsSpec` | new |
| Food | 1.2 kg/pd packaged dehydrated (BVAD 1.83 wet) | C, H, Se, Co v4 | `consumablesFor` | new |
| Greenhouse | BVAD 50 m2/person full diet, 100 kg/m2, 350 W/m2 LED | Se (half diet), Co (90 %) v4 | `eclssFor.greenhouse` (deck area in the ring) | new |
| Fire detection / suppression | ISS smoke detectors, PFEs | H, Se, Co v4 | listed in `eclssFor.items` | new (lumped) |
| Humidity, ventilation | CCAA | H, Se, Co v4 | listed in `eclssFor.items` | new (lumped) |
| Gas stores | NORS tanks; cabin fill + 30 d make-up | H, Se, Co v4 | `copvSpec` | new |

## 9. Crew systems

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Crew quarters | ISS CQ 200 kg each | H, Se, Co v4 | `crewFittingsSpec` | new |
| Galley | ISS galley rack 300 kg per 6 | H, Se, Co v4 | `crewFittingsSpec` | new |
| Hygiene | WHC 1,400 kg per 4 | H, Se, Co v4 | `crewFittingsSpec` | new |
| Medical | CHeCS 300 kg + 50 kg/person | H, Se, Co v4 | `crewFittingsSpec` | new |
| Exercise | ARED 300 kg + T2 treadmill 1,000 kg per 6 | H, Se, Co v4 | `crewFittingsSpec` | new |
| Stowage (CTBs, lockers) | CTB 0.2 kg/L; stores at 80 % packing | H, Se, Co v4 | `storesModules`, ring stores decks | new |
| Workstations | ISS laptops, C&C racks | -- | in `gncSpec` crewed avionics | flagged |
| Windows / cupola | ISS 4-pane window 25 kg per 0.5 m | all pressurised | `windowSpec`; instanced `hullSegmentMesh` windows | new |
| Hatches | CBM hatch 90 kg | all pressurised | `hatchSpec` -> `hatchMesh` | new |
| Ladders, handrails, tethers | ISS EVA handrails | all pressurised (visual) | `hullSegmentMesh` rails | exists (visual) |
| EVA suits and airlock stores | xEMU 180 kg each, up to 4 | H, Se, Co v4 | `crewFittingsSpec` | new |
| Habitable volume | NASA-STD-3001: 25-30 m3/person long duration; Orion 2.3 m3/person for weeks | all crewed | `VOLUME_PER_PERSON_M3`, checked in the suite | new |

## 10. Radiation and MMOD

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Storm shelter | DRA 5.0 10-20 g/cm2 water over 1.5-2 m3/person | H, Se, Co v4 | `stormShelterSpec` (water from stores) | new |
| Water walls | stores water around the quarters | H, Se, Co v4 | `tankSpec` water tanks | new |
| Whipple / stuffed Whipple | ISS US modules 5-10 kg/m2 at 0.11 m standoff | all v4 | `whippleSpec` | new |
| MLI bumpers | part of the Whipple stack | all | `mliSpec` | new |
| ISM dust shield (bow) | Daedalus 50 t Be disc, ~60 kg/m2 at 0.12 c | I, L, H, Se, Co v4; W (Be-Cu coating) | `dustShieldSpec` -> `dustShieldCAD` | new |
| Regolith / propellant shielding | -- | -- | -- | flagged (no regolith; propellant tanks are aft, not around the crew) |

## 11. Avionics and GNC

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Star trackers | ST-200 0.25 kg; Hydra 3 kg | all v4 | `gncSpec` | new |
| Sun sensors | -- (no Sun on the route; used at departure) | all v4 | `gncSpec` | new |
| IMU | 5 kg class | all v4 | `gncSpec` | new |
| Reaction wheels | HR12 ~7 kg, 12 N m s (0.6 kg per N m s) | S, I, L v4 | `attitudeStoreSpec` | new |
| CMGs | ISS DGCMG 272 kg, 4,760 N m s | H, Se, Co v4 | `attitudeStoreSpec` | new |
| Flight computers | redundant triplex for crewed | all v4 | `gncSpec` | new |
| Rendezvous lidar / docking cameras | Dragon lidar + cameras | crewed v4 | `gncSpec` | new |
| GPS | -- | -- | -- | flagged (no GNSS beyond Earth; omitted on purpose) |

## 12. Communications

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| High-gain dish | New Horizons 2.1 m; Voyager 3.7 m 50 kg; 6 kg/m2 | I (2.1 m), L (1.0 m), H/Se (3 m), Co (5 m) v4 | `dishSpec` -> `dishMesh` | new |
| Phased array | Starlink user terminal class | -- | -- | flagged (local ops at the destination) |
| Omni antennas | LGA patches | all | in bus inventories | new (lumped) |
| Laser comm terminal | DSOC 0.22 m ~30 kg; LCRD | S (0.1 m), I (0.3 m), L (0.2 m), H/Se (1 m), Co (2 m) v4; W (film-as-aperture) | `laserCommSpec` | new |
| Relays, transponders | -- | all | in GNC/comms items | new (lumped) |
| Beam beacons / retroreflectors | Starshot edge features | all sail | `beaconSpec`, `sailSystemsFor` | new |

## 13. Docking and berthing

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| IDSS / NDS | active 341 kg, passive 150 kg | C (dock), PMA | port type `idss-1200`; `dockingSpec` | extend |
| CBM | active 500 kg, passive 200 kg | H, Se, Co | port type `cbm`; `dockingSpec` | extend |
| APAS | 300 kg | -- | `DOCKING` row | flagged (legacy) |
| PMA | PMA-2 1,900 kg | H, Se, Co | catalogue `pma` | exists |
| Capture latches / soft capture | in the IDSS active half | C | `dockingSpec` | new (lumped) |
| PAF / clampbands | RUAG PAS 937/1194/1575 | S, I, L, C | port types `paf-*` | exists |
| Lightband | PSC MLB 11.7 in | S v4 | port type `lightband-12` | new |

## 14. Robotics

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Manipulator arm | SSRMS 1,800 kg / 17.6 m | H, Se, Co | -- | flagged (berthing needs an arm; not modelled) |
| End effectors, grapple fixtures | FRGF 50 kg | H, Se, Co | `nodeCAD` grapple pin (visual) | exists (visual) |

## 15. Payload

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Instrument suite | New Horizons 30 kg (7 instruments) | I v4; S (3 kg); L (250 kg) | bus inventories | new |
| Instrument booms | Voyager 13 m magnetometer boom | -- | `trussSpec` | flagged |
| Deployers | 6U dispenser | S v1 | catalogue `dispenser-6u` | exists |
| Cargo bays / stores | see 2 | H, Se, Co | `storesModules` | new |
| Landers / probes carried | the capsule is the destination taxi | C v4 | catalogue `capsule-tps` | new |

## 16. Sail-specific

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Sail film | 100 nm SiN 0.34 g/m2 (Lubin); absorptance 1e-5, emissivity 0.5 (Atwater 2018) | all sail | `sail()`, `filmTemperatureK` | extend |
| Fold pattern / flasher | parts/flasher.js hexagonal flasher, 6.2:1 across | all sail | `stowedEnvelope`, `sailFilm` | exists |
| Canister / hub drum | LightSail 2 ~10x packing; CFRP drum l = d | all sail with a mast | `sailCanisterSpec` -> `canisterCAD` | new |
| Spreader / rim booms | NEA Scout TRAC 0.1 kg/m | small sails only (library) | `sailBoomSpec` | new (library; v4 sails are spin-stabilised) |
| Shroud lines | carbon tow 2 GPa | library | `shroudLinesSpec` | new (library) |
| Deployment motors, latches | 0.12 kg x film^0.8; 2 % of film | all sail | `sailCanisterSpec` | new |
| Tension actuators, tip vanes | 2 % of film | all sail | `sailSystemsFor` | new |
| Edge beacons / retroreflectors | 20 g at 10 m radius, sqrt(R) | all sail | `beaconSpec` | new |
| Hub gimbal / jettison plane | 1 % of film; separation nuts | all sail with a mast | `sailSystemsFor` | new |
| Thrust collar / sail stage | 900 kg collar; 420 kg IDSS stage | H, Se, Co; C | catalogue | exists |
| Sail mast | truss sized from thrust (v4); 0.6 kg/m lattice (v1) | all sail with a mast | `trussSpec` via `mastPartV4` | extend |
| Film thermal limit | 1000 K | all sail | `filmTemperatureK`, checked | new |
| Film degradation, dust erosion | Daedalus erosion shield as proxy; refold for dust storms | all sail | notes in `sailSystemsFor`; `dustShieldSpec` | new (qualitative for the film itself) |
| Payload shadowing | arrays not counted at full flux during boost | all sail | note; power is RTG/reactor on v4 | new |
| Magsail / drag-sail deceleration | see 4 | stopping classes | item on the braking stage | new (mass only) |

## 17. Surface and landing

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Legs, footpads | see 5 | L | `landingLegSpec` | extend |
| Ladders, rovers, ISRU | -- | -- | -- | flagged (the lander is robotic; no surface ops modelled) |

## 18. Lighting and markings

| Component | Reference | Classes | Primitive | Status |
| --- | --- | --- | --- | --- |
| Nav lights | red port, green starboard, white strobes | nodes, lander, bus | `navLights` | new (visual) |
| Floods, docking lights | -- | -- | -- | flagged (visual only) |
| Fiducials, roll patterns, decals, serial plates | -- | -- | -- | flagged (visual only) |

## 19. Visual-fidelity primitives

| Component | Reference | Primitive | Status |
| --- | --- | --- | --- |
| Rivet / seam generator | surface-detail.js instanced rivets and seams | `addSurfaceDetail` | exists |
| Panel-line / weld-seam textures | procedural canvas maps (white paint, stainless) | materials.js `white`, `stainless` | new |
| TPS tile pattern | hex tiles with grout | materials.js `tps`, `tpsHalf` | new |
| MLI crinkle | noise normal map | materials.js `mli` | new |
| Solar-cell grid | 8 x 8 cell grid | materials.js `cell` | new |
| Radiator ribs | flow-tube ribs | materials.js `radiator` | new |
| Lit glazing | emissive glass | materials.js `glass` | new |
| Port rings with bolts | instanced bolt circle | `portRingMesh` | extend |
| Instanced windows / lattice | InstancedMesh everywhere a part repeats | `instances()` | new |

## What the standards require that the fleet still lacks

- a manipulator arm for berthing (CBM assumes one; SSRMS class) -- flagged in 14;
- a cupola or direct-view windows for proximity operations on the crewed classes -- flagged in 2;
- harness mass as a separate line (ECSS-E-ST-20 budgets 5-10 % of dry mass) -- lumped into bus inventories;
- heat exchangers and pump packages sized separately from the radiator areal mass -- lumped;
- the magsail loop as a structure (it is a mass fraction and a coil drum, not a sized superconducting loop);
- end-of-life disposal (ISO 24113) is moot on a one-way route, but the sail jettison plane is the only provision;
- launch packaging is not checked (`fairing: null`), as the lab has always said: these are assembled in orbit.
