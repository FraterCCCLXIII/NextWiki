/* IAU/IAU-WGCCRE rotational elements (Archinal et al. 2018 style, from memory: verify before publication).
   Frame: J2000 equatorial (ICRF-aligned). Body-fixed frame: z = pole, x = prime meridian at W = 0.
   Angles in degrees; rates per Julian century (T) or per day (d = JD - 2451545.0). Radii in m, GM in m^3/s^2. */

const D2R = Math.PI / 180;
const JD2000 = 2451545.0;
const DAY = 86400;

// ra/dec: [value deg, rate deg/century]; W0 deg; Wd = prime-meridian rate deg/day (negative = retrograde).
// periodic (Neptune only): pole and W corrections in N = 357.85 + 52.316 T (deg).
export const BODIES = {
  mercury: { name: 'Mercury', a: 2440530, c: 2438260, gm: 2.2031868551e13, J2: 6.0e-5, ra: [281.0103, -0.0328], dec: [61.4155, -0.0049], W0: 329.5988, Wd: 6.1385108 },
  venus:   { name: 'Venus',   a: 6051800, c: 6051800, gm: 3.24858592e14, J2: 4.458e-6, ra: [272.76, 0], dec: [67.16, 0], W0: 160.20, Wd: -1.4813688 },
  earth:   { name: 'Earth',   a: 6378137, c: 6356752, gm: 3.986004418e14, J2: 1.08262668e-3, ra: [0, -0.641], dec: [90, -0.557], W0: 190.147, Wd: 360.9856235 },
  moon:    { name: 'Moon',    a: 1737400, c: 1737400, gm: 4.9028001e12, J2: 2.032e-4, ra: [269.9949, 0.0031], dec: [66.5392, 0.0130], W0: 38.3213, Wd: 13.17635815 },
  mars:    { name: 'Mars',    a: 3396190, c: 3376200, gm: 4.282837e13, J2: 1.96045e-3, ra: [317.68143, -0.1061], dec: [52.88650, -0.0609], W0: 176.630, Wd: 350.89198226 },
  jupiter: { name: 'Jupiter', a: 71492000, c: 66854000, gm: 1.26686534e17, J2: 1.4736e-2, ra: [268.056595, -0.006499], dec: [64.495303, 0.002413], W0: 284.95, Wd: 870.5366420 },
  saturn:  { name: 'Saturn',  a: 60268000, c: 54364000, gm: 3.79311879e16, J2: 1.6298e-2, ra: [40.589, -0.036], dec: [83.537, -0.004], W0: 38.90, Wd: 810.7939024 },
  uranus:  { name: 'Uranus',  a: 25559000, c: 24973000, gm: 5.793939e15, J2: 1.2e-2, ra: [257.311, 0], dec: [-15.175, 0], W0: 203.81, Wd: -501.1600928 },
  neptune: { name: 'Neptune', a: 24764000, c: 24341000, gm: 6.836529e15, J2: 3.5e-3, ra: [299.36, 0], dec: [43.46, 0], W0: 249.978, Wd: 541.1397757, periodic: true },
  titan:   { name: 'Titan',   a: 2574700, c: 2574700, gm: 8.9781e12, J2: 3.0e-5, ra: [36.41, -0.036], dec: [83.94, -0.004], W0: 189.380, Wd: 22.5769768 },
};

export function hasBody(id) {
  return Object.prototype.hasOwnProperty.call(BODIES, id);
}

function req(id) {
  const b = BODIES[id];
  if (!b) throw Error('No IAU orientation data for ' + id);
  return b;
}

// 3x3 row-major helpers
export function matVec(M, x) {
  return [
    M[0][0] * x[0] + M[0][1] * x[1] + M[0][2] * x[2],
    M[1][0] * x[0] + M[1][1] * x[1] + M[1][2] * x[2],
    M[2][0] * x[0] + M[2][1] * x[1] + M[2][2] * x[2],
  ];
}
function matMul(A, B) {
  return A.map((row, i) => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
}
function rotZ(t) { const c = Math.cos(t), s = Math.sin(t); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; }
function rotX(t) { const c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, -s], [0, s, c]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

/* Rotation elements at JD (TDB). Returns:
   R: 3x3 body-fixed -> J2000 equatorial inertial, R = Rz(alpha0+90) Rx(90-delta0) Rz(W)
   pole: unit pole vector in inertial frame
   W: prime meridian angle, deg
   omega: spin rate, rad/s (signed); inertial spin vector = omega * pole
   spinVec: omega * pole, rad/s */
export function orientation(id, jd) {
  const b = req(id);
  const d = jd - JD2000, T = d / 36525;
  let ra = b.ra[0] + b.ra[1] * T;
  let dec = b.dec[0] + b.dec[1] * T;
  let W = b.W0 + b.Wd * d;
  if (b.periodic) {
    const N = (357.85 + 52.316 * T) * D2R;
    ra += 0.70 * Math.sin(N);
    dec += -0.51 * Math.cos(N);
    W += -0.36 * Math.sin(N);
  }
  const al = ra * D2R, de = dec * D2R, w = W * D2R;
  const pole = [Math.cos(de) * Math.cos(al), Math.cos(de) * Math.sin(al), Math.sin(de)];
  const R = matMul(rotZ(al + Math.PI / 2), matMul(rotX(Math.PI / 2 - de), rotZ(w)));
  const omega = b.Wd * D2R / DAY;
  return { R, pole, W: ((W % 360) + 360) % 360, omega, spinVec: pole.map(x => x * omega) };
}

// Body-fixed position of a geodetic site on the reference ellipsoid (m).
function bodyFixedSite(b, latDeg, lonDeg, elevM) {
  const f = 1 - b.c / b.a, e2 = f * (2 - f);
  const phi = latDeg * D2R, lam = lonDeg * D2R, sp = Math.sin(phi), cp = Math.cos(phi);
  const N = b.a / Math.sqrt(1 - e2 * sp * sp);
  return [(N + elevM) * cp * Math.cos(lam), (N + elevM) * cp * Math.sin(lam), (N * (1 - e2) + elevM) * sp];
}

// Body-fixed local east/north/up at a site.
function bodyFixedFrame(latDeg, lonDeg) {
  const phi = latDeg * D2R, lam = lonDeg * D2R;
  return {
    east: [-Math.sin(lam), Math.cos(lam), 0],
    north: [-Math.sin(phi) * Math.cos(lam), -Math.sin(phi) * Math.sin(lam), Math.cos(phi)],
    up: [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)],
  };
}

/* Inertial position (m) and velocity (m/s) of a surface site at jd.
   v = (omega pole) x r, using the real pole axis. */
export function siteInertial(id, latDeg, lonDeg, elevM, jd) {
  const b = req(id), o = orientation(id, jd);
  const r = matVec(o.R, bodyFixedSite(b, latDeg, lonDeg, elevM || 0));
  const v = cross(o.spinVec, r);
  return { r, v, pole: o.pole };
}

/* Eastward-prograde surface speed (m/s) of a site along a launch azimuth (deg from north, clockwise).
   Positive means the rotation helps the launch. */
// Longitude does not change the speed along a given azimuth (spin is symmetric about the pole), so lon = 0 is used.
export function groundSpeedBonus(id, latDeg, azimuthDeg, jd) {
  const b = req(id), o = orientation(id, jd);
  const az = azimuthDeg * D2R;
  const f = bodyFixedFrame(latDeg, 0);
  const heading = matVec(o.R, f.east.map((x, i) => x * Math.sin(az) + f.north[i] * Math.cos(az)));
  const r = matVec(o.R, bodyFixedSite(b, latDeg, 0, 0));
  return dot(cross(o.spinVec, r), heading);
}
