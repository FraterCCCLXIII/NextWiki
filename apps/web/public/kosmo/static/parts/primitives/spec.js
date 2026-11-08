/* primitives/spec.js -- the parametric component library, numbers only.

   Every primitive here is a pure function from physical inputs (a volume, a heat load, a thrust, a
   landed mass) to a sized component: its envelope, its mass, its volume, the law that produced them
   and the mating frames another part can attach to. Nothing imports three.js, so the whole file runs
   in node and is tested in isolation (centauri-primitives.test.mjs); primitives/mesh.js turns a spec
   into geometry and primitives/materials.js gives it a surface.

   The eight Centauri class builders are compositions of these, and so is anything the shipyard wants
   to share. The master list of what a real vehicle needs, and which primitive builds each row, is
   CENTAURI-COMPONENT-INVENTORY.md; the API is summarised in CENTAURI-PRIMITIVES.md.

   Conventions (the same as parts.js): SI, +Y is a part's axis, the origin is on the AFT datum, a
   mate's `axis` points out of the part. `source` names the figure or the assumption behind every
   mass, and `null` means unverified, never zero. */

export const G0 = 9.80665;
export const SIGMA_SB = 5.670374419e-8;

/* ------------------------------------------------------------------ *
 * Materials: densities and allowables the structural laws draw on
 * ------------------------------------------------------------------ */
export const MATERIALS = {
  'al-2219': { rho: 2840, sigmaPa: 290e6, note: 'Al-Li/2219 tank alloy, yield', source: 'MMPDS 2219-T87 Fty ~ 290 MPa' },
  'ss-304l': { rho: 7900, sigmaPa: 205e6, note: 'Starship-class stainless, yield at room temperature', source: 'ASM 304L Fty 205 MPa (cryogenic strength is higher)' },
  cfrp: { rho: 1600, sigmaPa: 600e6, note: 'quasi-isotropic carbon laminate', source: 'typical T700 QI laminate allowable' },
  'carbon-fibre-tow': { rho: 1800, sigmaPa: 2000e6, note: 'tension-only tether/shroud', source: 'T700 fibre 4.9 GPa, 2 GPa used for a finished braided line' },
  titanium: { rho: 4430, sigmaPa: 880e6, note: 'Ti-6Al-4V', source: 'MMPDS' }
};

/* ------------------------------------------------------------------ *
 * Profiles: the lofts every body of revolution is cut from
 * ------------------------------------------------------------------ */

/** Tangent ogive from radius r at y = 0 to a point at y = l. Returns [[r, y], ...] base to tip. */
export function ogiveProfile(r, l, n = 24) {
  const rho = (r * r + l * l) / (2 * r);
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const y = (i / n) * l;
    out.push([Math.max(0, Math.sqrt(Math.max(0, rho * rho - y * y)) + r - rho), y]);
  }
  return out;
}

/** Von Karman (LD-Haack) profile: the minimum-drag nose for a given length and diameter. */
export function haackProfile(r, l, n = 24, c = 0) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const x = l - (i / n) * l; // x measured from the tip; the profile runs base to tip like the ogive
    const th = Math.acos(Math.min(1, Math.max(-1, 1 - (2 * x) / l)));
    const y = (r / Math.sqrt(Math.PI)) * Math.sqrt(Math.max(0, th - Math.sin(2 * th) / 2 + c * Math.sin(th) ** 3));
    out.push([Math.max(0, y), l - x]);
  }
  return out;
}

/** Elliptical dome of base radius r and height h (h = r is a hemisphere, h = 0.707 r the sqrt-2 ellipsoid). */
export function domeProfile(r, h, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * (Math.PI / 2);
    out.push([r * Math.cos(a), h * Math.sin(a)]);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Tankage
 * ------------------------------------------------------------------ */

/**
 * A propellant or fluid tank sized from the volume it must hold. Cylindrical barrel with two
 * elliptical domes (domeRatio = dome height / radius; 0.707 is the sqrt-2 ellipsoid the industry
 * builds, 1 a sphere), or a sphere when `kind` is 'sphere'. Wall gauge from hoop stress with a safety
 * factor, floored at a minimum gauge, plus a stated allowance for welds, PMD, bosses and insulation.
 */
export function tankSpec({ volumeM3, kind = 'cyl', ldRatio = 2.5, domeRatio = 0.707, ullage = 1.05, pressurePa = 300e3, material = 'al-2219', safety = 2, minGaugeM = 0.0015, fittingsFraction = 0.25, insulationKgM2 = 0, contentsKg = null, name = 'tank' }) {
  const mat = MATERIALS[material] ?? MATERIALS['al-2219'];
  const V = Math.max(volumeM3, 1e-9) * ullage;
  let d, l, barrelL, domeH, areaM2;
  if (kind === 'sphere') {
    d = Math.cbrt((6 * V) / Math.PI); l = d; barrelL = 0; domeH = d / 2; areaM2 = Math.PI * d * d;
  } else {
    /* V = pi r^2 b + 2 (2/3 pi r^2 h) with h = k r, l = b + 2 h = s d: solve r from the cubic. */
    const s = ldRatio, k = domeRatio;
    const r = Math.cbrt(V / (Math.PI * (2 * s - 2 * k + (4 / 3) * k)));
    d = 2 * r; domeH = k * r; barrelL = Math.max(0, s * d - 2 * domeH); l = barrelL + 2 * domeH;
    const domeArea = 2 * Math.PI * r * r * (k < 1 ? (1 + (k * k / Math.sqrt(1 - k * k)) * Math.atanh(Math.sqrt(1 - k * k))) / 2 : 1);
    areaM2 = 2 * Math.PI * r * barrelL + 2 * domeArea;
  }
  const r = d / 2;
  const gauge = Math.max(minGaugeM, (pressurePa * r * safety) / mat.sigmaPa);
  const shellKg = areaM2 * gauge * mat.rho;
  const mass = shellKg * (1 + fittingsFraction) + areaM2 * insulationKgM2;
  return {
    primitive: 'tank', name, kind, dims: { l, d }, barrelL, domeH, domeRatio, gaugeM: gauge, areaM2,
    volumeM3: V / ullage, envelopeM3: V, mass, contentsKg, material,
    profile: kind === 'sphere' ? domeProfile(r, r) : [...domeProfile(r, domeH).reverse().map(([x, y]) => [x, domeH - y]), [r, domeH + barrelL], ...domeProfile(r, domeH).map(([x, y]) => [x, domeH + barrelL + y])],
    mates: [
      { id: 'aft', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', at: [0, l, 0], axis: [0, 1, 0] }
    ],
    source: `Derived: ${mat.note}, hoop gauge p r SF/sigma at ${(pressurePa / 1e3).toFixed(0)} kPa x ${safety}, ${(minGaugeM * 1e3).toFixed(1)} mm minimum, ${Math.round(fittingsFraction * 100)} % for welds/PMD/bosses${insulationKgM2 ? `, ${insulationKgM2} kg/m2 insulation` : ''}`
  };
}

/** Composite-overwrapped pressure vessel for gas storage: mass from the gas performance factor. */
export function copvSpec({ gasKg, gasKind = 'O2', pressurePa = 30e6, tempK = 293, pv2mKgPaM3 = 1.5e5, name = 'COPV' }) {
  const Rspec = { O2: 259.8, N2: 296.8, He: 2077, Xe: 63.3, air: 287 }[gasKind] ?? 287;
  const volumeM3 = (gasKg * Rspec * tempK) / pressurePa;
  const mass = (pressurePa * volumeM3) / pv2mKgPaM3;
  const d = Math.cbrt((6 * volumeM3) / Math.PI);
  return {
    primitive: 'copv', name, kind: 'sphere', dims: { l: d, d }, volumeM3, mass, contentsKg: gasKg, gasKind, pressurePa,
    profile: domeProfile(d / 2, d / 2),
    mates: [{ id: 'aft', at: [0, 0, 0], axis: [0, -1, 0] }],
    source: `Derived: ideal gas at ${(pressurePa / 1e6).toFixed(0)} MPa and ${tempK} K; COPV performance factor pV/m = ${pv2mKgPaM3 / 1e3} kJ/kg (Type III/IV carbon overwrapped vessels 150-300 kJ/kg; tank/gas ~0.5 for O2)`
  };
}

/* ------------------------------------------------------------------ *
 * Pressure hulls and decks
 * ------------------------------------------------------------------ */

/**
 * A pressurised hull segment: barrel with end cones or domes, mass by areal density of finished
 * module (ISS Columbus 10,275 kg over ~130 m2 of shell ~ 79 kg/m2 fitted out; Destiny 14.5 t / 155 m2
 * ~ 94 kg/m2). `fitOutKgM2` is the outfitting on top of the bare shell; `shellKgM2` the shell,
 * MMOD bumper and MLI.
 */
export function hullSegmentSpec({ d = 4.5, l = 6.9, endKind = 'cone', shellKgM2 = 45, fitOutKgM2 = 35, pressurePa = 101325, name = 'pressurised module' }) {
  const r = d / 2;
  const endH = endKind === 'dome' ? r * 0.707 : Math.min(0.65, l * 0.1);
  const barrelL = Math.max(0, l - 2 * endH);
  const shellArea = 2 * Math.PI * r * barrelL + 2 * Math.PI * r * Math.hypot(r, endH);
  const volumeM3 = Math.PI * r * r * barrelL + 2 * (Math.PI * r * r * endH) / 3;
  return {
    primitive: 'hull-segment', name, dims: { l, d }, endKind, endH, barrelL, shellArea,
    volume: { pressurised: volumeM3, habitable: volumeM3 * 0.6 }, mass: shellArea * (shellKgM2 + fitOutKgM2), pressurePa,
    mates: [
      { id: 'aft', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', at: [0, l, 0], axis: [0, 1, 0] }
    ],
    source: `Derived: ${shellKgM2} kg/m2 shell + bumper + MLI and ${fitOutKgM2} kg/m2 of outfitting over ${shellArea.toFixed(0)} m2 (ISS module class: Columbus 79 kg/m2, Destiny 94 kg/m2 fitted)`
  };
}

/** A ring deck (torus) of major radius R and tube D, with the deck count and floor area the centrifuge laws give. */
export function torusDeckSpec({ R, D, decks, areaM2, floorKgM2 = 250, shellKgM2 = 60, name = 'ring deck' }) {
  const shellArea = 2 * Math.PI * R * Math.PI * D;
  return {
    primitive: 'torus-deck', name, dims: { l: D, d: 2 * R + D }, R, D, decks, areaM2, shellArea, origin: 'centre',
    mass: areaM2 * floorKgM2 + shellArea * shellKgM2,
    volume: { pressurised: Math.PI * (D / 2) ** 2 * 2 * Math.PI * R, habitable: areaM2 * 2.4 },
    mates: [{ id: 'hub', at: [0, 0, 0], axis: [0, 1, 0] }],
    source: `Derived: ${floorKgM2} kg/m2 floor and outfitting, ${shellKgM2} kg/m2 pressure shell (parts/centrifuge.js)`
  };
}

/* ------------------------------------------------------------------ *
 * Trusses, booms, frames
 * ------------------------------------------------------------------ */

/**
 * A lattice truss or deployable boom. Mass per metre from a square-section lattice: four longerons
 * sized for the axial load at the stated allowable with a slenderness floor, plus 40 % for battens
 * and diagonals. `widthM` is the bay width; ADAM-class deployable masts are 1-3 kg/m at 0.3 m,
 * the ISS ITS truss ~ 900 kg/m at 5 m.
 */
export function trussSpec({ lengthM, widthM = 0.5, axialLoadN = 1e4, material = 'cfrp', safety = 2, bays = null, name = 'truss' }) {
  const mat = MATERIALS[material] ?? MATERIALS.cfrp;
  const longeronArea = Math.max((axialLoadN * safety) / (4 * mat.sigmaPa), 2e-5 * Math.max(widthM, 0.1));
  const kgPerM = 4 * longeronArea * mat.rho * 1.4;
  const nBays = bays ?? Math.max(1, Math.round(lengthM / Math.max(widthM, 0.05)));
  return {
    primitive: 'truss', name, dims: { l: lengthM, d: widthM * Math.SQRT2 }, widthM, bays: nBays, longeronArea, kgPerM, mass: kgPerM * lengthM, axialLoadN,
    mates: [
      { id: 'aft', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', at: [0, lengthM, 0], axis: [0, 1, 0] }
    ],
    source: `Derived: four ${mat.note} longerons at ${(axialLoadN / 1e3).toFixed(1)} kN x ${safety}, slenderness floor, +40 % battens and diagonals (${kgPerM.toFixed(2)} kg/m)`
  };
}

/** A thrust frame or interstage cone between two diameters, carrying a thrust load. */
export function thrustFrameSpec({ dAft, dFore, lengthM, thrustN, kgPerN = 1 / 500, minKg = 50, name = 'thrust frame' }) {
  return {
    primitive: 'thrust-frame', name, dims: { l: lengthM, d: Math.max(dAft, dFore) }, dAft, dFore, thrustN,
    mass: Math.max(minKg, thrustN * kgPerN),
    mates: [
      { id: 'aft', at: [0, 0, 0], axis: [0, -1, 0] },
      { id: 'fore', at: [0, lengthM, 0], axis: [0, 1, 0] }
    ],
    source: `Derived: max(${minKg} kg, F/500 N per kg) for ${(thrustN / 1e3).toFixed(1)} kN (parts/propulsion.js frame law)`
  };
}

/* ------------------------------------------------------------------ *
 * Thermal
 * ------------------------------------------------------------------ */

/**
 * A radiator sized from the heat it rejects at a stated root temperature. Flux is two-sided grey
 * body with a fin/view efficiency; mass by areal density (ISS HRS/PVR class 8.8 kg/m2 with pumped
 * loop; a 1000 K drive radiator at 5 kg/m2 heat pipes). Panels are cut to a maximum length and
 * stacked `perSide` on each of two sides.
 */
export function radiatorSpec({ heatW, tempK = 300, emissivity = 0.9, efficiency = 0.85, twoSided = true, kgPerM2 = 8.8, maxLengthM = 15, maxWidthM = 6, name = 'radiator' }) {
  const flux = (twoSided ? 2 : 1) * emissivity * efficiency * SIGMA_SB * tempK ** 4;
  const areaM2 = Math.max(heatW, 0) / flux;
  if (!(areaM2 > 0)) return { primitive: 'radiator', name, heatW: 0, areaM2: 0, fluxWm2: flux, panels: 0, panelL: 0, panelW: 0, dims: { l: 0, d: 0 }, mass: 0, mates: [], source: 'no heat to reject' };
  const panelArea = maxLengthM * maxWidthM;
  const panels = Math.max(2, 2 * Math.ceil(areaM2 / panelArea / 2));
  const per = areaM2 / panels;
  const panelW = Math.min(maxWidthM, Math.sqrt(per / (maxLengthM / maxWidthM)));
  const panelL = per / panelW;
  return {
    primitive: 'radiator', name, heatW, tempK, fluxWm2: flux, areaM2, panels, panelL, panelW, perSide: panels / 2,
    dims: { l: panelL, d: panelW }, mass: areaM2 * kgPerM2, kgPerM2,
    stowed: { l: panelL / 8, d: panelW },
    mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }],
    source: `Derived: ${(flux).toFixed(0)} W/m2 at ${tempK} K (eps ${emissivity}, eta ${efficiency}, ${twoSided ? 'two' : 'one'}-sided), ${kgPerM2} kg/m2 (ISS HRS/PVR class pumped-loop radiator)`
  };
}

/** Multi-layer insulation over an area. 20-layer MLI is ~0.5 kg/m2 (ISS/Columbus blankets). */
export const mliSpec = ({ areaM2, layers = 20, kgPerM2 = 0.5, name = 'MLI' }) => ({ primitive: 'mli', name, areaM2, layers, mass: areaM2 * kgPerM2, source: `${layers}-layer MLI at ${kgPerM2} kg/m2 (ISS blanket class)` });

/* ------------------------------------------------------------------ *
 * Power
 * ------------------------------------------------------------------ */

/** A solar array wing sized from power at a solar flux. ISS SAW: 31 kW BOL, 374 m2, 1,090 kg. */
export function solarArraySpec({ powerW, fluxWm2 = 1361, efficiency = 0.3, packing = 0.9, kgPerM2 = 2.9, aspect = 3.1, name = 'solar array wing' }) {
  const areaM2 = powerW / (fluxWm2 * efficiency * packing);
  const w = Math.sqrt(areaM2 / aspect), l = areaM2 / w;
  return {
    primitive: 'solar-array', name, powerW, areaM2, dims: { l, d: w }, mass: areaM2 * kgPerM2 + 90, fluxWm2,
    stowed: { l: l / 8, d: w },
    mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }],
    source: `Derived: ${Math.round(efficiency * 100)} % cells at ${packing} packing, ${fluxWm2} W/m2; ${kgPerM2} kg/m2 blanket (ISS SAW 1,090 kg / 374 m2) + 90 kg SADA/gimbal`
  };
}

/** Radioisotope power. MMRTG: 45 kg, 110 We BOL (2.4 We/kg); eMMRTG ~3 We/kg; a GPHS module is 1.44 kg for 250 Wth. */
export function rtgSpec({ powerW, wePerKg = 2.4, yearsToEOL = 0, name = 'radioisotope generator' }) {
  const bolW = powerW * Math.exp((Math.LN2 / 87.7) * yearsToEOL) * (yearsToEOL > 0 ? 1.15 : 1);
  const mass = Math.max(bolW / wePerKg, 0.5);
  const d = 0.64 * Math.cbrt(mass / 45), l = 0.66 * Math.cbrt(mass / 45);
  return {
    primitive: 'rtg', name, powerW, bolW, mass, dims: { l, d }, power: { gen: powerW, load: 0 }, heat: { rejectCapacity: bolW * 15 },
    mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }],
    source: `Derived: ${wePerKg} We/kg (MMRTG 110 We / 45 kg; Pu-238 half-life 87.7 yr, ${yearsToEOL} yr to EOL, 15 % thermocouple degradation margin)`
  };
}

/** A fission power unit with shadow shield and its own high-temperature radiator. */
export function reactorSpec({ powerWe, kgPerKWe = null, radiatorTempK = 600, efficiency = 0.25, name = 'fission reactor' }) {
  const kWe = powerWe / 1e3;
  /* specific mass falls with size: FSP 40 kWe ~ 150 kg/kWe, Kilopower 10 kWe ~ 150, MW-class studies 10-20, floored at 10 */
  if (kgPerKWe == null) kgPerKWe = Math.max(10, 150 * Math.sqrt(40 / Math.max(kWe, 1)));
  const heatW = powerWe * (1 / efficiency - 1);
  const rad = radiatorSpec({ heatW, tempK: radiatorTempK, kgPerM2: 5, maxLengthM: 30, maxWidthM: 8, name: `${name} radiator` });
  const coreKg = kWe * kgPerKWe * 0.55, shieldKg = kWe * kgPerKWe * 0.25, convKg = kWe * kgPerKWe * 0.2;
  const mass = coreKg + shieldKg + convKg + rad.mass;
  const d = Math.max(1.5, 1.2 * Math.cbrt(mass / 6000) * 2), l = Math.max(4, 3.5 * Math.cbrt(mass / 6000) * 2);
  return {
    primitive: 'reactor', name, powerWe, mass, coreKg, shieldKg, convKg, radiator: rad, dims: { l, d }, power: { gen: powerWe, load: 0 }, heat: { rejectCapacity: heatW },
    mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }],
    source: `Derived: ${kgPerKWe.toFixed(0)} kg/kWe core+shield+conversion from 150 sqrt(40 kWe / P), floor 10 (NASA Fission Surface Power 40 kWe ~ 6 t; Kilopower 10 kWe 1.5 t; MW-class studies 10-20 kg/kWe), ${Math.round(efficiency * 100)} % conversion, ${radiatorTempK} K heat-pipe radiator at 5 kg/m2`
  };
}

/** Batteries and PMAD. ISS Li-ion ORU: 194 kg, 30 kWh class ~ 150 Wh/kg; PMAD 5 kg/kW (ISS MBSU/DDCU class). */
export function powerStoreSpec({ energyWh, busW, whPerKg = 150, pmadKgPerKw = 5, name = 'batteries and PMAD' }) {
  const battKg = energyWh / whPerKg, pmadKg = (busW / 1e3) * pmadKgPerKw;
  const mass = battKg + pmadKg;
  const v = mass / 600;
  const d = Math.cbrt(v * 1.3), l = d;
  return { primitive: 'power-store', name, energyWh, busW, battKg, pmadKg, mass, dims: { l, d }, mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }], source: `Derived: ${whPerKg} Wh/kg Li-ion (ISS Li-ion ORU class), PMAD ${pmadKgPerKw} kg/kW (MBSU/DDCU class)` };
}

/* ------------------------------------------------------------------ *
 * Propulsion fittings
 * ------------------------------------------------------------------ */

/** A nozzle: throat from thrust and chamber pressure, exit from expansion ratio, mass from T/W. */
export function bellSpec({ thrustN, chamberPa = 7e6, expansion = 100, cf = 1.85, thrustToWeight = 60, name = 'engine' }) {
  const At = thrustN / (cf * chamberPa);
  const Ae = At * expansion;
  const dThroat = 2 * Math.sqrt(At / Math.PI), dExit = 2 * Math.sqrt(Ae / Math.PI);
  const length = 0.8 * (dExit - dThroat) / 2 / Math.tan((15 * Math.PI) / 180) + dThroat * 1.5;
  return {
    primitive: 'bell', name, thrustN, dThroat, dExit, dims: { l: length, d: dExit }, mass: thrustN / (thrustToWeight * G0),
    profile: [[dThroat * 0.9, 0], [dThroat / 2, dThroat * 1.5], ...Array.from({ length: 8 }, (_, i) => { const t = (i + 1) / 8; return [dThroat / 2 + (dExit / 2 - dThroat / 2) * Math.sqrt(t), dThroat * 1.5 + (length - dThroat * 1.5) * t]; })],
    mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }],
    source: `Derived: At = F/(Cf pc) at ${(chamberPa / 1e6).toFixed(1)} MPa, Cf ${cf}, Ae/At ${expansion}, 80 % bell at 15 deg; mass F/(${thrustToWeight} g)`
  };
}

/** An RCS quad: four thrusters on a pod, with valves and heaters. Draco 400 N: ~? kg; R-4D 490 N: 3.6 kg; pod with structure, lines and valves ~6x thruster mass. */
export function rcsQuadSpec({ thrustN = 400, thrusters = 4, thrusterKg = null, name = 'RCS quad' }) {
  const tKg = thrusterKg ?? Math.max(0.03, 0.0075 * thrustN);
  const mass = thrusters * tKg * 6;
  const d = Math.max(0.12, 0.25 * Math.cbrt(thrustN / 400));
  return { primitive: 'rcs-quad', name, thrustN, thrusters, thrusterKg: tKg, mass, dims: { l: d * 0.8, d }, mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }], source: `Derived: ${thrusters} x ${tKg.toFixed(1)} kg thrusters (R-4D 490 N = 3.6 kg) x 6 for pod structure, valves, lines and heaters; 30 g floor (cold-gas microthruster)` };
}

/** A kick/trim/braking stage from a delta-v budget: propellant by the rocket equation, tankage, one engine. */
export function kickStageSpec({ shipDryKg, dvMs, isp = 320, tankFraction = 0.1, bulkKgM3 = 1200, thrustAccelG = 0.05, name = 'trim and braking stage' }) {
  const ve = isp * G0;
  /* m0/m1 = e^(dv/ve) with the stage's own tanks and engine in m1: m1 = ship + tanks + engine, tanks = f prop. */
  const R = Math.exp(dvMs / ve);
  const engine = bellSpec({ thrustN: Math.max(10, shipDryKg * R * thrustAccelG * G0), chamberPa: 1.5e6, expansion: 150, thrustToWeight: 40, name: `${name} engine` });
  const denom = 1 - tankFraction * (R - 1);
  if (denom <= 0.05) return { primitive: 'kick-stage', name, dvMs, isp, propKg: Infinity, mass: Infinity, closes: false, source: 'no solution: tank fraction too high for this delta-v' };
  const dry = (shipDryKg + engine.mass) / denom;
  const propKg = dry * (R - 1);
  const tank = tankSpec({ volumeM3: propKg / bulkKgM3, ldRatio: 1.6, pressurePa: 2e6, name: `${name} tank` });
  const stageKg = propKg + propKg * tankFraction + engine.mass;
  return {
    primitive: 'kick-stage', name, dvMs, isp, massRatio: R, propKg, tankKg: propKg * tankFraction, engine, tank, mass: stageKg, propellantKg: propKg,
    dims: { l: tank.dims.l + engine.dims.l, d: Math.max(tank.dims.d, engine.dims.d) },
    mates: [{ id: 'aft', at: [0, 0, 0], axis: [0, -1, 0] }, { id: 'fore', at: [0, tank.dims.l + engine.dims.l, 0], axis: [0, 1, 0] }],
    closes: true,
    source: `Derived: ${dvMs} m/s at Isp ${isp} s, tanks ${Math.round(tankFraction * 100)} % of propellant, engine at ${thrustAccelG} g initial acceleration`
  };
}

/* ------------------------------------------------------------------ *
 * Aero and landing
 * ------------------------------------------------------------------ */

/** An ogive/Haack nose or fairing of base diameter d and length l; mass by areal density of the shell. */
export function fairingSpec({ d, l = null, fineness = 2.0, kind = 'haack', shellKgM2 = 12, tpsKgM2 = 0, name = 'nose fairing' }) {
  const L = l ?? d * fineness;
  const r = d / 2;
  const profile = kind === 'ogive' ? ogiveProfile(r, L) : haackProfile(r, L);
  const area = Math.PI * r * Math.hypot(r, L) * 1.05;
  return { primitive: 'fairing', name, kind, dims: { l: L, d }, areaM2: area, mass: area * (shellKgM2 + tpsKgM2), profile, mates: [{ id: 'aft', at: [0, 0, 0], axis: [0, -1, 0] }], source: `Derived: ${kind} loft, ${shellKgM2} kg/m2 shell${tpsKgM2 ? ` + ${tpsKgM2} kg/m2 TPS` : ''} over ${area.toFixed(1)} m2` };
}

/** Thermal protection over an area: Shuttle HRSI tiles ~9 kg/m2, Starship hex tiles ~10 kg/m2 with attach, PICA-X ablator ~15 kg/m2 at Dragon thickness, flexible quilts (FRSI/AFRSI) 2-4 kg/m2. */
export const TPS_KIND = { tile: { kgPerM2: 10, note: 'Starship/Shuttle class ceramic tiles with attachment' }, ablator: { kgPerM2: 15, note: 'PICA-X class ablator at Dragon thickness' }, quilt: { kgPerM2: 3, note: 'AFRSI flexible insulation blanket' } };
export const tpsSpec = ({ areaM2, kind = 'tile', name = 'TPS' }) => ({ primitive: 'tps', name, kind, areaM2, mass: areaM2 * TPS_KIND[kind].kgPerM2, source: `${TPS_KIND[kind].note}, ${TPS_KIND[kind].kgPerM2} kg/m2` });

/** Grid fins, Falcon 9 class: 4 fins of 1.5 x 1.2 m on a 3.66 m body, titanium ~300 kg each; scaled by body area. */
export function gridFinSpec({ bodyD, count = 4, material = 'titanium', name = 'grid fins' }) {
  const k = (bodyD / 3.66) ** 2;
  const perFin = (material === 'titanium' ? 300 : 110) * k;
  return { primitive: 'grid-fin', name, count, finW: 1.5 * (bodyD / 3.66), finH: 1.2 * (bodyD / 3.66), finT: 0.12 * (bodyD / 3.66), mass: count * perFin, dims: { l: 1.2 * (bodyD / 3.66), d: bodyD + 2 * 1.5 * (bodyD / 3.66) }, mates: [{ id: 'root', at: [0, 0, 0], axis: [0, 1, 0] }], source: `Derived: Falcon 9 ${material} grid fin (1.5 x 1.2 m, ~${material === 'titanium' ? 300 : 110} kg) scaled by (D/3.66)^2` };
}

/** Landing gear: n legs for a landed mass at a surface gravity, span 2.45 body diameters (Falcon 9), mass 4 % of landed weight-equivalent (Apollo LM gear 4.3 %, Falcon 9 ~2 t / 25 t). */
export function landingLegSpec({ landedKg, bodyD, bodyL = null, g = G0, count = 4, massFraction = 0.04, name = 'landing legs' }) {
  const span = 2.45 * bodyD;
  const height = Math.min(bodyD * 0.9, (bodyL ?? bodyD * 2) * 0.35);
  return { primitive: 'landing-leg', name, count, spanM: span, heightM: height, hingeHM: Math.min(0.117 * (bodyL ?? bodyD * 2), 9), mass: landedKg * massFraction * (g / G0), dims: { l: height, d: span }, mates: [{ id: 'root', at: [0, 0, 0], axis: [0, 1, 0] }], source: `Derived: ${count} legs, span 2.45 D, ${Math.round(massFraction * 100)} % of landed mass at ${(g / G0).toFixed(2)} g (Apollo LM 4.3 %, Falcon 9 ~8 %)` };
}

/** Parachutes for a capsule: ~3.5 % of landed mass (Dragon 2: 4 mains + 2 drogues ~ 350 kg for 9.5 t). */
export const parachuteSpec = ({ landedKg, name = 'parachutes' }) => ({ primitive: 'parachute', name, mass: landedKg * 0.035, source: 'Derived: 3.5 % of landed mass (Dragon 2 drogue + main cluster)' });

/* ------------------------------------------------------------------ *
 * Shielding
 * ------------------------------------------------------------------ */

/** Whipple / stuffed Whipple bumper over an area. ISS module bumpers ~5 kg/m2 (Al bumper 1.3 mm + standoff), stuffed Whipple ~10 kg/m2. */
export const whippleSpec = ({ areaM2, kind = 'stuffed', standoffM = 0.11, name = 'MMOD bumper' }) => ({ primitive: 'whipple', name, kind, areaM2, standoffM, mass: areaM2 * (kind === 'stuffed' ? 10 : 5), source: `${kind === 'stuffed' ? 'stuffed Whipple (Al + Nextel/Kevlar), 10' : 'Al Whipple bumper, 5'} kg/m2 at ${standoffM} m standoff (ISS US module class)` });

/** Interstellar dust/erosion shield for the bow at cruise speed: Daedalus's 50 t beryllium disc for a 32 m payload bay is ~60 kg/m2 at 0.12 c; scaled by (beta/0.12)^2 with a 5 kg/m2 floor. */
export function dustShieldSpec({ areaM2, beta = 0.1, name = 'bow dust shield' }) {
  const kgPerM2 = Math.max(5, 60 * (beta / 0.12) ** 2);
  return { primitive: 'dust-shield', name, areaM2, beta, kgPerM2, mass: areaM2 * kgPerM2, source: `Derived: Project Daedalus 50 t Be erosion shield / ~800 m2 = 60 kg/m2 at 0.12 c, scaled by beta^2 (${kgPerM2.toFixed(1)} kg/m2 at ${(beta * 100).toFixed(0)} % c)` };
}

/** A storm shelter: water wall of a stated areal density around a per-person volume. NASA DRA 5.0 / Mars transit studies: 10-20 g/cm2 of water-equivalent over a 1.5-2 m3/person shelter. */
export function stormShelterSpec({ crew, gPerCm2 = 20, m3PerPerson = 1.5, waterFromStores = true, name = 'storm shelter' }) {
  const V = crew * m3PerPerson;
  const r = Math.cbrt(V / (Math.PI * 2)), l = 2 * r;
  const area = 2 * Math.PI * r * l + 2 * Math.PI * r * r;
  const waterKg = area * gPerCm2 * 10;
  const thickness = gPerCm2 / 100;
  return { primitive: 'storm-shelter', name, crew, volumeM3: V, areaM2: area, waterKg, thicknessM: thickness, mass: waterFromStores ? waterKg * 0.08 : waterKg * 1.08, waterFromStores, dims: { l: l + 2 * thickness, d: 2 * (r + thickness) }, source: `Derived: ${gPerCm2} g/cm2 water wall (NASA DRA 5.0 10-20 g/cm2) around ${m3PerPerson} m3/person; ${waterFromStores ? 'the water is the stores water, counted once; 8 % for bladders and plumbing' : 'water plus 8 % tankage'}` };
}

/* ------------------------------------------------------------------ *
 * Avionics, comms, docking, crew fittings
 * ------------------------------------------------------------------ */

/** A parabolic high-gain antenna: gain from aperture, mass by areal density (Voyager 3.7 m 50 kg ~ 5 kg/m2; New Horizons 2.1 m). */
export function dishSpec({ d, freqGHz = 8.4, efficiency = 0.6, kgPerM2 = 6, fD = 0.4, name = 'high-gain antenna' }) {
  const lambda = 0.299792458 / freqGHz;
  const gainDbi = 10 * Math.log10(efficiency * (Math.PI * d / lambda) ** 2);
  const area = Math.PI * (d / 2) ** 2;
  const depth = (d * d) / (16 * fD * d);
  return { primitive: 'dish', name, dims: { l: depth + d * 0.35, d }, areaM2: area, gainDbi, freqGHz, fD, mass: area * kgPerM2 + 4, mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }], source: `Derived: ${kgPerM2} kg/m2 reflector + 4 kg feed (Voyager 3.7 m HGA ~50 kg), gain ${gainDbi.toFixed(1)} dBi at ${freqGHz} GHz` };
}

/** A laser communication terminal: telescope aperture d, mass ~ 50 kg/m2 of aperture + 10 kg electronics (LCRD 0.108 m ~ 30 kg; DSOC 0.22 m ~ 30 kg). */
export const laserCommSpec = ({ apertureM, powerW = 20, name = 'laser comm terminal' }) => ({ primitive: 'laser-comm', name, apertureM, powerW, dims: { l: apertureM * 2.2, d: apertureM * 1.3 }, mass: Math.max(0.3, 60 * Math.PI * (apertureM / 2) ** 2 + 10 * Math.min(1, apertureM / 0.2)), mates: [{ id: 'root', at: [0, 0, 0], axis: [0, -1, 0] }], source: 'Derived: 60 kg/m2 of aperture + electronics (NASA DSOC 0.22 m, ~30 kg; LCRD 0.108 m)' });

/** Attitude control: reaction wheels below ~50 N m s (0.6 kg per N m s, HR12 class), CMGs above (ISS DGCMG 272 kg for 4,760 N m s). */
export function attitudeStoreSpec({ inertiaKgM2, slewRadS = null, count = 4, name = 'attitude control' }) {
  /* slew requirement falls with size: 0.002 rad/s (0.11 deg/s) for a small probe, scaling as 1/sqrt(I) past 1e6 kg m2, so a world ship slews at 1e-5 rad/s */
  const slew = slewRadS ?? Math.min(0.002, 0.002 * Math.sqrt(1e6 / Math.max(inertiaKgM2, 1)));
  const h = inertiaKgM2 * slew;
  const cmg = h > 50;
  const mass = cmg ? count * Math.max(272 * (h / count / 4760), 40) : count * Math.max(0.6 * (h / count), 0.1);
  return { primitive: 'attitude-store', name, kind: cmg ? 'CMG' : 'reaction wheels', momentumNms: h, slewRadS: slew, count, mass, dims: { l: cmg ? 1.2 : 0.25, d: cmg ? 1.0 : 0.3 }, source: cmg ? `Derived: ${count} CMGs at ISS DGCMG 272 kg per 4,760 N m s, 40 kg floor` : `Derived: ${count} reaction wheels at 0.6 kg per N m s (HR12 class), 0.1 kg floor` };
}

/** GNC suite: star trackers, IMU, sun sensors, flight computers. Scaled by class: small probe 6 kg, crewed 60 kg (Orion-class avionics ~ 300 kg incl. harness). */
export const gncSpec = ({ crewed = false, scale = 1, name = 'GNC and avionics' }) => ({ primitive: 'gnc', name, items: ['2 star trackers', 'IMU', 'sun sensors', `${crewed ? '3' : '2'} flight computers`, ...(crewed ? ['rendezvous lidar', 'docking cameras'] : [])], mass: (crewed ? 60 : 6) * scale, power: (crewed ? 400 : 20) * scale, scale, source: crewed ? 'Derived: Orion/Dragon-class redundant avionics, 60 kg per 4.5 m module' : 'Derived: New Horizons-class star trackers (2 x 3 kg), IMU 5 kg, computer' });

/** Docking or berthing mechanism: IDSS/NDS active 341 kg; passive 150 kg; CBM active 500 kg / passive 200 kg; APAS 300 kg. */
export const DOCKING = { 'idss-active': { mass: 341, d: 1.6, l: 0.9, note: 'NASA Docking System (IDSS) active half' }, 'idss-passive': { mass: 150, d: 1.6, l: 0.4, note: 'IDSS passive half' }, 'cbm-active': { mass: 500, d: 2.0, l: 0.3, note: 'ISS active CBM ring with latches and bolts' }, 'cbm-passive': { mass: 200, d: 2.0, l: 0.2, note: 'ISS passive CBM ring' }, 'lightband-8': { mass: 2.5, d: 0.2, l: 0.05, note: 'Planetary Systems 8-inch motorised lightband' } };
export const dockingSpec = ({ kind = 'idss-active', name = null }) => ({ primitive: 'docking', name: name ?? DOCKING[kind].note, kind, mass: DOCKING[kind].mass, dims: { l: DOCKING[kind].l, d: DOCKING[kind].d }, source: DOCKING[kind].note });

/** Hatch and window fittings: ISS hatch ~ 50 kg (1.27 m square CBM hatch ~ 90 kg), window with shutter ~ 25 kg per 0.5 m. */
export const hatchSpec = ({ d = 1.27, name = 'hatch' }) => ({ primitive: 'hatch', name, dims: { l: 0.1, d }, mass: 90 * (d / 1.27) ** 2, source: 'ISS CBM hatch class, 90 kg at 1.27 m, scaled by area' });
export const windowSpec = ({ d = 0.5, count = 1, name = 'windows' }) => ({ primitive: 'window', name, count, dims: { l: 0.08, d }, mass: count * 25 * (d / 0.5) ** 2, source: 'ISS 4-pane window with shutter, 25 kg at 0.5 m, scaled by area' });

/** Crew fittings per class: berths, galley, hygiene, medical, exercise, stowage. ISS figures: crew quarters 200 kg each, WHC 1,400 kg (one per 4), galley 300 kg, ARED 300 kg + T2 1,000 kg per 6, CHeCS medical 300 kg + 50 kg/person, CTB stowage 0.2 kg per litre. */
export function crewFittingsSpec({ crew, days, name = 'crew fittings' }) {
  const long = days > 180;
  const items = [
    { item: 'crew quarters', kg: 200 * crew, source: 'ISS CQ 200 kg each' },
    { item: 'waste and hygiene compartments', kg: 1400 * Math.ceil(crew / 4), source: 'ISS WHC 1,400 kg per 4 crew' },
    { item: 'galley', kg: 300 * Math.ceil(crew / 6), source: 'ISS galley rack 300 kg per 6' },
    { item: 'exercise (ARED + treadmill)', kg: long ? 1300 * Math.ceil(crew / 6) : 100, source: 'ARED 300 kg + T2 1,000 kg per 6 crew (short missions: a cycle ergometer)' },
    { item: 'medical', kg: 300 + 50 * crew, source: 'ISS CHeCS 300 kg + 50 kg/person' },
    { item: 'EVA suits and tools', kg: Math.min(crew, 4) * 180 + 200, source: 'xEMU 180 kg each (up to 4) + tools' }
  ];
  return { primitive: 'crew-fittings', name, crew, days, items, mass: items.reduce((s, i) => s + i.kg, 0), source: 'ISS hardware masses, see items' };
}

/* ------------------------------------------------------------------ *
 * Sail systems
 * ------------------------------------------------------------------ */

/** Shroud/tether lines from the hull hardpoints to the film rim: n carbon lines sized for the sail load at a safety factor. */
export function shroudLinesSpec({ radiusM, lengthM, loadN, count = 6, material = 'carbon-fibre-tow', safety = 3, name = 'shroud lines' }) {
  const mat = MATERIALS[material];
  const perLine = (loadN * safety) / count;
  const area = perLine / mat.sigmaPa;
  const dLine = 2 * Math.sqrt(area / Math.PI);
  return { primitive: 'shroud-lines', name, count, lengthM, lineDiameterM: Math.max(dLine, 2e-4), mass: Math.max(area, Math.PI * 1e-8) * mat.rho * lengthM * count, loadN, source: `Derived: ${count} ${mat.note} at ${(loadN).toFixed(2)} N total x ${safety}, 0.2 mm floor` };
}

/** Six rim booms for a hexagonal flasher sail. Booms are tubular CFRP sized to carry the film's deployment tension in compression; NEA Scout's 6.8 m booms are ~0.1 kg/m, scaling with radius. */
export function sailBoomSpec({ radiusM, filmKg, count = 6, name = 'rim booms' }) {
  const kgPerM = Math.max(0.05, 0.1 * (radiusM / 7) ** 0.6);
  return { primitive: 'sail-boom', name, count, lengthM: radiusM, kgPerM, mass: count * radiusM * kgPerM, source: `Derived: ${count} CFRP coilable booms at ${kgPerM.toFixed(2)} kg/m (NEA Scout TRAC boom 0.1 kg/m at 6.8 m, scaled (R/7)^0.6)` };
}

/**
 * The sail's canister and deployment drive. The flasher fold (parts/flasher.js) gives a planar pack
 * 1/sqrt(lambda) of the span across -- an intermediate state, not a stowage: the gores are then
 * rolled onto the hub drum, so the stowed volume is the film's own volume times a packing factor
 * (LightSail 2 stows 32 m2 of 4.5 um film, 1.4e-4 m3, in ~1.5e-3 m3: ~10x). The drum is a CFRP
 * cylinder of that volume with l = d, plus winding motors and latches that scale with the film.
 */
export function sailCanisterSpec({ filmKg, filmDensity = 3400, packing = 8, name = 'sail canister and deployer' }) {
  const filmM3 = Math.max(filmKg, 1e-12) / filmDensity;
  const V = filmM3 * packing;
  const d = Math.cbrt((4 * V) / Math.PI), l = d;
  const wall = Math.min(0.03, Math.max(0.0008, d * 0.001));
  const drumKg = (Math.PI * d * l + 2 * Math.PI * (d / 2) ** 2) * wall * MATERIALS.cfrp.rho * 1.3;
  const motorKg = Math.max(0.05, 0.12 * filmKg ** 0.8);
  const latchKg = Math.max(0.02, 0.02 * filmKg);
  const mass = drumKg + motorKg + latchKg;
  return {
    primitive: 'sail-canister', name, dims: { l, d }, filmM3, volumeM3: V, packing, wallM: wall, drumKg, motorKg, latchKg, mass,
    mates: [{ id: 'aft', at: [0, 0, 0], axis: [0, -1, 0] }, { id: 'hub', at: [0, l, 0], axis: [0, 1, 0] }],
    source: `Derived: film ${filmM3.toExponential(2)} m3 x ${packing} packing (LightSail 2 ~10x) in a CFRP drum l = d, ${(wall * 1e3).toFixed(1)} mm wall; hub winding motors 0.12 kg x film^0.8; latches 2 % of film`
  };
}

/** Film thermal limit: equilibrium temperature of the film under the delivered beam at its absorptance, two-sided emission. */
/** Film optical constants are Atwater et al. 2018 (Nature Materials, Starshot lightsail): absorptance <= 1e-5 at the laser line, hemispherical emissivity ~0.5 from a patterned dielectric. */
export function filmTemperatureK({ fluxWm2, absorptance = 1e-5, emissivity = 0.5 }) {
  return Math.pow((fluxWm2 * absorptance) / (2 * emissivity * SIGMA_SB), 0.25);
}

/** Edge beacons and retroreflectors for beam pointing: one per rim corner, 20 g each for the wafer class, scaling with film radius. */
export const beaconSpec = ({ radiusM, count = 6, name = 'rim beacons and retroreflectors' }) => ({ primitive: 'beacon', name, count, mass: count * Math.max(0.0005, 0.02 * Math.sqrt(radiusM / 10)), source: 'Derived: corner-cube retroreflector + LED beacon per rim corner, 20 g at 10 m radius, scaling sqrt(R)' });

/** Sum a list of specs' masses, ignoring nulls. */
export const massOf = (specs) => specs.reduce((s, p) => s + (p?.mass ?? 0), 0);
