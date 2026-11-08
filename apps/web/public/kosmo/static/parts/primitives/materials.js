/* primitives/materials.js -- the PBR material library for the Centauri models.

   One preset per surface a real vehicle shows: white painted steel with panel lines, brushed
   stainless, black ceramic TPS tiles, gold MLI, solar cells, radiator ribs, lit glazing, anodised
   dark fittings. Every preset is a MeshStandardMaterial with procedurally generated colour,
   roughness and normal maps (a canvas is painted once, the normal map is derived from its height
   channel), so the look does not depend on a texture download and the same surface reads correctly
   at a 0.3 m bus and a 112 m ring: `surface(kind, { repeat })` returns a cached material whose maps
   repeat the right number of times for that part's size.

   The render-mode switch (render-modes.js) swaps these out and back, so nothing here is special-cased
   there. In node (no document) the presets fall back to plain colours, so the module can be imported
   by anything that also wants the colours. */

import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';

export const COLOURS = {
  white: 0xeef1f4, offwhite: 0xdfe3e7, stainless: 0xc9ced4, tps: 0x1c1d21, mli: 0xcaa14e, cell: 0x1e2b52, radiator: 0xe8e5de,
  glass: 0x1f3851, dark: 0x3a3f47, grey: 0x9aa3ad, gold: 0xc9a24b, copper: 0xb0683a, accent: 0xc4642a, hatch: 0x8d959e, tank: 0xbfc5cc, film: 0xa8d4ff
};

/* ---- canvas painting ---- */
function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }
function texture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Sobel the luminance of `height` into a tangent-space normal map. `strength` scales the slope. */
function normalFrom(height, strength = 2) {
  const w = height.width, h = height.height;
  const src = height.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w), g = out.getContext('2d'), img = g.createImageData(w, h);
  const lum = (x, y) => { const i = (((y + h) % h) * w + ((x + w) % w)) * 4; return (src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11) / 255; };
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength, dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize();
    const i = (y * w + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return out;
}
function noise(g, w, h, amount, alpha = 0.06, size = 3) {
  for (let i = 0; i < amount; i += 1) { const v = Math.floor(128 + (Math.random() - 0.5) * 120); g.fillStyle = `rgba(${v},${v},${v},${alpha})`; g.fillRect(Math.random() * w, Math.random() * h, size, size); }
}

/* ---- the painters: each returns { map, rough, height } canvases ---- */
const PAINT = {
  /* painted aluminium/steel with panel lines and faint fastener rows */
  white(base = '#eef1f4') {
    const S = 512, m = canvas(S), r = canvas(S), hgt = canvas(S), g = m.getContext('2d'), gr = r.getContext('2d'), gh = hgt.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, S, S); gr.fillStyle = '#6a6a6a'; gr.fillRect(0, 0, S, S); gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
    noise(g, S, S, 1500, 0.04, 4); noise(gr, S, S, 2500, 0.08, 6);
    /* panel-line grooves: a soft ambient-occlusion shoulder either side of each seam in the colour map, a sharp step in the
       height map (so the normal map turns the groove's walls), and matte roughness in the groove where paint pools */
    for (let i = 0; i < 4; i += 1) { const y = (i + 0.5) * (S / 4) + (i % 2 ? 11 : -7); g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, y - 4, S, 10); g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, y, S, 2); gh.fillStyle = '#4a4a4a'; gh.fillRect(0, y - 1, S, 4); gr.fillStyle = '#a4a4a4'; gr.fillRect(0, y - 2, S, 6); }
    for (let i = 0; i < 3; i += 1) { const x = (i + 0.5) * (S / 3) + (i % 2 ? -17 : 9); g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x - 4, 0, 10, S); g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(x, 0, 2, S); gh.fillStyle = '#4f4f4f'; gh.fillRect(x - 1, 0, 4, S); }
    for (let i = 0; i < 4; i += 1) { const y = (i + 0.5) * (S / 4) + (i % 2 ? 11 : -7); for (let x = 8; x < S; x += 24) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.arc(x, y + 9, 1.6, 0, 7); g.fill(); gh.fillStyle = '#a8a8a8'; gh.beginPath(); gh.arc(x, y + 9, 1.8, 0, 7); gh.fill(); } }
    return { map: m, rough: r, height: hgt, strength: 1.6 };
  },
  /* brushed stainless with weld rings: vertical streaks in roughness, horizontal seams in height */
  stainless() {
    const S = 512, m = canvas(S), r = canvas(S), hgt = canvas(S), g = m.getContext('2d'), gr = r.getContext('2d'), gh = hgt.getContext('2d');
    g.fillStyle = '#cfd4da'; g.fillRect(0, 0, S, S); gr.fillStyle = '#5c5c5c'; gr.fillRect(0, 0, S, S); gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i += 1) { const x = Math.random() * S, l = 20 + Math.random() * 120, v = Math.floor(150 + Math.random() * 70); g.fillStyle = `rgba(${v},${v + 4},${v + 8},0.10)`; g.fillRect(x, Math.random() * S, 1, l); gr.fillStyle = `rgba(${v - 60},${v - 60},${v - 60},0.25)`; gr.fillRect(x, Math.random() * S, 1, l); }
    for (let i = 0; i < 3; i += 1) { const y = (i + 0.5) * (S / 3); g.fillStyle = 'rgba(60,62,66,0.35)'; g.fillRect(0, y, S, 3); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y + 3, S, 1); gh.fillStyle = '#a8a8a8'; gh.fillRect(0, y - 2, S, 6); gr.fillStyle = '#9d9d9d'; gr.fillRect(0, y - 3, S, 8); }
    return { map: m, rough: r, height: hgt, strength: 1.4 };
  },
  /* black ceramic hex tiles with lighter grout */
  tps() {
    const S = 512, m = canvas(S), r = canvas(S), hgt = canvas(S), g = m.getContext('2d'), gr = r.getContext('2d'), gh = hgt.getContext('2d');
    g.fillStyle = '#3a3c42'; g.fillRect(0, 0, S, S); gr.fillStyle = '#c0c0c0'; gr.fillRect(0, 0, S, S); gh.fillStyle = '#404040'; gh.fillRect(0, 0, S, S);
    const a = 30, hx = a * Math.sqrt(3), vy = a * 1.5;
    const hex = (ctx, cx, cy, rad) => { ctx.beginPath(); for (let k = 0; k < 6; k += 1) { const t = (Math.PI / 3) * k + Math.PI / 6; ctx.lineTo(cx + rad * Math.cos(t), cy + rad * Math.sin(t)); } ctx.closePath(); ctx.fill(); };
    for (let row = -1; row < S / vy + 1; row += 1) for (let col = -1; col < S / hx + 1; col += 1) {
      const cx = col * hx + (row % 2 ? hx / 2 : 0), cy = row * vy, v = 22 + Math.floor(Math.random() * 14);
      g.fillStyle = `rgb(${v},${v + 1},${v + 4})`; hex(g, cx, cy, a - 1.6);
      gr.fillStyle = `rgb(${175 + Math.floor(Math.random() * 30)},0,0)`; hex(gr, cx, cy, a - 1.6);
      gh.fillStyle = '#8c8c8c'; hex(gh, cx, cy, a - 1.6);
    }
    return { map: m, rough: r, height: hgt, strength: 2.2 };
  },
  /* MLI: crinkled, slightly metallic; gold by default, silver (aluminised Kapton) on tanks with base '#c8ccd2' */
  mli(base = '#c9a24b') {
    const S = 256, m = canvas(S), r = canvas(S), hgt = canvas(S), g = m.getContext('2d'), gr = r.getContext('2d'), gh = hgt.getContext('2d');
    const silver = base !== '#c9a24b';
    g.fillStyle = base; g.fillRect(0, 0, S, S); gr.fillStyle = '#6e6e6e'; gr.fillRect(0, 0, S, S); gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i += 1) { const x = Math.random() * S, y = Math.random() * S, w = 6 + Math.random() * 40, h = 3 + Math.random() * 18, v = Math.floor(128 + (Math.random() - 0.5) * 140); g.fillStyle = silver ? `rgba(${v + 40},${v + 44},${v + 50},0.2)` : `rgba(${v + 60},${v + 20},${Math.max(0, v - 60)},0.18)`; g.fillRect(x, y, w, h); gh.fillStyle = `rgba(${v},${v},${v},0.5)`; gh.fillRect(x, y, w, h); }
    for (let i = 0; i < 6; i += 1) { g.fillStyle = 'rgba(40,30,10,0.25)'; g.fillRect(0, (i + 0.5) * (S / 6), S, 1); }
    return { map: m, rough: r, height: hgt, strength: 2.6 };
  },
  /* solar cells: dark blue cells in a silver grid */
  cell() {
    const S = 512, m = canvas(S), r = canvas(S), hgt = canvas(S), g = m.getContext('2d'), gr = r.getContext('2d'), gh = hgt.getContext('2d');
    g.fillStyle = '#b8bec6'; g.fillRect(0, 0, S, S); gr.fillStyle = '#4a4a4a'; gr.fillRect(0, 0, S, S); gh.fillStyle = '#a0a0a0'; gh.fillRect(0, 0, S, S);
    const n = 8, c = S / n;
    /* dark glossy cells: near-black blue with a faint diagonal sheen, three silver bus bars per cell, the grid between them lighter */
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      const v = 14 + Math.floor(Math.random() * 8); g.fillStyle = `rgb(${v},${v + 10},${v + 42})`; g.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
      const grad = g.createLinearGradient(i * c, j * c, i * c + c, j * c + c); grad.addColorStop(0, 'rgba(255,255,255,0.0)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.08)'); grad.addColorStop(1, 'rgba(255,255,255,0.0)'); g.fillStyle = grad; g.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
      gh.fillStyle = '#707070'; gh.fillRect(i * c + 2, j * c + 2, c - 4, c - 4); gr.fillStyle = '#383838'; gr.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
      for (const f of [0.25, 0.5, 0.75]) { g.fillStyle = 'rgba(200,208,220,0.6)'; g.fillRect(i * c + c * f, j * c + 2, 1, c - 4); }
    }
    return { map: m, rough: r, height: hgt, strength: 1.2 };
  },
  /* radiator: white panel with embedded flow tubes as ribs */
  radiator() {
    const S = 256, m = canvas(S), r = canvas(S), hgt = canvas(S), g = m.getContext('2d'), gr = r.getContext('2d'), gh = hgt.getContext('2d');
    g.fillStyle = '#e8e5de'; g.fillRect(0, 0, S, S); gr.fillStyle = '#8a8a8a'; gr.fillRect(0, 0, S, S); gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
    noise(g, S, S, 700, 0.05, 3);
    /* the flow tubes read as raised ribs with a shadowed groove beside each; a header manifold runs across the top of the
       tile and a dark bonded seam along its edge, so a 90 m panel is a radiator and not a slab (CENTAURI-ATTACH.md) */
    for (let i = 0; i < 10; i += 1) { const x = (i + 0.5) * (S / 10); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x - 2, 0, 4, S); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 2, 0, 2, S); gh.fillStyle = '#c4c4c4'; gh.fillRect(x - 4, 0, 8, S); gr.fillStyle = '#6a6a6a'; gr.fillRect(x - 4, 0, 8, S); }
    g.fillStyle = 'rgba(120,96,60,0.75)'; g.fillRect(0, 0, S, 10); gh.fillStyle = '#d0d0d0'; gh.fillRect(0, 0, S, 10); gr.fillStyle = '#505050'; gr.fillRect(0, 0, S, 10);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, S - 3, S, 3); g.fillRect(0, 0, 3, S);
    return { map: m, rough: r, height: hgt, strength: 2.2 };
  },
  /* lander skin: windward half black tiles, leeward half white steel (u < 0.5 is windward) */
  tpsHalf() {
    const a = PAINT.tps(), b = PAINT.stainless();
    const S = 512, m = canvas(S), r = canvas(S), hgt = canvas(S);
    for (const [dst, src1, src2] of [[m, a.map, b.map], [r, a.rough, b.rough], [hgt, a.height, b.height]]) { const g = dst.getContext('2d'); g.drawImage(src1, 0, 0, S / 2, S, 0, 0, S / 2, S); g.drawImage(src2, S / 2, 0, S / 2, S, S / 2, 0, S / 2, S); g.fillStyle = 'rgba(90,90,90,0.9)'; g.fillRect(S / 2 - 2, 0, 4, S); }
    return { map: m, rough: r, height: hgt, strength: 1.8 };
  }
};

/* ---- presets: colour, metalness, roughness, which painter, emissive ---- */
export const PRESETS = {
  white: { color: 0xffffff, metalness: 0.25, roughness: 0.45, paint: 'white' },
  offwhite: { color: 0xf0f0ee, metalness: 0.2, roughness: 0.5, paint: 'white', base: '#dfe3e7' },
  stainless: { color: 0xffffff, metalness: 0.9, roughness: 0.38, paint: 'stainless', envMapIntensity: 0.7 },
  tps: { color: 0xffffff, metalness: 0.05, roughness: 0.85, paint: 'tps' },
  tpsHalf: { color: 0xffffff, metalness: 0.55, roughness: 0.5, paint: 'tpsHalf' },
  mli: { color: 0xffffff, metalness: 0.75, roughness: 0.42, paint: 'mli' },
  cell: { color: 0xffffff, metalness: 0.6, roughness: 0.22, paint: 'cell', envMapIntensity: 0.9 },
  radiator: { color: 0xffffff, metalness: 0.35, roughness: 0.52, paint: 'radiator', envMapIntensity: 0.6 },
  glass: { color: COLOURS.glass, metalness: 0.1, roughness: 0.15, emissive: 0x7fb6ff, emissiveIntensity: 0.9 },
  dark: { color: COLOURS.dark, metalness: 0.65, roughness: 0.5 },
  grey: { color: COLOURS.grey, metalness: 0.6, roughness: 0.4 },
  gold: { color: COLOURS.gold, metalness: 0.85, roughness: 0.3 },
  copper: { color: COLOURS.copper, metalness: 0.9, roughness: 0.35 },
  chrome: { color: 0xd9dde2, metalness: 1, roughness: 0.18 },
  hatch: { color: COLOURS.hatch, metalness: 0.55, roughness: 0.45 },
  tank: { color: 0xffffff, metalness: 0.8, roughness: 0.38, paint: 'mli', base: '#c8ccd2', envMapIntensity: 0.8 },
  accent: { color: COLOURS.accent, metalness: 0.3, roughness: 0.5 },
  bell: { color: 0x2b2420, metalness: 0.9, roughness: 0.35 },
  film: { color: COLOURS.film, metalness: 0.45, roughness: 0.34, emissive: 0x2b4c70, transparent: true, opacity: 0.28 },
  navRed: { color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 3, basic: true },
  navGreen: { color: 0x2aff6a, emissive: 0x2aff6a, emissiveIntensity: 3, basic: true },
  navWhite: { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3, basic: true },
  warm: { color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: 1.2, basic: true }
};

const paintCache = new Map();
function painted(kind, base) {
  const k = `${kind}|${base ?? ''}`;
  if (!paintCache.has(k)) {
    const p = PAINT[kind](base);
    paintCache.set(k, { map: texture(p.map), rough: texture(p.rough, false), normal: texture(normalFrom(p.height, p.strength), false) });
  }
  return paintCache.get(k);
}

const matCache = new Map();
/**
 * A material for a surface kind at a repeat count. Materials are cached by kind and repeat, so a
 * model with forty panels of the same skin shares one material (one program, one texture set).
 */
export function surface(kind, opts = {}) {
  const preset = PRESETS[kind] ?? PRESETS.grey;
  const rep = opts.repeat ?? [1, 1];
  const key = `${kind}|${rep[0]}|${rep[1]}|${opts.side ?? ''}|${opts.opacity ?? ''}`;
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (preset.basic) {
    m = new THREE.MeshBasicMaterial({ color: preset.color, toneMapped: false });
  } else {
    m = new THREE.MeshStandardMaterial({
      color: preset.color, metalness: preset.metalness, roughness: preset.roughness,
      emissive: preset.emissive ?? 0x000000, emissiveIntensity: preset.emissiveIntensity ?? 1,
      transparent: !!preset.transparent || opts.opacity != null, opacity: opts.opacity ?? preset.opacity ?? 1,
      side: opts.side ?? THREE.DoubleSide, envMapIntensity: preset.envMapIntensity ?? 0.45
    });
    /* every body is drawn double-sided (open shells, lathes); shadows are cast from the back faces so a closed hull does not
       shadow-acne its own skin */
    m.shadowSide = THREE.BackSide;
    if (HAS_DOM && preset.paint) {
      const p = painted(preset.paint, preset.base);
      const clone = (t) => { const c = t.clone(); c.repeat.set(rep[0], rep[1]); c.needsUpdate = true; return c; };
      m.map = clone(p.map); m.roughnessMap = clone(p.rough); m.normalMap = clone(p.normal);
      m.normalScale = new THREE.Vector2(0.6, 0.6);
    }
  }
  m.userData.surface = kind;
  matCache.set(key, m);
  return m;
}

/** Repeat counts for a cylinder of circumference `circ` and length `len` so one panel bay is ~`bay` metres. */
export const repeatFor = (circ, len, bay = 1.6) => [Math.max(1, Math.round(circ / bay)), Math.max(1, Math.round(len / bay))];
