// centauri-shots-receiver.mjs -- a local receiver for the lab pages' screenshot automation.
//   node centauri-shots-receiver.mjs [port=8774] [outDir=centauri-shots]
// Add --once to exit after the first POST /done (one batch); otherwise it keeps serving batch after batch.
// The pages (centauri-lab.html?shots=..., centauri-robotic.html?shots=...) POST each rendered view as a
// PNG data URL to http://127.0.0.1:<port>/shot?name=<dir>/<ship>-<view>; this writes it to
// <outDir>/<name>.png. POST /done prints a summary and exits.

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 8774);
const outDir = process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), 'centauri-shots');
let count = 0;

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (req.method === 'POST' && url.pathname === '/done') { res.writeHead(200); res.end('ok'); console.log(`done: ${count} shots in ${outDir}`); if (process.argv.includes('--once')) setTimeout(() => process.exit(0), 200); return; }
  if (req.method !== 'POST' || url.pathname !== '/shot') { res.writeHead(404); res.end(); return; }
  const name = normalize(url.searchParams.get('name') ?? `shot-${Date.now()}`).replace(/^(\.\.[/\\])+/, '');
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    const m = /^data:image\/png;base64,(.+)$/.exec(body);
    if (!m) { res.writeHead(400); res.end('not a png data url'); return; }
    const file = join(outDir, `${name}.png`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(m[1], 'base64'));
    count += 1;
    console.log(`saved ${file}`);
    res.writeHead(200); res.end('ok');
  });
}).listen(port, '127.0.0.1', () => console.log(`shot receiver on 127.0.0.1:${port} -> ${outDir}`));
