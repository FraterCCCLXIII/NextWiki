# Baton Lab

`baton-lab.html` is a landing flown by two pilots who share one control authority, handed
back and forth in flight. It is an atlas lab: `/kosmo/tools/baton`, embedded through
`src/components/kosmo/embed-frame.tsx` like the Landing Lab and the Flight Lab.

## The idea

The baton *is* the rocket. Whoever holds it commands the attitude and the throttle. A hand-off
is not a switch: authority cross-fades over `blend` seconds (0.45 by default), so the vehicle
never sees a step in its command, and the baton visibly travels between the two seats across
the same interval. The baton console under the view shows that crossing; the ring round the
rocket shows the split; the two short arrows are what each pilot would do from the state as
it stands.

Two modes, one machine:

| Mode | Starts with | What it is |
|---|---|---|
| `ai-assisted` | the autopilot | The autopilot flies; take the baton when a hand would help, or when it asks. |
| `human-assisted` | the human | You fly; the autopilot keeps a cue you can see and can be handed the baton at any time. |

The assist is not cosmetic: `aiPlan()` is always computed, so the autopilot's cue, its
feasibility and its throttle advice exist whether or not it is flying.

## Files

| File | What it is |
|---|---|
| `baton-sim.js` | The whole model: vehicles, physics, autopilot, authority cross-fade, hand-offs, scoring. No DOM, so it runs in node. |
| `baton-sim.test.mjs` | The node checks (27), run by `run-tests.mjs` / `npm run test:kosmo`. |
| `baton-lab.html` | The page: canvas world, baton console, authority ribbon, telemetry, controls. |

## The model

Planar, SI: `x` lateral (target at 0), `y` altitude above the deck, `vy` positive up, `th`
tilt from upright (positive toward +x).

- Point mass with thrust along the body axis, gravity, propellant burn and a mass that falls
  with it, engine spool lag (0.14 s), and a critically damped attitude track to the commanded
  tilt.
- The throttle window is enforced: the engine is never *commanded* between zero and
  `minThrottle`. This is the point of the lab — a stage whose thrust-to-weight stays above one
  cannot hover, so it cannot stop in the air and must arrive at zero.
- A light aerodynamic force from the velocity relative to the wind (shear plus a slow gust).
  No lift, no Mach effects: the Landing Lab has the full model; this lab is about the hand-off.
- The guidance aims to stop the stage **on its legs** (`legs` metres), not at zero altitude,
  and contact is taken a little above that (leg compression, `contact` = 0.45 m). A profile
  that stops a few centimetres high would otherwise never touch, and the throttle floor would
  lift it off again.
- Autopilot: ZEM/ZEV (E-guidance), re-solved every 0.02 s step from the current state, with
  the throttle floor and tilt limit enforced. It coasts until the stopping distance fits, then
  burns. `aiPlan()` also reports `feasible` (is there a plan from here at all?) and `headroom`
  (how much thrust authority the plan leaves in reserve), which is what a hand-off is judged on.
- Human: a steer in [-1, 1] and a **sink-rate target** (0.4 to 300 m/s), not a raw throttle.
  The target is converted to a throttle by a proportional law; asking for a sink above what
  the stage is doing is how you cut the engine and let it fall, and a non-hovering stage at its
  throttle floor will always stop descending and start climbing. That is the mechanic, not a bug.

A hand-off is recorded with the state it happened in: `{t, to, feasible, headroom, y, vy}`, and
`clean` on the way back. Handing the autopilot a state it cannot recover is a bad hand-off, and
the autopilot says so while it is still happening ("no plan from this state") and asks for the
baton if the human keeps it.

## Scoring

`judge()` returns `{ok, reasons, vv, vh, tilt, miss, prop, used, t, score, grade, title,
humanShare, transfers, clean, calls}`. A landing needs the pad radius, the vertical and lateral
contact limits and the contact tilt. The score (0-100) rewards accuracy, softness, propellant
left, a real share of the descent on the human's hand, and clean hand-offs, and penalises
autopilot calls the human ignored. Titles: `Autopilot solo` (never took it), `Crewed`,
`Crewed, after a call`, `Hand-flown` (over 90 % on the hand), or `Lost`.

## Controls

`space` takes and hands back the baton (or launches, before the flight starts); `←`/`→` or
`A`/`D` steer; `↑`/`↓` or `W`/`S` raise or lower the sink target; `R` resets; `P` pauses.
Dragging on the world steers while you hold the baton, for touch.

## What was verified

In node (`baton-sim.test.mjs`, 27 checks): the autopilot lands the booster and the lunar lander
within limits; the booster's thrust-to-weight at its throttle floor is above one, so it cannot
hover; 12 of 12 dispersed, windy flights land; authority cross-fades (a 0.1 s step of a 0.5 s
blend lands part-way) and never moves more than `dt / blend` in a step; steering right and left
moves the stage; a hand flying the autopilot's cue lands and is named `Hand-flown`; a wrecked
state handed back is recorded unclean and the autopilot reports no plan; a recoverable one is
clean; the autopilot calls from an envelope it cannot fly and the call is logged; the same seed
flies the same flight; mass is dry plus remaining propellant; a stage with almost no propellant
does not land softly; no lit step is commanded below the throttle floor; the scored record is
complete.

Not verified: the page's own rendering and interaction in a browser (the geometry of the baton
console, the authority ribbon, pointer steering) were not exercised by a person or a browser
session. The simulation and its tests are the checked part; the page is the presentation of it.
