/* sail-mechanics.js -- how a Centauri sail actually stows, deploys, carries its load and stows again.

   The flasher in parts/flasher.js is a fold PATTERN: it says what the film looks like folded and how
   much area a given twist exposes. It is not a mechanism. Scaled by sqrt(lambda) it left a flat
   hexagon hovering over the canister at k = 0, a hub ring that did not scale with the film, no booms,
   no reels, no lines and nothing that could pay the film back in. This module is the mechanism: for
   each class an architecture chosen from flown or studied hardware, a state machine driven by the one
   deployment parameter k the viewer already has, rigid-origami film geometry that is valid at every k
   (panels hinge on fold lines, nothing stretches, areas sum to the sail area, the stowed pack is
   inside the drum), the lines and hardware that carry the load to the hull hardpoint, and the numbers
   -- stowed volume, deployment time, spin rate, tension, sag, trim authority -- that the lab prints
   and centauri-sail.test.mjs holds.

   ARCHITECTURES (chosen in architectureFor(), with the reasoning):

     starchip-disc   Breakthrough Starshot. A gram-scale chip bonded at the centre of a stiff
                     multilayer disc that is RELEASED from the mother ship's dispenser tray, not
                     deployed: stow = flat in the tray, release = a spring pushes the tray away, the
                     disc then takes the shallow dish that makes it ride the beam (Manchester & Loeb
                     2017; Ilic & Atwater 2019). No lines, no booms, nothing to refold. One-shot by
                     nature; there is no stowed state to return to once the tray is gone.

     spin-square     JAXA IKAROS (2010): a square film cut into four petals along the hub-to-midside
                     lines, each petal accordion-folded on lines parallel to its diagonal into a strip
                     with a tip mass at the corner, the four strips wrapped around the hub drum.
                     Stage 1: the hub spins, the tip masses are released and the strips unwind off the
                     drum on the tangent (yo-yo despin geometry) to full length, then swing radial.
                     Stage 2: the hold-downs release and the pleats open laterally under the
                     centrifugal pull of the strip edges. ONE-SHOT: the drum is not motorised and the
                     pleats have no furling; retraction is a cut-away at the hub. Used for the flyby
                     classes, which never need the film back.

     reeled-gore     The same fold on a motorised drum, which is a heliogyro's reel (JPL 1977 Halley
                     heliogyro, 12 blades of 7.5 km on reels; Wilkie, HELIOS 2014) with IKAROS's
                     pleats and tip masses, and furling cords across the pleats so the gores close
                     again as the drum rewinds them. N = 6 gores on a hexagonal rim with tie-lines
                     between the tips. REFOLDABLE: the braking/approach classes stow the film for the
                     magsail phase, planetary approach and dust. Spin-stabilised, so there are no
                     booms to buckle, which is the only structure that closes at Lubin's areal density
                     (see boomClosure(): CFRP booms would weigh 10-25x the film they hold).

     boom-square     NanoSail-D / LightSail 2 / NEA Scout / ACS3 / Solar Cruiser: four booms (TRAC
                     tape-spring booms under ~12 m, coilable lattice masts above) extend from the
                     canister along the diagonals; each quadrant is Z-folded parallel to its base,
                     rolled on a spool with the apex outermost, and pays out as the boom tips pull its
                     corners. Retractable (motorised deployers, re-rolling spools). In the library and
                     the lab's architecture selector for comparison; not the fleet default because at
                     0.34 g/m2 the booms never close in mass -- stated with the number, not hidden.

   KINEMATICS. k in [0, 1] is mechanism progress. Each architecture has a stage list with a physical
   duration; k is split between stages by fixed fractions (so the slider shows every stage) and
   timeAt(k) maps progress to seconds through those durations. The film geometry is a pure function
   of k, so scrubbing backwards IS the retraction for a refoldable mechanism, and a one-shot mechanism
   reports canRefold = false and offers jettison(j) instead.

   Film frame: the deployed film lies in XZ at y = 0 with +y the thrust (beam) direction; the drum
   hangs below, y in [-l, 0]. Pure functions, no DOM, no three. */

import { sailCanisterSpec, filmTemperatureK, trussSpec } from './primitives/spec.js';

export const C_LIGHT = 299792458;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

/* ------------------------------------------------------------------ *
 * Film and boom material laws
 * ------------------------------------------------------------------ */

export const FILM = {
  thicknessM: 1e-7,          // 100 nm silicon nitride (Lubin)
  densityKgM3: 3400,         // SiN
  arealKgM2: 3.4e-4,
  ultimatePa: 6e9,           // thin-film SiN tensile strength, 6-14 GPa reported; 6 taken
  safety: 3,
  foldGapM: 5e-7,            // 5 film thicknesses of air and crease per layer: packing 6x (LightSail 2 packs 4.5 um Mylar ~10x; a 100 nm film sits flatter)
  sagDesign: 0.05,           // the dish the spin is sized to hold: centre 5 % of R ahead of the rim under the beam
  coreFrac: 0.25,            // the drum's core spool, as a fraction of its radius
  bandFrac: 0.92             // of the drum length the wrapped band may use
};
export const ALLOWABLE_PA = FILM.ultimatePa / FILM.safety;

/** Boom families. `rate` is the deployer's extension speed, `EI` the deployed bending stiffness
 *  (LightSail 2 TRAC 4 m: ~60 N m2, 0.022 m/s = 4 m in 3 min; ACS3 7 m composite: ~300 N m2;
 *  ADAM coilable mast, SRTM 60 m in 17 min: 0.06 m/s, EI ~ 1e5 N m2). */
export const BOOMS = {
  trac: { kind: 'TRAC', maxL: 12, rate: 0.022, kgPerM: 0.1, EI: (L) => 60 * Math.max(1, L / 4) ** 2, spoolR: 0.06, flattenedFactor: 1e-3, source: 'NEA Scout / LightSail 2 TRAC boom, 0.1 kg/m, ~60 N m2 at 4 m, 0.022 m/s' },
  lattice: { kind: 'coilable lattice', maxL: 400, rate: 0.06, kgPerM: null, EI: (L) => 1e5 * Math.max(1, L / 60) ** 2, spoolR: null, source: 'ADAM coilable mast (SRTM 60 m in 17 min), EI ~ 1e5 N m2 at 60 m' }
};

/** Regular N-gon rim: circumradius for a film area with a hub hole of radius `hubR`. */
export function rimRadius(areaM2, N, hubR = 0) {
  const k = (N / 2) * Math.sin(TAU / N);
  return Math.sqrt((Math.max(areaM2, 0) + Math.PI * hubR * hubR) / k);
}

/** The mass penalty of holding a film of `areaM2` on four booms, which is why the fleet spins instead. */
export function boomClosure(areaM2, filmKg) {
  const S = Math.sqrt(areaM2), L = S / Math.SQRT2;
  const fam = L <= BOOMS.trac.maxL ? BOOMS.trac : BOOMS.lattice;
  const kgPerM = fam.kgPerM ?? trussSpec({ lengthM: L, widthM: Math.max(0.1, L * 0.03), axialLoadN: 50 }).kgPerM;
  const boomsKg = 4 * L * kgPerM;
  return { boomLengthM: L, family: fam.kind, kgPerM, boomsKg, ratio: boomsKg / Math.max(filmKg, 1e-12), closes: boomsKg < 0.5 * filmKg };
}

/**
 * Which architecture a class flies, and why. `base` is the class id without its version suffix.
 * The flyby classes take the one-shot IKAROS mechanism; everything that stops, carries crew or
 * approaches a planet takes the reeled gores so the film can be stowed again.
 */
export function architectureFor(base, { areaM2 = 1, filmKg = 1 } = {}) {
  const bc = boomClosure(areaM2, filmKg);
  const boomNote = `four ${bc.family} booms of ${fmt(bc.boomLengthM)} m would weigh ${bc.ratio.toFixed(1)}x the film`;
  if (base === 'wafer') return { id: 'starchip-disc', why: 'a gram-scale chip has no mechanism budget: the stiff disc is released from the dispenser tray and the beam shapes it (Starshot)', boomClosure: bc };
  if (base === 'smallsat' || base === 'instrument') return { id: 'spin-square', why: `flyby class, never needs the film back; IKAROS spin deployment with tip masses, one-shot with a cut-away at the hub; ${boomNote}`, boomClosure: bc };
  return { id: 'reeled-gore', why: `stops, carries crew or approaches a planet, so the film must stow again: heliogyro reels with IKAROS pleats and furling cords; ${boomNote}`, boomClosure: bc };
}
const fmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));

/* ------------------------------------------------------------------ *
 * Stage tables: k fractions are fixed so the slider shows every stage; seconds are physical
 * ------------------------------------------------------------------ */

function stageTable(list) {
  const total = list.reduce((s, st) => s + st.frac, 0);
  let k0 = 0;
  const stages = list.map((st) => { const out = { ...st, k0, k1: k0 + st.frac / total }; k0 = out.k1; return out; });
  stages[stages.length - 1].k1 = 1;
  const totalSeconds = stages.reduce((s, st) => s + st.seconds, 0);
  const stageAt = (k) => {
    const kk = clamp(k, 0, 1);
    const st = stages.find((s) => kk < s.k1) ?? stages[stages.length - 1];
    return { ...st, t: clamp((kk - st.k0) / Math.max(st.k1 - st.k0, 1e-12), 0, 1) };
  };
  const timeAt = (k) => { const st = stageAt(k); return stages.filter((s) => s.k1 <= st.k0 + 1e-12).reduce((s, x) => s + x.seconds, 0) + st.t * st.seconds; };
  /* progress of one named stage at k: 0 before, 1 after */
  const prog = (k, id) => { const st = stages.find((s) => s.id === id); if (!st) return 0; return clamp((clamp(k, 0, 1) - st.k0) / Math.max(st.k1 - st.k0, 1e-12), 0, 1); };
  return { stages, totalSeconds, stageAt, timeAt, prog };
}

/* ------------------------------------------------------------------ *
 * The mechanism
 * ------------------------------------------------------------------ */

/**
 * Build the mechanism for one sail.
 *   architecture  one of the ids above (or omit and pass `base` to let architectureFor choose)
 *   areaM2        film area (the sail law's), filmKg its mass, thicknessM, densityKgM3
 *   drum          { d, l } of the canister primitive; null derives one from sailCanisterSpec (v1 has
 *                 no canister part -- the drum is drawn and stated, never counted in the pins)
 *   shipKg        everything the film pushes (for the acceleration and the pressure)
 *   deliveredW    beam power at the sail (thrust, flux, film temperature)
 *   offAxisM      centre of pressure to centre of mass, from measure().geometry
 *   mastLenM      lever arm of the hub gimbal
 *   gapM          fold gap per layer; default FILM.foldGapM. `fillDrum: true` instead chooses the gap
 *                 that fills the drum annulus, which is how a drawn-down film is made visible
 *   pleatCap      cap on pleats per gore for a geometry model (the numbers always use the real count)
 *   hubR          hub hole radius (defaults to the drum radius)
 */
export function sailMechanism(o) {
  const arch = o.architecture ?? architectureFor(o.base ?? 'habitat', { areaM2: o.areaM2, filmKg: o.filmKg }).id;
  const A = Math.max(o.areaM2, 1e-9);
  const t = o.thicknessM ?? FILM.thicknessM, rho = o.densityKgM3 ?? FILM.densityKgM3;
  const filmKg = o.filmKg ?? A * t * rho;
  const drumSpec = o.drum ?? (() => { const c = sailCanisterSpec({ filmKg, filmDensity: rho }); return { d: c.dims.d, l: c.dims.l, derived: true, mass: c.mass }; })();
  const rD = drumSpec.d / 2, lD = drumSpec.l, rCore = FILM.coreFrac * rD;
  const shipKg = o.shipKg ?? filmKg;
  const P = o.deliveredW ?? 0, eta = o.eta ?? 0.9;
  const thrustN = (2 * eta * P) / C_LIGHT;
  const flux = P / A, pressurePa = thrustN / A, accel = thrustN / Math.max(shipKg + filmKg, 1e-12);
  const common = { architecture: arch, areaM2: A, filmKg, thicknessM: t, densityKgM3: rho, drum: { r: rD, l: lD, rCore, derived: !!drumSpec.derived, mass: drumSpec.mass ?? null }, thrustN, pressurePa, accel, fluxWm2: flux, filmK: filmTemperatureK({ fluxWm2: flux }), filmLimitK: 1000 };
  if (arch === 'starchip-disc') return starchipDisc(o, common);
  if (arch === 'boom-square') return boomSquare(o, common);
  return spinGores(o, common, arch === 'reeled-gore');
}

/* ---- loads and pointing, shared ---- */
function pointing({ thrustN, areaM2, R, offAxisM, mastLenM, vaneAreaM2, pitchRad = 0, gimbalRad = 0.087 }, fluxWm2) {
  const needed = thrustN * Math.max(offAxisM, 1e-3 * R);                 // disturbance torque: thrust through the CP, CM off the line
  const vane = vaneAreaM2 > 0 ? ((2 * 0.9 * fluxWm2 * vaneAreaM2) / C_LIGHT) * Math.sin(2 * 0.61) * R : 0;   // tip vanes at 35 deg
  const gimbal = thrustN * Math.sin(gimbalRad) * Math.max(mastLenM, 0.5 * R * 0.01); // hub gimbal tilts the thrust vector about the hull CM
  const pitch = pitchRad > 0 ? 0.5 * thrustN * R * Math.sin(2 * pitchRad) * 0.5 : 0; // heliogyro-style cyclic pitch of the gores
  const total = vane + gimbal + pitch;
  return { thrustN, neededNm: needed, vaneNm: vane, gimbalNm: gimbal, pitchNm: pitch, totalNm: total, margin: total / Math.max(needed, 1e-30), ok: total >= needed, cosLaw: 'F = 2 eta P cos^2(alpha) / c; the vanes and gimbal must cover F x (CP - CM) with margin' };
}

/* ---- the quad/area helpers shared by every geometry ---- */
const quadArea = (q) => { const [a, b, c, d] = q; return 0.5 * (triArea(a, b, c) + triArea(a, c, d)); };
const quadProjArea = (q) => { const [a, b, c, d] = q; const f = (p, q2, r) => Math.abs((q2[0] - p[0]) * (r[2] - p[2]) - (q2[2] - p[2]) * (r[0] - p[0])) * 0.5; return f(a, b, c) + f(a, c, d); };
function triArea(a, b, c) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; return Math.sqrt(x * x + y * y + z * z); }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ================================================================== *
 * spin-square (IKAROS, one-shot) and reeled-gore (refoldable)
 * ================================================================== */
function spinGores(o, c, refoldable) {
  const N = refoldable ? 6 : 4;
  const { r: rD, l: lD, rCore } = c.drum;
  const hubR = o.hubR ?? rD;
  const R = rimRadius(c.areaM2, N, hubR);
  const half = Math.PI / N, tanH = Math.tan(half);
  const a = R * Math.cos(half);                 // apothem
  const vMax = R * Math.cos(half) * Math.sin(half);   // half-width of a gore at its widest (the side midpoints)
  const side = 2 * R * Math.sin(half);
  const stripL = R - hubR;                       // bundle length, root at the drum to the corner tip
  /* pleats: the band wrapped on the drum is as tall as the drum allows; the pleat width is that band */
  const w = FILM.bandFrac * lD;
  /* an even count puts a fold line on the gore axis, so the corner tip (and its mass) sits on a crease, not inside a pleat */
  const nReal = 2 * Math.max(1, Math.ceil((2 * vMax) / w / 2));
  const wReal = (2 * vMax) / nReal;
  const stackReal = nReal * (c.thicknessM + FILM.foldGapM);  // one strip's folded thickness
  const packVolume = c.areaM2 * (c.thicknessM + FILM.foldGapM);
  const annulusM3 = Math.PI * (rD * rD - rCore * rCore) * wReal;
  const pitchReal = N * stackReal;                 // N-start spiral: all strips share the band
  /* the wound pack's outer radius from its volume: the bundle is only full-thickness where every pleat is
     present, so the volume, not the bounding envelope, sets the radius */
  const outerReal = Math.sqrt(rCore * rCore + packVolume / (Math.PI * wReal));
  const pack = { pleatsPerGore: nReal, pleatWidthM: wReal, bandHeightM: wReal, stackM: stackReal, pitchM: pitchReal, volumeM3: packVolume, annulusM3, fits: packVolume <= annulusM3 * 1.0001 && wReal <= lD, outerRadiusM: outerReal, turns: (stripL * N) / (TAU * (rCore + outerReal) / 2), layersPerStrip: stripL / (TAU * (rCore + outerReal) / 2) };

  /* spin: the hoop stress of a film spinning at omega is rho omega^2 R^2; tension T = sigma t holds the beam
     pressure with a dish delta0 = p R^2 / (4 T). Spin to FILM.sagDesign unless the allowable stops it. */
  const Tdesign = (c.pressurePa * R) / (4 * FILM.sagDesign);
  const sigma = Math.min(ALLOWABLE_PA, Math.max(Tdesign / c.thicknessM, 1e3));
  const T = sigma * c.thicknessM;
  const omega = Math.sqrt(sigma / c.densityKgM3) / R;
  const sag0 = c.pressurePa > 0 ? (c.pressurePa * R * R) / (4 * T) : 0;
  const tipKg = Math.max(0.0005, 0.01 * c.filmKg / N);   // the inventory's rim masses and beacons share
  const spin = { omegaRadS: omega, rpm: (omega * 60) / TAU, periodS: TAU / omega, rimSpeedMs: omega * R, hoopStressPa: sigma, tensionNm: T, sagM: sag0, sagFrac: sag0 / R, stressLimited: Tdesign / c.thicknessM > ALLOWABLE_PA, tipKg };
  /* release spin: 1 m/s2 at the drum rim so the tip masses leave (IKAROS released at ~25 rpm on a 1.6 m body) */
  const omega0 = Math.sqrt(1.0 / rD);
  const Ifilm = (k) => filmInertia(k);
  const I0 = 0.5 * (c.drum.mass ?? 0.3 * c.filmKg) * rD * rD + c.filmKg * ((rCore + outerReal) / 2) ** 2 + N * tipKg * rD * rD;

  /* stages */
  const vReel = refoldable ? clamp(0.05 * Math.sqrt(R / 100), 0.02, 1) : 0.02;   // reel rate (heliogyro cm/s class) / IKAROS quasi-static cm/s
  const tOpen = Math.max(10, vMax / 2);
  const T_ = stageTable([
    { id: 'stowed', name: 'stowed, latched, spinning up', frac: 0.05, seconds: 300 },
    { id: 'release', name: 'latch release: doors open, tip masses out', frac: 0.07, seconds: 120 },
    { id: 'payout', name: refoldable ? 'drum pays the strips out on the tangent' : 'strips unwind off the drum (yo-yo)', frac: 0.50, seconds: stripL / vReel },
    { id: 'swing', name: 'strips swing from tangent to radial', frac: 0.08, seconds: 0.25 * TAU / omega0 },
    { id: 'open', name: 'hold-downs release, pleats open laterally', frac: 0.20, seconds: tOpen },
    { id: 'trim', name: 'tie-lines taut, spin to design rate, dish under load', frac: 0.10, seconds: 600 }
  ]);

  const thetaMin = (gap) => Math.asin(clamp((c.thicknessM + gap) / wReal, 1e-6, 0.5));
  /* geometry model resolution */
  /* the cap only bites on a true-size film with thousands of pleats; a drawn film keeps its real count, so the
     band it wraps is the drum's own */
  const pleatCap = o.pleatCap ?? 48;
  const nGeo = nReal <= Math.max(pleatCap, 64) ? nReal : 2 * Math.ceil(pleatCap / 2);
  const wGeo = (2 * vMax) / nGeo;
  /* fillDrum: the gap that makes THIS film (a drawn-down one, usually) fill 85 % of the annulus, so the pack is visible in the open drum */
  /* The geometry wraps every pleat slot at full stack thickness even where the short edge pleats are absent, so
     the fill is sized on the bundle's bounding envelope N x stripL x 2 vMax, not on the film area; the real pack's
     fit (pack.fits) is the volume check. */
  const envelopeM2 = N * stripL * 2 * vMax;
  const gap = o.fillDrum ? Math.max(FILM.foldGapM, (0.80 * Math.PI * (rD * rD - rCore * rCore) * Math.min(wGeo, lD)) / envelopeM2 - c.thicknessM) : (o.gapM ?? FILM.foldGapM);
  /* the N strips interleave one stack apart with 8 % clearance between neighbouring layers */
  const stackGeo = nGeo * (c.thicknessM + gap), pitchGeo = N * stackGeo * 1.08;
  const thetaMinGeo = Math.asin(clamp(stackGeo / (2 * vMax), 1e-6, 0.5));
  const outerGeo = Math.sqrt(rCore * rCore + (pitchGeo * stripL) / Math.PI);
  const turnsGeo = stripL / (TAU * (rCore + outerGeo) / 2);
  /* enough slices per turn that a chord's sagitta stays under the pleat spacing in the stack */
  const perTurn = clamp(Math.PI * Math.sqrt((rCore + outerGeo) / Math.max(stackGeo / nGeo, 1e-9)), 24, 120);
  const segs = clamp(Math.ceil(perTurn * turnsGeo) + 8, 16, o.segCap ?? 1200);

  function filmInertia(k) {
    /* rigid co-rotation: strip j at its position; use the geometry's panel centroids weighted by area */
    const g = geometry(k, { coarse: true });
    let I = 0;
    for (const p of g.panels) { const cx = (p.v[0][0] + p.v[1][0] + p.v[2][0] + p.v[3][0]) / 4, cz = (p.v[0][2] + p.v[1][2] + p.v[2][2] + p.v[3][2]) / 4; I += p.area * c.densityKgM3 * c.thicknessM * (cx * cx + cz * cz); }
    for (const tip of g.hardware.tips) I += tipKg * (tip.p[0] ** 2 + tip.p[2] ** 2);
    return I;
  }

  /** Spin state at k: free yo-yo (I omega = const) until the tip acceleration would fall under 0.1 m/s2,
   *  then the hub RCS holds the floor; the trim stage brings omega to the design rate. */
  function spinAt(k) {
    const g = geometry(k, { coarse: true });
    const If = g.inertia, I = I0 + If;
    const L0 = I0 * omega0;
    const rTip = Math.max(rD, ...g.hardware.tips.map((p) => Math.hypot(p.p[0], p.p[2])));
    const free = L0 / I;
    const floor = Math.sqrt(0.1 / rTip);
    const tr = T_.prog(k, 'trim');
    const w = tr > 0 ? lerp(Math.max(free, floor), omega, smooth(tr)) : Math.max(free, floor);
    return { omegaRadS: w, rpm: (w * 60) / TAU, inertiaKgM2: I, momentum: I * w, momentum0: L0, addedNms: I * w - L0, freeOmega: free, controlled: w > free + 1e-12, rTipM: rTip, tipAccel: w * w * rTip };
  }

  /**
   * Film geometry at k. Returns panels (quads, each a rigid pleat segment), lines, hardware, areas.
   * opts.coarse uses a few segments (for inertia sums).
   */
  function geometry(k, opts = {}) {
    const kk = clamp(k, 0, 1);
    const st = T_.stageAt(kk);
    const pRel = T_.prog(kk, 'release'), pPay = T_.prog(kk, 'payout'), pSw = T_.prog(kk, 'swing'), pOp = T_.prog(kk, 'open'), pTr = T_.prog(kk, 'trim');
    const s = stripL * smooth(pPay);                      // straight length paid out
    const theta = lerp(thetaMinGeo, Math.PI / 2, smooth(pOp));
    const sagNow = spin.sagM * smooth(pTr);
    const m = opts.coarse ? 6 : segs;
    const nP = opts.coarse ? Math.min(nGeo, 6) : nGeo;
    const wP = (2 * vMax) / nP;
    const panels = [], tips = [], roots = [], starts = [];
    const sinT = Math.sin(theta), cosT = Math.cos(theta);
    const Lw = stripL - s;                                 // still wrapped
    for (let i = 0; i < N; i += 1) {
      const alpha = (i / N) * TAU;                         // corner azimuth: the gore axis
      /* N-start Archimedean spiral: every strip starts on the core at its own azimuth, so at any angle the N
         strips sit one stack apart; arc length from the root sigma -> radius rho(sigma) = sqrt(rho0^2 + p sigma / pi),
         angle beta = 2 pi (rho - rho0) / p, wound +beta from the root */
      const rho0 = rCore + stackGeo / 2;
      const rhoAt = (sg) => Math.sqrt(rho0 * rho0 + (pitchGeo * Math.max(sg, 0)) / Math.PI);
      const betaAt = (sg) => (TAU * (rhoAt(sg) - rho0)) / pitchGeo;
      const rhoD = rhoAt(Lw), betaD = alpha + betaAt(Lw);  // departure point
      const Tx = rhoD * Math.cos(betaD), Tz = rhoD * Math.sin(betaD);
      /* straight part direction: tangent while anything is wrapped, swinging to radial (about the root) after */
      const tangent = [-Math.sin(betaD), Math.cos(betaD)];
      const radial = [Math.cos(alpha), Math.sin(alpha)];
      const sw = smooth(pSw);
      const ang0 = Math.atan2(tangent[1], tangent[0]), ang1 = Math.atan2(radial[1], radial[0]);
      let dAng = ang1 - ang0; while (dAng > Math.PI) dAng -= TAU; while (dAng < -Math.PI) dAng += TAU;
      const ang = ang0 + dAng * sw;
      const dir = [Math.cos(ang), Math.sin(ang)];
      /* with the swing the straight part pivots about the root point on the drum rim rather than the departure point */
      const rootX = rD * Math.cos(alpha), rootZ = rD * Math.sin(alpha);
      const px = lerp(Tx, rootX, sw), pz = lerp(Tz, rootZ, sw);
      starts.push([px, 0, pz]);
      /* in-plane lateral of the straight part: +V is outward from the drum at the departure point, as it is in the
         wrap (rho + V), so the stack keeps its order across the departure point */
      const perp = [dir[1], -dir[0]];
      roots.push([rootX, 0, rootZ]);
      const uIn = (v) => Math.max(hubR, Math.abs(v) / tanH), uOut = (v) => R - Math.abs(v) * tanH;
      /* a point of pleat j at (u, v): the pleat's lateral offset V (stack direction when folded, in-plane when open)
         and its normal offset Nn (band height when folded, zero when open); then along the strip: straight if
         within the paid-out length from the tip, otherwise on the spiral around the drum */
      const pleatPoint = (j, u, v) => {
        const v0 = -vMax + j * wP, sj = j % 2 ? 1 : -1;
        const Vj = -vMax * sinT + j * wP * sinT, Nj = (j % 2) ? -wP * cosT : 0;
        const V = Vj + (v - v0) * sinT, Nn = Nj + sj * (v - v0) * cosT;
        const fromTip = R - u;                             // arc length from the tip
        if (fromTip <= s) {
          const ell = s - fromTip;                         // distance from the departure point along the straight part
          const x = px + dir[0] * ell + perp[0] * V, z = pz + dir[1] * ell + perp[1] * V;
          const rr = Math.hypot(x, z);
          return [x, Nn + (rr < R ? sagNow * (1 - (rr * rr) / (R * R)) : 0), z];
        }
        const sg = Lw - (fromTip - s);                     // arc length from the root of this wrapped point
        const rho = rhoAt(sg) + V, beta = alpha + betaAt(sg);
        return [rho * Math.cos(beta), Nn, rho * Math.sin(beta)];
      };
      /* every pleat is cut on the same u levels, clipped to its own slanted ends, so a segment of pleat j and the
         same segment of pleat j+1 share their fold-line vertices exactly and no quad is skewed along the strip */
      /* at radius u the gore spans |v| <= min(u tan, (R - u) / tan): the inner slant to the side midpoints and the
         outer V of the two half-sides meeting at the corner. Each slice of a pleat is trimmed to that, so the
         slanted edges are chords of one slice, never of a long arc of the wrap. */
      const vMaxAt = (u) => Math.max(0, Math.min(u * tanH, (R - u) / tanH));
      for (let j = 0; j < nP; j += 1) {
        const v0 = -vMax + j * wP, v1 = v0 + wP;
        const cv = (v) => clamp(v, v0, v1);
        /* where this pleat begins and ends along u: the fold line nearest the gore axis crosses the inner slant
           at uStart and the outer V at uEnd (a pleat astride the axis runs the whole strip) */
        const vRef = v0 >= 0 ? v0 : v1 <= 0 ? -v1 : 0;
        const uStart = Math.max(hubR, vRef / tanH), uEnd = R - vRef * tanH;
        for (let q = 0; q < m; q += 1) {
          let ua = hubR + ((R - hubR) * q) / m, ub = hubR + ((R - hubR) * (q + 1)) / m;
          if (ub <= uStart || ua >= uEnd) continue;                    // no film of this pleat in this slice
          ua = Math.max(ua, uStart); ub = Math.min(ub, uEnd);          // the slice ends exactly at the boundary crossing
          const la = cv(-vMaxAt(ua)), ha = cv(vMaxAt(ua)), lb = cv(-vMaxAt(ub)), hb = cv(vMaxAt(ub));
          if (ha <= la && hb <= lb) continue;
          const quad = [pleatPoint(j, ua, la), pleatPoint(j, ua, Math.max(ha, la)), pleatPoint(j, ub, Math.max(hb, lb)), pleatPoint(j, ub, lb)];
          const area = quadArea(quad);
          if (area < 1e-12 * c.areaM2) continue;
          panels.push({ v: quad, gore: i, pleat: j, seg: q, area, projArea: quadProjArea(quad), wrapped: R - ub > s - 1e-9 * R, uv: [[ua, la], [ua, Math.max(ha, la)], [ub, Math.max(hb, lb)], [ub, lb]], vFold: [v0, v1] });
        }
      }
      /* the tip mass rides the corner, which is on the central pleat (v = 0) */
      tips.push({ p: pleatPoint(Math.floor(nP / 2), R, 0), gore: i });
    }
    /* lines: the edge cord of each strip's straight part (departure point -> tip, taut by construction: it is the
       strip), and the rim tie-lines tip -> next tip, slack until the pleats open */
    const lines = [];
    for (let i = 0; i < N; i += 1) {
      const a0 = [starts[i][0], tips[i].p[1], starts[i][2]];   // the cord runs in the tip's pleat plane
      lines.push({ id: `cord-${i}`, a: a0, b: tips[i].p, paidM: s + stackGeo, geomM: dist(a0, tips[i].p), along: 'strip', state: 'taut' });
      const j = (i + 1) % N, d = dist(tips[i].p, tips[j].p);
      lines.push({ id: `tie-${i}`, a: tips[i].p, b: tips[j].p, paidM: side, geomM: d, state: d >= side * (1 - 1e-3) ? 'taut' : 'slack' });
    }
    const deployedArea = panels.reduce((s2, p) => s2 + (p.wrapped ? 0 : p.projArea), 0);
    const filmArea = panels.reduce((s2, p) => s2 + p.area, 0);
    const doors = []; for (let i = 0; i < N; i += 1) doors.push({ azimuth: (i + 0.5) * (TAU / N), angle: smooth(pRel) * Math.PI * 0.55 });
    const inertia = opts.coarse ? panels.reduce((s2, p) => { const cx = (p.v[0][0] + p.v[2][0]) / 2, cz = (p.v[0][2] + p.v[2][2]) / 2; return s2 + p.area * c.densityKgM3 * c.thicknessM * (cx * cx + cz * cz); }, 0) + tips.reduce((s2, tp) => s2 + tipKg * (tp.p[0] ** 2 + tp.p[2] ** 2), 0) : null;
    const tension = pPay > 0 ? Math.max(T * side * smooth(pOp), tipKg * (omega0 * omega0) * Math.max(rD, Math.hypot(tips[0].p[0], tips[0].p[2]))) : 0;
    return {
      k: kk, stage: st, panels, lines, tips: tips.map((t2) => t2.p), filmAreaM2: filmArea, deployedAreaM2: deployedArea, extensionM: s, theta, pleatOpen: smooth(pOp), sagM: sagNow, inertia,
      tensionN: tension,
      hardware: { drum: { r: rD, l: lD, rCore, bandH: wGeo }, doors, tips, roots, gimbalRad: 0.02 * smooth(pTr), spinPhase: 0, vanes: tips.map((t2) => ({ p: t2.p, deflectRad: 0.3 * smooth(pTr) })) }
    };
  }

  const vaneArea = 0.02 * c.areaM2;
  const point = pointing({ thrustN: c.thrustN, areaM2: c.areaM2, R, offAxisM: o.offAxisM ?? 0, mastLenM: o.mastLenM ?? 0, vaneAreaM2: vaneArea, pitchRad: refoldable ? 0.1 : 0 }, c.fluxWm2);
  const jettison = (j) => ({ separationM: 2 * R * clamp(j, 0, 1), dvMs: 0.5, seconds: (2 * R * clamp(j, 0, 1)) / 0.5, cut: ['hub cords', 'furling cords', 'gimbal release nuts'] });
  return {
    ...c, N, R, apothem: a, side, stripL, hubR, pack, spin, omega0, discretisedAreaM2: c.areaM2, stages: T_.stages, totalSeconds: T_.totalSeconds, stageAt: T_.stageAt, timeAt: T_.timeAt,
    rates: { payoutMs: vReel, openMs: 2 }, geometry, spinAt, pointing: point, canRefold: refoldable, oneShot: !refoldable, jettison,
    retract: refoldable ? 'drum rewinds the strips, furling cords close the pleats, latches re-engage; the same path backwards' : 'cannot refold: the drum is not motorised and the pleats have no furling. Cut-away at the hub (jettison).',
    resolution: { pleatsGeo: nGeo, pleatsReal: nReal, segs, gapGeoM: gap, gapRealM: FILM.foldGapM },
    source: refoldable ? 'JPL Halley heliogyro (1977) reels; IKAROS (2010) fold; Wilkie HELIOS (2014)' : 'JAXA IKAROS (2010): 14 m square, four petals, tip masses, two-stage spin deployment'
  };
}

/* ================================================================== *
 * boom-square: four booms, four Z-folded quadrants on spools
 * ================================================================== */
function boomSquare(o, c) {
  const S = Math.sqrt(c.areaM2), L = S / Math.SQRT2, a = S / 2;
  const { r: rD, l: lD, rCore } = c.drum;
  const fam = L <= BOOMS.trac.maxL ? BOOMS.trac : BOOMS.lattice;
  const kgPerM = fam.kgPerM ?? trussSpec({ lengthM: L, widthM: Math.max(0.1, L * 0.03), axialLoadN: 50 }).kgPerM;
  const EI = fam.EI(L);
  const quadKg = c.filmKg / 4;
  const mTipEff = quadKg + 0.1 * kgPerM * L;                       // the film it drags plus a tip fitting
  const f1 = (1 / TAU) * Math.sqrt((3 * EI) / (L ** 3 * (mTipEff + 0.24 * kgPerM * L)));
  const strainJ = fam.spoolR ? (fam.flattenedFactor * EI * L) / (2 * fam.spoolR * fam.spoolR) : null;
  /* Z-fold parallel to the base, rolled apex-out on four spools in the cassette */
  const nReal = Math.max(1, Math.ceil(a / (0.9 * lD)));
  const pleatH = a / nReal;
  const stack = nReal * (c.thicknessM + FILM.foldGapM);
  const rollLen = S;                                                 // the pleat strips are as wide as the base
  const packVolume = c.areaM2 * (c.thicknessM + FILM.foldGapM);
  const spoolM3 = 4 * Math.PI * ((rD * 0.45) ** 2 - rCore * rCore * 0.25) * Math.min(lD, 0.9 * lD);
  const pack = { pleatsPerQuadrant: nReal, pleatHeightM: pleatH, stackM: stack, volumeM3: packVolume, annulusM3: spoolM3, fits: packVolume <= spoolM3 * 1.0001, rollRadiusM: Math.sqrt(rCore * rCore * 0.25 + (quadKg / c.densityKgM3 / c.thicknessM) * (c.thicknessM + FILM.foldGapM) / (Math.PI * Math.min(S, 0.9 * lD))) };
  /* tension: the booms hold the film against the beam; T is sized so a membrane spanning the whole side would
     billow the design 5 %, and each quadrant, a pillow bounded by two booms, the hub and its edge cord, spans
     half that, so its billow is a quarter of it */
  const T = Math.min(ALLOWABLE_PA * c.thicknessM, (c.pressurePa * S * S) / (8 * FILM.sagDesign * S) || 1e-3);
  const sag0 = c.pressurePa > 0 ? (c.pressurePa * (S / 2) * (S / 2)) / (8 * T) : 0;
  const boomCompression = T * S;                                     // each boom reacts the edge tension of its two quadrants
  const Pcr = (Math.PI * Math.PI * EI) / (4 * L * L);                // cantilever Euler load
  const T_ = stageTable([
    { id: 'stowed', name: 'stowed, latched', frac: 0.05, seconds: 60 },
    { id: 'release', name: 'latch release: doors open', frac: 0.08, seconds: 60 },
    { id: 'extend', name: `${fam.kind} booms extend, quadrants pay out from the spools`, frac: 0.62, seconds: L / fam.rate },
    { id: 'tension', name: 'booms latch, tension actuators take up the pleats', frac: 0.15, seconds: 300 },
    { id: 'trim', name: 'corner halyards taut, dish under load', frac: 0.10, seconds: 300 }
  ]);
  const pleatCap = o.pleatCap ?? 48, nGeo = Math.min(nReal, pleatCap), hGeo = a / nGeo;
  const creaseAmp = o.fillDrum ? 0.02 * a / nGeo : 0.5 * (c.thicknessM + FILM.foldGapM) * nGeo;   // residual zigzag before tensioning

  function geometry(k, opts = {}) {
    const kk = clamp(k, 0, 1), st = T_.stageAt(kk);
    const pRel = T_.prog(kk, 'release'), pEx = T_.prog(kk, 'extend'), pTe = T_.prog(kk, 'tension'), pTr = T_.prog(kk, 'trim');
    const e = smooth(pEx);                                           // boom extension fraction
    const Lb = L * e;
    const zig = creaseAmp * (1 - smooth(pTe));
    const sagNow = sag0 * smooth(pTr);
    const nP = opts.coarse ? Math.min(nGeo, 4) : nGeo, hP = a / nP;
    const panels = [], booms = [], tips = [], spools = [];
    const hubOff = rD * 0.6;                                         // the quadrant apex sits at the spool exit
    for (let i = 0; i < 4; i += 1) {
      const alphaA = (i / 4) * TAU, alphaB = ((i + 1) / 4) * TAU, mid = alphaA + Math.PI / 4;
      const tipA = [Lb * Math.cos(alphaA), 0, Lb * Math.sin(alphaA)], tipB = [Lb * Math.cos(alphaB), 0, Lb * Math.sin(alphaB)];
      booms.push({ root: [rD * 0.9 * Math.cos(alphaA), -lD * 0.5, rD * 0.9 * Math.sin(alphaA)], dir: [Math.cos(alphaA), 0, Math.sin(alphaA)], lengthM: Lb, kind: fam.kind, azimuth: alphaA });
      tips.push({ p: tipA, gore: i });
      /* quadrant triangle apex (hub) -> base between tipA and tipB; heights measured from the apex along `mid`;
         the deployed region is heights [hubOff, e a] -- the apex comes off the spool first (rolled apex-out) */
      const hDep = Math.max(hubOff, e * a);
      const mx = Math.cos(mid), mz = Math.sin(mid), px = -mz, pz = mx;   // along the quadrant axis and its base direction
      /* f in [-1, 1] across the quadrant at height h (half-width = h: the booms are at f = +-1). The residual
         pleat zigzag alternates per pleat; the billow under load is a pillow bounded by the two booms, the hub
         and the tensioned edge cord along the free side, so it is zero on all four and largest mid-quadrant. */
      /* the fold line between pleats j-1 and j sits at y = +-zig (alternating), so adjacent pleats share it */
      const yFold = (jf, f) => (jf % 2 ? -zig : zig) * (1 - f * f);
      const pt = (h, f, jf) => {
        const x = h * mx + f * h * px, z = h * mz + f * h * pz;
        const hh = Math.min(1, Math.max(0, (h - hubOff) / Math.max(a - hubOff, 1e-9)));
        const y = yFold(jf, f) + sagNow * (1 - f * f) * 4 * hh * (1 - hh);
        return [x, y, z];
      };
      const mf = opts.coarse ? 2 : 8;                                  // lateral slices, so the billow can be drawn
      for (let j = 0; j < nP; j += 1) {
        const h0 = hubOff + j * ((hDep - hubOff) / nP), h1 = hubOff + (j + 1) * ((hDep - hubOff) / nP);
        for (let q = 0; q < mf; q += 1) {
          const f0 = -1 + (2 * q) / mf, f1 = -1 + (2 * (q + 1)) / mf;
          const quad = [pt(h0, f0, j), pt(h0, f1, j), pt(h1, f1, j + 1), pt(h1, f0, j + 1)];
          panels.push({ v: quad, gore: i, pleat: j, seg: q, area: quadArea(quad), projArea: quadProjArea(quad), wrapped: false });
        }
      }
      /* the rest of the quadrant is on its spool: a roll whose cross-section carries the remaining area */
      const remaining = Math.max(0, (c.areaM2 / 4) * (1 - e * e));
      const rollR = Math.sqrt(rCore * rCore * 0.25 + (remaining * (c.thicknessM + (opts.gapM ?? (o.fillDrum ? (spoolM3 / c.areaM2 - c.thicknessM) : FILM.foldGapM)))) / (Math.PI * Math.min(S, 0.9 * lD)));
      spools.push({ p: [hubOff * 0.7 * mx, -lD * 0.5, hubOff * 0.7 * mz], axis: [px, 0, pz], radiusM: rollR, lengthM: Math.min(S, 0.9 * lD), remainingM2: remaining });
    }
    const lines = [];
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4, cornerA = tips[i].p, cornerB = tips[j].p;
      /* halyard: boom tip to the film corner, 2 % of the side, taut once tensioned */
      const halyard = 0.02 * S;
      lines.push({ id: `halyard-${i}`, a: booms[i].root.map((v2, q) => (q === 1 ? 0 : v2 + booms[i].dir[q] * Lb * 0.98)), b: cornerA, paidM: halyard, geomM: Lb * 0.02, state: pTe > 0.99 ? 'taut' : 'slack' });
      lines.push({ id: `edge-${i}`, a: cornerA, b: cornerB, paidM: S, geomM: dist(cornerA, cornerB), state: e > 0.999 && pTe > 0.5 ? 'taut' : 'slack' });
    }
    const filmArea = panels.reduce((s2, p) => s2 + p.area, 0) + spools.reduce((s2, sp) => s2 + sp.remainingM2, 0);
    const deployedArea = panels.reduce((s2, p) => s2 + p.projArea, 0);
    const doors = []; for (let i = 0; i < 4; i += 1) doors.push({ azimuth: (i + 0.5) * (TAU / 4), angle: smooth(pRel) * Math.PI * 0.55 });
    return {
      k: kk, stage: st, panels, lines, tips: tips.map((t2) => t2.p), filmAreaM2: filmArea, deployedAreaM2: deployedArea, extensionM: Lb, theta: Math.PI / 2 - Math.atan2(zig, hP) , pleatOpen: smooth(pTe), sagM: sagNow, inertia: null,
      tensionN: T * S * smooth(pTe), boomCompressionN: boomCompression * smooth(pTe),
      hardware: { drum: { r: rD, l: lD, rCore, bandH: 0 }, doors, booms, spools, tips, roots: booms.map((b) => b.root), gimbalRad: 0.02 * smooth(pTr), vanes: tips.map((t2) => ({ p: t2.p, deflectRad: 0.3 * smooth(pTr) })) }
    };
  }
  const point = pointing({ thrustN: c.thrustN, areaM2: c.areaM2, R: L, offAxisM: o.offAxisM ?? 0, mastLenM: o.mastLenM ?? 0, vaneAreaM2: 0.02 * c.areaM2 }, c.fluxWm2);
  return {
    ...c, N: 4, R: L, side: S, apothem: a, stripL: L, hubR: rD, pack, discretisedAreaM2: c.areaM2,
    booms: { family: fam.kind, lengthM: L, rateMs: fam.rate, EI, kgPerM, massKg: 4 * L * kgPerM, f1Hz: f1, strainEnergyJ: strainJ, eulerN: Pcr, compressionN: boomCompression, bucklingMargin: Pcr / Math.max(boomCompression, 1e-12), deploySeconds: L / fam.rate, source: fam.source },
    spin: null, stages: T_.stages, totalSeconds: T_.totalSeconds, stageAt: T_.stageAt, timeAt: T_.timeAt, rates: { boomMs: fam.rate },
    tension: { Nm: T, sagM: sag0, sagFrac: sag0 / S }, geometry, spinAt: null, pointing: point, canRefold: true, oneShot: false,
    jettison: (j) => ({ separationM: 2 * L * clamp(j, 0, 1), dvMs: 0.5, seconds: (2 * L * clamp(j, 0, 1)) / 0.5, cut: ['hub release nuts'] }),
    retract: 'deployer motors reel the booms back, spool motors re-roll the quadrants as the tips come in; the same path backwards',
    resolution: { pleatsGeo: nGeo, pleatsReal: nReal, gapRealM: FILM.foldGapM },
    source: 'NanoSail-D2 (2011), LightSail 2 (2019), NEA Scout, ACS3 (2024), Solar Cruiser quadrant architecture'
  };
}

/* ================================================================== *
 * starchip-disc: released from the dispenser tray
 * ================================================================== */
function starchipDisc(o, c) {
  const R = Math.sqrt(c.areaM2 / Math.PI);
  const t = c.thicknessM;
  /* the stiff disc: a shallow dish of sag f R rides the beam passively (Manchester & Loeb 2017 use a few percent) */
  const dishFrac = 0.04, dish = dishFrac * R;
  const trayH = Math.max(50 * t, 0.004 * R), trayGap = trayH * 0.6;
  const T_ = stageTable([
    { id: 'stowed', name: 'in the dispenser tray, chip at the centre', frac: 0.2, seconds: 0 },
    { id: 'release', name: 'tray springs away (0.1 m/s)', frac: 0.35, seconds: (4 * R) / 0.1 },
    { id: 'dish', name: 'beam on: the disc takes its dish', frac: 0.3, seconds: 20 },
    { id: 'trim', name: 'riding the beam, vanes trimming', frac: 0.15, seconds: 60 }
  ]);
  const rings = o.pleatCap ? Math.min(o.pleatCap, 24) : 24, sectors = 48;
  const polygonFactor = (sectors * Math.sin(TAU / sectors)) / TAU;   // the 48-gon carries this share of the disc's area
  const pack = { volumeM3: c.areaM2 * t, annulusM3: Math.PI * R * R * trayGap, fits: true, trayHeightM: trayH, layers: 1, note: 'one flat disc per tray slot; the mother ship carries a stack of them' };
  function geometry(k, opts = {}) {
    const kk = clamp(k, 0, 1), st = T_.stageAt(kk);
    const pRel = T_.prog(kk, 'release'), pDish = T_.prog(kk, 'dish');
    const dNow = dish * smooth(pDish);
    const nR = opts.coarse ? 4 : rings, nS = opts.coarse ? 12 : sectors;
    const panels = [];
    const pt = (r, az) => [r * Math.cos(az), dNow * (1 - (r * r) / (R * R)), r * Math.sin(az)];
    for (let i = 0; i < nS; i += 1) {
      const a0 = (i / nS) * TAU, a1 = ((i + 1) / nS) * TAU;
      for (let j = 0; j < nR; j += 1) {
        const r0 = (j / nR) * R, r1 = ((j + 1) / nR) * R;
        const quad = [pt(r0, a0), pt(r0, a1), pt(r1, a1), pt(r1, a0)];
        panels.push({ v: quad, gore: j, pleat: i, seg: 0, area: quadArea(quad), projArea: quadProjArea(quad), wrapped: false });
      }
    }
    const traySep = 4 * R * smooth(pRel);
    const tips = []; for (let i = 0; i < 6; i += 1) { const az = (i / 6) * TAU; tips.push({ p: pt(R * 0.97, az), gore: i }); }
    return {
      k: kk, stage: st, panels, lines: [], tips: tips.map((x) => x.p), filmAreaM2: panels.reduce((s2, p) => s2 + p.area, 0), deployedAreaM2: panels.reduce((s2, p) => s2 + p.projArea, 0),
      extensionM: traySep, theta: Math.PI / 2, pleatOpen: 1, sagM: dNow, inertia: null, tensionN: 0,
      hardware: { tray: { R: R * 1.06, h: trayH, gap: trayGap, y: -trayGap - traySep, present: pRel < 0.999 }, doors: [], tips, roots: [], gimbalRad: 0, vanes: tips.map((x) => ({ p: x.p, deflectRad: 0.3 * smooth(T_.prog(kk, 'trim')) })) }
    };
  }
  const point = pointing({ thrustN: c.thrustN, areaM2: c.areaM2, R, offAxisM: o.offAxisM ?? 0, mastLenM: 0, vaneAreaM2: 0.02 * c.areaM2 }, c.fluxWm2);
  return {
    ...c, N: 1, R, side: 2 * R, apothem: R, stripL: 0, hubR: 0, pack, spin: null, dish: { frac: dishFrac, sagM: dish }, discretisedAreaM2: c.areaM2 * polygonFactor, stages: T_.stages, totalSeconds: T_.totalSeconds, stageAt: T_.stageAt, timeAt: T_.timeAt, rates: { releaseMs: 0.1 },
    geometry, spinAt: null, pointing: point, canRefold: false, oneShot: true,
    jettison: () => ({ separationM: 0, dvMs: 0, seconds: 0, cut: [], note: 'nothing to cut: the chip is the sail' }),
    retract: 'cannot restow: the disc is released, not deployed, and the tray is on the mother ship',
    resolution: { rings, sectors }, source: 'Breakthrough Starshot (Lubin 2016; Parkin 2018); Manchester & Loeb 2017 beam-riding dish'
  };
}

/* ------------------------------------------------------------------ *
 * From a measured class to its mechanism, at true size and at the drawn size
 * ------------------------------------------------------------------ */

/** The side the viewer draws a film at: true size while legible, otherwise 3 hull spans (never under 5 m). */
export function drawnSideFor(trueSide, hullSpan) { return Math.min(trueSide, Math.max(3 * hullSpan, 5)); }

/** The hull's span without its sail hardware, from the solved node envelopes (what the viewer frames). */
export function hullSpanOf(m) {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const n of m.solved.nodes) {
    if (['sail', 'mast'].includes(n.part.kind)) continue;
    const p = n.world.position, r = (n.part.dims?.d ?? 0) / 2, l = n.part.dims?.l ?? 0;
    const y0 = n.part.origin === 'centre' ? p[1] - l / 2 : p[1], y1 = y0 + l;
    lo = [Math.min(lo[0], p[0] - r), Math.min(lo[1], y0), Math.min(lo[2], p[2] - r)];
    hi = [Math.max(hi[0], p[0] + r), Math.max(hi[1], y1), Math.max(hi[2], p[2] + r)];
  }
  return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-3);
}

/**
 * Build the mechanism for a `measure()` result. `true` is the real sail on the real canister: its
 * numbers are the ones to print and test. `drawn` is the same mechanism with the film area scaled to
 * the drawn side (the true drum, a fold gap that fills it, a capped pleat count), which is what the
 * mesh draws and what the geometric checks run on -- a 555 km film wraps its drum ten thousand times,
 * which no geometry model needs to resolve to be checked. `m.cls.base` or the id picks the architecture
 * unless `architecture` overrides it.
 */
export function mechanismsFor(m, { architecture = null, hullSpan = null, pleatCap = 48, segCap = 160 } = {}) {
  if (!m?.sail?.sail) return null;
  const base = m.cls.base ?? m.cls.id;
  const areaM2 = m.sail.sail.areaM2, filmKg = m.sail.mass;
  const choice = architectureFor(base, { areaM2, filmKg });
  const arch = architecture ?? choice.id;
  const can = m.solved.nodes.find((n) => n.part.kind === 'sail-canister');
  /* v1/v2 have no canister part: the drum is derived once from the TRUE film (sailCanisterSpec) and drawn, not counted */
  const drum = can ? { d: can.part.dims.d, l: can.part.dims.l, mass: can.part.mass } : (() => { const cs = sailCanisterSpec({ filmKg }); return { d: cs.dims.d, l: cs.dims.l, mass: cs.mass, derived: true }; })();
  /* a hub-mounted chip rides at the centre of its disc: the film starts at the chip's edge */
  const hubNode = m.geometry.hubbed ? m.solved.nodes.find((n) => n.part.kind === 'payload') : null;
  const common = { architecture: arch, filmKg, drum, shipKg: m.massKg - filmKg, deliveredW: m.powerW, offAxisM: m.geometry.offAxisM, mastLenM: m.geometry.mastLenM, pleatCap, segCap, hubR: hubNode ? hubNode.part.dims.d * 0.6 : undefined };
  const trueMech = sailMechanism({ ...common, areaM2 });
  const trueSide = Math.sqrt(areaM2);
  const span = hullSpan ?? hullSpanOf(m);
  const drawnSide = drawnSideFor(trueSide, span);
  const ratio = trueSide / drawnSide;
  /* the drawn film keeps the true flux and the true areal density, so its sag fraction, spin rate law and stages match */
  const r2 = ratio * ratio;
  const drawnMech = ratio > 1.001 ? sailMechanism({ ...common, areaM2: areaM2 / r2, filmKg: filmKg / r2, shipKg: common.shipKg / r2, deliveredW: common.deliveredW / r2, offAxisM: common.offAxisM / ratio, mastLenM: common.mastLenM / ratio, fillDrum: true }) : trueMech;
  return { architecture: arch, choice, true: trueMech, drawn: drawnMech, ratio, trueSide, drawnSide };
}

/* ------------------------------------------------------------------ *
 * Geometry checks the tests (and a caller) can run on any geometry
 * ------------------------------------------------------------------ */

/** Triangle-triangle intersection with a tolerance `eps` (a length); shared edges and vertices do not count,
 *  and a crossing has to reach `eps` inside the other face to count, so touching layers are not intersections. */
export function trianglesIntersect(A, B, eps = 1e-9) {
  /* quick reject: any shared vertex -> treat as adjacent */
  for (const p of A) for (const q of B) if (dist(p, q) < eps) return false;
  /* segment of one against the plane/face of the other, both ways */
  const hit = (tri, seg) => {
    const [p0, p1, p2] = tri;
    const e1 = sub(p1, p0), e2 = sub(p2, p0), n = cross(e1, e2);
    const nl = Math.hypot(...n); if (nl < eps * eps) return false;
    const d = sub(seg[1], seg[0]), dl = Math.hypot(...d); if (dl < eps) return false;
    const denom = dot(n, d);
    if (Math.abs(denom) < 1e-9 * nl * dl) return false;     // parallel to the face
    const tt = dot(n, sub(p0, seg[0])) / denom;
    if (tt * dl < eps || (1 - tt) * dl < eps) return false;  // the crossing is at the segment's end: touching
    const x = add(seg[0], scale(d, tt));
    /* barycentric inside test, with the margin in length units */
    const v0 = e2, v1 = e1, v2 = sub(x, p0);
    const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1);
    const den = d00 * d11 - d01 * d01; if (Math.abs(den) < 1e-30) return false;
    const u = (d11 * d20 - d01 * d21) / den, v = (d00 * d21 - d01 * d20) / den;
    const tol = eps / Math.max(Math.sqrt(d00), Math.sqrt(d11), eps);
    return u > tol && v > tol && u + v < 1 - tol;
  };
  const segs = (T) => [[T[0], T[1]], [T[1], T[2]], [T[2], T[0]]];
  for (const s of segs(A)) if (hit(B, s)) return true;
  for (const s of segs(B)) if (hit(A, s)) return true;
  return false;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Count intersecting panel pairs in a geometry (quads as two triangles). Adjacent pleats share an edge and are skipped. */
export function selfIntersections(geo, { eps = null, limit = 1 } = {}) {
  const tris = [];
  geo.panels.forEach((p, idx) => { const [a, b, c, d] = p.v; tris.push({ t: [a, b, c], p, idx }); tris.push({ t: [a, c, d], p, idx }); });
  const bbox = (t) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const q of t) for (let i = 0; i < 3; i += 1) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } return { lo, hi }; };
  const boxes = tris.map((x) => bbox(x.t));
  /* spatial hash on the boxes: a wrapped film is thousands of thin quads, and only neighbours can touch */
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const mean = [0, 0, 0];
  for (const b of boxes) for (let i = 0; i < 3; i += 1) { lo[i] = Math.min(lo[i], b.lo[i]); hi[i] = Math.max(hi[i], b.hi[i]); mean[i] += b.hi[i] - b.lo[i]; }
  /* the tolerance is a millionth of the film's span unless given: touching layers are not crossings */
  if (eps == null) eps = 1e-6 * Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-9);
  /* per-axis cells: a wrapped band is tall along the drum and thin across it */
  const cell = mean.map((s, i) => Math.max((s / boxes.length) * 2, (hi[i] - lo[i]) / 4096, 1e-12));
  const grid = new Map();
  const key = (x, y, z) => `${x}|${y}|${z}`;
  const cellsOf = (b) => { const c0 = b.lo.map((v, i) => Math.floor((v - lo[i]) / cell[i])), c1 = b.hi.map((v, i) => Math.floor((v - lo[i]) / cell[i])); const out = []; for (let x = c0[0]; x <= c1[0]; x += 1) for (let y = c0[1]; y <= c1[1]; y += 1) for (let z = c0[2]; z <= c1[2]; z += 1) out.push(key(x, y, z)); return out; };
  let hits = 0;
  const found = [];
  for (let i = 0; i < tris.length; i += 1) {
    const A = tris[i], ba = boxes[i], seen = new Set();
    for (const ck of cellsOf(ba)) {
      const list = grid.get(ck);
      if (list) for (const j of list) {
        if (seen.has(j)) continue; seen.add(j);
        const B = tris[j];
        if (A.idx === B.idx) continue;
        if (A.p.gore === B.p.gore && Math.abs(A.p.pleat - B.p.pleat) <= 1 && Math.abs(A.p.seg - B.p.seg) <= 1) continue;
        const bb = boxes[j];
        if (ba.lo[0] > bb.hi[0] + eps || bb.lo[0] > ba.hi[0] + eps || ba.lo[1] > bb.hi[1] + eps || bb.lo[1] > ba.hi[1] + eps || ba.lo[2] > bb.hi[2] + eps || bb.lo[2] > ba.hi[2] + eps) continue;
        if (trianglesIntersect(A.t, B.t, eps)) { hits += 1; found.push([A.idx, B.idx]); if (hits >= limit) return { hits, found }; }
      }
      if (!list) grid.set(ck, [i]); else list.push(i);
    }
  }
  return { hits, found };
}

/** Fold-line closure: adjacent pleats (same gore, pleat j and j+1, same segment) share a whole edge,
 *  i.e. two of their vertices coincide. `worst` is the largest gap on any shared edge. */
export function foldClosure(geo, eps = null) {
  let worst = 0, checked = 0, span = 0;
  const byKey = new Map();
  for (const p of geo.panels) { byKey.set(`${p.gore}|${p.pleat}|${p.seg}`, p); for (const v of p.v) span = Math.max(span, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])); }
  for (const p of geo.panels) {
    const q = byKey.get(`${p.gore}|${p.pleat + 1}|${p.seg}`);
    if (!q) continue;
    if (p.uv && q.uv) {
      /* a corner of p on its upper fold line (v = v1) must be the same point as q's corner at the same (u, v) */
      const v1 = p.vFold[1];
      p.uv.forEach((uv, ci) => {
        if (Math.abs(uv[1] - v1) > 1e-12 * Math.max(1, Math.abs(v1))) return;
        const cj = q.uv.findIndex((w) => Math.abs(w[0] - uv[0]) <= 1e-12 * Math.max(1, uv[0]) && Math.abs(w[1] - uv[1]) <= 1e-12 * Math.max(1, Math.abs(uv[1])));
        if (cj < 0) return;
        worst = Math.max(worst, dist(p.v[ci], q.v[cj])); checked += 1;
      });
    } else {
      const best = p.v.map((a) => Math.min(...q.v.map((b) => dist(a, b)))).sort((x, y) => x - y);
      worst = Math.max(worst, best[1]); checked += 1;
    }
  }
  if (eps == null) eps = 1e-9 * Math.max(span, 1e-9);
  return { worst, checked, ok: worst <= eps };
}

/** Nothing floats outside the canister: every wrapped panel is inside the drum (radius and length), and
 *  no panel is ever below the drum bottom or inside its core spool. */
export function insideDrum(geo, drum, eps = 1e-9) {
  let worstR = 0, worstY = 0, worstCore = 0;
  for (const p of geo.panels) for (const v of p.v) {
    const r = Math.hypot(v[0], v[2]);
    if (p.wrapped) { worstR = Math.max(worstR, r - drum.r); worstY = Math.max(worstY, -drum.l - v[1], v[1]); }
    else worstY = Math.max(worstY, -drum.l - v[1]);
    if (v[1] < -eps && drum.rCore) worstCore = Math.max(worstCore, drum.rCore - r);
  }
  return { worstR, worstY, worstCore, ok: worstR <= eps && worstY <= eps && worstCore <= eps };
}

/** A caption's worth of numbers for the readout. */
export function readout(mech, k, opts = {}) {
  const g = mech.geometry(k, opts);
  const sp = mech.spinAt ? mech.spinAt(k) : null;
  return {
    stage: g.stage.id, stageName: g.stage.name, k: g.k, timeS: mech.timeAt(k), totalS: mech.totalSeconds,
    extensionM: g.extensionM, deployedAreaM2: g.deployedAreaM2, areaM2: mech.areaM2, tensionN: g.tensionN, boomCompressionN: g.boomCompressionN ?? null,
    rpm: sp?.rpm ?? null, sagM: g.sagM, pleatOpen: g.pleatOpen, lines: g.lines.map((l) => ({ id: l.id, state: l.state })), canRefold: mech.canRefold
  };
}
