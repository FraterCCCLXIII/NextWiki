// Validates the vehicle directory and rebuilds index.json.
// Usage: node validate.mjs   (run from this directory or anywhere)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const FILES = [
  "launch-vehicles.json",
  "crewed-spacecraft.json",
  "uncrewed-spacecraft.json",
  "stations.json",
  "experimental.json",
  "ships.json",
];
const CATEGORIES = new Set([
  "launch_vehicle", "crewed_spacecraft", "uncrewed_spacecraft", "lander",
  "space_station", "spaceplane", "experimental", "concept", "original",
]);
const STATUSES = new Set([
  "operational", "retired", "in_development", "cancelled", "lost", "concept",
]);
const NUMERIC = [
  "height_m", "length_m", "diameter_m", "wingspan_m", "mass_kg", "dry_mass_kg",
  "thrust_kN", "payload_leo_kg", "payload_gto_kg", "payload_tli_kg",
  "crew_capacity", "flights", "successes",
];

const errors = [];
const seen = new Map();
const index = [];

for (const file of FILES) {
  let list;
  try {
    list = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch (e) {
    errors.push(`${file}: ${e.message}`);
    continue;
  }
  if (!Array.isArray(list)) { errors.push(`${file}: must be an array`); continue; }
  for (const v of list) {
    const where = `${file}:${v.id ?? "<no id>"}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.id ?? "")) errors.push(`${where}: bad id`);
    if (seen.has(v.id)) errors.push(`${where}: duplicate id (also in ${seen.get(v.id)})`);
    seen.set(v.id, file);
    if (!v.name) errors.push(`${where}: missing name`);
    if (!CATEGORIES.has(v.category)) errors.push(`${where}: bad category ${v.category}`);
    if (!STATUSES.has(v.status)) errors.push(`${where}: bad status ${v.status}`);
    if (typeof v.built !== "boolean") errors.push(`${where}: built must be boolean`);
    if (!v.source) errors.push(`${where}: missing source`);
    for (const k of NUMERIC) {
      if (v[k] != null && (typeof v[k] !== "number" || v[k] < 0)) errors.push(`${where}: ${k} must be a non-negative number`);
    }
    if (v.successes != null && v.flights != null && v.successes > v.flights) errors.push(`${where}: successes > flights`);
    if (v.dry_mass_kg != null && v.mass_kg != null && v.dry_mass_kg > v.mass_kg) errors.push(`${where}: dry_mass_kg > mass_kg`);
    index.push({ id: v.id, name: v.name, category: v.category, status: v.status, file });
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 1) + "\n");
console.log(`OK: ${index.length} vehicles across ${FILES.length} files; index.json written`);
