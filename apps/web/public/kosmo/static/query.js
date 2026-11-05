// Safe query language over per-star fields. Hand-written tokenizer + recursive-descent parser; no eval.
// compileQuery(src, env) -> {ok, test(i), fieldsUsed} | {ok:false, error, pos}

export const EXAMPLE_QUERIES = [
  { label: "Settled stars", q: "settled" },
  { label: "Settled, generation > 3", q: "settled && gen > 3" },
  { label: "Unsettled within 2 kpc of Sol", q: "!settled && sphere(sol, 2000)" },
  { label: "Habitable and still empty", q: "score > 0.5 && !settled" },
  { label: "Catalog stars only", q: "catalog" },
  { label: "Galactic ring 6–10 kpc", q: "between(r, 6000, 10000)" },
  { label: "Thin slab around the disc", q: "slab(\"z\", -300, 300)" },
  { label: "Halo stars", q: "halo" },
  { label: "Cone from Sol toward origin", q: "cone(sol, origin, 20)" },
  { label: "Early settlers (< 100 Myr)", q: "settled && tSettled < 100" },
];

function tokenize(src) {
  const toks = []; let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const two = src.slice(i, i + 2);
    if (["&&", "||", "==", "!=", "<=", ">="].includes(two)) { toks.push({ t: "op", v: two, pos: i }); i += 2; continue; }
    if ("!<>+-*/(),".includes(ch)) { toks.push({ t: "op", v: ch, pos: i }); i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?([kM])?/i.exec(src.slice(i));
      if (!m) throw { error: "bad number", pos: i };
      let v = parseFloat(m[1] + (m[2] || ""));
      if (m[3] === "k") v *= 1e3; else if (m[3] === "M") v *= 1e6;
      toks.push({ t: "num", v, pos: i }); i += m[0].length; continue;
    }
    if (ch === '"' || ch === "'") {
      const j = src.indexOf(ch, i + 1);
      if (j < 0) throw { error: "unterminated string", pos: i };
      toks.push({ t: "str", v: src.slice(i + 1, j), pos: i }); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      toks.push({ t: "id", v: m[0], pos: i }); i += m[0].length; continue;
    }
    throw { error: `unexpected '${ch}'`, pos: i };
  }
  toks.push({ t: "eof", pos: src.length });
  return toks;
}

const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

export function compileQuery(src, env) {
  const fields = env.fields || {}, points = env.points || {}, pos = env.positions || {};
  const used = new Set();
  let toks;
  try { toks = tokenize(src); } catch (e) { return { ok: false, error: e.error, pos: e.pos }; }
  let p = 0;
  const peek = () => toks[p], eat = () => toks[p++];
  const fail = (error, at) => { throw { error, pos: at ?? peek().pos }; };
  const isOp = (v) => peek().t === "op" && peek().v === v;
  const coord = (a, i) => { const g = pos[a]; return typeof g === "function" ? g(i) : g[i]; };
  const FUNCS = {
    sphere: { n: 2, f: (i, pt, r) => { const q = ptOf(pt); return Math.hypot(coord("x", i) - q.x, coord("y", i) - q.y, coord("z", i) - q.z) <= r; } },
    shell: { n: 3, f: (i, pt, r1, r2) => { const q = ptOf(pt); const d = Math.hypot(coord("x", i) - q.x, coord("y", i) - q.y, coord("z", i) - q.z); return d >= r1 && d <= r2; } },
    slab: { n: 3, f: (i, ax, lo, hi) => { if (!["x", "y", "z"].includes(ax)) return false; const v = coord(ax, i); return v >= lo && v <= hi; } },
    cone: { n: 3, f: (i, a, b, deg) => {
      const A = ptOf(a), B = ptOf(b);
      const ax = B.x - A.x, ay = B.y - A.y, az = B.z - A.z;
      const vx = coord("x", i) - A.x, vy = coord("y", i) - A.y, vz = coord("z", i) - A.z;
      const m = Math.hypot(ax, ay, az) * Math.hypot(vx, vy, vz);
      if (m === 0) return true;
      return (ax * vx + ay * vy + az * vz) / m >= Math.cos((deg * Math.PI) / 180);
    } },
    between: { n: 3, f: (i, v, lo, hi) => v >= lo && v <= hi },
    abs: { n: 1, f: (i, v) => Math.abs(v) },
    min: { n: 2, f: (i, a, b) => Math.min(a, b) },
    max: { n: 2, f: (i, a, b) => Math.max(a, b) },
  };
  const ptOf = (v) => (v && typeof v === "object" ? v : { x: NaN, y: NaN, z: NaN });

  // each parse fn returns (i) => value
  function parseOr() { let l = parseAnd(); while (isOp("||")) { eat(); const a = l, b = parseAnd(); l = (i) => a(i) || b(i); } return l; }
  function parseAnd() { let l = parseNot(); while (isOp("&&")) { eat(); const a = l, b = parseNot(); l = (i) => a(i) && b(i); } return l; }
  function parseNot() { if (isOp("!")) { eat(); const a = parseNot(); return (i) => !a(i); } return parseCmp(); }
  function parseCmp() {
    let l = parseAdd();
    while (peek().t === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(peek().v)) {
      const op = eat().v, a = l, b = parseAdd();
      l = op === "==" ? (i) => a(i) === b(i) : op === "!=" ? (i) => a(i) !== b(i) : op === "<" ? (i) => a(i) < b(i)
        : op === "<=" ? (i) => a(i) <= b(i) : op === ">" ? (i) => a(i) > b(i) : (i) => a(i) >= b(i);
    }
    return l;
  }
  function parseAdd() { let l = parseMul(); while (isOp("+") || isOp("-")) { const op = eat().v, a = l, b = parseMul(); l = op === "+" ? (i) => a(i) + b(i) : (i) => a(i) - b(i); } return l; }
  function parseMul() { let l = parseUnary(); while (isOp("*") || isOp("/")) { const op = eat().v, a = l, b = parseUnary(); l = op === "*" ? (i) => a(i) * b(i) : (i) => a(i) / b(i); } return l; }
  function parseUnary() { if (isOp("-")) { eat(); const a = parseUnary(); return (i) => -a(i); } return parsePrimary(); }
  function parsePrimary() {
    const t = eat();
    if (t.t === "num" || t.t === "str") return () => t.v;
    if (t.t === "op" && t.v === "(") { const e = parseOr(); if (!isOp(")")) fail("expected ')'"); eat(); return e; }
    if (t.t === "id") {
      if (t.v === "true") return () => true;
      if (t.v === "false") return () => false;
      if (isOp("(")) {
        eat();
        if (!has(FUNCS, t.v)) fail(`unknown function '${t.v}'`, t.pos);
        const args = [];
        if (!isOp(")")) { do { args.push(parseOr()); if (isOp(",")) eat(); else break; } while (true); }
        if (!isOp(")")) fail("expected ')'"); eat();
        const fn = FUNCS[t.v];
        if (args.length !== fn.n) fail(`${t.v}() takes ${fn.n} arguments`, t.pos);
        return (i) => fn.f(i, ...args.map((a) => a(i)));
      }
      if (has(points, t.v)) { const pt = points[t.v]; return () => pt; }
      if (has(fields, t.v)) { used.add(t.v); const g = fields[t.v]; return (i) => g(i); }
      fail(`unknown field '${t.v}'`, t.pos);
    }
    fail(t.t === "eof" ? "unexpected end of query" : `unexpected '${t.v}'`, t.pos);
  }
  try {
    if (!src.trim()) return { ok: false, error: "empty query", pos: 0 };
    const f = parseOr();
    if (peek().t !== "eof") fail(`unexpected '${peek().v}'`);
    return { ok: true, test: (i) => !!f(i), fieldsUsed: [...used] };
  } catch (e) {
    if (e && typeof e.error === "string") return { ok: false, error: e.error, pos: e.pos };
    throw e;
  }
}

export function runQuery(compiled, count) {
  const mask = new Uint8Array(count);
  if (!compiled.ok) return mask;
  for (let i = 0; i < count; i++) mask[i] = compiled.test(i) ? 1 : 0;
  return mask;
}
