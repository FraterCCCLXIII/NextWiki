# Centauri fleet -- v5, robotic / minimal-crew

The crewed classes (habitat, seed, colony) rebuilt around an AI swarm that flies the ship, a robot
workforce that maintains it, and a small human cadre that sleeps through most of the crossing. This
note is the trade study, the architecture and the record of what was built; `parts/robotic.js` holds
every law and number as code, `parts/fleet-versions-v5.js` pins the five designs, and
`centauri-robotic.test.mjs` (863 checks) holds the invariants. The page is `centauri-robotic.html`,
with the v1-v3 ships beside the v5 ones behind a version selector, the robot gallery at true scale,
and every table below regenerated live from the same functions. Every table in this note was printed
by those functions on 2026-11-08; nothing in it was typed by hand.

v1-v4 are untouched: the pins in `fleet-versions.js` still reproduce, the catalogue parts keep their
hinges and genders (v5 retypes copies), and the one edit to a shared file is an `export` line at the
end of `centauri-models.js` so the v5 CAD can reuse its builders.

## 1. The question, and the answer

The brief was to design the crewed vessels for an all-robot or mostly-robot crew with a limited human
complement, and to say which route is best. The reframing that followed is the one built here: the
ship is a swarm. It pilots itself, wakes the humans only when it needs them, and gives them an
observation deck where they can telepresence into its robots, drones and sensors and scrub through
everything it recorded while they slept.

**Recommended route: option C, the AI-swarm ship with a dormant cadre.** The honest result of the
rubric is that the uncrewed ship (option B) scores higher, and the study says so rather than tuning
the weights until it does not. B fails the requirement the crewed classes exist for -- that adults
arrive alive and able to act -- so C is the best route that meets the requirement, and B is built as
the hedge (`seed-v5-auto`): the ship you fly if torpor physiology does not scale to decades.

What C buys over the baseline, per class, is in section 8: a habitat hull of 459 t carrying its own
food against a v2 ship that weighs 523 t *before* the 1.15 kt of food and life support its 24 awake
crew would need; a seed of 1.35 kt against 2.56 + 5.46 kt; a colony of 8.8 kt (sixty adults in torpor
and a 10,000-line bank) against 9.5 + 56.4 kt. What it does not buy is a shorter crossing: at the
20:1 mass-ratio cap the drive sets the cruise speed, and 4.37 ly takes 45-54 years whatever is
aboard. That number is the whole physiological argument, and section 4 does not soften it.

## 2. The trade study

Six routes, scored 1 (worst) to 5 (best) against a stated rubric. The weights are a choice and are
printed; `scoreOptions()` re-derives the ranking from them, and `recommend()` picks the best option
that meets the requirement.

| Criterion | Weight | What it measures |
| --- | --- | --- |
| mass | 20 % | mass to cruise: consumables, ring, shielding, drive |
| reliability | 15 % | reliability and repair over 50-80 years with no resupply |
| success | 15 % | mission success if the humans are lost or incapacitated |
| physiology | 15 % | human physiological risk: dose, ageing, torpor, deconditioning |
| autonomy | 10 % | dependence on unproven autonomy and AI judgement (5 = none) |
| ethics | 10 % | ethical exposure: consent, children, abandonment, embryo colonisation |
| value | 10 % | what having humans aboard is worth at the other end |
| complexity | 5 % | development cost and complexity |

| Option | mass | reliability | success | physiology | autonomy | ethics | value | complexity | Score | Meets requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **B** Fully autonomous | 5 | 4 | 5 | 5 | 2 | 2 | 2 | 4 | **3.90** | no |
| **C** AI-swarm ship with a dormant cadre | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 3 | **3.70** | yes |
| **E** Humans as supervisors on a minimal habitable core | 4 | 3 | 2 | 3 | 5 | 4 | 4 | 3 | **3.45** | yes |
| **D** Small awake crew of 2-6 with a robot workforce (no torpor) | 3 | 4 | 3 | 2 | 4 | 4 | 3 | 3 | **3.20** | yes |
| **A** Baseline crewed (v2/v3) | 1 | 3 | 2 | 2 | 5 | 3 | 4 | 3 | **2.60** | yes |
| **F** Generation ship (Project Hyperion class) | 1 | 2 | 3 | 2 | 5 | 1 | 5 | 1 | **2.40** | yes |

Why each was kept or rejected:

- **A, everyone awake (v2/v3 as pinned).** Honest consumables for 1,000 awake people over 54-77
  years are 56 kt at 2.34 kg per person-day, six times the colony's own 10 kt payload; every crew
  member takes the full dose; a generation is born and dies in transit. Rejected on mass and dose.
  The v2/v3 pins never carried food or life support (CENTAURI-AUDIT.md F6), which is why section 8
  compares v5 against the baseline *with* them.
- **B, fully autonomous.** The lightest and most survivable ship, and the one with nobody aboard to
  notice when its model of the world is wrong. Gestating and raising children from a bank with no
  adults present is the ethical problem Edwards (2021, "Embryo space colonisation") and others set out
  and nobody has solved. Kept as the uncrewed extreme, `seed-v5-auto`, because the physiology in
  section 4 may force it.
- **C, the swarm ship with a dormant cadre. Recommended.** Takes the mass of B plus a few percent
  for the sleepers and their bay, keeps adults aboard for the arrival and for the decisions an AI is
  not allowed to take alone, and keeps them out of the way for the 82 % of the time nothing is
  happening. The open risk is physiological: torpor beyond 14 days is untested, and sleeping does not
  reduce the dose.
- **D, a small awake crew of 2-6 with robots.** Six people awake for 46 years is six lifetimes in a
  25 m ring; consumables are 2.5x C's, the dose is the same, and with no sleepers there is no reserve
  of fresh judgement for arrival. Rejected: C without the one thing torpor buys.
- **E, humans in command, AI advising.** The same hardware as C with the authority inverted. A ship
  whose plan needs a human signature cannot act in the 20 hours it takes to rewarm one, and a tier-3
  disagreement would wait a day and a half for a quorum of sleepers. Rejected on mission success.
  Its cockpits and its tiers survive inside C as the intervention mode (section 7).
- **F, a generation ship.** The only option that arrives with a working society, and the one that
  needs a closed food loop, a stable population and the consent of people not yet born. Hyperion's
  studies put it at tens of kilotonnes of habitat per hundred people. Out of scope for a 10 kt
  payload; rejected on mass, closure and ethics.

Two things about the scoring that should be said plainly. The autonomy column penalises C for
depending on AI judgement that does not exist yet at the required level (Mars rovers and Ingenuity
are autonomous for minutes to hours, Starling and CADRE for days; nobody has flown an autonomous
system for a decade without a ground loop). And the requirement gate is the *only* reason C beats B;
with the gate removed the recommendation is B, and that is a result, not a failure of the method.

## 3. What a v5 ship is

The pressurised stack of the v1 hull is kept where it earns its mass -- a Unity-class node as the
root, Columbus-class labs as the robots' workshops, the thrust collar -- and re-cut everywhere else:

- the 24/110/1,000-person 1 g ring becomes a **torpor ring** sized for the people actually awake
  plus the sleepers' pods, with the **storm shelter** wrapped round the sleepers (they are already
  inside it when a solar-particle event arrives) and the **telepresence cockpits** beside them;
- a **robot hangar** with cradles, docks, maintenance stations, a quarantine bay, a tool store and a
  **robot lock** out to the hull rails; a **fabrication bay** with its cells, feedstock and stocked
  spares; an **observation deck** with immersion pods, a wall, a data theatre and the vault; for the
  seed and colony a **seed vault**;
- **compute racks** on the outside of at least two modules, never one core; **rails** along the whole
  stack and the drive, with crawlers on them; a **scout rack** of detachable swarm members;
- a **fission power unit** sized from the summed loads, because there is no sunlight between stars
  and the v1-v3 solar wings generated nothing there (a finding in itself: every earlier version
  carried 62 kW of blankets that would have made 0 W from a year out);
- the **consumables tank** and the **arrival kit** in the thrust path on hardpoints, between the
  collar and the drive, like propellant tanks -- not as pressurised cans on a berthing ring
  (CENTAURI-AUDIT.md F10);
- the **drive** the rocket equation says closes: Daedalus-class inertial fusion for the habitat and
  seed, the Dyson pulse magazine for the colony, with engines clustered until the boost is under ten
  years, since Daedalus and Dyson both scale by adding engines and pulse units.

The sail and its mast are gone. A ship that has to cross in a lifetime cannot wait for a beam that
`CENTAURI.md` already showed cannot be focused over a multi-year boost.

Every one of these is a part with a mass, an envelope, ports and a source, mated through
`solveAssembly()`, so the mass closure and the "does it fit" check come out of the same solver that
places everything else. The robots are parts too: humanoids stand in cradle ports, flyers sit in dock
ports, crawlers ride car ports on the rails, the Dextre hangs on the hangar face, fab cells on the
bay's floor. 64 to 328 parts per ship.

### The five designs

| Design | Humans | Ring | Consumables | ECLSS | Shield | Robots | Spares + feedstock | Compute | Record | Power | Drive | Wet | Crossing | Dose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| habitat-v5 | 6 (1.1 awake) | 24.8 m at 6 rpm, 3 m tube, 1 deck, 375 m2, 244 t | 142 t | 7.2 t | 53 t | 42 (7 t) | 5.19 t | 10 nodes, f=3 | 8.2 PB | 50 kW for 33 kW | 1 x Daedalus fusion | 16.6 kt | 45.4 yr (9.9 % c, 2.1 yr boost) | 7.5 Sv |
| seed-v5 | 12 (2.1 awake) | 24.8 m at 6 rpm, 3 m tube, 1 deck, 375 m2, 297 t | 295 t | 14.4 t | 97.2 t | 65 (8.91 t) | 7.01 t | 17 nodes, f=5 | 13.8 PB | 60 kW for 47 kW | 1 x Daedalus fusion | 45.3 kt | 47.2 yr (9.9 % c, 5.7 yr boost) | 7.8 Sv |
| colony-v5-cadre | 60 (10.6 awake) | 24.8 m at 6 rpm, 4.5 m tube, 1 deck, 562 m2, 793 t | 1.68 kt | 72 t | 431 t | 104 (12.9 t) | 11.1 t | 18 nodes, f=5 | 25.3 PB | 2.20 MW for 130 kW | 5 x fusion pulse | 296 kt | 53.8 yr (9.0 % c, 10.1 yr boost) | 8.9 Sv |
| colony-v5 | 1000 (176.5 awake) | 55.9 m at 4 rpm, 10.5 m tube, 3 decks, 8,850 m2, 6.73 kt | 28 kt | 1.2 kt | 2.34 kt | 329 (33.1 t) | 28 t | 37 nodes, f=12 | 76.9 PB | 2.20 MW for 900 kW | 23 x fusion pulse | 1.38 Mt | 53.9 yr (9.0 % c, 10.2 yr boost) | 8.9 Sv |
| seed-v5-auto | 0 | none | 0 | 0 | - | 46 (7.28 t) | 5.48 t | 12 nodes, f=3 | 9.4 PB | 20 kW for 16 kW | 1 x Daedalus fusion | 24.6 kt | 45.9 yr (9.9 % c, 3.1 yr boost) | - |

"Robots" counts the placed robot parts; the inventory totals in section 5 also count the scouts,
which ride in a rack rather than as individual parts (46/73/120/345/54).

`colony-v5` is option C scaled to the whole colony: a thousand sleepers, 176 awake at any time, and
28 kt of food. It is built to show the wall, not to recommend it -- sleepers still eat, at 40 % of the
awake rate, and 1,000 x 54 years x 0.94 kg is 18 kt before the awake watch and the margin. The colony
the study recommends is `colony-v5-cadre`: sixty adults, the thousand colonists as a 10,000-line
embryo, gamete and seed bank, six kilotonnes of arrival kit for the robots to build with. The ethics
of the bank are option B's, moderated by the sixty adults who will be there when it is opened.

## 4. The humans

### Consumables and life support

Per awake person-day, NASA's Baseline Values and Assumptions Document (NASA/TP-2015-218570 Rev 1,
2018): 0.84 kg of oxygen, 1.83 kg of packaged food, 3.0 kg of drinking and preparation water, 1.3 kg
of hygiene water. Closure as the ISS loop achieves it for water (93 %, Water Recovery System) and as
an advanced loop is credited for oxygen (75 %, Sabatier plus methane pyrolysis); food is not closed
-- there is no farm, because a farm for the colony is 20,000 m2 of crop at 300 W/m2 of LED lighting,
6 MW, three times the ship's reactors. Net: **2.34 kg per awake person-day**, x0.4 in torpor, x1.2
margin, plus 60 kg of medical stock per sleeper for the crossing. Life support hardware at 800 kg and
700 W per supported person with a redundant half string (ISS USOS ECLSS: ~4.5 t and ~5 kW for six).

The consumables tank is a placed part: `stores.part.mass` equals the law to 1e-9, and the test checks
it per ship for the crossing time that ship actually makes (the trip feeds the food feeds the hull
feeds the boost feeds the trip; `roboticAssembly()` iterates that fixed point to convergence).

### Torpor

After SpaceWorks' NIAC studies (Bradford, Schaffer et al., *Torpor Inducing Transfer Habitat for Human
Stasis to Mars*, Phase I 2014, Phase II 2016-2018): therapeutic hypothermia at 32-34 C, total
parenteral nutrition, **14-day torpor cycles with 2-3 days awake**, the crew staggered so that someone
is always up, metabolic rate down 50-70 % (40 % of awake is used), and the habitat spun for gravity to
limit deconditioning. Rewarming is the clinical 0.25-0.5 C per hour: 16 hours from 32 C, then eight
hours of orientation before anyone is fit to decide anything, which is where the wake-up lead times in
section 7 come from. The awake fraction is 3/17 = 17.6 %: 1.1 of 6, 2.1 of 12, 10.6 of 60, 176 of
1,000.

Everything about torpor past 14 days is extrapolation. The longest clinical cooling is days; no study
has looked at 46 years of cycles. The model uses the protocol's own cycle and says so; `seed-v5-auto`
is the hedge.

### Dose: the finding that matters most

The torpor bay and the storm shelter carry 50 g/cm2 of water-equivalent (500 kg/m2), which stops a
solar-particle event and halves the galactic cosmic-ray rate behind it, and no more than that, because
GCR shielding saturates (Cucinotta et al., NASA/TP-2013-217375; Slaba et al. 2017). Interstellar GCR
outside the heliosphere is taken at 0.3 Sv/yr unshielded against the 0.2-0.25 Sv/yr MSL-RAD measured
on the Mars transit. **A 46-year crossing is 14 Sv unshielded and 7.5 Sv behind the shelter**, an
order of magnitude past any career limit (0.6 Sv). Sleeping does not change it. This, not torpor, is
the reason option B scores highest on physiology, and it is why the cadre is a cadre and not a crew:
the fewer people who take that dose, the better, and the ones who do take it should be adults who
chose to. The test asserts the dose is reported, not hidden.

### The ring

The ring spins at the short-stay 6 rpm, not the continuous 4 rpm, because the awake stint is three
days -- the SpaceWorks cycle -- and 6 rpm is the published short-stay figure (`centrifuge.js`). 1 g at
6 rpm is a 24.8 m deck radius against 55.9 m at 4 rpm, and a cadre of six does not fill the latter. The
colony's 1,000 sleepers keep 4 rpm and 55.9 m because their awake watch is 176 people and the tube
would otherwise be too fat for a flat gravity profile.

Deck area: 30 m2 per awake person, 3 m2 per pod (a 2.2 x 0.9 m pod and its share of the robot access
aisle), 2.5 m2 per cockpit, 20 m2 of medical bay; the tube grows until the decks hold it, from 3 m up.
The shelter is the stretch of ring that holds the pods, the cockpits and 2 m2 per awake person, and
its shell area times 500 kg/m2 is the shield mass. Outfit on the ring: pods at 260 kg and 150 W each,
ECLSS, cockpits, shield. The ring part's `pods` and `cockpits` are what the CAD draws.

| Ring | v2 (1 g, 4 rpm, everyone awake) | v5 (torpor ring, with outfit and shield) |
| --- | --- | --- |
| habitat | 55.9 m, 3 m tube, 843 m2, 409 t | 24.8 m, 3 m tube, 375 m2, 244 t (182 t structure, 53 t shield) |
| seed | 55.9 m, 7.5 m tube, 4,214 m2, 1,550 t | 24.8 m, 3 m tube, 375 m2, 297 t |
| colony (cadre) | 55.9 m, 19.5 m tube, 32,870 m2, 9,508 t | 24.8 m, 4.5 m tube, 562 m2, 793 t |
| colony (1,000 sleepers) | same | 55.9 m, 10.5 m tube, 3 decks, 8,850 m2, 6,730 t |

The habitat's ring is the 3 m tube minimum, not the deck law: six people need 106 m2 and the smallest
ring that is a ring holds 375. That is why the habitat's ring is 244 t for six people, and it is stated
rather than tuned away.

## 5. The robots

### Catalogue

Every class has a flown or built analogue. Masses, envelopes, draws and reach are in
`ROBOTS` in `parts/robotic.js`; the page's gallery draws each one at true scale beside the 1.8 m
figure (`centauri-shots/robotic/robot-gallery.png`).

| Robot | each | habitat-v5 | seed-v5 | colony-v5 | colony-v5-cadre | seed-v5-auto | analogue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IVA humanoid (Figure 02 / Optimus class) | 75 kg, 120 W avg | 4 | 7 | 104 | 10 | 4 | Figure 02 (70 kg, 1.68 m, 2.25 kWh, ~5 h); Optimus Gen 2 (57 kg); Digit (65 kg, 16 kg payload); Robonaut 2 (150 kg torso, ISS 2011-18) |
| EVA humanoid (Valkyrie class, hardened) | 140 kg, 150 W avg | 3 | 5 | 31 | 12 | 4 | NASA R5 Valkyrie (125 kg, 1.88 m, 2013) plus 15 kg of thermal and radiation hardening |
| IVA free-flyer (Astrobee class) | 10 kg, 20 W avg | 6 | 10 | 8 | 8 | 7 | NASA Astrobee (ISS 2019-): 32 cm cube, ~10 kg, perching arm, ~3 h on a charge; SPHERES; Int-Ball |
| EVA inspection drone (AERCam/Seeker class) | 16 kg, 15 W avg | 8 | 13 | 81 | 32 | 9 | NASA AERCam Sprint (STS-87, 1997: 16 kg, 36 cm, cold-gas, two cameras); Seeker (Cygnus NG-11, 2019) |
| Hull rail crawler | 150 kg, 60 W avg | 12 | 20 | 40 | 28 | 16 | Derived: ISS Mobile Transporter (885 kg, 0.025 m/s on the truss rail) carrying a Dextre-scale arm pair; JPL LEMUR 3 for the gripper suite |
| Dexterous manipulator (Dextre class) | 1,560 kg, 300 W avg | 1 | 1 | 1 | 1 | 1 | CSA/NASA Dextre (SPDM): 1,560 kg, two 3.5 m arms, 600 kg payload, 2 kW peak |
| Long manipulator (ERA class) | 630 kg, 120 W avg | 2 | 2 | 4 | 3 | 2 | ESA European Robotic Arm (ISS 2021-): 630 kg, 11.3 m, 8 t payload, walks end to end |
| Fabrication cell | 450 kg, 800 W avg | 2 | 2 | 9 | 3 | 2 | Made In Space AMF (ISS 2016, ~45 kg); Tethers Refabricator (2018); ESA/Airbus Metal3D (2024, ~180 kg); industrial DED cells 1-3 t |
| Medical and surgical automation | 300 kg, 150 W avg | 1 | 1 | 4 | 1 | 0 | da Vinci patient cart (~540 kg); Raven II (NASA NEEMO 2012); SpaceWorks pod medical suite |
| Stowage robot on the module rail | 90 kg, 40 W avg | 3 | 4 | 47 | 6 | 1 | Amazon/Kiva drive unit (145 kg) scaled to a 60 kg CTB on an internal rail |
| Detachable scout (6U swarm member) | 15 kg, 15 W avg | 4 | 8 | 16 | 16 | 8 | NASA Starling (four 6U CubeSats, 2023: swarm autonomy, mesh network); ESA Proba-3 (2024, mm formation flying); JPL ASTERIA |
| **total** | | **46** | **73** | **345** | **120** | **54** | |

### The fleet law

Counts come from the hull, not from a list: one IVA humanoid per two pressurised modules plus one per
ten sleepers (minimum two); two EVA humanoids plus one per 4,000 m2 of hull; a free-flyer per module;
two inspectors plus one per 1,500 m2 of hull; crawlers in sets of four rails at one per 60 m of rail;
a Dextre; an ERA per 150 m of stack over 80 m; a medical robot per 250 humans; a stowage robot per
500 m3 of pressurised volume; one fab cell plus one per 40 mobile robots. The hull area that drives
the EVA counts includes the drive's magazine, which is most of it (the habitat's 19 m x 116 m
Daedalus store is 7,100 of its 7,600 m2), so the EVA fleet is sized by the propellant store, which is
right: it is the biggest thing a micrometeoroid can hit.

### Reach covers the hull

Four rails run the length of the stack and the drive at a 0.35 m standoff, following the hull profile
(module radius, then the frame, then the store), with crawler cars placed on the profile. A crawler
reaches 2.5 m either side of its rail; an inspector covers 1,500 m2; an EVA humanoid 400 m2 from the
handrails. Coverage is the sum over the hull's external area: **2.18x for the habitat, 1.73x for
the seed, 1.38x for the cadre colony, 1.23x for the thousand-sleeper colony, 1.85x for the uncrewed
seed.** The test requires >= 1.

### Reliability, spares, fabrication

40,000 h MTBF for every mobile robot (industrial manipulators quote 60,000-100,000 h; the MER rovers
were designed for 90 sols and ran 15 years), 70 % of failures repaired from printed parts, 30 % from a
stocked spare of 5 % of the robot's mass, 1.3 kg of feedstock per printed kg, and a standby stock of
25 % of the mobile fleet's mass. Daedalus carried two 5 t Wardens for this job; Icarus's self-repair
study reached the same printing/stock split.

| Design | failures over the crossing | printed | feedstock | stocked | standby | spare ratio |
| --- | --- | --- | --- | --- | --- | --- |
| habitat-v5 | 398 | 2.12 t | 2.76 t | 910 kg | 1.52 t | 40 % |
| seed-v5 | 651 | 2.9 t | 3.77 t | 1.24 t | 2 t | 41 % |
| colony-v5-cadre | 1,191 | 4.75 t | 6.17 t | 2.04 t | 2.88 t | 43 % |
| colony-v5 | 3,778 | 12 t | 15.6 t | 5.14 t | 7.26 t | 43 % |
| seed-v5-auto | 442 | 2.25 t | 2.92 t | 963 kg | 1.6 t | 40 % |

The spare ratio is stocked plus standby over the mobile fleet's mass; the test holds it between 30 and
60 %. The feedstock and spares are in the fab bay's mass, and the cells are placed inside it.

## 6. The hangar, the lock, the cockpits, the deck

| Design | Hangar | Cradles | Docks | Maintenance | Quarantine | Lock | Cockpits | Obs pods | Vault |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| habitat-v5 | 6.0 x 4.5 m, 95 m3, 11.3 t | 11 | 14 | 3 | 1 | 1.2 x 2.2 m | 2 | 3 | 20.5 PB |
| seed-v5 | 9.3 x 4.5 m, 147 m3, 17.5 t | 17 | 23 | 5 | 2 | 1.2 x 2.2 m | 3 | 3 | 34.6 PB |
| colony-v5-cadre | 14.0 x 4.5 m, 219 m3, 26 t | 29 | 40 | 7 | 3 | 1.2 x 2.2 m | 7 | 5 | 68.6 PB |
| colony-v5 | 14.8 x 8.4 m, 822 m3, 97.8 t | 186 | 89 | 22 | 7 | 1.2 x 2.2 m | 90 | 47 | 215.8 PB |
| seed-v5-auto | 5.7 x 4.5 m, 91 m3, 10.9 t | 9 | 16 | 3 | 1 | 1.2 x 2.2 m | 0 | - | - |

**The hangar** is sized from the fleet it garages (`HANGAR` in `robotic.js`): a standing cradle per
humanoid, medical and stowage robot (1.0 x 0.9 m of wall, 2.1 m tall, 1.9 m3, with a 40 kg frame, a
15 kg charger, a 5 kg power-and-data umbilical and an 8 kg thermal-conditioning plate that keeps the
pack at 15-25 C); a 0.5 m3 dock per free-flyer and inspector; a maintenance station per 15 mobile
robots (8 m3: bench, parts carousel, end-effector store, 250 kg); a quarantine bay per 50 (10 m3, its
own door, 400 kg) for a failed or contaminated robot; a 6 m3 tool store plus 4 kg of tools per robot;
and the lock. 25 % of the volume is aisle, 1.2 m clear so two humanoids pass. The shell is a
Columbus-diameter tube up to 12 m long; past that it grows to a Starship-class 8.4 m rather than
becoming a 48 m corridor, and the cradles double up in two rows a side. Sources: ISS Quest (6.1 t,
34 m3, 1.0 m hatch) for the lock class, ISS crew quarters (2.1 m3) for the cradle envelope, the
Robonaut 2 and Astrobee docking stations on ISS. The test checks every garaged robot sits inside the
hangar's envelope and that they take under half its volume.

**The robot lock** is a placed part on the hangar's nadir face: an unpressurised-robot airlock of 8 m3
with a 1.2 x 2.2 m outer hatch, interlocked inner and outer doors so it is never open both ways, and
the two rail heads either side where the crawlers pick up power and data. A crouching humanoid needs
1.0 x 2.0 m, a crawler 1.2 x 0.9 m; the test checks the hatch passes both. Egress is lock, handrail,
rail head, rail; the EVA humanoids work from the handrails the catalogue module already carries.

**The telepresence cockpits** are in the shelter, beside the pods, at 1 g: a seat with a microgravity
restraint option, a head-mounted display, two force-feedback arm exoskeletons, haptic gloves, pedals
for locomotion, a 1 Gbit/s link to the body being piloted and a rendering node -- 180 kg, 2.5 m2,
1.5 kW in use. One per two awake people plus a spare, never fewer than two, so a handover always has a
second seat (ISS runs one robotics workstation for six). Analogues: Sarcos Guardian XT (a human in a
master suit driving a dexterous upper body on a lift), DLR/Roscosmos Kontur-2 (force feedback from
ISS to a robot on Earth at 20-30 ms, 2015), ESA METERON Haptics-2 and Interact (an astronaut driving a
rover on the ground through a geostationary relay at ~0.8 s round trip, usable with predictive
display), the Robonaut 2 telepresence glove and HMD.

**The observation deck** is a module in microgravity next to the spin bearing -- where the awake watch
floats to from the spoke, one spoke from the shelter -- with one immersion pod per four awake people
plus two for visitors (140 kg each: a reclined restraint frame, HMD, hand tracking, seat-scale
haptics), an 18 m2 wall display, a data theatre with the time-scrubbable record, two render nodes,
the archive vault, and two cupola-class domes so the humans can also just look. The deck's mass
carries the vault's flash (1 to 11 t at 20 TB/kg).

## 7. The swarm

### Nodes, consensus, degradation

A compute node is a radiation-hardened rack: 24 kg, 400 W, 50 TOPS of inference in three
modular-redundant lanes, 400 TB of radiation-tolerant flash, its own cold plate. Flown references
bracket it -- a RAD750 is 10 W and 200 MIPS; NASA's High-Performance Spaceflight Computer (SiFive,
2022-) is a hundred times that in ~20 W; Ingenuity flew a commercial Snapdragon 801 on Mars for 72
flights -- and 50 hardened TOPS is optimistic for hardened silicon and ordinary for commercial. Node
count is `max(7, robots/12 + modules)`: 10 for the habitat, 17 for the seed, 18 for the cadre colony,
37 for the thousand-sleeper colony, 12 for the uncrewed seed.

The swarm decides by Byzantine consensus (Castro and Liskov, PBFT 1999): `n >= 3f + 1`, so seven
nodes survive two liars and the floors are set by that; quorum is two thirds plus one. The nodes are
distributed in racks on the outside of at least two modules -- hangar, fab bay, deck, vault -- never
more than half in one rack, so losing the biggest rack leaves a working swarm; the test checks all
three. Every robot, scout and sensor is a swarm member with a share of the world model; the compute
racks hold the consensus and the planners; a robot cut off from the mesh runs its last plan to a safe
state and waits.

Degradation is graceful by construction: lose nodes down to seven and the swarm keeps full authority;
lose below seven and it drops to a majority vote with a tier-4 wake (section 7, wake-up); lose the
racks on one module and the other modules' racks hold the replicas. The mothership and the swarm
members split cleanly: the hull carries the nodes, the power and the fabrication; the scouts (6U,
Starling-class) are members that leave the hull -- formation-flying sensor outriggers during cruise,
forward probes and relays on arrival (Proba-3 shows formation flying to millimetres; Starling shows
a four-craft swarm sharing a plan).

### Network and latency

Optical fibre spine at 400 Gbit/s over two independent rings, every module on both; Wi-Fi 6E / 60 GHz
cells in every pressurised module (two per module); an optical and UHF mesh outside for the crawlers,
the inspectors and the scouts. In-ship latency is single-digit milliseconds, inside the 50 ms budget
for force feedback (Kontur-2 ran at 20-30 ms) and far inside the 2 s budget for supervisory control
(Sheridan's 0.3-1 s threshold; METERON's 0.8 s). Earth is 4.37 light years away: **8.74 years round
trip**. No control loop closes over that, so nothing is piloted from home; the ship reports, and
nobody at home can answer in time. The test asserts both numbers.

### The recorded-data pipeline

Everything the swarm sees is kept, but not at full rate forever. Rates per source are ordinary -- a 4K
inspection camera at 15 Mbit/s (two per mobile robot, at the robot's duty cycle), a robot's
proprioception and decision log at 1 Mbit/s, a hull sensor at 10 kbit/s (one per 5 m2) -- and the
tiers are: full rate for 90 days, a tenth-rate summary (keyframes, events, every decision with its
inputs) for the whole crossing, every vote and veto forever. Three replicas, on the nodes' own flash
first and in the deck's vault for the rest, at 20 TB/kg (commercial QLC flash is 80 TB/kg; derated
4x for radiation-tolerant parts, replication hardware and packaging).

| Design | Nodes | f | Racks | Rate | Full-rate 90 d | Summary | Stored (x3) | Vault | Cells |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| habitat-v5 | 10 | 3 | 5 | 433 Mbit/s | 0.4 PB | 7.8 PB | 24.5 PB | 20.5 PB (1.03 t) | 12 |
| seed-v5 | 17 | 5 | 6 | 704 Mbit/s | 0.7 PB | 13.1 PB | 41.4 PB | 34.6 PB (1.73 t) | 20 |
| colony-v5-cadre | 18 | 5 | 6 | 1,139 Mbit/s | 1.1 PB | 24.2 PB | 75.8 PB | 68.6 PB (3.43 t) | 16 |
| colony-v5 | 37 | 12 | 7 | 3,459 Mbit/s | 3.4 PB | 73.5 PB | 230.6 PB | 215.8 PB (10.8 t) | 16 |
| seed-v5-auto | 12 | 3 | 4 | 493 Mbit/s | 0.5 PB | 8.9 PB | 28.2 PB | 23.4 PB (1.17 t) | 14 |

```
 robots ─ cameras 2 x 15 Mb/s at duty, logs 1 Mb/s ──┐
 hull sensors ─ 10 kb/s each, one per 5 m2 ──────────┤
 drive, ring, ECLSS telemetry ───────────────────────┤
 scouts ─ optical / UHF mesh ────────────────────────┘
                                                     │  0.4 - 3.5 Gbit/s
                                                     ▼
   ┌──────── 400 Gbit/s optical spine, 2 rings, Wi-Fi 6E / 60 GHz cells in every module ────────┐
   │  7-37 hardened compute nodes in 4-7 racks: shared world model, PBFT consensus, planners   │
   └──────┬───────────────────────────┬─────────────────────────────────┬──────────────────────┘
          │ full rate, 90 days        │ 10 % summary, whole crossing    │ decisions + dissent, forever
          ▼                           ▼                                 ▼
   node flash (0.4 TB x n) ────▶ deck vault (20-216 PB, 3 replicas) ◀──── every vote, every veto
                                      │
                                      ▼
   observation deck: immersion pods, 18 m2 wall, data theatre
     scrub any moment ◀──▶ 3-D reconstruction of ship and surroundings ◀──▶ annotate, review, sign off
                                      │  < 50 ms
                                      ▼
   telepresence cockpits ──▶ pilot any humanoid, flyer or crawler; the AI interlocks every move
   Earth: 8.74 yr round trip ── reports out, nothing piloted in
```

The page prints this diagram with the selected ship's own numbers.

### Who wakes whom

The swarm runs the ship. It wakes people in tiers, with the lead time the physiology needs, and it
wakes the whole cadre only for the two things it is forbidden to decide alone: abandoning the mission
profile, and anything irreversible involving the sleepers themselves.

| Tier | Who is woken | Lead time | Triggers | What the swarm must report |
| --- | --- | --- | --- | --- |
| 0 Swarm-only | nobody | none | routine maintenance, trajectory trim, robot repair, pod medical adjustments inside protocol | logged; summarised at the next scheduled wake |
| 1 Advisory wake | the one on watch (already awake) | none | a Byzantine disagreement that reached quorum by one vote, a spares line under two years of stock, an anomaly unresolved for 30 days | anomaly, evidence, the options the swarm scored, its recommendation |
| 2 Specialist wake | one named sleeper (physician, propulsion, systems) | 24 h | a pod out of protocol, a drive parameter outside the envelope, a hull breach the crawlers contained but cannot explain | as tier 1 plus the full-rate record of the event in the observation deck |
| 3 Council wake | half the cadre | 36 h | a mission-profile decision (abort to flyby, change of target, jettison of a module), a disagreement between the swarm and the watch | as tier 2 plus the swarm's own dissent: the minority vote and its reasoning |
| 4 All hands | everyone | 48 h | arrival sequence, a decision about the sleepers (ending torpor for one of them), loss of the swarm's quorum | everything; the humans hold command until they return it |

Lead times are 16 h of rewarming plus 8 h of orientation and the time to stagger the wakes; the test
checks they never fall with tier and that any tier that wakes a sleeper allows rewarming plus eight
hours. Handover is a rule, not a gesture: the party taking control repeats back the state (position,
mode, active tasks, hazards), the record marks it, and a handover under tier 3 or 4 needs two humans.

### Shared-autonomy modes

| Mode | Latency | Who | Used for | Interlock |
| --- | --- | --- | --- | --- |
| direct teleoperation | < 50 ms force feedback, < 150 ms video | awake human in a cockpit, AI as safety interlock | novel repair, medical procedure, anything the AI has no model for | the AI vetoes moves that break joint limits, contact force limits or keep-out zones; the human can override with a two-step confirm |
| supervised autonomy | < 2 s | AI executes, human watches and may stop | scheduled maintenance the human wants to see; training the model on a new task | every step previewed in the operator's display before it runs; stop is one word or one button |
| AI-only | none | the swarm by consensus | everything in tier 0 and the execution of any plan a human has approved | quorum vote on every plan; a dissenting node's objection is logged and shown at the next wake |
| handover | - | both | the moment control passes either way | repeat-back of state; the record marks it; two humans under tier 3 or 4 |

Training and simulation: the recorded world model is the simulator. A sleeper woken for a tier-2
repair rehearses it in the deck against the swarm's own reconstruction before touching the cockpit,
and the same record is how the swarm's planners are retrained on what the humans did differently.

## 8. Before and after

Every version of the three crewed classes, measured by the same solver. The v2 and v3 columns show the
ships as pinned and, beside them, the consumables and life support their own crews would need under
v5's laws for the crossing the v5 ship makes -- because a ship that forgot to eat is not a baseline.

| Class | Version | People | Hull (no sail, no drive) | Food + ECLSS not in the pin | Pressurised | Vehicle | Crossing | Robots |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| habitat | v2 habitat-spin (as pinned) | 24 awake | 523 t | +1.15 kt | 2,967 m3 | 623 t | beam (does not close) | - |
| habitat | v3 habitat-dfd (as pinned) | 24 awake | 112 t | +1.15 kt | 945 m3 | 3.99 kt | no route | - |
| habitat | **v5 habitat-v5** | 6 sleepers, 1.1 awake | 459 t | in the hull | 1,184 m3 | 16.6 kt | 45 yr | 42 |
| seed | v2 seed-spin (as pinned) | 110 awake | 2.56 kt | +5.46 kt | 19,359 m3 | 3.56 kt | beam (does not close) | - |
| seed | v3 seed-daedalus (as pinned) | 110 awake | 1.01 kt | +5.46 kt | 9,245 m3 | 34.2 kt | 46 yr | - |
| seed | **v5 seed-v5** | 12 sleepers, 2.1 awake | 1.35 kt | in the hull | 1,525 m3 | 45.3 kt | 47 yr | 65 |
| seed | **v5 seed-v5-auto** | none | 706 t | in the hull | 333 m3 | 24.6 kt | 46 yr | 46 |
| colony | v2 colony-spin (as pinned) | 1,000 awake | 9.54 kt | +56.4 kt | 79,288 m3 | 19.5 kt | beam (does not close) | - |
| colony | v3 colony-pulse (as pinned) | 1,000 awake | 10 kt | +56.4 kt | 150,400 m3 | 326 kt | 77 yr | - |
| colony | **v5 colony-v5-cadre** | 60 sleepers, 10.6 awake | 8.82 kt | in the hull | 2,564 m3 | 296 kt | 54 yr | 104 |
| colony | **v5 colony-v5** | 1,000 sleepers, 176.5 awake | 41.3 kt | in the hull | 23,419 m3 | 1.38 Mt | 54 yr | 329 |

Reading it honestly:

- **The v5 hulls are heavier than the v3 hulls** (459 t against 112 t for the habitat) because they
  carry food, life support, shielding, robots and spares and the v3 hulls carried none of it. Against
  the baseline that eats, they are a third to a sixth of the mass.
- **The seed's v5 wet mass is above v3's** (45 kt against 34 kt) for the same reason, plus 600 t of
  arrival kit the v1 seed carried as a 21 m pressurised can of "cargo" and v5 carries as a palletised
  frame in the thrust path. The uncrewed seed is 25 kt.
- **The habitat closes in v5 and did not in v3**: the v3 habitat flew a direct-fusion engine that gave
  0.1 % c; v5 gives it the Daedalus drive the trade picked, and it crosses in 45 years.
- **The colony's crossing shortens from 77 to 54 years** because the boost is capped at ten years by
  clustering engines (5 for the cadre colony, 23 for the thousand-sleeper one); v3's single 5 MN engine
  spent 55 of its 77 years accelerating.
- **Pressurised volume falls 2.5x to 30x**, and almost all of what remains is the ring.
- **The thousand-sleeper colony is the wall**: 28 kt of consumables outweigh its 6.7 kt ring four
  times over, and the ship is 1.38 Mt wet. Sleepers eat. The recommended colony is the cadre one.

### Mass breakdown

| Part kind | habitat-v5 | seed-v5 | colony-v5 | colony-v5-cadre | seed-v5-auto |
| --- | --- | --- | --- | --- | --- |
| torpor-ring | 244 t | 297 t | 6.73 kt | 793 t | - |
| stores | 142 t | 295 t | 28 kt | 1.68 kt | - |
| arrival-kit | - | 600 t | 6 kt | 6 kt | 600 t |
| seed-vault | - | 39.1 t | 204 t | 204 t | 39.1 t |
| robot-hangar | 11.3 t | 17.5 t | 97.8 t | 26 t | 10.9 t |
| robot-lock | 1.5 t | 1.5 t | 1.5 t | 1.5 t | 1.5 t |
| fab-bay | 7.52 t | 9.5 t | 35.6 t | 14.4 t | 7.83 t |
| obs-deck | 11.1 t | 12 t | 57 t | 15.6 t | - |
| robot | 7 t | 8.91 t | 33.1 t | 12.9 t | 7.28 t |
| compute-rack | 390 kg | 588 kg | 1.1 t | 612 kg | 408 kg |
| scout-rack | 112 kg | 184 kg | 328 kg | 328 kg | 184 kg |
| rail-network | 4.11 t | 6.64 t | 14 t | 8.78 t | 4.86 t |
| reactor-fsp | 8.7 t | 10.2 t | - | - | 4.2 t |
| reactor (1.1 MWe x 2) | - | - | 28 t | 28 t | - |
| pressurised-module | 10.3 t | 41.1 t | 20.6 t | 20.6 t | 20.6 t |
| node | 5 t | 5 t | 5 t | 5 t | 5 t |
| thrust-collar | 900 kg | 900 kg | 900 kg | 900 kg | 900 kg |
| radiator | 1.64 t | 1.64 t | 1.64 t | 1.64 t | 1.64 t |
| spin-bearing | 1.8 t | 1.8 t | - | - | - |
| despin-hub | - | - | 4.2 t | 4.2 t | - |
| pma | 1.9 t | 1.9 t | - | - | 1.9 t |
| drive (engines, frame, store, propellant) | 16.1 kt | 44 kt | 1.34 Mt | 287 kt | 23.8 kt |
| **hull** | **459 t** | **1.35 kt** | **41.3 kt** | **8.82 kt** | **706 t** |
| **wet** | **16.6 kt** | **45.3 kt** | **1.38 Mt** | **296 kt** | **24.6 kt** |

The drive is the rocket equation's answer for the hull above it at a 20:1 mass ratio
(`CENTAURI-PROPULSION.md`): `dry = (hull + engines + frame) / (1 - f (R - 1))`, `prop = dry (R - 1)`.
The robots are 1.5 % of the habitat's hull and 0.08 % of the colony's; the ring and the food are what
a crewed ship weighs.

## 9. The pictures

`centauri-shots/robotic/`, taken from `centauri-robotic.html` at 1600 x 1100 through the page's own
`?shot=` hook (the canvas is posted to a local receiver, so the PNG is the rendered view, not a window
capture). Each was looked at and the model re-cut where it did not read: the first hangar cutaway
faced away from the camera (a three.js cylinder's theta starts at +z, not +x), the first ring hid its
pods behind an opaque torus (the shell is now translucent and the shelter band opaque), the Dextre
sat in the hangar's opening (moved to the +x face).

| File | What it shows |
| --- | --- |
| `habitat-v5-overview.png` | the whole ship: torpor ring aft on its bearing, the stack, the 19 x 116 m Daedalus magazine and 28 m pusher plate |
| `habitat-v5-hangar.png` | into the hangar cutaway: cradles with humanoids, cargo robots, the maintenance benches, the quarantine door; racks and the lock outside |
| `habitat-v5-ring.png` | the torpor ring from aft: six pods and two cockpits in the dark shelter band, the awake quarters beyond |
| `habitat-v5-deck.png` | the observation deck cutaway: immersion pods, the wall, the vault racks, the two domes; crawlers on the rails |
| `habitat-v5-drive.png` | the magazine, frame, plate and the rails running past it |
| `seed-v5-overview.png`, `seed-v5-hangar.png` | the seed with its four workshop labs, vault and arrival kit |
| `seed-v5-auto-overview.png` | the uncrewed seed: no ring, no deck |
| `colony-v5-cadre-overview.png`, `-ring.png`, `-hangar.png` | the recommended colony: 60 pods in two rows, the reactors on the despun hub inside the ring, the 64 x 191 m magazine and 92 m plate |
| `colony-v5-overview.png`, `colony-v5-ring.png` | the thousand-sleeper colony and its 55.9 m three-deck ring |
| `robot-gallery.png` | the eleven robot classes at true scale beside the 1.8 m person |

## 10. Tests

`centauri-robotic.test.mjs`, 863 checks, run by `run-tests.mjs` with the rest (18/18 files pass,
`centauri-fleet.test.mjs` still 698):

- the trade study: weights sum to one, every option scored 1-5 on every criterion, B ranks first, C
  is recommended, exactly one option beats it and that one fails the requirement, A and F score under 3;
- the human laws: 2.34 kg per awake person-day, 3/17 awake, torpor inside SpaceWorks' range, 10-20 h
  rewarming, the dose an order of magnitude past the career limit and reported;
- the robot laws: every class has mass, envelope, domain and source; humanoids person-sized; Dextre,
  ERA and Astrobee keep their real figures; failures = robots x hours / MTBF; feedstock = printed x 1.3;
- the swarm: >= 7 nodes, f >= 2, quorum 2/3 + 1, petabytes not exabytes, three replicas, in-ship
  latency inside the haptic budget, 8.74 yr to Earth and back;
- the wake tiers: five, lead times monotone, any sleeper wake >= rewarm + 8 h, four autonomy modes with
  interlocks, handover is a mode;
- per build: no structural fault, every part placed, mate graph a tree, **mass is the sum of the
  parts**, no interface overloaded, no sail, mast or solar wing, drive + hangar + fab + rails present,
  compute in >= 3 racks, CG on the thrust line, reactor covers the load; **pins** on mass, hull, wet,
  beta, crossing, robots, ring; **closure**: crosses in <= 100 years, dry + prop = wet, assembly mass =
  rocket equation's wet, inside 20:1, boost inside the cap, thrust scales with engine count;
  **consumables = crew x days x per-person** (torpor-weighted, with margin and medical stock) and the
  tank is in the thrust path on hardpoints; **ring** at 1 g, rpm justified by the awake stint, deck
  holds the required area, shield = shell x 500 kg/m2, the stack passes inside the ring's inner wall;
  **robots**: every inventory row except the racked scouts is a placed part, every garaged robot is
  inside the hangar envelope and they take under half its volume, the lock hatch passes the robot door
  and an EVA humanoid and a crawler fit through it, crawlers and ERAs ride the rails outside the hull
  at the standoff, the rails span stack and drive; **reach coverage >= 1**; **spare ratio** 30-60 %
  and in the fab bay's mass; swarm nodes all in racks on >= 2 modules with none holding half; deck pods
  per the law, vault in the deck's mass, deck within a spoke of the ring, >= 2 cockpits; **no
  overlaps**: each axial module starts where the one below ends, side-mounted parts sit outside their
  host's radius;
- before/after: every v5 hull lighter than its v2 with its crew fed, every torpor ring lighter than
  the v2 ring, fewer people; the thousand-sleeper wall; the uncrewed seed lightest; the habitat closes
  where v3 did not;
- v5 touches nothing: catalogue collar keeps its hinge, catalogue ring its active hub, v2 habitat-spin
  and v3 seed-daedalus still measure to their pins, the v5 pins live in their own file, a build is
  deterministic.

The pins were generated by `measureRobotic()` for each design and written to
`parts/fleet-versions-v5.js`; to re-cut a version, change the law, regenerate, and say why in this
note.

## 11. Open items and what is uncertain

- **Torpor for decades is unvalidated.** Everything past 14 days is extrapolation of SpaceWorks'
  protocol. If it does not scale, option B is the ship.
- **The dose is not solved by this design.** 7.5-8.9 Sv behind 50 g/cm2 over 45-54 years. Thicker
  shielding saturates; the honest mitigations are fewer people, a faster ship (a higher mass ratio than
  20:1, which nothing built approaches) or a magnetic shield that is not modelled here.
- **The AI maturity is asserted, not demonstrated.** 50 hardened TOPS per node and a decade of
  unsupervised autonomy are the design's assumptions; the flown record is minutes to days.
- **The bearing.** The torpor rings hang on the catalogue's 1.8 t spin bearing (habitat, seed, cadre
  colony) or the 4.2 t despun hub (thousand-sleeper colony), both already flagged in
  CENTAURI-AUDIT.md as placeholders for a rated bearing. The loads are smaller than v2's (244 t at
  24.8 m against 409 t at 55.9 m) but still unrated.
- **The habitat ring is the 3 m tube minimum**, 375 m2 for 106 m2 of need. A thinner tube would be a
  corridor; a ring without a ring (pods in microgravity) is the alternative SpaceWorks did not take.
- **The reactor is a specific-mass law** (150 kg/kWe plus 1.2 t, from the Fission Surface Power
  figures), not a design; its own radiator is assumed integral. The two 1.1 MWe units on the colony
  are the v1 parts at 13 kg/kWe, an order of magnitude more optimistic, and the gap is stated.
- **Rails on a pulse ship.** Four rails and crawlers run past a pusher plate taking 5 MN pulses; the
  shock environment at the drive end is not modelled, and the Daedalus and Dyson studies would have
  kept the Wardens well forward.
- **The arrival kit is a mass, not a manifest.** 600 t and 6 kt at 300 kg/m3 of palletised hardware is
  the share of the source payload that is colony kit rather than people; what is on the pallets is not
  designed.
- **The hull-area law for EVA robots is dominated by the magazine**, and a magazine of pulse units
  may need a different inspection regime from a pressure hull.
- **Not added to `ships.json` or the spacecraft catalogue**: `centauri-fleet.test.mjs` pins that file's
  row count to v1-v3 and the realism pass on `centauri/realism-pass` may be editing it; the v5 ships are
  shown on their own page instead, with the v1-v3 ships beside them.
- **Screenshots are design-draft renders**, not the AAA finish the brief asked for: the primitives are
  the catalogue's (cylinders, boxes, tori) with parametric robots on top. The realism pass's primitives
  library, when it lands, is where that finish would come from; the v5 builders take a part and return
  a group, so they can be re-skinned without touching the laws.
