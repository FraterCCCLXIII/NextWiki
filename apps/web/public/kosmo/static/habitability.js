// Habitability prior: a Drake-style chain life * complex * tech. A PRIOR from catalog data, not a detection.
// Every factor is returned with a provenance tag: 'catalog' | 'modelled' | 'assumed'.

export const DEFAULT_PRIORS = {
  fLife: 0.3,     // P(life | habitable-ish environment); wide uncertainty (1e-3..1)
  fComplex: 0.1,  // P(complex life | life); needs Gyr of stability
  fTech: 0.01,    // P(technology | complex life)
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const SPEC_SUIT = { O: 0.02, B: 0.08, A: 0.3, F: 0.8, G: 1.0, K: 0.85, M: 0.45, L: 0.05, T: 0.02, D: 0.05 };

/** 0..1 from spectral class / temperature. Unknown -> 0.5 'assumed'. */
export function stellarSuitability(star) {
  const sp = star && typeof star.spectral_type === "string" ? star.spectral_type.trim().toUpperCase() : "";
  const cls = sp[0];
  if (cls && SPEC_SUIT[cls] != null) return { value: SPEC_SUIT[cls], provenance: "catalog" };
  const T = num(star && star.temperature_K);
  if (T != null) {
    const v = Math.exp(-Math.pow((T - 5500) / 2200, 2));
    return { value: clamp01(Math.max(v, 0.02)), provenance: "modelled" };
  }
  return { value: 0.5, provenance: "assumed" };
}

/** Conservative habitable-zone score from luminosity & orbit (AU), else planet temperature. */
export function hzScore(planet, star) {
  const a = num(planet && planet.semi_major_axis_m);
  const Lw = num(star && star.luminosity_W);
  if (a != null && Lw != null && Lw > 0) {
    const aAu = a / 1.495978707e11;
    const Ls = Lw / 3.828e26;
    const inner = Math.sqrt(Ls / 1.1), outer = Math.sqrt(Ls / 0.53);
    if (aAu >= inner && aAu <= outer) return { value: 1, provenance: "catalog" };
    const d = aAu < inner ? (inner - aAu) / inner : (aAu - outer) / outer;
    return { value: clamp01(Math.exp(-d * 3)), provenance: "catalog" };
  }
  const T = num(planet && planet.temperature_K);
  if (T != null) return { value: clamp01(Math.exp(-Math.pow((T - 288) / 60, 2))), provenance: "catalog" };
  return { value: 0.5, provenance: "assumed" };
}

/** Earth Similarity Index (Schulze-Makuch form) from radius, density-proxy and temperature. */
export function esi(planet) {
  const r = num(planet && planet.radius_m), m = num(planet && planet.mass_kg), T = num(planet && planet.temperature_K);
  const parts = [];
  const term = (x, x0, w) => 1 - Math.abs((x - x0) / (x + x0));
  if (r != null) parts.push(Math.pow(term(r / 6.371e6, 1, 1), 0.57));
  if (m != null) parts.push(Math.pow(term(m / 5.972e24, 1, 1), 0.3));
  if (T != null) parts.push(Math.pow(term(T, 288, 1), 5.58 / 2));
  if (!parts.length) return { value: 0.5, provenance: "assumed" };
  const v = Math.pow(parts.reduce((p, c) => p * Math.max(c, 1e-6), 1), 1 / parts.length);
  return { value: clamp01(v), provenance: "catalog" };
}

/** Galactic habitable zone: peak ~8 kpc, suppressed in bulge, far outskirts and high |z|. */
export function galacticHabitability(rPc, zPc = 0) {
  const r = rPc / 1000;
  const radial = Math.exp(-Math.pow((r - 8) / 3.2, 2));
  const inner = r < 3 ? Math.max(0.05, r / 3) : 1;
  const vertical = Math.exp(-Math.pow(zPc / 600, 2));
  return clamp01(radial * inner * vertical);
}

/** score = life * complex * tech, each shown with its factors. ctx:{planets,rPc,zPc,priors} */
export function scoreStar(star, ctx = {}) {
  const priors = { ...DEFAULT_PRIORS, ...(ctx.priors || {}) };
  const st = stellarSuitability(star);
  let hz = { value: 0.5, provenance: "assumed" }, es = { value: 0.5, provenance: "assumed" };
  const planets = ctx.planets || [];
  if (planets.length) {
    hz = { value: 0, provenance: "catalog" }; es = { value: 0, provenance: "catalog" };
    for (const p of planets) {
      const h = hzScore(p, star), e = esi(p);
      if (h.value * e.value >= hz.value * es.value) { hz = h; es = e; }
    }
  }
  const hasPos = ctx.rPc != null;
  const gal = hasPos ? galacticHabitability(ctx.rPc, ctx.zPc || 0) : 0.7;
  const galProv = hasPos ? "modelled" : "assumed";
  const env = clamp01(0.35 * st.value + 0.3 * hz.value + 0.2 * es.value + 0.15 * gal);
  const life = priors.fLife * env;
  const complex = life * priors.fComplex * st.value;
  const tech = complex * priors.fTech;
  const factors = { stellar: st.value, hz: hz.value, esi: es.value, galactic: gal };
  const provenance = { stellar: st.provenance, hz: hz.provenance, esi: es.provenance, galactic: galProv };
  const why = Object.keys(factors).map((k) => `${k} ${factors[k].toFixed(2)} (${provenance[k]})`).join(" · ");
  return { score: clamp01(env), life, complex, tech, factors, provenance, why };
}

export function scoreStars(stars, planetsByParentName = {}, opts = {}) {
  const out = new Map();
  for (const s of stars) {
    const pl = planetsByParentName[s.name] || [];
    out.set(s.id, scoreStar(s, { ...opts, planets: pl }));
  }
  return out;
}
