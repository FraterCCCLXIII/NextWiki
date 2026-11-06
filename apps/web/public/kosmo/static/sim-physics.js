// sim-physics.js -- pure physics for contraption-sim.html. No Three.js, no DOM.
// Vectors are plain {x, y, z} objects. Everything here runs in node (see tests/run-tests.mjs).
//
// ---------------------------------------------------------------------------
// UNITS AND SCALING
// ---------------------------------------------------------------------------
// The integrators run in "sim units" with mu0/4pi = 1 (K), electron-like q/m = -1
// and g = 9.8 m/s^2 numerically equal to SI. The sim units map to SI through the
// scale factors below (multiply a sim value by the factor to get SI). They are
// derived from the UNITS block, not typed in, so they stay mutually consistent.
//
//   quantity        SI unit   factor (sim -> SI)                     value
//   length          m         L0 (chosen)                            1
//   time            s         T0 (chosen; makes g_sim = g_SI)        1
//   current         A         I0 (chosen, wire current)             1
//   charge          C         Q0 = I0*T0                             1
//   B field         T         B0 = N_TURNS*(mu0/4pi)*I0/L0           1e-4   (N_TURNS = 1000)
//   mass            kg        M0 = B0*Q0*T0                          1e-4
//   force           N         M0*L0/T0^2                             1e-4
//   energy, torque  J, N m    M0*L0^2/T0^2                           1e-4
//   power           W         M0*L0^2/T0^3                           1e-4
//   E field         V/m       B0*L0/T0                               1e-4
//   dipole moment   A m^2     I0*L0^2                                1
//   resistance      ohm       power/I0^2                             1e-4
//   particle q/m    C/kg      Q0/M0 = 1/(B0*T0)                      1e4  (sim value -1)
//
// Each coil ring is a bundle of N_TURNS = 1000 series turns carrying the wire
// current I, so the Biot-Savart sum uses K*I in sim units and the SI field is
// B0 * B_sim. That is how a 1.5 A, 1.2 m ring gives about 0.8 mT at its centre.
// The particles are drawn as electrons but are scaled test charges: q/m = 1e4 C/kg,
// which is 1.76e7 times smaller than a real electron, so gyro-radii fit the scene
// (a real electron in 1 mT gyrates at 1.8e8 rad/s). Particle energies are
// reported per kilogram (J/kg), because the particle mass is not a physical input.
// The ion-wind (ionic) setup and the xenon engine run directly in SI (see EAD below).

import { BODIES, CONST } from './worlds.js';

export const UNITS = {
  mu0: 1.25663706212e-6,        // N/A^2 (CODATA 2018)
  e: 1.602176634e-19,           // C
  m_e: 9.1093837015e-31,        // kg
  u: 1.66053906660e-27,         // kg, atomic mass unit
  g0: CONST.G0,                 // m/s^2 (worlds.js)
  ionName: 'Xe-131',
  ionMassU: 130.905082,         // u, xenon-131
  get ionMass() { return this.ionMassU * this.u; },   // kg
};

export const N_TURNS = 1000;
const L0 = 1, T0 = 1, I0 = 1;
const B0 = N_TURNS * (UNITS.mu0 / (4 * Math.PI)) * I0 / L0;
const Q0 = I0 * T0;
const M0 = B0 * Q0 * T0;
export const SCALE = {
  length: L0, time: T0, current: I0, charge: Q0, field: B0, mass: M0,
  velocity: L0 / T0, accel: L0 / (T0 * T0), omega: 1 / T0,
  force: M0 * L0 / (T0 * T0), energy: M0 * L0 * L0 / (T0 * T0), torque: M0 * L0 * L0 / (T0 * T0),
  power: M0 * L0 * L0 / (T0 ** 3), efield: B0 * L0 / T0, moment: I0 * L0 * L0,
  resistance: (M0 * L0 * L0 / (T0 ** 3)) / (I0 * I0),
  energyPerMass: (L0 / T0) ** 2,     // J/kg, for the per-unit-mass particle energies
  momentum: M0 * L0 / T0,
};
export const QM_SI = Q0 / M0;                       // C/kg magnitude of the sim particle q/m
export const QM_RATIO_TO_ELECTRON = (UNITS.e / UNITS.m_e) / QM_SI;

export function toSI(kind, x) {
  const s = SCALE[kind];
  if (s === undefined) throw new Error('unknown unit kind ' + kind);
  return x * s;
}
export function fromSI(kind, x) { return x / SCALE[kind]; }

// Format an SI value with a prefix, e.g. fmtSI(0.00081, 'T') -> "810 uT" (with a real micro sign).
export function fmtSI(x, unit, digits = 3) {
  if (!Number.isFinite(x)) return `${x} ${unit}`;
  if (x === 0) return `0 ${unit}`;
  const table = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  const ax = Math.abs(x);
  for (const [s, p] of table) {
    if (ax >= s * 0.9995) {
      const t = (x / s).toPrecision(digits);
      return `${t.includes('e') ? String(Number(t)) : t} ${p}${unit}`;
    }
  }
  return `${x.toExponential(digits - 1)} ${unit}`;
}

// ---------------------------------------------------------------------------
// constants (sim units)
// ---------------------------------------------------------------------------
export const SEG = 48;           // segments per coil ring
export const K = 1;              // scaled mu0/4pi (times N_TURNS in SI via SCALE.field)
export const SOFT = 0.12;        // softening so B stays finite near a wire
export const DT = 1 / 240;       // fixed physics step
export const FLOOR = -4;         // bounce floor (world y)
export const QM = -1;            // particle charge / mass (scaled)
export const VMAX = 10;          // particle speed clamp
export const D = 0.8;            // gyro centre-of-mass offset along its axis
export const MOTOR_I = 0.1;      // rotor moment of inertia
export const DETENT_K = 0.5;
export const WHEEL_MGD_PER_G = 0.02;
export const PAYLOAD_MASS = 1;
export const FALL_START = { a: 3.0, b: 1.5 };
export const FALL_SOFT = 0.6;
export const LEVIT_FLOOR = -1.6;
export const ION_GAP = 2.4, ION_X0 = -1.2, ION_X1 = 1.2, IONS_MAX = 400;
export const GYRO_LM_PER_SPIN = 0.2;

// ---------------------------------------------------------------------------
// coil rings
// ---------------------------------------------------------------------------
// Ring config: R, orbitR (orbit radius about Y, 0 = fixed), yOff, phase, tilt (plane tilt),
// yaw (extra yaw), orbitMult (0 or 1), sign (polarity), elec (electrical phase for 3-phase coils).
export const RING_SETUPS = {
  orbit: () => [0, 1, 2, 3].map(i => ({
    R: 1.2, orbitR: 2.5, yOff: 0, phase: i * Math.PI / 2,
    tilt: [0.3, 1.2, 0.8, 1.57][i], orbitMult: 1, sign: i % 2 ? -1 : 1,
  })),
  bottle: () => [
    { R: 1.4, orbitR: 0, yOff: -1.3, phase: 0, tilt: Math.PI / 2, orbitMult: 0, sign: 1 },
    { R: 1.4, orbitR: 0, yOff: 1.3, phase: 0, tilt: Math.PI / 2, orbitMult: 0, sign: 1 },
  ],
  // Three stator coils 120 degrees apart. Each plane contains the motor axis (Y), so the
  // coil normal is tangential and its field at the centre points tangentially.
  // Group yaw = phase + yaw = -phase, so each coil's normal is the tangent at its position.
  motor: () => [0, 1, 2].map(k => ({
    R: 1.0, orbitR: 2.2, yOff: 0, phase: k * 2 * Math.PI / 3,
    tilt: 0, yaw: -2 * k * 2 * Math.PI / 3, orbitMult: 0, sign: 1, elec: -k * 2 * Math.PI / 3,
  })),
  carr: () => Array.from({ length: 12 }, (_, k) => {
    const phi = k * Math.PI / 6;
    return { R: 0.08, orbitR: 0.52, yOff: 0, phase: phi, tilt: 0, yaw: Math.PI / 2 - 2 * phi,
             orbitMult: 0, sign: 1, gain: 1, idx: k, tube: 0.015 };
  }),
  ffall: () => [],
  ionic: () => [],
  xenon: () => [],
  cosmo: () => [],
  levit: () => [{ R: 1.0, orbitR: 0, yOff: -2.0, phase: 0, tilt: Math.PI / 2, orbitMult: 0, sign: 1 }],
  'perp-wheel': () => [],
  'perp-detent': () => [],
  'perp-coil': () => RING_SETUPS.motor(),
  gyro: () => [
    { R: 2.8, orbitR: 0, yOff: -1.4, phase: 0, tilt: Math.PI / 2, orbitMult: 0, sign: 1 },
    { R: 2.8, orbitR: 0, yOff: 1.4, phase: 0, tilt: Math.PI / 2, orbitMult: 0, sign: 1 },
  ],
};

// A ring is represented by SEG current elements. Each element sits at the arc
// midpoint (on the circle) with vector length R*dtheta along the tangent (midpoint
// rule on the true circle). On-axis this is exact to rounding; the old chord
// version had a +0.36% bias at the ring centre.
export function makeRing(cfg, seg = SEG) {
  const lm = new Float64Array(seg * 3), ld = new Float64Array(seg * 3);
  const dth = 2 * Math.PI / seg;
  for (let k = 0; k < seg; k++) {
    const a = (k + 0.5) * dth;
    lm[3 * k] = cfg.R * Math.cos(a); lm[3 * k + 1] = cfg.R * Math.sin(a); lm[3 * k + 2] = 0;
    ld[3 * k] = -cfg.R * dth * Math.sin(a); ld[3 * k + 1] = cfg.R * dth * Math.cos(a); ld[3 * k + 2] = 0;
  }
  return {
    ...cfg, seg, localMid: lm, localDl: ld,
    mid: new Float64Array(seg * 3), dl: new Float64Array(seg * 3),
    current: 0, th: 0, pos: { x: 0, y: 0, z: 0 },
  };
}

export function buildRingSet(name) { return RING_SETUPS[name]().map(c => makeRing(c)); }

// Pose a ring at time t. Group rotation is Euler 'YXZ' (tilt about X, then yaw about Y),
// i.e. R = Ry(th + yaw) * Rx(tilt), the same convention as three.js.
// p: { orbit, current, alternate, drive, psi } where psi (if not null) is the rotor angle
// the self-sensing drive follows instead of a clock.
export function poseRing(r, t, p) {
  const th = r.phase + p.orbit * r.orbitMult * t;
  r.th = th;
  r.pos.x = r.orbitR * Math.cos(th); r.pos.y = r.yOff; r.pos.z = r.orbitR * Math.sin(th);
  const ay = th + (r.yaw || 0), ax = r.tilt;
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
  const lm = r.localMid, ld = r.localDl, m = r.mid, d = r.dl;
  for (let i = 0; i < lm.length; i += 3) {
    for (let pass = 0; pass < 2; pass++) {
      const s = pass ? ld : lm, o = pass ? d : m;
      const x = s[i], y = s[i + 1] * cx - s[i + 2] * sx, z = s[i + 1] * sx + s[i + 2] * cx;   // Rx
      o[i] = x * cy + z * sy;                                                                  // Ry
      o[i + 1] = y;
      o[i + 2] = -x * sy + z * cy;
    }
    m[i] += r.pos.x; m[i + 1] += r.pos.y; m[i + 2] += r.pos.z;
  }
  if (r.elec !== undefined) {
    const phase = p.psi !== null && p.psi !== undefined ? p.psi : p.drive * t;
    r.current = p.current * Math.sin(phase - r.elec);
  } else {
    r.current = p.current * (p.alternate ? r.sign : 1);
  }
  if (r.gain !== undefined) r.current *= r.gain;   // per-coil control (Carr bench)
}
export function poseRings(rings, t, p) { for (const r of rings) poseRing(r, t, p); }

// Biot-Savart: B(p) = K * sum I * dl x (p - x) / |p - x|^3 (softened).
export function fieldAt(rings, x, y, z, out, soft = SOFT) {
  let bx = 0, by = 0, bz = 0;
  const s2 = soft * soft;
  for (const r of rings) {
    const c = K * r.current;
    if (c === 0) continue;
    const m = r.mid, d = r.dl;
    for (let i = 0; i < m.length; i += 3) {
      const rx = x - m[i], ry = y - m[i + 1], rz = z - m[i + 2];
      const r2 = rx * rx + ry * ry + rz * rz + s2;
      const f = c / (r2 * Math.sqrt(r2));
      const dx = d[i], dy = d[i + 1], dz = d[i + 2];
      bx += (dy * rz - dz * ry) * f;
      by += (dz * rx - dx * rz) * f;
      bz += (dx * ry - dy * rx) * f;
    }
  }
  out.x = bx; out.y = by; out.z = bz;
  return out;
}

export function heatRate(rings) {   // coil I^2 R with R = 1 (sim), W in sim units
  let h = 0;
  for (const r of rings) h += r.current * r.current;
  return h;
}

// ---------------------------------------------------------------------------
// charged particles (Boris pusher), per unit mass
// ---------------------------------------------------------------------------
// env: { field(x,y,z,out), E:{x,y,z}, G:{x,y,z}, qm, accel(x,y,z,out), vmax, floor, restitution }
// p.vel is the leapfrog half-step velocity. p.vPrev is the previous one; their mean is the
// p.vSync is the Boris velocity synchronised with p.posPrev (the position before the last drift,
// the x_n the kick used): v_n = v_(n-1/2) + half E/g kick, whose norm the magnetic rotation
// preserves. The energy is 1/2|vSync|^2 + U(posPrev). p.diss collects energy removed
// by the speed clamp and the floor bounce.
const _B = { x: 0, y: 0, z: 0 }, _A = { x: 0, y: 0, z: 0 };

export function makeParticle(pos, vel) {
  return { pos: { ...pos }, posPrev: { ...pos }, vel: { ...vel }, vPrev: { ...vel }, vSync: { ...vel }, e0: 0, diss: 0 };
}

export function particleEnergy(p, env) {
  const qm = env.qm === undefined ? QM : env.qm;
  const vx = p.vSync.x, vy = p.vSync.y, vz = p.vSync.z;
  const ax = qm * env.E.x + env.G.x, ay = qm * env.E.y + env.G.y, az = qm * env.E.z + env.G.z;
  return 0.5 * (vx * vx + vy * vy + vz * vz) - (ax * p.posPrev.x + ay * p.posPrev.y + az * p.posPrev.z);
}

// Zero the energy books. The baseline is taken after the next step, once vSync is defined
// (a freshly spawned velocity is v at t = 0, not the half-step velocity the leapfrog wants).
export function rebaselineParticle(p, env) { p.needBase = true; p.e0 = particleEnergy(p, env); p.diss = 0; }

export function stepParticle(p, dt, env) {
  const qm = env.qm === undefined ? QM : env.qm;
  const vmax = env.vmax === undefined ? VMAX : env.vmax;
  const floor = env.floor === undefined ? FLOOR : env.floor;
  const rest = env.restitution === undefined ? 0.5 : env.restitution;
  const { pos, vel } = p;
  const h = 0.5 * dt;
  env.field(pos.x, pos.y, pos.z, _B);
  let ax = qm * env.E.x + env.G.x, ay = qm * env.E.y + env.G.y, az = qm * env.E.z + env.G.z;
  if (env.accel) {
    env.accel(pos.x, pos.y, pos.z, _A);
    ax += _A.x; ay += _A.y; az += _A.z;
  }
  p.vPrev.x = vel.x; p.vPrev.y = vel.y; p.vPrev.z = vel.z;
  // half kick
  const mx = vel.x + ax * h, my = vel.y + ay * h, mz = vel.z + az * h;
  p.vSync.x = mx; p.vSync.y = my; p.vSync.z = mz;
  // rotation
  const tx = qm * h * _B.x, ty = qm * h * _B.y, tz = qm * h * _B.z;
  const s = 2 / (1 + tx * tx + ty * ty + tz * tz);
  const px = mx + (my * tz - mz * ty), py = my + (mz * tx - mx * tz), pz = mz + (mx * ty - my * tx);
  const rx = mx + (py * tz - pz * ty) * s, ry = my + (pz * tx - px * tz) * s, rz = mz + (px * ty - py * tx) * s;
  // half kick
  vel.x = rx + ax * h; vel.y = ry + ay * h; vel.z = rz + az * h;

  const sp = Math.hypot(vel.x, vel.y, vel.z);
  if (sp > vmax) {
    const eB = particleEnergy(p, env);
    const k = vmax / sp;
    vel.x *= k; vel.y *= k; vel.z *= k;
    p.vPrev.x = vel.x; p.vPrev.y = vel.y; p.vPrev.z = vel.z;
    p.vSync.x = vel.x; p.vSync.y = vel.y; p.vSync.z = vel.z;
    p.diss += eB - particleEnergy(p, env);
  }
  p.posPrev.x = pos.x; p.posPrev.y = pos.y; p.posPrev.z = pos.z;
  pos.x += vel.x * dt; pos.y += vel.y * dt; pos.z += vel.z * dt;
  if (pos.y < floor) {
    const eB = particleEnergy(p, env);
    pos.y = floor;
    p.posPrev.x = pos.x; p.posPrev.y = pos.y; p.posPrev.z = pos.z;
    vel.y = -vel.y * rest;
    p.vPrev.x = vel.x; p.vPrev.y = vel.y; p.vPrev.z = vel.z;
    p.vSync.x = vel.x; p.vSync.y = vel.y; p.vSync.z = vel.z;
    p.diss += eB - particleEnergy(p, env);
  }
  if (p.needBase) { p.needBase = false; p.e0 = particleEnergy(p, env); p.diss = 0; }
}

// Energy accounting for a set of particles. drift = max over particles of
// |E + dissipated - E0|, E = KE + potential (E field and gravity), in J/kg (sim = SI here).
// tol = tolRel * (largest KE + |potential change| over the set, at least 1).
export function particleEnergyCheck(particles, env, tolRel = 1e-2) {
  let drift = 0, scale = 1;
  for (const p of particles) {
    const e = particleEnergy(p, env);
    drift = Math.max(drift, Math.abs(e + p.diss - p.e0));
    const ke = 0.5 * (p.vel.x ** 2 + p.vel.y ** 2 + p.vel.z ** 2);
    scale = Math.max(scale, ke + Math.abs(e - ke));
  }
  const tol = tolRel * scale;
  return { drift, tol, scale, ok: drift <= tol };
}

// ---------------------------------------------------------------------------
// gyroscope (fast-top approximation)
// ---------------------------------------------------------------------------
// L = Lm*a, dL/dt = tau = a x W with W = D*G + mu*B(0). That is a rotation of a about W at
// rate |W|/Lm, so it is integrated exactly (Rodrigues). The conserved quantity is
// U = -(D*G + mu*B).a  (gravity of the centre of mass at D*a plus the dipole energy).
export function makeGyro() { return { a: { x: Math.sin(0.5), y: 0, z: Math.cos(0.5) }, precession: 0, W: { x: 0, y: 0, z: 0 } }; }

export function stepGyro(gy, rings, dt, p /* {G, mu, spin} */) {
  fieldAt(rings, 0, 0, 0, _B);
  const Wx = D * p.G.x + p.mu * _B.x, Wy = D * p.G.y + p.mu * _B.y, Wz = D * p.G.z + p.mu * _B.z;
  gy.W.x = Wx; gy.W.y = Wy; gy.W.z = Wz;
  const Lm = GYRO_LM_PER_SPIN * p.spin;
  const a = gy.a;
  // tau = a x W
  const tx = a.y * Wz - a.z * Wy, ty = a.z * Wx - a.x * Wz, tz = a.x * Wy - a.y * Wx;
  gy.precession = Math.hypot(tx, ty, tz) / Lm;
  const wn = Math.hypot(Wx, Wy, Wz);
  if (wn === 0) return;
  const kx = -Wx / wn, ky = -Wy / wn, kz = -Wz / wn;   // rotation axis (adot = -W/Lm x a)
  const phi = wn * dt / Lm, c = Math.cos(phi), s = Math.sin(phi);
  const kd = kx * a.x + ky * a.y + kz * a.z;
  const cx = ky * a.z - kz * a.y, cy = kz * a.x - kx * a.z, cz = kx * a.y - ky * a.x;   // k x a
  a.x = a.x * c + cx * s + kx * kd * (1 - c);
  a.y = a.y * c + cy * s + ky * kd * (1 - c);
  a.z = a.z * c + cz * s + kz * kd * (1 - c);
  const n = Math.hypot(a.x, a.y, a.z); a.x /= n; a.y /= n; a.z /= n;   // guards rounding only
}
export function gyroEnergy(gy) { return -(gy.W.x * gy.a.x + gy.W.y * gy.a.y + gy.W.z * gy.a.z); }

// ---------------------------------------------------------------------------
// rotor models: motor, overbalanced wheel, detent
// ---------------------------------------------------------------------------
// Friction is applied as an exact exponential decay in two half-steps; the energy it
// removes is added to rotor.loss. Torques are applied as kicks; for the coil-driven motor
// the work of each kick (torque * mean omega * dt) is added to rotor.work.
export function makeRotor(psi = 0) { return { psi, omega: 0, work: 0, loss: 0, heat: 0 }; }

function damp(rotor, f, dt) {
  const w0 = rotor.omega;
  rotor.omega = w0 * Math.exp(-f * dt / MOTOR_I);
  rotor.loss += 0.5 * MOTOR_I * (w0 * w0 - rotor.omega * rotor.omega);
}

export function motorTorque(rotor, rings, rotorMu) {
  const mx = rotorMu * Math.cos(rotor.psi), mz = -rotorMu * Math.sin(rotor.psi);   // dipole in XZ plane
  fieldAt(rings, 0, 0, 0, _B);
  return mz * _B.x - mx * _B.z;   // (m x B).y
}

export function stepMotor(rotor, rings, dt, p /* {rotorMu, friction} */) {
  rotor.heat += heatRate(rings) * dt;
  const tau = motorTorque(rotor, rings, p.rotorMu);
  damp(rotor, p.friction, dt / 2);
  const w0 = rotor.omega;
  rotor.omega += tau / MOTOR_I * dt;
  rotor.work += tau * 0.5 * (w0 + rotor.omega) * dt;
  damp(rotor, p.friction, dt / 2);
  rotor.psi += rotor.omega * dt;
}

function stepConservative(rotor, dt, f, torque) {   // damp/2, kick/2, drift, kick/2, damp/2
  damp(rotor, f, dt / 2);
  rotor.omega += torque(rotor.psi) / MOTOR_I * dt / 2;
  rotor.psi += rotor.omega * dt;
  rotor.omega += torque(rotor.psi) / MOTOR_I * dt / 2;
  damp(rotor, f, dt / 2);
}
// Weight at radius d: torque -m g d cos(psi), potential U = m g d sin(psi).
export function stepWheel(rotor, dt, p /* {g, friction} */) {
  const mgd = p.g * WHEEL_MGD_PER_G;
  stepConservative(rotor, dt, p.friction, psi => -mgd * Math.cos(psi));
}
// Potential U = -K cos(2 psi), torque -2K sin(2 psi).
export function stepDetent(rotor, dt, p /* {friction} */) {
  stepConservative(rotor, dt, p.friction, psi => -2 * DETENT_K * Math.sin(2 * psi));
}

export function rotorPotential(kind, rotor, p /* {g} */) {
  if (kind === 'perp-wheel') return p.g * WHEEL_MGD_PER_G * Math.sin(rotor.psi);
  if (kind === 'perp-detent') return -DETENT_K * Math.cos(2 * rotor.psi);
  return 0;
}
// KE + PE + friction loss - work from coils. Constant if the books balance.
export function rotorEnergyBooks(kind, rotor, p) {
  const ke = 0.5 * MOTOR_I * rotor.omega * rotor.omega;
  const pe = rotorPotential(kind, rotor, p);
  return { ke, pe, check: ke + pe + rotor.loss - rotor.work };
}
// Characteristic energy for a relative tolerance: potential swing, or total flows for the motor.
export function rotorEnergyScale(kind, rotor, p) {
  if (kind === 'perp-wheel') return 2 * p.g * WHEEL_MGD_PER_G;
  if (kind === 'perp-detent') return 2 * DETENT_K;
  return 0.5 * MOTOR_I * rotor.omega ** 2 + Math.abs(rotor.work) + rotor.loss;
}

// ---------------------------------------------------------------------------
// levitation test rig: diamagnet, F = -k d(B^2)/dy, U_m = k B^2
// ---------------------------------------------------------------------------
export function makePayload() { return { y: 2, v: 0, heat: 0, loss: 0 }; }

export function magForceY(rings, y, kLift) {
  const h = 0.01;
  fieldAt(rings, 0, y + h, 0, _B);
  const up = _B.x * _B.x + _B.y * _B.y + _B.z * _B.z;
  fieldAt(rings, 0, y - h, 0, _B);
  const down = _B.x * _B.x + _B.y * _B.y + _B.z * _B.z;
  return -kLift * (up - down) / (2 * h);
}

export function stepLevit(pl, rings, dt, p /* {g, eta, kLift, friction} */) {
  const weight = PAYLOAD_MASS * p.g * (1 - p.eta);
  const drag = 5 * p.friction;   // air drag, so the payload settles into its hover
  const half = Math.exp(-drag * dt / 2);
  const dampHalf = () => {
    const v0 = pl.v; pl.v *= half;
    pl.loss += 0.5 * PAYLOAD_MASS * (v0 * v0 - pl.v * pl.v);
  };
  dampHalf();
  pl.v += (magForceY(rings, pl.y, p.kLift) - weight) / PAYLOAD_MASS * dt / 2;
  pl.y += pl.v * dt;
  pl.v += (magForceY(rings, pl.y, p.kLift) - weight) / PAYLOAD_MASS * dt / 2;
  dampHalf();
  if (pl.y < LEVIT_FLOOR) {   // floor just above the coil: inelastic stop, the energy goes to the floor
    const eB = levitEnergy(pl, rings, p).total - pl.loss;
    pl.y = LEVIT_FLOOR;
    pl.v = 0;
    pl.loss += eB - (levitEnergy(pl, rings, p).total - pl.loss);
  }
  pl.heat += heatRate(rings) * dt;
}
export function magEnergy(rings, y, kLift) {
  fieldAt(rings, 0, y, 0, _B);
  return kLift * (_B.x * _B.x + _B.y * _B.y + _B.z * _B.z);
}
// KE + gravity PE + magnetic PE + dissipated (drag, floor). Constant if the books balance.
export function levitEnergy(pl, rings, p) {
  const ke = 0.5 * PAYLOAD_MASS * pl.v * pl.v;
  const pg = PAYLOAD_MASS * p.g * (1 - p.eta) * pl.y;
  const pm = magEnergy(rings, pl.y, p.kLift);
  return { ke, pg, pm, total: ke + pg + pm + pl.loss };
}

// ---------------------------------------------------------------------------
// two magnets falling with a mutual dipole-like force
// ---------------------------------------------------------------------------
// alpha: hypothetical inertial-mass cut for magnet a (gravity unchanged, inertia 1 - alpha).
export function makeFall() {
  return { ya: FALL_START.a, va: 0, yb: FALL_START.b, vb: 0, aA: 0, aB: 0, aCom: 0, aComV: 0, trials: 0 };
}
export function stepFall(f, dt, p /* {g, coupling, repulsive, alpha} */) {
  const g = p.g;
  const r = f.ya - f.yb;
  const dir = Math.sign(r) || 1;
  const M = p.coupling * g / ((r * r + FALL_SOFT * FALL_SOFT) ** 2);
  const sgn = p.repulsive ? -1 : 1;
  const Fa = -sgn * M * dir;   // attraction pulls a down toward b
  const Fb = sgn * M * dir;    // equal and opposite on b
  const mA = 1 - p.alpha;
  f.aA = (-g + Fa) / mA;
  f.aB = -g + Fb;
  f.aCom = (mA * f.aA + f.aB) / (mA + 1);   // external force / total inertial mass, from the forces
  const va0 = f.va, vb0 = f.vb;
  f.va += f.aA * dt;
  f.ya += f.va * dt;
  f.vb += f.aB * dt;
  f.yb += f.vb * dt;
  f.aComV = (mA * (f.va - va0) + (f.vb - vb0)) / (dt * (mA + 1));   // from the integrated velocities
  if (Math.min(f.ya, f.yb) < -3) {   // drop again, as a new trial
    f.ya = FALL_START.a; f.va = 0;
    f.yb = FALL_START.b; f.vb = 0;
    f.trials++;
  }
}

// ---------------------------------------------------------------------------
// ion wind (electroaerodynamic) thruster -- SI
// ---------------------------------------------------------------------------
// Corona onset from Peek's law; current from Townsend's coaxial corona relation
// scaled by a fitted geometry factor g (the one tuned constant, 0.15 makes the
// MIT 2018 preset draw about 500 W); thrust T = I V / (mu E + v), which is the
// textbook T = I d / mu at rest; each stage is an actuator disk so downstream
// stages see faster air. Power books: electrical = jet kinetic + ion-neutral heat.
// Sources are listed in references.md ("Ion wind").
export const EAD = {
  EPS0: 8.854e-12,                 // F/m
  AIR_ION_MASS: 29 * 1.6605e-27,   // kg, air ion
  RHO_SL: CONST.RHO_AIR_SL,        // kg/m^3 at sea level (worlds.js)
  ROW_PITCH: 0.1,                  // m between emitter rows (sets disk area)
  SPARK_FIELD: 1.0e6,              // V/m average field where spark-over is flagged (rough)
  STAGE_MARGIN: 0.06,              // m between a collector and the next emitter
  VIS_IONS_MAX: 600,
};
// slider units: V kV, g -, d cm, r mm, b m, rows -, N -, delta -, mu0 1e-4 m^2/(V s), vinf m/s
export const EAD_PRESETS = {
  mit:    { V: 40, g: 0.15, d: 5,   r: 0.1,  b: 5, rows: 1, N: 4, delta: 1, mu0: 2.0, vinf: 5 },
  lab:    { V: 10, g: 0.15, d: 20,  r: 0.1,  b: 1, rows: 1, N: 1, delta: 1, mu0: 2.0, vinf: 0 },
  lifter: { V: 30, g: 0.15, d: 3.5, r: 0.05, b: 1, rows: 1, N: 1, delta: 1, mu0: 2.0, vinf: 0 },
};
export function eadOnsetField(r, delta) {          // Peek's law, wire of radius r (m)
  const rcm = r * 100;
  return 3.1e6 * delta * (1 + 0.0308 / Math.sqrt(delta * rcm));
}
export function eadOnsetVoltage(r, d, delta) { return eadOnsetField(r, delta) * r * Math.log(d / r); }
export function eadCurrent(V, V0, d, r, mu, L, g) {  // Townsend coaxial corona, scaled by g
  if (V <= V0) return 0;
  return g * 8 * Math.PI * EAD.EPS0 * mu * V * (V - V0) * L / (d * d * Math.log(d / r));
}
export function eadModel(s) {
  const V = s.V * 1e3, d = s.d / 100, r = s.r / 1000, mu = s.mu0 * 1e-4 / s.delta;
  const rho = EAD.RHO_SL * s.delta;
  const L = s.b * s.rows, A = s.b * s.rows * EAD.ROW_PITCH;
  const V0 = eadOnsetVoltage(r, d, s.delta), E = V / d;
  const I1 = eadCurrent(V, V0, d, r, mu, L, s.g);
  const stages = [];
  let v = s.vinf, T = 0, P = 0, Pjet = 0, heat = 0;
  for (let k = 0; k < s.N; k++) {
    const Tk = I1 > 0 ? I1 * V / (mu * E + v) : 0, Pk = I1 * V;
    const ue = Math.sqrt(v * v + 2 * Tk / (rho * A)), vdisk = 0.5 * (v + ue);
    const Pj = Tk * vdisk;                        // kinetic power given to the air (actuator disk)
    stages.push({ k: k + 1, I: I1, T: Tk, P: Pk, vin: v, vout: ue, tp: Pk > 0 ? Tk / Pk : 0, Pjet: Pj, heat: Pk - Pj });
    T += Tk; P += Pk; Pjet += Pj; heat += Pk - Pj;
    v = vdisk;                                    // next stage sees the disk velocity
  }
  const vIon = Math.sqrt(2 * UNITS.e * V / EAD.AIR_ION_MASS);
  return {
    V, d, r, mu, rho, L, A, V0, E, I1, I: I1 * s.N, T, P, Pjet, heat,
    TP: P > 0 ? T / P : 0,
    eta: P > 0 ? T * s.vinf / P : 0,
    etaIdeal: s.vinf / (s.vinf + mu * E),
    density: T / (A * s.N),
    vExit: stages.length ? stages[stages.length - 1].vout : 0,
    stages, vIon,
    Tvac: (I1 * s.N / UNITS.e) * EAD.AIR_ION_MASS * vIon,   // same current as a free ion beam
    spark: E > EAD.SPARK_FIELD * s.delta,
    below: V <= V0,
    driftSpeed: mu * E,
    books: P > 0 ? Math.abs(P - Pjet - heat) / P : 0,
  };
}
// Electrode positions in metres, centred on the origin: stage k spans x0..x1.
export function eadLayout(s) {
  const d = s.d / 100, pitch = d + EAD.STAGE_MARGIN, xEnd = (s.N - 1) * pitch + d;
  const stages = [];
  for (let k = 0; k < s.N; k++) stages.push({ x0: -xEnd / 2 + k * pitch, x1: -xEnd / 2 + k * pitch + d });
  const ys = [];
  for (let i = 0; i < s.rows; i++) ys.push((i - (s.rows - 1) / 2) * EAD.ROW_PITCH);
  return { d, pitch, xEnd, stages, ys, height: s.rows * EAD.ROW_PITCH };
}
export function makeIonic() { return { ions: [], spawn: 0 }; }
// Visual ions only: spawn rate follows current, drift follows mu E + v with time slowed 1000x.
export function stepIonicVisual(st, dt, s, m, hooks = {}) {
  const lay = eadLayout(s);
  const rate = m.I1 > 0 ? Math.min(400, 20 + 4000 * m.I1) : 0;
  st.spawn = rate > 0 ? st.spawn + rate * dt : 0;
  while (st.spawn >= 1 && st.ions.length < EAD.VIS_IONS_MAX) {
    st.spawn -= 1;
    const stg = lay.stages[Math.floor(Math.random() * lay.stages.length)];
    const ion = { x: stg.x0, x1: stg.x1, y: lay.ys[Math.floor(Math.random() * lay.ys.length)] + (Math.random() - 0.5) * 0.03, z: (Math.random() - 0.5) * s.b };
    if (hooks.onAdd) hooks.onAdd(ion);
    st.ions.push(ion);
  }
  const vis = 1e-3 * Math.max(m.driftSpeed + s.vinf, 0.5);
  for (let i = st.ions.length - 1; i >= 0; i--) {
    const q = st.ions[i];
    q.x += vis * dt;
    if (q.x >= q.x1) { if (hooks.onRemove) hooks.onRemove(q); st.ions.splice(i, 1); }
  }
}

// ---------------------------------------------------------------------------
// xenon gridded ion engine (SI)
// ---------------------------------------------------------------------------
// v = sqrt(2 e V / m), mdot = I m / e, thrust = mdot v, beam power = I V.
export function xenonRates(Vbeam, I_mA) {
  const V = Vbeam, I = I_mA * 1e-3;
  const m = UNITS.ionMass;
  const v = Math.sqrt(2 * UNITS.e * V / m);
  const mdot = I * m / UNITS.e;
  return { V, I, v, mdot, F: mdot * v, P: I * V, Pjet: 0.5 * mdot * v * v, Isp: v / UNITS.g0 };
}
export function stepXenonIons(st, dt, p /* {xeV, xeI} */, hooks = {}) {
  const vis = 1.5 * Math.sqrt(p.xeV / 1065);   // visual speed only
  st.spawn += 30 * (p.xeI / 300) * dt;
  while (st.spawn >= 1) {
    st.spawn -= 1;
    if (st.ions.length < IONS_MAX) {
      const ion = { x: -0.9, v: vis };
      if (hooks.onAdd) hooks.onAdd(ion);
      st.ions.push(ion);
    }
  }
  for (let i = st.ions.length - 1; i >= 0; i--) {
    const q = st.ions[i];
    q.x += q.v * dt;
    if (q.x > 3) {
      if (hooks.onRemove) hooks.onRemove(q);
      st.ions.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Carr machine test bench (SI, closed form) -- after Project Vimana episode 2
// ---------------------------------------------------------------------------
// Numbers marked "video" are the ones the episode states; the geometry constants
// come from its CAD description. See references.md ("Project Vimana").
export const CARR = {
  poleArea: 0.04 * 0.04,      // m^2, assumed pole face
  coreLength: 0.4,            // m of steel in the C
  muR: 4000,                  // electrical steel, unsaturated
  Bsat: 1.8,                  // T (video: 1.5-2 T)
  sigmaSteel: 2.0e6,          // S/m
  solidThickness: 0.022,      // m (video: 22 mm solid block)
  tOff: 1e-3,                 // s, contact interruption time for the spike estimate
  // aluminium D-caps (video: six 30-degree sectors, r 217-452 mm, 10 mm leaves above and below)
  rhoAl: 2700, sigmaAl: 3.5e7, capIn: 0.217, capOut: 0.452, leaf: 0.010, nCaps: 6,
  // plywood centre plate (video: 884 mm across, 14 mm thick)
  plateR: 0.442, plateT: 0.014, rhoPly: 600,
  // bismuth (video: most diamagnetic element, melts ~271 C, expands on freezing)
  rhoBi: 9780, chiBi: -1.66e-4, sigmaBi: 7.7e5,
  // Utron halves (video CAD): right-angle cone, hollow hemisphere, shaft bore
  utronSmall: { R: 0.038, h: 0.036, hollowR: 0.025, boreR: 0.002 },
  utronLarge: { R: 0.152, h: 0.152, hollowR: 0.100, boreR: 0.036 },
  windingTurns: 65, windingI: 5, axisTilt: Math.PI / 4,   // video choices
  utronExtraMass: 0.5,        // kg, winding + steel shaft so the model Utron is "just under a kilogram"
  utronInertiaCoeff: 0.48,    // I = coeff * m R^2; fitted so L matches the video's ~0.2 N m s at 3000 rpm (hollow cones + surface winding)
  nUtrons: 6,
  craftInertia: 0.68,         // kg m^2, inferred from the video's 60 -> 72 rpm exchange
  edgeRadius: 0.010,          // m, shell edge radius for the corona estimate
  breakdown: 3.0e6,           // V/m, air at sea level (video: 3 MV/m)
};
function utronHalfVolume(u) {
  const cone = Math.PI * u.R * u.R * u.h / 3;
  const hollow = 2 * Math.PI * u.hollowR ** 3 / 3;
  const bore = Math.PI * u.boreR * u.boreR * (u.h - u.hollowR);   // bore outside the hollow
  return cone - hollow - bore;
}
// p: { I, N, gap (m), lam (m), f (Hz), discRpm, rimRpm, utronRpm }
export function carrBench(p) {
  const c = CARR, mu0 = UNITS.mu0;
  const reluctanceLength = p.gap + c.coreLength / c.muR;
  const Blin = mu0 * p.N * p.I / reluctanceLength;
  const B = c.Bsat * Math.tanh(Blin / c.Bsat);                   // soft saturation knee
  const force = B * B * c.poleArea / (2 * mu0);                  // Maxwell stress, one pole face
  const L = mu0 * p.N * p.N * c.poleArea / reluctanceLength;
  const spike = L * p.I / c.tOff;
  // eddy loss in laminations, classical thin-sheet formula p = pi^2 B^2 f^2 t^2 sigma / 6
  const coreVol = c.poleArea * c.coreLength;
  const eddy = t => Math.PI ** 2 * B * B * p.f * p.f * t * t * c.sigmaSteel / 6 * coreVol;
  const skinDepth = Math.sqrt(1 / (Math.PI * p.f * mu0 * c.muR * c.sigmaSteel));
  // D-caps and disc
  const capArea = (30 / 360) * Math.PI * (c.capOut ** 2 - c.capIn ** 2);
  const capMass = 2 * capArea * c.leaf * c.rhoAl;
  const plateMass = Math.PI * c.plateR ** 2 * c.plateT * c.rhoPly;
  const rMean = 0.5 * (c.capIn + c.capOut);
  const Idisc = c.nCaps * capMass * rMean * rMean + 0.5 * plateMass * c.plateR ** 2;
  // eddy brake on the leaves passing through the gap: F ~ (1/2) sigma v B^2 V_gap
  const wDisc = p.discRpm * 2 * Math.PI / 60, vRim = wDisc * c.capOut;
  const vGap = c.poleArea * 2 * c.leaf;
  const brakeForce = 0.5 * c.sigmaAl * vRim * B * B * vGap;
  const brakeTorque = brakeForce * c.capOut, brakeHeat = brakeForce * vRim;
  const brakeTau = Idisc / (0.5 * c.sigmaAl * B * B * vGap * c.capOut ** 2);   // spin-down time constant
  // Utron
  const vS = utronHalfVolume(c.utronSmall), vL = utronHalfVolume(c.utronLarge);
  const mSmall = vS * c.rhoBi, mLarge = vL * c.rhoBi;
  const wU = p.utronRpm * 2 * Math.PI / 60;
  const Bax = B * Math.cos(c.axisTilt);
  const faradayV = 0.5 * Bax * wU * c.utronSmall.R ** 2;
  const loopArea = Math.PI * c.utronSmall.R ** 2 / 3;             // mean loop area, apex-to-apex spiral
  const windingTorque = c.windingTurns * c.windingI * loopArea * B * Math.sin(c.axisTilt);
  // gyro rim
  const mU = 2 * mSmall + c.utronExtraMass;
  const Iu = c.utronInertiaCoeff * mU * c.utronSmall.R ** 2;
  const Lu = Iu * wU;
  const wRim = p.rimRpm * 2 * Math.PI / 60;
  const gyroTorque = Lu * wRim * Math.sin(c.axisTilt);
  const dL = c.nUtrons * Lu * Math.cos(c.axisTilt);
  const dRimRpm = dL / c.craftInertia * 60 / (2 * Math.PI);
  // glow
  const coronaV = eadOnsetField(c.edgeRadius, 1) * c.edgeRadius;
  const gapBreakdownV = c.breakdown * p.gap;
  return {
    B, Blin, saturated: Blin > c.Bsat, force, L, energy: 0.5 * L * p.I * p.I, spike, reluctanceLength,
    eddyLam: eddy(p.lam), eddySolid: eddy(c.solidThickness), eddyRatio: (c.solidThickness / p.lam) ** 2, skinDepth,
    capArea, capMass, plateMass, Idisc, vRim, brakeForce, brakeTorque, brakeHeat, brakeTau,
    mSmall, mLarge, faradayV, windingTorque, mU, Lu, gyroTorque, dL, dRimRpm, coronaV, gapBreakdownV,
    ampereTurns: p.N * p.I,
  };
}
// Diamagnetic force on a volume V of susceptibility chi at the origin from the coil
// rings: F = (chi V / (2 mu0)) grad(B^2), B converted to tesla. chi < 0 pushes toward
// weaker field. Returns newtons.
export function diamagneticForceAt(rings, x, y, z, V, chi, h = 0.01) {
  const b = { x: 0, y: 0, z: 0 }, f = { x: 0, y: 0, z: 0 };
  const B2 = (px, py, pz) => { fieldAt(rings, px, py, pz, b); const s = SCALE.field; return (b.x * b.x + b.y * b.y + b.z * b.z) * s * s; };
  const k = chi * V / (2 * UNITS.mu0);
  f.x = k * (B2(x + h, y, z) - B2(x - h, y, z)) / (2 * h);
  f.y = k * (B2(x, y + h, z) - B2(x, y - h, z)) / (2 * h);
  f.z = k * (B2(x, y, z + h) - B2(x, y, z - h)) / (2 * h);
  return f;
}

// ---------------------------------------------------------------------------
// drift tracker: value minus its value at reset (or at the last parameter change)
// ---------------------------------------------------------------------------
export class Drift {
  constructor() { this.sig = null; this.v0 = 0; }
  reset() { this.sig = null; }
  // sig identifies parameters that shift the energy zero (e.g. g, E); a change re-baselines.
  update(sig, value) {
    if (sig !== this.sig) { this.sig = sig; this.v0 = value; }
    return value - this.v0;
  }
}

// ---------------------------------------------------------------------------
// Early universe: flat FLRW background (Friedmann equation) in SI, with a
// step table for the relativistic degrees of freedom g*(T), g_s(T) so the
// temperature-time relation holds back to the electroweak scale; plus the
// Zel'dovich approximation for the growth of structure (exact in 1D before
// shell crossing). Fiducial parameters: Planck 2018 (TT,TE,EE+lowE+lensing).
// ---------------------------------------------------------------------------
export const COSMO = {
  G: 6.67430e-11,               // m^3 kg^-1 s^-2
  c: 299792458,                 // m/s
  kB: 1.380649e-23,             // J/K
  hbar: 1.054571817e-34,        // J s
  eV: 1.602176634e-19,          // J
  Mpc: 3.0856775814913673e22,   // m
  yr: 3.15576e7,                // s (Julian)
  T0: 2.7255,                   // K, CMB today (Fixsen 2009)
  H0: 67.4,                     // km/s/Mpc
  OmegaM: 0.315,                // matter (baryons + cold dark matter)
  Neff: 3.046,                  // effective neutrino species
  aMin: 1e-16,                  // start of the integration table (T ~ 1e3 GeV)
  aMax: 1e8,                    // end of the table: ~330 Gyr into the de Sitter future
  // relativistic degrees of freedom vs photon temperature (MeV): [T_above, g*, g_s]
  // Steps are the Standard Model thresholds; real transitions are smooth.
  gTable: [
    [1.7e5, 106.75, 106.75],   // + top (above 170 GeV)
    [1.0e5, 96.25, 96.25],     // + W, Z, Higgs
    [4e3, 86.25, 86.25],       // + bottom, tau
    [1e3, 72.25, 72.25],       // + charm
    [170, 61.75, 61.75],       // quark-gluon plasma: gamma, g, u, d, s, e, mu, nu
    [100, 17.25, 17.25],       // hadrons: gamma, pi, e, mu, nu
    [0.2, 10.75, 10.75],       // gamma, e+-, nu  (down to e+- annihilation)
    [0, 0, 0],                 // placeholder: below 0.2 MeV use the decoupled-neutrino values
  ],
  get gStar0() { return 2 + 7 / 8 * 2 * this.Neff * Math.pow(4 / 11, 4 / 3); },   // 3.38 (energy)
  get gS0() { return 2 + 7 / 8 * 2 * this.Neff * (4 / 11); },                     // 3.94 (entropy)
  // milestones: [label, kind, value]  kind 'T' = photon temperature in K, 'a' = scale factor key
  events: [
    ['Electroweak transition (~100 GeV)', 'T', 1.16e15],
    ['QCD transition: quarks bind into hadrons (~170 MeV)', 'T', 1.97e12],
    ['Neutrino decoupling (~1 MeV)', 'T', 1.16e10],
    ['e+e- annihilation heats the photons (~0.5 MeV)', 'T', 5.8e9],
    ['Nucleosynthesis: deuterium bottleneck opens (~0.07 MeV)', 'T', 8.1e8],
    ['Matter-radiation equality', 'a', 'eq'],
    ['Recombination / CMB last scattering (z ~ 1100)', 'T', 2970],
    ['First stars (z ~ 20, approximate)', 'T', 57],
    ['Dark energy starts to dominate', 'a', 'lambda'],
    ['Today', 'T', 2.7255],
  ],
};

export function gStarAt(TK, c = COSMO) {       // returns {g, gs} for photon temperature T (K)
  const TMeV = c.kB * TK / c.eV / 1e6;
  for (const [Tabove, g, gs] of c.gTable) if (TMeV >= Tabove && g > 0) return { g, gs };
  return { g: c.gStar0, gs: c.gS0 };
}

// scale factor at photon temperature T from entropy conservation g_s T^3 a^3 = const
export function cosmoScaleAtT(TK, c = COSMO) { return (c.T0 / TK) * Math.cbrt(c.gS0 / gStarAt(TK, c).gs); }

// photon temperature at scale factor a: invert the monotone a(T) by bisection in ln T.
// At a g_s step the temperature holds while a grows (e.g. e+e- annihilation plateau).
export function cosmoTemperature(a, c = COSMO) {
  let lo = Math.log(c.T0 * 0.5), hi = Math.log(1e20);
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (cosmoScaleAtT(Math.exp(mid), c) > a) lo = mid; else hi = mid;
  }
  return Math.exp(0.5 * (lo + hi));
}

export function radiationDensity(TK, c = COSMO) {   // kg/m^3, g*(T) pi^2/30 (kT)^4/(hbar c)^3 / c^2
  const kT = c.kB * TK, hc = c.hbar * c.c;
  return gStarAt(TK, c).g * Math.PI ** 2 / 30 * kT ** 4 / hc ** 3 / c.c ** 2;
}

export function cosmoParams(over = {}) {
  const c = { ...COSMO, ...over };
  const H0 = c.H0 * 1e3 / c.Mpc;                                   // 1/s
  const rhoCrit0 = 3 * H0 ** 2 / (8 * Math.PI * c.G);
  const rhoR0 = c.noRadiation ? 0 : radiationDensity(c.T0, c);
  const OmegaR = rhoR0 / rhoCrit0;
  const OmegaL = 1 - c.OmegaM - OmegaR;                            // flat
  return { ...c, H0si: H0, rhoCrit0, rhoR0, OmegaR, OmegaL, aEq: OmegaR / c.OmegaM, aLambda: Math.cbrt(c.OmegaM / OmegaL) };
}

export function cosmoDensities(a, p) {
  const T = cosmoTemperature(a, p);
  const rhoR = p.noRadiation ? 0 : radiationDensity(T, p);
  const rhoM = p.OmegaM * p.rhoCrit0 / a ** 3;
  const rhoL = p.OmegaL * p.rhoCrit0;
  const rho = rhoR + rhoM + rhoL;
  const H = Math.sqrt(8 * Math.PI * p.G / 3 * rho);                // Friedmann
  const w = (rhoR / 3 - rhoL) / rho;                               // effective equation of state
  return { T, rhoR, rhoM, rhoL, rho, H, w };
}

// Table over ln a: cosmic time t(a), comoving particle horizon chi(a), growth factor D(a).
// t and chi start from the exact single-component values at aMin; D from the matter-era D = a.
export function cosmoTable(over = {}, n = 4000) {
  const p = cosmoParams(over);
  const u0 = Math.log(p.aMin), u1 = Math.log(p.aMax ?? 1e8), du = (u1 - u0) / n;
  const lnA = new Float64Array(n + 1), t = new Float64Array(n + 1), chi = new Float64Array(n + 1), D = new Float64Array(n + 1);
  const E = a => Math.sqrt(p.OmegaM / a ** 3 + p.OmegaL);        // matter + Lambda only, for growth
  const d0 = cosmoDensities(p.aMin, p);
  let tAcc = 2 / (3 * (1 + d0.w) * d0.H), chiAcc = p.c / (p.aMin * d0.H) * (p.noRadiation ? 2 : 1);
  let gAcc = 0.4 * p.aMin ** 2.5 / p.OmegaM ** 1.5;                // int_0^aMin da/(a E)^3
  let fPrev = null;
  for (let i = 0; i <= n; i++) {
    const u = u0 + i * du, a = Math.exp(u);
    const d = cosmoDensities(a, p);
    const f = [1 / d.H, p.c / (a * d.H), 1 / (a * E(a)) ** 3 * a];   // integrands in u = ln a (da = a du)
    if (fPrev) { tAcc += 0.5 * (f[0] + fPrev[0]) * du; chiAcc += 0.5 * (f[1] + fPrev[1]) * du; gAcc += 0.5 * (f[2] + fPrev[2]) * du; }
    fPrev = f;
    lnA[i] = u; t[i] = tAcc; chi[i] = chiAcc; D[i] = 2.5 * p.OmegaM * E(a) * gAcc;
  }
  return { p, n, u0, du, lnA, t, chi, D };
}

function tableAt(tab, arr, a) {
  const x = (Math.log(a) - tab.u0) / tab.du, i = Math.max(0, Math.min(tab.n - 1, Math.floor(x))), s = x - i;
  return arr[i] * (1 - s) + arr[i + 1] * s;
}

export function cosmoState(a, tab) {
  const p = tab.p, d = cosmoDensities(a, p);
  const t = tableAt(tab, tab.t, a), chi = tableAt(tab, tab.chi, a), D = tableAt(tab, tab.D, a);
  const da = a * 1e-3, f = (Math.log(tableAt(tab, tab.D, a + da)) - Math.log(tableAt(tab, tab.D, a - da))) / (Math.log(a + da) - Math.log(a - da));
  const OmM = d.rhoM / d.rho;
  return {
    a, z: 1 / a - 1, ...d, t, chi, D, f, gStar: gStarAt(d.T, p).g,
    OmegaR: d.rhoR / d.rho, OmegaM: OmM, OmegaL: d.rhoL / d.rho,
    tH: t * d.H,                       // 1/2 in the radiation era, 2/3 in the matter era
    hubbleRadius: p.c / d.H,           // m
    horizonPhys: chi * a,              // m, proper particle horizon
    kTeV: p.kB * d.T / p.eV,
    fLinder: Math.pow(d.rhoM / (d.rhoM + d.rhoL), 0.55),   // Linder 2005, matter + Lambda (the growth integral ignores radiation)
    era: d.rhoR > d.rhoM && d.rhoR > d.rhoL ? 'radiation' : d.rhoM > d.rhoL ? 'matter' : 'dark energy',
  };
}

export function cosmoAge(tab) { return tableAt(tab, tab.t, 1); }
export function cosmoHorizonToday(tab) { return tableAt(tab, tab.chi, 1); }
// Carroll, Press & Turner 1992 fit to the growth suppression D(1)/a at a = 1 (flat, Lambda)
export function growthCPT(Om, OL) { return 2.5 * Om / (Math.pow(Om, 4 / 7) - OL + (1 + Om / 2) * (1 + OL / 70)); }
// flat matter + Lambda age, closed form (no radiation)
export function ageMatterLambda(a, p) { return 2 / (3 * p.H0si * Math.sqrt(p.OmegaL)) * Math.asinh(Math.sqrt(p.OmegaL / p.OmegaM) * a ** 1.5); }
// radiation-era rule of thumb t = 2.42 s g*^-1/2 (MeV/kT)^2 (Kolb & Turner)
export function radiationEraTime(TMeV, g) { return 2.42 / Math.sqrt(g) / TMeV ** 2; }

export function cosmoEvents(tab) {    // milestones with their scale factor, temperature and time
  const p = tab.p;
  return p.events.map(([label, kind, v]) => {
    const a = kind === 'T' ? cosmoScaleAtT(v, p) : v === 'eq' ? p.aEq : p.aLambda;
    const s = cosmoState(Math.min(a, 1), tab);
    return { label, a: s.a, T: s.T, t: s.t, z: s.z };
  });
}

export function fmtTime(s) {
  const yr = COSMO.yr;
  if (s < 1e-9) return `${(s * 1e12).toPrecision(3)} ps`;
  if (s < 1e-6) return `${(s * 1e9).toPrecision(3)} ns`;
  if (s < 1e-3) return `${(s * 1e6).toPrecision(3)} µs`;
  if (s < 1) return `${(s * 1e3).toPrecision(3)} ms`;
  if (s < 120) return `${s.toPrecision(3)} s`;
  if (s < 7200) return `${(s / 60).toPrecision(3)} min`;
  if (s < 2 * 86400) return `${(s / 3600).toPrecision(3)} h`;
  if (s < 2 * yr) return `${(s / 86400).toPrecision(3)} d`;
  if (s < 1e3 * yr) return `${(s / yr).toPrecision(3)} yr`;
  if (s < 1e6 * yr) return `${(s / yr / 1e3).toPrecision(3)} kyr`;
  if (s < 1e9 * yr) return `${(s / yr / 1e6).toPrecision(3)} Myr`;
  return `${(s / yr / 1e9).toPrecision(3)} Gyr`;
}
export function fmtLength(m) {
  const { Mpc, c, yr } = COSMO, ly = c * yr;
  if (m < 1e3) return `${m.toPrecision(3)} m`;
  if (m < 0.01 * ly) return `${(m / 1e3).toPrecision(3)} km`;
  if (m < 1e3 * ly) return `${(m / ly).toPrecision(3)} ly`;
  if (m < Mpc) return `${(m / ly / 1e3).toPrecision(3)} kly`;
  if (m < 1e3 * Mpc) return `${(m / Mpc).toPrecision(3)} Mpc`;
  return `${(m / Mpc / 1e3).toPrecision(3)} Gpc`;
}
export function fmtTemp(T) {
  const eV = COSMO.kB * T / COSMO.eV;
  if (eV >= 1e9) return `${T.toPrecision(3)} K (${(eV / 1e9).toPrecision(3)} GeV)`;
  if (eV >= 1e6) return `${T.toPrecision(3)} K (${(eV / 1e6).toPrecision(3)} MeV)`;
  if (eV >= 1e3) return `${T.toPrecision(3)} K (${(eV / 1e3).toPrecision(3)} keV)`;
  if (eV >= 1) return `${T.toPrecision(3)} K (${eV.toPrecision(3)} eV)`;
  return `${T.toPrecision(4)} K`;
}

// ---- Zel'dovich approximation --------------------------------------------
// Comoving position x = q + D(a) psi(q) with psi = sum_i -(A_i/k_i) khat_i sin(k_i.q + phi_i), so the
// linear overdensity is delta = D sum_i A_i cos(k_i.q + phi_i) and the density is 1/det(I + D dpsi/dq).
// Box is [0, 1)^3 in units of L; k = 2 pi n / L. Exact in 1D until shell crossing (det -> 0).
export function makeZeldovichField(amp, waves, seed = 7) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const modes = [];
  for (const [nx, ny, nz] of waves) {
    const k = 2 * Math.PI * Math.hypot(nx, ny, nz);
    modes.push({ kx: 2 * Math.PI * nx, ky: 2 * Math.PI * ny, kz: 2 * Math.PI * nz, k, A: amp / Math.sqrt(waves.length), phi: rnd() * 2 * Math.PI });
  }
  return { modes };
}

export function zeldovichDisplace(q, D, field, out) {
  let dx = 0, dy = 0, dz = 0;
  let j11 = 1, j12 = 0, j13 = 0, j22 = 1, j23 = 0, j33 = 1;   // Jacobian I + D dpsi/dq (symmetric)
  for (const m of field.modes) {
    const ph = m.kx * q.x + m.ky * q.y + m.kz * q.z + m.phi;
    const s = -m.A / m.k * Math.sin(ph), c = -m.A / m.k * Math.cos(ph);   // psi along khat, d psi/d(k.q)
    const ux = m.kx / m.k, uy = m.ky / m.k, uz = m.kz / m.k;
    dx += s * ux; dy += s * uy; dz += s * uz;
    // d(psi_i)/d(q_j) = c * u_i * k_j = c k u_i u_j
    const ck = c * m.k;
    j11 += D * ck * ux * ux; j12 += D * ck * ux * uy; j13 += D * ck * ux * uz;
    j22 += D * ck * uy * uy; j23 += D * ck * uy * uz; j33 += D * ck * uz * uz;
  }
  out.x = q.x + D * dx; out.y = q.y + D * dy; out.z = q.z + D * dz;
  const det = j11 * (j22 * j33 - j23 * j23) - j12 * (j12 * j33 - j23 * j13) + j13 * (j12 * j23 - j22 * j13);
  out.density = det > 1e-9 ? 1 / det : Infinity;    // rho / rho_bar; Infinity at shell crossing
  out.deltaLin = 3 - (j11 + j22 + j33);                // linear delta = -D div psi = 3 - tr(J)
  return out;
}

// 1D single mode: shell crossing when D * A = 1
export function zeldovichShellCrossing(tab, A) {
  if (A <= 0) return Infinity;
  let lo = tab.p.aMin, hi = 1;
  if (tableAt(tab, tab.D, 1) * A < 1) return Infinity;      // not before today
  for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); if (tableAt(tab, tab.D, m) * A < 1) lo = m; else hi = m; }
  return hi;
}

// ---------------------------------------------------------------------------
// Megastructures: closed-form physics for the hypothetical families (Dyson swarm /
// bubble / rigid shell, Shkadov thruster, ringworld, O'Neill cylinder, space elevator,
// orbital ring, Matrioshka brain) and the natural hierarchy (virial cluster). SI.
// Each returns the numbers that decide feasibility: required specific strength vs
// real materials, areal density limits, powers, accelerations.
// ---------------------------------------------------------------------------
export const MEGA = {
  G: 6.67430e-11, c: 299792458, sigmaSB: 5.670374419e-8, kB: 1.380649e-23,
  Lsun: 3.828e26, Msun: 1.98847e30, Rsun: 6.957e8, AU: 1.495978707e11, pc: 3.0856775814913673e16,
  Mearth: 5.9722e24, Rearth: BODIES.earth.meanRadius, omegaEarth: 7.2921159e-5, g0: CONST.G0, pAtm: CONST.P_SL,
  Mmercury: 3.3011e23,
  // tensile strength (Pa), density (kg/m^3): specific strength sigma/rho in J/kg is what the structures need
  materials: {
    steel: { sigma: 2.0e9, rho: 7850, note: 'high-strength steel' },
    kevlar: { sigma: 3.6e9, rho: 1440, note: 'Kevlar 49' },
    cnt: { sigma: 6.3e10, rho: 1300, note: 'measured CNT fibre (best lab values)' },
    graphene: { sigma: 1.3e11, rho: 2200, note: 'graphene, defect-free (theoretical / nanoscale)' },
  },
};

// Dyson swarm: fraction f of L collected at radius r by collectors of area A and areal density sigmaA (kg/m^2).
export function dysonSwarm({ L = MEGA.Lsun, M = MEGA.Msun, r = MEGA.AU, f = 0.01, A = 1e6, sigmaA = 1, albedo = 0.1, emissivity = 0.9 } = {}) {
  const flux = L / (4 * Math.PI * r ** 2);                     // W/m^2
  const areaTotal = f * 4 * Math.PI * r ** 2, N = areaTotal / A;
  const mass = areaTotal * sigmaA;
  const vOrb = Math.sqrt(MEGA.G * M / r), period = 2 * Math.PI * r / vOrb;
  // flat collector facing the star, radiating from both faces
  const Teq = Math.pow(flux * (1 - albedo) / (2 * emissivity * MEGA.sigmaSB), 0.25);
  return { flux, areaTotal, N, mass, massMercury: mass / MEGA.Mmercury, vOrb, period, Teq, power: f * L, kardashevII: f * L / 4e26 };
}

// Dyson bubble statite: radiation pressure balances gravity when the areal density is below
// sigma_crit = L (1 + R) / (4 pi G M c), independent of distance (R = reflectivity).
export function statiteLimit({ L = MEGA.Lsun, M = MEGA.Msun, R = 1 } = {}) {
  return L * (1 + R) / (4 * Math.PI * MEGA.G * M * MEGA.c);     // kg/m^2
}

// Rigid Dyson shell: shell theorem gives no net force (it drifts); the compressive hoop stress of a
// thin self-supporting shell under the star's gravity is sigma = G M rho / (2 r), independent of thickness.
export function rigidShell({ M = MEGA.Msun, r = MEGA.AU, rho = 3000 } = {}) {
  const g = MEGA.G * M / r ** 2, stress = MEGA.G * M * rho / (2 * r);
  return { g, stress, netForce: 0 };
}

// Shkadov thruster: a half-shell mirror reflects half the star's light back past it; maximum thrust L/(2c).
export function shkadov({ L = MEGA.Lsun, M = MEGA.Msun, efficiency = 1 } = {}) {
  const F = efficiency * L / (2 * MEGA.c), a = F / M, Gyr = 3.15576e16;
  return { F, a, dvPerGyr: a * Gyr, distPerGyr: 0.5 * a * Gyr ** 2 };   // m/s per Gyr, m after 1 Gyr from rest
}

// Spinning ring habitat (ringworld at r ~ 1 AU, or an O'Neill cylinder at r ~ km): rim speed for
// gravity gEff, period, and the hoop stress a thin ring must carry: sigma/rho = v^2 - G M / r for the
// structure alone (the central mass's pull reduces the needed centripetal load), plus atmosphere and
// floor loads p r / t for a shell of thickness t. Returns the required specific strength (J/kg).
export function spinHabitat({ r = MEGA.AU, gEff = MEGA.g0, M = 0, rhoWall = 3000, tWall = 1, pAir = 0, floorLoad = 0 } = {}) {
  const gStar = M ? MEGA.G * M / r ** 2 : 0;
  const v = Math.sqrt((gEff + gStar) * r);                     // rim speed for gEff felt inside
  const omega = v / r, period = 2 * Math.PI / omega, rpm = 60 / period;
  const specificSelf = v * v - gStar * r;                     // J/kg: hoop stress / density from the wall's own mass
  const extra = (pAir + floorLoad) * r / tWall;               // Pa from air pressure and payload per wall thickness
  const stress = rhoWall * specificSelf + extra;
  const coriolisWalk = 2 * omega * 1.4;                       // m/s^2 sideways push at 1.4 m/s walking speed
  const best = Object.entries(MEGA.materials).map(([k, m]) => ({ k, ok: m.sigma / m.rho >= specificSelf && m.sigma >= stress })).filter(x => x.ok).map(x => x.k);
  return { v, omega, period, rpm, specificSelf, stress, coriolisWalk, feasibleWith: best, shortfall: specificSelf / (MEGA.materials.graphene.sigma / MEGA.materials.graphene.rho) };
}

// Space elevator: uniform-stress tether. Potential difference surface -> geostationary radius in the rotating
// frame, taper ratio exp(rho dPhi / sigma) (Pearson 1975).
export function spaceElevator({ M = MEGA.Mearth, R = MEGA.Rearth, omega = MEGA.omegaEarth, material = 'cnt', safety = 1 } = {}) {
  const rg = Math.cbrt(MEGA.G * M / omega ** 2);
  const dPhi = MEGA.G * M / R - MEGA.G * M / rg - omega ** 2 * (rg ** 2 - R ** 2) / 2;   // J/kg
  const m = MEGA.materials[material], taper = Math.exp(m.rho * dPhi / (m.sigma / safety));
  const tapers = Object.fromEntries(Object.entries(MEGA.materials).map(([k, mm]) => [k, Math.exp(mm.rho * dPhi / (mm.sigma / safety))]));
  // counterweight-free length: where the rotating-frame potential returns to the surface value
  let lo = rg, hi = 50 * rg;
  for (let i = 0; i < 100; i++) { const mid = 0.5 * (lo + hi); const phi = -MEGA.G * M / mid - omega ** 2 * mid ** 2 / 2, phi0 = -MEGA.G * M / R - omega ** 2 * R ** 2 / 2; if (phi > phi0) lo = mid; else hi = mid; }
  return { rg, geoAltitude: rg - R, dPhi, taper, tapers, freeEndRadius: 0.5 * (lo + hi) };
}

// Orbital ring: a rotor at radius r moving at v > v_orb, held down by a stationary sheath. The excess
// centripetal requirement supports load: per metre of ring, F = lambda (v^2 - v_orb^2) / r.
export function orbitalRing({ M = MEGA.Mearth, R = MEGA.Rearth, h = 300e3, v = 10e3, lambdaRotor = 1000 } = {}) {
  const r = R + h, vOrb = Math.sqrt(MEGA.G * M / r);
  const supportPerMetre = lambdaRotor * (v * v - vOrb * vOrb) / r;   // N/m
  return { r, vOrb, supportPerMetre, massPerMetreSupported: supportPerMetre / (MEGA.G * M / r ** 2), rotorKE: 0.5 * lambdaRotor * v * v * 2 * Math.PI * r };
}

// Matrioshka brain: Landauer limit. A shell at temperature T radiating power P can erase at most
// P / (k T ln 2) bits per second. Nested shells reuse the heat: total ops ~ sum over shells.
export function matrioshka({ L = MEGA.Lsun, shellsT = [1000, 300, 100, 30] } = {}) {
  const shells = shellsT.map((T, i) => {
    const Tin = i === 0 ? Infinity : shellsT[i - 1];
    const P = L;                                              // all the luminosity passes through each shell
    const eta = Tin === Infinity ? 1 : 1 - T / Tin;           // Carnot fraction extractable between shells
    const rShell = Math.sqrt(L / (4 * Math.PI * MEGA.sigmaSB * T ** 4));   // radius where a black shell sits at T
    return { T, r: rShell, rAU: rShell / MEGA.AU, workW: P * eta, bitsPerS: P * eta / (MEGA.kB * T * Math.LN2) };
  });
  return { shells, totalBitsPerS: shells.reduce((s, x) => s + x.bitsPerS, 0) };
}

// Virialised galaxy cluster: sigma^2 ~ G M / (2 R) (isothermal sphere), crossing time, X-ray gas temperature.
export function virialCluster({ M = 4e14 * MEGA.Msun, R = 1.6e6 * MEGA.pc, nGal = 1500 } = {}) {
  const sigma = Math.sqrt(MEGA.G * M / (2 * R)), tCross = R / sigma;
  const mp = 1.67262192e-27, mu = 0.6, kT = mu * mp * sigma ** 2;   // J, virial gas temperature
  return { sigma, tCross, kT_keV: kT / 1.602176634e-16, nGal, meanSeparation: Math.cbrt(4 / 3 * Math.PI * R ** 3 / nGal) };
}

// ---------------------------------------------------------------------------
// Solar System ephemeris: Keplerian mean elements and secular rates from JPL
// (E. M. Standish, "Keplerian Elements for Approximate Positions of the Major Planets",
// Table 1, valid 1800-2050 AD; errors of order arcminutes). Elements at J2000 and per
// Julian century: a [AU], e, I [deg], L [deg], long. of perihelion [deg], long. of node [deg].
// Positions are heliocentric ecliptic J2000 in AU. "Earth" is the Earth-Moon barycentre.
// ---------------------------------------------------------------------------
export const ORBITS = {
  Mercury: { el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081], radius: 2439.7e3, color: 0xb5b5b5 },
  Venus: { el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], rate: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418], radius: 6051.8e3, color: 0xe8d3a0 },
  Earth: { el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0], radius: 6371.0e3, color: 0x5f9bff },
  Mars: { el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343], radius: 3389.5e3, color: 0xd96b45 },
  Jupiter: { el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106], radius: 69911e3, color: 0xd9b48a },
  Saturn: { el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794], radius: 58232e3, color: 0xe9d9a8 },
  Uranus: { el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589], radius: 25362e3, color: 0x9fe3e8 },
  Neptune: { el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664], radius: 24622e3, color: 0x6b8fff },
  Pluto: { el: [39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684], rate: [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482], radius: 1188.3e3, color: 0xc9b8a8, dwarf: true },
};
export const EPHEM = {
  J2000: 2451545.0,                 // JD of 2000-01-01 12:00 TT
  GM_SUN: 2.9591220828e-4,          // AU^3/day^2 (k^2)
  AU: 1.495978707e11,
  obliquity: 23.43928 * Math.PI / 180,   // J2000 mean obliquity
  moon: { a: 384400e3, period: 27.321661, L0: 218.316, inc: 5.145 },   // sidereal days; mean longitude at J2000 (deg); circular approximation
};
export const jdFromDate = ms => ms / 86400000 + 2440587.5;   // Unix ms -> Julian day (UTC; TT offset ~69 s ignored)

export function solveKepler(M, e) {   // M, E in radians; Newton iteration
  let E = M + 0.85 * e * Math.sign(Math.sin(M) || 1);   // Danby's starting guess, robust to e -> 1
  for (let i = 0; i < 60; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-14) break; }
  return E;
}

// position (AU) and velocity (AU/day) in heliocentric ecliptic J2000 at Julian day jd
export function keplerState(name, jd) {
  const o = ORBITS[name], T = (jd - EPHEM.J2000) / 36525, d = Math.PI / 180;
  const [a, e, I, L, wbar, Om] = o.el.map((v, i) => v + o.rate[i] * T);
  const w = (wbar - Om) * d, M = ((L - wbar) % 360 + 540) % 360 * d - Math.PI, i = I * d, O = Om * d;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const n = o.rate[3] * d / 36525, Ed = n / (1 - e * Math.cos(E));   // mean motion from the tabulated L rate (Pluto's includes Neptune's perturbation); the slow perihelion drift cancels to first order in the longitude rate
  const vxp = -a * Math.sin(E) * Ed, vyp = a * Math.sqrt(1 - e * e) * Math.cos(E) * Ed;
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  const R = [[cw * cO - sw * sO * ci, -sw * cO - cw * sO * ci], [cw * sO + sw * cO * ci, -sw * sO + cw * cO * ci], [sw * si, cw * si]];
  const pos = R.map(r => r[0] * xp + r[1] * yp), vel = R.map(r => r[0] * vxp + r[1] * vyp);
  const r = Math.hypot(...pos), v = Math.hypot(...vel);
  return { x: pos[0], y: pos[1], z: pos[2], vx: vel[0], vy: vel[1], vz: vel[2], r, v, a, e, period: 2 * Math.PI / n, M, E, lon: Math.atan2(pos[1], pos[0]) / d };
}

// Moon about the Earth-Moon barycentre, circular orbit in a plane inclined 5.1 deg to the ecliptic (approximate)
export function moonOffset(jd) {
  const m = EPHEM.moon, th = (m.L0 + 360 * (jd - EPHEM.J2000) / m.period) * Math.PI / 180, i = m.inc * Math.PI / 180;
  return { x: m.a * Math.cos(th) / EPHEM.AU, y: m.a * Math.sin(th) * Math.cos(i) / EPHEM.AU, z: m.a * Math.sin(th) * Math.sin(i) / EPHEM.AU };   // AU
}

// ecliptic J2000 -> equatorial J2000 -> galactic (unit vectors; scale free)
export function eclipticToGalactic(x, y, z) {
  const ce = Math.cos(EPHEM.obliquity), se = Math.sin(EPHEM.obliquity);
  const xe = x, ye = y * ce - z * se, ze = y * se + z * ce;
  return [
    -0.0548755604 * xe - 0.8734370902 * ye - 0.4838350155 * ze,
    0.4941094279 * xe - 0.4448296300 * ye + 0.7469822445 * ze,
    -0.8676661490 * xe - 0.1980763734 * ye + 0.4559837762 * ze,
  ];
}
