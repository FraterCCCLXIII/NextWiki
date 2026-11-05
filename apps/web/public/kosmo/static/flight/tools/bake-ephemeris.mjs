#!/usr/bin/env node
// Bakes per-segment Chebyshev ephemerides from JPL Horizons into ../ephemeris.json.
//
//   node tools/bake-ephemeris.mjs            (writes static/flight/ephemeris.json)
//   node tools/bake-ephemeris.mjs --out x.json --from 1900 --to 2100
//
// Frames: planets are heliocentric (@sun), Moon is geocentric (@earth).
// Both are J2000 ecliptic, positions in metres, and the fit is done in TDB days.
//
// Sampling: every body is sampled at segDays/32 so each segment gets 33 samples
// for a degree-12 least-squares fit. (8-day sampling of a 32-day segment would
// give only 5 samples for 13 unknowns, so the inner planets and Moon use finer steps.)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};
const OUT = arg('--out', join(HERE, '..', 'ephemeris.json'));
const FROM_YEAR = Number(arg('--from', 1900));
const TO_YEAR = Number(arg('--to', 2100));
const DEGREE = 12;
const SAMPLES_PER_SEG = 32;
const ROWS_PER_REQUEST = 7000;

// seg: segment length in days. step: Horizons STEP_SIZE (seg / 32).
const BODIES = [
  { id: 'mercury', cmd: '199', center: '500@10', seg: 32 },
  { id: 'venus', cmd: '299', center: '500@10', seg: 32 },
  { id: 'earth', cmd: '399', center: '500@10', seg: 32 },
  { id: 'mars', cmd: '499', center: '500@10', seg: 32 },
  { id: 'jupiter', cmd: '599', center: '500@10', seg: 256 },
  { id: 'saturn', cmd: '699', center: '500@10', seg: 256 },
  { id: 'uranus', cmd: '799', center: '500@10', seg: 256 },
  { id: 'neptune', cmd: '899', center: '500@10', seg: 256 },
  { id: 'moon', cmd: '301', center: '500@399', seg: 16 },
];

const stepLabel = (seg) => {
  const days = seg / SAMPLES_PER_SEG;
  return days >= 1 ? `${days} d` : `${days * 24} h`;
};
const stepDays = (seg) => seg / SAMPLES_PER_SEG;

// Horizons wants calendar strings; split the span into requests of bounded row count.
const pad = (n) => String(n).padStart(2, '0');
const calStr = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

async function horizonsChunk(body, startMs, stopMs) {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${body.cmd}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: `'${body.center}'`,
    START_TIME: `'${calStr(startMs)}'`,
    STOP_TIME: `'${calStr(stopMs)}'`,
    STEP_SIZE: `'${stepLabel(body.seg)}'`,
    VEC_TABLE: "'2'",
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'J2000'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
    VEC_LABELS: "'NO'",
  });
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!text.includes('$$SOE') || !text.includes('$$EOE')) {
        throw new Error(`no ephemeris block for ${body.id}: ${text.slice(0, 300)}`);
      }
      const block = text.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
      return block.map((line) => {
        const f = line.split(',').map((s) => s.trim());
        // f[0]=JDTDB, f[1]=calendar date, f[2..4]=X,Y,Z (km), f[5..7]=VX,VY,VZ (km/s)
        return { jd: Number(f[0]), r: [f[2], f[3], f[4]].map((v) => Number(v) * 1000) };
      });
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function fetchSamples(body) {
  const spanMs = ROWS_PER_REQUEST * stepDays(body.seg) * 86400000;
  const endMs = Date.UTC(TO_YEAR, 0, 1);
  const byJd = new Map();
  for (let s = Date.UTC(FROM_YEAR, 0, 1); s < endMs; s += spanMs) {
    const e = Math.min(s + spanMs - stepDays(body.seg) * 86400000, endMs);
    for (const row of await horizonsChunk(body, s, e)) byJd.set(Math.round(row.jd * 1e6), row);
    process.stdout.write('.');
  }
  return [...byJd.values()].sort((a, b) => a.jd - b.jd);
}

// Chebyshev basis T_0..T_DEGREE at x in [-1,1].
function chebBasis(x) {
  const T = new Array(DEGREE + 1);
  T[0] = 1;
  T[1] = x;
  for (let k = 2; k <= DEGREE; k++) T[k] = 2 * x * T[k - 1] - T[k - 2];
  return T;
}

// Gaussian elimination with partial pivoting; A is n x n, b length n.
function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      if (f === 0) continue;
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

function fitBody(body, samples) {
  const seg = body.seg;
  const jd0 = samples[0].jd;
  const last = samples[samples.length - 1].jd;
  const nseg = Math.floor((last - jd0) / seg + 1e-9);
  const out = { x: [], y: [], z: [] };
  let maxResid = 0;
  let idx = 0;
  for (let i = 0; i < nseg; i++) {
    const a = jd0 + i * seg;
    const b = a + seg;
    while (idx < samples.length && samples[idx].jd < a - 1e-6) idx++;
    const pts = [];
    for (let j = idx; j < samples.length && samples[j].jd <= b + 1e-6; j++) pts.push(samples[j]);
    // Normal equations for the least-squares Chebyshev fit.
    const N = DEGREE + 1;
    const M = Array.from({ length: N }, () => new Array(N).fill(0));
    const rhs = [new Array(N).fill(0), new Array(N).fill(0), new Array(N).fill(0)];
    for (const p of pts) {
      const x = (2 * (p.jd - a)) / seg - 1;
      const T = chebBasis(Math.max(-1, Math.min(1, x)));
      for (let k = 0; k < N; k++) {
        for (let l = 0; l < N; l++) M[k][l] += T[k] * T[l];
        for (let ax = 0; ax < 3; ax++) rhs[ax][k] += T[k] * p.r[ax];
      }
    }
    const axes = ['x', 'y', 'z'];
    const coeffs = axes.map((_, ax) => solve(M.map((row) => row.slice()), rhs[ax].slice()));
    for (const p of pts) {
      const x = (2 * (p.jd - a)) / seg - 1;
      const T = chebBasis(Math.max(-1, Math.min(1, x)));
      for (let ax = 0; ax < 3; ax++) {
        const v = coeffs[ax].reduce((s, c, k) => s + c * T[k], 0);
        maxResid = Math.max(maxResid, Math.abs(v - p.r[ax]));
      }
    }
    for (let ax = 0; ax < 3; ax++) for (const c of coeffs[ax]) out[axes[ax]].push(Math.round(c));
  }
  return { jd0, nseg, maxResidM: maxResid, ...out };
}

async function main() {
  const bodies = {};
  for (const body of BODIES) {
    process.stdout.write(`${body.id} `);
    const samples = await fetchSamples(body);
    if (samples.length < SAMPLES_PER_SEG) throw new Error(`too few samples for ${body.id}`);
    const fit = fitBody(body, samples);
    bodies[body.id] = {
      center: body.center.startsWith('500@10') ? 'sun' : 'earth',
      segDays: body.seg,
      jd0: fit.jd0,
      nseg: fit.nseg,
      x: fit.x,
      y: fit.y,
      z: fit.z,
      maxFitResidualM: Math.round(fit.maxResidM * 100) / 100,
    };
    console.log(` ${fit.nseg} segments, max sample residual ${fit.maxResidM.toFixed(2)} m`);
  }
  const doc = {
    format: 'kosmo-chebyshev-ephemeris/1',
    source: 'JPL Horizons VECTORS, ecliptic J2000, KM-S converted to m and m/s',
    generated: new Date().toISOString(),
    units: { position: 'm', velocity: 'm/s', time: 'JD (TDB)' },
    degree: DEGREE,
    coverage: { fromYear: FROM_YEAR, toYear: TO_YEAR },
    bodies,
  };
  writeFileSync(OUT, JSON.stringify(doc));
  console.log(`wrote ${OUT}`);
}

main().catch((err) => {
  console.error(`\nbake failed: ${err.message}`);
  console.error('No file was written. The runtime keeps the element model as fallback.');
  process.exit(1);
});
