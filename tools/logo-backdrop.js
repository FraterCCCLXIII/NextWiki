/* Shared backdrops for logo pages: a starfield, and a dark background color chosen to complement a logo's own colors. */

/* ---- complementary color ---- */
function backdropHsl(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex || "");
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l, rgb: [r, g, b] };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { h, s, l, rgb: [r, g, b] };
}
function backdropHex(h, s, l) {
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
const backdropLum = (c) => { const f = c.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const backdropSeed = (id) => [...String(id)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);

/* Most logos sit on white, black or space. The rest, about one in five, take a colour from a period palette.
   Every choice must keep the logo readable: enough of its coloured area has to clear a contrast floor on that background. */
const BACKDROP_WHITE = "#ffffff", BACKDROP_BLACK = "#000000", BACKDROP_SPACE = "#05060f";
const BACKDROP_ERAS = [
  "#f3ead7", "#1f2a44", "#5b1a18", "#2f3b2c",   // 1940s: cream, navy, oxblood, olive drab
  "#140a33", "#2b0a3d", "#06282f", "#f7efe1",   // 1980s: indigo night, violet, deep teal, bone
  "#f4f4f0", "#111316", "#1e1b4b", "#ece8ff",   // modern: off-white, ink, deep indigo, pale lilac
];
function backdropContrast(a, b) { const x = backdropLum(a), y = backdropLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

/* fills: [{ hex, weight }]. Black, white and greys don't count, because they flip to suit the background.
   The id picks among the choices that work, so a logo keeps its background and the set stays varied. */
function pickBackdrop(fills, id) {
  const seed = backdropSeed(id), cols = fills.map((f) => ({ ...backdropHsl(f.hex), weight: f.weight || 1 })).filter((c) => c.h !== undefined && c.s > 0.18 && c.l > 0.08 && c.l < 0.93);
  const total = cols.reduce((t, c) => t + c.weight, 0);
  const clears = (bg, floor) => { const b = backdropHsl(bg).rgb; return !total || cols.reduce((t, c) => t + (backdropContrast(c.rgb, b) >= floor ? c.weight : 0), 0) / total; };
  if (seed % 5 === 0) {
    const fits = BACKDROP_ERAS.filter((bg) => clears(bg, 3) === true || clears(bg, 3) >= 0.95);
    if (fits.length) return fits[(seed >>> 3) % fits.length];
  }
  const white = clears(BACKDROP_WHITE, 3) === true || clears(BACKDROP_WHITE, 3) >= 0.8, dark = clears(BACKDROP_BLACK, 3) === true || clears(BACKDROP_BLACK, 3) >= 0.8;
  const mono = [...(white ? [BACKDROP_WHITE] : []), ...(dark ? [BACKDROP_BLACK, BACKDROP_SPACE] : [])];
  if (mono.length) return mono[(seed >>> 3) % mono.length];
  /* neither clears the floor: whichever reads best overall */
  const avg = (bg) => { const b = backdropHsl(bg).rgb; return cols.reduce((t, c) => t + Math.log(backdropContrast(c.rgb, b)) * c.weight, 0); };
  return avg(BACKDROP_WHITE) >= avg(BACKDROP_BLACK) ? BACKDROP_WHITE : BACKDROP_SPACE;
}

/* ---- starfield ----
   Options, all changeable later with set():
   speed and density are multipliers, trail is the streak length as a multiplier.
   colors is a list of CSS colors for the stars; without one, rainbow picks a hue by direction, or white when rainbow is false. */
function createStarfield(canvas, opts) {
  const o = { rainbow: true, speed: 1, trail: 1, density: 1, colors: null, fps: 0, glow: 0, glowCurve: 1, ...(opts || {}) };
  let raf = 0, last = 0, W = 0, H = 0, flying = [], far = [], builtDensity = 0;
  const ctx = canvas.getContext("2d"), still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const newStar = (z) => [(Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, z, Math.random()];
  const pickColor = (r) => o.colors[Math.floor(r * o.colors.length)];
  function fit() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (w === W && h === H && builtDensity === o.density) return;
    W = canvas.width = w; H = canvas.height = h; builtDensity = o.density;
    const dense = Math.min(1, (W * H) / (1280 * 720));
    flying = Array.from({ length: Math.round(520 * Math.max(0.35, dense) * o.density) }, () => newStar(0.05 + Math.random() * 0.95));
    far = Array.from({ length: Math.round(420 * Math.max(0.35, dense) * o.density) }, () => [Math.random() * W, Math.random() * H, 0.25 + Math.random() * 0.6, Math.random() < 0.12 ? 1.8 : 1.1, Math.random()]);
  }
  function drawFar() { far.forEach((p) => { ctx.globalAlpha = p[2]; ctx.fillStyle = o.colors && o.colors.length ? pickColor(p[4]) : "#fff"; ctx.fillRect(p[0], p[1], p[3], p[3]); }); ctx.globalAlpha = 1; }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < (o.fps ? 1000 / o.fps : 33)) return;
    const dt = Math.min(o.fps ? 1000 : 100, now - last);
    last = now; fit();
    ctx.clearRect(0, 0, W, H); drawFar(); ctx.lineCap = "round";
    const D = Math.max(W, H) * 0.5;
    flying.forEach((s, i) => {
      s[2] -= dt * 0.00032 * o.speed;
      const x = W / 2 + (s[0] / s[2]) * D, y = H / 2 + (s[1] / s[2]) * D;
      if (s[2] <= 0.02 || x < -20 || x > W + 20 || y < -20 || y > H + 20) { flying[i] = newStar(1); return; }
      /* the tail reaches back to where the star was, trail frames ago */
      const tail = s[2] + 0.0106 * o.speed * o.trail, px = W / 2 + (s[0] / tail) * D, py = H / 2 + (s[1] / tail) * D, b = Math.pow(1 - s[2], 0.6), a = 0.3 + 0.7 * b;
      const col = o.colors && o.colors.length ? pickColor(s[3]) : o.rainbow ? `hsl(${(Math.atan2(s[1], s[0]) * 57.3 + 360) % 360},90%,82%)` : "#fff";
      ctx.strokeStyle = col;
      /* bloom: a wider, fainter pass under the star, from the same strength, size and curve as the logo's */
      if (o.glow > 0) { ctx.globalAlpha = a * 0.5 * Math.pow(Math.min(1, o.glow / 2), o.glowCurve); ctx.lineWidth = (0.8 + b * 2.6) * (2 + 2 * o.glow); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); }
      ctx.globalAlpha = a; ctx.fillStyle = col; ctx.lineWidth = 0.8 + b * 2.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 0.5 + b * 1.6, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  return {
    start() { cancelAnimationFrame(raf); canvas.style.display = "block"; fit(); if (still) { ctx.clearRect(0, 0, W, H); drawFar(); return; } last = 0; raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); canvas.style.display = "none"; },
    set(next) { Object.assign(o, next); },
  };
}

/* ---- parallax ----
   Puts the parts of a logo on separate depth planes and moves a camera past them. Each top-level part gets its own <g>,
   so paint order never changes and the reveal animations on the parts underneath keep running.
   split "color": text in front, each color on its own plane behind it. split "text": text in front, all shapes on one plane.
   A logo in a single color splits by size instead: the big shapes go back, the letter-sized pieces stay in front.
   camera "drift": a slow wander. "pointer": follows the pointer. "push": a slow one-way move in. */
function parallaxParts(svg) {
  const top = svg.querySelector("g.kl-fx, g.sr-fx") || svg, kids = (el) => [...el.children].filter((c) => c.tagName !== "defs");
  const cols = [...top.children].find((c) => c.classList && c.classList.contains("cols"));
  if (!cols) return kids(top);
  return kids(top).flatMap((c) => (c === cols ? kids(c) : [c]));
}
function parallaxKey(part) {
  if (part.classList.contains("pp")) return "paper";
  const f = part.getAttribute("fill") || (part.querySelector("[fill]") || part).getAttribute("fill") || "";
  const m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(f);
  if (!m) return /^url/.test(f) ? f : "neutral";
  const c = [1, 2, 3].map((i) => parseInt(m[i], 16));
  if (Math.max(...c) - Math.min(...c) < 40) return "neutral";
  return c.map((v) => v >> 5).join(",");   // near-identical traced shades share a plane
}
function parallaxDepths(parts, split) {
  const keys = parts.map((p) => parallaxKey(p.item));
  keys.forEach((k, i) => { if (k === "paper") keys[i] = i ? keys[i - 1] : "neutral"; });   // a paper piece stays with what it cuts into
  const colors = [...new Set(keys)].filter((k) => k !== "neutral");
  if (!colors.length || (colors.length === 1 && !keys.includes("neutral"))) {
    const hs = parts.map((p) => { try { return p.item.getBBox().height; } catch { return 0; } }), mid = [...hs].sort((a, b) => a - b)[hs.length >> 1] || 0;
    return hs.map((h) => (h > mid * 1.6 ? -0.8 : 1));
  }
  const z = {};
  colors.forEach((k, i) => { z[k] = split === "text" || colors.length === 1 ? -0.8 : -1 + (1.3 * i) / (colors.length - 1); });
  return keys.map((k) => (k === "neutral" ? 1 : z[k]));
}
function createParallax(root, opts) {
  const o = { on: false, depth: 1, speed: 1, camera: "drift", split: "color", fps: 0, ...(opts || {}) };
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0, last = 0, t = 0, planes = [], px = 0, py = 0, tx = 0, ty = 0, paused = false;
  addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; });
  function paint() {
    let dx = 0, dy = 0, push = 0;
    if (o.camera === "pointer") { px += (tx - px) * 0.08; py += (ty - py) * 0.08; dx = -px; dy = -py; }
    else if (o.camera === "push") push = 0.006 * Math.min(t, 20);
    else { dx = Math.sin(t * 0.5); dy = Math.sin(t * 0.37) * 0.6; }
    planes.forEach((p) => {
      const a = p.w * 0.03 * o.depth * p.z, s = 1 + push * o.depth * p.z;
      p.g.setAttribute("transform", `translate(${(p.cx + dx * a).toFixed(2)} ${(p.cy + dy * a).toFixed(2)}) scale(${s.toFixed(4)}) translate(${-p.cx} ${-p.cy})`);
    });
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (o.fps && last && now - last < 1000 / o.fps) return;
    if (!paused) t += (Math.min(o.fps ? 1000 : 100, now - (last || now)) / 1000) * o.speed;
    last = now;
    paint();
  }
  const api = {
    /* call once the logo's reveal is set up; call again whenever new copies of the logo appear */
    attach(keepTime) {
      if (!keepTime) t = 0;
      planes = [];
      if (!o.on || still) return;
      root.querySelectorAll("svg").forEach((svg) => {
        if (!svg.viewBox || !svg.viewBox.baseVal.width) return;
        if (!svg._px) svg._px = parallaxParts(svg).map((item) => {
          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g.setAttribute("class", "px");
          item.parentNode.insertBefore(g, item);
          g.appendChild(item);
          return { g, item };
        });
        const vb = svg.viewBox.baseVal, zs = parallaxDepths(svg._px, o.split);
        svg._px.forEach((p, i) => planes.push({ g: p.g, z: zs[i], w: vb.width, cx: vb.x + vb.width / 2, cy: vb.y + vb.height / 2 }));
      });
      cancelAnimationFrame(raf);
      last = 0;
      if (planes.length) raf = requestAnimationFrame(loop);
    },
    set(next) {
      const resplit = next.split && next.split !== o.split;
      Object.assign(o, next);
      if (o.on) { if (!planes.length || resplit) api.attach(true); return; }
      cancelAnimationFrame(raf);
      planes = [];
      root.querySelectorAll("g.px").forEach((g) => g.removeAttribute("transform"));
    },
    pause(on) { paused = on; },
    planes: () => planes,
  };
  return api;
}

/* ---- curve pad ----
   A small graph of a response curve, output = input ^ exponent, tied to a range input that holds the exponent.
   Drag on the graph, or move the slider: each keeps the other up to date. Below 1 lifts faint glow, above 1 tightens it. */
function createCurvePad(svg, range) {
  const NS = "http://www.w3.org/2000/svg", path = document.createElementNS(NS, "path"), diag = document.createElementNS(NS, "path");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("role", "presentation");
  svg.style.touchAction = "none";
  diag.setAttribute("d", "M0 100L100 0"); diag.setAttribute("class", "curve-diag");
  path.setAttribute("class", "curve-line");
  svg.appendChild(diag); svg.appendChild(path);
  const paint = () => {
    const e = +range.value;
    let d = "";
    for (let i = 0; i <= 24; i++) { const x = i / 24; d += `${i ? "L" : "M"}${(x * 100).toFixed(1)} ${(100 - Math.pow(x, e) * 100).toFixed(1)}`; }
    path.setAttribute("d", d);
  };
  const drag = (ev) => {
    const b = svg.getBoundingClientRect();
    const x = Math.min(0.95, Math.max(0.05, (ev.clientX - b.left) / b.width)), y = Math.min(0.95, Math.max(0.05, 1 - (ev.clientY - b.top) / b.height));
    range.value = Math.log(y) / Math.log(x);
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
  };
  svg.addEventListener("pointerdown", (ev) => { svg.setPointerCapture(ev.pointerId); drag(ev); ev.preventDefault(); });
  svg.addEventListener("pointermove", (ev) => { if (svg.hasPointerCapture(ev.pointerId)) drag(ev); });
  range.addEventListener("input", paint);
  paint();
  return { paint };
}

/* ---- reveal effects for a logo already mounted in a stage element ----
   They work from the logo's own SVG and running reveal, so any brand's logo can use them.
   Trails replay the reveal on tinted copies of the logo; call addLogoTrails before anything that wraps the logo's parts.
   Shimmer and the end pulse sit on top; call addLogoGlints after. Options use the same names in both. */
const LOGO_SVG_NS = "http://www.w3.org/2000/svg";
const logoFxGroup = (svg) => svg.querySelector("g.kl-fx, g.sr-fx") || svg;
const logoRevealEnd = (anims) => anims.reduce((m, a) => { const t = a.effect.getTiming(); return Math.max(m, t.delay + t.duration); }, 0);
const isLogoPaper = (el) => !!el.closest(".paps, .pp");
function logoTint(svg, id, color, blur) {
  svg.querySelector("defs").insertAdjacentHTML("beforeend", `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feFlood flood-color="${color}"/><feComposite in2="SourceAlpha" operator="in"/>${blur ? `<feGaussianBlur stdDeviation="${blur}"/>` : ""}</filter>`);
}
/* A copy of the logo whose reveal runs lag ms behind the original. Ids are renamed so its wipes are its own. */
function logoCopy(svg, anims, lag, suffix) {
  const copy = svg.cloneNode(true), from = [svg, ...svg.querySelectorAll("*")], to = [copy, ...copy.querySelectorAll("*")], pair = new Map(from.map((e, i) => [e, to[i]]));
  to.forEach((e) => {
    if (e.id) e.id += suffix;
    [...e.attributes].forEach((a) => { if (a.value.includes("url(#")) a.value = a.value.replace(/url\(#([^)]+)\)/g, `url(#$1${suffix})`); });
  });
  const made = anims.flatMap((a) => {
    const target = pair.get(a.effect.target);
    if (!target) return [];
    const t = a.effect.getTiming(), kf = a.effect.getKeyframes().map(({ computedOffset, composite, ...k }) => k);
    return [target.animate(kf, { duration: t.duration, delay: t.delay + lag, easing: t.easing, fill: "both", iterations: t.iterations })];
  });
  const fx = logoFxGroup(copy);
  fx.removeAttribute("filter");                       // the copies carry a tint instead of the CRT glow, which keeps them light
  copy.querySelectorAll(".paps, .pp").forEach((e) => e.remove());
  return { copy, made };
}
let logoFxId = 0;
function addLogoTrails(stage, o) {
  if (!o.introTrail && !o.trail) return;
  const svg = stage.querySelector("svg");
  if (!svg) return;
  const main = stage.getAnimations({ subtree: true }).filter((a) => svg.contains(a.effect.target));
  const parts = svg.querySelectorAll("path").length, wanted = (n) => (parts > 90 ? Math.min(n, 3) : parts > 45 ? Math.min(n, 4) : n);
  const scale = Math.min(stage.clientWidth, stage.clientHeight) / 800 || 1;
  const host = svg.closest("div") || stage;
  host.style.position = "relative"; host.style.zIndex = 1;
  const layer = (i, n, lag, blur, dx, dy) => {
    const uid = "lf" + ++logoFxId, color = o.rainbow ? `hsl(${Math.round(((i - 1) / Math.max(1, n - 1)) * 300)} 100% 60%)` : "#ffffff";
    logoTint(svg, uid, color, blur);
    const box = document.createElement("div");
    box.style.cssText = `position:absolute;inset:0;pointer-events:none;filter:url(#${uid});transform:translate(${dx}px,${dy}px)`;
    const { copy } = logoCopy(svg, main, lag, "-" + uid);
    box.appendChild(copy);
    stage.insertBefore(box, stage.firstChild);
    return box;
  };
  if (o.trail) {
    const n = wanted(o.trailN), end = logoRevealEnd(main), a = (o.trailAngle || 0) * Math.PI / 180;
    for (let i = n; i >= 1; i--) {
      const box = layer(i, n, i * 70, (0.4 + i * 0.22) * scale, Math.cos(a) * o.trailLen * i * scale, Math.sin(a) * o.trailLen * i * scale);
      box.animate([{ opacity: 1 - (i - 1) / n * 0.5 }, { opacity: 0 }], { duration: o.trailDecay * 1000, delay: end * 0.5, easing: "cubic-bezier(.2,.6,.4,1)", fill: "both" });
    }
  }
  if (o.introTrail) {
    const n = wanted(o.ptN), lag = o.ptLag;
    main.forEach((a) => { const t = a.effect.getTiming(); a.effect.updateTiming({ delay: t.delay + n * lag }); });
    const end = logoRevealEnd(main);
    for (let i = n; i >= 1; i--) {
      const box = layer(i, n, (n - i) * lag - n * lag, 0, 0, 0);
      box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, delay: end, easing: "linear", fill: "both" });
    }
  }
}
function addLogoGlints(stage, o) {
  if (!o.shimmer && !o.pulse) return;
  const svg = stage.querySelector("svg");
  if (!svg) return;
  const fx = logoFxGroup(svg), defs = svg.querySelector("defs"), vb = svg.viewBox.baseVal, W = vb.width, H = vb.height;
  const end = logoRevealEnd(stage.getAnimations({ subtree: true }).filter((a) => svg.contains(a.effect.target)));
  const shapes = [...fx.querySelectorAll("path")].filter((p) => p.getAttribute("d"));
  const uid = "lg" + ++logoFxId;
  if (o.pulse) {
    const a = o.pulseAmt, g = document.createElementNS(LOGO_SVG_NS, "g");
    defs.insertAdjacentHTML("beforeend", `<filter id="${uid}p" filterUnits="userSpaceOnUse" x="${vb.x - W * 0.3}" y="${vb.y - H * 0.5}" width="${W * 1.6}" height="${H * 2}" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${W * 0.008 * a}" result="n"/><feGaussianBlur in="SourceGraphic" stdDeviation="${W * 0.04 * a}" result="w"/><feMerge result="m"><feMergeNode in="w"/><feMergeNode in="w"/><feMergeNode in="n"/><feMergeNode in="n"/></feMerge>${o.pulseWhite ? '<feFlood flood-color="#fff" result="f"/><feComposite in="f" in2="m" operator="in"/>' : ""}</filter>`);
    g.setAttribute("filter", `url(#${uid}p)`);
    g.style.pointerEvents = "none";
    shapes.forEach((p) => { if (isLogoPaper(p)) return; const c = document.createElementNS(LOGO_SVG_NS, "path"); c.setAttribute("d", p.getAttribute("d")); c.setAttribute("fill", getComputedStyle(p).fill); c.setAttribute("fill-rule", getComputedStyle(p).fillRule); g.appendChild(c); });
    fx.appendChild(g);
    g.animate([{ opacity: 0, easing: "cubic-bezier(.3,0,.5,1)" }, { opacity: 1, offset: 0.28, easing: "cubic-bezier(.3,.6,.4,1)" }, { opacity: 0 }], { duration: o.pulseTime * 1000, delay: Math.max(0, end - o.pulseTime * 280), fill: "both" });
  }
  if (o.shimmer) {
    const C = o.rainbow ? ["#ff2d55", "#ff9500", "#ffe14d", "#ffffff", "#4cd964", "#2fb4ff", "#a855f7"] : ["#ffffff", "#ffffff", "#ffffff"], n = C.length, band = W * 0.75;
    const stops = `<stop offset="0" stop-color="${C[0]}" stop-opacity="0"/>` + C.map((c, i) => `<stop offset="${(0.12 + (0.76 * i) / (n - 1)).toFixed(3)}" stop-color="${c}"/>`).join("") + `<stop offset="1" stop-color="${C[n - 1]}" stop-opacity="0"/>`;
    const mask = document.createElementNS(LOGO_SVG_NS, "mask");
    mask.id = uid + "m"; mask.setAttribute("maskUnits", "userSpaceOnUse");
    const box = { x: vb.x - W, y: vb.y - H, width: W * 3, height: H * 3 };
    Object.entries(box).forEach(([k, v]) => mask.setAttribute(k, v));
    mask.innerHTML = `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="#000"/>`;
    shapes.forEach((p) => { const c = document.createElementNS(LOGO_SVG_NS, "path"); c.setAttribute("d", p.getAttribute("d")); c.setAttribute("fill", isLogoPaper(p) ? "#000" : "#fff"); c.setAttribute("fill-rule", getComputedStyle(p).fillRule); mask.appendChild(c); });
    defs.appendChild(mask);
    defs.insertAdjacentHTML("beforeend", `<linearGradient id="${uid}g">${stops}</linearGradient><filter id="${uid}b" filterUnits="userSpaceOnUse" x="${vb.x - W * 0.2}" y="${vb.y - H * 0.5}" width="${W * 1.4}" height="${H * 2}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${W * 0.018}"/></filter><filter id="${uid}w" filterUnits="userSpaceOnUse" x="${vb.x - W * 0.3}" y="${vb.y - H * 0.8}" width="${W * 1.6}" height="${H * 2.6}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${W * 0.045}"/></filter>`);
    const cx = vb.x + W / 2, cy = vb.y + H / 2;
    const rect = () => `<g transform="rotate(14 ${cx} ${cy})"><rect class="lgsr" x="${vb.x - band}" y="${vb.y - H}" width="${band}" height="${H * 3}" fill="url(#${uid}g)"/></g>`;
    fx.insertAdjacentHTML("beforeend", `<g class="lgshim" style="pointer-events:none" opacity="${o.shimAmt}">${o.rainbow ? "" : `<g filter="url(#${uid}w)"><g mask="url(#${uid}m)">${rect()}</g></g>`}<g filter="url(#${uid}b)"><g mask="url(#${uid}m)">${rect()}</g></g><g mask="url(#${uid}m)">${rect()}</g></g>`);
    /* the band starts and ends clear of the logo and waits there, so a repeat never pops on or off over the artwork */
    const dur = 1500, every = o.shimOnce ? dur : Math.max(dur + 200, o.shimEvery * 1000), reach = (Math.hypot(W, H) / 2) * Math.tan((14 * Math.PI) / 180) + W * 0.1, ease = "cubic-bezier(.45,0,.55,1)";
    fx.querySelectorAll(".lgsr").forEach((r) => r.animate([{ transform: `translateX(${-reach}px)`, easing: ease }, { transform: `translateX(${W + band + reach}px)`, offset: dur / every }, { transform: `translateX(${W + band + reach}px)` }], { duration: every, delay: end * o.shimAt, iterations: o.shimOnce ? 1 : Infinity, fill: "both" }));
  }
}

/* ---- frame clock ----
   Plays every animation under root at a chosen frame rate by pausing it and moving its time by hand, one step per frame.
   0 hands them back to the browser's own rate. setHold freezes the clock for a pause. */
function createFrameClock(root) {
  let fps = 0, hold = false, raf = 0, last = 0, due = 0;
  const owned = new Set();
  const release = () => { owned.forEach((a) => { if (a.playState === "paused") a.play(); }); owned.clear(); };
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (hold) { last = now; due = now; return; }
    if (now < due) return;
    due = Math.max(now, due + 1000 / fps);
    const dt = last ? now - last : 0;
    last = now;
    owned.forEach((a) => { if (a.playState === "idle") owned.delete(a); });
    root.getAnimations({ subtree: true }).forEach((a) => {
      if (a.playState === "running") { a.pause(); owned.add(a); }
      if (!owned.has(a)) return;
      const t = (a.currentTime || 0) + dt * a.playbackRate;
      if (t >= a.effect.getComputedTiming().endTime) { a.finish(); owned.delete(a); } else a.currentTime = t;
    });
  }
  return {
    set(n) {
      if (n === fps) return;
      fps = n;
      cancelAnimationFrame(raf);
      last = 0; due = 0;
      if (fps) raf = requestAnimationFrame(tick); else if (!hold) release();
    },
    setHold(on) { hold = on; if (!on && !fps) release(); },
  };
}
