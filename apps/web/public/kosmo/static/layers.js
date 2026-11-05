// layers.js — shared state for the optional planet layers (atmospheres, clouds, aurora, magnetosphere, solar wind, radiation belts)
// and the solar-wind model they respond to. No three.js dependency: the UI (the Layers button in universe-timeline.html) writes here,
// and atmospheres.js / magnetosphere.js read it every frame, so toggling needs no event plumbing.
//
//   layers.state.magnetosphere        boolean flags, persisted in localStorage
//   layers.wind                       { speed km/s, density protons/cm^3 at 1 AU, bz nT }  (quiet wind: 400, 5, 0)
//   layers.now(dAU)                   the wind a planet at heliocentric distance dAU feels right now (includes a running storm)
//   layers.standoff(Beq, dAU)         magnetopause stand-off distance in planetary radii, from pressure balance
//   layers.storm()                    fire a CME-like pulse: faster, denser, southward Bz, then it decays
const KEY = 'kosmoLayers';
const DEFAULTS = { atmosphere: true, clouds: true, aurora: true, magnetosphere: false, wind: false, belts: false };
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const MU0 = 4e-7 * Math.PI, MP = 1.6726e-27;

const listeners = new Set();
export const layers = {
  state: { ...DEFAULTS, ...read() },
  wind: { speed: 400, density: 5, bz: 0 },
  stormT0: -1e12,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  set(key, on) {
    this.state[key] = !!on;
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage blocked */ }
    for (const f of listeners) f(key);
  },
  setWind(patch) { Object.assign(this.wind, patch); for (const f of listeners) f('wind'); },
  storm() { this.stormT0 = performance.now(); for (const f of listeners) f('storm'); },
  // storm envelope 0..1: ramps up in 3 s, holds 6 s, relaxes over 14 s
  stormLevel(ms = performance.now()) { const t = (ms - this.stormT0) / 1000; if (t < 0 || t > 23) return 0; return t < 3 ? t / 3 : t < 9 ? 1 : 1 - (t - 9) / 14; },
  // the wind at heliocentric distance dAU: density falls as 1/r^2, speed stays; a storm multiplies both and turns Bz south
  now(dAU = 1, ms = performance.now()) {
    const e = this.stormLevel(ms), d2 = Math.max(0.05, dAU) ** 2;
    const speed = this.wind.speed * (1 + 1.2 * e), density = this.wind.density * (1 + 9 * e) / d2, bz = this.wind.bz - 18 * e;
    const pdyn = 1.15 * MP * density * 1e6 * (speed * 1e3) ** 2;   // Pa, with ~4% helium
    return { speed, density, bz, storm: e, pdyn };
  },
  // Chapman-Ferraro pressure balance: r0 / R = ( (f Beq)^2 / (2 mu0 Pdyn) )^(1/6), f ~ 2.4 for the compressed dipole; southward Bz erodes it a little
  standoff(Beq, dAU = 1, ms = performance.now()) {
    const w = this.now(dAU, ms), r0 = (((2.4 * Beq) ** 2) / (2 * MU0 * w.pdyn)) ** (1 / 6);
    return Math.max(1.05, r0 * (1 - 0.012 * Math.max(0, -w.bz)));
  },
};
