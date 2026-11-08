# Flight Lab shell

`flight-lab.html` is the one workspace frame of the lab (M1c). It holds a mode rail, a vehicle bar that stays visible in every
mode, and one frame per mode. The modes are views of one vehicle: the Design mode (`shipyard.html`), the Land mode
(`landing-lab.html`) and Micro Ascent (`micro-ascent/index.html`). The frames stay as they are for now; retiring them is a later
milestone. Plan and Review are placeholders until M4.

The wiki route `/kosmo/tools/flightlab` embeds the shell through `src/components/kosmo/embed-frame.tsx`. The shell fills its
container, so the embed needs no change.

## Files

| File | What it is |
|---|---|
| `flight-lab.html` | The shell page: the rail, the vehicle bar, the telemetry strip, the landing card, the frames, and the page script. |
| `flight-lab-shell.js` | The pure logic (no DOM at load): modes, routing, the remembered mode, message checks, the bar's formatting. |
| `flight-lab-shell.test.mjs` | The node checks for that logic (run by `run-tests.mjs`). |
| `lab-store.js` (M1a) | Designs, share links, the landing result. The shell imports it (`?v=1`), same origin, shared localStorage. |
| `flight-ui.css` | The rail and pill styles and the icon tooltip, reused. |

## Modes and routing

| Mode | Id | Key | Frame |
|---|---|---|---|
| Design / Launch | `design` | 1 | `f-design` (`shipyard.html`) |
| Land | `land` | 2 | `f-land` (`landing-lab.html`) |
| Micro Ascent | `ascent` | 3 | `f-ascent` (`micro-ascent/index.html`) |
| Plan | `plan` | none | placeholder, "Coming in M4" |
| Review | `review` | none | placeholder, "Coming in M4" |

The rail is an ARIA tablist: roving `tabindex`, Left and Right move between enabled tabs, Home and End go to the ends, and
`aria-selected` and `aria-controls` are kept. The keys 1, 2 and 3 switch modes when the focus is in the shell or in a frame
(a key typed into an input or select is left alone). Frames load the first time their mode is shown.

The mode is chosen in this order:

1. `?mode=` in the query (`flight-lab.html?mode=land`), or `mode=` in the hash.
2. A `#design=` link with no mode opens Design.
3. The remembered mode (localStorage `kosmo.flightlab.mode`; it is written on every mode change).
4. Design.

Old names still route: `mission` is Design, `landing` is Land, `concepts` is Micro Ascent (`#landing` and the rest).
Placeholder names (`plan`, `review`) do not route. The shell keeps its own hash as `#mode=<id>`, plus `&design=<share>` when
the page was opened with a design. A change of the hash (typed by the user) switches the mode, and a new `design` reloads the
Design frame with it.

## URL parameters

| Where | Form | Effect |
|---|---|---|
| query | `?mode=design\|land\|ascent` | The mode to show. |
| hash | `#mode=<id>` | The same, as the shell keeps it. |
| hash | `#design=<share>` or `&design=<share>` | Passed to the Design frame as `shipyard.html#design=<share>`. Must match `[A-Za-z0-9_-]{1,8000}`, else ignored. |

Inside the wiki, the shell posts `{ kosmo: 'hash', h: '#mode=<id>' }` to its parent when the mode changes, so the wiki's
address carries the mode. The design is not posted (the share string is long); the wiki's embed frame reads the hash only at
mount.

## Vehicle bar

| Item | Source |
|---|---|
| Design name, stage count, total propellant | `loadLast()` from lab-store (the working design, `kosmo.lab.lastDesign`). A design link shows its own design until the Design frame writes its working design. The bar updates on the `storage` event for that key. |
| Phase, mission time, altitude, speed, apo / peri, delta-v | The telemetry stream (below). `--` until a sample arrives. The values dim after 5 s without an update. |
| Save | `saveDesign(name, design)` under the design's name (or "Untitled design"). Stored in this browser. |
| Share | `shareURL(design, base)` and the clipboard. Where the clipboard is blocked, the link is shown selected in the bar. The base is the wiki's page when embedded. |
| Export | Downloads the design JSON (`<name>.kosmo-design.json`). |
| Send booster to Landing | Switches to Land and shows the hint for the hand-off (below). |
| Last landing | A chip; it opens the landing card (below). |

Save, Share and Export act on the working design in localStorage. The Shipyard writes that copy after the first change, so a
design that was opened from a link and not yet changed is shown from the link itself.

The Shipyard has no message API for save, share or export, so the shell calls lab-store directly (same origin).

### Send booster to Landing: current hook

The Shipyard starts a hand-off from its own stage panel (the button "Tune this landing in the Landing Lab", `data-act="tune"`).
That posts `flightlab:landing` to the shell, and the shell opens Land with it. The shell's button only switches mode and shows
the hint, because the Shipyard has no handler for a request from the shell.

Hook needed (M1b or M1d): the Shipyard accepts `{ type: 'flightlab:request-handoff', stage: <index or name> }` from its parent
(same origin, from the shell only) and runs the same `handoff(i)` as the button. The shell then posts it to `f-design` and
switches to Land as now.

## Telemetry

Messages of type `flightlab:telemetry`, schema v1 (`v: 1`), from the Design frame (`mode: 'shipyard'`) or the Land frame
(`mode: 'landing'`). Fields: `t` (mission time, s, required and finite), `phase`, `name`, `altitude` (m), `speed` (m/s), `vv`,
`apo` and `peri` (m), `period` (s), `twr`, `dvStage` and `dvTotal` (m/s), `propellantPct`, `stage`, `stages`, `g`, `q`, `mach`,
`event` (text).

The shell accepts a message only when all of these hold:

- `event.origin === location.origin`;
- `event.source` is the `contentWindow` of one of its frames;
- the mode matches the frame (`shipyard` from Design, `landing` from Land);
- `type`, `v` and `mode` are as above, and `t` is a finite number of 0 or more.

Other fields that are not finite numbers become `null`; strings are cleaned and capped. Anything else is ignored with no error.
Units are assumed (m, m/s, s, kg) and the schema does not state them: please keep to these.

The strip shows phase, mission time, altitude, speed, apo / peri in km, and delta-v. The last event is shown in a line under
the bar (`aria-live="polite"`). The strip itself is not a live region, since it would announce at the telemetry rate.

Note for the telemetry sender (M1b, `telemetry.js`): it posts with the target origin `'*'`. The shell checks the origin on
receipt, but a wildcard target sends the data to any parent that embeds the page. Posting to `location.origin` (or `window.parent`
with the origin) would be safer.

## Landing result

The Land frame posts `{ type: 'flightlab:landing-result', result }` (the record from lab-store `landingResult`). The shell:

1. accepts it only from the Land frame, and relays it to the Design frame (as before);
2. checks it (`validateLandingResult`: kind, v 1, status landed / caught / failed);
3. saves the original record with `saveLandingResult` (sessionStorage, the same key the Shipyard reads);
4. shows the card (status, stage, touchdown speed, sideways speed, tilt, miss distance, propellant left, flight time, limits)
   and the chip text.

On load the card shows the stored result, so a reload keeps it.

## Messages the shell handles

| Type | From | Effect |
|---|---|---|
| `flightlab:ready` | Land | Delivers a hand-off that arrived before Land was ready. |
| `flightlab:landing` | Design | Opens Land with the booster (`stage`, `world`, `snapshot`). |
| `flightlab:landing-result` | Land | Relayed to Design; saved; card and chip. |
| `flightlab:telemetry` | Design, Land | The strip and the last event. |

Messages from any other source or origin are ignored. The shell posts to its frames with the shell's own origin.

## Layout and accessibility

- The page is a column: the top row (brand, rail, hint), the vehicle bar, the stage (the frames, the card and the toast fill it).
  It sizes to its container, so the wiki's embed frame lays it out as before.
- Under 600 px the brand hides; under 560 px the bar's labels hide (each button keeps its `aria-label`), and the "Vehicle"
  caption and the telemetry status line hide too (the values still dim when stale). Under 1024 px the hint hides.
- The rail never scrolls: at 375 px all five tabs fit (checked in the browser).
- Focus is outlined (`:focus-visible`, 2 px); tooltips open below the rail and come from `data-tip`.
- The page is dark, like the other Kosmographica pages. The colours are the existing variables (`--bg`, `--text`, `--muted`,
  `--accent`, `--line`) plus the bar's own two. There is no light variant: the pages have none.

## Extension points (later milestones)

- A mode: add an entry to `MODES` in `flight-lab-shell.js` with its `frame`, `src`, `key`, `hint`; add its iframe in
  `flight-lab.html` as `f-<frame>`. `normalizeMode` and `modeForKey` follow from `MODES`.
- Plan and Review (M4): remove `soon` from their `MODES` entries and give them `frame` and `src`, then add their iframes.
- The vehicle state (M1d and later): the bar reads only `loadLast()` and the telemetry. A shared state object would replace
  the design read in `currentDesign()`.
- The hand-off from the bar (see above).
- Telemetry recording and replay (M4) would take samples from `onTelemetry`.

## Not verified here

- The Send button's hand-off into a Shipyard handler (no handler yet).
- The embed under the wiki with a long session: see the note on the top-level navigation in the report.
- Export: the file is created by a blob download. The download itself was not opened.
