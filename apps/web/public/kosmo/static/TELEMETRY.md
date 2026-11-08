# Telemetry stream: the Shipyard and the Landing Lab to the Flight Lab shell

Both labs post one message to their parent frame while they run, at most 4 times a second. A page that is not framed (opened on
its own) posts nothing. The code is `telemetry.js` (pure ES module, tested by `telemetry.test.mjs`); the pages call
`telemetryPayload(sim)` and `postTelemetry(window, payload, now, gate)`.

## Message

```js
window.parent.postMessage({ type: 'flightlab:telemetry', v: 1, mode: 'shipyard' | 'landing', t, phase, name, altitude, speed, vv,
  apo, peri, period, twr, dvStage, dvTotal, propellantPct, stage, stages, g, q, mach, event }, '*');
```

The keys are the same in both modes and always all present. A value that does not apply to the mode is `null`. Field names are
fixed: the shell depends on them.

| Field | Unit | Shipyard (main vehicle) | Landing Lab (the stage being landed) |
|---|---|---|---|
| `type` | | always `'flightlab:telemetry'` | same |
| `v` | | schema version, `1` | same |
| `mode` | | `'shipyard'` | `'landing'` |
| `t` | s | mission time | run time |
| `phase` | | the craft's guidance phase key (`ascent`, `coast-apo`, `orbit-done`, `hoh1`, `landing`, ...) | `descent`, `ignition`, `burn`, `landed`, `crashed` |
| `name` | | the craft name (`Vehicle`, or a separated stage's name) | the vehicle name |
| `altitude` | m | height above the surface, not below 0 | height above the deck or pad |
| `speed` | m/s | surface-relative speed (the HUD's "speed over ground") | magnitude of the sim's velocity (x, y), not corrected for wind |
| `vv` | m/s | vertical speed, positive up | vertical speed, positive up |
| `apo` | m | apoapsis altitude above the surface; `null` on a hyperbolic (escape) trajectory | `null` |
| `peri` | m | periapsis altitude above the surface; negative when the orbit dips into the planet (a suborbital flight) | `null` |
| `period` | s | orbital period; `null` on escape | `null` |
| `twr` | | thrust over weight at the local gravity (0 when not thrusting) | thrust over weight at the local gravity |
| `dvStage` | m/s | **estimate**: remaining delta-v of the stage being flown (rocket equation, vacuum Isp, usable propellant = prop minus reserve) | **estimate**: rocket equation from the live mass down to the dry mass |
| `dvTotal` | m/s | **estimate**: remaining delta-v of all stages still attached | same as `dvStage` (one stage) |
| `propellantPct` | % | propellant left over propellant at the start, all stages still attached | propellant left over propellant at the start |
| `stage` | | the stage being flown, 1 = bottom, as designed | `1` |
| `stages` | | number of stages in the design | `1` |
| `g` | g | the craft's load factor | the load factor |
| `q` | Pa | dynamic pressure | dynamic pressure |
| `mach` | | Mach number | Mach number |
| `event` | | text of the latest event in the sim's log, or `null` before any event | text of the latest event, or `null` |

Notes:

- The sims do not keep a delta-v budget. `dvStage`, `dvTotal` and the Shipyard's burn time in the HUD are rocket-equation estimates
  from the live masses and the engine data, the same convention as `analyze()` in `ship-sim.js` (checked within 5 % at liftoff in
  `telemetry.test.mjs`). The HUD labels them `est.`.
- Orbit values come from `elements()` in `ship-sim.js`, the same function the sim uses for its outcome.
- `phase` is the raw key, not a sentence. Use `event` or your own labels for display.

## Rate and framing

- At most one message per 250 ms (`TELEMETRY_MIN_INTERVAL_MS`). The gate is per page.
- Posted only when `window.parent !== window`. Failures from `postMessage` are caught and never reach the page.
- The target origin is `'*'`, as the shell contract requires. The payload carries no personal data and nothing but the numbers above.

## Versioning

`v` is the schema version. A change that renames or removes a field, or changes a unit, bumps `v`. Adding a field does not bump it,
so a consumer must ignore keys it does not know.
