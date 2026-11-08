/* primitives/livery.js -- paint, as a library: bold, saturated livery in the spirit of classic rockets and
   the 1970s-80s illustrators (Chris Foss's chequered freighters, Moebius's red-and-white hulls with
   stencilled names, the Tintin rocket), generated as procedural textures and applied to every ship in
   every version from data, never by hand-placed meshes.

   Three parts:

     PALETTE   the paints: signal red, orange, sunflower, cobalt, mint, teal, against warm white, black
               and grey. Saturated and poppy, named once.
     LIVERIES  one livery per class (wafer, smallsat, instrument, lander, capsule, habitat, seed, colony):
               primary, secondary, accent, trim, the checker pair, the hazard pair, the registration, and
               the pattern each part kind wears. Every version of a class (v1 sail, v2 ring, v3 drive, v4
               realism, v5 robotic) wears the same livery, and the sub-craft -- robots, scouts, landers --
               wear their mothership's.
     the painter  pattern(canvas): checker, checker band, colour blocks with tape-stripe edges, chevron
               bands, hazard stripes, diagonal stripes, the rocket roll pattern, solid; stencilled
               registration, numbers and arrows; panel-by-panel colour variation; dirt and streaks in the
               colour, roughness and normal maps. The texture for a mesh is painted at the mesh's own cell
               grid: a cylinder of radius r gets N = round(2 pi r / cell) cells round and M = round(h / cell)
               along, so the squares are square; a cone's cells narrow with its radius; a torus gets its
               ring and tube counts. Cells align with the painted skin's 1.6 m panel bays where they can.

   What is NOT painted: anything thermal or optical -- radiators, solar cells, MLI, TPS tiles, sail film,
   glazing, engine bells, bare chrome and gold fittings -- and the dark structural greys. Under the paint
   the PBR stays: metalness, roughness and the normal map of the original surface are kept and the paint
   adds its own wear. Imports three; falls back to plain colours in node (no canvas). */

import * as THREE from 'three';
import { PRESETS } from './materials.js';

const HAS_DOM = typeof document !== 'undefined';

/* ------------------------------------------------------------------ *
 * Palette
 * ------------------------------------------------------------------ */
export const PALETTE = {
  signalRed: '#e3311f', orange: '#f5731c', sunflower: '#f8c21b', cobalt: '#1d4fbf', mint: '#3fd1a8', teal: '#157f8f',
  warmWhite: '#f3eee4', black: '#17181c', grey: '#8b9299', cream: '#ece3cf', navy: '#101c40', ochre: '#d9a21b', coral: '#ef5a3a'
};

/* The patterns a kind can wear. Each livery maps kinds to one of these; `default` covers the rest. */
export const PATTERNS = ['checker', 'checkerBand', 'blocks', 'chevronBands', 'hazard', 'stripes', 'roll', 'solid', 'none'];

/* ------------------------------------------------------------------ *
 * Liveries, one per class
 * ------------------------------------------------------------------ */
export const LIVERIES = {
  wafer: { name: 'StarChip', primary: 'sunflower', secondary: 'black', accent: 'signalRed', trim: 'black', checker: ['sunflower', 'black'], hazard: ['sunflower', 'black'], registration: 'SC-1', number: '1', rules: { default: 'checker' } },
  smallsat: { name: 'Swift', primary: 'mint', secondary: 'warmWhite', accent: 'signalRed', trim: 'black', checker: ['mint', 'warmWhite'], hazard: ['sunflower', 'black'], registration: 'SW-10', number: '10', rules: { default: 'blocks', bus: 'checker', 'trim-stage': 'stripes', 'systems-bay': 'blocks', 'sail-canister': 'roll' } },
  instrument: { name: 'Lantern', primary: 'orange', secondary: 'warmWhite', accent: 'cobalt', trim: 'black', checker: ['orange', 'warmWhite'], hazard: ['sunflower', 'black'], registration: 'LN-100', number: '100', rules: { default: 'blocks', bus: 'checkerBand', 'trim-stage': 'roll', 'systems-bay': 'hazard', 'sail-canister': 'checker', drive: 'checkerBand' } },
  lander: { name: 'Kestrel', primary: 'signalRed', secondary: 'warmWhite', accent: 'sunflower', trim: 'black', checker: ['signalRed', 'warmWhite'], hazard: ['sunflower', 'black'], registration: 'KS-1000', number: '1000', rules: { default: 'blocks', 'lander-aero': 'checker', lander: 'checker', 'trim-stage': 'roll', 'sail-canister': 'checker', drive: 'checkerBand' } },
  capsule: { name: 'Pelican', primary: 'signalRed', secondary: 'warmWhite', accent: 'cobalt', trim: 'black', checker: ['signalRed', 'warmWhite'], hazard: ['sunflower', 'black'], registration: 'PL-04', number: '04', rules: { default: 'checker', 'service-module': 'blocks', 'dock-adapter': 'hazard', 'sail-canister': 'roll', drive: 'checkerBand' } },
  habitat: { name: 'Meridian', primary: 'cobalt', secondary: 'warmWhite', accent: 'sunflower', trim: 'signalRed', checker: ['cobalt', 'warmWhite'], hazard: ['sunflower', 'black'], registration: 'MR-06', number: '06', rules: { default: 'blocks', node: 'checker', 'stores-module': 'checkerBand', cargo: 'checkerBand', 'spin-bola': 'blocks', centrifuge: 'chevronBands', 'torpor-ring': 'chevronBands', 'thrust-collar': 'hazard', 'trim-stage': 'stripes', 'sail-canister': 'roll', drive: 'checkerBand', 'systems-module': 'blocks', stores: 'checkerBand', 'robot-hangar': 'blocks', 'fab-bay': 'blocks', 'obs-deck': 'blocks' } },
  seed: { name: 'Harrow', primary: 'orange', secondary: 'cream', accent: 'teal', trim: 'black', checker: ['orange', 'cream'], hazard: ['sunflower', 'black'], registration: 'HW-20', number: '20', rules: { default: 'blocks', node: 'checker', 'pressurised-module': 'blocks', 'stores-module': 'checkerBand', cargo: 'checker', centrifuge: 'chevronBands', 'torpor-ring': 'chevronBands', 'thrust-collar': 'hazard', 'trim-stage': 'stripes', 'sail-canister': 'roll', drive: 'checkerBand', 'systems-module': 'checkerBand', stores: 'checkerBand', 'arrival-kit': 'hazard', 'seed-vault': 'checker', 'robot-hangar': 'blocks', 'fab-bay': 'blocks', 'obs-deck': 'blocks' } },
  colony: { name: 'Ark Royal', primary: 'signalRed', secondary: 'warmWhite', accent: 'sunflower', trim: 'black', checker: ['sunflower', 'black'], hazard: ['sunflower', 'black'], registration: 'AR-1000', number: '1000', rules: { default: 'blocks', 'habitat-ring': 'chevronBands', centrifuge: 'chevronBands', 'torpor-ring': 'chevronBands', 'despin-hub': 'roll', 'systems-module': 'checkerBand', 'trim-stage': 'stripes', 'sail-canister': 'checker', drive: 'checker', stores: 'checkerBand', 'arrival-kit': 'hazard', 'thrust-collar': 'hazard', adapter: 'hazard', 'seed-vault': 'checker', 'robot-hangar': 'blocks', 'fab-bay': 'blocks', 'obs-deck': 'checker', node: 'checker' } }
};

/** The base class of any ship id ('habitat-spin', 'seed-daedalus', 'colony-v4', 'habitat-v5' -> 'habitat', 'seed', 'colony', 'habitat'). */
export function classOf(id) { return String(id).split('-')[0]; }
export function liveryFor(id) { return LIVERIES[classOf(id)] ?? LIVERIES.habitat; }

/* Surfaces paint can go on, and the ones it must leave alone. */
export const PAINTABLE = new Set(['white', 'offwhite', 'stainless', 'tank']);
export const THERMAL = new Set(['radiator', 'cell', 'mli', 'tps', 'tpsHalf', 'film', 'glass', 'glazing', 'bell', 'gold', 'copper', 'chrome', 'navRed', 'navGreen', 'navWhite', 'warm', 'dark', 'grey', 'accent']);

/* ------------------------------------------------------------------ *
 * Cells: the grid a surface is painted on
 * ------------------------------------------------------------------ */
/** Cell size for a body of diameter d: a Foss checker is about an eighth of the body round, never under 0.35 m
 *  (a bolt-head-scale checker is noise) and never over 6 m (a cell should still read as a cell on a world ship). */
export function cellFor(d) { return Math.min(6, Math.max(0.35, d * Math.PI / 8)); }

/** The (u, v) grid for a geometry: cells round and cells along, and the real lengths they stand for. */
export function gridFor(geometry, cellOverride = null) {
  const P = geometry.parameters ?? {};
  let circ, len, kind = geometry.type;
  if (kind === 'CylinderGeometry') { const r = Math.max(P.radiusTop ?? 0, P.radiusBottom ?? 0); circ = 2 * Math.PI * r; len = P.height; }
  else if (kind === 'LatheGeometry') { const pts = P.points ?? []; let rMax = 0, L = 0; for (let i = 0; i < pts.length; i += 1) { rMax = Math.max(rMax, pts[i].x); if (i) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); } circ = 2 * Math.PI * rMax; len = L; }
  else if (kind === 'TorusGeometry') { circ = 2 * Math.PI * P.radius; len = 2 * Math.PI * P.tube; }
  else if (kind === 'SphereGeometry') { circ = 2 * Math.PI * P.radius; len = Math.PI * P.radius; }
  else if (kind === 'BoxGeometry') { circ = Math.max(P.width, P.depth); len = P.height; }
  else if (kind === 'CapsuleGeometry') { circ = 2 * Math.PI * P.radius; len = P.length + 2 * P.radius; }
  else return null;
  if (!(circ > 0) || !(len > 0)) return null;
  /* the cell follows the body's cross-section: a torus's tube, a cylinder's diameter; and never more than
     160 cells round, so a 350 m ring stays a checker and not a texture of dots */
  const d = kind === 'TorusGeometry' ? 2 * P.tube : circ / Math.PI;
  const cell = cellOverride ?? Math.max(cellFor(kind === 'BoxGeometry' ? Math.max(circ, len) : d), circ / 160);
  const N = Math.max(2, Math.round(circ / cell)), M = Math.max(1, Math.round(len / cell));
  return { kind, circ, len, cell, N, M, uAlong: kind === 'TorusGeometry' ? 'ring' : 'round' };
}

/* ------------------------------------------------------------------ *
 * The painter
 * ------------------------------------------------------------------ */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(hex, k) { const [r, g, b] = hexToRgb(hex); return `rgb(${Math.round(Math.min(255, r * k))},${Math.round(Math.min(255, g * k))},${Math.round(Math.min(255, b * k))})`; }
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Paint the cell grid of a pattern. `ctx` is W x H; cells are cw x ch pixels; returns nothing (paints in place). */
function paintPattern(ctx, W, H, N, M, pattern, L, seedN, stencilText) {
  const cw = W / N, ch = H / M, P = PALETTE, rand = rnd(seedN);
  const col = (k) => P[L[k]] ?? P[k] ?? k;
  const cell = (i, j, c) => { ctx.fillStyle = c; ctx.fillRect(Math.floor(i * cw), Math.floor(j * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1); };
  const bandRows = (f0, f1) => [Math.floor(M * f0), Math.max(Math.floor(M * f0) + 1, Math.round(M * f1))];
  const base = col('secondary'), prim = col('primary'), acc = col('accent'), trim = col('trim');
  const [cA, cB] = L.checker.map(col), [hA, hB] = L.hazard.map(col);
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  if (pattern === 'checker') for (let i = 0; i < N; i += 1) for (let j = 0; j < M; j += 1) cell(i, j, (i + j) % 2 ? cA : cB);
  else if (pattern === 'checkerBand') {
    const [j0, j1] = bandRows(0.3, 0.7);
    for (let i = 0; i < N; i += 1) for (let j = 0; j < M; j += 1) cell(i, j, j < j0 ? prim : j >= j1 ? base : ((i + j) % 2 ? cA : cB));
    ctx.fillStyle = acc; ctx.fillRect(0, j0 * ch - ch * 0.08, W, ch * 0.16); ctx.fillRect(0, j1 * ch - ch * 0.08, W, ch * 0.16);
  } else if (pattern === 'blocks') {
    const [j0, j1] = bandRows(0.55, 0.8);
    for (let i = 0; i < N; i += 1) for (let j = 0; j < M; j += 1) cell(i, j, j >= j0 && j < j1 ? prim : base);
    /* a vertical accent stripe two cells wide and tape lines at the block edges */
    /* a vertical accent stripe: one cell on a small body, two on a big one */
    for (let j = 0; j < M; j += 1) { cell(Math.floor(N * 0.12), j, acc); if (N > 12) cell(Math.floor(N * 0.12) + 1, j, acc); }
    ctx.fillStyle = trim; ctx.fillRect(0, j0 * ch - ch * 0.06, W, ch * 0.12); ctx.fillRect(0, j1 * ch - ch * 0.06, W, ch * 0.12);
    ctx.fillStyle = acc; ctx.fillRect(0, Math.max(0, j0 * ch - ch * 0.3), W, ch * 0.1);
    /* small hazard squares on the lower block edge */
    for (let i = 0; i < N; i += 2) { ctx.fillStyle = i % 4 ? hA : hB; ctx.fillRect(i * cw, Math.min(H - ch * 0.25, (M - 0.5) * ch), cw * 0.6, ch * 0.22); }
  } else if (pattern === 'chevronBands') {
    const [j0, j1] = bandRows(0.35, 0.65);
    for (let i = 0; i < N; i += 1) for (let j = 0; j < M; j += 1) cell(i, j, j >= j0 && j < j1 ? prim : base);
    ctx.save(); ctx.beginPath(); ctx.rect(0, j0 * ch, W, (j1 - j0) * ch); ctx.clip();
    const period = cw * 2;
    for (let x = -period; x < W + period; x += period) { ctx.fillStyle = (Math.round(x / period) % 2) ? acc : prim; ctx.beginPath(); ctx.moveTo(x, j0 * ch); ctx.lineTo(x + period / 2, j1 * ch); ctx.lineTo(x + period, j0 * ch); ctx.lineTo(x + period * 0.75, j0 * ch); ctx.lineTo(x + period / 2, j1 * ch - (j1 - j0) * ch * 0.5); ctx.lineTo(x + period * 0.25, j0 * ch); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = trim; ctx.fillRect(0, j0 * ch - ch * 0.06, W, ch * 0.12); ctx.fillRect(0, j1 * ch - ch * 0.06, W, ch * 0.12);
  } else if (pattern === 'hazard' || pattern === 'stripes') {
    const [sA, sB] = pattern === 'hazard' ? [hA, hB] : [prim, base], period = pattern === 'hazard' ? Math.max(cw, ch) * 1.2 : Math.max(cw, ch) * 2.4;
    ctx.fillStyle = sB; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = sA;
    for (let x = -H; x < W + H; x += period) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + period / 2, 0); ctx.lineTo(x + period / 2 + H, H); ctx.lineTo(x + H, H); ctx.closePath(); ctx.fill(); }
  } else if (pattern === 'roll') {
    /* the V-2 / Saturn roll pattern: alternate quadrants round, flipped half-way along */
    const q = Math.max(2, Math.round(N / 4));
    for (let i = 0; i < N; i += 1) for (let j = 0; j < M; j += 1) { const quad = Math.floor(i / q) % 2, half = j < M / 2 ? 0 : 1; cell(i, j, (quad + half) % 2 ? trim : base); }
    ctx.fillStyle = prim; ctx.fillRect(0, Math.floor(M / 2) * ch - ch * 0.12, W, ch * 0.24);
  } else {
    for (let i = 0; i < N; i += 1) for (let j = 0; j < M; j += 1) cell(i, j, prim);
    ctx.fillStyle = trim; ctx.fillRect(0, 0, W, Math.max(2, ch * 0.08)); ctx.fillRect(0, H - Math.max(2, ch * 0.08), W, Math.max(2, ch * 0.08));
  }
  /* panel-by-panel variation: a slight tint on every cell, and darker dirt in a few */
  for (let i = 0; i < N; i += 1) for (let j = 0; j < M; j += 1) {
    const k = 0.93 + rand() * 0.12, a = 0.10 + rand() * 0.08;
    ctx.fillStyle = `rgba(${k > 1 ? 255 : 0},${k > 1 ? 255 : 0},${k > 1 ? 255 : 0},${Math.abs(k - 1) * 0.9 + a * 0.2})`; ctx.fillRect(i * cw, j * ch, cw, ch);
    if (rand() < 0.08) { ctx.fillStyle = `rgba(40,30,20,${0.12 + rand() * 0.14})`; ctx.fillRect(i * cw, j * ch, cw, ch); }
  }
  /* streaks: dirt running "down" (+v) from the cell boundaries */
  ctx.fillStyle = 'rgba(30,25,20,0.08)';
  for (let k = 0; k < N * 2; k += 1) { const x = rand() * W, y = Math.floor(rand() * M) * ch, l = ch * (0.3 + rand() * 1.2); ctx.fillRect(x, y, Math.max(1, cw * 0.03), l); }
  /* cell seams */
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let i = 1; i < N; i += 1) ctx.fillRect(Math.round(i * cw) - 1, 0, 2, H);
  for (let j = 1; j < M; j += 1) ctx.fillRect(0, Math.round(j * ch) - 1, W, 2);
  /* stencils: the registration, a number, arrows, NO STEP */
  if (stencilText && (pattern === 'blocks' || pattern === 'checkerBand' || pattern === 'roll') && cw > 40 && M >= 3 && N >= 6) {
    const [j0] = bandRows(0.55, 0.8);
    /* lettering a crew can read from a few metres: about half a cell high and never more than a twelfth of the way round */
    const fs = Math.max(14, Math.min(ch * 0.5, W * 0.06));
    ctx.fillStyle = pattern === 'roll' ? prim : trim; ctx.font = `bold ${fs}px "Helvetica Neue", Arial, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const yText = pattern === 'blocks' ? (j0 - 1.5) * ch : ch * 0.5;
    ctx.fillText(stencilText.registration, cw * 0.3, Math.max(fs, yText));
    ctx.textAlign = 'right'; ctx.fillStyle = acc; ctx.font = `bold ${fs * 1.6}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(stencilText.number, W - cw * 0.3, Math.max(fs, H - ch * 1.2));
    ctx.textAlign = 'left'; ctx.fillStyle = trim; ctx.font = `bold ${fs * 0.55}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText('NO STEP', cw * 0.3, Math.min(H - fs, (M - 0.5) * ch - fs));
    /* arrows pointing forward (+v) at a few stations */
    ctx.fillStyle = acc;
    for (let k = 0; k < 3; k += 1) { const x = W * (0.3 + 0.25 * k), y = ch * 0.9; ctx.beginPath(); ctx.moveTo(x, y - fs * 0.6); ctx.lineTo(x + fs * 0.45, y); ctx.lineTo(x - fs * 0.45, y); ctx.closePath(); ctx.fill(); ctx.fillRect(x - fs * 0.12, y, fs * 0.24, fs * 0.8); }
  }
}

/** Roughness from the colour: paint is matte where dirty, glossier where clean; seams are rougher. */
function roughnessFrom(colour, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), src = colour.getContext('2d').getImageData(0, 0, W, H).data, img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i += 1) { const lum = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255; const v = Math.round(255 * Math.min(1, 0.42 + (1 - lum) * 0.25 + (Math.random() - 0.5) * 0.08)); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}
/** A normal map with the cell seams as grooves, from a height field of the seam lines. */
function normalFromSeams(W, H, N, M) {
  const hgt = document.createElement('canvas'); hgt.width = W; hgt.height = H;
  const g = hgt.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#505050';
  for (let i = 1; i < N; i += 1) g.fillRect(Math.round((i * W) / N) - 2, 0, 4, H);
  for (let j = 1; j < M; j += 1) g.fillRect(0, Math.round((j * H) / M) - 2, W, 4);
  const src = g.getImageData(0, 0, W, H).data, out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d'), img = og.createImageData(W, H);
  const lum = (x, y) => src[((((y + H) % H) * W) + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const dx = (lum(x + 1, y) - lum(x - 1, y)) * 2.2, dy = (lum(x, y + 1) - lum(x, y - 1)) * 2.2, len = Math.hypot(dx, dy, 1);
    const i = (y * W + x) * 4; img.data[i] = (-dx / len * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / len * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  return out;
}

const texCache = new Map();
/** Paint (or fetch) the texture set for a pattern on an N x M grid in a livery. */
export function liveryTextures(pattern, N, M, livery, seedN = 1, stencil = null) {
  const key = `${livery.name}|${pattern}|${N}|${M}|${seedN % 7}|${stencil ? 1 : 0}`;
  if (texCache.has(key)) return texCache.get(key);
  if (!HAS_DOM) return null;
  const px = Math.max(16, Math.min(96, Math.floor(4096 / Math.max(N, M))));
  const W = N * px, H = M * px;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  paintPattern(c.getContext('2d'), W, H, N, M, pattern, livery, seedN, stencil);
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const set = { map: mk(c, true), roughnessMap: mk(roughnessFrom(c, W, H), false), normalMap: mk(normalFromSeams(W, H, N, M), false) };
  texCache.set(key, set);
  return set;
}

/* ------------------------------------------------------------------ *
 * Application
 * ------------------------------------------------------------------ */
const matCache = new Map();
/** The painted material for a mesh: the original's PBR numbers under the paint. */
function paintedMaterial(orig, pattern, grid, livery, seedN, stencil) {
  const key = `${livery.name}|${pattern}|${grid.N}|${grid.M}|${seedN % 7}|${stencil ? 1 : 0}|${orig.userData.surface ?? ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const tex = liveryTextures(pattern, grid.N, grid.M, livery, seedN, stencil);
  const m = new THREE.MeshStandardMaterial({
    color: tex ? 0xffffff : PALETTE[livery[pattern === 'hazard' ? 'hazard' : 'primary'] ?? 'primary'] ?? PALETTE[livery.primary],
    metalness: 0.12, roughness: 0.5, side: orig.side ?? THREE.DoubleSide, envMapIntensity: orig.envMapIntensity ?? 0.45
  });
  if (tex) { m.map = tex.map; m.roughnessMap = tex.roughnessMap; m.normalMap = tex.normalMap; m.normalScale = new THREE.Vector2(0.45, 0.45); }
  m.userData.surface = 'livery'; m.userData.livery = { pattern, N: grid.N, M: grid.M };
  matCache.set(key, m);
  return m;
}

/** Which pattern a part kind wears in a livery; sub-metre bodies (robots, fittings) get a solid primary. */
export function patternFor(livery, kind, grid) {
  if (!grid) return 'none';
  if (kind === 'robot' || kind === 'scout-rack' || kind === 'compute-rack') return 'solid';
  /* optical and thermal hardware keeps its working finish whatever the surface preset says */
  if (kind === 'dish' || kind === 'rtg' || kind === 'reactor' || kind === 'reactor-fsp' || kind === 'dust-shield' || kind === 'sail' || kind === 'mast' || kind === 'truss' || kind === 'rail-network') return 'none';
  const rule = livery.rules[kind] ?? livery.rules.default ?? 'blocks';
  /* an end cone or a short collar (one row of cells) wears the primary colour with a trim tape, not a shrunken pattern */
  if (grid.M < 2 && rule !== 'hazard' && rule !== 'stripes') return 'solid';
  /* a checker band is one or two rows of squares round the body; a full checker or chevron needs three */
  if ((rule === 'checker' || rule === 'chevronBands') && grid.M < 3) return 'blocks';
  if (rule === 'checkerBand' && grid.M < 2) return 'blocks';
  return rule;
}

/**
 * Paint a built model in its livery (on = true) or restore its plain surfaces (on = false). Meshes carry
 * the plain material in userData.plainMat. Only PAINTABLE surfaces on round or boxed bodies are painted;
 * thermal and optical surfaces are never touched. Returns the count of painted meshes.
 */
export function applyLivery(root, livery, on = true) {
  let painted = 0;
  const frames = [];
  root.traverse((o) => { if (o.userData?.kind && o.userData?.part) frames.push(o); });
  const paintMesh = (o, kind, idx) => {
    if (!o.isMesh || o.userData.detail || o.isInstancedMesh) return;
    const mat = o.material;
    if (!on) { if (o.userData.plainMat) { o.material = o.userData.plainMat; painted += 1; } return; }
    const surf = (o.userData.plainMat ?? mat)?.userData?.surface;
    if (!surf || !PAINTABLE.has(surf) || THERMAL.has(surf)) return;
    const grid = gridFor(o.geometry);
    const pattern = patternFor(livery, kind, grid);
    if (pattern === 'none' || !grid) return;
    if (!o.userData.plainMat) o.userData.plainMat = mat;
    const big = grid.circ * grid.len > 4;
    o.material = paintedMaterial(o.userData.plainMat, pattern, grid, livery, idx + 1, big ? { registration: livery.registration, number: livery.number } : null);
    painted += 1;
  };
  frames.forEach((f, i) => f.traverse((o) => { if (o !== f && o.userData?.kind && o.userData?.part) return; paintMesh(o, f.userData.kind, i); }));
  root.userData.liveryOn = on;
  return painted;
}

/** Everything a test needs to know about a livery without a DOM: the plan per frame. */
export function liveryPlan(root, livery) {
  const plan = [];
  root.traverse((f) => {
    if (!(f.userData?.kind && f.userData?.part)) return;
    f.traverse((o) => {
      if (!o.isMesh || o.userData.detail || o.isInstancedMesh) return;
      const surf = (o.userData.plainMat ?? o.material)?.userData?.surface;
      if (!surf) return;
      const grid = gridFor(o.geometry);
      plan.push({ part: f.userData.partName, kind: f.userData.kind, surface: surf, paintable: PAINTABLE.has(surf) && !THERMAL.has(surf), grid, pattern: PAINTABLE.has(surf) && !THERMAL.has(surf) ? patternFor(livery, f.userData.kind, grid) : 'none' });
    });
  });
  return plan;
}
