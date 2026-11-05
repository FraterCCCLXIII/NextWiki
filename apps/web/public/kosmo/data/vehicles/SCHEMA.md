# Vehicle directory

A catalogue of every rocket, spacecraft, station, lander, spaceplane and experimental or
conceptual craft we can document. It feeds the simulator and space-travel features, and
will later link to 3D models and to our own original ship designs.

Files (each is a JSON array of entries):

| File | Contents |
| --- | --- |
| `launch-vehicles.json` | Orbital and suborbital rockets, historical to in-development |
| `crewed-spacecraft.json` | Capsules, spaceplanes, landers with crew capacity |
| `uncrewed-spacecraft.json` | Probes, observatories, rovers, landers |
| `stations.json` | Space stations |
| `experimental.json` | Rocket planes, test articles, propulsion tests, unbuilt/concept craft |
| `ships.json` | **Our own ship designs** (empty for now; same schema, `category` any) |
| `engines.json` | Rocket engines shown alone in the catalogue viewer (`category: engine`; real 3D models mapped in `static/models/spacex/manifest.json` under `labs.catalog`) |

`node validate.mjs` checks every file against the rules below and rebuilds `index.json`
(a flat id → file/name/category lookup for the simulator).

## Entry fields

All numeric values are SI. Use `null` for unknown; never guess. Optional fields may be omitted.

| Field | Meaning |
| --- | --- |
| `id` | kebab-case, unique across all files |
| `name`, `aliases[]` | display name and other names |
| `category` | `launch_vehicle`, `crewed_spacecraft`, `uncrewed_spacecraft`, `lander`, `space_station`, `spaceplane`, `experimental`, `concept`, `original`, `engine` |
| `status` | `operational`, `retired`, `in_development`, `cancelled`, `lost`, `concept` |
| `built` | `true` if hardware ever existed (flown or ground-tested), `false` for paper designs |
| `country`, `manufacturer`, `operator` | strings (country may be an array for joint programs) |
| `first_flight`, `last_flight` | year as integer, or ISO date string if known |
| `flights`, `successes` | counts; `null` if still changing or unknown (see `as_of`) |
| `crew_capacity` | integer or `null` |
| `height_m`, `length_m`, `diameter_m`, `wingspan_m` | principal dimensions |
| `mass_kg` | liftoff / launch mass (fully fuelled) |
| `dry_mass_kg` | empty mass |
| `thrust_kN` | total liftoff thrust (sea level where applicable); for an `engine`, its sea-level thrust |
| `thrust_kN_vac`, `isp_s_sl`, `isp_s_vac` | engine entries: vacuum thrust and specific impulse (`diameter_m` is then the bell exit diameter, `height_m` the engine length; `used_on` lists the vehicles) |
| `payload_leo_kg`, `payload_gto_kg`, `payload_tli_kg`, `payload_other` | performance to named orbits |
| `propellant` | main propellant combination |
| `reusable` | `none`, `partial`, `full` |
| `orbital` | `false` for suborbital-only vehicles (V-2, Redstone, New Shepard); omitted means orbital-capable |
| `stages[]` | `{ name, engine, engines, thrust_kN_vac, isp_s_vac, propellant, dry_mass_kg, prop_mass_kg }` — enough for a delta-v calculation |
| `notes` | short human summary |
| `source` | primary reference URL |
| `model3d` | `{ "status": "none" \| "planned" \| "in_progress" \| "done", "path": null }`; omitted means `none` |
| `data_quality` | `draft` (compiled from reference knowledge, not yet cross-checked), `checked` (verified against `source`); omitted means `draft` |
| `as_of` | date the counts/status were last true |

Rules of thumb: do not invent figures. Where sources disagree, take the figure from `source`
and say so in `notes`. Concept vehicles use the designers' published figures.
