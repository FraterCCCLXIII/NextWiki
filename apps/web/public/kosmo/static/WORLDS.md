# Worlds and constants (`worlds.js`)

`worlds.js` is the one table of body and physical constants for the Kosmographica sims. It is an ES module, so it loads in the
browser (`import`, or `<script type="module">`) and in node (`import './worlds.js'`). Tests: `node worlds.test.mjs`.

Exports:

- `BODIES`: the body table (earth, moon, mars; data-only mercury, venus, titan for the flight files).
- `CONST`: defined and fundamental constants (`G0`, `G`, `C`, `AU`, `GM_SUN`, `P_SL`, `RHO_AIR_SL`, `R_AIR`, `GAMMA_AIR`).
- `makeWorld(id)`: the sim view `{ id, name, R, mu, w, rho(h), sound(h), gamma, atmoTop, surfaceGravity }`.
  `ship-sim.js` exports `WORLDS = { earth, moon, mars }` built from it, and `landing-sim.js`, `space-access.js` and the pages read `W.R`,
  `W.mu`, `W.w`, `W.rho(h)`, `W.sound(h)`, `W.gamma`, `W.atmoTop` as before.
- `interp(table, x, log)`: linear or log-linear table interpolation.

## Radius convention

Read this before you use a radius. Changing a radius changes `g = mu / R^2` and every altitude, so it is a physics change.

| Field | Meaning | Who uses it |
| --- | --- | --- |
| `radius` | Sphere radius for the point-mass sims. Earth: WGS 84 equatorial 6378137 m. Mars, Mercury: mean. | ship-sim, landing-sim, space-access, flight/physics, flight/trips, flight/map3d, flight/bodies-iau (`a`) |
| `meanRadius` | NASA fact-sheet mean radius (Earth 6371000 m). | planet-data.js (visual planet layers) |
| `polarRadius` | IAU/WGS polar radius. | flight/bodies-iau.js (`c`) |
| `iauEquatorial` | IAU 2015 equatorial radius where it differs from `radius` (Mars 3396190 m, Mercury 2440530 m). Orientation only. | flight/bodies-iau.js (Mars `a`) |

Earth: `radius` (6378137) is the one all physics uses. The old 6371000 m literals were visual scales; they now read `meanRadius`.
The 3D flight map (`flight/map3d.js`) draws the planet at `radius` too, because its trail is body-centred on the physics radius.

## Atmosphere models

- `table` (Earth): US Standard Atmosphere 1976, geometric altitude. Density is log-interpolated, and zero above `top` (600 km).
  Speed of sound is linearly interpolated. `gamma` 1.4.
- `exp` (Mars, Venus, Titan): `rho0 exp(-h / H)`, zero above `top` if given. `scaleHeight` on Earth gives the same exponential for the
  flight files (`flight/physics.js`, `flight/trips.js`), which still use it.
- `none` (Moon, Mercury): no air. Sound is a nominal 300 m/s and is never used because density is zero.

`atmoTop` is the orbit-insertion clearance altitude (ship-sim `minOrbitPeri`, the chute and landing checks, and the shipyard air shell).
It is not the density cut-off. Earth: `atmoTop` 150 km, density table top 600 km. Mars: both are 120 km.

### Earth 1976 check (`worlds.test.mjs`)

Reference: the SI table of the 1976 standard (https://www.pdas.com/bigtables.html, Table 1, geometric altitude; the NOAA-S/T 76-1562 report
is the original). Density agrees within 1 % at 0, 10, 20, 50, 80, 100, 120, 150, 200, 400 and 600 km (checked to 0.04 %).
The old sim table (to 500 km only) was within 0.7 % up to 300 km, but it had two real errors above that: at 400 km the log
interpolation gave 3.16e-12 kg/m^3, 12.8 % above the 1976 value, and the table ended at 500 km, so the density between 500 and
600 km was zero (the interpolation returned 0 past its last row). Both are fixed: the rows at 400 km and 600 km are added.

Speed of sound: the old sim rows at 71 km (314 m/s), 86 km (284 m/s) and 120 km (340 m/s) were wrong. The 1976 values are 293.7,
275.5 and 380.4 m/s. Sea level is 340.3 m/s. The table is now within 0.02 % of the 1976 values at every check altitude.

## Mars cut-off

Before: density cut at 120 km (`h > 120e3 ? 0`), `atmoTop` 80 km. At 80 km the model still has 1.5e-5 kg/m^3 and at 100 km 2.5e-6 kg/m^3,
so the 80 km clearance sat inside the air. Now `atmoTop` = density top = 120 km. The minimum insertion perigee for Mars rises from 84 km
to 126 km (`max(1.05 * atmoTop, orbitAlt - 100 km)`).

## How to add a body

1. Add an entry to `BODIES` in `worlds.js` with `name`, `mu` (GM, m^3/s^2), `w` (sidereal rate, rad/s), `radius`, `meanRadius`,
   `polarRadius`, `atmosphere` (one of the models above), `atmoTop`, `textures` (a key in `textures/index.json`, or null).
   Add `iauEquatorial` only if the IAU radius differs from `radius`, and `semiMajorAxis` for a moon.
2. Give the source in a comment next to the numbers (NASA fact sheet, IAU report, JPL, or the 1976 standard).
3. Run `node worlds.test.mjs`. The surface gravity check compares `mu / R^2` with the nominal value in that test. Add the nominal value there.
4. If a flight file (`flight/physics.js`, `flight/model.js`) needs the new body, add a row to the cross-check in `worlds.test.mjs`.
5. Run every `*.test.mjs` in this folder. A change to a radius or an atmosphere top moves flown results, so check the golden flights.

## Sources

- Earth: GM 3.986004418e14 and equatorial radius 6378137 m (WGS 84 / EGM2008); polar 6356752 m (IAU); mean 6371000 m (NASA fact sheet);
  J2 1.08262668e-3; sidereal rate 7.292115e-5 rad/s.
- Moon: GM 4.9028001e12 (IAU / JPL); radius 1737.4 km (mean); sidereal period 27.321661 d; J2 2.032e-4; semi-major axis 384400 km.
- Mars: GM 4.282837e13 (JPL); mean radius 3389.5 km (NASA fact sheet); IAU equatorial 3396.19 km, polar 3376.2 km; J2 1.96045e-3;
  sidereal period 88642.66 s (rate 7.0882e-5 rad/s); density 0.020 kg/m^3 at the surface, scale height 11.1 km (exponential, sim
  values); sound 240 m/s and gamma 1.29 (nominal).
- Mercury and Venus: as used by flight/physics.js (mean radii 2439.7 km and 6051.8 km; GM from the IAU/JPL tables).
- Titan: flight/physics.js values (radius 2574.7 km, GM 8.9781e12, scale-height air 5.3 kg/m^3, 20 km).
- Standard gravity G0 = 9.80665 m/s^2 (defined). AU = 1.495978707e11 m (defined). GM_SUN = 1.32712440018e20 m^3/s^2 (IAU 2015).
- Air: sea-level density 1.225 kg/m^3, R = 287.05287 J/(kg K), gamma 1.4 (US Std 1976).

## Table of the definitions (original location, status after M0)

"Before" is the file:line where the literal was before M0 (other agents' edits may have moved lines since).

| Quantity | Before (file:line) | Status |
| --- | --- | --- |
| Earth equatorial R 6378137 | `ship-sim.js:55`, `flight/physics.js:8`, `flight/trips.js:77`, `flight/bodies-iau.js:14`, `craft.js:18`, `flight/deck.js:17`, `flight/model.js:1` (km) | moved to `worlds.js` (BODIES.earth.radius); `flight/physics.js` and `flight/model.js`, `craft.js`, `flight/deck.js` kept, checked by test (below) |
| Earth mean R 6371000 | `planet-data.js:7`, `flight/map3d.js:9,93`, `universe-timeline.html:862,1340`, `kosmo-models.js:656` (6.371e6), `sim-physics.js:977` (Rearth), `flight/catalog.js:4` (km) | `planet-data.js`, `sim-physics.js` MEGA.Rearth now read `meanRadius`; `flight/map3d.js` now `radius` (6378137; see below); universe-timeline.html and kosmo-models.js still literal |
| Earth GM 3.986004418e14 | `ship-sim.js:55`, `flight/physics.js:8`, `flight/trips.js:77`, `flight/bodies-iau.js:14`, `flight/model.js:1` (398600.4418 km^3/s^2) | moved (BODIES.earth.mu) |
| Earth rotation 7.292115e-5 | `ship-sim.js:55`, `flight/physics.js:8` | moved (BODIES.earth.w); `sim-physics.js:977` omegaEarth 7.2921159e-5 kept (differs at 1e-6, see below) |
| Earth 1976 density table | `ship-sim.js:44` (EARTH_RHO, to 500 km; 400 km row 12.8 % high; zero between 500 and 600 km) | moved to `worlds.js` (US76_RHO, now to 600 km, with 400 and 600 km rows) |
| Earth 1976 sound table | `ship-sim.js:45` (EARTH_A) | moved and corrected (US76_C) |
| Earth sea-level density 1.225 | `ship-sim.js:44`, `flight/physics.js:8`, `flight/trips.js:77`, `sim-physics.js:503` (RHO_SL) | moved (CONST.RHO_AIR_SL, BODIES.earth.atmosphere) |
| Earth standard gravity 9.80665 | `sim-physics.js:41`, `sim-physics.js:977`, `landing-sim.js:624`, `flight/trips.js:10`, `flight/physics.js:3`, `flight/model.js:1`, `flight/propulsion.js:43`, `spacecraft.html:240`, `warp-lab.html:167`, `micro-ascent/*` (several), `flight/*` | moved to CONST.G0: `sim-physics.js`, `landing-sim.js` (uses ship-sim's G0), `flight/trips.js`. Other files kept (see below) |
| Earth-Sun AU 1.495978707e11 | `space-access.js:19`, `warp-sim.js:32`, `sim-physics.js:1096`, `flight/propulsion.js:9`, `habitability.js:33`, `universe-timeline.html:727` | moved in `space-access.js` and `warp-sim.js`; others kept |
| Solar GM 1.32712440018e20 | `space-access.js:19` (SUN_MU), `flight/physics.js:3` (SUN) | moved (CONST.GM_SUN) in space-access; flight/physics kept |
| Moon R 1737400 (1737.4 km) | `ship-sim.js:56`, `space-access.js:20`, `flight/physics.js:8`, `flight/bodies-iau.js:15`, `flight/map3d.js:9`, `flight/catalog.js:5`, `craft.js:38`, `universe-timeline.html:1341,1347` | moved (BODIES.moon.radius) in ship-sim, space-access, bodies-iau, map3d; others kept |
| Moon GM 4.9028e12 | `ship-sim.js:56`, `space-access.js:20`, `flight/physics.js:8`, `flight/bodies-iau.js:15` (4.9028001e12) | moved (BODIES.moon.mu = 4.9028001e12, the IAU value; relative change 2e-8) |
| Moon rotation 2.6617e-6 | `ship-sim.js:56` | moved (BODIES.moon.w = 2 pi / 27.321661 d = 2.661700e-6; relative change 1e-6) |
| Moon mean distance 384400 km | `space-access.js:20` (a), `flight/catalog.js:5` | moved (BODIES.moon.semiMajorAxis) |
| Mars R 3389500 (3389.5 km) | `ship-sim.js:57`, `planet-data.js:9`, `flight/physics.js:8`, `flight/trips.js:78`, `flight/map3d.js:9`, `flight/catalog.js:4` | moved (BODIES.mars.radius = meanRadius) |
| Mars IAU equatorial 3396190 | `flight/bodies-iau.js:16` (`a`) | moved (BODIES.mars.iauEquatorial), kept as the orientation radius |
| Mars GM 4.28284e13 | `ship-sim.js:57`, `flight/physics.js:8`, `flight/trips.js:78` (4.28284e13), `flight/bodies-iau.js:16` (4.282837e13) | moved (BODIES.mars.mu = 4.282837e13 JPL; relative change 7e-8) |
| Mars rotation 7.0882e-5 | `ship-sim.js:57`, `flight/physics.js:8` (2 pi / 88642.7) | moved (BODIES.mars.w = 7.0882e-5, the sim value) |
| Mars density 0.020 exp(-h/11.1 km), cut 120 km | `ship-sim.js:57`, `flight/physics.js:8`, `flight/trips.js:78` | moved (BODIES.mars.atmosphere) |
| Mars atmoTop 80 km | `ship-sim.js:57`, `planet-data.js:9` (top) | changed to 120 km (see Mars cut-off) |
| Mars sound 240, gamma 1.29 | `ship-sim.js:57` | moved (BODIES.mars.atmosphere) |
| Mercury R 2439.7 km, GM 2.20319e13 | `planet-data.js:5`, `flight/physics.js:8`, `flight/trips.js:75`, `flight/bodies-iau.js:12` (a 2440530, c 2438260) | moved (BODIES.mercury) for planet-data and trips; bodies-iau kept |
| Venus R 6051.8 km, GM 3.24859e14 | `planet-data.js:6`, `flight/physics.js:8`, `flight/trips.js:76`, `flight/bodies-iau.js:13`, `flight/catalog.js:4` | moved (BODIES.venus) for planet-data and trips |
| Titan | `flight/physics.js:8`, `flight/bodies-iau.js:25`, `flight/catalog.js` | data row in BODIES; flight/physics checked by test |
| Air scale height H (Venus 15.9 km, Titan 20 km) | `flight/physics.js:8` | data rows in BODIES |
| Earth J2 1.08262668e-3, Moon 2.032e-4, Mars 1.96045e-3 | `flight/bodies-iau.js:14-16` | moved (BODIES.*.J2) |
| Gravitational constant G 6.6743e-11 | `warp-sim.js:31`, `sim-physics.js:740`, `sim-physics.js:975` (MEGA.G), `ring-system.js:17` | moved in warp-sim (CONST.G); the others kept |
| c 299792458 | `warp-sim.js:31`, `flight/propulsion.js:9`, `universe-timeline.html:727`, `sim-physics.js:975` | moved in warp-sim (CONST.C); the others kept |
| Sea-level pressure 101325 | `ship-sim.js:32` (P0), `sim-physics.js:977` (pAtm), `engines.js:9` (P0), `space-access.js:266` (hull default) | moved in ship-sim and sim-physics; `engines.js` (owned by the engine-library work) and `space-access.js:266` kept |
| Saturn R 60268 km, GM 3.7931187e16 | `flight/bodies-iau.js:18`, `flight/trips.js:80`, `ring-system.js:27` (3.7931208e16), `sim-physics.js:1088` ORBITS table | not in worlds.js (not simulated); kept |

## Still duplicated on purpose (or out of scope for M0)

Each entry gives the reason. The first group is covered by `worlds.test.mjs` (the classic-script flight files are read in a sandbox
and compared with `worlds.js`); the others are not cross-checked.

Covered by test, not imported:

- `flight/physics.js:8` (`worlds` table): a classic IIFE loaded by `<script>` in `flight/index.html` and by `importScripts` in
  `flight/physics-worker.js`, so it cannot import an ES module.
  Its Mars rotation is 2 pi / 88642.7 s (relative difference 3e-6 from the sim value). Migrating it changes how the file loads, so it
  waits for the flight-physics conversion (G10, the physics core decision).
- `flight/model.js:1` (`ME`, `RE`, `G0`, `MUS`): classic file with a `module.exports` guard. Tested for ME and RE.

Kept, not tested:

- `flight/physics.js:3` (`G0`, `AU`, `SUN`): same classic file as above.
- `flight/propulsion.js:9` (`C`, `AU`) and `:43` (`9.80665`): part of the flight engine code; migrate when it becomes a module with the physics core.
- `flight/deck.js:17` (`6378137`, minified one-liner): the deck is not a module; the value equals `BODIES.earth.radius`.
- `craft.js:18` (`DECK_RADIUS.Earth` = 6378137) and `craft.js:38` (fallback 1737.4e3): `craft.js` is a classic script. Values agree with worlds.js.
- `flight/catalog.js:4-5` (km radii for the catalogue): data strings, not a module. Values agree with worlds.js (Mars and Moon use mean radius).
- `sim-physics.js:1085-1086` (ORBITS, Earth 6371.0 km, Mars 3389.5 km): orbit-drawing radii of the contraption page. Visual.
  The Mars value equals `meanRadius`.
- `sim-physics.js:977` (`omegaEarth` 7.2921159e-5): differs from worlds.js (7.292115e-5) by 1e-6 relative. Kept so that the contraption numbers do not move.
- `universe-timeline.html` (R_EARTH 6371e3, Moon 1737.4e3, AU, warp speeds, masses): a visual timeline page with inline script. Visual scale.
- `kosmo-models.js:656` (MEARTH, REARTH 6.371e6, MJUP): visual model scale.
- `habitability.js:33` (AU) and `:51` (Earth mass 5.972e24): habitability scoring. Mass is not in worlds.js yet (no body mass in the table).
- `ring-system.js:17` (G) and `:27` (Saturn GM 3.7931208e16, radius 60268 km): ring model, its own constant set.
- `micro-ascent/*.js` (`9.80665` several times, `mission-model.js:2` Earth GM 398600.44 km^3/s^2 and radius 6371 km): a separate app that does not load worlds.js. Migrate with the micro-ascent app.
- `spacecraft.html:240`, `warp-lab.html:167`: pages with inline `G0`/`9.80665`. Pages, not modules; the same value as CONST.G0.
- `settlement-lab.html:158` and `habitability.test.mjs`: sample data (a Sun-like star with an Earth-like planet), not body constants.
- `atmospheres.js` (shader scale heights), `planet-data.js` Earth `atm.top` 100 km and the other atm entries: visual scattering and haze, not sim density.
  `planet-data.js` Mars `atm.top` now equals `BODIES.mars.atmoTop` (120 km) so the Mars haze matches the air the sims fly through.
- `landing-sim.js` drag coefficients (1.1, 1.15 and `machMul`): the drag model, not the atmosphere. The density they use is the shared `W.rho`.
  `landing-sim.js` `pressure()` and `aero()`: the same formula as ship-sim, now fed the same table.
- `space-access.js` `hull()` default pressure 101325 and density 7850: design defaults, not body constants.

## Behaviour changes made in M0 (all checked by the test suites)

- Earth sound speed above 70 km and the 400 km density row (ship-sim, landing-sim, space-access). Golden-flight outputs move by up to
  0.6 km in perigee and apogee and 0.6 s in mission time (`golden-flights.test.mjs` before and after: all windows still pass).
- Mars `atmoTop` 80 -> 120 km: the minimum insertion perigee in ship-sim rises from 84 to 126 km, and the shipyard Mars air shell is drawn larger.
  No Mars preset is pinned by a test, so the effect is not measured.
- planet-data.js Mars haze top 80 -> 120 km (visual only).
- flight/map3d.js Earth drawn radius 6371 km -> 6378.137 km (0.1 %, visual only; the trail now starts on the surface).
- Moon, Mars GM and Moon rotation: changes of 1e-6 relative or less.
