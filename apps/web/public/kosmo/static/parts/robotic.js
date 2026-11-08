/* robotic.js -- v5 of the crewed Centauri classes: an AI-swarm ship that flies itself, a robot
   workforce that maintains it, and a small human cadre that sleeps through most of the crossing and
   is woken when the swarm needs a decision it is not allowed to take alone.

   This file is the trade study, the robot catalogue, the swarm architecture, the wake-up logic and
   the ship builds, all as data and pure functions. CENTAURI-ROBOTIC.md is the written argument; the
   numbers in that note are generated from here, and centauri-robotic.test.mjs holds the invariants.

   What a v5 ship is, in one paragraph. The pressurised stack of the v1 hull is kept where it earns
   its mass (a node, a workshop lab, a stores can) and re-cut everywhere else: the 24/110/1,000-person
   1 g ring becomes a ring sized for the people who are actually awake plus a torpor bay for the ones
   who are not, with the storm shelter wrapped round the sleepers because that is where the humans
   already are when a solar-particle event arrives. A robot hangar, a fabrication bay, an observation
   deck and a distributed set of radiation-hardened compute racks are added as placed parts with
   their own masses, volumes and power, and the robots themselves are parts mated to cradles, rails
   and docks, so the mass closure and the "does it fit" check come out of the same solver that places
   everything else. The sail and its mast are gone: a ship that has to cross in a lifetime takes the
   drive the rocket equation says closes (Daedalus-class inertial fusion or a Dyson pulse magazine),
   and the solar wings are gone too, because there is no sunlight between stars.

   Every law below states its source or says "derived". SI: metres, kilograms, watts, seconds.
   No DOM: imported by the viewer, the docs generator and the node checks. */

import { PARTS, PORT_TYPES, cargoPart, drivePart, formatMass } from './parts.js';
import { trussSpec } from './primitives/spec.js';
import { ringFor, DECK, AREAL_MASS, POWER as RING_POWER, COMFORT_RPM } from './centrifuge.js';
import { DRIVES, planFor, R_CAP, ROUTE_LY, LY, C as C_LIGHT } from './propulsion.js';
import { solveAssembly, summarize, checkAssembly } from './assembly.js';
import { CLASSES, VARIANTS, PROPELLED, measure } from './fleet.js';

export const DAY = 86400;
export const YEAR = 365.25 * DAY;
export const G0 = 9.80665;

/* ------------------------------------------------------------------ *
 * 1. The humans: consumables, life support, torpor, shielding
 * ------------------------------------------------------------------ */

/* Open-loop demand per crew-member-day, NASA Baseline Values and Assumptions Document (BVAD,
   NASA/TP-2015-218570 Rev 1, 2018, tables 3.x and 4.x; the figures are the ones the ISS resupply
   model uses): oxygen 0.84 kg, packaged food 1.83 kg, drinking and food-preparation water 3.0 kg,
   hygiene water 1.3 kg. Closure is what the ISS loop achieves today for water (the Water Recovery
   System recovers ~93 % of what it is fed) and what an advanced loop is credited with for oxygen
   (Sabatier plus methane pyrolysis, ~75 %). Food is not closed: there is no farm on these ships, and
   the note says why (6 MW of LED lighting for a colony). */
export const PER_PERSON_DAY_KG = { oxygen: 0.84, food: 1.83, waterPotable: 3.0, waterHygiene: 1.3 };
export const CLOSURE = { water: 0.93, oxygen: 0.75, food: 0 };
export const CONSUMABLES_MARGIN = 1.2;

/** Net consumables per awake person-day with the loop closures above: 2.34 kg. */
export function netPerPersonDayKg() {
  const p = PER_PERSON_DAY_KG;
  return p.food * (1 - CLOSURE.food) + p.oxygen * (1 - CLOSURE.oxygen) + (p.waterPotable + p.waterHygiene) * (1 - CLOSURE.water);
}

/* Torpor, after SpaceWorks' NIAC studies (Bradford, Schaffer et al., "Torpor Inducing Transfer
   Habitat for Human Stasis to Mars", NIAC Phase I 2014 and Phase II 2016-2018): therapeutic
   hypothermia at 32-34 C, total parenteral nutrition through a line, 14-day torpor cycles with 2-3
   days awake, crew staggered so that one or two are always up, metabolic rate down 50-70 %, and the
   habitat spun for gravity to limit deconditioning. Rewarming is a clinical rate: 0.25-0.5 C per
   hour from 32 C to 37 C is 10-20 hours, which is why the wake-up logic needs a day of lead time.

   Everything about torpor past 14 days is extrapolation. The longest clinical cooling is days, not
   decades, and no study has looked at a 46-year crossing. The model uses the protocol's own cycle and
   says so; the uncrewed variant below is the hedge if the physiology does not scale. */
export const TORPOR = {
  cycleDormantDays: 14,
  cycleAwakeDays: 3,
  metabolicFraction: 0.4, // 60 % reduction, the middle of SpaceWorks' 50-70 %
  rewarmHours: 16, // 5 C at 0.25-0.5 C/h, clinical practice
  podKg: 260, // SpaceWorks pod: bed, cooling pads, TPN pump, sensors, 1 of 4 in a 3.7 x 4.5 m module
  podPowerW: 150, // monitoring, pumps, thermal control
  podDeckM2: 3.0, // 2.2 x 0.9 pod plus its share of the robot access aisle
  podVolumeM3: 6.0,
  medPerPodKg: 60, // drugs, lines, consumables for the whole crossing per sleeper
  source: 'SpaceWorks Enterprises, Torpor Inducing Transfer Habitat for Human Stasis to Mars (NIAC Phase I 2014, Phase II 2016-2018): 14-day torpor, 2-3 days awake, 50-70 % metabolic reduction, TPN feeding, rotating habitat'
};

/** Fraction of the cadre awake at any moment under the staggered torpor rotation: 3/17 = 0.176. */
export const awakeFraction = () => TORPOR.cycleAwakeDays / (TORPOR.cycleAwakeDays + TORPOR.cycleDormantDays);

/* Life support hardware. The ISS USOS ECLSS supports six people with the Oxygen Generation System
   (~680 kg rack), two Water Recovery System racks (~1,400 kg), the Carbon Dioxide Removal Assembly
   (~200 kg), the Sabatier reactor, the trace-contaminant and atmosphere-control assemblies and the
   Urine Processor, about 4-5 t and ~5 kW for six: 800 kg and 700 W per supported awake person is the
   round figure used here, with 1.5 strings for redundancy on a ship nobody can resupply. */
export const ECLSS = { kgPerPerson: 800, wPerPerson: 700, strings: 1.5, source: 'ISS USOS ECLSS (OGS, WRS, CDRA, Sabatier, TCCS): ~4.5 t and ~5 kW for six crew' };

/* Shielding. A solar-particle-event shelter needs 20-40 g/cm2; the figure used for the torpor bay
   and the storm shelter is 50 g/cm2 of water-equivalent (500 kg/m2), which is also what halves the
   galactic cosmic-ray dose rate behind it -- and no more than that, because GCR shielding saturates
   (Cucinotta et al., NASA/TP-2013-217375; Slaba et al. 2017 on polyethylene/water shields).
   Interstellar GCR outside the heliosphere is higher than at 1 AU, so 0.3 Sv/yr unshielded is used,
   against 0.2-0.25 Sv/yr measured by MSL-RAD on the Mars transit. Over a 46-year crossing that is
   14 Sv unshielded and ~7 Sv behind the shelter: an order of magnitude past any career limit, and
   the single biggest physiological argument for the uncrewed variant. */
export const SHIELD = { arealKgM2: 500, gcrSvPerYrUnshielded: 0.3, gcrReduction: 0.5, careerLimitSv: 0.6, source: 'NASA/TP-2013-217375 (Cucinotta), Slaba et al. 2017, MSL-RAD transit dose 1.8 mSv/day' };

/* ------------------------------------------------------------------ *
 * 2. The robots: a catalogue with real analogues
 * ------------------------------------------------------------------ */

/* Every row is a class of machine with a flown or built analogue. `massKg`, `dims` (its stowed
   envelope: l along its own axis, d across), `avgW` the average draw over its duty cycle, `peakW`
   the active draw, `batteryWh`, `duty` the fraction of time it is working, `reachM` what it can
   touch from where it stands, `domain` where it lives. Counts are laws in `robotFleetFor()`. */
export const ROBOTS = {
  'humanoid-iva': {
    name: 'IVA humanoid (Figure 02 / Optimus class)', role: 'dexterous crew-equivalent inside the pressurised volume: rack swaps, medical assist, housekeeping, telepresence body',
    massKg: 75, dims: { l: 1.72, d: 0.6 }, avgW: 120, peakW: 400, batteryWh: 2300, duty: 0.3, speedMs: 1.2, reachM: 0.9, payloadKg: 20, domain: 'iva',
    source: 'Figure 02 (70 kg, 1.68 m, 2.25 kWh, ~5 h); Tesla Optimus Gen 2 (57 kg, 1.73 m, 2.3 kWh); Agility Digit (65 kg, 1.75 m, 16 kg payload); NASA Robonaut 2 (150 kg torso on ISS 2011-2018)'
  },
  'humanoid-eva': {
    name: 'EVA humanoid (Valkyrie class, hardened)', role: 'outside work a crawler cannot reach: hinge repair, radiator panel swap, drive-bay inspection',
    massKg: 140, dims: { l: 1.88, d: 0.7 }, avgW: 150, peakW: 600, batteryWh: 3000, duty: 0.25, speedMs: 0.3, reachM: 1.0, payloadKg: 25, domain: 'eva',
    source: 'NASA R5 Valkyrie (125 kg, 1.88 m, 2013) plus 15 kg of thermal and radiation hardening; Robonaut 2 EVA upgrade study'
  },
  'free-flyer-iva': {
    name: 'IVA free-flyer (Astrobee class)', role: 'inventory, air sampling, camera for the telepresence operator, sensor carrier inside the modules',
    massKg: 10, dims: { l: 0.32, d: 0.32 }, avgW: 20, peakW: 60, batteryWh: 200, duty: 0.4, speedMs: 0.5, reachM: 0.3, payloadKg: 1, domain: 'iva',
    source: 'NASA Astrobee (ISS 2019-): 32 cm cube, ~10 kg, perching arm, ~3 h on a charge; SPHERES (4.3 kg, 2006-2019); JAXA Int-Ball'
  },
  'inspector-eva': {
    name: 'EVA inspection drone (AERCam/Seeker class)', role: 'hull, radiator and magazine inspection where there is no rail; beacon placement; swarm scout inside the ship’s own envelope',
    massKg: 16, dims: { l: 0.36, d: 0.36 }, avgW: 15, peakW: 80, batteryWh: 300, duty: 0.3, speedMs: 0.3, reachM: 0, payloadKg: 1, domain: 'eva',
    source: 'NASA AERCam Sprint (STS-87, 1997: 16 kg, 36 cm, cold-gas, two cameras); NASA Seeker free-flying inspector (Cygnus NG-11, 2019)'
  },
  'crawler-rail': {
    name: 'Hull rail crawler', role: 'inspect-and-repair along the hull rails: MLI patching, micrometeoroid damage, connector reseating, radiator loop valves',
    massKg: 150, dims: { l: 1.2, d: 0.8 }, avgW: 60, peakW: 450, batteryWh: 1500, duty: 0.35, speedMs: 0.05, reachM: 2.5, payloadKg: 40, domain: 'eva',
    source: 'Derived: ISS Mobile Transporter (885 kg, 0.025 m/s on the truss rail) carrying a Dextre-scale arm pair; JPL LEMUR 3 climbing robot (35 kg) for the gripper and inspection suite'
  },
  'arm-dextre': {
    name: 'Dexterous manipulator (Dextre class)', role: 'ORU swaps on the hangar face, berthing the scouts, handing parts between the rail crawlers and the hangar lock',
    massKg: 1560, dims: { l: 3.67, d: 1.4 }, avgW: 300, peakW: 2000, batteryWh: 0, duty: 0.15, speedMs: 0.02, reachM: 3.5, payloadKg: 600, domain: 'eva',
    source: 'CSA/NASA Dextre (SPDM): 1,560 kg, two 3.5 m arms, 600 kg payload, 2 kW peak'
  },
  'arm-era': {
    name: 'Long manipulator (ERA class)', role: 'moving modules, pods and cargo along a long stack; the colony’s hangar face to the magazine',
    massKg: 630, dims: { l: 11.3, d: 0.8 }, avgW: 120, peakW: 800, batteryWh: 0, duty: 0.1, speedMs: 0.1, reachM: 11.3, payloadKg: 8000, domain: 'eva',
    source: 'ESA European Robotic Arm (ISS 2021-): 630 kg, 11.3 m, 8 t payload, relocatable end to end'
  },
  'fab-cell': {
    name: 'Fabrication cell (metal and polymer printing, recycler)', role: 'prints 70 % of the spares the fleet consumes from feedstock and from failed parts',
    massKg: 450, dims: { l: 2.0, d: 1.1 }, avgW: 800, peakW: 3000, batteryWh: 0, duty: 0.3, speedMs: 0, reachM: 0, payloadKg: 0, domain: 'iva',
    source: 'Made In Space Additive Manufacturing Facility (ISS 2016, ~45 kg polymer FDM); Tethers Unlimited Refabricator (ISS 2018, recycler + printer); ESA/Airbus Metal3D (ISS 2024, ~180 kg); an industrial DED cell is 1-3 t'
  },
  'med-bot': {
    name: 'Medical and surgical automation', role: 'torpor induction and rewarming, line care, imaging, telesurgery body for the awake physician or the AI',
    massKg: 300, dims: { l: 1.8, d: 1.0 }, avgW: 150, peakW: 1500, batteryWh: 500, duty: 0.2, speedMs: 0, reachM: 1.2, payloadKg: 5, domain: 'iva',
    source: 'da Vinci patient cart (~540 kg, 4 arms); Raven II (NASA NEEMO 2012 underwater telesurgery tests); SpaceWorks torpor pod medical suite'
  },
  'cargo-bot': {
    name: 'Stowage robot on the module rail', role: 'moves CTBs, feedstock and spares between the stores can, the fab bay and the hangar',
    massKg: 90, dims: { l: 1.0, d: 0.8 }, avgW: 40, peakW: 300, batteryWh: 800, duty: 0.3, speedMs: 0.5, reachM: 0.8, payloadKg: 60, domain: 'iva',
    source: 'Amazon/Kiva drive unit (145 kg, 450 kg lift) scaled to a 60 kg CTB load on an internal rail; NASA Astrobee cargo-handling experiments'
  },
  scout: {
    name: 'Detachable scout (6U swarm member)', role: 'formation-flying sensor outrigger during cruise, forward probe and relay on arrival; a swarm node that leaves the hull',
    massKg: 15, dims: { l: 0.34, d: 0.24 }, avgW: 15, peakW: 40, batteryWh: 100, duty: 1, speedMs: 0, reachM: 0, payloadKg: 2, domain: 'eva',
    source: 'NASA Starling (four 6U CubeSats, 2023: swarm autonomy, mesh network, distributed science); ESA Proba-3 (2024: two-craft formation flying to mm); JPL ASTERIA (6U, 2017)'
  }
};

/* Reliability. Industrial manipulators quote 60,000-100,000 h MTBF; Mars rovers were designed for
   90 sols and ran 15 years, which says the design life understates the field life once the machine is
   babied by its operators. 40,000 h is used for every mobile robot here (a failure every 4.6 years),
   70 % of failures repairable from printed parts and the fleet's own cannibalised stock, 30 % needing a
   stocked spare of 5 % of the robot's mass (motors, sensors, a hand). Daedalus carried two 5 t
   "Wardens" for the same job; Icarus's self-repair study reached the same split between printing and
   stocked spares. */
export const RELIABILITY = {
  mtbfH: 40000, printableShare: 0.7, spareMassShare: 0.05, feedstockPerPrintedKg: 1.3, standbySpares: 0.25,
  source: 'Industrial manipulator MTBF 60k-100k h (ABB/Fanuc service data); MER rovers 90-sol design, 15-yr life; Project Daedalus Wardens (BIS 1978); Project Icarus self-repair study (JBIS 2011)'
};

/* ------------------------------------------------------------------ *
 * 3. The swarm: compute, network, storage, consensus
 * ------------------------------------------------------------------ */

/* One compute node is a radiation-hardened rack: processors, memory, a storage shelf and its own
   cooling plate. Flown references bracket it: a RAD750 is 10 W and 200 MIPS; NASA's High-Performance
   Spaceflight Computer (HPSC, 2022-) is a hundred times a RAD750 in ~ 20 W; Ingenuity flew a
   commercial Snapdragon 801 on Mars (a few W, no hardening, 72 flights). A node here is 24 kg, 400 W,
   50 TOPS of hardened inference in triple-modular-redundant lanes, which is optimistic for hardened
   silicon and ordinary for commercial, and 400 TB of radiation-tolerant flash. */
export const COMPUTE_NODE = {
  massKg: 24, powerW: 400, tops: 50, storageTB: 400, lanes: 3,
  source: 'BAE RAD750 (10 W, 200 MIPS); NASA HPSC (SiFive, 2022-, ~100x RAD750); Ingenuity Snapdragon 801; JPL CADRE rovers (2024-25) and NASA Starling for mesh autonomy'
};
/** Byzantine consensus tolerates f faulty nodes out of n = 3f + 1. Two simultaneous bad nodes is the
 *  minimum a ship nobody can patch should survive, so the floor is seven nodes. */
export const CONSENSUS = { faultsTolerated: 2, minNodes: 7, quorum: (n) => Math.floor((2 * n) / 3) + 1, source: 'Castro & Liskov, Practical Byzantine Fault Tolerance (1999): n >= 3f + 1' };

/* Network. The spine is optical fibre at 100 Gbit/s per lane, four lanes, every module on two
   independent rings; robots join over Wi-Fi 6E / 60 GHz cells in every pressurised module and over
   an optical and UHF mesh outside. In-ship latency is single-digit milliseconds, which is what makes
   force-feedback telepresence possible at all: Kontur-2 (DLR/Roscosmos, ISS 2015) ran a 1-DOF
   force-feedback joystick from the ISS to a robot on Earth at ~20-30 ms, and METERON Haptics-2 /
   Interact (ESA, 2015) drove a rover on the ground from orbit through a geostationary relay at
   ~0.8 s round trip, which the operators could still use with predictive display. Earth is 4.37 ly
   away: 8.7 years round trip. No control loop closes over that; only reports do. */
export const NETWORK = {
  spineGbps: 400, spineRings: 2, cellGbps: 10, cellsPerModule: 2, cellKg: 3, cellW: 30,
  inShipLatencyMs: 5, hapticLimitMs: 50, supervisedLimitS: 2, earthRoundTripYears: 2 * ROUTE_LY,
  source: 'DLR/Roscosmos Kontur-2 (ISS 2015, force-feedback at 20-30 ms); ESA METERON Haptics-2 and Interact (2015, ~0.8 s round trip through GEO relay); Sheridan, Telerobotics (1992) on the 0.3-1 s supervisory threshold'
};

/* Recorded data. Everything the swarm sees is kept, but not at full rate forever: full-rate video and
   telemetry for 90 days, then a tenth-rate summary (keyframes, events, every decision with its
   inputs) for the whole crossing, and every log forever. Rates per source are ordinary: a 4K
   inspection camera at 15 Mbit/s, a robot's proprioception and decision log at 1 Mbit/s, a hull
   sensor at 10 kbit/s. Storage is on the compute nodes' own flash, replicated three times across
   modules, with a cold archive in the observation deck's data vault. */
export const DATA = {
  cameraMbps: 15, robotMbps: 1, hullSensorKbps: 10, camerasPerRobot: 2, hullSensorsPerM2: 0.2,
  fullRateDays: 90, summaryShare: 0.1, replicas: 3, archiveTBPerKg: 20, archiveWPerTB: 0.1,
  source: 'Replication and tiering as in any telemetry archive; areal densities from commercial QLC flash (8 TB per 2.5" drive at ~0.1 kg, 80 TB/kg) derated 4x for radiation-tolerant parts, replication hardware and packaging'
};

/* ------------------------------------------------------------------ *
 * 4. Telepresence and the observation deck
 * ------------------------------------------------------------------ */

/* A telepresence cockpit is a seat (or a microgravity restraint frame), a head-mounted display, two
   force-feedback arm exoskeletons or haptic gloves, pedals for locomotion, a 1 Gbit/s link to the
   body being piloted and a rendering node. Sarcos' Guardian XT is the industrial analogue: a human
   in a master suit driving a dexterous upper body on a lift. One cockpit is 180 kg, 2.5 m2 of deck
   at 1 g, 1.5 kW while in use. */
export const COCKPIT = { massKg: 180, deckM2: 2.5, powerW: 1500, perAwake: 0.5, spare: 1, minimum: 2, source: 'Sarcos Guardian XT teleoperated upper body (2021); DLR Kontur-2 force-feedback joystick; NASA Robonaut 2 telepresence glove and HMD; ESA METERON Haptics-2 exoskeleton' };

/* The observation deck: one immersion pod per awake person plus two for visitors, a 6 m wall
   display, a data theatre with the time-scrubbable record, and the data vault. In microgravity next
   to the spin bearing (so it is also the place the awake watch floats to from the spoke), with the
   storm shelter one spoke away in the ring. One pod per four awake people plus two for visitors: the
   deck is where the watch goes to look, not where everyone sits at once. Pods are 140 kg (a reclined
   restraint frame, HMD, hand
   tracking, a seat-scale haptic rig); the wall is 60 kg per m2 of display; the theatre's render farm
   is two compute nodes. */
export const OBS_DECK = { podKg: 140, podM3: 3.5, podW: 600, podShare: 0.25, visitorPods: 2, minimumPods: 3, wallM2: 18, wallKgPerM2: 12, wallWPerM2: 150, theatreM3: 40, renderNodes: 2, vaultReplicas: 1, source: 'ISS Cupola (1.9 t, 7 windows) for the "see the ship" role; commercial VR pods and 8K microLED walls for the areal figures' };

/* ------------------------------------------------------------------ *
 * 5. Wake-up logic and the control stack
 * ------------------------------------------------------------------ */

/* Who decides what. The swarm runs the ship. It wakes people in tiers, with the lead time the
   physiology needs (16 h to rewarm from 32 C, then 8 h of orientation before anyone is fit to decide
   anything), and it only wakes the whole cadre for the two things it is forbidden to decide alone:
   abandoning the mission profile, and anything irreversible involving the sleepers themselves. */
export const WAKE_TIERS = [
  { tier: 0, name: 'Swarm-only', who: 'nobody', leadH: 0, examples: 'routine maintenance, trajectory trim, robot repair, pod medical adjustments inside protocol', report: 'logged; summarised at the next scheduled wake' },
  { tier: 1, name: 'Advisory wake', who: 'the one on watch (already awake)', leadH: 0, examples: 'any Byzantine disagreement that reached quorum by one vote, a spares line falling below two years of stock, an unresolved anomaly older than 30 days', report: 'anomaly, evidence, the options the swarm scored, its recommendation' },
  { tier: 2, name: 'Specialist wake', who: 'one named sleeper (physician, propulsion, systems)', leadH: 24, examples: 'a pod out of protocol, a drive parameter outside the envelope, a hull breach the crawlers contained but cannot explain', report: 'as tier 1 plus the full-rate record of the event in the observation deck' },
  { tier: 3, name: 'Council wake', who: 'half the cadre', leadH: 36, examples: 'a mission-profile decision (abort to flyby, change of target, jettison of a module), a disagreement between the swarm and the watch', report: 'as tier 2 plus the swarm’s own dissent: the minority vote and its reasoning' },
  { tier: 4, name: 'All hands', who: 'everyone', leadH: 48, examples: 'arrival sequence, a decision about the sleepers (ending torpor for one of them), loss of the swarm’s quorum', report: 'everything; the humans hold command until they return it' }
];

export const AUTONOMY_MODES = [
  { mode: 'direct teleoperation', latencyMs: '< 50 ms force feedback, < 150 ms video', who: 'awake human in a cockpit, AI as safety interlock', use: 'novel repair, medical procedure, anything the AI has no model for', interlock: 'AI vetoes moves that break joint limits, contact force limits or keep-out zones; human can override with a two-step confirm' },
  { mode: 'supervised autonomy', latencyMs: '< 2 s', who: 'AI executes, human watches and may stop', use: 'scheduled maintenance the human wants to see; training the model on a new task', interlock: 'every step previewed in the operator’s display before it runs; stop is one word or one button' },
  { mode: 'AI-only', latencyMs: 'none', who: 'swarm by consensus', use: 'everything in tier 0 and the execution of any plan a human has approved', interlock: 'quorum vote on every plan; a dissenting node’s objection is logged and shown at the next wake' },
  { mode: 'handover', latencyMs: '-', who: 'both', use: 'the moment control passes either way', interlock: 'the party taking control repeats back the state (position, mode, active tasks, hazards); the record marks the handover; a handover under tier 3 or 4 needs two humans' }
];

/* ------------------------------------------------------------------ *
 * 6. The trade study
 * ------------------------------------------------------------------ */

/* Scored 1 (worst) to 5 (best) against a stated rubric. The weights are a choice and are printed
   with the scores; change one and the ranking is re-derived. Options are described in the note. */
export const RUBRIC = [
  { id: 'mass', name: 'Mass to cruise (consumables, ring, shielding, drive)', weight: 0.20 },
  { id: 'reliability', name: 'Reliability and repair over 50-80 years with no resupply', weight: 0.15 },
  { id: 'success', name: 'Mission success if the humans are lost or incapacitated', weight: 0.15 },
  { id: 'physiology', name: 'Human physiological risk (dose, ageing, torpor, deconditioning)', weight: 0.15 },
  { id: 'autonomy', name: 'Dependence on unproven autonomy and AI judgement', weight: 0.10 },
  { id: 'ethics', name: 'Ethical exposure (consent, children, abandonment, embryo colonisation)', weight: 0.10 },
  { id: 'value', name: 'What having humans aboard is worth at the other end', weight: 0.10 },
  { id: 'complexity', name: 'Development cost and complexity', weight: 0.05 }
];

export const TRADE_OPTIONS = [
  { id: 'A', name: 'Baseline crewed (v2/v3): everyone awake, 1 g ring, 24/110/1,000 crew',
    scores: { mass: 1, reliability: 3, success: 2, physiology: 2, autonomy: 5, ethics: 3, value: 4, complexity: 3 },
    why: 'Honest consumables for 1,000 awake people over 76 years are 78 kt, eight times the colony’s own payload; every crew member takes the full 14 Sv; a generation is born and dies in transit. Rejected on mass and dose.' },
  { id: 'B', name: 'Fully autonomous: no humans; seed bank, embryo/gamete bank and a digital archive as the colonisation payload',
    scores: { mass: 5, reliability: 4, success: 5, physiology: 5, autonomy: 2, ethics: 2, value: 2, complexity: 4 },
    why: 'The lightest and the most survivable ship, and the one with nobody to notice when its model of the world is wrong. Gestating and raising children from a bank with no adults is the ethical problem Edwards (2021) and others set out, and it is unsolved. Kept as the uncrewed extreme (seed-v5-auto): it is what you fly if torpor physiology does not scale.' },
  { id: 'C', name: 'AI-swarm ship with a dormant cadre: the ship flies itself, a small cadre sleeps in cyclic torpor and is woken by tiered triggers; observation deck and telepresence cockpits for the humans',
    scores: { mass: 4, reliability: 4, success: 4, physiology: 3, autonomy: 3, ethics: 4, value: 4, complexity: 3 },
    why: 'Takes the mass of B plus a few percent for the sleepers and their bay, keeps adults aboard for the arrival and for the decisions an AI is not allowed to make, and keeps them out of the way for the 82 % of the time nothing is happening. The open risk is physiological: torpor beyond 14 days is untested and the dose is not reduced by sleeping. Recommended.' },
  { id: 'D', name: 'Small awake crew of 2-6 with a robot workforce (no torpor)',
    scores: { mass: 3, reliability: 4, success: 3, physiology: 2, autonomy: 4, ethics: 4, value: 3, complexity: 3 },
    why: 'Six people awake for 46 years is six lifetimes spent in a 25 m ring; consumables are 2.5x option C, the dose is the same, and with no sleepers there is no reserve of fresh judgement for arrival. Rejected: it is option C without the one thing torpor buys.' },
  { id: 'E', name: 'Humans as supervisors on a minimal habitable core: humans command, the AI advises; watch rotates through torpor',
    scores: { mass: 4, reliability: 3, success: 2, physiology: 3, autonomy: 5, ethics: 4, value: 4, complexity: 3 },
    why: 'Same hardware as C with the authority inverted. A ship whose plan needs a human signature cannot act in the 20 hours it takes to rewarm one, and dies with its crew. Rejected on mission success; its cockpits and tiers survive inside C as the intervention mode.' },
  { id: 'F', name: 'Generation ship (Project Hyperion class): a self-sustaining population awake for the whole crossing',
    scores: { mass: 1, reliability: 2, success: 3, physiology: 2, autonomy: 5, ethics: 1, value: 5, complexity: 1 },
    why: 'The only option that arrives with a working society, and the one that needs a closed food loop, a stable population and the consent of people not yet born. Hyperion’s own studies put it at tens of thousands of tonnes of habitat per hundred people. Out of scope for a 10 kt payload; rejected on mass, closure and ethics.' }
];

/* The requirement the crewed classes exist to meet: adults arrive alive and able to act. Option B does
   not meet it by construction, and it is scored anyway, because the honest result of this rubric is
   that the uncrewed ship scores highest and the crewed one with the fewest awake people second. The
   recommendation is the best option that meets the requirement; the one that beats it is built as the
   hedge. */
export const REQUIREMENT = { id: 'humans-arrive', name: 'Adults arrive alive and able to act', meets: { A: true, B: false, C: true, D: true, E: true, F: true } };

export function scoreOptions(options = TRADE_OPTIONS, rubric = RUBRIC) {
  const wsum = rubric.reduce((s, r) => s + r.weight, 0);
  return options.map((o) => {
    const total = rubric.reduce((s, r) => s + r.weight * o.scores[r.id], 0) / wsum;
    return { ...o, total, meetsRequirement: REQUIREMENT.meets[o.id] !== false };
  }).sort((a, b) => b.total - a.total);
}

/** The recommended route: the top-scoring option that meets the requirement. */
export function recommend(options = TRADE_OPTIONS, rubric = RUBRIC) {
  const ranked = scoreOptions(options, rubric);
  return { pick: ranked.find((o) => o.meetsRequirement), ranked, beatenBy: ranked.filter((o) => !o.meetsRequirement && o.total > ranked.find((x) => x.meetsRequirement).total) };
}

/* ------------------------------------------------------------------ *
 * 7. The v5 designs
 * ------------------------------------------------------------------ */

/* Each design names its base class, its human cadre and whether the torpor bay and the awake decks
   ride on a spin ring. The ring spins at the short-stay 6 rpm where the awake stint is three days
   (the SpaceWorks cycle), because 1 g at 6 rpm is a 24.8 m ring and 1 g at 4 rpm is a 55.9 m one,
   and a cadre of six does not fill the latter; the colony keeps 4 rpm because its awake watch is 176
   people and its tube would otherwise be too fat for a flat gravity profile. Labs are Columbus
   workshops for the robots as much as for the humans. */
export const DESIGNS = [
  { id: 'habitat-v5', base: 'habitat', name: 'Crewed habitat, robotic', humans: 6, dormant: true, ring: true, rpm: COMFORT_RPM.short, labs: 1, drive: 'daedalus', seedBank: false, scouts: 4, kitKg: 0,
    note: 'Six sleepers, one awake; the v2 24-crew ring and both Columbus bunkrooms give way to a 25 m torpor ring, a hangar and a fab bay. The Daedalus drive replaces the direct-fusion engine, which never closed.' },
  { id: 'seed-v5', base: 'seed', name: 'Colony seed, robotic', humans: 12, dormant: true, ring: true, rpm: COMFORT_RPM.short, labs: 4, drive: 'daedalus', seedBank: true, vaultLines: 1000, scouts: 8, kitKg: 600e3,
    note: 'Twelve sleepers and a 1,000-genome embryo, gamete and seed vault instead of 110 awake colonists; four workshop labs for the robots that build the landing.' },
  { id: 'colony-v5', base: 'colony', name: 'Full colony, robotic (1,000 sleepers)', humans: 1000, dormant: true, ring: true, rpm: COMFORT_RPM.continuous, labs: 2, drive: 'pulse', seedBank: true, vaultLines: 10000, scouts: 16, kitKg: 6000e3,
    note: 'Option C scaled to the whole colony: a thousand colonists in cyclic torpor, 176 awake at any time, on a 55.9 m ring with three decks instead of six. This is the build that shows the consumables wall -- sleepers still eat -- and the torpor extrapolation is at its most strained here.' },
  { id: 'colony-v5-cadre', base: 'colony', name: 'Full colony, robotic (60 cadre + 10,000-line bank)', humans: 60, dormant: true, ring: true, rpm: COMFORT_RPM.short, labs: 2, drive: 'pulse', seedBank: true, vaultLines: 10000, scouts: 16, kitKg: 6000e3,
    note: 'The colony the trade study actually recommends: sixty adults in torpor, eleven awake, the thousand colonists as a 10,000-line bank, and six kilotonnes of arrival kit for the robots to build with. The ethics of the bank are in the note.' },
  { id: 'seed-v5-auto', base: 'seed', name: 'Colony seed, uncrewed', humans: 0, dormant: false, ring: false, rpm: 0, labs: 2, drive: 'daedalus', seedBank: true, vaultLines: 1000, scouts: 8, kitKg: 600e3,
    note: 'Option B built: no ring, no pods, no shelter, no observation deck; the vault, the robots and the fabrication bay. The hedge if torpor does not scale.' }
];

export const designById = (id) => DESIGNS.find((d) => d.id === id) ?? null;

/* ---- derived module parts ---- */

/* A pressurised module of the Columbus family, sized by the volume it has to hold. Columbus is
   10,275 kg for 75 m3 with its racks, 137 kg/m3; a shell with fittings but without science racks is
   taken at 90 kg/m3 of pressurised volume. Modules keep the CBM convention (aft active, fore
   passive) so they chain, and offer two external hardpoints for compute racks and two on the fore
   end for arms or docks. */
const MODULE_D = 4.5;
const MODULE_KG_PER_M3 = 90;
function moduleShell(kind, name, volumeM3, opts = {}) {
  const d = opts.d ?? MODULE_D;
  const l = Math.max(2.5, volumeM3 / (Math.PI * (d / 2) ** 2));
  const ports = [
    { id: 'aft', type: 'cbm', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
    { id: 'fore', type: 'cbm', gender: 'passive', at: [0, l, 0], axis: [0, 1, 0] },
    { id: 'rack-a', type: 'hardpoint', gender: 'active', at: [d / 2, l * 0.5, 0], axis: [1, 0, 0], clock: [0, 1, 0] },
    { id: 'rack-b', type: 'hardpoint', gender: 'active', at: [-d / 2, l * 0.5, 0], axis: [-1, 0, 0], clock: [0, 1, 0] },
    { id: 'util', type: 'hardpoint', gender: 'active', at: [0, l * 0.5, -d / 2], axis: [0, 0, -1], clock: [0, 1, 0] },
    ...(opts.ports ?? [])
  ];
  return {
    name, kind, dataQuality: 'derived',
    source: opts.source ?? `Derived: ${MODULE_KG_PER_M3} kg/m3 of pressurised shell and fittings (Columbus is 137 kg/m3 with its racks), ${d} m diameter CBM module`,
    dims: { l, d },
    mass: volumeM3 * MODULE_KG_PER_M3 + (opts.extraKg ?? 0),
    volume: { pressurised: volumeM3, habitable: volumeM3 * (opts.habitable ?? 0.6) },
    crew: opts.crew ?? 0,
    power: { gen: 0, load: opts.loadW ?? 0 },
    heat: { rejectCapacity: null },
    ports,
    ...(opts.extra ?? {})
  };
}

/* The robot hangar. Sized from the robots it garages: a humanoid cradle is 1.0 x 0.9 m of wall and
   2.1 m tall with its charging and data umbilical and a thermal-conditioning plate (the pack is kept
   at 15-25 C), a free-flyer dock is a 0.5 m cube, a maintenance station is 8 m3 with a bench, a
   parts carousel and an end-effector store, the quarantine bay for a failed or contaminated robot is
   10 m3 with its own door, the tool and end-effector store is 6 m3, and the robot lock to the hull
   rails is 8 m3 (a 2.2 x 1.2 m hatch; a crouching humanoid needs 1.0 x 2.0 m, a crawler 1.2 x 0.9 m).
   Robots egress through the lock to the rail heads and the EVA handrails; the inside door and the
   outside door are interlocked so the lock is never open both ways. 25 % of the volume is aisle:
   1.2 m clear, so two humanoids pass. */
export const HANGAR = {
  cradleM3: 1.9, cradleKg: 40, chargerKg: 15, umbilicalKg: 5, thermalPlateKg: 8,
  dockM3: 0.5, dockKg: 12,
  maintenanceM3: 8, maintenanceKg: 250, robotsPerMaintenanceStation: 15,
  quarantineM3: 10, quarantineKg: 400, robotsPerQuarantineBay: 50,
  toolStoreM3: 6, toolStoreKg: 300, toolsPerRobotKg: 4,
  lockM3: 8, lockKg: 1500, lockHatch: { w: 1.2, h: 2.2 }, robotDoor: { w: 1.0, h: 2.0 }, aisleM: 1.2, circulation: 1.25,
  cradlePitchM: 1.0, dockPitchM: 0.5,
  source: 'ISS Quest airlock (6.1 t, 34 m3, 1.0 m hatch) scaled to an unpressurised-robot lock; ISS crew quarters (2.1 m3 each) for the cradle envelope; Robonaut 2 and Astrobee docking/charging stations on ISS'
};

/* The fabrication bay: fab cells, their feedstock, the stocked spares and the metrology bench. */
export const FAB = { cellsPerRobots: 40, benchKg: 200, benchM3: 6, feedstockDensity: 2500, spareDensity: 800, cellM3: 4, source: 'As ROBOTS["fab-cell"]; feedstock is wire and powder at bulk densities of 2-3 t/m3' };

/* The seed vault for the seed and colony classes: 1,000 genomes as embryos and gametes in liquid
   nitrogen vapour plus a plant and microbial seed bank. Svalbard holds 1.2 million accessions in
   three vaults; an LN2 dewar bank for 1,000 human lines is a few tonnes of dewars and shielding and
   a few kW of cryocooler. */
export const SEED_VAULT = { lines: 1000, kgPerLine: 4, baseKg: 3000, volumeM3: 60, powerW: 4000, shieldKgM2: 500, source: 'Svalbard Global Seed Vault; clinical LN2 vapour-phase embryo storage; Edwards (2021), Embryo space colonisation' };

/* Rails: four longitudinal rails along the stack at 6 kg/m each (an aluminium rail with power and
   data bus), two rail heads at the hangar, and the crawlers that ride them. */
/* QA pass: the rails run at the 45 degree stations, between the racks, the lock, the reactor boom and the
   radiators that all sit on +-x and +-z; at 0/90 they ran straight through them. */
export const RAILS = { count: 4, kgPerM: 6, headKg: 120, standoffM: 0.35, crawlersPerM: 1 / 60, azimuth0: Math.PI / 4, source: 'ISS Mobile Transporter rail on the ITS truss; derived areal figures' };

/* Power: a fission unit sized at 150 kg/kWe for sub-megawatt loads (NASA Fission Surface Power
   request, 2022: 40 kWe in under 6 t), more conservative than the 13 kg/kWe the colony’s MW units
   use; the reactor has its own heat-pipe radiator. The hotel load it feeds is summed from the parts. */
export const REACTOR_FSP = { kgPerKWe: 150, baseKg: 1200, margin: 1.3, boomM: 12, source: 'NASA Fission Surface Power (2022 RFP): 40 kWe, < 6 t, 10 yr; Kilopower KRUSTY (2018): 1-10 kWe, 1.5 t' };
function reactorPart(kWe) {
  const kg = REACTOR_FSP.baseKg + REACTOR_FSP.kgPerKWe * kWe;
  const l = 4 + 0.03 * kWe, d = 2.2 + 0.006 * kWe;
  return {
    name: `Fission power unit, ${Math.round(kWe)} kWe`, kind: 'reactor-fsp', dataQuality: 'derived',
    source: REACTOR_FSP.source,
    dims: { l, d }, mass: kg, volume: { pressurised: null, habitable: null }, crew: 0,
    power: { gen: kWe * 1000, load: 0 }, heat: { rejectCapacity: kWe * 1000 * 3 },
    kWe,
    ports: [{ id: 'root', type: 'hardpoint', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
  };
}

/* ---- the robots as parts ---- */
function robotPart(id, index) {
  const r = ROBOTS[id];
  return {
    name: r.name, kind: `robot`, robot: id, index, dataQuality: 'derived', source: r.source,
    dims: { l: r.dims.l, d: r.dims.d }, mass: r.massKg,
    volume: { pressurised: null, habitable: null }, crew: 0,
    power: { gen: 0, load: r.avgW }, heat: { rejectCapacity: null },
    ports: [{ id: 'base', type: 'hardpoint', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
  };
}

/* ---- the fleet law ---- */

/** How many of each robot a hull needs. `hullAreaM2` is the external area to inspect, `modules` the
 *  pressurised module count, `stackM` the stack length, `volumeM3` the pressurised volume. */
export function robotFleetFor(design, hull) {
  const { hullAreaM2, modules, stackM, volumeM3, humans } = hull;
  const railLength = stackM;
  const counts = {
    'humanoid-iva': Math.max(2, Math.ceil(modules / 2) + Math.ceil(humans / 10)),
    'humanoid-eva': Math.max(2, 2 + Math.floor(hullAreaM2 / 4000)),
    'free-flyer-iva': Math.max(2, modules),
    'inspector-eva': Math.max(2, 2 + Math.ceil(hullAreaM2 / 1500)),
    'crawler-rail': Math.max(RAILS.count, Math.ceil(railLength * RAILS.crawlersPerM) * RAILS.count),
    'arm-dextre': 1,
    'arm-era': stackM > 80 ? Math.ceil(stackM / 150) : 0,
    'med-bot': humans > 0 ? Math.max(1, Math.ceil(humans / 250)) : 0,
    'cargo-bot': Math.max(1, Math.ceil(volumeM3 / 500)),
    scout: design.scouts
  };
  const mobile = Object.entries(counts).filter(([k]) => !['fab-cell', 'scout'].includes(k)).reduce((s, [, n]) => s + n, 0);
  counts['fab-cell'] = 1 + Math.floor(mobile / FAB.cellsPerRobots);
  const rows = Object.entries(counts).filter(([, n]) => n > 0).map(([id, n]) => {
    const r = ROBOTS[id];
    return { id, name: r.name, count: n, eachKg: r.massKg, massKg: n * r.massKg, avgW: n * r.avgW, peakW: n * r.peakW, domain: r.domain, reachM: r.reachM, role: r.role, source: r.source };
  });
  const total = rows.reduce((s, r) => s + r.count, 0);
  const massKg = rows.reduce((s, r) => s + r.massKg, 0);
  const avgW = rows.reduce((s, r) => s + r.avgW, 0);
  return { rows, counts, total, mobile, massKg, avgW, railLength };
}

/** Spares, feedstock and failure arithmetic for a fleet over the crossing. */
export function sparesFor(fleet, tripYears) {
  const hours = tripYears * 8766;
  const failures = fleet.mobile * hours / RELIABILITY.mtbfH;
  const mobileMass = fleet.rows.filter((r) => !['fab-cell', 'scout'].includes(r.id)).reduce((s, r) => s + r.massKg, 0);
  const perFailureKg = (mobileMass / Math.max(fleet.mobile, 1)) * RELIABILITY.spareMassShare;
  const printedKg = failures * RELIABILITY.printableShare * perFailureKg;
  const stockedKg = failures * (1 - RELIABILITY.printableShare) * perFailureKg;
  const feedstockKg = printedKg * RELIABILITY.feedstockPerPrintedKg;
  const standbyKg = mobileMass * RELIABILITY.standbySpares;
  return { hours, failures, perFailureKg, printedKg, stockedKg, feedstockKg, standbyKg, totalKg: stockedKg + feedstockKg + standbyKg, spareRatio: (stockedKg + standbyKg) / Math.max(mobileMass, 1e-9) };
}

/** Compute, storage and network for a fleet and a hull. */
export function swarmFor(fleet, hull, tripYears) {
  const nodes = Math.max(CONSENSUS.minNodes, Math.ceil(fleet.total / 12) + hull.modules);
  const f = Math.floor((nodes - 1) / 3);
  const camerasMbps = fleet.rows.filter((r) => !['fab-cell', 'scout'].includes(r.id)).reduce((s, r) => s + r.count * DATA.camerasPerRobot * DATA.cameraMbps * (ROBOTS[r.id].duty ?? 1), 0);
  const robotsMbps = fleet.total * DATA.robotMbps;
  const hullMbps = hull.hullAreaM2 * DATA.hullSensorsPerM2 * DATA.hullSensorKbps / 1000;
  const rateMbps = camerasMbps + robotsMbps + hullMbps;
  const tbPerDay = rateMbps * 1e6 * DAY / 8 / 1e12;
  const fullTB = tbPerDay * DATA.fullRateDays;
  const summaryTB = tbPerDay * DATA.summaryShare * tripYears * 365.25;
  const logicalTB = fullTB + summaryTB;
  const storedTB = logicalTB * DATA.replicas;
  const onNodesTB = nodes * COMPUTE_NODE.storageTB;
  const archiveTB = Math.max(0, storedTB - onNodesTB);
  const archiveKg = archiveTB / DATA.archiveTBPerKg;
  const archiveW = archiveTB * DATA.archiveWPerTB;
  const cells = hull.modules * NETWORK.cellsPerModule;
  return {
    nodes, faultsTolerated: f, quorum: CONSENSUS.quorum(nodes), tops: nodes * COMPUTE_NODE.tops,
    computeKg: nodes * COMPUTE_NODE.massKg, computeW: nodes * COMPUTE_NODE.powerW,
    rateMbps, tbPerDay, fullTB, summaryTB, logicalTB, storedTB, onNodesTB, archiveTB, archiveKg, archiveW,
    cells, networkKg: cells * NETWORK.cellKg + hull.stackM * 2 * 0.5, networkW: cells * NETWORK.cellW,
    earthRoundTripYears: NETWORK.earthRoundTripYears
  };
}

/* ---- the human side ---- */

export function humansFor(design, tripYears) {
  const n = design.humans;
  if (n === 0) return { humans: 0, awakeAvg: 0, dormantAvg: 0, consumablesKg: 0, eclssKg: 0, eclssW: 0, podsKg: 0, podsW: 0, cockpits: 0, cockpitsKg: 0, cockpitsW: 0, deckM2: 0, shelterM2: 0, doseSv: 0 };
  const awakeAvg = design.dormant ? n * awakeFraction() : n;
  const dormantAvg = n - awakeAvg;
  const days = tripYears * 365.25;
  const net = netPerPersonDayKg();
  const consumablesKg = (awakeAvg * net + dormantAvg * net * TORPOR.metabolicFraction) * days * CONSUMABLES_MARGIN + (design.dormant ? n * TORPOR.medPerPodKg : 0);
  /* The loop is sized for the peak awake load: everyone is awake at arrival and at a tier-4 wake. */
  const eclssKg = n * ECLSS.kgPerPerson * ECLSS.strings;
  const eclssW = awakeAvg * ECLSS.wPerPerson + (n - awakeAvg) * ECLSS.wPerPerson * TORPOR.metabolicFraction;
  const pods = design.dormant ? n : 0;
  /* One cockpit per two awake people plus a spare (ISS runs one robotics workstation for six), never
     fewer than two, so a handover always has a second seat. */
  const cockpits = Math.max(COCKPIT.minimum, Math.ceil(awakeAvg * COCKPIT.perAwake) + COCKPIT.spare);
  const deckM2 = Math.ceil(awakeAvg) * 30 + pods * TORPOR.podDeckM2 + cockpits * COCKPIT.deckM2 + 20;
  const shelterM2 = pods * TORPOR.podDeckM2 + Math.ceil(awakeAvg) * 2 + cockpits * COCKPIT.deckM2;
  const doseSv = SHIELD.gcrSvPerYrUnshielded * tripYears * (design.dormant ? (1 - SHIELD.gcrReduction) * 0.9 + 0.1 : 0.7);
  return { humans: n, awakeAvg, dormantAvg, consumablesKg, eclssKg, eclssW, podsKg: pods * TORPOR.podKg, podsW: pods * TORPOR.podPowerW, pods, cockpits, cockpitsKg: cockpits * COCKPIT.massKg, cockpitsW: cockpits * COCKPIT.powerW, deckM2, shelterM2, doseSv };
}

/** The torpor ring: a centrifuge sized from the deck the sleepers, the awake watch and the cockpits
 *  need, with the pods, the shelter shielding, the ECLSS and the cockpits as its outfit. */
export function torporRingFor(design, h) {
  if (!design.ring) return null;
  const ring = ringFor({ crew: 1, rpm: design.rpm, areaPerCrew: h.deckM2, tubeMin: 3, tubeMax: 40 });
  const shelterLengthM = h.shelterM2 / (0.8 * ring.D * ring.decks);
  const shelterShellM2 = Math.PI * ring.D * shelterLengthM;
  const shieldKg = shelterShellM2 * SHIELD.arealKgM2;
  const outfitKg = h.podsKg + h.eclssKg + h.cockpitsKg + shieldKg;
  const powerW = ring.area * RING_POWER.lighting + h.eclssW + h.podsW + h.cockpitsW * 0.5;
  return { ...ring, shelterLengthM, shelterShellM2, shieldKg, outfitKg, totalKg: ring.mass + outfitKg, powerW };
}

function torporRingPart(design, ring, h) {
  return {
    name: `${design.name} torpor ring, ${ring.R.toFixed(1)} m at ${design.rpm} rpm`, kind: 'torpor-ring', dataQuality: 'derived',
    source: `Derived: parts/centrifuge.js ring laws at ${design.rpm} rpm (${design.rpm === COMFORT_RPM.short ? 'short-stay limit: awake stints are 3 days' : 'continuous limit'}), ${TORPOR.podDeckM2} m2 per pod, 30 m2 per awake person, ${SHIELD.arealKgM2} kg/m2 of shelter shield; ${TORPOR.source}`,
    dims: { l: ring.D, d: 2 * ring.R + ring.D },
    origin: 'centre',
    mass: ring.totalKg,
    volume: { pressurised: ring.volume, habitable: ring.volume * 0.7 },
    crew: h.humans,
    power: { gen: 0, load: ring.powerW },
    heat: { rejectCapacity: ring.powerW * 1.2 },
    ring, pods: h.pods, awake: Math.ceil(h.awakeAvg), cockpits: h.cockpits,
    ports: [{ id: 'hub', type: 'hinge-1d', gender: 'active', at: [0, 0, 0], axis: [0, 1, 0] }]
  };
}

/* ---- the assembly ---- */

/* A structural tank or pallet in the thrust path, between the collar and the drive: hardpoints at both
   ends, so the thrust goes through it the way it goes through a propellant tank. Consumables are
   water and packaged food at 600 kg/m3; the arrival kit (habitat shells, ISRU plant, surface power,
   the robots' construction tooling) is palletised at 300 kg/m3. Neither is pressurised cargo, which
   is what put a 21 m can on a 2 m berthing ring in v1 (CENTAURI-AUDIT.md F10). */
function thrustStore(kind, name, massKg, density, ldRatio, source) {
  const v = Math.max(massKg, 1e-9) / density;
  const d = Math.cbrt((4 * v) / (Math.PI * ldRatio));
  const l = ldRatio * d;
  return {
    name, kind, dataQuality: 'derived', source,
    dims: { l, d }, mass: massKg,
    volume: { pressurised: null, habitable: null }, crew: 0,
    power: { gen: 0, load: 0 }, heat: { rejectCapacity: null },
    storedKg: massKg, bulkKgM3: density,
    ports: [
      { id: 'aft', type: 'hardpoint', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'hardpoint', gender: 'active', at: [0, l, 0], axis: [0, 1, 0] }
    ]
  };
}

/** A drive with `k` engines: Dyson's and Daedalus's designs scale by adding engines and pulse
 *  units, and a boost that would otherwise take centuries is capped at ten years. */
export const BOOST_CAP_YEARS = 10;
export function enginesFor(hullKg, drive) {
  const one = planFor({ hullKg, drive, R: R_CAP });
  if (!Number.isFinite(one.boostS) || drive.kind === 'beamed') return 1;
  return Math.max(1, Math.ceil(one.boostS / (BOOST_CAP_YEARS * YEAR)));
}
export function clusteredDrive(drive, k) {
  if (k <= 1) return drive;
  return { ...drive, thrustN: drive.thrustN * k, engineKg: drive.engineKg * k, engines: k, name: `${drive.name}, ${k} engines`, short: `${k} x ${drive.short}` };
}

/* Builds the v5 hull from the base class's stack, then sizes the drive from that hull and bolts it
   on, the way propelledAssembly() does for v3, so the hull is measured before the drive exists. */
export function roboticAssembly(id) {
  const design = designById(id);
  if (!design) throw new Error(`Unknown v5 design "${id}"`);
  const base = CLASSES.find((c) => c.id === design.base);
  const drive0 = DRIVES[design.drive];

  /* The trip time depends on the drive alone at a fixed mass ratio, so consumables and spares can be
     sized before the hull exists; the build is then repeated once with the trip the finished ship
     actually makes, which converges because the engine count holds the boost under its cap. */
  let tripYears = planFor({ hullKg: 1, drive: drive0, R: R_CAP }).tripYears;
  const build = (tripYearsNow, measured = null) => {
    const h = humansFor(design, tripYearsNow);
    const ring = torporRingFor(design, h);
    const parts = [];
    const mates = [];
    const chainIds = [];
    const add = (as, part) => { parts.push({ as, part }); return as; };

    /* The node is the stack's root and the bearing's seat. */
    add('node', 'node-unity');
    chainIds.push('node');
    for (let i = 0; i < design.labs; i += 1) chainIds.push(add(`lab${i}`, 'lab-columbus'));

    /* Rough hull numbers for the fleet law, from the modules that will be in the stack; the fleet is
       re-sized on the measured hull once it exists. */
    const modulesGuess = 1 + design.labs + 2 + (design.seedBank ? 1 : 0) + (design.humans > 0 ? 1 : 0);
    const volumeGuess = modulesGuess * 75 + (ring ? ring.volume : 0);
    const roughHull = 150e3 + h.consumablesKg + design.kitKg + (ring ? ring.totalKg : 0);
    const plan0 = planFor({ hullKg: roughHull, drive: clusteredDrive(drive0, enginesFor(roughHull, drive0)), R: R_CAP });
    const stackGuess = modulesGuess * 6 + 8 + plan0.dims.l;
    const areaGuess = Math.PI * MODULE_D * modulesGuess * 6 + Math.PI * plan0.store.d * plan0.store.l;
    const hullNow = measured ?? { hullAreaM2: areaGuess, modules: modulesGuess, stackM: stackGuess, volumeM3: volumeGuess };
    const fleet = robotFleetFor(design, { ...hullNow, humans: design.humans });
    const spares = sparesFor(fleet, tripYearsNow);
    const swarm = swarmFor(fleet, hullNow, tripYearsNow);

    /* The hangar, sized from the fleet it garages. */
    const n = fleet.counts;
    const humanoids = (n['humanoid-iva'] ?? 0) + (n['humanoid-eva'] ?? 0) + (n['med-bot'] ?? 0) + (n['cargo-bot'] ?? 0);
    const flyers = (n['free-flyer-iva'] ?? 0) + (n['inspector-eva'] ?? 0);
    const maint = Math.max(1, Math.ceil(fleet.mobile / HANGAR.robotsPerMaintenanceStation));
    const quar = Math.max(1, Math.ceil(fleet.mobile / HANGAR.robotsPerQuarantineBay));
    const hangarM3 = (humanoids * HANGAR.cradleM3 + flyers * HANGAR.dockM3 + maint * HANGAR.maintenanceM3 + quar * HANGAR.quarantineM3 + HANGAR.toolStoreM3 + HANGAR.lockM3) * HANGAR.circulation;
    const hangarFitKg = humanoids * (HANGAR.cradleKg + HANGAR.chargerKg + HANGAR.umbilicalKg + HANGAR.thermalPlateKg) + flyers * HANGAR.dockKg + maint * HANGAR.maintenanceKg + quar * HANGAR.quarantineKg + HANGAR.toolStoreKg + fleet.mobile * HANGAR.toolsPerRobotKg + RAILS.headKg * 2;
    /* A Columbus-diameter tube up to 12 m long; past that the hangar grows in diameter instead (to a
       Starship-class 8.4 m), because a 48 m tube of cradles is a corridor, not a garage. Cradles line
       both walls in rows; with a wide hangar the rows double up on each side. */
    let hangarD = MODULE_D;
    if (hangarM3 / (Math.PI * (MODULE_D / 2) ** 2) > 12) hangarD = Math.min(8.4, Math.sqrt((4 * hangarM3) / (Math.PI * 14)));
    /* QA pass: the cradles are STANDING cradles -- a robot stands radially on the wall, feet out, head
       toward the axis -- at the 1.0 m wall pitch the cradle volume law already assumes (the first cut laid
       the robots along the axis at 0.7 m, so an 11-robot hangar had them inside each other). The hangar is
       as long as its cradle rows need, if that is more than its volume gives. */
    const rowsPerSide = hangarD > 6 ? 2 : 1;
    const cradlePitch = HANGAR.cradlePitchM;
    const perRow = Math.ceil(humanoids / (2 * rowsPerSide));
    const dockCols = Math.max(1, Math.floor((Math.max(2.5, hangarM3 / (Math.PI * (hangarD / 2) ** 2)) - 1.0) / HANGAR.dockPitchM));
    const dockRows = Math.ceil(flyers / dockCols);
    const hangarL = Math.max(2.5, hangarM3 / (Math.PI * (hangarD / 2) ** 2), perRow * cradlePitch + 1.0, Math.ceil(flyers / Math.max(1, dockRows)) * HANGAR.dockPitchM + 1.0);
    const cradlePorts = [];
    for (let i = 0; i < humanoids; i += 1) {
      const side = i % 2 ? -1 : 1, row = Math.floor(i / 2) % rowsPerSide, k = Math.floor(i / (2 * rowsPerSide));
      const y = 0.5 + (k + 0.5) * cradlePitch;
      /* each row stands on the wall at its own azimuth (+-25 degrees off the side axis when two rows share a side) */
      const th = rowsPerSide === 1 ? 0 : (row ? 1 : -1) * (25 * Math.PI) / 180, rw = hangarD / 2 - 0.08;
      const ux = side * Math.cos(th), uz = Math.sin(th);
      cradlePorts.push({ id: `cradle-${i}`, type: 'hardpoint', gender: 'active', interior: true, at: [ux * rw, y, uz * rw], axis: [-ux, 0, -uz], clock: [0, 1, 0] });
    }
    /* free-flyer docks on the floor (-z), 0.5 m cubes in rows along the hangar */
    for (let i = 0; i < flyers; i += 1) {
      const col = i % dockCols, row = Math.floor(i / dockCols);
      const y = 0.5 + (col + 0.5) * HANGAR.dockPitchM;
      const x = (row - (dockRows - 1) / 2) * HANGAR.dockPitchM;
      cradlePorts.push({ id: `dock-${i}`, type: 'hardpoint', gender: 'active', interior: true, at: [x, y, -(hangarD / 2 - 0.3)], axis: [0, 0, 1], clock: [0, 1, 0] });
    }
    const hangar = moduleShell('robot-hangar', `Robot hangar: ${humanoids} cradles, ${flyers} docks, ${maint} maintenance, ${quar} quarantine, lock`, hangarM3, {
      d: hangarD, extraKg: hangarFitKg, habitable: 0.3, loadW: humanoids * 60 + flyers * 20 + 500,
      source: HANGAR.source,
      ports: [
        ...cradlePorts,
        /* the Dextre on the zenith face, where nothing else of the hangar's is mounted (racks are on +-x, the lock on nadir) */
        { id: 'arm', type: 'hardpoint', gender: 'active', at: [0, hangarL * 0.15, hangarD / 2], axis: [0, 0, 1], clock: [0, 1, 0] },
        { id: 'railhub', type: 'hardpoint', gender: 'active', at: [0, 0, 0], axis: [0, 1, 0] },
        { id: 'lock', type: 'hardpoint', gender: 'active', at: [0, hangarL * 0.8, -hangarD / 2], axis: [0, 0, -1], clock: [0, 1, 0] }
      ],
      extra: { hangar: { humanoids, flyers, maint, quar, hangarM3, hangarL, hangarD, rowsPerSide, lock: HANGAR.lockHatch, door: HANGAR.robotDoor, aisle: HANGAR.aisleM } }
    });
    /* the shell is sized by volume; the cradle rows may need it longer, so the envelope follows the rows */
    hangar.dims.l = hangarL; hangar.ports.find((q) => q.id === 'fore').at = [0, hangarL, 0]; for (const q of hangar.ports) if (/^(rack-|util)/.test(q.id)) q.at[1] = hangarL * 0.5;
    chainIds.push(add('hangar', hangar));
    /* The robot lock on the hangar's nadir face: an unpressurised-robot airlock with a 1.2 x 2.2 m
       outer hatch, interlocked doors, and the rail heads either side of it. */
    add('lock', {
      name: 'Robot lock: 1.2 x 2.2 m hatch, interlocked doors, rail heads', kind: 'robot-lock', dataQuality: 'derived', source: HANGAR.source,
      dims: { l: 2.4, d: 2.0 }, mass: HANGAR.lockKg, volume: { pressurised: HANGAR.lockM3, habitable: null }, crew: 0,
      power: { gen: 0, load: 100 }, heat: { rejectCapacity: null }, hatch: HANGAR.lockHatch,
      ports: [{ id: 'root', type: 'hardpoint', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
    });
    mates.push({ a: 'hangar.lock', b: 'lock.root' });

    /* The fabrication bay: cells, bench, feedstock and stocked spares. */
    const cells = n['fab-cell'] ?? 1;
    const fabM3 = (cells * FAB.cellM3 + FAB.benchM3 + spares.feedstockKg / FAB.feedstockDensity + (spares.stockedKg + spares.standbyKg) / FAB.spareDensity) * 1.3;
    const fabL = Math.max(2.5, fabM3 / (Math.PI * (MODULE_D / 2) ** 2), Math.ceil(cells / 2) * 1.3 + 1.0);
    const fab = moduleShell('fab-bay', `Fabrication bay: ${cells} cells, ${formatMass(spares.feedstockKg)} feedstock, ${formatMass(spares.stockedKg + spares.standbyKg)} spares`, fabM3, {
      extraKg: FAB.benchKg + spares.feedstockKg + spares.stockedKg + spares.standbyKg, habitable: 0.3, loadW: 200, source: FAB.source,
      /* QA pass: the cells stand radially on the walls (a 2 m cell along the axis poked out of a 2.5 m bay) */
      ports: Array.from({ length: cells }, (_, i) => { const side = i % 2 ? -1 : 1; return { id: `cell-${i}`, type: 'hardpoint', gender: 'active', interior: true, at: [side * (MODULE_D / 2 - 0.08), 0.75 + Math.floor(i / 2) * 1.3, 0], axis: [-side, 0, 0], clock: [0, 1, 0] }; }),
      extra: { fab: { cells, feedstockKg: spares.feedstockKg, stockedKg: spares.stockedKg, standbyKg: spares.standbyKg } }
    });
    fab.dims.l = fabL; fab.ports.find((q) => q.id === 'fore').at = [0, fabL, 0]; for (const q of fab.ports) if (/^(rack-|util)/.test(q.id)) q.at[1] = fabL * 0.5;
    chainIds.push(add('fab', fab));

    /* The observation deck, when there are humans to use it: next to the labs and the ring's bearing (QA pass:
       it used to sit beyond the hangar and the fab bay, 75 m from the ring on the colony), so the awake watch
       floats from the spoke to the deck without crossing the robot bays. */
    if (design.humans > 0) {
      const podsN = Math.max(OBS_DECK.minimumPods, Math.ceil(h.awakeAvg * OBS_DECK.podShare) + OBS_DECK.visitorPods);
      const obsM3 = podsN * OBS_DECK.podM3 * 2 + OBS_DECK.theatreM3 + swarm.archiveKg / 400 + 20;
      const obsKg = podsN * OBS_DECK.podKg + OBS_DECK.wallM2 * OBS_DECK.wallKgPerM2 + OBS_DECK.renderNodes * COMPUTE_NODE.massKg + swarm.archiveKg + 1900;
      const obsW = podsN * OBS_DECK.podW * 0.5 + OBS_DECK.wallM2 * OBS_DECK.wallWPerM2 * 0.5 + OBS_DECK.renderNodes * COMPUTE_NODE.powerW + swarm.archiveW;
      const obs = moduleShell('obs-deck', `Observation deck: ${podsN} immersion pods, ${OBS_DECK.wallM2} m2 wall, data theatre, ${(swarm.archiveTB / 1000).toFixed(1)} PB vault`, obsM3, {
        extraKg: obsKg, habitable: 0.7, loadW: obsW, source: OBS_DECK.source,
        extra: { obs: { pods: podsN, wallM2: OBS_DECK.wallM2, archiveTB: swarm.archiveTB, archiveKg: swarm.archiveKg } }
      });
      add('obs', obs);
      chainIds.splice(chainIds.indexOf('hangar'), 0, 'obs');
    }

    /* The seed vault. */
    if (design.seedBank) {
      const lines = design.vaultLines ?? SEED_VAULT.lines;
      const volumeM3 = SEED_VAULT.volumeM3 * Math.max(1, lines / SEED_VAULT.lines) ** 0.7;
      const vaultL = volumeM3 / (Math.PI * (MODULE_D / 2) ** 2);
      const vaultKg = SEED_VAULT.baseKg + lines * SEED_VAULT.kgPerLine + Math.PI * MODULE_D * Math.max(vaultL, 2.5) * SEED_VAULT.shieldKgM2;
      const vault = moduleShell('seed-vault', `Seed vault: ${lines.toLocaleString('en-US')} human lines, plant and microbial bank`, volumeM3, {
        extraKg: vaultKg, habitable: 0.2, loadW: SEED_VAULT.powerW * Math.max(1, lines / SEED_VAULT.lines) ** 0.5, source: SEED_VAULT.source, extra: { vault: { lines } }
      });
      chainIds.push(add('vault', vault));
    }

    /* The thrust collar closes the pressurised stack; its fore face is the rigid hardpoint the thrust
       path continues from: the consumables tank, the arrival kit, then the drive. */
    add('collar', { ...PARTS['thrust-collar'], ports: PARTS['thrust-collar'].ports.map((q) => (q.id === 'fore' ? { ...q, type: 'hardpoint' } : q)) });
    chainIds.push('collar');
    for (let i = 0; i < chainIds.length - 1; i += 1) mates.push({ a: `${chainIds[i]}.fore`, b: `${chainIds[i + 1]}.aft` });
    const thrustChain = ['collar'];
    if (h.consumablesKg > 0) {
      thrustChain.push(add('stores', thrustStore('stores', `Consumables tank: ${design.humans} people, ${tripYearsNow.toFixed(0)} yr`, h.consumablesKg, 600, 3,
        `Derived: ${netPerPersonDayKg().toFixed(2)} kg per awake person-day net of ${Math.round(CLOSURE.water * 100)} % water and ${Math.round(CLOSURE.oxygen * 100)} % oxygen closure (BVAD 2018: ${PER_PERSON_DAY_KG.food} kg food, ${PER_PERSON_DAY_KG.oxygen} kg O2, ${PER_PERSON_DAY_KG.waterPotable + PER_PERSON_DAY_KG.waterHygiene} kg water), x${TORPOR.metabolicFraction} in torpor, x${CONSUMABLES_MARGIN} margin; water and packaged food at 600 kg/m3 in a structural tank`)));
    }
    if (design.kitKg > 0) {
      thrustChain.push(add('kit', thrustStore('arrival-kit', `Arrival kit: ${formatMass(design.kitKg)} of habitat shells, ISRU, surface power and tooling`, design.kitKg, 300, 2,
        'Derived: palletised unpressurised cargo at 300 kg/m3 on a structural frame, the share of the class’s source payload that is colony hardware rather than people')));
    }
    for (let i = 0; i < thrustChain.length - 1; i += 1) mates.push({ a: `${thrustChain[i]}.fore`, b: `${thrustChain[i + 1]}.aft` });
    const driveMount = `${thrustChain[thrustChain.length - 1]}.fore`;

    /* Radiators on the node's zenith/nadir pair; no solar wings between stars. */
    add('radA', 'radiator-pvr'); add('radB', 'radiator-pvr');
    /* on the colony the 10 m despun hub sits under the node's aft face, so the radiators take the +-x
       hinges higher up the node; the other designs keep the zenith/nadir pair */
    const radMounts = design.base === 'colony' ? ['mount-1', 'mount-2'] : ['mount-5', 'mount-6'];
    mates.push({ a: `node.${radMounts[0]}`, b: 'radA.root' }, { a: `node.${radMounts[1]}`, b: 'radB.root' });

    /* The ring on its bearing, and the berth on the bearing's despun face. The colony's ring turns on
       the 4 MN despun hub instead, with the two MW reactors on the hub's mounts, as in v2. */
    if (ring) {
      const ringP = torporRingPart(design, ring, h);
      if (design.base === 'colony') {
        ringP.ports[0].gender = 'passive';
        add('despin', 'despin-hub'); add('ring', ringP);
        add('reactorA', 'reactor-1mw'); add('reactorB', 'reactor-1mw');
        mates.push({ a: 'node.spinhub', b: 'despin.root' }, { a: 'despin.fore', b: 'ring.hub' }, { a: 'despin.mount-a', b: 'reactorA.root' }, { a: 'despin.mount-b', b: 'reactorB.root' });
      } else {
        add('bearing', 'spin-bearing'); add('ring', ringP); add('pma', 'pma');
        mates.push({ a: 'node.spinhub', b: 'bearing.aft' }, { a: 'bearing.hub', b: 'ring.hub' }, { a: 'bearing.dock', b: 'pma.root' });
      }
    } else {
      add('pma', 'pma');
      mates.push({ a: 'node.aft', b: 'pma.root' });
    }

    /* The robots, as parts: humanoids and the medical and cargo robots in cradles, flyers in docks,
       the Dextre on the hangar face, the scouts in a rack on the fab bay, the fab cells inside it. */
    let ci = 0, di = 0;
    for (const rid of ['humanoid-iva', 'humanoid-eva', 'med-bot', 'cargo-bot']) {
      for (let i = 0; i < (n[rid] ?? 0); i += 1) { const as = `${rid}-${i}`; add(as, robotPart(rid, i)); mates.push({ a: `hangar.cradle-${ci}`, b: `${as}.base` }); ci += 1; }
    }
    for (const rid of ['free-flyer-iva', 'inspector-eva']) {
      for (let i = 0; i < (n[rid] ?? 0); i += 1) { const as = `${rid}-${i}`; add(as, robotPart(rid, i)); mates.push({ a: `hangar.dock-${di}`, b: `${as}.base` }); di += 1; }
    }
    add('arm-dextre-0', robotPart('arm-dextre', 0));
    mates.push({ a: 'hangar.arm', b: 'arm-dextre-0.base' });
    for (let i = 0; i < cells; i += 1) { add(`fab-cell-${i}`, robotPart('fab-cell', i)); mates.push({ a: `fab.cell-${i}`, b: `fab-cell-${i}.base` }); }
    if (design.scouts > 0) {
      const rack = {
        name: `Scout rack: ${design.scouts} x 6U swarm members`, kind: 'scout-rack', dataQuality: 'derived', source: ROBOTS.scout.source,
        dims: { l: 0.7, d: Math.min(2.2, 0.5 + design.scouts * 0.12) }, mass: design.scouts * (ROBOTS.scout.massKg + 3) + 40,
        volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: design.scouts * ROBOTS.scout.avgW }, heat: { rejectCapacity: null },
        scouts: design.scouts,
        ports: [{ id: 'root', type: 'hardpoint', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
      };
      add('scouts', rack);
      mates.push({ a: 'fab.rack-b', b: 'scouts.root' });
    }

    /* Compute racks, distributed: one rack per module hardpoint, round-robin, never all in one place. */
    const rackHosts = ['hangar.rack-a', 'fab.rack-a', ...(design.humans > 0 ? ['obs.rack-a', 'obs.rack-b'] : []), ...(design.seedBank ? ['vault.rack-a', 'vault.rack-b'] : []), 'hangar.rack-b'];
    const perRack = Math.ceil(swarm.nodes / rackHosts.length);
    let placed = 0;
    rackHosts.forEach((host, i) => {
      const k = Math.min(perRack, swarm.nodes - placed);
      if (k <= 0) return;
      placed += k;
      const rack = {
        name: `Compute rack ${i + 1}: ${k} hardened nodes`, kind: 'compute-rack', dataQuality: 'derived', source: COMPUTE_NODE.source,
        dims: { l: 0.6, d: 0.6 + 0.25 * k }, mass: k * COMPUTE_NODE.massKg + 30, nodes: k,
        volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: k * COMPUTE_NODE.powerW }, heat: { rejectCapacity: null },
        ports: [{ id: 'root', type: 'hardpoint', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
      };
      add(`rack${i}`, rack);
      mates.push({ a: host, b: `rack${i}.root` });
    });

    /* Power: the parts' loads are summed and a fission unit sized for them with margin; the colony
       keeps its two MW units on the despun hub. */
    const loadW = summarize(solveAssembly({ root: 'node', parts, mates }).nodes).power.load;
    if (design.base !== 'colony') {
      const kWe = Math.ceil((loadW * REACTOR_FSP.margin) / 1000 / 10) * 10;
      /* QA pass: the fission unit stands off the pressurised fab bay on a boom, as every surface-power
         and nuclear-electric concept does (shadow shield plus distance), instead of being bolted to it */
      const boom = trussSpec({ lengthM: REACTOR_FSP.boomM, widthM: 1.0, axialLoadN: (REACTOR_FSP.baseKg + REACTOR_FSP.kgPerKWe * kWe) * 0.5, name: 'reactor boom' });
      add('reactorBoom', { name: `Reactor boom, ${boom.dims.l.toFixed(0)} m`, kind: 'truss', dataQuality: 'derived', source: boom.source, dims: boom.dims, mass: boom.mass, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 0 }, heat: { rejectCapacity: null }, truss: boom, ports: [{ id: 'aft', type: 'hardpoint', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }, { id: 'fore', type: 'hardpoint', gender: 'active', at: [0, boom.dims.l, 0], axis: [0, 1, 0] }] });
      add('reactor', reactorPart(kWe));
      mates.push({ a: 'fab.util', b: 'reactorBoom.aft' }, { a: 'reactorBoom.fore', b: 'reactor.root' });
    }

    /* Solve the hull once to learn the stack's profile, size the drive from its mass, then hang the
       rails along stack and drive and the crawlers on them. */
    const hull0 = solveAssembly({ root: 'node', parts, mates });
    const hullKg0 = summarize(hull0.nodes).mass;
    const drive = clusteredDrive(drive0, enginesFor(hullKg0, drive0));
    const plan = planFor({ hullKg: hullKg0, drive, R: R_CAP });
    const hangarNode = hull0.nodes.find((x) => x.name === 'hangar');
    const axial = (x) => ['node', 'pressurised-module', 'robot-hangar', 'fab-bay', 'obs-deck', 'seed-vault', 'thrust-collar', 'stores', 'arrival-kit'].includes(x.part.kind);
    const stackNodes = hull0.nodes.filter(axial);
    const stackSum = summarize(stackNodes);
    const stackMinY = stackSum.bounds.min[1], stackMaxY = stackSum.bounds.max[1];
    const railLen = (stackMaxY - stackMinY) + plan.dims.l;
    hangar.ports.find((q) => q.id === 'railhub').at = [0, stackMinY - hangarNode.world.position[1], 0];
    /* The rail profile: one radius per stretch of the stack, read from the parts it runs past, then
       the drive's frame, store and bay. Crawler cars sit on the profile at their own stretch's radius. */
    const profile = stackNodes
      .map((x) => ({ y0: x.world.position[1] - stackMinY, y1: x.world.position[1] - stackMinY + x.part.dims.l, r: x.part.dims.d / 2 + RAILS.standoffM }))
      .sort((a, b) => a.y0 - b.y0);
    const yDrive = stackMaxY - stackMinY;
    profile.push({ y0: yDrive, y1: yDrive + plan.frame.l, r: Math.max(plan.store.d * 0.5, 1) + RAILS.standoffM, taper: true });
    profile.push({ y0: yDrive + plan.frame.l, y1: yDrive + plan.frame.l + plan.store.l, r: plan.store.d / 2 + RAILS.standoffM });
    const radiusAt = (y) => (profile.find((s) => y >= s.y0 && y <= s.y1) ?? profile[profile.length - 1]).r;
    const crawlers = n['crawler-rail'] ?? 0;
    const eras = n['arm-era'] ?? 0;
    const carPort = (id, i, count, offset) => {
      const a = ((i % RAILS.count) / RAILS.count) * Math.PI * 2 + offset + RAILS.azimuth0;
      const y = ((Math.floor(i / RAILS.count) + 0.5) / Math.max(1, Math.ceil(count / RAILS.count))) * railLen;
      const rr = radiusAt(y);
      return { id, type: 'hardpoint', gender: 'active', at: [Math.cos(a) * rr, y, Math.sin(a) * rr], axis: [Math.cos(a), 0, Math.sin(a)], clock: [0, 1, 0] };
    };
    const rails = {
      name: `Hull rails: ${RAILS.count} x ${railLen.toFixed(0)} m, ${crawlers} crawlers${eras ? `, ${eras} long arms` : ''}`, kind: 'rail-network', dataQuality: 'derived', source: RAILS.source,
      dims: { l: railLen, d: 2 * Math.max(...profile.map((s) => s.r)) }, mass: RAILS.count * railLen * RAILS.kgPerM,
      volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 0 }, heat: { rejectCapacity: null },
      rails: RAILS.count, azimuth0: RAILS.azimuth0, crawlers, eras, reachM: ROBOTS['crawler-rail'].reachM, profile,
      ports: [
        { id: 'root', type: 'hardpoint', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
        ...Array.from({ length: crawlers }, (_, i) => carPort(`car-${i}`, i, crawlers, 0)),
        ...Array.from({ length: eras }, (_, i) => carPort(`era-${i}`, i, eras, Math.PI / RAILS.count))
      ]
    };
    add('rails', rails);
    mates.push({ a: 'hangar.railhub', b: 'rails.root' });
    for (let i = 0; i < crawlers; i += 1) { add(`crawler-rail-${i}`, robotPart('crawler-rail', i)); mates.push({ a: `rails.car-${i}`, b: `crawler-rail-${i}.base` }); }
    for (let i = 0; i < eras; i += 1) { add(`arm-era-${i}`, robotPart('arm-era', i)); mates.push({ a: `rails.era-${i}`, b: `arm-era-${i}.base` }); }

    /* The hull is measured with its rails, the drive re-sized from it and bolted to the thrust path. */
    const hullSolved = solveAssembly({ root: 'node', parts, mates });
    const hullKg = summarize(hullSolved.nodes).mass;
    const planFinal = planFor({ hullKg, drive: clusteredDrive(drive0, enginesFor(hullKg, drive0)), R: R_CAP });
    const driveP = drivePart(planFinal, { interfaceD: Math.min(PARTS['thrust-collar'].dims.d, planFinal.store.d), gender: 'passive' });
    const full = { root: 'node', parts: [...parts, { as: 'drive', part: driveP }], mates: [...mates, { a: driveMount, b: 'drive.root' }] };
    const hullArea = stackNodes.reduce((s, x) => s + Math.PI * (x.part.dims.d ?? 0) * (x.part.dims.l ?? 0), 0) + Math.PI * planFinal.store.d * planFinal.store.l;
    const pressurisedM3 = summarize(hullSolved.nodes).volumes.pressurised;
    return { design, base, drive: planFinal.drive, def: full, hullKg, plan: planFinal, h, ring, fleet, spares, swarm, hangar: hangar.hangar, hullAreaM2: hullArea, stackM: railLen, modules: chainIds.length, loadW, pressurisedM3 };
  };

  /* Consumables feed the hull, the hull feeds the boost, the boost feeds the trip, the trip feeds the
     consumables: a fixed point, reached in a handful of passes because the loop gain is small. */
  let out = build(tripYears);
  const measuredOf = (o) => ({ hullAreaM2: o.hullAreaM2, modules: o.modules, stackM: o.stackM, volumeM3: o.pressurisedM3 });
  const settled = (o) => {
    const again = robotFleetFor(design, { ...measuredOf(o), humans: design.humans });
    return Math.abs(o.plan.tripYears - tripYears) <= 1e-9 && again.total === o.fleet.total && again.rows.every((r) => o.fleet.counts[r.id] === r.count);
  };
  for (let pass = 0; pass < 16 && Number.isFinite(out.plan.tripYears) && !settled(out); pass += 1) {
    tripYears = out.plan.tripYears;
    out = build(tripYears, measuredOf(out));
  }
  out.tripYearsSized = tripYears;
  out.converged = settled(out);
  return out;
}

/** Everything the viewer, the docs and the checks need for one v5 ship. Same shape as measure() for
 *  a driven class, plus the human, robot, swarm and coverage budgets. */
export function measureRobotic(id) {
  const a = roboticAssembly(id);
  const solved = solveAssembly(a.def);
  const summary = summarize(solved.nodes);
  const checks = checkAssembly(a.def, solved, { fairing: null });
  const robots = solved.nodes.filter((x) => x.part.kind === 'robot');
  const robotsKg = robots.reduce((s, x) => s + x.part.mass, 0);
  /* Reach: the rails cover a band 2 x reach wide along each rail; the EVA inspectors cover 1,500 m2
     each; the EVA humanoids 400 m2 each from the handrails. Coverage >= 1 is the invariant. */
  const railCover = RAILS.count * a.stackM * 2 * ROBOTS['crawler-rail'].reachM;
  const flyerCover = (a.fleet.counts['inspector-eva'] ?? 0) * 1500 + (a.fleet.counts['humanoid-eva'] ?? 0) * 400;
  const coverage = (railCover + flyerCover) / Math.max(a.hullAreaM2, 1e-9);
  const massBy = {};
  for (const x of solved.nodes) massBy[x.part.kind] = (massBy[x.part.kind] ?? 0) + (x.part.mass ?? 0);
  const baseV2 = VARIANTS.find((v) => v.base === a.design.base);
  const baseV3 = PROPELLED.find((p) => p.base === a.design.base);
  return {
    id, cls: { ...a.design, payloadKg: a.base.payloadKg, payloadLabel: a.base.payloadLabel }, def: a.def, solved, summary,
    sail: null, propulsion: a.plan, mission: { beta: a.plan.beta, tripYears: a.plan.tripYears },
    massKg: summary.mass, hullKg: a.hullKg,
    geometry: { sailAt: null, hullTopY: summary.bounds.max[1], clearanceM: 0, offAxisM: Math.hypot(summary.cg[0], summary.cg[2]), cgHull: summary.cg, mastLenM: 0, hubbed: false },
    structural: checks.filter((c) => c.code !== 'port-overload'),
    loads: checks.filter((c) => c.code === 'port-overload'),
    humans: a.h, ring: a.ring, fleet: a.fleet, spares: a.spares, swarm: a.swarm, hangar: a.hangar,
    robots: { count: robots.length, massKg: robotsKg }, coverage: { railM2: railCover, flyerM2: flyerCover, hullM2: a.hullAreaM2, ratio: coverage },
    massBy, loadW: summary.power.load, genW: summary.power.gen,
    baseline: { v2: baseV2 ? baseV2.id : null, v3: baseV3 ? baseV3.id : null },
    verdict: { ok: a.plan.closes && checks.every((c) => c.code === 'port-overload'), text: a.plan.verdict }
  };
}

/** The honest baseline: what the v2 crew would consume under the same laws, so v5 is compared with
 *  a crewed ship that carries its food, not with one that forgot it. */
export function baselineBudget(variantId, tripYears) {
  const v = VARIANTS.find((x) => x.id === variantId);
  if (!v) return null;
  const days = tripYears * 365.25;
  const consumablesKg = v.crew * netPerPersonDayKg() * days * CONSUMABLES_MARGIN;
  const eclssKg = v.crew * ECLSS.kgPerPerson * ECLSS.strings;
  const doseSv = SHIELD.gcrSvPerYrUnshielded * tripYears * 0.7;
  return { crew: v.crew, consumablesKg, eclssKg, doseSv, totalKg: consumablesKg + eclssKg };
}

export const V5_IDS = DESIGNS.map((d) => d.id);
export { PORT_TYPES, measure, LY, C_LIGHT, DECK, AREAL_MASS };
