// Validates the vehicle directory and rebuilds index.json.
// Usage: node validate.mjs   (run from this directory or anywhere)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  "engines.json",
];
const CATEGORIES = new Set([
  "launch_vehicle", "crewed_spacecraft", "uncrewed_spacecraft", "lander",
  "space_station", "spaceplane", "experimental", "concept", "original", "engine",
]);
const STATUSES = new Set([
  "operational", "retired", "in_development", "cancelled", "lost", "concept",
]);
const NUMERIC = [
  "height_m", "length_m", "diameter_m", "wingspan_m", "mass_kg", "dry_mass_kg",
  "thrust_kN", "payload_leo_kg", "payload_gto_kg", "payload_tli_kg",
  "crew_capacity", "flights", "successes",
  "thrust_kN_vac", "isp_s_sl", "isp_s_vac",
];

const errors = [];
const seen = new Map();
const index = [];

// The engine library (static/engines-library.json) and the 3D manifest (static/models/spacex/manifest.json) that catalogue rows point at.
const STATIC = join(dir, "..", "..", "static");
const LIB = JSON.parse(readFileSync(join(STATIC, "engines-library.json"), "utf8")).engines;
const MANIFEST = JSON.parse(readFileSync(join(STATIC, "models", "spacex", "manifest.json"), "utf8"));
const ALIAS = new Map();   // library id or catalogue alias -> library id
for (const [id, e] of Object.entries(LIB)) {
  ALIAS.set(id, id);
  for (const a of e.aliases || []) {
    if (ALIAS.has(a) && ALIAS.get(a) !== id) errors.push(`engines-library.json: alias "${a}" used by ${ALIAS.get(a)} and ${id}`);
    ALIAS.set(a, id);
  }
}
const near = (x, ref) => (ref === 0 ? x === 0 : Math.abs(x - ref) <= 0.2 * Math.abs(ref));   // within 20 %
const stats = { vehicles: 0, stages: 0, stagesLinked: 0, stageStrings: 0, unresolved: 0, engineRows: 0, engineRowsLinked: 0, model3d: 0 };
const unresolvedNames = new Set();

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
    stats.vehicles++;

    // launch stages: fields, mass, and the engine link to the library
    if (v.stages != null && !Array.isArray(v.stages)) errors.push(`${where}: stages must be an array`);
    let massSum = 0, massCount = 0;
    for (const [i, s] of (Array.isArray(v.stages) ? v.stages : []).entries()) {
      const sw = `${where} stage ${i + 1} (${s.name ?? "?"})`;
      stats.stages++;
      if (!s.name) errors.push(`${sw}: missing name`);
      if (!s.engine) errors.push(`${sw}: missing engine`);
      if (s.engines != null && (!Number.isInteger(s.engines) || s.engines < 1)) errors.push(`${sw}: engines must be a positive integer`);
      for (const k of ["dry_mass_kg", "prop_mass_kg", "thrust_kN_vac", "isp_s_vac"]) {
        if (s[k] != null && (typeof s[k] !== "number" || s[k] < 0)) errors.push(`${sw}: ${k} must be a non-negative number`);
      }
      if (typeof s.dry_mass_kg === "number" && typeof s.prop_mass_kg === "number") {
        massSum += s.dry_mass_kg + s.prop_mass_kg; massCount++;
        if (v.mass_kg != null && s.dry_mass_kg + s.prop_mass_kg > v.mass_kg) errors.push(`${sw}: dry + propellant exceeds the vehicle mass_kg`);
      }
      // engine link: engine_id is a library id, a list of ids (mixed stage), or null when the library has no such engine
      if (!Object.prototype.hasOwnProperty.call(s, "engine_id")) { errors.push(`${sw}: missing engine_id (use null if the engine is not in the library)`); continue; }
      stats.stageStrings++;
      const ids = Array.isArray(s.engine_id) ? s.engine_id : [s.engine_id];
      const want = typeof s.engine === "string" ? (ALIAS.get(s.engine) ?? null) : null;
      if (s.engine_id === null) {
        if (want) errors.push(`${sw}: engine_id is null but "${s.engine}" is library engine ${want}`);
        else { stats.unresolved++; unresolvedNames.add(s.engine); }
        continue;
      }
      if (Array.isArray(s.engine_id)) {
        const parts = String(s.engine).split(" / ").map(p => ALIAS.get(p.trim()));
        if (!parts.every((p, j) => p === s.engine_id[j]) || parts.length !== s.engine_id.length) errors.push(`${sw}: engine_id list ${JSON.stringify(s.engine_id)} does not match engine "${s.engine}"`);
      } else if (want !== s.engine_id) {
        errors.push(`${sw}: engine "${s.engine}" is library ${want ?? "(no alias)"} but engine_id is ${s.engine_id}`);
      }
      let unknown = false;
      for (const id of ids) if (!LIB[id]) { errors.push(`${sw}: engine_id ${id} is not in engines-library.json`); unknown = true; }
      if (unknown) continue;
      stats.stagesLinked++;
      // thrust and Isp sanity: per-engine figures within 20 % of the library (single-engine stages only)
      const e = LIB[ids[0]];
      if (!Array.isArray(s.engine_id) && s.engines && s.thrust_kN_vac != null && e.thrustVac > 0 && !near(s.thrust_kN_vac * 1e3 / s.engines, e.thrustVac))
        errors.push(`${sw}: thrust_kN_vac/engines = ${(s.thrust_kN_vac / s.engines).toFixed(1)} kN, library ${e.id} ${(e.thrustVac / 1e3).toFixed(1)} kN (more than 20 % apart)`);
      if (!Array.isArray(s.engine_id) && s.isp_s_vac != null && e.ispVac > 0 && !near(s.isp_s_vac, e.ispVac))
        errors.push(`${sw}: isp_s_vac ${s.isp_s_vac} s, library ${e.id} ${e.ispVac} s (more than 20 % apart)`);
    }
    if (massCount && v.mass_kg != null && massSum > v.mass_kg) errors.push(`${where}: stage dry + propellant sum (${massSum} kg) exceeds mass_kg (${v.mass_kg})`);

    // engine rows: the catalogue's own figures against the library
    if (v.category === "engine") {
      stats.engineRows++;
      if (!Object.prototype.hasOwnProperty.call(v, "engine_id")) errors.push(`${where}: engine row missing engine_id (use null for a concept)`);
      else if (v.engine_id === null) {
        if (v.built !== false && v.status !== "concept") errors.push(`${where}: engine_id null but the engine is built`);
      } else if (!LIB[v.engine_id]) errors.push(`${where}: engine_id ${v.engine_id} is not in engines-library.json`);
      else {
        stats.engineRowsLinked++;
        const e = LIB[v.engine_id];
        const chk = (k, x, ref, unit) => { if (x != null && ref > 0 && !near(x, ref)) errors.push(`${where}: ${k} ${x} ${unit} vs library ${e.id} ${ref} ${unit} (more than 20 % apart)`); };
        chk("thrust_kN", v.thrust_kN, e.thrustSL / 1e3, "kN");
        chk("thrust_kN_vac", v.thrust_kN_vac, e.thrustVac / 1e3, "kN");
        chk("isp_s_sl", v.isp_s_sl, e.ispSL, "s");
        chk("isp_s_vac", v.isp_s_vac, e.ispVac, "s");
        chk("dry_mass_kg", v.dry_mass_kg, e.mass, "kg");
      }
    }

    // 3D model: a manifest key (vehicle, or engine for engine rows) and the file must exist
    if (v.model3d && typeof v.model3d === "object") {
      stats.model3d++;
      if (v.model3d.key != null) {
        const pool = v.category === "engine" ? MANIFEST.engines : MANIFEST.vehicles;
        if (!pool || !pool[v.model3d.key]) errors.push(`${where}: model3d.key ${v.model3d.key} is not a key in static/models/spacex/manifest.json`);
      }
      if (v.model3d.status === "done" && typeof v.model3d.path === "string" && !existsSync(join(STATIC, "models", "spacex", v.model3d.path)))
        errors.push(`${where}: model3d.path ${v.model3d.path} not found under static/models/spacex/`);
    }

    index.push({ id: v.id, name: v.name, category: v.category, status: v.status, file });
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 1) + "\n");
console.log(`OK: ${index.length} vehicles across ${FILES.length} files; index.json written`);
console.log(`    ${stats.stages} launch stages: ${stats.stagesLinked} linked to engines-library.json, ${stats.unresolved} engine strings with no library entry (listed as null: ${[...unresolvedNames].join(", ") || "none"})`);
console.log(`    ${stats.engineRows} catalogue engine rows, ${stats.engineRowsLinked} linked and checked against the library; ${stats.model3d} rows with model3d`);
