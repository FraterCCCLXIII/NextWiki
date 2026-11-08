/* parts.js -- the part catalogue for the Centauri fleet lab.

   A part is not a shape. It is a rigid body with typed connector frames, an envelope, a mass and
   resource numbers; an assembly is a graph of mates, so moving a port moves everything downstream.
   Ported from the SpaceRadio prototype (centauri-fleet/parts.mjs), extended with the parts the
   eight classes need and with the derived-part rules made explicit.

   SI throughout: metres, kilograms, watts, seconds. Frame: right-handed, +Y is the part's own axis,
   the origin sits on its AFT DATUM, so a segment grows along +Y -- the same convention as seg() in
   vehicle-models.js.

   A port's `axis` points OUT of the part. An aft port on a cylinder is [0,-1,0]. Get that wrong and
   every child comes out flipped, which the mate solver will report rather than hide.

   `null` means unverified, never "about zero". A derived part says which law produced its mass.
   No DOM: imported by assembly.js, fleet.js and the node checks. */

import { flasherRadius, stowedEnvelope } from './flasher.js';

export const G0 = 9.80665;

/** Sail areal densities, kg/m2. Reference designs only; a real sail is a materials programme. */
export const SAIL_AREAL = {
  'sin-100nm': 0.00034, // 100 nm silicon nitride at 3.4 g/cm3
  'al-1um': 0.00233 // 1 um aluminium at 2.33 g/cm3
};

/* ------------------------------------------------------------------ *
 * Port types: the contract between parts
 * ------------------------------------------------------------------ */

/* `mateD` is the mating-plane diameter, `passD` the clear passage, `symmetry` the n-fold roll
 * symmetry of the connector (0 = continuous clampband). `maxMass` is the largest subtree the
 * interface is qualified to carry. Unknown is null. */
export const PORT_TYPES = {
  'paf-937': {
    family: 'stack', mateD: 0.937, passD: null, symmetry: 0, androgynous: false,
    crew: false, maxMass: 4700, maxBendingNm: null,
    source: 'RUAG PAS 37S datasheet: 4,700 kg @ 1.5 m CG',
    note: 'EELV 937 mm clampband class.'
  },
  'paf-1194': {
    family: 'stack', mateD: 1.194, passD: null, symmetry: 0, androgynous: false,
    crew: false, maxMass: 8000, maxBendingNm: null,
    source: 'RUAG PAS 47VS datasheet: 8,000 kg @ 2.2 m CG',
    note: 'EELV 1194 mm clampband class.'
  },
  'paf-1575': {
    family: 'stack', mateD: 1.575, passD: null, symmetry: 0, androgynous: false,
    crew: false, maxMass: 10886, maxBendingNm: null,
    source: 'SpaceX Falcon User\u2019s Guide: heavy PAF 10,886 kg',
    note: 'EELV medium-class standard bolted interface, 120 bolts.'
  },
  'cubesat-6u': {
    family: 'stack', mateD: null, passD: null, symmetry: 4, androgynous: false,
    crew: false, maxMass: 14, maxBendingNm: null,
    source: '6U CubeSat dispenser rail',
    note: 'Dispenser interface; no standard mating-plane diameter.'
  },
  'idss-1200': {
    family: 'docking', mateD: 1.2, passD: 0.8, symmetry: 3, androgynous: true,
    crew: true, maxMass: null, maxBendingNm: null,
    source: 'IDSS IDD Rev F \u00a73.2 (1,200 mm mating plane) and IBDM (800 mm passage)',
    note: 'Androgynous: three petals, so the hardware accepts rolls in 120 degree steps.'
  },
  cbm: {
    family: 'berthing', mateD: null, passD: null, symmetry: 4, androgynous: false,
    crew: true, maxMass: null, maxBendingNm: null,
    source: 'ISS Common Berthing Mechanism (ACBM and PCBM halves)',
    note: 'Berthing is not docking: it needs the arm. Dimensions unverified here, left null.'
  },
  'hinge-1d': {
    family: 'hinge', mateD: null, passD: null, symmetry: 0, androgynous: false,
    crew: false, maxMass: null, maxBendingNm: null, dof: 1,
    source: 'deployable hinge (sail, radiator, array root)',
    note: 'One rotational degree of freedom. Stowed and deployed poses differ.'
  },
  /* A drive is not deployed: it is bolted through a thrust frame that carries the module's thrust into
     the hull. The first cut mated every v3 module on `hinge-1d`, the port the sail mast used, so a
     33,762 t Daedalus stack hung on one rotational degree of freedom. Rigid and moment-carrying, and
     sized in newtons rather than kilograms because its load is thrust, not carried mass. */
  hardpoint: {
    family: 'stack', mateD: null, passD: null, symmetry: 0, androgynous: false,
    crew: false, maxMass: null, maxBendingNm: null, dof: 0,
    source: 'Derived rigid interface: bolted thrust frame, >= 1 kg of frame per 500 N of thrust',
    note: 'Rigid, moment-carrying structural interface. Not a flown connector, and not a hinge: it has no deployed or stowed pose.'
  },
  /* v4: the smallsat leaves its 6U dispenser (rated 14 kg, carrying 24) for a motorised lightband,
     which is what a 20 kg class free-flyer with a deployable actually separates on. */
  'lightband-12': {
    family: 'stack', mateD: 0.298, passD: null, symmetry: 0, androgynous: false,
    crew: false, maxMass: 450, maxBendingNm: null,
    source: 'Planetary Systems Corp. Mark II Motorized Lightband, 11.732 in (298 mm) bolt circle; payload capability to the 450 kg class (draft figure)',
    note: 'Motorised clampband separation system, 11.7 inch bolt circle.'
  },
  fluid: { family: 'service', mateD: null, passD: null, symmetry: 0, androgynous: false, crew: false, maxMass: null, maxBendingNm: null, source: null, note: 'Quick-disconnect, no structural role.' },
  power: { family: 'service', mateD: null, passD: null, symmetry: 0, androgynous: false, crew: false, maxMass: null, maxBendingNm: null, source: null, note: 'Bus connector, no structural role.' },
  data: { family: 'service', mateD: null, passD: null, symmetry: 0, androgynous: false, crew: false, maxMass: null, maxBendingNm: null, source: null, note: 'Data connector, no structural role.' }
};

/* ------------------------------------------------------------------ *
 * The catalogue: real parts, real figures, provenance on every row
 * ------------------------------------------------------------------ */

/* Stack convention used by every part below: the aft port is passive, the fore port active, so a
 * lower part's `fore` mates an upper part's `aft`. A part that carries a sail also offers a
 * `sailmount` hinge on its fore face. */
function stackPorts(l, opts = {}) {
  const ports = [
    { id: 'aft', type: opts.aft ?? 'paf-1194', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
    { id: 'fore', type: opts.fore ?? 'paf-1194', gender: 'active', at: [0, l, 0], axis: [0, 1, 0] }
  ];
  if (opts.sail !== false) ports.push({ id: 'sailmount', type: 'hinge-1d', gender: 'active', at: [0, l, 0], axis: [0, 1, 0] });
  return ports;
}

export const PARTS = {
  'lab-columbus': {
    name: 'Columbus-class laboratory', kind: 'pressurised-module', dataQuality: 'checked',
    source: 'https://www.nasa.gov/international-space-station/columbus-laboratory-module',
    dims: { l: 6.9, d: 4.5 },
    mass: 10275,
    volume: { pressurised: 75, habitable: null },
    crew: 3,
    power: { gen: 0, load: null },
    heat: { rejectCapacity: 22000 },
    ports: [
      { id: 'aft', type: 'cbm', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'cbm', gender: 'passive', at: [0, 6.9, 0], axis: [0, 1, 0] }
    ]
  },
  'module-destiny': {
    name: 'Destiny-class US laboratory', kind: 'pressurised-module', dataQuality: 'checked',
    source: 'https://ntrs.nasa.gov/api/citations/20140012748/downloads/20140012748.pdf',
    dims: { l: 8.5, d: 4.2 },
    mass: 14515, // launch mass, STS-98 press kit (14,515 kg); 106 m3 pressurised
    volume: { pressurised: 106, habitable: null },
    crew: 0,
    power: { gen: 0, load: null },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'cbm', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'cbm', gender: 'passive', at: [0, 8.5, 0], axis: [0, 1, 0] }
    ]
  },
  /* ---- v4 realism pass: checked ISS hardware the crewed classes are built from ---- */
  'node-harmony': {
    name: 'Harmony-class node (Node 2)', kind: 'node', dataQuality: 'checked',
    source: 'NASA STS-120 press kit: Node 2 Harmony 14,288 kg at launch, 7.2 m x 4.4 m, 75.5 m3; six CBM berths',
    dims: { l: 7.2, d: 4.4 },
    mass: 14288,
    volume: { pressurised: 75.5, habitable: 40 },
    crew: 0,
    power: { gen: 0, load: 1500 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'cbm', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'cbm', gender: 'passive', at: [0, 7.2, 0], axis: [0, 1, 0] },
      { id: 'port', type: 'cbm', gender: 'active', at: [-2.2, 3.6, 0], axis: [-1, 0, 0], clock: [0, 1, 0] },
      { id: 'starboard', type: 'cbm', gender: 'active', at: [2.2, 3.6, 0], axis: [1, 0, 0], clock: [0, 1, 0] },
      { id: 'zenith', type: 'cbm', gender: 'active', at: [0, 3.6, 2.2], axis: [0, 0, 1], clock: [0, 1, 0] },
      { id: 'nadir', type: 'cbm', gender: 'active', at: [0, 3.6, -2.2], axis: [0, 0, -1], clock: [0, 1, 0] },
      /* utility hardpoints on the end cones, clear of the four radial berths: radiators on the
         zenith/nadir pair, trusses or arrays on the +-x pair, a spin bearing at the aft face */
      /* QA pass: every hardpoint sits ON the 2.2 m hull (they were 0.3 m inside it), and the aft pair
         stands at y = 2.9 so a boom there clears the bola or ring sweeping under the aft face */
      { id: 'mount-1', type: 'hinge-1d', gender: 'active', at: [2.2, 6.4, 0], axis: [1, 0, 0], clock: [0, 1, 0] },
      { id: 'mount-2', type: 'hinge-1d', gender: 'active', at: [-2.2, 6.4, 0], axis: [-1, 0, 0], clock: [0, 1, 0] },
      { id: 'mount-5', type: 'hinge-1d', gender: 'active', at: [0, 6.4, 2.2], axis: [0, 0, 1], clock: [0, 1, 0] },
      { id: 'mount-6', type: 'hinge-1d', gender: 'active', at: [0, 6.4, -2.2], axis: [0, 0, -1], clock: [0, 1, 0] },
      { id: 'mount-7', type: 'hinge-1d', gender: 'active', at: [2.2, 2.9, 0], axis: [1, 0, 0], clock: [0, 1, 0] },
      { id: 'mount-8', type: 'hinge-1d', gender: 'active', at: [-2.2, 2.9, 0], axis: [-1, 0, 0], clock: [0, 1, 0] },
      { id: 'spinhub', type: 'hinge-1d', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] }
    ]
  },
  'airlock-quest': {
    name: 'Quest-class joint airlock', kind: 'airlock', dataQuality: 'checked',
    source: 'NASA STS-104 press kit: Quest airlock 6,064 kg, 5.5 m x 4.0 m, 34 m3; equipment lock and crew lock, four HPGTs',
    dims: { l: 5.5, d: 4.0 },
    mass: 6064,
    volume: { pressurised: 34, habitable: 10 },
    crew: 0,
    power: { gen: 0, load: 1200 },
    heat: { rejectCapacity: null },
    ports: [{ id: 'root', type: 'cbm', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
  },
  'adapter-lightband': {
    name: '11.7 in motorised lightband on a 937 mm cone', kind: 'adapter', dataQuality: 'draft',
    source: 'Planetary Systems Corp. MLB 11.732 in (3.3 kg) on a 937 mm adapter cone (12 kg class)',
    dims: { l: 0.35, d: 0.937 },
    mass: 15.3,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'paf-937', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'lightband-12', gender: 'active', at: [0, 0.35, 0], axis: [0, 1, 0] }
    ]
  },
  'bus-16u': {
    name: '16U free-flyer bus', kind: 'bus', dataQuality: 'derived',
    source: 'Derived: 16U (0.23 x 0.24 x 0.45 m) structure 4.5 kg, avionics 2.5, radio + laser terminal 1.2, RHU-fed RTG 2.2 (5 We), star tracker + IMU 0.8, harness/thermal 1.8, instrument 3.0 = 16 kg',
    dims: { l: 0.45, d: 0.33 },
    mass: 16,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 5, load: 4 },
    heat: { rejectCapacity: 8 },
    inventory: [
      { item: 'structure and deployable rails', kg: 4.5, source: '16U Al frame class' },
      { item: 'flight computer and avionics (redundant)', kg: 2.5, source: 'cubesat avionics stack class' },
      { item: 'UHF/X radio and 0.1 m laser terminal', kg: 1.2, source: 'DSOC-scaled optical terminal' },
      { item: 'radioisotope power source, 5 We', kg: 2.2, source: 'GPHS-derived small RTG at 2.3 We/kg' },
      { item: 'star tracker, IMU, sun sensors', kg: 0.8, source: 'ST-200 class star tracker 0.25 kg' },
      { item: 'harness, thermal control, MLI', kg: 1.8, source: 'derived' },
      { item: 'imaging and spectrometer instrument', kg: 3.0, source: 'Ralph-class scaled' }
    ],
    ports: [
      { id: 'aft', type: 'lightband-12', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'hub', type: 'hinge-1d', gender: 'active', at: [0, 0.45, 0], axis: [0, 1, 0] }
    ]
  },
  'bus-probe': {
    name: 'Deep-space probe bus (New Horizons class)', kind: 'bus', dataQuality: 'derived',
    source: 'Derived from New Horizons (478 kg incl. 30 kg instruments, 57 kg RTG, 77 kg hydrazine): bus structure 80 kg, instruments 30, avionics 35, thermal 20, harness 25 = 190 kg; RTG, HGA, RCS and propellant are separate parts',
    dims: { l: 0.7, d: 2.1 },
    mass: 190,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 150 },
    heat: { rejectCapacity: 300 },
    inventory: [
      { item: 'primary structure (Al honeycomb box, triangular)', kg: 80, source: 'New Horizons bus' },
      { item: 'instrument suite (imager, spectrometers, dust counter, plasma)', kg: 30, source: 'New Horizons 30 kg payload' },
      { item: 'avionics: C&DH, star trackers x2, IMU, sun sensors', kg: 35, source: 'New Horizons' },
      { item: 'thermal: MLI tent, louvers, heaters', kg: 20, source: 'New Horizons thermos design' },
      { item: 'harness and separation electronics', kg: 25, source: 'derived' }
    ],
    ports: [
      { id: 'aft', type: 'paf-937', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'paf-937', gender: 'active', at: [0, 0.7, 0], axis: [0, 1, 0] },
      { id: 'sailmount', type: 'hinge-1d', gender: 'active', at: [0, 0.7, 0], axis: [0, 1, 0] },
      { id: 'rtg', type: 'hinge-1d', gender: 'active', at: [1.05, 0.35, 0], axis: [1, 0, 0], clock: [0, 1, 0] },
      /* QA pass: the 2.1 m HGA on the fore face had the sail mast running through its dish; it now hangs
         on the -x side opposite the RTG, gimballed, where New Horizons' own 2.1 m dish sits on the bus */
      { id: 'hga', type: 'hinge-1d', gender: 'active', at: [-1.05, 0.35, 0], axis: [-1, 0, 0], clock: [0, 1, 0] },
      { id: 'bay', type: 'hinge-1d', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0], clock: [1, 0, 0] }
    ]
  },
  'lander-aero': {
    name: 'Aero-capable robotic lander, 1 t class', kind: 'lander-aero', dataQuality: 'derived',
    source: 'Derived: 2.4 m stainless cylinder, 6.5 m with a Haack nose; 304L shell 1.5 mm (0.5 t), four header tanks, two 10 kN throttling engines (Starship-era design language scaled to a 1 t payload); TPS, legs, grid fins and propellant are separate parts',
    dims: { l: 6.5, d: 2.4 },
    mass: 1150,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 300 },
    heat: { rejectCapacity: 600 },
    inventory: [
      { item: '304L stainless primary structure, 1.5 mm', kg: 480, source: 'hoop + buckling gauge, Starship-derived' },
      { item: 'Haack nose fairing and bulkheads', kg: 90, source: 'fairingSpec, 12 kg/m2' },
      { item: 'two 10 kN throttling methalox engines', kg: 110, source: 'bellSpec T/W 40' },
      { item: 'four header tanks and feed', kg: 70, source: 'tankSpec' },
      { item: 'science payload (1 t class instruments, sampler, mast)', kg: 250, source: 'the class payload, stated' },
      { item: 'avionics, radar altimeter, lidar, cameras', kg: 60, source: 'MSL-derived TDS' },
      { item: 'harness and thermal', kg: 90, source: 'derived' }
    ],
    ports: [
      { id: 'aft', type: 'paf-1575', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'paf-1575', gender: 'active', at: [0, 6.5, 0], axis: [0, 1, 0] },
      { id: 'sailmount', type: 'hinge-1d', gender: 'active', at: [0, 6.5, 0], axis: [0, 1, 0] },
      { id: 'legmount', type: 'hinge-1d', gender: 'active', at: [0, 0.3, 0], axis: [0, -1, 0] },
      { id: 'finmount', type: 'hinge-1d', gender: 'active', at: [0, 4.3, 0], axis: [0, 1, 0] }
    ]
  },
  'capsule-tps': {
    name: 'Crewed capsule, TPS and ogive nose (Dragon 2 class)', kind: 'crew-capsule', dataQuality: 'checked',
    source: 'SpaceX Crew Dragon: 4.0 m dia, 8.1 m with trunk, capsule ~7,700 kg dry (NASA CCP), 9.3 m3 pressurised, PICA-X heat shield, nose cone over an IDSS/NDS port, 16 Draco thrusters',
    dims: { l: 4.9, d: 4.0 },
    mass: 7700,
    volume: { pressurised: 9.3, habitable: 7 },
    crew: 4,
    power: { gen: 0, load: 1500 },
    heat: { rejectCapacity: 1500 },
    inventory: [
      { item: 'pressure vessel and primary structure', kg: 2400, source: 'Dragon 2 class' },
      { item: 'PICA-X heat shield (12.6 m2 at 15 kg/m2) and backshell TPS', kg: 600, source: 'tpsSpec ablator + quilt' },
      { item: 'nose cone with hinge and IDSS/NDS active docking system', kg: 520, source: 'NDS 341 kg + cone' },
      { item: 'ECLSS (4 crew x 30 d, open loop), seats, displays', kg: 900, source: 'Dragon 2 class' },
      { item: '16 Draco RCS thrusters, tanks, 1,400 kg NTO/MMH', kg: 1900, source: 'Dragon 2 propellant load' },
      { item: 'avionics, batteries, parachutes (4 mains + 2 drogues)', kg: 880, source: 'parachuteSpec 3.5 %' },
      { item: 'windows x4, hatch, crew provisions 30 d', kg: 500, source: 'windowSpec, hatchSpec, 0.3 kg/pd' }
    ],
    ports: [
      ...stackPorts(4.9, { sail: false }),
      { id: 'dock', type: 'idss-1200', gender: 'passive', at: [0, 4.9, 0], axis: [0, 1, 0] }
    ]
  },
  'trunk-solar': {
    name: 'Trunk with solar skin and radiators (Dragon 2 class)', kind: 'service-module', dataQuality: 'checked',
    source: 'SpaceX Crew Dragon trunk: 3.7 m x 4.0 m, ~1,800 kg with body-mounted arrays (~4 kW) and radiators',
    dims: { l: 3.7, d: 4.0 },
    mass: 1800,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 4000, load: 100 },
    heat: { rejectCapacity: 3000 },
    ports: stackPorts(3.7, { sail: false })
  },
  'module-kibo': {
    name: 'Kibo pressurised module', kind: 'pressurised-module', dataQuality: 'checked',
    source: 'https://humans-in-space.jaxa.jp/library/item/kuoa/kuoa_kibo-handbook_en.pdf',
    dims: { l: 11.2, d: 4.4 },
    mass: 15900,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 3000 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'cbm', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'cbm', gender: 'passive', at: [0, 11.2, 0], axis: [0, 1, 0] }
    ]
  },
  'node-unity': {
    name: 'Unity-class node', kind: 'node', dataQuality: 'draft',
    source: 'https://www.nasa.gov/wp-content/uploads/2012/01/179225main_iss_poster_back.pdf',
    dims: { l: 5.5, d: 4.6 },
    mass: 5000, // the poster gives no mass; 5 t is the six-port node class (Unity is 11.9 t berthing mass)
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: null },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'cbm', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'cbm', gender: 'passive', at: [0, 5.5, 0], axis: [0, 1, 0] },
      { id: 'port', type: 'cbm', gender: 'active', at: [-2.3, 2.75, 0], axis: [-1, 0, 0], clock: [0, 1, 0] },
      { id: 'starboard', type: 'cbm', gender: 'active', at: [2.3, 2.75, 0], axis: [1, 0, 0], clock: [0, 1, 0] },
      { id: 'zenith', type: 'cbm', gender: 'active', at: [0, 2.75, 2.3], axis: [0, 0, 1], clock: [0, 1, 0] },
      { id: 'nadir', type: 'cbm', gender: 'active', at: [0, 2.75, -2.3], axis: [0, 0, -1], clock: [0, 1, 0] },
      /* mounts 3-5 are this lab's extension of the prototype's two hinge mounts: the habitat needs
         two arrays and two radiators, and a radiator cannot hang off a hatch. */
      /* QA pass: the hardpoints sit ON the 2.3 m hull; they were 0.4 m inside it, which rooted the
         array yokes in the pressure shell. Symmetric in x, so the pinned v1 centres of mass hold. */
      { id: 'mount-1', type: 'hinge-1d', gender: 'active', at: [2.3, 4.4, 0], axis: [1, 0, 0], clock: [0, 1, 0] },
      { id: 'mount-2', type: 'hinge-1d', gender: 'active', at: [-2.3, 4.4, 0], axis: [-1, 0, 0], clock: [0, 1, 0] },
      { id: 'mount-3', type: 'hinge-1d', gender: 'active', at: [2.3, 1.1, 0], axis: [1, 0, 0], clock: [0, 1, 0] },
      { id: 'mount-4', type: 'hinge-1d', gender: 'active', at: [-2.3, 1.1, 0], axis: [-1, 0, 0], clock: [0, 1, 0] },
      /* Radiators hang on the zenith/nadir pair, not beside the arrays: a 6.1 m wide radiator on the
         same +-x hinge as an 11 m wide wing sits inside the wing's swept plane. */
      { id: 'mount-5', type: 'hinge-1d', gender: 'active', at: [0, 2.75, 2.3], axis: [0, 0, 1], clock: [0, 1, 0] },
      { id: 'mount-6', type: 'hinge-1d', gender: 'active', at: [0, 2.75, -2.3], axis: [0, 0, -1], clock: [0, 1, 0] },
      /* The aft face of the node is where a spin ring's bearing goes: the ring encircles the stack
         and turns around it, so the thrust axis stays still for the sail and the arrays. */
      { id: 'spinhub', type: 'hinge-1d', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] }
    ]
  },
  'radiator-pvr': {
    name: 'Deployable radiator (PVR class)', kind: 'radiator', dataQuality: 'checked',
    source: 'NASA CR-19940020352, Space Station Freedom PVM thermal control (93 m2 for 7.5 kW; 8.8 kg/m2 with loop)',
    dims: { l: 15.2, d: 6.1 },
    mass: 818,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 250 },
    heat: { rejectCapacity: 7500 },
    stowed: { l: 1.2, d: 2.4 },
    /* the hinge, manifold and flex lines stand the first panel 0.6 m off the mount (ISS PVR/TRRJ class) */
    standoff: 0.6,
    ports: [{ id: 'root', type: 'hinge-1d', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
  },
  'array-saw': {
    name: 'Solar array wing (ISS SAW class)', kind: 'solar-array', dataQuality: 'checked',
    source: 'NASA STS-119 press kit (1,090 kg per wing) and NASA ISS EPS overview (31 kW BOL); 34 m x 11 m = 374 m2',
    dims: { l: 34, d: 11 },
    mass: 1100,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 31000, load: 0 },
    heat: { rejectCapacity: null },
    stowed: { l: 4.6, d: 0.6 },
    /* SADA, yoke and blanket box stand the first panel 1.2 m off the mount, so a wing rolled to track
       the Sun clears the module beside its hinge (ISS: the SAW rides on the SARJ and a beta gimbal) */
    standoff: 1.2,
    ports: [{ id: 'root', type: 'hinge-1d', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
  },
  'bus-6u': {
    name: '6U CubeSat bus', kind: 'bus', dataQuality: 'checked',
    source: '6U CubeSat form factor, 12 kg class',
    dims: { l: 0.34, d: 0.24 },
    mass: 12,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 20, load: 15 },
    heat: { rejectCapacity: 20 },
    ports: [
      { id: 'aft', type: 'cubesat-6u', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'hub', type: 'hinge-1d', gender: 'active', at: [0, 0.34, 0], axis: [0, 1, 0] }
    ]
  },
  'chip-wafer': {
    name: 'Wafer-scale probe (StarChip class)', kind: 'payload', dataQuality: 'checked',
    source: 'Lubin, A Roadmap to Interstellar Flight (1 g wafer, 1 g sail, 20 GW array, 0.1 c)',
    dims: { l: 0.001, d: 0.01 },
    mass: 0.001,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0.01, load: 0.01 },
    heat: { rejectCapacity: 0.01 },
    ports: [{ id: 'hub', type: 'hinge-1d', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] }]
  },
  'dispenser-6u': {
    name: '6U deployer', kind: 'adapter', dataQuality: 'draft',
    source: '6U CubeSat dispenser on a 937 mm launch adapter',
    dims: { l: 0.6, d: 0.4 },
    mass: 3,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'paf-937', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'cubesat-6u', gender: 'passive', at: [0, 0.6, 0], axis: [0, 1, 0] }
    ]
  },
  'adapter-1575-937': {
    name: 'Payload adapter 1575 -> 937', kind: 'adapter', dataQuality: 'checked',
    source: 'RUAG PAS 37S datasheet (937 mm forward interface on the EELV 1575 mm aft interface)',
    dims: { l: 0.6, d: 1.575 },
    mass: 40,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'paf-1575', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'paf-937', gender: 'active', at: [0, 0.6, 0], axis: [0, 1, 0] }
    ]
  },

  /* ---- derived parts: each row states the law that produced its mass ---- */
  'bus-150': {
    name: 'Small-satellite bus, 100 kg class', kind: 'bus', dataQuality: 'derived',
    source: 'Derived: 100 kg payload + 50 kg bus (structure, power, comms, propulsion) for a 100 kg class satellite',
    dims: { l: 1.2, d: 1.0 },
    mass: 150,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 300, load: 150 },
    heat: { rejectCapacity: 400 },
    ports: stackPorts(1.2, { aft: 'paf-937', fore: 'paf-937' })
  },
  'capsule-4m': {
    name: 'Crewed capsule (Dragon 2 class)', kind: 'crew-capsule', dataQuality: 'draft',
    source: 'Derived from SpaceX Dragon 2: 4.0 m capsule, 9,525 kg dry with trunk; 6,350 kg capsule + 650 kg cargo here',
    dims: { l: 4.4, d: 4.0 },
    mass: 7000,
    volume: { pressurised: 9.3, habitable: 7 },
    crew: 4,
    power: { gen: 0, load: 900 },
    heat: { rejectCapacity: 1200 },
    ports: [
      ...stackPorts(4.4, { sail: false }),
      /* The nose carries an IDSS ring: the sail flies as a jettisonable stage docked to it, so the
         crew can undock at arrival instead of arriving with 100 t of film still attached. */
      { id: 'dock', type: 'idss-1200', gender: 'passive', at: [0, 4.4, 0], axis: [0, 1, 0] }
    ]
  },
  'service-4m': {
    name: 'Service module (trunk class)', kind: 'service-module', dataQuality: 'derived',
    source: 'Derived from the Dragon 2 trunk: 3.7 m long, 4.0 m across, 3,000 kg with propellant and radiators',
    dims: { l: 3.7, d: 4.0 },
    mass: 3000,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 1200, load: 600 },
    heat: { rejectCapacity: 1500 },
    ports: stackPorts(3.7, { sail: false })
  },
  'lander-1000': {
    name: 'Robotic lander structure, 1 t class', kind: 'lander', dataQuality: 'derived',
    source: 'Derived: 1,000 kg payload class, 500 kg structure and propulsion, 120 kg landing gear',
    dims: { l: 2.5, d: 3.6 },
    mass: 500,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 400, load: 250 },
    heat: { rejectCapacity: 500 },
    ports: [
      ...stackPorts(2.5),
      { id: 'legmount', type: 'hinge-1d', gender: 'active', at: [0, 0.2, 0], axis: [0, -1, 0] }
    ]
  },
  'legs-4': {
    name: 'Landing gear, four legs', kind: 'landing-gear', dataQuality: 'derived',
    source: 'Derived: 4 legs at 30 kg each, 4.3 m footprint, from the 1 t lander class',
    dims: { l: 1.0, d: 4.3 },
    mass: 120,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    ports: [{ id: 'root', type: 'hinge-1d', gender: 'passive', at: [0, 0, 0], axis: [0, 1, 0] }]
  },
  'ring-1g': {
    name: 'Rotating habitat ring, 1 g at 4 rpm', kind: 'habitat-ring', dataQuality: 'derived',
    source: 'Spin radius 55.9 m for 1 g at 4 rpm (NASA, Physics of Artificial Gravity); 20 m deck at 1 t/m2 gives 7,000 t of structure, plus 10,000 t of payload',
    dims: { l: 20, d: 111.8 },
    origin: 'centre',
    mass: 1e7,
    volume: { pressurised: 150000, habitable: 120000 },
    crew: 1000,
    power: { gen: 0, load: 2e6 },
    heat: { rejectCapacity: 4e6 },
    ports: [
      { id: 'hub', type: 'hinge-1d', gender: 'active', at: [0, 0, 0], axis: [0, 1, 0] },
      { id: 'mount-1', type: 'hinge-1d', gender: 'active', at: [55.9, 0, 0], axis: [1, 0, 0] },
      { id: 'mount-2', type: 'hinge-1d', gender: 'active', at: [-55.9, 0, 0], axis: [-1, 0, 0] },
      { id: 'mount-3', type: 'hinge-1d', gender: 'active', at: [0, 0, 55.9], axis: [0, 0, 1] },
      { id: 'mount-4', type: 'hinge-1d', gender: 'active', at: [0, 0, -55.9], axis: [0, 0, -1] }
    ]
  },

  /* ---- the sail interface: what the film actually stands on ---- */
  /* A collar that transfers the mast's thrust into a berthing stack. The sail pushes with 2 eta P/c,
     and that load has to go into the primary structure: a CBM is strong in axial compression and weak
     in bending, so the collar spreads the mast root over the whole ring instead of a point. */
  'thrust-collar': {
    name: 'Sail-mast thrust collar', kind: 'thrust-collar', dataQuality: 'derived',
    source: 'Derived: 4.6 m ring frame with four struts and a bolted mast root, sized to spread a 105 kN to 4 MN mast load into a CBM ring (900 kg class)',
    dims: { l: 1.2, d: 4.6 },
    mass: 900,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'cbm', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'hinge-1d', gender: 'active', at: [0, 1.2, 0], axis: [0, 1, 0] }
    ]
  },
  /* The colony's ring spins for gravity; the sail must not. This is the non-rotating core the ring
     turns on: a magnetic bearing, slip rings for power and coolant, and the mounts for the reactors,
     which also cannot be spun. */
  'despin-hub': {
    name: 'Despun hub (ring bearing and utility core)', kind: 'despin-hub', dataQuality: 'derived',
    source: 'Derived: 10 m non-rotating hub on a 4 MN magnetic bearing with slip rings and fluid conduits, sized for the 20 kt ring (4.2 t class)',
    dims: { l: 8, d: 10 },
    mass: 4200,
    volume: { pressurised: 400, habitable: null },
    crew: 0,
    power: { gen: 0, load: 40e3 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'root', type: 'hinge-1d', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'hinge-1d', gender: 'active', at: [0, 8, 0], axis: [0, 1, 0] },
      { id: 'mount-a', type: 'hinge-1d', gender: 'active', at: [5, 4, 0], axis: [1, 0, 0] },
      { id: 'mount-b', type: 'hinge-1d', gender: 'active', at: [-5, 4, 0], axis: [-1, 0, 0] },
      { id: 'mount-c', type: 'hinge-1d', gender: 'active', at: [0, 4, 5], axis: [0, 0, 1] },
      { id: 'mount-d', type: 'hinge-1d', gender: 'active', at: [0, 4, -5], axis: [0, 0, -1] },
      /* Two diagonal hardpoints: a despun station cannot hang its arrays or its radiators on the
         spinning ring without dragging them round the sky, so the v2 colony puts all four utilities
         here -- reactors on a/b, arrays on c/d, radiators on e/f. */
      { id: 'mount-e', type: 'hinge-1d', gender: 'active', at: [3.54, 4, -3.54], axis: [0.707, 0, -0.707] },
      { id: 'mount-f', type: 'hinge-1d', gender: 'active', at: [-3.54, 4, 3.54], axis: [-0.707, 0, 0.707] }
    ]
  },
  /* Fission surface power: the ring's 2 MW load cannot come from the 62 kW of SAW blankets, and a
     reactor cannot sit on a spinning deck, so two of these hang off the despun hub with their own
     heat-pipe radiators. */
  'reactor-1mw': {
    name: 'Fission reactor module, 1.1 MWe', kind: 'reactor', dataQuality: 'derived',
    source: 'Derived: 1.1 MWe fission surface power unit at 14 t with an integral heat-pipe radiator (NASA FSP/Kilopower scale-up, 40 kW/kg specific mass is optimistic; 13 kg/kWe used here)',
    dims: { l: 14, d: 6 },
    mass: 14000,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 1.1e6, load: 0 },
    heat: { rejectCapacity: 3.5e6 },
    ports: [{ id: 'root', type: 'hinge-1d', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
  },
  /* Pressurised Mating Adapter: the berthing-to-docking conversion the habitat needs so a crewed
     vehicle can dock to it while the sail owns the axial port. */
  pma: {
    name: 'Pressurised mating adapter (CBM to IDSS)', kind: 'pma', dataQuality: 'checked',
    source: 'ISS Pressurised Mating Adapter 2 (PMA-2), 1,900 kg class: CBM at one end, IDSS at the other',
    dims: { l: 2.0, d: 2.2 },
    mass: 1900,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'root', type: 'cbm', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'dock', type: 'idss-1200', gender: 'passive', at: [0, 2.0, 0], axis: [0, 1, 0] }
    ]
  },
  /* The bearing a spin ring turns on when it is hung off a non-rotating stack: fixed side to the
     hull, rotating side to the ring hub, slip rings and coolant transfer through the shaft. */
  'spin-bearing': {
    name: 'Spin-ring bearing (despun to rotating)', kind: 'spin-bearing', dataQuality: 'derived',
    source: 'Derived: 4 m roller/magnetic bearing pair with slip rings and fluid rotary unions, 1,800 kg',
    dims: { l: 1.0, d: 4.0 },
    mass: 1800,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 5000 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'aft', type: 'hinge-1d', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      /* QA pass: the ring turns on the drum's mid-plane and the crew dock is on the FAR face, on the
         spin axis, pointing away from the node. Both used to sit at the node face pointing back into
         it, which berthed the v2 PMA inside the node (CENTAURI-AUDIT.md). The v4 bearing already had
         this layout; v2 and v5 now share it, and no pinned mass or sail moves. */
      { id: 'hub', type: 'hinge-1d', gender: 'passive', at: [0, 0.5, 0], axis: [0, 1, 0] },
      { id: 'dock', type: 'cbm', gender: 'active', at: [0, 1.0, 0], axis: [0, 1, 0] }
    ]
  },
  /* The capsule's sail stage: an IDSS ring that docks to the capsule's nose and carries the mast. It
     is released at the end of the boost, which is the only way a crewed capsule can both dock and
     fly a beam-rider. */
  'sail-stage': {
    name: 'Jettisonable sail stage (IDSS ring and mast root)', kind: 'dock-adapter', dataQuality: 'derived',
    source: 'Derived: 1,200 mm IDSS ring with three petals, separation nuts and a bolted mast root, 420 kg',
    dims: { l: 0.9, d: 1.6 },
    mass: 420,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    ports: [
      { id: 'dock', type: 'idss-1200', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'hub', type: 'hinge-1d', gender: 'active', at: [0, 0.9, 0], axis: [0, 1, 0] }
    ]
  }
};

/* A pressurised cargo can, sized by a bulk density. 100 kg/m3 is packed pressurised cargo, not
   water; the point is a defensible envelope for mass that is otherwise unallocated.
   `portType` lets a can continue a CBM stack (aft active, fore passive, as the modules do) or a
   launch stack (aft passive, fore active). */
export function cargoPart(massKg, opts = {}) {
  const density = opts.densityKgM3 ?? 100;
  const v = Math.max(massKg, 1e-9) / density;
  const d = Math.cbrt((4 * v) / Math.PI);
  const cbm = (opts.portType ?? 'paf-1194') === 'cbm';
  const ports = cbm
    ? [
      { id: 'aft', type: 'cbm', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'cbm', gender: 'passive', at: [0, d, 0], axis: [0, 1, 0] }
    ]
    : stackPorts(d);
  return {
    name: opts.name ?? `Cargo and consumables, ${(massKg / 1000).toFixed(1)} t`,
    kind: 'cargo',
    dataQuality: 'derived',
    source: `Derived: ${density} kg/m3 packed cargo, cylinder of equal length and diameter`,
    dims: { l: d, d },
    mass: massKg,
    volume: { pressurised: massKg / density, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    ports
  };
}

/* ------------------------------------------------------------------ *
 * Scale anchors: the two laws that decide how big a ship actually is
 * ------------------------------------------------------------------ */

/** Diameter of a circular sail carrying `massKg` at a given areal density. Optimum laser-sail
 *  designs carry sail mass = payload mass (Lubin), so the sail grows as the square root of payload. */
export function sailDiameter(massKg, arealKgM2 = SAIL_AREAL['sin-100nm']) {
  return 2 * Math.sqrt(massKg / (Math.PI * arealKgM2));
}

/* A deployable mast between the hull and the sail hub. Nothing in the catalogue had one, so every
 *  film sat on the hull's own fore face -- which for the stacked classes meant the film plane cut
 *  through the modules. 1.5 kg of deployer plus 0.6 kg/m of CFRP longeron lattice: a STEM-class
 *  mast, not a tower. */
export function mastPart(lengthM, opts = {}) {
  const l = Math.max(lengthM, 0.05);
  return {
    name: opts.name ?? `Sail mast, ${trim(l)} m`,
    kind: 'mast',
    dataQuality: 'derived',
    source: 'Derived: CFRP longeron lattice mast at 0.6 kg/m plus a 1.5 kg deployer (telescoping/STEM mast class)',
    dims: { l, d: Math.max(0.25, Math.min(1.2, l * 0.06)) },
    mass: 1.5 + 0.6 * l,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    stowed: { l: Math.min(1.4, l), d: Math.max(0.3, Math.min(1.2, l * 0.06)) },
    ports: [
      { id: 'aft', type: 'hinge-1d', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', type: 'hinge-1d', gender: 'active', at: [0, l, 0], axis: [0, 1, 0] }
    ]
  };
}

/* A drive module for the non-sail versions: the thrust frame, the propellant store, the engine bay and
 *  its radiators, sized from the propellant the mission needs. The module is bolted through the rigid
 *  hardpoint at its base and grows along +y, so the store sits between the hull and the engine bay and
 *  the nozzle (or pusher plate) faces away from the stack; `plan.dims` is the envelope those laws
 *  produced, not a chosen size. */
export function drivePart(plan, opts = {}) {
  const { drive } = plan;
  const beamed = drive.kind === 'beamed';
  return {
    name: opts.name ?? `${drive.name} module`,
    kind: 'drive',
    dataQuality: 'derived',
    source: `${drive.source}; ${drive.store === 'magazine' ? 'pulse-unit magazine' : 'tank'} at ${drive.bulk} kg/m3, frame and feed structure at ${(drive.tankFraction * 100).toFixed(1)} % of the propellant mass`,
    driveKind: drive.kind,
    driveStore: drive.store,
    dims: plan.dims,
    /* The module's own mass, not the whole ship: the hull is already in the assembly, so counting
       plan.wetKg here would double the payload. A beamed coil carries no propellant at all. */
    mass: beamed ? plan.drive.engineKg : plan.wetKg - plan.hullKg,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: drive.kind === 'electric' ? 4500 : 0, load: beamed ? 0 : 0 },
    heat: { rejectCapacity: beamed ? null : plan.heatW },
    propellantKg: plan.propKg,
    beta: plan.beta,
    /* Everything the CAD needs to draw the stage the plan sized, so the model and the numbers cannot
       disagree about how big the tank, the plate or the radiators are. */
    store: plan.store,
    frame: plan.frame,
    bayL: plan.bayL,
    plateD: plan.plateD,
    radiator: plan.radiator,
    interfaceD: opts.interfaceD ?? null,
    ports: [{ id: 'root', type: 'hardpoint', gender: opts.gender ?? 'passive', at: [0, 0, 0], axis: [0, -1, 0] }]
  };
}

/* A spin ring, generated from the sizing laws in centrifuge.js: the radius comes from the gravity
 *  and the spin rate, the tube from the crew's deck area. */
export function centrifugePart(ring, opts = {}) {
  return {
    name: opts.name ?? `Spin ring, ${ring.R.toFixed(1)} m radius`,
    kind: 'centrifuge',
    dataQuality: 'derived',
    source: 'Derived: parts/centrifuge.js (1 g at 4 rpm = 55.9 m; 30 m2 per person; 250 kg/m2 floor, 60 kg/m2 shell)',
    dims: { l: ring.D, d: 2 * ring.R + ring.D },
    origin: 'centre',
    mass: ring.mass,
    volume: { pressurised: ring.volume, habitable: ring.volume * 0.82 },
    crew: ring.crew,
    power: { gen: 0, load: ring.power },
    heat: { rejectCapacity: ring.power * 1.2 },
    ring,
    /* v4 adds an aft hub so a stores spindle and braking stage can hang below the ring while the
       sail spindle stands above it; v1-v3 only ever mate `hub`, so their pins do not move. */
    ports: [
      { id: 'hub', type: 'hinge-1d', gender: 'active', at: [0, 0, 0], axis: [0, 1, 0] },
      { id: 'hub-aft', type: 'hinge-1d', gender: 'active', at: [0, 0, 0], axis: [0, -1, 0] }
    ]
  };
}

/** A sail part with sail mass equal to the payload mass. The stowed pack is derived from the fold
 *  law (parts/flasher.js): a hexagonal flasher stows to 1/sqrt(lambda) of its span across, and one
 *  film thickness per layer -- not the 0.4 m x 4 m envelope it used to claim regardless of size. */
export function sail(massKg, opts = {}) {
  const areal = opts.arealKgM2 ?? SAIL_AREAL['sin-100nm'];
  const d = sailDiameter(massKg, areal);
  const areaM2 = Math.PI * (d / 2) ** 2;
  const stow = stowedEnvelope(flasherRadius(areaM2), 1e-7);
  return {
    name: opts.name ?? `Sail, ${formatMass(massKg)} payload`,
    kind: 'sail',
    dataQuality: 'derived',
    source: 'Lubin, A Roadmap to Interstellar Flight (optimised sail mass = payload mass)',
    dims: { l: 0.05, d },
    origin: 'centre',
    mass: massKg,
    volume: { pressurised: null, habitable: null },
    crew: 0,
    power: { gen: 0, load: 0 },
    heat: { rejectCapacity: null },
    stowed: { l: Math.max(stow.h, 1e-9), d: stow.d },
    ports: [{ id: 'hub', type: 'hinge-1d', gender: 'passive', at: [0, 0, 0], axis: [0, 1, 0] }],
    sail: { arealKgM2: areal, areaM2 }
  };
}

/** Radius at which `rpm` produces `g` of centrifugal gravity. 1 g at 4 rpm = 55.9 m. */
export function spinRadius(g = G0, rpm) {
  const w = (rpm * 2 * Math.PI) / 60;
  return g / (w * w);
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

function trim(v) {
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return String(Number(v.toFixed(digits)));
}

export function formatMass(kg) {
  const a = Math.abs(kg);
  if (a >= 1e9) return `${trim(kg / 1e9)} Mt`;
  if (a >= 1e6) return `${trim(kg / 1e6)} kt`;
  if (a >= 1e3) return `${trim(kg / 1e3)} t`;
  if (a >= 1) return `${trim(kg)} kg`;
  if (a >= 1e-3) return `${trim(kg * 1e3)} g`;
  return `${trim(kg * 1e6)} mg`;
}

export function formatLength(m) {
  const a = Math.abs(m);
  if (a >= 1e3) return `${trim(m / 1e3)} km`;
  if (a >= 1) return `${trim(m)} m`;
  if (a >= 1e-2) return `${trim(m * 100)} cm`;
  return `${trim(m * 1e3)} mm`;
}
