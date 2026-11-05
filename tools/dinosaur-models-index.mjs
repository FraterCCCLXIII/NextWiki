// Matches downloaded Sketchfab models to PBDB genera and writes static/dinosaurs/models.json for the Dinosaurs page.
//   node tools/dinosaur-models-index.mjs
//
// A model matches a genus when a word in its title equals the genus name ("Accurate Triceratops horridus" -> Triceratops).
// Titles that don't match are listed so you can map them by hand in models-manual.json: { "<sketchfab uid>": "<genus>" }.
// Only models in models/dinosaurs/CREDITS.json are indexed; anything moved to _quarantine/ is ignored.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const stat = path.join(root, "apps/web/public/kosmo/static");
const credits = JSON.parse(fs.readFileSync(path.join(stat, "models/dinosaurs/CREDITS.json"), "utf8"));
const { taxa } = JSON.parse(fs.readFileSync(path.join(stat, "dinosaurs/dinosaurs.json"), "utf8"));
const manualFile = path.join(stat, "dinosaurs/models-manual.json");
const manual = fs.existsSync(manualFile) ? JSON.parse(fs.readFileSync(manualFile, "utf8")) : {};
if (!fs.existsSync(manualFile)) fs.writeFileSync(manualFile, "{}\n");

const genusId = new Map(); // lowercase name -> id, valid body genera only
for (const t of taxa) if (t.r === "genus" && !t.inv && !t.form && !genusId.has(t.n.toLowerCase())) genusId.set(t.n.toLowerCase(), t.id);

const out = {}, unmatched = [];
for (const [uid, c] of Object.entries(credits)) {
  if (!fs.existsSync(path.join(stat, "models/dinosaurs", `${uid}.glb`))) continue;
  const words = c.name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const hit = manual[uid]?.toLowerCase() ?? words.find((w) => genusId.has(w));
  const id = hit && genusId.get(hit);
  if (!id) { unmatched.push(`${uid}  ${c.name}  (${c.author})`); continue; }
  (out[id] ??= []).push({ uid, file: `models/dinosaurs/${uid}.glb`, title: c.name, author: c.author, authorUrl: c.authorUrl, license: c.license, source: c.source });
}
fs.writeFileSync(path.join(stat, "dinosaurs/models.json"), JSON.stringify(out));
console.log(`${Object.values(out).flat().length} models matched to ${Object.keys(out).length} genera`);
if (unmatched.length) console.log(`\nNo genus match (add to models-manual.json):\n  ${unmatched.join("\n  ")}`);
