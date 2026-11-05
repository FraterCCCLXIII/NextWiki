#!/usr/bin/env node
// Builds apps/web/public/kosmo/static/skycultures/index.json from every skycultures/<id>.json
// (except index.json and boundaries.json). Usage: node tools/skycultures/build-index.mjs [dir]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(here, '../../apps/web/public/kosmo/static');
const dir = resolve(process.argv[2] || join(staticDir, 'skycultures'));
const SKIP = new Set(['index.json', 'boundaries.json']);

const cultures = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && !SKIP.has(f)).sort()) {
  try {
    const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (!j || !Array.isArray(j.figures)) { console.warn(`skip ${f}: no figures array`); continue; }
    const id = j.id || f.replace(/\.json$/, '');
    cultures.push({ id, name: j.name || id, region: j.region || '', era: j.era || '', color: j.color || '#c8d0e0', description: j.description || '', figureCount: j.figures.length, file: f });
  } catch (e) { console.warn(`skip ${f}: ${e.message}`); }
}
// the 88 IAU constellations (constellations.json) are always the first, built-in culture
let iauCount = 88;
try { iauCount = JSON.parse(readFileSync(join(staticDir, 'constellations.json'), 'utf8')).constellations.length; } catch { /* keep 88 */ }
const rank = c => (c.id === 'western' ? 0 : c.id === 'historical' ? 1 : c.id === 'western-asterisms' ? 2 : 3);
cultures.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
const western = { id: 'western', name: 'Western (IAU)', region: 'Europe / worldwide', era: 'Ptolemy 2nd c. - IAU 1922/1930', color: '#7fa7ff', description: 'The 88 IAU constellations, drawn from constellations.json.', figureCount: iauCount, file: null, builtin: true };
const out = { cultures: [western, ...cultures.filter(c => c.id !== 'western')] };
writeFileSync(join(dir, 'index.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`index.json: ${out.cultures.length} cultures (${out.cultures.map(c => `${c.id}:${c.figureCount}`).join(', ')})`);
