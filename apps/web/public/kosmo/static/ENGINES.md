# Engine library

One table of rocket engines for the Shipyard (`shipyard.html`, `ship-sim.js`), the Landing Lab
(`landing-lab.html`, `landing-sim.js`) and the vehicle catalogue (`data/vehicles/`).

## Where things live

| File | Role |
| --- | --- |
| `engines-library.json` | **The single source of truth.** Edit engines here. |
| `engines.js` | ES module that imports the JSON (import attribute, so it loads synchronously in browsers and node) and exports `ENGINES`, `resolveEngine`, `engineOf`, `notFlyableReason`, `requireFlyable`, `loadEngines`, `finishEngine`, `P0`. |
| `flight-data.json` | Its `engines` block is a **generated** copy. Regenerate with the build script; do not edit by hand. Its `landingVehicles` block is hand-edited as before. |
| `tools/build-engine-library.mjs` | Writes the generated block. `--check` exits 1 if it is out of step. |
| `data/vehicles/engines.json`, `launch-vehicles.json` | Catalogue rows carry `engine_id`, a link to a library id. `data/vehicles/validate.mjs` checks the links and the figures. |
| `engines-library.test.mjs` | Checks the library, the links and the sync. |

`flight/propulsion.js` is a different table (trip-planner families: solar sail, electric, ion,
and so on). It is not a chemical rocket engine table and is not part of this library.

## Row format

Each entry in `engines-library.json` is keyed by its id, and its `id` must equal the key.

| Field | Units | Meaning |
| --- | --- | --- |
| `id` | kebab-case | Stable id used by presets, saved designs and `engine_id` links. Never reuse an id for another engine. |
| `name` | text | Display name. |
| `aliases` | list | Other names, including the strings the catalogue uses in stage `engine`. Each alias must be unique across the library. |
| `propellants` | text | Display, e.g. `LOX/RP-1`. |
| `prop` | `kerolox`, `methalox`, `hydrolox`, `hypergolic`, `solid` | Sim key: selects the structural and density factors in `ship-sim.js`. |
| `thrustSL`, `thrustVac` | N | Sea-level and vacuum thrust. `0` where the engine does not run at sea level. |
| `ispSL`, `ispVac` | s | Specific impulse. `ispVac >= ispSL`. |
| `mass` | kg | Engine (dry) mass. |
| `minThrottle` | fraction, `(0, 1]` | Lowest throttle. `null` if not sourced. |
| `ignitions` | integer `>= 1` | Starts the sim allows: the first start plus restarts. `null` if not sourced. |
| `vacOnly` | boolean | `true` if it cannot start in the atmosphere. |
| `gimbalDeg` | degrees | Half-angle of gimbal, if sourced. |
| `cycle` | text | e.g. `gas-generator`, `full-flow staged combustion`. |
| `source` | URL | Primary reference. `null` if the row is carried over unsourced. |
| `notes` | text | Where sources disagree, which figure was kept and why. Unverified rows say so. |

**Unknown values are `null`. Do not guess.** An engine with `minThrottle` or `ignitions` `null`
is still listed, but `notFlyableReason()` reports it and the sims refuse to fly it
(`requireFlyable` throws). The Shipyard engine menu lists only flyable engines.

## Lookups

- `resolveEngine(ref, where)` takes an id or an alias and returns the id. An unknown name **throws**.
  There is no fallback engine, so a typo shows up at once instead of flying a Merlin.
- `engineOf(ref, where)` returns the engine object.
- Sims call `resolveEngine` and `requireFlyable` on every stage and vehicle they build
  (`completeStage` in `ship-sim.js`, `vehicleFromStage` and `resolveVehicle` in `landing-sim.js`).

## Adding an engine

1. Find the figures in a primary source (manufacturer, NASA, or the Wikipedia article with its
   references). Record the URL in `source`. Write the conflicts you see in `notes`.
2. Add a row to `engines-library.json`. Give `id` and `aliases` (include the strings the catalogue uses).
   Use `null` for anything you cannot source.
3. Run `node static/tools/build-engine-library.mjs` to refresh `flight-data.json`.
4. If the catalogue has a row or stage for it, set `engine_id` in `data/vehicles/` (`null` if there is no library entry).
5. Run `node static/engines-library.test.mjs` and `node data/vehicles/validate.mjs`.
   The validator rebuilds `data/vehicles/index.json`.

## Changing a figure a sim uses

Check which presets use the engine (`grep -n "engine: '" static/shipyard.html static/landing-sim.js`),
change the figure, regenerate `flight-data.json`, and re-run every `static/*.test.mjs`. Say in
the commit message which flown result moved.

## Note on flight-data.json from the database

The page loads `flight-data.json` from the database when the dataset is there. That copy is merged
over the built-in table with `loadEngines()`. If the database copy is older than the library,
it overrides the library values until it is re-synced. Re-upload the regenerated file.
