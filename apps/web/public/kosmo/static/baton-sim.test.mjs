// Headless checks for baton-sim.js.  Run: node baton-sim.test.mjs  (about 2 s)
import { BatonFlight, simulate, VEHICLES, DEG } from "./baton-sim.js";

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) failed++;
};
const nominal = (cfg) => simulate({ dispersed: false, wind: 0, ...cfg });

// 1. the autopilot lands a booster that cannot hover
{
  const f = nominal({ vehicle: "booster", mode: "ai-assisted" });
  const o = f.judge();
  check("booster: the autopilot lands it within limits", o.ok, o.ok ? `${o.vv.toFixed(2)} m/s down, ${o.miss.toFixed(1)} m off` : o.reasons.join("; "));
  {
    const v = VEHICLES.booster;
    const twrMin = (v.thrustMax * v.minThrottle) / ((v.dry + v.prop) * v.g);
    check("booster: at its throttle floor it still out-thrusts its weight, so it cannot hover", twrMin > 1, `T/W min ${twrMin.toFixed(2)}`);
  }
  check("booster: the autopilot stayed on the baton the whole way", o.humanShare === 0, `${(o.humanShare * 100).toFixed(0)} % human`);
  check("booster: untouched, it reads as an autopilot landing", o.title === "Autopilot solo", o.title);
}

// 2. the lunar lander lands too
{
  const o = nominal({ vehicle: "lunar" }).judge();
  check("lunar lander: the autopilot lands it", o.ok, o.ok ? `${o.vv.toFixed(2)} m/s down, ${o.miss.toFixed(1)} m off` : o.reasons.join("; "));
}

// 3. dispersed flights still mostly land
{
  let ok = 0;
  for (let i = 0; i < 12; i++) if (simulate({ vehicle: "booster", mode: "ai-assisted", seed: 100 + i, dispersed: true, wind: 6 }).outcome.ok) ok++;
  check("booster: dispersed and windy, most flights still land", ok >= 9, `${ok} of 12`);
}

// 4. authority is a cross-fade, not a switch
{
  const f = new BatonFlight({ dispersed: false, blend: 0.5 });
  check("authority starts with the autopilot", f.control.human === 0 && f.control.holder === "ai");
  f.takeBaton();
  f.advance(0.1);
  const mid = f.control.human;
  check("taking the baton moves authority part of the way in 0.1 s of a 0.5 s blend", mid > 0.1 && mid < 0.4, mid.toFixed(2));
  f.advance(0.5);
  check("authority reaches the human and stays there", f.control.human === 1 && f.control.holder === "human");
  let maxStep = 0;
  const g = new BatonFlight({ dispersed: false, blend: 0.4 });
  g.takeBaton();
  let prev = g.control.human;
  for (let i = 0; i < 40; i++) {
    g.advance(0.02);
    maxStep = Math.max(maxStep, Math.abs(g.control.human - prev));
    prev = g.control.human;
  }
  check("no single step jumps authority further than dt / blend", maxStep <= 0.02 / 0.4 + 1e-9, maxStep.toFixed(4));
}

// 5. the human's hand actually flies it
{
  const f = new BatonFlight({ dispersed: false, wind: 0 });
  f.takeBaton();
  f.setInput({ ux: 1, sink: 8 });
  const vx0 = f.s.vx;
  f.advance(1.5);
  check("holding the baton right moves the stage right", f.s.vx > vx0 + 2, `${vx0.toFixed(1)} -> ${f.s.vx.toFixed(1)} m/s`);
  const g = new BatonFlight({ dispersed: false, wind: 0 });
  g.takeBaton();
  g.setInput({ ux: -1, sink: 8 });
  const vx1 = g.s.vx;
  g.advance(1.5);
  check("holding it left moves the stage left", g.s.vx < vx1 - 2, `${vx1.toFixed(1)} -> ${g.s.vx.toFixed(1)} m/s`);
}

// 6. a human can land it, and gets credit for the baton time
{
  const f = new BatonFlight({ vehicle: "booster", dispersed: false, wind: 0, mode: "human-assisted" });
  // a hand flying to the autopilot's cue: turn its guidance into a steer and a sink rate
  const hand = () => {
    const p = f.aiPlan();
    const aMax = f.veh.thrustMax / f.s.m;
    const want = p.throttle === 0 ? 300 : -f.s.vy - (p.throttle * aMax - f.veh.g) / 1.6;
    f.setInput({ ux: p.tilt / (f.veh.tiltMax * 0.85), sink: want });
  };
  while (!f.done && f.s.t < 120) {
    hand();
    f.step(f.dt);
  }
  const o = f.judge();
  check("human-assisted: the flight is flown by the human", o.humanShare > 0.95, `${(o.humanShare * 100).toFixed(0)} % human`);
  check("human-assisted: flying the cue by hand lands it", o.ok, o.ok ? `${o.vv.toFixed(2)} m/s down, ${o.miss.toFixed(1)} m off` : o.reasons.join("; "));
  check("human-assisted: a hand-flown landing is named as one", o.title === "Hand-flown", o.title);
}

// 7. handing back a state the autopilot cannot recover is reported
{
  const f = new BatonFlight({ vehicle: "booster", dispersed: false, wind: 0 });
  f.takeBaton();
  // dive hard and far off to the side, then hand it back low and fast
  f.setInput({ ux: 1, sink: 90 });
  while (!f.done && f.s.y > 60) f.step(f.dt);
  const before = f.transfers.length;
  f.handBack();
  const tr = f.transfers[before];
  check("the hand-off is recorded when it happens", f.transfers.length === before + 1 && tr.to === "ai");
  check("a wrecked state is recorded as an unclean hand-off", tr && tr.clean === false, tr ? `headroom ${tr.headroom.toFixed(2)}` : "none");
  const p = f.aiPlan();
  check("from that state the autopilot has no plan", p.feasible === false, `phase ${p.phase}, tgo ${p.tgo?.toFixed(1)}`);
}

// 8. a clean hand-back is counted clean
{
  const f = new BatonFlight({ vehicle: "booster", dispersed: false, wind: 0 });
  f.takeBaton();
  f.setInput({ ux: 0, sink: 6 });
  f.advance(2);
  const before = f.transfers.length;
  f.handBack();
  const tr = f.transfers[before];
  check("a hand-back the autopilot can still fly is clean", tr && tr.clean === true, tr ? `headroom ${tr.headroom.toFixed(2)}` : "none");
}

// 9. the autopilot asks for the baton when the human leaves its envelope
{
  const f = new BatonFlight({ vehicle: "booster", dispersed: false, wind: 0, mode: "human-assisted" });
  f.setInput({ ux: 1, sink: 90 });
  while (!f.done && f.calls === 0 && f.s.t < 60) f.step(f.dt);
  check("the autopilot calls for the baton from a state it cannot fly", f.calls > 0, `${f.calls} call(s)`);
  check("the call is in the event log", f.events.some((e) => e.kind === "call"));
}

// 10. determinism, so a flight can be replayed
{
  const run = () => {
    const f = new BatonFlight({ seed: 42, dispersed: true, wind: 7 });
    f.advance(20);
    return [f.s.x, f.s.y, f.s.vx, f.s.vy].map((n) => n.toFixed(9)).join(",");
  };
  check("the same seed flies the same flight", run() === run());
}

// 11. propellant is conserved, and an empty tank cannot land
{
  const f = new BatonFlight({ vehicle: "booster", dispersed: false, wind: 0 });
  f.advance(3);
  check("mass is dry mass plus what is left in the tank", Math.abs(f.s.m - (f.veh.dry + f.s.prop)) < 1e-6);
  const empty = simulate({ vehicle: "booster", dispersed: false, wind: 0, prop: 0.01 }).judge();
  check("a booster that runs dry does not land softly", !empty.ok, empty.ok ? "landed" : empty.reasons.join("; "));
}

// 12. the throttle window is never violated
{
  const f = new BatonFlight({ vehicle: "booster", dispersed: false, wind: 0 });
  f.takeBaton();
  f.setInput({ ux: 0.3, sink: 5 });
  let bad = 0;
  for (let i = 0; i < 400 && !f.done; i++) {
    f.step(f.dt);
    // the *command* may not sit in the forbidden window; the spool-up passes through it
    if (f.s.cmd > 0 && f.s.cmd < f.veh.minThrottle - 1e-9) bad++;
  }
  check("a lit engine never sits below its throttle floor", bad === 0, `${bad} bad steps`);
}

// 13. the scored record is complete
{
  const o = nominal({ vehicle: "booster" }).judge();
  check(
    "the record carries grade, baton share, transfers and calls",
    typeof o.score === "number" && /^[A-F]$/.test(o.grade) && typeof o.humanShare === "number" && Array.isArray(o.transfers) && typeof o.calls === "number"
  );
  check("the touchdown tilt of a nominal landing is inside the limit", o.tilt < VEHICLES.booster.tiltMaxTouch, `${(o.tilt / DEG).toFixed(1)}°`);
}

console.log(failed ? `\n${failed} check(s) failed` : "\nall baton-sim checks passed");
process.exit(failed ? 1 : 0);
