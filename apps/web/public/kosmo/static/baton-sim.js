// baton-sim.js -- the Baton Lab: one rocket, two pilots, one control authority.
//
// The idea
//   A stage comes down and two pilots are in the loop: an autopilot that can solve the
//   landing, and a human who can fly it by hand.  Only one of them holds the *baton* at a
//   time, and the baton is the rocket: whoever holds it commands the attitude and the
//   throttle.  A hand-off is not a switch -- authority cross-fades over `blend` seconds, so
//   the vehicle never sees a step in its command, and the baton visibly travels between the
//   two seats across that same interval.
//
//   Two modes, one machine:
//     ai-assisted     the autopilot starts with the baton; the human may take it
//     human-assisted  the human starts with the baton; the autopilot flies a reference to
//
//   The autopilot is zero-effort-miss / zero-effort-velocity guidance with the engine's
//   throttle floor enforced, so a stage that cannot hover still has to arrive moving.  A
//   hand-off is scored: giving the autopilot a state it cannot recover is a bad hand-off,
//   and the autopilot says so ("no plan") while it is still happening.
//
// What is simulated (planar: x lateral, y altitude above the deck, vy positive up)
//   * point-mass translation and a pitch angle `th` (0 = upright, + = nose toward +x),
//     thrust with spool lag, propellant burn and a mass that falls with it;
//   * a light aerodynamic force from the velocity relative to the wind (no lift, no Mach
//     effects -- the Landing Lab has the full model; this lab is about the hand-off);
//   * the engine's throttle window: it cannot throttle below `minThrottle`, so a launcher
//     with thrust-to-weight above one cannot hover and cannot stop in the air.
//
// No DOM, so it runs in node (baton-sim.test.mjs) and in baton-lab.html.

const G0 = 9.80665;
export const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const VEHICLES = {
  booster: {
    id: "booster",
    name: "Booster, drone ship",
    note: "One engine at 40-100 %: thrust-to-weight never drops below ~1.1, so it cannot hover. It has to arrive at zero.",
    dry: 25600,
    prop: 4600,
    diameter: 3.7,
    length: 41.2,
    comHeight: 12,
    cluster: 9,
    engines: 1,
    thrustMax: 845e3,
    isp: 282,
    minThrottle: 0.4,
    g: 9.80665,
    tiltMax: 22 * DEG,
    tiltMaxTouch: 8 * DEG,
    legs: 1.6,
    vMaxV: 5.5,
    vMaxH: 2.5,
    radius: 14,
    deck: "ship",
    start: { x: 300, y: 3000, vx: -40, vy: -220 },
    spread: { x: 60, y: 60, vx: 4, vy: 4 },
    wind: 6,
  },
  lunar: {
    id: "lunar",
    name: "Lunar lander",
    note: "A deep-throttle engine in low gravity: it can nearly hover, so the baton is about placement, not survival.",
    dry: 2400,
    prop: 1500,
    diameter: 3.0,
    length: 5.0,
    comHeight: 2.2,
    cluster: 1,
    engines: 1,
    thrustMax: 22e3,
    isp: 311,
    minThrottle: 0.25,
    g: 1.62,
    tiltMax: 30 * DEG,
    tiltMaxTouch: 10 * DEG,
    legs: 1.0,
    vMaxV: 2.5,
    vMaxH: 1.5,
    radius: 10,
    deck: "pad",
    start: { x: 120, y: 1400, vx: -18, vy: -95 },
    spread: { x: 40, y: 40, vx: 2, vy: 2 },
    wind: 0,
  },
};

/** Small deterministic PRNG, the same one the Landing Lab uses. */
export function rng(seed) {
  let a = (seed | 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BatonFlight {
  constructor(cfg = {}) {
    const veh = VEHICLES[cfg.vehicle] || VEHICLES.booster;
    this.veh = veh;
    this.cfg = {
      vehicle: veh.id,
      mode: "ai-assisted",
      wind: veh.wind,
      gust: 2.2,
      dispersed: true,
      seed: 7,
      blend: 0.45,
      ignite: 1.06,
      contact: 0.45,
      ...cfg,
    };
    this.dt = 0.02;

    const r = rng(this.cfg.seed);
    this.rand = r;
    const d = this.cfg.dispersed ? 1 : 0;
    const sp = veh.spread;
    const pick = (spread) => (r() * 2 - 1) * spread * d;
    const prop = veh.prop * (this.cfg.prop ?? 1) * (1 - 0.02 * r());
    const s = {
      t: 0,
      x: veh.start.x + pick(sp.x),
      y: veh.start.y + pick(sp.y),
      vx: veh.start.vx + pick(sp.vx),
      vy: veh.start.vy + pick(sp.vy),
      th: 0,
      om: 0,
      prop,
      m: veh.dry + prop,
      level: 0,
      thrust: 0,
      lit: false,
    };
    this.s = s;
    this.prop0 = prop;

    const humanStarts = this.cfg.mode === "human-assisted";
    this.control = { human: humanStarts ? 1 : 0, target: humanStarts ? 1 : 0, holder: humanStarts ? "human" : "ai" };
    // A hand that has just taken over asks for the sink the stage already has, so the grab
    // itself changes nothing; what you do next is yours.
    this.human = { ux: 0, sink: clamp(-s.vy, 4, 120), pointer: null };
    this.events = [];
    this.transfers = [];
    this.calls = 0;
    this.callTimer = 0;
    this.lastCall = -99;
    this.humanSeconds = 0;
    this.aiSeconds = 0;
    this.done = false;
    this.outcome = null;
    this.gustPhase = r() * Math.PI * 2;

    this.log(
      "start",
      `${veh.name}: ${Math.round(s.y)} m, ${Math.round(-s.vy)} m/s down, ${Math.round(s.x)} m off target. ` +
        (humanStarts ? "You have the baton." : "The autopilot has the baton.")
    );
  }

  log(kind, txt) {
    this.events.push({ t: this.s.t, kind, txt });
    if (this.events.length > 200) this.events.shift();
  }

  /** Lateral wind at a height: a shear profile plus a slow gust. */
  windAt(h) {
    const base = this.cfg.wind;
    if (!base) return 0;
    const shear = 0.55 + 0.45 * clamp(h / 1000, 0, 1);
    const gust = this.cfg.gust * Math.sin(this.s.t * 0.8 + this.gustPhase) * clamp(h / 400, 0, 1);
    return base * shear + gust;
  }

  /** What the autopilot would do from the state as it stands, whether or not it holds the baton. */
  aiPlan() {
    const s = this.s;
    const v = this.veh;
    const legs = v.legs || 0;
    // Height left above the legs.  A stage whose thrust-to-weight never falls below one cannot
    // hover, so the profile ends on its legs, not at zero altitude: the engine is cut there.
    const h = Math.max(s.y - legs, 0);
    const aMax = v.thrustMax / s.m;
    const aNet = Math.max(aMax - v.g, 0.05);
    const speed = Math.max(-s.vy, 0.05);
    const stop = (speed * speed) / (2 * aNet);

    // Coast: hold the lateral drift and wait for the last moment a burn still fits.
    if (!s.lit && h > stop * this.cfg.ignite) {
      const tilt = clamp(-Math.atan2(s.vx, Math.max(speed, 30)) * 1.1, -v.tiltMax, v.tiltMax);
      return {
        phase: "coast",
        throttle: 0,
        tilt,
        feasible: h >= stop && s.prop > 1,
        headroom: clamp((h - stop) / Math.max(h, 1), 0, 1),
        stop,
        tgo: null,
      };
    }

    // Burn: ZEM/ZEV (E-guidance), re-solved from the current state every step.
    const tgo = clamp((2 * Math.max(h, 0.4)) / Math.max(speed, 0.5), 0.2, 60);
    const ax = (6 * (0 - s.x - s.vx * tgo)) / (tgo * tgo) - (2 * (0 - s.vx)) / tgo;
    const ay = (6 * (legs - s.y - s.vy * tgo)) / (tgo * tgo) - (2 * (0 - s.vy)) / tgo;
    const tx = ax;
    const ty = ay + v.g;
    const mag = Math.hypot(tx, ty);
    const raw = mag / aMax;
    const tilt = Math.atan2(tx, ty);
    return {
      phase: "burn",
      throttle: raw > 0 ? clamp(raw, v.minThrottle, 1) : 0,
      rawThrottle: raw,
      tilt: clamp(tilt, -v.tiltMax, v.tiltMax),
      feasible: s.prop > 1 && ty > 0 && mag <= aMax * 1.02 && Math.abs(tilt) <= v.tiltMax * 1.05,
      headroom: clamp(1 - raw, 0, 1),
      stop,
      tgo,
    };
  }

  /** What the human's hand is asking for: a steer and a sink rate. */
  humanCommand() {
    const s = this.s;
    const v = this.veh;
    const aMax = v.thrustMax / s.m;
    const ux = clamp(this.human.ux, -1, 1);
    // The target has to be able to sit above the current descent rate, or "let it fall" is
    // impossible from a fast entry: the controller would read it as "slow down" and burn.
    const want = clamp(this.human.sink, 0.4, 300);
    // Vertical: drive the descent rate toward the commanded sink. Pulling the sink rate up
    // lets the engine fall below its floor and go out, which is how you "let it fall".
    const ay = ((-want) - s.vy) * 1.6 + v.g;
    let throttle = ay / aMax;
    if (throttle < 0.02) throttle = 0;
    return {
      throttle: throttle === 0 ? 0 : clamp(throttle, v.minThrottle, 1),
      tilt: ux * v.tiltMax * 0.85,
    };
  }

  takeBaton() {
    if (this.done || this.control.target === 1) return false;
    this.control.target = 1;
    const p = this.aiPlan();
    this.transfers.push({ t: this.s.t, to: "human", feasible: p.feasible, headroom: p.headroom, y: this.s.y, vy: this.s.vy });
    this.log(
      "handoff",
      `You take the baton at ${Math.round(Math.max(this.s.y, 0))} m, ${Math.round(Math.max(-this.s.vy, 0))} m/s down.`
    );
    return true;
  }

  handBack() {
    if (this.done || this.control.target === 0) return false;
    this.control.target = 0;
    const p = this.aiPlan();
    const tr = { t: this.s.t, to: "ai", feasible: p.feasible, headroom: p.headroom, y: this.s.y, vy: this.s.vy, clean: p.feasible };
    this.transfers.push(tr);
    this.log(
      "handoff",
      p.feasible
        ? `You hand the baton back at ${Math.round(Math.max(this.s.y, 0))} m: the autopilot has a plan, ${Math.round(p.headroom * 100)} % in reserve.`
        : `You hand the baton back at ${Math.round(Math.max(this.s.y, 0))} m and the autopilot has no plan from this state.`
    );
    return true;
  }

  toggleBaton() {
    return this.control.target === 1 ? this.handBack() : this.takeBaton();
  }

  setInput({ ux, sink } = {}) {
    if (ux !== undefined) this.human.ux = clamp(+ux || 0, -1, 1);
    if (sink !== undefined) this.human.sink = clamp(+sink || 0, 0.4, 300);
  }

  advance(seconds) {
    let left = Math.max(0, seconds);
    while (left > 1e-9 && !this.done) {
      const d = Math.min(this.dt, left);
      this.step(d);
      left -= d;
    }
  }

  step(dt) {
    if (this.done) return;
    const s = this.s;
    const v = this.veh;

    // --- control authority: a rate-limited cross-fade, never a step -----------------------
    const rate = dt / Math.max(this.cfg.blend, 0.05);
    const dir = this.control.target - this.control.human;
    this.control.human = dir > 0 ? Math.min(this.control.target, this.control.human + rate) : Math.max(this.control.target, this.control.human - rate);
    const hw = this.control.human;
    this.control.holder = hw > 0.5 ? "human" : "ai";

    // --- both pilots' commands, mixed by who holds the baton ------------------------------
    const ai = this.aiPlan();
    const hu = this.humanCommand();
    const throttle = hw * hu.throttle + (1 - hw) * ai.throttle;
    const tiltCmd = hw * hu.tilt + (1 - hw) * ai.tilt;

    let levelCmd = throttle;
    if (levelCmd > 0 && levelCmd < v.minThrottle) levelCmd = v.minThrottle;
    s.lit = levelCmd > 0 && s.prop > 0;
    if (!s.lit) levelCmd = 0;

    // Engine spool: thrust is a first-order lag on the commanded level.
    s.cmd = levelCmd;
    s.level += (levelCmd - s.level) * Math.min(1, dt / 0.14);
    if (s.level < 1e-4) s.level = 0;
    s.thrust = s.level * v.thrustMax;

    // --- attitude: a critically damped track to the commanded tilt -----------------------
    const wn = v.g > 5 ? 2.6 : 3.2;
    const alpha = wn * wn * (tiltCmd - s.th) - 2 * 0.9 * wn * s.om;
    s.om += clamp(alpha, -3.4, 3.4) * dt;
    s.th += s.om * dt;
    const lim = v.tiltMax * 1.15;
    s.th = clamp(s.th, -lim, lim);

    // --- translation: thrust, gravity, and a light aerodynamic force ----------------------
    const m = s.m;
    const wind = this.windAt(s.y);
    const relx = s.vx - wind;
    const rely = s.vy;
    const rel = Math.hypot(relx, rely);
    const rho = 1.225 * Math.exp(-Math.max(s.y, 0) / 8500);
    const area = Math.PI * (v.diameter / 2) ** 2;
    const dragK = 0.5 * rho * 0.12 * area;
    const fx = s.thrust * Math.sin(s.th) - dragK * rel * relx;
    const fy = s.thrust * Math.cos(s.th) - dragK * rel * rely - m * v.g;
    s.vx += (fx / m) * dt;
    s.vy += (fy / m) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.t += dt;

    // --- propellant ----------------------------------------------------------------------
    if (s.thrust > 0 && s.prop > 0) {
      const flow = s.thrust / (v.isp * G0);
      s.prop = Math.max(0, s.prop - flow * dt);
      s.m = v.dry + s.prop;
      if (s.prop <= 0) s.lit = false;
    }

    // --- who was flying ------------------------------------------------------------------
    if (hw >= 0.5) this.humanSeconds += dt;
    else this.aiSeconds += dt;

    // --- the autopilot asks for the baton when the state leaves its envelope --------------
    if (hw > 0.5 && !ai.feasible) this.callTimer += dt;
    else this.callTimer = 0;
    if (this.callTimer > 1.2 && s.t - this.lastCall > 5) {
      this.lastCall = s.t;
      this.calls++;
      this.log("call", `Autopilot: "No plan from this state. Hand me the baton."`);
    }

    // Contact: the legs are compressible, so the flight ends a little above the unloaded leg
    // height.  The guidance aims to stop the stage at `legs`; without this window a profile
    // that stops a few centimetres high would never touch, and the throttle floor would lift it.
    if (s.y <= (v.legs || 0) + this.cfg.contact) {
      s.y = Math.max(s.y, 0);
      this.finish();
    }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const s = this.s;
    const v = this.veh;
    const vv = Math.max(0, -s.vy);
    const vh = Math.abs(s.vx);
    const tilt = Math.abs(s.th);
    const miss = Math.abs(s.x);
    const reasons = [];
    if (miss > v.radius) reasons.push(`${miss.toFixed(0)} m off the target`);
    if (vv > v.vMaxV) reasons.push(`${vv.toFixed(1)} m/s down at touchdown`);
    if (vh > v.vMaxH) reasons.push(`${vh.toFixed(1)} m/s sideways`);
    if (tilt > v.tiltMaxTouch) reasons.push(`${(tilt / DEG).toFixed(1)}° tilt`);
    if (s.prop <= 0 && vv > v.vMaxV) reasons.push("no propellant left");
    const ok = reasons.length === 0;
    this.outcome = {
      ok,
      reasons,
      vv,
      vh,
      tilt,
      miss,
      prop: s.prop,
      used: Math.max(0, this.prop0 - s.prop),
      t: s.t,
      x: s.x,
      y: s.y,
    };
    this.log(
      "end",
      ok
        ? `Touchdown: ${vv.toFixed(2)} m/s down, ${vh.toFixed(2)} m/s sideways, ${miss.toFixed(1)} m off.`
        : `Impact: ${reasons.join("; ")}.`
    );
  }

  /** The run as a record: outcome, grade, and how the baton was handled. */
  judge() {
    const v = this.veh;
    const o = this.outcome || { ok: false, reasons: ["not flown"], vv: 0, vh: 0, tilt: 0, miss: 0, prop: this.s.prop, used: 0, t: this.s.t };
    const flown = Math.max(this.humanSeconds + this.aiSeconds, 1e-6);
    const share = this.humanSeconds / flown;
    const back = this.transfers.filter((x) => x.to === "ai");
    const clean = back.filter((x) => x.clean).length;
    let score = 0;
    if (o.ok) {
      score = 55;
      score += clamp(18 * (1 - o.miss / v.radius), 0, 18);
      score += clamp(12 * (1 - o.vv / v.vMaxV), 0, 12);
      score += clamp(8 * (o.prop / this.prop0), 0, 8);
      score += clamp(share / 0.35, 0, 1) * 5;
      score += back.length ? clamp(clean / back.length, 0, 1) * 4 : 0;
      score -= this.calls * 2;
    }
    score = clamp(score, 0, 100);
    const grade = !o.ok ? "F" : score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "E";
    const title = !o.ok
      ? "Lost"
      : share < 0.05
        ? "Autopilot solo"
        : share > 0.9
          ? "Hand-flown"
          : this.calls > 0
            ? "Crewed, after a call"
            : "Crewed";
    return { ...o, score: Math.round(score), grade, title, humanShare: share, transfers: this.transfers, clean, calls: this.calls };
  }
}

/** Run a flight to its end (tests, and "skip to the end"). */
export function simulate(cfg = {}, { onStep, max = 600 } = {}) {
  const f = new BatonFlight(cfg);
  const limit = Math.ceil(max / f.dt);
  for (let i = 0; i < limit && !f.done; i++) {
    if (onStep) onStep(f);
    f.step(f.dt);
  }
  return f;
}
