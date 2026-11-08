/* flasher.js -- the hexagonal rotational fold ("flasher") the Centauri sails stow by.

   The old sail was a square pleat pack: five straight hinges, six panels, fold along the axes. It
   stows to half a side, which is a fine map fold and a poor sail, and its stowed envelope had
   nothing to do with its fold. This module replaces it with the rotational pattern the current
   literature uses for thin-film sails: an m = 6 flasher -- a hexagonal hub, six pinwheel gores, a
   shoulder ring and the outer hexagon.

   PROVENANCE. The design comes from a 2025 Springer chapter, "Research on Solar Sail Design and
   Control Based on Origami ..." (doi 10.1007/978-981-96-2256-6_31), whose accessible abstract
   reports an origami sail simulated in Origami Simulator, a ground prototype, and four patterns
   compared by folding ratio. The chapter's full text is paywalled, so its exact crease coordinates,
   its mountain/valley assignment and its definition of lambda are NOT available. What is built here
   is therefore the hexagonal flasher family the figures show, with every free parameter either
   solved from flat-foldability or stated as our own choice:

     * lambda is OUR definition: the projected film area fraction, lambda = A(lambda)/A(1). It is
       chosen because it reproduces the figure's own stage list -- a stowed state at lambda = 0.026
       is 6.2:1 across (1/sqrt(lambda)), which is what the folded figure shows -- and because area is
       the one quantity a flasher deployment can be measured by without a kinematic model.
     * The stage boundaries are the figure's: rotation ends at lambda = 0.178, expansion runs to 1.
     * The shoulder radius is NOT chosen: for a given pinwheel offset it is solved so that Kawasaki's
       condition holds exactly at every interior vertex, which is what makes the pattern fold flat.
     * The mountain/valley assignment follows Maekawa: three mountains and one valley at each
       interior vertex, which is the only flat-foldable assignment for a degree-4 vertex.
     * The hub twist is 60 degrees at full stow (one gore pitch), which is the limit before the gores
       overlap themselves. The paper's value is unknown; this is the physical bound.

   KINEMATICS. Two stages, driven by one parameter:

     rotation  (lambda_fold .. lambda_twist): the hub ring turns by theta, the shoulder ring by
               theta/2 and the outer ring not at all. The difference cannot be taken up in plane
               without stretching the film, so each gore buckles out of plane: that is the twisted
               star of the deployment sequence, and the buckle amplitude is proportional to sin(theta).
     expansion (lambda_twist .. 1): theta = 0 and every radius scales with sqrt(lambda), so the
               hexagon grows similarity-wise to the flat film.

   Pure geometry, no DOM and no three.js, so the node checks verify the same numbers the model draws.
*/

const TAU = Math.PI * 2;

/** The pattern constants. `HUB_FRAC` and `PINWHEEL` are design choices; `SHOULDER` is solved. */
export const FLASHER = {
  sectors: 6,
  hubFrac: 0.14,          // hub circumradius / outer circumradius
  pinwheel: Math.PI / 10, // 18 degrees: the angular offset of the shoulder ring
  foldLambda: 0.026,      // the figure's fully folded state
  twistLambda: 0.178,     // the figure's end of the rotation stage
  twistMax: Math.PI / 3,  // 60 degrees, one gore pitch, the self-overlap limit
  layers: 3               // hub + shoulder + outer: three thicknesses in the pack
};

export const SECTOR = TAU / FLASHER.sectors;
export const LAMBDA_FOLD = FLASHER.foldLambda;
export const LAMBDA_TWIST = FLASHER.twistLambda;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];

/**
 * Kawasaki's residual at the shoulder vertex of sector 0: for a flat-foldable interior vertex the
 * four sector angles must satisfy a1 + a3 = a2 + a4 = pi. Zero means flat-foldable.
 */
export function kawasakiResidual({ rho = FLASHER.hubFrac, r1, delta = FLASHER.pinwheel } = {}) {
  const s = polar(r1, delta);
  const targets = [polar(rho, 0), polar(1, 0), polar(r1, delta + SECTOR), polar(r1, delta - SECTOR)];
  const dirs = targets.map((q) => Math.atan2(q[1] - s[1], q[0] - s[0])).sort((a, b) => a - b);
  const gaps = dirs.map((a, i) => (i === 3 ? dirs[0] + TAU - a : dirs[i + 1] - a));
  return gaps[0] + gaps[2] - (gaps[1] + gaps[3]);
}

/**
 * The shoulder radius that makes the pattern flat-foldable for a given pinwheel offset. Bisects the
 * residual, which changes sign between a shoulder close to the hub and one close to the rim.
 */
export function solveShoulder({ rho = FLASHER.hubFrac, delta = FLASHER.pinwheel } = {}) {
  let lo = 0.20, hi = 0.95;
  let fLo = kawasakiResidual({ rho, r1: lo, delta });
  for (let x = lo; x < hi; x += 0.005) {
    const fHi = kawasakiResidual({ rho, r1: x + 0.005, delta });
    if (fLo * fHi <= 0) {
      let a = x, b = x + 0.005, fa = fLo;
      for (let i = 0; i < 80; i += 1) {
        const m = (a + b) / 2, fm = kawasakiResidual({ rho, r1: m, delta });
        if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
      }
      return (a + b) / 2;
    }
    lo = x;
    fLo = fHi;
  }
  throw new Error('flasher: no shoulder radius satisfies Kawasaki');
}

export const SHOULDER = solveShoulder();

/** Outer circumradius of a hexagonal film carrying `areaM2` of membrane around a hub hole. */
export function flasherRadius(areaM2, { rho = FLASHER.hubFrac } = {}) {
  const k = (3 * Math.sqrt(3)) / 2;
  return Math.sqrt(Math.max(0, areaM2) / (k * (1 - rho * rho)));
}

/** Twist angle at a given lambda: full at the stowed state, zero once the rotation stage is over. */
export function twistAt(lambda) {
  if (lambda >= LAMBDA_TWIST) return 0;
  const t = (LAMBDA_TWIST - lambda) / (LAMBDA_TWIST - LAMBDA_FOLD);
  return FLASHER.twistMax * clamp(t, 0, 1);
}

/** Out-of-plane buckle of the shoulder ring. The twist cannot be absorbed in plane without
 *  stretching, so the gores leave the plane; the amplitude goes as sin(theta), which is zero when
 *  the film is flat and largest at full stow. */
export function buckleAt(lambda, radiusM) {
  return 0.12 * radiusM * Math.sin(twistAt(lambda));
}

/**
 * Vertex positions at a deployment lambda, in minutes of the outer radius. Each ring is returned as
 * an array of [x, y, z] -- the film lies in XZ with +y as its normal, the frame the CAD uses.
 * `deploy` returns the same numbers plus the stage label.
 */
export function deploy(lambda, { radiusM = 1, rho = FLASHER.hubFrac, r1 = SHOULDER, delta = FLASHER.pinwheel } = {}) {
  const lam = clamp(lambda, LAMBDA_FOLD, 1);
  const s = Math.sqrt(lam);
  const R = radiusM * s;
  const theta = twistAt(lam);
  const buckle = buckleAt(lam, R);
  const H = [], S = [], O = [];
  for (let i = 0; i < FLASHER.sectors; i += 1) {
    const a = SECTOR * i;
    /* The hub turns by theta, the shoulder by half of it, the rim not at all: that lag is the
       winding. The buckle alternates sign sector to sector, which is the first antisymmetric mode. */
    const ph = polar(rho * R, a + theta);
    const ps = polar(r1 * R, a + delta + theta * 0.5);
    const po = polar(R, a);
    H.push([ph[0], 0, ph[1]]);
    S.push([ps[0], buckle * Math.sin(2 * (a + theta)), ps[1]]);
    O.push([po[0], 0, po[1]]);
  }
  return {
    lambda: lam, scale: s, twist: theta, stage: lam < LAMBDA_TWIST ? 'rotation' : 'expansion',
    radiusM: R, points: { H, S, O }
  };
}

/** The twelve gores that tile the film, as index quads into a flat vertex list. */
export function faces({ rho = FLASHER.hubFrac, r1 = SHOULDER, delta = FLASHER.pinwheel } = {}) {
  const v = [];
  const at = (p) => { v.push(p); return v.length - 1; };
  const H = [], S = [], O = [];
  for (let i = 0; i < FLASHER.sectors; i += 1) {
    const a = SECTOR * i;
    H.push(at([rho * Math.cos(a), 0, rho * Math.sin(a)]));
    S.push(at([r1 * Math.cos(a + delta), 0, r1 * Math.sin(a + delta)]));
    O.push(at([Math.cos(a), 0, Math.sin(a)]));
  }
  const quads = [];
  for (let i = 0; i < FLASHER.sectors; i += 1) {
    const j = (i + 1) % FLASHER.sectors;
    quads.push({ id: `inner-${i}`, ring: 'inner', corners: [H[i], H[j], S[j], S[i]], sector: i });
    quads.push({ id: `outer-${i}`, ring: 'outer', corners: [S[i], S[j], O[j], O[i]], sector: i });
  }
  return { vertices: v, quads, index: { H, S, O } };
}

/**
 * The crease list with its mountain/valley assignment. Interior vertices are the shoulder ring:
 * each has two spokes and two shoulder edges, and Maekawa's rule (|M - V| = 2) forces three of one
 * kind and one of the other, which is assigned by alternating the shoulder edges.
 */
export function creases() {
  const out = [];
  for (let i = 0; i < FLASHER.sectors; i += 1) {
    const j = (i + 1) % FLASHER.sectors;
    out.push({ id: `hub-${i}`, a: ['H', i], b: ['H', j], kind: 'cut' });
    out.push({ id: `shoulder-${i}`, a: ['S', i], b: ['S', j], kind: i % 2 ? 'valley' : 'mountain' });
    out.push({ id: `rim-${i}`, a: ['O', i], b: ['O', j], kind: 'edge' });
    out.push({ id: `spoke-in-${i}`, a: ['H', i], b: ['S', i], kind: 'mountain' });
    out.push({ id: `spoke-out-${i}`, a: ['S', i], b: ['O', i], kind: 'mountain' });
  }
  return out;
}

/** Maekawa's rule at every interior vertex: mountains and valleys differ by two. */
export function maekawa() {
  const at = new Map();
  for (const c of creases()) {
    if (c.kind === 'cut' || c.kind === 'edge') continue;
    for (const end of [c.a, c.b]) {
      if (end[0] !== 'S') continue;
      const k = end[1];
      at.set(k, (at.get(k) ?? 0) + (c.kind === 'mountain' ? 1 : -1));
    }
  }
  return [...at.entries()].map(([sector, diff]) => ({ sector, diff }));
}

/** Folded footprint across, metres. Similar hexagons, so the linear scale is sqrt(lambda). */
export const stowedSpan = (radiusM) => 2 * radiusM * Math.sqrt(LAMBDA_FOLD);

/** Stowed pack derived from the fold rather than asserted: the span above, and one film thickness
 *  per layer (`t` is the film thickness; 100 nm of SiN is 1e-7 m). The hub and its spool are the
 *  mast's structure, not the film's, so they are not counted here. */
export function stowedEnvelope(radiusM, thicknessM = 1e-7) {
  return { d: stowedSpan(radiusM), h: FLASHER.layers * thicknessM };
}

/** Deployed-to-stowed area ratio, 1 / lambda at the folded state: 38.5 for the figures' 0.026. */
export const foldRatio = 1 / LAMBDA_FOLD;

/** Deployment progress for the viewer's 0..1 slider: geometric in lambda so the rotation stage,
 *  which is where the motion is, gets the first half of the travel. */
export const lambdaFor = (k) => LAMBDA_FOLD ** (1 - clamp(k, 0, 1));

/** All the numbers a caption or a check wants, for one deployment. */
export function report(lambda, { radiusM = 1 } = {}) {
  const d = deploy(lambda, { radiusM });
  const areaFrac = d.scale * d.scale;
  return {
    lambda: d.lambda, stage: d.stage, twistDeg: (d.twist * 180) / Math.PI,
    radiusM: d.radiusM, spanM: 2 * d.radiusM, areaFrac,
    areaM2: Math.PI * 0 + areaFrac * (3 * Math.sqrt(3) / 2) * radiusM * radiusM * (1 - FLASHER.hubFrac ** 2)
  };
}
