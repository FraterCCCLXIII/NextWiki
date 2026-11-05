/* Expression engine for graph.html: a small recursive-descent parser that compiles
   what you type into a plain JS closure. Nothing is ever passed to eval(): the parser
   builds an AST, and the code generator only emits whitelisted names (K.sin, P.a …),
   numeric literals and operators.

   Exposed as window.GMath (and module.exports under node, for tests). */
(function (root) {
  "use strict";

  /* ---------- numeric kernel ---------- */
  const K = { deg: false };
  const toRad = (a) => (K.deg ? (a * Math.PI) / 180 : a);
  const fromRad = (a) => (K.deg ? (a * 180) / Math.PI : a);

  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0];
    for (let i = 1; i < 9; i++) x += c[i] / (z + i);
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  K.gamma = gamma;
  K.fact = (n) => {
    if (Number.isInteger(n)) {
      if (n < 0) return NaN;
      if (n > 170) return Infinity;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    }
    return gamma(n + 1);
  };
  K.sin = (a) => Math.sin(toRad(a));
  K.cos = (a) => Math.cos(toRad(a));
  K.tan = (a) => Math.tan(toRad(a));
  K.sec = (a) => 1 / Math.cos(toRad(a));
  K.csc = (a) => 1 / Math.sin(toRad(a));
  K.cot = (a) => 1 / Math.tan(toRad(a));
  K.asin = (a) => fromRad(Math.asin(a));
  K.acos = (a) => fromRad(Math.acos(a));
  K.atan = (a) => fromRad(Math.atan(a));
  K.atan2 = (a, b) => fromRad(Math.atan2(a, b));
  K.sinh = Math.sinh; K.cosh = Math.cosh; K.tanh = Math.tanh;
  K.asinh = Math.asinh; K.acosh = Math.acosh; K.atanh = Math.atanh;
  K.sqrt = Math.sqrt; K.cbrt = Math.cbrt; K.abs = Math.abs;
  K.ln = Math.log; K.log = Math.log10; K.log2 = Math.log2; K.exp = Math.exp;
  K.floor = Math.floor; K.ceil = Math.ceil; K.round = Math.round; K.sign = Math.sign;
  K.min = Math.min; K.max = Math.max; K.hypot = Math.hypot;
  K.mod = (a, b) => { const m = a % b; return m !== 0 && (m < 0) !== (b < 0) ? m + b : m; };
  K.pow = (a, b) => {
    if (a < 0 && Number.isFinite(b) && !Number.isInteger(b)) {
      const inv = 1 / b;
      if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) return -Math.pow(-a, b);
    }
    return Math.pow(a, b);
  };

  /* name -> [min args, max args] */
  const FUNCS = {
    sin: [1, 1], cos: [1, 1], tan: [1, 1], sec: [1, 1], csc: [1, 1], cot: [1, 1],
    asin: [1, 1], acos: [1, 1], atan: [1, 1], atan2: [2, 2],
    sinh: [1, 1], cosh: [1, 1], tanh: [1, 1], asinh: [1, 1], acosh: [1, 1], atanh: [1, 1],
    sqrt: [1, 1], cbrt: [1, 1], abs: [1, 1], ln: [1, 1], log: [1, 1], log2: [1, 1], exp: [1, 1],
    floor: [1, 1], ceil: [1, 1], round: [1, 1], sign: [1, 1], fact: [1, 1], gamma: [1, 1],
    min: [1, 9], max: [1, 9], hypot: [1, 9], pow: [2, 2], mod: [2, 2]
  };
  const ALIAS = { arcsin: "asin", arccos: "acos", arctan: "atan", log10: "log", lg: "log", sgn: "sign", factorial: "fact", ceiling: "ceil" };
  const CONSTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2, inf: Infinity };
  /* free variables of a plotted expression */
  const VARS = ["x", "y", "t", "u", "v", "theta"];

  /* parameters (sliders / calculator variables) and user functions live here */
  const P = { ans: 0 };
  const F = {};

  /* ---------- tokenizer ---------- */
  function tokenize(src) {
    let s = String(src)
      .replace(/√\s*([0-9.]+)/g, "sqrt($1)")
      .replace(/π/g, "pi").replace(/θ/g, "theta").replace(/τ/g, "tau").replace(/φ/g, "phi")
      .replace(/×|·/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/√/g, "sqrt")
      .replace(/²/g, "^2").replace(/³/g, "^3");
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t") { i++; continue; }
      let m;
      if ((m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i)))) {
        /* "2e" followed by a letter is 2*e, not an exponent: the regexp already demands digits */
        out.push({ t: "num", v: parseFloat(m[0]) });
        i += m[0].length;
      } else if ((m = /^[A-Za-z_]+/.exec(s.slice(i)))) {
        out.push({ t: "id", v: m[0] });
        i += m[0].length;
      } else if ("+-*/^%!(),".indexOf(c) >= 0) {
        out.push({ t: "op", v: c });
        i++;
      } else {
        throw new Error('unexpected "' + c + '"');
      }
    }
    return out;
  }

  /* ---------- parser ---------- */
  function parse(src, known) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const isOp = (v) => toks[p] && toks[p].t === "op" && toks[p].v === v;
    const eat = (v) => { if (isOp(v)) { p++; return true; } return false; };
    const need = (v) => { if (!eat(v)) throw new Error('expected "' + v + '"'); };

    function parseTop() {
      if (!toks.length) throw new Error("empty");
      const n = parseList();
      if (p < toks.length) throw new Error('unexpected "' + (toks[p].v) + '"');
      return n;
    }
    function parseList() {
      const first = parseAdd();
      if (!isOp(",")) return first;
      const a = [first];
      while (eat(",")) a.push(parseAdd());
      return { t: "tuple", a };
    }
    function parseAdd() {
      let l = parseMul();
      while (isOp("+") || isOp("-")) {
        const op = toks[p++].v;
        l = { t: "bin", op, l, r: parseMul() };
      }
      return l;
    }
    function startsFactor() {
      const k = peek();
      if (!k) return false;
      return k.t === "num" || k.t === "id" || (k.t === "op" && k.v === "(");
    }
    function parseMul() {
      let l = parseUnary();
      for (;;) {
        if (isOp("*") || isOp("/") || isOp("%")) {
          const op = toks[p++].v;
          l = { t: "bin", op, l, r: parseUnary() };
        } else if (startsFactor()) {
          l = { t: "bin", op: "*", l, r: parseUnary() }; /* implicit: 2x, 3(x+1), x sin(x) */
        } else break;
      }
      return l;
    }
    function parseUnary() {
      if (eat("-")) return { t: "neg", x: parseUnary() };
      if (eat("+")) return parseUnary();
      return parsePow();
    }
    function parsePow() {
      const base = parsePostfix();
      if (eat("^")) return { t: "bin", op: "^", l: base, r: parseUnary() };
      return base;
    }
    function parsePostfix() {
      let n = parsePrimary();
      while (isOp("!")) { p++; n = { t: "fact", x: n }; }
      return n;
    }
    /* "xy" or "2xt" with unknown multi-letter ids: split into single known letters */
    function splitId(name) {
      if (name.length < 2 || known(name)) return null;
      const parts = [];
      for (const ch of name) { if (!known(ch)) return null; parts.push(ch); }
      return parts;
    }
    function parsePrimary() {
      const k = toks[p++];
      if (!k) throw new Error("unexpected end");
      if (k.t === "num") return { t: "num", v: k.v };
      if (k.t === "op" && k.v === "(") {
        const n = parseList();
        need(")");
        return n;
      }
      if (k.t === "id") {
        let name = ALIAS[k.v.toLowerCase()] || k.v;
        if (FUNCS[name] || (F[name] && isOp("("))) {
          if (!isOp("(")) throw new Error(name + " needs ( )");
          p++;
          const args = [parseAdd()];
          while (eat(",")) args.push(parseAdd());
          need(")");
          return { t: "call", n: name, a: args };
        }
        const parts = splitId(name);
        if (parts) {
          let n = { t: "id", n: parts[0] };
          for (let i = 1; i < parts.length; i++) n = { t: "bin", op: "*", l: n, r: { t: "id", n: parts[i] } };
          return n;
        }
        return { t: "id", n: name };
      }
      throw new Error('unexpected "' + k.v + '"');
    }
    return parseTop();
  }

  /* ---------- compiler ---------- */
  function emit(n, cx) {
    switch (n.t) {
      case "num": return Number.isFinite(n.v) ? String(n.v) : "Infinity";
      case "neg": return "(-" + emit(n.x, cx) + ")";
      case "fact": return "K.fact(" + emit(n.x, cx) + ")";
      case "tuple": throw new Error("a list (a, b) is only allowed as the whole expression");
      case "bin": {
        const l = emit(n.l, cx), r = emit(n.r, cx);
        if (n.op === "^") return "K.pow(" + l + "," + r + ")";
        if (n.op === "%") return "K.mod(" + l + "," + r + ")";
        return "(" + l + n.op + r + ")";
      }
      case "call": {
        const args = n.a.map((a) => emit(a, cx));
        if (FUNCS[n.n]) {
          const [lo, hi] = FUNCS[n.n];
          if (args.length < lo || args.length > hi) throw new Error(n.n + " takes " + (lo === hi ? lo : lo + "–" + hi) + " argument" + (hi > 1 ? "s" : ""));
          return "K." + n.n + "(" + args.join(",") + ")";
        }
        const f = F[n.n];
        if (!f) throw new Error('unknown function "' + n.n + '"');
        if (args.length !== f.arity) throw new Error(n.n + " takes " + f.arity + " argument" + (f.arity > 1 ? "s" : ""));
        return "F." + n.n + ".fn(" + args.join(",") + ")";
      }
      case "id": {
        const name = n.n;
        if (cx.locals && cx.locals.indexOf(name) >= 0) return "L_" + name;
        if (name === "theta" || name === "th") { cx.vars.add("theta"); return cx.noVars ? bad(name) : "th"; }
        if (name === "r" && !cx.noVars) { cx.vars.add("r"); return "r"; }
        if (VARS.indexOf(name) >= 0) { cx.vars.add(name); return cx.noVars ? bad(name) : name; }
        if (Object.prototype.hasOwnProperty.call(CONSTS, name)) return String(CONSTS[name]);
        if (Object.prototype.hasOwnProperty.call(P, name)) { if (name !== "ans") cx.params.add(name); return "P." + name; }
        if (cx.autoParam) { P[name] = 1; cx.params.add(name); return "P." + name; }
        return bad(name);
      }
    }
    throw new Error("bad node");
  }
  function bad(name) { throw new Error('"' + name + '" is not defined'); }

  function make(node, opts) {
    opts = opts || {};
    const cx = { vars: new Set(), params: new Set(), autoParam: !!opts.autoParam, noVars: !!opts.noVars, locals: opts.locals || null };
    const code = emit(node, cx);
    const argList = cx.locals ? cx.locals.map((l) => "L_" + l).join(",") : "x,y,t,u,v,th";
    const pre = cx.locals ? "" : "var r=Math.sqrt(x*x+y*y);";
    const fn = new Function("K", "P", "F", "Math", "return function(" + argList + "){" + pre + "return " + code + ";}")(K, P, F, Math);
    return { fn, vars: cx.vars, params: cx.params };
  }

  const knownFor = (autoParam) => (name) =>
    !!(FUNCS[name] || ALIAS[name] || F[name] || VARS.indexOf(name) >= 0 || name === "th" || name === "r" ||
      Object.prototype.hasOwnProperty.call(CONSTS, name) || Object.prototype.hasOwnProperty.call(P, name));

  /* ---------- number formatting ---------- */
  function fmt(v) {
    if (typeof v !== "number") return String(v);
    if (Number.isNaN(v)) return "undefined";
    if (!Number.isFinite(v)) return v < 0 ? "-∞" : "∞";
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a >= 1e15 || a < 1e-6) return Number(v.toPrecision(10)).toExponential().replace("e+", "e");
    return String(Number(v.toPrecision(12)));
  }

  /* ---------- statements ---------- */
  const RESERVED = new Set(VARS.concat(["r", "th", "z", "pi", "e", "tau", "phi", "inf", "ans"]));

  function constEval(src) {
    const m = make(parse(src, knownFor(false)), { noVars: true });
    return m.fn();
  }

  function parseRange(txt) {
    /* "0..2pi, -1..1"  ->  [[0, 6.28], [-1, 1]] */
    return txt.split(",").map((seg) => {
      const parts = seg.split("..");
      if (parts.length !== 2) throw new Error("range looks like a..b");
      const a = constEval(parts[0]), b = constEval(parts[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) throw new Error("bad range");
      return [a, b];
    });
  }

  /* One line of the graph panel. Never throws; errors come back in .err. */
  function analyze(src) {
    const res = { kind: "empty", err: null, params: new Set(), vars: new Set(), fns: [], range: null };
    try {
      let text = String(src).trim();
      if (!text) return res;
      const at = text.lastIndexOf("@");
      if (at >= 0) { res.range = parseRange(text.slice(at + 1)); text = text.slice(0, at).trim(); }

      let m;
      /* f(x) = …  defines a function, and also plots it */
      if ((m = /^([A-Za-z_]+)\s*\(\s*([A-Za-z_]+(?:\s*,\s*[A-Za-z_]+)*)\s*\)\s*=(?!=)\s*(.+)$/.exec(text))) {
        const def = defineFn(m[1], m[2], m[3]);
        res.kind = def.arity === 1 ? "y" : "def";
        if (def.arity === 1) res.fns = [(x) => def.fn(x)];
        res.params = def.params;
        return res;
      }
      let prefix = null;
      if ((m = /^([A-Za-z_]+)\s*=(?!=)\s*(.+)$/.exec(text))) {
        const lhs = m[1];
        if (lhs === "y" || lhs === "z" || lhs === "r") { prefix = lhs; text = m[2]; }
        else if (RESERVED.has(lhs) || FUNCS[lhs]) throw new Error('"' + lhs + '" is reserved');
        else {
          /* a = 2.5  ->  a slider */
          const v = constEval(m[2]);
          if (!Number.isFinite(v)) throw new Error("not a number");
          P[lhs] = v;
          res.kind = "assign"; res.name = lhs; res.value = v;
          return res;
        }
      } else if (/=/.test(text)) {
        throw new Error("write it as y = …, z = …, r = … or (x(t), y(t))");
      }

      const ast = parse(text, knownFor(true));
      const collect = (node) => {
        const c = make(node, { autoParam: true });
        c.params.forEach((q) => res.params.add(q));
        c.vars.forEach((q) => res.vars.add(q));
        return c.fn;
      };
      if (ast.t === "tuple") {
        if (prefix) throw new Error("drop the " + prefix + " = before a (…, …) list");
        res.fns = ast.a.map(collect);
        const usesUV = res.vars.has("u") || res.vars.has("v");
        if (ast.a.length === 2) {
          if (usesUV) throw new Error("u and v need three components");
          res.kind = "par2";
        } else if (ast.a.length === 3) {
          res.kind = usesUV ? "psurf" : "curve3";
        } else throw new Error("use 2 components for a curve, 3 for 3D");
        return res;
      }
      res.fns = [collect(ast)];
      if (prefix === "r") res.kind = "polar";
      else if (prefix === "z") res.kind = "surf";
      else if (prefix === "y") res.kind = "y";
      else if (res.vars.has("y") || res.vars.has("r") || res.vars.has("theta")) res.kind = "surf";
      else res.kind = "y";
      if (res.kind === "polar" && res.vars.has("x")) { /* x is allowed, evaluates as theta */ }
      return res;
    } catch (e) {
      res.kind = "error";
      res.err = e.message;
      return res;
    }
  }

  function defineFn(name, argTxt, body) {
    if (RESERVED.has(name) || FUNCS[name] || ALIAS[name]) throw new Error('"' + name + '" is reserved');
    const names = argTxt.split(",").map((s) => s.trim());
    const ast = parse(body, (n) => knownFor(true)(n) || names.indexOf(n) >= 0);
    const params = new Set();
    /* register early so f can be recursive-free but self-aware of arity */
    const c = make(ast, { locals: names, autoParam: true });
    c.params.forEach((q) => params.add(q));
    F[name] = { arity: names.length, fn: c.fn };
    return { arity: names.length, fn: c.fn, params };
  }

  /* One line of the calculator. Returns {text, value?, note?}; throws on errors. */
  function calc(src) {
    let text = String(src).trim();
    if (!text) throw new Error("empty");
    let m;
    if ((m = /^([A-Za-z_]+)\s*\(\s*([A-Za-z_]+(?:\s*,\s*[A-Za-z_]+)*)\s*\)\s*=(?!=)\s*(.+)$/.exec(text))) {
      const d = defineFn(m[1], m[2], m[3]);
      return { text: m[1] + "(" + m[2].replace(/\s+/g, "") + ") defined", note: true, arity: d.arity };
    }
    if ((m = /^([A-Za-z_]+)\s*=(?!=)\s*(.+)$/.exec(text))) {
      const lhs = m[1];
      if (RESERVED.has(lhs) || FUNCS[lhs]) throw new Error('"' + lhs + '" is reserved');
      const v = make(parse(m[2], knownFor(false)), { noVars: true }).fn();
      P[lhs] = v;
      return { text: lhs + " = " + fmt(v), value: v, assigned: lhs };
    }
    if (/=/.test(text)) throw new Error("use name = value");
    const v = make(parse(text, knownFor(false)), { noVars: true }).fn();
    if (typeof v !== "number") throw new Error("not a number");
    return { text: fmt(v), value: v };
  }

  const api = { K, P, F, analyze, calc, fmt, parse, constEval, FUNCS, CONSTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GMath = api;
})(typeof window !== "undefined" ? window : globalThis);
