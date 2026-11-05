// propulsion.js: engine catalogue for the trip planner. SI units; isp in seconds, alpha in kg per kW of electric power.
// type 'rocket'   : chemical/thermal/fusion-style reaction engine, impulsive burns by the rocket equation.
// type 'electric' : power-limited (F = 2*eta*P/(g0*Isp)); can only fly the in-space burns as a slow spiral, so ascent and landing use `aux`.
// type 'sail'     : propellantless, acceleration from radiation pressure (1/r^2), cruise only.
// type 'exotic'   : propellantless, constant user-set acceleration (stand-in for a "ring drive" or similar), cruise only.
// type 'blocked'  : cannot be flown in the solar system; `why` explains.

export const SOLAR_FLUX = 1361;          // W/m^2 at 1 AU
export const C = 299792458, AU = 1.495978707e11;
export const SAIL_PRESSURE = 2 * SOLAR_FLUX / C;   // N/m^2 on a perfect reflector facing the Sun at 1 AU (~9.08e-6)

export const ENGINES = {
  custom:     { name: 'Custom (use the Isp field)', type: 'rocket', surface: true },
  solid:      { name: 'Solid motor', type: 'rocket', isp: 265, surface: true },
  hypergolic: { name: 'Hypergolic (NTO/MMH)', type: 'rocket', isp: 320, surface: true },
  kerolox:    { name: 'Kerolox (RP-1/LOX)', type: 'rocket', isp: 330, surface: true },
  methalox:   { name: 'Methalox (CH4/LOX)', type: 'rocket', isp: 370, surface: true },
  hydrolox:   { name: 'Hydrolox (LH2/LOX)', type: 'rocket', isp: 450, surface: true },
  ntr:        { name: 'Nuclear thermal (NERVA class)', type: 'rocket', isp: 900, surface: false,
                note: 'Ascent and landing on chemical; NTR for in-space burns.' },
  fusion:     { name: 'Fusion rocket (conceptual)', type: 'rocket', isp: 30000, surface: false,
                note: 'Assumes high thrust, which no fusion design has shown. Optimistic.' },
  antimatter: { name: 'Antimatter beamed core (conceptual)', type: 'rocket', isp: 5.0e6, surface: false,
                note: 'Ideal exhaust, ignores production cost and storage mass. Optimistic.' },
  hall:       { name: 'Hall thruster (SEP)', type: 'electric', isp: 2000, eta: .6, alpha: 20, aux: 370 },
  ion:        { name: 'Gridded ion (NEXT class)', type: 'electric', isp: 4200, eta: .7, alpha: 25, aux: 370 },
  vasimr:     { name: 'VASIMR plasma', type: 'electric', isp: 5000, eta: .65, alpha: 10, aux: 370 },
  nep:        { name: 'Nuclear-electric ion', type: 'electric', isp: 6000, eta: .7, alpha: 12, aux: 370 },
  sail:       { name: 'Solar sail', type: 'sail', aux: 370, eff: .6,
                note: 'Cruise only. Escape and capture burns, ascent and landing use the chemical aux stage.' },
  ring:       { name: 'Ring drive (parametric)', type: 'exotic', aux: 370, eff: .9,
                note: 'No known physics: a constant acceleration you set. Treat as a what-if.' },
  halo:       { name: 'Halo drive (Kipping)', type: 'blocked',
                why: 'The Halo drive bounces light off a stellar-mass black hole in its halo orbit for fuel-free boosts. No such object is anywhere near the solar system, so it cannot fly these legs.' }
};

export const engineOf = id => ENGINES[id] || ENGINES.custom;

// Radiation-pressure acceleration at distance r (m) from the Sun for sail area A (m^2) and total mass m (kg).
export const sailAccel = (A, m, r) => SAIL_PRESSURE * A / m * (AU / r) ** 2;

// Thrust (N) of a power-limited electric engine.
export const electricThrust = (eng, powerKW) => 2 * eng.eta * powerKW * 1000 / (eng.isp * 9.80665);
