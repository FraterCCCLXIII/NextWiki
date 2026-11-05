// Downloads Sketchfab models (GLB) through the official Download API, using YOUR account's API token.
//
//   export SKETCHFAB_TOKEN=...        # sketchfab.com > Settings > Password & API > API token
//   node tools/sketchfab-download.mjs tools/sketchfab-selection.json [--dry]
//
// The selection file is an array of { uid, name, user, userName, license, url, glbBytes }.
// Files land in apps/web/public/kosmo/static/models/dinosaurs/<uid>.glb, and CREDITS.json records the author,
// licence and source URL of each one: CC Attribution requires that credit to be shown wherever the model is used.
// Sketchfab's download dialog is where the licence is acknowledged on the website; this script is the API equivalent,
// so only run it on a selection you have reviewed. Already-downloaded files are skipped, so reruns are safe.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = path.join(root, "apps/web/public/kosmo/static/models/dinosaurs");
const [selFile] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
const token = process.env.SKETCHFAB_TOKEN;

if (!selFile) throw new Error("usage: node tools/sketchfab-download.mjs <selection.json> [--dry]");
if (!token && !dry) throw new Error("Set SKETCHFAB_TOKEN in your shell first (never paste it into a file or chat).");

const sel = JSON.parse(fs.readFileSync(selFile, "utf8"));
const mb = (n) => (n / 1e6).toFixed(1);
console.log(`${sel.length} models -> ${path.relative(root, outDir)}`);
if (dry) { sel.forEach((m) => console.log(`  ${m.uid}  ${m.faces ?? "?"} faces  ${m.license}  ${m.name} by ${m.user}`)); process.exit(0); }

fs.mkdirSync(outDir, { recursive: true });
const creditsFile = path.join(outDir, "CREDITS.json");
const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let done = 0, skipped = 0, failed = 0;

for (const m of sel) {
  const file = path.join(outDir, `${m.uid}.glb`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) { skipped++; continue; }
  try {
    // 1) ask the API for a short-lived signed URL (needs the token); 2) fetch the GLB from it (no token sent to the CDN)
    const r = await fetch(`https://api.sketchfab.com/v3/models/${m.uid}/download`, { headers: { Authorization: `Token ${token}` } });
    if (r.status === 429) { console.warn("rate limited, waiting 30s"); await sleep(30000); sel.push(m); continue; }
    if (!r.ok) throw new Error(`download API ${r.status}`);
    const info = await r.json();
    const url = info.glb?.url;
    if (!url) throw new Error("no GLB offered for this model");
    const f = await fetch(url);
    if (!f.ok) throw new Error(`file ${f.status}`);
    fs.writeFileSync(file, Buffer.from(await f.arrayBuffer()));
    credits[m.uid] = { name: m.name, author: m.userName || m.user, authorUrl: `https://sketchfab.com/${m.user}`, license: m.license, source: m.url, downloaded: new Date().toISOString().slice(0, 10) };
    fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2));
    done++; console.log(`ok   ${m.uid} ${m.name}`);
  } catch (e) { failed++; console.warn(`FAIL ${m.uid} ${m.name}: ${e.message}`); }
  await sleep(600);
}
console.log({ done, skipped, failed });
