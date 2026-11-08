# Lab store: designs, share links, and the Shipyard to Landing Lab hand-off

`lab-store.js` is the one place where the labs keep and pass vehicles and flights. It is an ES module with no DOM access at
load time (it runs in browsers and in node: `lab-store.test.mjs`). The Shipyard (`shipyard.html`), the Landing Lab
(`landing-lab.html`) and the Flight Lab shell (`flight-lab.html`) use it. Every storage access is wrapped: a blocked or
full storage never throws into a page.

## 1. Design schema (v1)

A design is plain JSON:

```json
{
  "v": 1,
  "kind": "design",
  "name": "Falcon test",
  "world": "earth",
  "mission": { "start": "pad", "orbitAlt": 250000, "stationAlt": 420000, "gLimit": 4.5, "kickDeg": 4, "kickSpeed": 45, "release": { "alt": 0, "speed": 0 } },
  "stages": [
    {
      "name": "Booster", "engine": "merlin-1d", "count": 9, "prop": 395700, "diameter": 3.7,
      "length": 41.2, "dry": null,
      "landing": { "mode": "propulsive", "reserve": 55000, "site": "downrange", "engines": 3 },
      "craft": null
    }
  ],
  "payload": { "mass": 0, "fairing": 0 },
  "options": { "rendezvous": true, "deorbit": true, "tuneAscent": true, "pad": "f9dock", "scene": "space" },
  "createdAt": "2026-11-05T20:00:00.000Z"
}
```

| Field | Meaning |
|---|---|
| `v` | Schema version. Only `1` is read; anything else is refused with the version named. |
| `kind` | `"design"`. |
| `name` | Optional text, up to 80 characters. |
| `world` | `earth`, `moon` or `mars`. |
| `mission` | `start` (`pad` or `orbit`), `orbitAlt` and `stationAlt` (m), `gLimit` (g), `kickDeg`, `kickSpeed`, optional `release` (`alt` m, `speed` m/s). |
| `stages` | 1 to 12 stages, bottom first. Each stage is the Shipyard's own stage object: `engine` (a library id), `count` (1 to 40), `prop` (kg), `diameter` (m), optional `length` (m), `dry` (kg, `null` = automatic), `landing` (`mode` none / propulsive / chute, `reserve` kg, `site` downrange / rtls, `engines`), `craft` (`null` or the spacecraft systems: `rcsThrust`, `rcsProp`, `rcsIsp`, `noseOffset`, `cargo`, `chuteArea`). |
| `payload` | `mass` and `fairing` (kg). |
| `options` | `rendezvous` (the Shipyard's dock), `deorbit` (the Shipyard's land), `tuneAscent` (automatic pitch kick), `pad` (the start template key, or `null`), `scene` (`space` or `black`). |
| `createdAt` | When the file was written. |

Validation (`validateDesign`, `designFromJSON`) reports every problem at once, with its path, for example
`stages[0].engine: unknown engine "merlin-9000": it is not in the engine library (engines-library.json), so the design was not loaded`.
Unknown engine ids are errors and are never replaced. An engine the sims cannot fly (no start count or minimum throttle in the
library) is refused with the reason. Unknown fields are warnings and are ignored. A design is at most 200 KB.

## 2. API

| Function | What it does |
|---|---|
| `validateDesign(obj)` | `{ ok, errors, warnings, design }`, no throw. |
| `designFromJSON(obj)` | The normalised design (defaults filled), or throws `DesignError` (`.errors`, `.warnings`). |
| `designToJSON(state, meta)` | The Shipyard's working state to the schema. `meta`: `{ name, pad, scene, createdAt }`. |
| `designToState(design)` | A validated design to `{ state, meta }`, where `state` is the Shipyard's working state. |
| `saveDesign(name, json)` | Store under a name (overwrites). `{ ok, name, error }`. |
| `listDesigns()` | `[{ name, world, stages, createdAt, broken }]`, sorted by name. |
| `loadDesign(name)` | The validated design, `null` if missing; throws `DesignError` if the stored entry no longer validates. |
| `deleteDesign(name)` | `true` when something was removed. |
| `saveLast(json)` / `loadLast()` | The working design, kept after each change. |
| `encodeShare(json)` / `decodeShare(str)` | Async. Compact URL-safe string; `decodeShare` returns the validated design. |
| `designHash(str)` / `readDesignHash(hash)` | `#design=<str>` and its reader. |
| `shareURL(json, base)` | Full link to `base` carrying the design. |
| `flightSnapshot(sim, craft)` | The real flown state of a craft in a running Shipyard sim (see 4). |
| `snapshotToLandingVehicle(snap)` | `{ vehicle, assumed, warnings, flown, start }` for the Landing Lab (see 4). |
| `landingLimits(vehicle)` / `checkConstraints(out, limits)` | The touchdown limits the sim uses, and a re-check of a touchdown against them. |
| `landingResult(out, ctx)` | The record handed back to the Shipyard (see 5). |
| `saveLandingResult` / `loadLandingResult`, `saveHandoff` / `loadHandoff` | sessionStorage helpers. |
| `describeFlown(flown, assumed)` | The Landing Lab note text. |

## 3. Storage and the link

| Key | Where | Holds |
|---|---|---|
| `kosmo.lab.design:<name>` | localStorage | A saved design (one entry per name). |
| `kosmo.lab.lastDesign` | localStorage | The working design. |
| `kosmo.shipyard.scene` | localStorage | Scene background (as before). |
| `kosmo.lab.handoff` | sessionStorage | The last hand-off message, for a Landing Lab page opened on its own. |
| `kosmo.lab.landingResult` | sessionStorage | The last landing result. |

The share string is `z` + base64url(raw deflate of the JSON) when `CompressionStream` exists, otherwise `j` + base64url(JSON).
A typical preset design is about 600 to 700 characters. The link is `shipyard.html#design=<share string>`. The hash is read on
load; a design that does not validate is reported, and the default preset is shown instead.

On load the Shipyard offers to restore the last working design (not blocking). The last design is written only after the user
has changed something, so an unopened page never overwrites it.

## 4. Hand-off: Shipyard to Landing Lab

The Shipyard sends `{ type: 'flightlab:landing', stage, world, snapshot }` (postMessage inside the Flight Lab shell, or
sessionStorage and navigation when standalone). The `stage` and `world` fields are as before, so an older receiver still works.

`snapshot` is `flightSnapshot(sim, craft)` for the craft that carries the stage:

- `pos`, `vel` in the sim's frame; `alt`, `speed` (air-relative), `vUp` (radial), `vTan` (along the track), `flightPathDeg`;
- `tiltDeg` (from vertical, positive toward the direction of travel), `omegaDegS`;
- `massKg`, `propKg`, `propMaxKg`; `stage` (name, engine id, count, dry, diameter, length, landing); `config` (legs, grid fins);
- `world`, `t` (mission time), `craft` (id, role, name, phase); `id` (matches the landing result's `handoffId`).

Which state is used:

- A craft still in flight is read as it is now.
- A craft that has already come down (the flight was run to its end) is replayed. The sim is deterministic (the timeline
  scrubber relies on that), so a fresh run of the same mission is the same flight, stopped at the first landing-burn point
  below `HAND_OVER_ALT` = 5 km (the booster's landing phase, in `shipyard.html`).
- If the stage has not separated in the current flight, the message has no `snapshot` and the Landing Lab uses the design
  values, as before. The Landing Lab note says so.

Why 5 km: the Shipyard's booster lights its landing burn near 40 km and glides on aerodynamics first, which the Landing Lab
does not model. A sweep of the real flight (node, 9 landing-burn samples) lands in the Landing Lab only from about 5 km and
below (4.7 m/s down from 4.9 km; every state from 40 km down to 10 km fails). This is a measured choice, documented in the
code; change `HAND_OVER_ALT` if the Landing Lab's model changes.

`snapshotToLandingVehicle(snap)` builds the Landing Lab vehicle from the snapshot:

- From the flight: `engine`, `engines` (the landing burn's count, at most the stage count), `dry`, `prop` (the remaining
  propellant), the start state (`start.y` = height, `start.vy` = vertical speed, `start.vx` = -along-track speed, `start.th` =
  -tilt; the Landing Lab's frame has +x upstream and +th toward +x), `cluster` (stage count).
- From the stage dimensions, as `vehicleFromStage` always did: `comHeight`, `legRadius`, `finArea`, `finLever`, the target
  radius, and the stopping-distance check.
- Falcon 9 defaults only where no snapshot can know the value. Those are listed in `assumed`: wind (air-relative speed is
  flown, the wind is not), sea state, gimbal limits (not in the engine library), touchdown limits (the Shipyard's values),
  and dispersion.
- `warnings` are returned for: a height below the stopping distance; a height above 30 km; a downrange offset (not used; the
  Landing Lab plans its own approach); a stage not set to land with its engines.

The Landing Lab shows a note under the vehicle picker: `Flown in the Shipyard: v=…, h=…, mass=…; assumed: …`, with the warnings.

## 5. Landing result: Landing Lab back to the Shipyard

When a landing of a Shipyard hand-off finishes, the Landing Lab writes `landingResult(out, ctx)` to `kosmo.lab.landingResult`
(sessionStorage) and posts `{ type: 'flightlab:landing-result', result }` to its parent. The shell relays that message to the
Shipyard frame. Only landings of the Shipyard vehicle are reported; one made from a design (not flown) has `handoffId: null`.

The record:

```
{ v:1, kind:'landing-result', key, at, handoffId, stage, vehicle, target, status: landed|caught|failed, ok, reason,
  touchdownMs, lateralMs, tiltDeg, missM, fuelLeftKg, fuelUsedKg, timeS, limits: {vv, vh, tilt, radius}, constraintsOk }
```

`constraintsOk` re-checks the touchdown against the same limits the sim uses (vertical, lateral, tilt, radius). The spin limit
is not carried in a result, so `constraintsOk` can differ from `ok` only for a spin failure.

The Shipyard shows the result in a panel under the analysis (`#landingOut`) and in a toast. It reads the result when a
`storage` event fires, on `focus` and `pageshow`, and from a `flightlab:landing-result` message. Results that the Shipyard has
already shown are skipped by `key`. On load it shows the stored result in the panel only, without a toast.

## 6. What was verified, and what was not

Verified (node, `lab-store.test.mjs`, 261 checks): every Shipyard preset round-trips through the schema (read from
`shipyard.html`, not copied); validation errors name the path and the unknown engine; saved designs, the broken-entry and
no-storage cases; share strings (compressed and plain, under 2 KB for the presets); the flown snapshot of a real booster; the
Landing Lab vehicle from it with its `assumed` list; the landing result against the sim's limits, for a synthetic state and for
a real flown booster.

Verified in a browser (dev server, Shipyard and Landing Lab): auto-save and restore; Save, Load, Delete; Share (clipboard
stubbed) and opening the link in a second tab; JSON import (valid file, and one with an unknown engine, which is reported);
an invalid link (reported, preset shown); a flown hand-off replayed to the landing burn, with the flown note in the Landing
Lab; a landing run and its result back in the Shipyard, both standalone (back navigation) and inside the Flight Lab shell.

Not verified: the JSON export download itself (the file is created; the download was not inspected); the `storage` event
between frames (the postMessage path carried the result in the shell, and the panel also reads on focus and pageshow); the
browser console over a full page load (the tool's console capture starts when asked).

Known limit found in testing: the Landing Lab's default settings (wind, deck motion, sensor noise) decide a close landing. A
flown booster handed over at 4.9 km, 281 m/s, touched down at 6.5 m/s against the 5.5 m/s limit with those defaults in the
browser; in the node sweep, with sensor noise switched off (wind still on), it touched down at 4.7 m/s. That is the sim's verdict, not a hand-off error. Physics and presets were not changed.
