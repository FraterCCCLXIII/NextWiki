/* assembly.js -- solve an assembly from mates, measure it, and check it.

   Positions are never authored. An assembly is a part list plus a mate list; solveAssembly walks
   the graph from the root and derives each transform. The roll is snapped to the connector's
   symmetry, which is the step that makes a docking port clock or hit.

   Plain ES module with no DOM, so it runs in node (centauri-fleet.test.mjs).

   Ported from the SpaceRadio prototype (centauri-fleet/parts.mjs). One extension: a part entry may
   be a catalogue id or a part object, so a generated part (a sail sized from its payload) can be
   placed without registering it in the catalogue first. */

import { PARTS, PORT_TYPES, formatMass, formatLength } from './parts.js';

/* ------------------------------------------------------------------ *
 * Vector / quaternion helpers
 * ------------------------------------------------------------------ */

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = length(a) || 1; return mul(a, 1 / l); };

function quatMul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

function quatUnit(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

function axisAngle(axis, angle) {
  const a = unit(axis), s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
}

function rotate(q, v) {
  const qv = [q[0], q[1], q[2]];
  const t = mul(cross(qv, v), 2);
  return add(add(v, mul(t, q[3])), cross(qv, t));
}

function quatFromTo(u, v) {
  const a = unit(u), b = unit(v), d = dot(a, b);
  if (d > 1 - 1e-12) return [0, 0, 0, 1];
  if (d < -1 + 1e-12) {
    const helper = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return axisAngle(unit(cross(a, helper)), Math.PI);
  }
  const c = cross(a, b);
  return quatUnit([c[0], c[1], c[2], 1 + d]);
}

/** Signed angle that takes `from` onto `to`, measured about `axis`. */
function signedAngle(from, to, axis) {
  return Math.atan2(dot(axis, cross(from, to)), dot(from, to));
}

function clockOf(port) {
  const axis = unit(port.axis);
  const raw = port.clock ?? (Math.abs(dot(axis, [0, 1, 0])) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  const flat = sub(raw, mul(axis, dot(raw, axis)));
  if (length(flat) < 1e-9) {
    const helper = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return unit(sub(helper, mul(axis, dot(helper, axis))));
  }
  return unit(flat);
}

export function portOf(part, id) {
  return (part?.ports ?? []).find((p) => p.id === id) ?? null;
}

/**
 * The rigid transform that brings port B onto port A. Normals face each other, the clock references
 * are brought into line, and the result is snapped to the connector's rotational symmetry: a
 * clampband accepts any roll, an IDSS ring three, a CBM four.
 */
export function mateTransform(portA, portB) {
  const nA = unit(portA.axis), nB = unit(portB.axis);
  let q = quatFromTo(nB, mul(nA, -1));

  const cA = clockOf(portA);
  let cB = sub(rotate(q, clockOf(portB)), mul(nA, dot(rotate(q, clockOf(portB)), nA)));
  cB = unit(cB);

  const symmetry = PORT_TYPES[portA.type]?.symmetry ?? 0;
  let roll = signedAngle(cB, cA, nA);
  if (symmetry > 0) {
    const step = (Math.PI * 2) / symmetry;
    roll = Math.round(roll / step) * step;
  }
  q = quatUnit(quatMul(axisAngle(nA, roll), q));

  const placed = rotate(q, portB.at);
  return { position: sub(portA.at, placed), quaternion: q, roll };
}

/* ------------------------------------------------------------------ *
 * Assembly solving
 * ------------------------------------------------------------------ */

function worldOf(parentWorld, local) {
  return {
    position: add(parentWorld.position, rotate(parentWorld.quaternion, local.position)),
    quaternion: quatUnit(quatMul(parentWorld.quaternion, local.quaternion))
  };
}

/**
 * Place every part from the mates alone.
 * `def` is `{ root, parts: [{ as, part }], mates: [{ a: 'name.port', b: 'name.port' }] }`.
 * The first part of each mate is the parent; entered from the other side, the transform is derived
 * in reverse, so the author never has to think about order.
 */
export function solveAssembly(def, catalogue = PARTS) {
  const errors = [];
  const nodes = new Map();
  const mates = [];
  // Ports live on shared catalogue objects, so re-use is tracked per solve: stamping port.used
  // would leak into the next assembly and report false re-use.
  const usedPorts = new Set();

  for (const inst of def.parts ?? []) {
    const part = typeof inst.part === 'string' ? catalogue[inst.part] : inst.part;
    if (!part) { errors.push({ code: 'unknown-part', message: `Unknown part "${inst.part}"` }); continue; }
    if (nodes.has(inst.as)) { errors.push({ code: 'duplicate-name', message: `Two parts named "${inst.as}"` }); continue; }
    nodes.set(inst.as, {
      name: inst.as, part, parent: null, viaPort: null,
      local: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], roll: 0 },
      world: null
    });
  }

  const rootName = def.root ?? def.parts?.[0]?.as;
  const root = nodes.get(rootName);
  if (!root) {
    errors.push({ code: 'missing-root', message: `Root "${rootName}" is not in the parts list` });
    return { nodes: [], mates, errors, placed: new Set() };
  }
  root.world = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] };

  const parse = (ref) => {
    const [name, port] = String(ref).split('.');
    return { name, port };
  };

  const queue = [rootName];
  const seen = new Set([rootName]);
  const visited = new Set();

  while (queue.length) {
    const currentName = queue.shift();
    let edgeIndex = -1;
    for (const edge of def.mates ?? []) {
      edgeIndex += 1;
      if (visited.has(edgeIndex)) continue;
      const a = parse(edge.a), b = parse(edge.b);
      const forward = a.name === currentName;
      const backward = b.name === currentName;
      if (!forward && !backward) continue;

      const here = forward ? a : b;
      const there = forward ? b : a;
      const fromNode = nodes.get(here.name);
      const toNode = nodes.get(there.name);
      if (!fromNode || !toNode) {
        errors.push({ code: 'unknown-part', message: `Mate ${edge.a} -> ${edge.b} names a part that does not exist` });
        visited.add(edgeIndex);
        continue;
      }

      const fromPort = portOf(fromNode.part, here.port);
      const toPort = portOf(toNode.part, there.port);
      if (!fromPort || !toPort) {
        errors.push({
          code: 'unknown-port',
          message: `Mate ${edge.a} -> ${edge.b}: ${!fromPort ? `"${here.name}" has no port "${here.port}"` : `"${there.name}" has no port "${there.port}"`}`
        });
        visited.add(edgeIndex);
        continue;
      }

      visited.add(edgeIndex);

      const hereKey = `${here.name}.${here.port}`;
      const thereKey = `${there.name}.${there.port}`;
      if (usedPorts.has(hereKey)) errors.push({ code: 'port-reuse', message: `Port ${hereKey} is mated twice` });
      if (usedPorts.has(thereKey)) errors.push({ code: 'port-reuse', message: `Port ${thereKey} is mated twice` });
      usedPorts.add(hereKey);
      usedPorts.add(thereKey);

      const transform = mateTransform(fromPort, toPort);
      toNode.parent = fromNode.name;
      toNode.viaPort = fromPort.id;
      toNode.local = transform;
      toNode.world = worldOf(fromNode.world, transform);

      mates.push({
        a: { name: here.name, port: here.port, type: fromPort.type },
        b: { name: there.name, port: there.port, type: toPort.type },
        rollDeg: (transform.roll * 180) / Math.PI
      });

      if (!seen.has(toNode.name)) { seen.add(toNode.name); queue.push(toNode.name); }
    }
  }

  for (const node of nodes.values()) {
    if (!node.world) errors.push({ code: 'disconnected', message: `"${node.name}" has no mate path to the root` });
  }

  return {
    nodes: [...nodes.values()].filter((n) => n.world),
    mates,
    errors,
    placed: new Set([...nodes.values()].filter((n) => n.world).map((n) => n.name))
  };
}

/* ------------------------------------------------------------------ *
 * Measurement
 * ------------------------------------------------------------------ */

function envelopeOf(part, state = 'deployed') {
  const env = state === 'stowed' ? (part.stowed ?? part.dims) : part.dims;
  return { l: env.l ?? 0, d: env.d ?? 0 };
}

function localCentre(part, state) {
  const { l } = envelopeOf(part, state);
  return part.origin === 'centre' ? [0, 0, 0] : [0, l / 2, 0];
}

function corners(part, state) {
  const { l, d } = envelopeOf(part, state);
  const y0 = part.origin === 'centre' ? -l / 2 : 0;
  const y1 = y0 + l;
  const r = d / 2;
  const out = [];
  for (const x of [-r, r]) for (const y of [y0, y1]) for (const z of [-r, r]) out.push([x, y, z]);
  return out;
}

const ZERO = { pressurised: 0, habitable: 0 };

export function summarize(nodes, opts = {}) {
  const state = opts.state ?? 'deployed';
  let mass = 0;
  let massKnown = 0;
  let powerGen = 0;
  let powerLoad = 0;
  let rejectCapacity = 0;
  let pressurised = 0;
  let habitable = 0;
  let crew = 0;
  let cgWeighted = [0, 0, 0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const node of nodes) {
    const part = node.part;
    const m = part.mass ?? 0;
    mass += m;
    if (part.mass == null) massKnown += 1;
    powerGen += part.power?.gen ?? 0;
    powerLoad += part.power?.load ?? 0;
    rejectCapacity += part.heat?.rejectCapacity ?? 0;
    pressurised += part.volume?.pressurised ?? ZERO.pressurised;
    habitable += part.volume?.habitable ?? ZERO.habitable;
    crew += part.crew ?? 0;

    const centre = add(node.world.position, rotate(node.world.quaternion, localCentre(part, state)));
    cgWeighted = add(cgWeighted, mul(centre, m));

    for (const corner of corners(part, state)) {
      const p = add(node.world.position, rotate(node.world.quaternion, corner));
      for (let i = 0; i < 3; i += 1) {
        if (p[i] < min[i]) min[i] = p[i];
        if (p[i] > max[i]) max[i] = p[i];
      }
    }
  }

  const size = mass > 0 ? [min[0], min[1], min[2]].map((v, i) => max[i] - v) : [0, 0, 0];
  return {
    state,
    partCount: nodes.length,
    mass,
    unknownMassParts: massKnown,
    cg: mass > 0 ? mul(cgWeighted, 1 / mass) : [0, 0, 0],
    bounds: { min, max, size, span: Math.max(size[0], size[2]), height: size[1] },
    power: { gen: powerGen, load: powerLoad, margin: powerGen - powerLoad },
    heat: { rejectCapacity },
    volumes: { pressurised, habitable, habitablePerCrew: crew > 0 ? habitable / crew : null },
    crew
  };
}

/* ------------------------------------------------------------------ *
 * Realism checks
 * ------------------------------------------------------------------ */

export const FAIRINGS = {
  'falcon-9': { name: 'Falcon 9', l: 11, d: 4.6, source: 'SpaceX Falcon User\u2019s Guide: 4.6 m x 11 m payload envelope' }
};

function descendants(nodes, name, children) {
  const out = [];
  const stack = [...(children.get(name) ?? [])];
  while (stack.length) {
    const next = stack.pop();
    out.push(next);
    stack.push(...(children.get(next.name) ?? []));
  }
  return out;
}

/**
 * Every reason an assembly would be rejected by a real integration review. `fairing` is checked
 * against the STOWED envelope, because nothing this large launches unfolded. Pass `fairing: null`
 * for an in-orbit assembly, where the launch envelope is not the binding constraint.
 */
export function checkAssembly(def, solved, opts = {}) {
  const issues = [];
  const fairing = opts.fairing === null ? null : (opts.fairing ?? FAIRINGS['falcon-9']);

  for (const error of solved.errors) {
    issues.push({ severity: error.code === 'port-reuse' ? 'warn' : 'error', ...error });
  }

  for (const mate of solved.mates) {
    const typeA = PORT_TYPES[mate.a.type];
    if (mate.a.type !== mate.b.type) {
      issues.push({
        severity: 'error', code: 'type-mismatch',
        message: `${mate.a.name}.${mate.a.port} (${mate.a.type}) cannot mate to ${mate.b.name}.${mate.b.port} (${mate.b.type}) without an adapter part`
      });
      continue;
    }
    const androgynous = typeA?.androgynous;
    const genderA = portOf(solved.nodes.find((n) => n.name === mate.a.name).part, mate.a.port)?.gender;
    const genderB = portOf(solved.nodes.find((n) => n.name === mate.b.name).part, mate.b.port)?.gender;
    if (!androgynous && genderA === genderB) {
      issues.push({
        severity: 'error', code: 'gender-mismatch',
        message: `${mate.a.name}.${mate.a.port} and ${mate.b.name}.${mate.b.port} are both ${genderA}; a ${mate.a.type} needs one active half and one passive half`
      });
    }
  }

  const children = new Map();
  for (const node of solved.nodes) {
    if (!node.parent) continue;
    if (!children.has(node.parent)) children.set(node.parent, []);
    children.get(node.parent).push(node);
  }

  const massOf = (node) => (node.part.mass ?? 0) + descendants(solved.nodes, node.name, children).reduce((s, n) => s + (n.part.mass ?? 0), 0);

  for (const node of solved.nodes) {
    if (!node.parent) continue;
    const parent = solved.nodes.find((n) => n.name === node.parent);
    const port = portOf(parent.part, node.viaPort);
    const limit = PORT_TYPES[port?.type]?.maxMass;
    const carried = massOf(node);
    if (limit != null && carried > limit) {
      issues.push({
        severity: 'error', code: 'port-overload',
        message: `${parent.name}.${node.viaPort} carries ${formatMass(carried)}, above the ${PORT_TYPES[port.type].mateD ? formatLength(PORT_TYPES[port.type].mateD) : port.type} rating of ${formatMass(limit)}`
      });
    }
  }

  if (fairing) {
    for (const node of solved.nodes) {
      const env = envelopeOf(node.part, 'stowed');
      if (env.l > fairing.l || env.d > fairing.d) {
        issues.push({
          severity: 'error', code: 'fairing',
          message: `${node.name} stows to ${env.l.toFixed(2)} m x ${env.d.toFixed(2)} m, outside ${fairing.name} (${fairing.l} m x ${fairing.d} m)`
        });
      }
    }
  }

  return issues;
}
