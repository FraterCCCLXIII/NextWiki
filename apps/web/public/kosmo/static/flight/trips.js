// trips.js: multi-leg trip planner for the flight deck.
// Heliocentric legs use OrbitalPhysics.planetState and OrbitalPhysics.lambert (SI: m, m/s, kg, s).
// Each leg's burns are back-propagated through the rocket equation from the end of the last leg,
// so every leg reports its own Δv, propellant, and mass in / out.

import * as IAU from './bodies-iau.js';
import { ENGINES, engineOf, sailAccel, electricThrust, AU } from './propulsion.js';
export { ENGINES };

const G0 = 9.80665, DAY = 86400, JD0 = 2440587.5, DEG = Math.PI / 180, EPS = 23.4392911 * DEG;
const SIM_BODIES = ['mercury', 'venus', 'earth', 'mars'];   // worlds the ascent/landing integrators know
const DEFAULT_SITE = { earth: { lat: 28.5, lon: -80.6, elev: 0 }, mars: { lat: 18.4, lon: 77.5, elev: -2600 },
  mercury: { lat: 0, lon: 0, elev: 0 }, venus: { lat: 0, lon: 0, elev: 0 } };
const siteFor = (id, s) => ({ lat: Number.isFinite(s?.lat) ? s.lat : DEFAULT_SITE[id]?.lat ?? 0,
  lon: Number.isFinite(s?.lon) ? s.lon : DEFAULT_SITE[id]?.lon ?? 0, elev: Number.isFinite(s?.elev) ? s.elev : DEFAULT_SITE[id]?.elev ?? 0 });

// Common integrator inputs (same defaults as the Dynamics lab); thrust is in kN as physics.js expects.
function simBase(id, st, jd, isp) {
  return { world: id, bodyId: id, jd, latitude: st.lat, longitude: st.lon, elevation: st.elev, slope: 2, minThrottle: 0,
    engineLag: .3, ignitionAltitude: 0, maxTilt: 35, turnRate: 15, descentCap: 100, guidanceTau: 2, area: 10, cd: .5, liftDrag: 0,
    noseRadius: 1, heatK: .000183, wind: 0, navPosition: 0, navVelocity: 0, latency: .1, parachuteArea: 0, chuteAltitude: 5000,
    chuteSpeed: 400, failureTime: -1, failureFraction: 1, verticalLimit: 2, horizontalLimit: 1, targetRadius: 100, reserve: 0,
    touchTilt: 10, slopeLimit: 10, qLimit: 1e9, heatLimit: 1e12, gLimit: 100, seed: 42, maxTime: 1800, isp };
}

// Integrated ascent from a surface site to a ~altM orbit. The guidance burns its whole stage, so the propellant load is
// bisected for the smallest one that leaves a perigee within 10 km of altM. TWR 1.5 with air (Earth), 3 without: the
// guidance does not circularize a low-TWR ascent over thin air or vacuum. Returns {used, massIn, dv, r} or null.
export function simAscent(P, id, site, jd, payload, craft, altM) {
  const w = P.worlds[id], g = w.mu / (w.R * w.R), ve = craft.isp * G0, dense = w.rho > .5;
  const base = simBase(id, siteFor(id, site), jd, craft.isp), twr = craft.launchTWR ?? (dense ? 1.5 : 3);
  const run = x => P.ascent({ ...base, payload, maxTime: 900, stages: [{ dry: 1, prop: x, isp: craft.isp, thrust: twr * (payload + 1 + x) * g / 1000 }],
    targetAltitude: altM, pitchStart: dense ? 1000 : 300, pitchEnd: dense ? 100000 : Math.max(20000, .01 * w.R),
    azimuth: craft.azimuth ?? 90, throttle: 1, dt: .5 });
  const ok = r => Number.isFinite(r.orbit?.perigee) && r.orbit.perigee >= altM - 10000;
  let lo = payload * (Math.exp(Math.sqrt(w.mu / (w.R + altM)) / ve) - 1), hi = lo * 2.2, best = run(hi), n = 0;
  while (!ok(best) && n++ < 4) { lo = hi; hi *= 1.6; best = run(hi); }
  if (!ok(best)) return null;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2, t = run(mid);
    if (ok(t)) { hi = mid; best = t; } else lo = mid;
  }
  const used = Math.max(1, payload + 1 + hi - best.mass), massIn = payload + used;
  return { used, massIn, dv: ve * Math.log(massIn / payload), r: best };
}

// Integrated terminal descent (10 km gate, 100 m/s horizontal, lab defaults) with the surface site rotating under it.
// Iterates the propellant load so ~3% remains. Returns {used, massIn, dv, r}.
export function simLanding(P, id, site, jd, massOut, craft) {
  const w = P.worlds[id], g = w.mu / (w.R * w.R), ve = craft.isp * G0;
  const base = simBase(id, siteFor(id, site), jd, craft.isp);
  let prop = massOut * .35, res = null;
  for (let k = 0; k < 6; k++) {
    res = P.landing({ ...base, dry: massOut, propellant: prop, thrust: 2.5 * (massOut + prop) * g / 1000, altitude: 10000,
      offsetEast: 1500, offsetNorth: 500, horizontalSpeed: 100, downSpeed: 20, dt: .2, maxTime: 600, parachuteArea: w.rho > .5 ? 400 : 0 });
    if (res.touchdown && res.fuel <= .04 * prop && res.fuel > 0) break;
    prop = res.touchdown ? Math.max(1, res.used * 1.03) : prop * 1.6;
  }
  const used = Math.max(1, res.used), massIn = massOut + used;
  return { used, massIn, dv: ve * Math.log(massIn / massOut), r: res };
}

// Angle between a heliocentric (ecliptic) direction and the body's equator, from the real IAU pole.
function declination(id, jd, dir) {
  const o = IAU.hasBody(id) ? IAU.orientation(id, jd) : null;
  if (!o) return 0;
  const [px, py, pz] = o.pole, pole = [px, py * Math.cos(EPS) + pz * Math.sin(EPS), -py * Math.sin(EPS) + pz * Math.cos(EPS)];
  const n = Math.hypot(...dir) || 1;
  return Math.asin(Math.max(-1, Math.min(1, (dir[0] * pole[0] + dir[1] * pole[1] + dir[2] * pole[2]) / n)));
}
const ASCENT_LOSS = 1600;       // m/s gravity + drag allowance, surface to parking orbit (as in model.js launch allowance)
const DESCENT_ALLOWANCE = 300;  // m/s above surface circular speed for powered descent (as in model.js)

export const BODIES = {
  mercury: { mu: 2.20319e13, R: 2439700, rho: 0 },
  venus:   { mu: 3.24859e14, R: 6051800, rho: 65 },
  earth:   { mu: 3.986004418e14, R: 6378137, rho: 1.225 },
  mars:    { mu: 4.28284e13, R: 3389500, rho: 0.02 },
  jupiter: { mu: 1.26686534e17, R: 69911000, rho: 0 },
  saturn:  { mu: 3.7931187e16, R: 58232000, rho: 0 },
  uranus:  { mu: 5.793939e15, R: 25362000, rho: 0 },
  neptune: { mu: 6.836529e15, R: 24622000, rho: 0 }
};

const cap = s => s[0].toUpperCase() + s.slice(1);
const norm = a => Math.hypot(...a);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const circ = (mu, r) => Math.sqrt(mu / r);
// Δv from a circular orbit of radius r onto a hyperbola with excess speed vinf
const escapeDV = (vinf, mu, r) => Math.sqrt(vinf * vinf + 2 * mu / r) - circ(mu, r);
const body = id => { const b = BODIES[id]; if (!b) throw Error(`Unknown body "${id}".`); return b; };

export const jdFromDate = s => Date.parse(s + 'T00:00:00Z') / 86400000 + JD0;
export const dateFromJd = jd => new Date((jd - JD0) * 86400000).toISOString().slice(0, 10);

// legs: [{from,to,departJD,days,land?}] (1-3). craft: {dry,payload,isp,tank?,parkAltKm?,aeroFraction?,surfaceStart?}
// craft.stages is accepted for future use; the launch stack is sized by planMission in model.js, not here.
export function planTrips(legs, craft, P = globalThis.OrbitalPhysics) {
  if (!P) throw Error('OrbitalPhysics is not loaded.');
  if (!Array.isArray(legs) || legs.length < 1 || legs.length > 3) throw Error('Use 1 to 3 legs.');
  const eng = engineOf(craft.engine);
  if (eng.type === 'blocked') return { ok: false, legs: [], totals: null, flags: [`${eng.name}: ${eng.why}`], blocked: true };
  // chemIsp drives ascent, landing and any burn the main engine cannot fly; xferIsp is the in-space engine's Isp
  const chemIsp = eng.type === 'rocket' ? (eng.surface ? (eng.isp ?? craft.isp) : (eng.aux ?? 370)) : (eng.aux ?? 370);
  const xferIsp = eng.type === 'rocket' ? (eng.isp ?? craft.isp) : eng.type === 'electric' ? eng.isp : chemIsp;
  if (!(chemIsp > 0 && xferIsp > 0)) throw Error('Specific impulse must be positive.');
  craft = { ...craft, isp: chemIsp };
  const powerKW = craft.powerKW ?? 1000, sailArea = craft.sailArea ?? 1e6, exoticAccel = craft.exoticAccel ?? 1e-3;
  const extraMass = eng.type === 'electric' ? eng.alpha * powerKW : eng.type === 'sail' ? (craft.sailSigma ?? .008) * sailArea : eng.type === 'exotic' ? (craft.exoticMass ?? 0) : 0;
  const altM = (craft.parkAltKm ?? 200) * 1000, ve = chemIsp * G0, aero = craft.aeroFraction ?? 0;
  const flags = [], integrate = craft.integrate !== false && typeof P.ascent === 'function' && typeof P.landing === 'function';
  P.useOrientation?.(IAU);

  const rows = legs.map((leg, i) => {
    const row = { index: i, from: leg.from, to: leg.to, land: !!leg.land, days: leg.days, departJD: leg.departJD,
      arriveJD: leg.departJD + leg.days, burns: [], error: null };
    try {
      if (leg.from === leg.to) throw Error('Origin and destination are the same body.');
      if (!(leg.days > 0)) throw Error('Flight time must be positive.');
      const o = body(leg.from), d = body(leg.to), rpO = o.R + altM, rpD = d.R + altM;
      const s0 = P.planetState(leg.from, leg.departJD), s1 = P.planetState(leg.to, row.arriveJD);
      const sol = P.lambert(s0.r, s1.r, leg.days * DAY);
      row.vInfDep = norm(sub(sol.v1, s0.v));
      row.vInfArr = norm(sub(sol.v2, s1.v));
      const relief = d.rho > 0 ? aero : 0;
      const fromSurface = i === 0 ? !!craft.surfaceStart : legs[i - 1].land;
      const launchSite = i === 0 ? craft.launchSite : legs[i - 1].site;
      const simO = integrate && SIM_BODIES.includes(leg.from) && P.worlds?.[leg.from], simD = integrate && SIM_BODIES.includes(leg.to) && P.worlds?.[leg.to];
      row.ascentDV = fromSurface ? circ(o.mu, rpO) + ASCENT_LOSS : 0;
      row.departDV = escapeDV(row.vInfDep, o.mu, rpO);
      // plane change: the parking orbit must contain the departure asymptote; a launch site poleward of its declination pays for it
      row.asymptoteDec = declination(leg.from, leg.departJD, sub(sol.v1, s0.v)) / DEG;
      if (fromSurface) {
        const lat = Math.abs(siteFor(leg.from, launchSite).lat), dec = Math.abs(row.asymptoteDec);
        const di = Math.max(0, lat - dec) * DEG;
        row.planeDV = 2 * circ(o.mu, rpO) * Math.sin(di / 2);
        row.departDV += row.planeDV;
      }
      row.captureDV = escapeDV(row.vInfArr, d.mu, rpD) * (1 - relief);
      row.landDV = leg.land ? (circ(d.mu, d.R) + DESCENT_ALLOWANCE) * (1 - relief) : 0;
      if (row.ascentDV) row.burns.push({ name: 'Ascent', dv: row.ascentDV, sim: !!simO, body: leg.from, site: launchSite, jd: leg.departJD });
      row.burns.push({ name: 'Departure', dv: row.departDV });
      row.burns.push({ name: 'Capture', dv: row.captureDV });
      if (leg.land) {
        if (simD) {
          const rp = d.R + 10000, ra = d.R + altM, a = (ra + rp) / 2;
          if (d.rho <= .1) {   // airless or thin air: deorbit onto a 10 km periapsis, brake to the 100 m/s gate analytically
            const va = Math.sqrt(d.mu * (2 / ra - 1 / a)), vp = Math.sqrt(d.mu * (2 / rp - 1 / a));
            row.burns.push({ name: 'Deorbit', dv: Math.max(0, circ(d.mu, ra) - va) });
            row.burns.push({ name: 'Braking', dv: Math.max(0, vp - 100) });
          }
          row.burns.push({ name: 'Landing', dv: (circ(d.mu, d.R) + DESCENT_ALLOWANCE) * (1 - relief), sim: true, body: leg.to, site: leg.site, jd: row.arriveJD });
        } else row.burns.push({ name: 'Landing', dv: row.landDV });
      }
      // assign the engine to each burn
      const surfaceBurn = new Set(['Ascent', 'Deorbit', 'Braking', 'Landing']);
      row.rMean = (norm(s0.r) + norm(s1.r)) / 2;
      for (const b of row.burns) b.isp = surfaceBurn.has(b.name) ? chemIsp : xferIsp;
      if (eng.type === 'electric') {          // slow spiral out of / into the parking orbit, then the heliocentric Δv as vinf
        for (const b of row.burns) {
          if (b.name === 'Departure') b.dv = circ(o.mu, rpO) + row.vInfDep + (row.planeDV || 0), b.electric = true;
          if (b.name === 'Capture') b.dv = circ(d.mu, rpD) + row.vInfArr, b.electric = true;
        }
      } else if (eng.type === 'sail' || eng.type === 'exotic') {
        const out = [];
        for (const b of row.burns) {
          if (b.name === 'Departure') { b.dv = escapeDV(0, o.mu, rpO) + (row.planeDV || 0); b.isp = chemIsp; }
          if (b.name === 'Capture') { b.dv = escapeDV(0, d.mu, rpD); b.isp = chemIsp; }
          out.push(b);
          if (b.name === 'Departure') out.push({ name: eng.type === 'sail' ? 'Sail cruise' : 'Drive cruise', dv: row.vInfDep + row.vInfArr, free: true });
        }
        row.burns = out;
      }
    } catch (e) { row.error = e.message; }
    return row;
  });

  const failed = rows.filter(r => r.error);
  if (failed.length) {
    failed.forEach(r => flags.push(`Leg ${r.index + 1}: ${r.error}`));
    return { ok: false, legs: rows, totals: null, flags };
  }

  // Back-propagate from end-of-trip mass (dry + payload) through every burn, last leg first.
  let m = craft.dry + craft.payload + extraMass;
  const endMass = m;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    r.massOut = m;
    for (let k = r.burns.length - 1; k >= 0; k--) {
      const b = r.burns[k];
      b.massOut = m;
      if (b.sim) {
        try {
          const s = b.name === 'Ascent' ? simAscent(P, b.body, b.site, b.jd, m, craft, altM) : simLanding(P, b.body, b.site, b.jd, m, craft);
          if (s) {
            b.dv = s.dv; b.massIn = s.massIn; b.simResult = s.r;
            const loc = siteFor(b.body, b.site), at = `${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°`;
            if (b.name === 'Ascent') flags.push(`Leg ${i + 1} ascent integrated from ${cap(b.body)} (${at}): ${Math.round(s.dv)} m/s incl. gravity loss ${Math.round(s.r.gravityLoss)} and drag loss ${Math.round(s.r.dragLoss)} m/s.`);
            else flags.push(`Leg ${i + 1} landing integrated at ${cap(b.body)} (${at}): miss ${Math.round(s.r.miss)} m, ${s.r.pass ? 'within' : 'OUTSIDE'} touchdown limits.`);
          } else { b.sim = false; flags.push(`Leg ${i + 1} ${b.name.toLowerCase()}: integrator did not reach its target; analytic allowance used.`); }
        } catch (e) { b.sim = false; flags.push(`Leg ${i + 1} ${b.name.toLowerCase()}: integrator failed (${e.message}); analytic allowance used.`); }
      }
      if (b.free) {   // propellantless cruise: capacity from radiation pressure (sail) or the set acceleration, over the leg
        const T = r.days * DAY;
        const a = eng.type === 'sail' ? sailAccel(sailArea, m, r.rMean) : exoticAccel;
        b.capacity = a * T * (eng.eff ?? .6); b.accel = a; b.massIn = m;
        if (b.capacity < b.dv) flags.push(`Leg ${i + 1}: ${eng.name} gives ${Math.round(b.capacity)} m/s over ${Math.round(r.days)} d but the leg needs ${Math.round(b.dv)} m/s (short by ${Math.round(b.dv - b.capacity)} m/s). Lengthen the leg or enlarge the ${eng.type === 'sail' ? 'sail' : 'drive'}.`);
      }
      if (!b.massIn) b.massIn = m * Math.exp(b.dv / ((b.isp ?? chemIsp) * G0));
      b.prop = b.massIn - b.massOut;
      if (b.electric) {
        b.thrust = electricThrust(eng, powerKW);
        b.days = b.prop * (b.isp * G0) / b.thrust / DAY;
        r.thrustDays = (r.thrustDays || 0) + b.days;
      }
      m = b.massIn;
    }
    r.massIn = m;
    r.ascentDV = r.burns.filter(b => b.name === 'Ascent').reduce((s, b) => s + b.dv, 0);
    r.landDV = r.burns.filter(b => ['Deorbit', 'Braking', 'Landing'].includes(b.name)).reduce((s, b) => s + b.dv, 0);
    r.dv = r.burns.reduce((s, b) => s + b.dv, 0);
    r.prop = r.burns.reduce((s, b) => s + b.prop, 0);
    if (r.thrustDays > r.days) flags.push(`Leg ${i + 1}: electric thrusting needs ${Math.round(r.thrustDays)} d at ${powerKW} kW, longer than the ${Math.round(r.days)} d leg. Add power.`);
    r.depart = dateFromJd(r.departJD);
    r.arrive = dateFromJd(r.arriveJD);
  }

  const totals = {
    dv: rows.reduce((s, r) => s + r.dv, 0),
    prop: rows.reduce((s, r) => s + r.prop, 0),
    massStart: rows[0].massIn,
    massEnd: endMass,
    spaceProp: rows.reduce((sum, r) => sum + r.burns.filter(b => !['Ascent', 'Deorbit', 'Braking', 'Landing'].includes(b.name)).reduce((x, b) => x + b.prop, 0), 0),
    engine: eng.name, extraMass
  };
  if (craft.tank > 0 && totals.prop > craft.tank)
    flags.push(`Total propellant ${Math.round(totals.prop).toLocaleString()} kg exceeds tank capacity ${Math.round(craft.tank).toLocaleString()} kg.`);
  if (eng.note) flags.push(`${eng.name}: ${eng.note}`);
  if (!integrate) flags.push('Ascent and landing are analytic allowances (circular speed plus loss), not integrated trajectories.');
  else flags.push('Ascent: integrated, single stage (TWR 1.5 with air, 3 without), propellant bisected to reach orbit. Landing: analytic deorbit and braking to a 10 km / 100 m/s gate, then integrated terminal descent. Planets beyond Mars use analytic allowances.');
  return { ok: true, legs: rows, totals, flags };
}

// Runs the same trip with every engine and returns one summary row each (blocked engines say why).
export function compareEngines(legs, craft, P = globalThis.OrbitalPhysics) {
  return Object.keys(ENGINES).filter(id => id !== 'custom').map(id => {
    const e = ENGINES[id], base = { id, name: e.name, type: e.type };
    try {
      const res = planTrips(legs, { ...craft, engine: id }, P);
      if (res.blocked) return { ...base, ok: false, status: 'Not flyable', note: res.flags[0] };
      if (!res.ok) return { ...base, ok: false, status: 'Error', note: res.flags.join(' ') };
      const short = res.flags.filter(f => /short by|longer than/.test(f));
      const days = res.legs.reduce((s, l) => s + l.days, 0);
      return { ...base, ok: !short.length, status: short.length ? 'Underpowered' : 'OK', totals: res.totals, days,
        thrustDays: res.legs.reduce((s, l) => s + (l.thrustDays || 0), 0), note: short[0] || e.note || '' };
    } catch (err) { return { ...base, ok: false, status: 'Error', note: err.message }; }
  });
}

// Departure Δv (from parking orbit at `from`) over a grid of departure dates x flight times.
// Returns dv[i][j] in m/s (NaN where lambert has no solution), with jd[i], days[j] and the best cell in min.
export function porkchop(from, to, jdStart, jdEnd, minDays, maxDays, n = 40, opts = {}, P = globalThis.OrbitalPhysics) {
  if (!P) throw Error('OrbitalPhysics is not loaded.');
  const o = body(from); body(to);
  const rpO = o.R + (opts.parkAltKm ?? 200) * 1000;
  const jd = [], days = [], dv = [];
  for (let i = 0; i < n; i++) jd.push(jdStart + (jdEnd - jdStart) * i / (n - 1));
  for (let j = 0; j < n; j++) days.push(minDays + (maxDays - minDays) * j / (n - 1));
  let min = { dv: Infinity, i: -1, j: -1, jd: NaN, days: NaN };
  for (let i = 0; i < n; i++) {
    const row = [], s0 = P.planetState(from, jd[i]);
    for (let j = 0; j < n; j++) {
      let v = NaN;
      try {
        const s1 = P.planetState(to, jd[i] + days[j]);
        const sol = P.lambert(s0.r, s1.r, days[j] * DAY);
        v = escapeDV(norm(sub(sol.v1, s0.v)), o.mu, rpO);
      } catch (e) { v = NaN; }
      row.push(v);
      if (Number.isFinite(v) && v < min.dv) min = { dv: v, i, j, jd: jd[i], days: days[j] };
    }
    dv.push(row);
  }
  return { from, to, jd, days, dv, min };
}

// Optional UI: mounts the Trips panel into `root` (the #trips-root element on index.html).
export function mountTrips(root, P = globalThis.OrbitalPhysics) {
  const names = Object.keys(BODIES);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (x, d = 0) => Number.isFinite(x) ? x.toLocaleString(undefined, { maximumFractionDigits: d }) : '—';
  const opts = sel => names.map(n => `<option value="${n}"${n === sel ? ' selected' : ''}>${cap(n)}</option>`).join('');
  const state = { legs: [
    { from: 'earth', to: 'mars', date: '2028-12-05', days: 260, land: true },
    { from: 'mars', to: 'earth', date: '2030-11-06', days: 321, land: false }
  ] };
  let lastGrid = null;

  const style = `<style>
    .tripLeg{display:grid;grid-template-columns:70px repeat(7,minmax(0,1fr)) auto;gap:10px;align-items:end;margin:10px 0}
    .tripLeg label.check,.trip-grid label.check{display:flex;gap:8px;align-items:center}
    .tripLeg label.check input,.trip-grid label.check input{width:auto;margin:0}
    .trip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}
    #tripCanvas{width:100%;height:340px;display:block;margin-top:12px;border:1px solid #424242;border-radius:7px}
    @media (max-width:820px){.tripLeg{grid-template-columns:1fr 1fr}.tripLeg>strong{grid-column:1/-1}}
  </style>`;

  root.innerHTML = style + `
    <p class="hint" id="tripCraft"></p>
    <div class="trip-grid">
      <label>Engine<select id="tripEngine">${Object.entries(ENGINES).map(([k, e]) => `<option value="${k}">${e.name}</option>`).join('')}</select></label>
      <label class="engElec">Electric power · kW<input id="tripPower" type="number" min="1" value="1000"></label>
      <label class="engSail">Sail area · m²<input id="tripSail" type="number" min="1" value="1000000"></label>
      <label class="engSail">Sail areal mass · kg/m²<input id="tripSigma" type="number" min="0.001" step="any" value="0.008"></label>
      <label class="engExotic">Drive acceleration · m/s²<input id="tripAccel" type="number" min="0" step="any" value="0.001"></label>
      <label>Payload · kg<input id="tripPayload" type="number" min="0" value="500"></label>
      <label>Parking orbit altitude · km<input id="tripPark" type="number" min="150" value="200"></label>
      <label>Aerobrake relief · %<input id="tripAero" type="number" min="0" max="100" value="0"></label>
      <label class="check"><input id="tripSurface" type="checkbox" checked> Leg 1 launches from origin surface</label>
      <label>Launch site lat · °<input id="tripLat" type="number" min="-90" max="90" step="any" placeholder="28.5"></label>
      <label>Launch site lon · °<input id="tripLon" type="number" min="-180" max="360" step="any" placeholder="-80.6"></label>
      <label class="check"><input id="tripSim" type="checkbox" checked> Integrate ascent and landing</label>
    </div>
    <div id="tripLegs"></div>
    <button id="tripAdd">+ Add leg</button>
    <button id="tripRun" class="primary">Plan trips</button>
    <button id="tripCompare">Compare engines</button>
    <div id="tripResult"></div>
    <div id="tripCompareOut"></div>
    <h3>Launch window (porkchop)</h3>
    <div class="trip-grid">
      <label>Leg to scan<select id="pcLeg"></select></label>
      <label>Window start<input id="pcStart" type="date" value="2028-06-01"></label>
      <label>Window end<input id="pcEnd" type="date" value="2029-12-31"></label>
      <label>Min flight · days<input id="pcMin" type="number" min="1" value="120"></label>
      <label>Max flight · days<input id="pcMax" type="number" min="1" value="400"></label>
    </div>
    <button id="pcRun">Plot window</button>
    <canvas id="tripCanvas" aria-label="Porkchop plot of departure delta-v"></canvas>
    <p class="hint" id="pcInfo">Click a cell to set the scanned leg's departure date and flight time, then plan again.</p>`;

  const $ = id => root.querySelector('#' + id);
  const craftFromTab = () => {
    const g = id => document.getElementById(id);
    return {
      dry: Number(g('dry')?.value) || 0,
      tank: Number(g('tank')?.value) || 0,
      isp: Number(g('isp')?.value) || 0,
      payload: Number($('tripPayload').value) || 0,
      parkAltKm: Number($('tripPark').value) || 0,
      aeroFraction: (Number($('tripAero').value) || 0) / 100,
      engine: $('tripEngine').value,
      powerKW: Number($('tripPower').value) || 1000,
      sailArea: Number($('tripSail').value) || 1e6,
      sailSigma: Number($('tripSigma').value) || .008,
      exoticAccel: Number($('tripAccel').value) || 0,
      surfaceStart: $('tripSurface').checked,
      integrate: $('tripSim').checked,
      launchSite: $('tripLat').value !== '' && $('tripLon').value !== '' ? { lat: +$('tripLat').value, lon: +$('tripLon').value } : undefined
    };
  };
  const readLegs = () => [...root.querySelectorAll('.tripLeg')].map(r => ({
    from: r.querySelector('.tf').value, to: r.querySelector('.tt').value,
    date: r.querySelector('.td').value, days: Number(r.querySelector('.tday').value),
    land: r.querySelector('.tl').checked, lat: r.querySelector('.tlat').value, lon: r.querySelector('.tlon').value
  }));
  const renderLegs = () => {
    $('tripLegs').innerHTML = state.legs.map((l, i) => `<div class="tripLeg" data-leg="${i}">
      <strong>Leg ${i + 1}</strong>
      <label>From<select class="tf">${opts(l.from)}</select></label>
      <label>To<select class="tt">${opts(l.to)}</select></label>
      <label>Depart<input class="td" type="date" value="${l.date}"></label>
      <label>Flight · days<input class="tday" type="number" min="1" max="2000" value="${l.days}"></label>
      <label class="check"><input class="tl" type="checkbox"${l.land ? ' checked' : ''}> Land</label>
      <label>Land lat °<input class="tlat" type="number" step="any" value="${l.lat ?? ''}"></label>
      <label>Land lon °<input class="tlon" type="number" step="any" value="${l.lon ?? ''}"></label>
      <button data-rm="${i}"${state.legs.length === 1 ? ' disabled' : ''}>Remove</button></div>`).join('');
    $('tripAdd').disabled = state.legs.length >= 3;
    $('pcLeg').innerHTML = state.legs.map((l, i) => `<option value="${i}">Leg ${i + 1}</option>`).join('');
    const c = craftFromTab();
    $('tripCraft').innerHTML = `Craft from Craft &amp; engines: dry ${fmt(c.dry)} kg · Isp ${fmt(c.isp)} s · tank ${fmt(c.tank)} kg. `
      + `<button data-tab="vehicle">Edit craft</button>`;
  };

  const renderResult = res => {
    const cards = res.totals ? `<div class="labmetrics">
        <div class="metric"><span>TOTAL Δv</span><strong>${fmt(res.totals.dv / 1000, 3)} <small>km/s</small></strong></div>
        <div class="metric"><span>TOTAL PROPELLANT</span><strong>${fmt(res.totals.prop)} <small>kg</small></strong></div>
        <div class="metric"><span>START MASS</span><strong>${fmt(res.totals.massStart)} <small>kg</small></strong></div>
        <div class="metric"><span>END MASS</span><strong>${fmt(res.totals.massEnd)} <small>kg</small></strong></div></div>` : '';
    const rowHtml = r => r.error
      ? `<tr><td>${r.index + 1}</td><td colspan="11">${esc(r.error)}</td></tr>`
      : `<tr><td>${r.index + 1}</td><td>${cap(r.from)} → ${cap(r.to)}</td><td>${r.depart}</td><td>${r.arrive}</td>
          <td>${fmt(r.ascentDV)}</td><td>${fmt(r.departDV)}</td><td>${fmt(r.captureDV)}</td><td>${fmt(r.landDV)}</td>
          <td>${fmt(r.dv)}</td><td>${fmt(r.prop)}</td><td>${fmt(r.massIn)}</td><td>${fmt(r.massOut)}</td></tr>`;
    const total = res.totals ? `<tr><td colspan="8"><strong>Total</strong></td><td><strong>${fmt(res.totals.dv)}</strong></td>
        <td><strong>${fmt(res.totals.prop)}</strong></td><td colspan="2"></td></tr>` : '';
    $('tripResult').innerHTML = cards + `<div class="tableWrap"><table><thead><tr>
        <th>Leg</th><th>Route</th><th>Depart</th><th>Arrive</th><th>Ascent m/s</th><th>Depart m/s</th>
        <th>Capture m/s</th><th>Landing m/s</th><th>Leg Δv m/s</th><th>Propellant kg</th><th>Mass in kg</th><th>Mass out kg</th>
      </tr></thead><tbody>${res.legs.map(rowHtml).join('')}${total}</tbody></table></div>
      <ul class="hint">${res.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
  };

  const showEngineFields = () => {
    const t = ENGINES[$('tripEngine').value].type;
    root.querySelectorAll('.engElec').forEach(e => e.style.display = t === 'electric' ? '' : 'none');
    root.querySelectorAll('.engSail').forEach(e => e.style.display = t === 'sail' ? '' : 'none');
    root.querySelectorAll('.engExotic').forEach(e => e.style.display = t === 'exotic' ? '' : 'none');
  };
  const compare = () => {
    try {
      state.legs = readLegs();
      const legs = state.legs.map(l => ({ from: l.from, to: l.to, departJD: jdFromDate(l.date), days: l.days, land: l.land, site: l.lat !== '' && l.lon !== '' && l.lat != null ? { lat: +l.lat, lon: +l.lon } : undefined }));
      const rows = compareEngines(legs, craftFromTab(), P);
      $('tripCompareOut').innerHTML = `<h3>Engine comparison</h3><div class="tableWrap"><table><thead><tr><th>Engine</th><th>Type</th><th>Status</th>
        <th>Propellant kg</th><th>In-space propellant kg</th><th>Start mass kg</th><th>Total Δv m/s</th><th>Thrust days</th><th>Note</th></tr></thead><tbody>${rows.map(r => `<tr>
        <td>${esc(r.name)}</td><td>${r.type}</td><td>${r.status}</td><td>${r.totals ? fmt(r.totals.prop) : '—'}</td>
        <td>${r.totals ? fmt(r.totals.spaceProp) : '—'}</td><td>${r.totals ? fmt(r.totals.massStart) : '—'}</td><td>${r.totals ? fmt(r.totals.dv) : '—'}</td>
        <td>${r.thrustDays ? fmt(r.thrustDays) : '—'}</td><td>${esc(r.note || '')}</td></tr>`).join('')}</tbody></table></div>`;
    } catch (e) { $('tripCompareOut').innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
  };
  const plan = () => {
    try {
      state.legs = readLegs();
      const legs = state.legs.map(l => ({ from: l.from, to: l.to, departJD: jdFromDate(l.date), days: l.days, land: l.land, site: l.lat !== '' && l.lon !== '' && l.lat != null ? { lat: +l.lat, lon: +l.lon } : undefined }));
      renderResult(planTrips(legs, craftFromTab(), P));
    } catch (e) { $('tripResult').innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
  };

  const drawPorkchop = grid => {
    const c = $('tripCanvas'), dpr = globalThis.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const n = grid.jd.length, pL = 64, pB = 36, pT = 12, pR = 12;
    const pw = W - pL - pR, ph = H - pT - pB, cw = pw / n, ch = ph / n;
    const finite = grid.dv.flat().filter(Number.isFinite).sort((a, b) => a - b);
    const lo = finite[0] ?? 0, hi = finite[Math.floor(0.6 * (finite.length - 1))] ?? 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = grid.dv[i][j];
      const x = pL + i * cw, y = pT + (n - 1 - j) * ch;
      if (!Number.isFinite(v)) { ctx.fillStyle = '#1a1a1a'; }
      else {
        const t = Math.min(1, Math.max(0, (v - lo) / ((hi - lo) || 1)));
        ctx.fillStyle = `hsl(${120 * (1 - t)},70%,45%)`;
      }
      ctx.fillRect(x, y, cw + 0.5, ch + 0.5);
    }
    if (grid.min.i >= 0) {
      const x = pL + (grid.min.i + 0.5) * cw, y = pT + (n - 1 - grid.min.j + 0.5) * ch;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = '#9a9a9a'; ctx.font = '11px sans-serif';
    ctx.fillText(dateFromJd(grid.jd[0]), pL, H - 12);
    ctx.textAlign = 'right'; ctx.fillText(dateFromJd(grid.jd[n - 1]), W - pR, H - 12); ctx.textAlign = 'left';
    ctx.fillText('Departure', pL + pw / 2 - 30, H - 12 + 0);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(grid.days[0])} d`, pL - 6, H - pB);
    ctx.fillText(`${Math.round(grid.days[n - 1])} d`, pL - 6, pT + 10);
    ctx.textAlign = 'left';
  };

  root.addEventListener('change', e => { if (e.target.id === 'tripEngine') showEngineFields(); });
  showEngineFields();
  root.addEventListener('click', e => {
    const t = e.target;
    if (t.dataset.tab) { document.querySelector(`[data-tab="${t.dataset.tab}"]`)?.click(); return; }
    if (t.dataset.rm !== undefined) { state.legs = readLegs(); state.legs.splice(+t.dataset.rm, 1); renderLegs(); return; }
    if (t.id === 'tripAdd') { state.legs = readLegs(); if (state.legs.length < 3) state.legs.push({ ...state.legs.at(-1), land: false }); renderLegs(); return; }
    if (t.id === 'tripRun') { plan(); return; }
    if (t.id === 'tripCompare') { compare(); return; }
    if (t.id === 'pcRun') {
      try {
        state.legs = readLegs();
        const li = Number($('pcLeg').value), L = state.legs[li];
        const grid = porkchop(L.from, L.to, jdFromDate($('pcStart').value), jdFromDate($('pcEnd').value),
          Number($('pcMin').value), Number($('pcMax').value), 48, { parkAltKm: Number($('tripPark').value) || 200 }, P);
        grid.leg = li; lastGrid = grid;
        drawPorkchop(grid);
        const m = grid.min;
        $('pcInfo').textContent = Number.isFinite(m.dv)
          ? `Lowest departure Δv ${fmt(m.dv)} m/s on ${dateFromJd(m.jd)} with a ${Math.round(m.days)} day flight. Click a cell to use it for leg ${li + 1}.`
          : 'No lambert solution in this window. Widen the dates or flight times.';
      } catch (err) { $('pcInfo').textContent = err.message; }
    }
  });
  $('tripCanvas').addEventListener('click', e => {
    if (!lastGrid) return;
    const c = e.currentTarget, rect = c.getBoundingClientRect(), n = lastGrid.jd.length;
    const pL = 64, pB = 36, pT = 12, pR = 12, pw = rect.width - pL - pR, ph = rect.height - pT - pB;
    const i = Math.floor((e.clientX - rect.left - pL) / (pw / n)), j = n - 1 - Math.floor((e.clientY - rect.top - pT) / (ph / n));
    if (i < 0 || j < 0 || i >= n || j >= n) return;
    const row = root.querySelectorAll('.tripLeg')[lastGrid.leg];
    if (!row) return;
    row.querySelector('.td').value = dateFromJd(lastGrid.jd[i]);
    row.querySelector('.tday').value = Math.round(lastGrid.days[j]);
    $('pcInfo').textContent = `Leg ${lastGrid.leg + 1} set to depart ${dateFromJd(lastGrid.jd[i])} with a ${Math.round(lastGrid.days[j])} day flight.`;
  });

  renderLegs();
  return { plan, state };
}
