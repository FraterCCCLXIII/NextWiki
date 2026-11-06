// Generates the engines block of static/flight-data.json from static/engines-library.json (the single source of truth).
// Usage:  node static/tools/build-engine-library.mjs          rewrite flight-data.json's "engines" block
//         node static/tools/build-engine-library.mjs --check  exit 1 if flight-data.json is out of step with the library
// Everything else in flight-data.json (landingVehicles, _comment) is left as it is.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const STATIC = join(here, "..");
const LIB_FILE = join(STATIC, "engines-library.json");
const FLIGHT_FILE = join(STATIC, "flight-data.json");

/** The engines block as flight-data.json should carry it: every library row, keyed by id, in library order. */
export function buildEnginesBlock(lib) {
  const out = {};
  for (const [id, row] of Object.entries(lib.engines)) out[id] = row;
  return out;
}

/** flight-data.json with its engines block replaced by the library's rows (other keys keep their order). */
export function buildFlightData(lib, flight) {
  return { ...flight, engines: buildEnginesBlock(lib) };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const lib = JSON.parse(readFileSync(LIB_FILE, "utf8"));
  const flightText = readFileSync(FLIGHT_FILE, "utf8");
  const flight = JSON.parse(flightText);
  const next = buildFlightData(lib, flight);
  const nextText = JSON.stringify(next, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (nextText !== flightText) {
      console.error("flight-data.json engines block is out of step with engines-library.json; run node static/tools/build-engine-library.mjs");
      process.exit(1);
    }
    console.log(`OK: flight-data.json engines block matches engines-library.json (${Object.keys(lib.engines).length} engines)`);
  } else {
    writeFileSync(FLIGHT_FILE, nextText);
    console.log(`wrote flight-data.json engines block (${Object.keys(lib.engines).length} engines)`);
  }
}
