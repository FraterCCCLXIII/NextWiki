// magnetosphere.js — magnetosphere, solar wind, radiation belts and aurora layers (see planet-layers.js for the contract).
//
//   addMagnetosphere(THREE, group, spec, profile, ctx) -> { tick(t), dispose() } | null
//
// All geometry is in planetary radii (the model is a unit-radius group scaled to true size by the app).
// Frames:  root (ctx.poleFrame, or a child of `group` that cancels the planet's spin)  -> axis = +Y, does not spin
//            |- wind   : +X points at the Sun. Magnetopause, bow shock, field lines, plasma sheet and solar-wind particles live here
//            |- dip    : rotation.y = spin ; tilt : rotation.z = dipole tilt. Radiation belts and aurora live here (they turn with the planet)
// Field lines / plasma sheet are generated as plain dipole lines in the dipole frame and deformed in the vertex shader (day-side
// compression, night-side stretch into the tail, confinement inside the magnetopause) so a storm reshapes them for free.
import { layers } from './layers.js';

const GLSL_COMMON = /* glsl */`
uniform float uTime, uR0, uAlpha, uTail, uStorm;
uniform mat3 uM;
float th(float x) { float e = exp(-2.0 * clamp(x, -12.0, 12.0)); return (1.0 - e) / (1.0 + e); }
float soft(float r, float lim) { float a = 0.5 * lim; return r < a ? r : a + (lim - a) * th((r - a) / (lim - a)); }
// the dipole point p (dipole frame) in the Sun-aligned wind frame, squeezed on the day side, stretched into the tail on the night side
vec3 deform(vec3 p, float L, out float T, out float n) {
  vec3 q = uM * p; float r = max(length(q), 1e-4); float cg = q.x / r;
  float rm = uR0 * pow(2.0 / (1.0 + max(cg, -0.93)), uAlpha);
  q *= soft(r, 0.9 * rm) / r;
  n = smoothstep(0.15, -0.45, cg);
  T = clamp((L - 0.35 * uR0) / (0.65 * uR0), 0.0, 1.0);
  q.x *= 1.0 + n * T * T * max(0.0, 0.85 * uTail / max(L, 1.0) - 1.0);
  q.yz *= 1.0 + n * T * 1.4;
  float rc = max(length(q.yz), 1e-4), lt = 0.92 * (1.5 * uR0 + 0.13 * max(-q.x, 0.0));
  q.yz *= mix(1.0, soft(rc, lt) / rc, n);
  return q;
}`;

const LINE_VS = /* glsl */`${GLSL_COMMON}
attribute float aLr, aPhi, aT, aS;
varying float vT, vN, vS, vX;
void main() {
  float L = 1.25 * pow(max(1.6 * uR0 / 1.25, 1.0001), aLr);
  float lm = acos(sqrt(1.0 / L)), lam = aT * lm;
  float r = L * cos(lam) * cos(lam);
  vec3 p = r * vec3(cos(lam) * cos(aPhi), sin(lam), cos(lam) * sin(aPhi));
  float T, n; vec3 q = deform(p, L, T, n);
  vT = T; vN = n; vS = aS; vX = q.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
}`;
const LINE_FS = /* glsl */`
uniform float uTime, uTail, uR0, uAmt;
varying float vT, vN, vS, vX;
void main() {
  vec3 warm = vec3(1.0, 0.62, 0.22), cyan = vec3(0.35, 0.78, 1.0), blue = vec3(0.25, 0.45, 1.0);
  vec3 c = mix(warm, mix(cyan, blue, smoothstep(0.55, 1.0, vT)), smoothstep(0.12, 0.5, vT));
  float dash = 0.45 + 0.55 * smoothstep(0.2, 0.9, fract(vS * 9.0 - uTime * 0.35));
  float fade = 1.0 - smoothstep(0.6, 1.0, max(-vX, 0.0) / uTail);
  gl_FragColor = vec4(c, uAmt * dash * fade);
}`;

const SHEET_VS = /* glsl */`${GLSL_COMMON}
attribute float aLr, aPhi;
varying float vN, vFade, vR;
void main() {
  float L = 0.3 * uR0 + aLr * 0.75 * uR0; L = max(L, 1.3);
  vec3 p = L * vec3(cos(aPhi), 0.0, sin(aPhi));
  float T, n; vec3 q = deform(p, L, T, n);
  vN = n; vR = aLr; vFade = (1.0 - smoothstep(0.55, 1.0, max(-q.x, 0.0) / uTail)) * smoothstep(0.0, 0.25, T + 0.03);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
}`;
const SHEET_FS = /* glsl */`
uniform float uTime, uAmt;
varying float vN, vFade, vR;
void main() {
  float a = pow(vN, 1.3) * vFade * (0.55 + 0.45 * sin(vR * 18.0 - uTime * 1.2));
  gl_FragColor = vec4(vec3(1.0, 0.55, 0.16), uAmt * a);
}`;

// Shue-type boundary r = r0 (2/(1+cos g))^alpha, g = 0 at the Sun line, cut at g = gmax and faded toward the cap
const SHELL_VS = /* glsl */`
uniform float uRr, uAlpha, uGmax;
attribute float aU, aV;
varying vec3 vN; varying vec3 vV; varying float vU; varying float vP;
vec3 pos(float u, float v) { float g = u * uGmax, c = cos(g), r = uRr * pow(2.0 / (1.0 + c), uAlpha); return vec3(r * c, r * sin(g) * cos(v), r * sin(g) * sin(v)); }
void main() {
  vec3 p = pos(aU, aV);
  float uu = clamp(aU, 0.012, 0.995);
  vec3 du = pos(uu + 0.005, aV) - pos(uu - 0.005, aV), dv = pos(uu, aV + 0.01) - pos(uu, aV - 0.01);
  vN = normalMatrix * normalize(cross(du, dv));
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vV = -mv.xyz; vU = aU; vP = aU * 40.0 + aV * 2.0;
  gl_Position = projectionMatrix * mv;
}`;
const SHELL_FS = /* glsl */`
uniform vec3 uColor; uniform float uAmt, uTime, uBase;
varying vec3 vN; varying vec3 vV; varying float vU; varying float vP;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float rim = pow(1.0 - abs(dot(n, v)), 2.2);
  float shim = 0.82 + 0.18 * sin(vP - uTime * 1.6) * sin(vP * 0.37 + uTime * 0.8);
  float a = uAmt * (uBase + 0.7 * rim) * shim * (1.0 - smoothstep(0.45, 1.0, vU));
  gl_FragColor = vec4(uColor * (0.8 + 0.6 * rim), a);
}`;

const PART_VS = /* glsl */`
uniform float uSz, uProj;
attribute float aMix;
varying float vMix;
void main() {
  vMix = aMix;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(uSz * uProj / max(-mv.z, 1e-6), 1.8, 8.0);
  gl_Position = projectionMatrix * mv;
}`;
const PART_FS = /* glsl */`
uniform float uAmt;
varying float vMix;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
  vec3 c = mix(vec3(0.95, 0.9, 0.62), vec3(1.0, 0.5, 0.2), vMix);
  gl_FragColor = vec4(c, uAmt * (1.0 - r * r) * mix(0.55, 1.0, vMix));
}`;

const BELT_VS = /* glsl */`
uniform float uMajor, uRad, uVert;
attribute float aU, aV;
varying vec3 vN; varying vec3 vV; varying float vA; varying float vB;
void main() {
  float cu = cos(aU), su = sin(aU), cv = cos(aV), sv = sin(aV);
  vec3 p = vec3((uMajor + uRad * cv) * cu, uVert * sv, (uMajor + uRad * cv) * su);
  vec2 e = normalize(vec2(cv / uRad, sv / uVert));
  vN = normalMatrix * vec3(e.x * cu, e.y, e.x * su);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vV = -mv.xyz; vA = aU; vB = aV;
  gl_Position = projectionMatrix * mv;
}`;
const BELT_FS = /* glsl */`
uniform vec3 uColor; uniform float uAmt, uTime;
varying vec3 vN; varying vec3 vV; varying float vA; varying float vB;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float f = abs(dot(n, v));
  float rim = pow(1.0 - f, 1.5), core = pow(f, 3.0);
  float swirl = 0.8 + 0.2 * sin(vA * 7.0 + vB * 2.0 - uTime * 0.9);
  float a = uAmt * (0.1 * core + 0.55 * rim) * swirl * (0.55 + 0.45 * cos(vB));
  gl_FragColor = vec4(uColor, a);
}`;

const AUR_VS = /* glsl */`
varying vec3 vL; varying vec3 vN; varying vec3 vV;
void main() {
  vL = position; vN = normalMatrix * normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const AUR_FS = /* glsl */`
uniform vec3 uC1, uC2, uOff, uLight; uniform float uOval, uExpand, uStorm, uTime, uAmt;
varying vec3 vL; varying vec3 vN; varying vec3 vV;
void main() {
  vec3 pd = vL - uOff;
  float am = abs(degrees(asin(clamp(pd.y / length(pd), -1.0, 1.0))));
  float c = uOval - uExpand, w = 2.6 + 2.6 * uStorm;
  float x = (am - c) / w;
  float ring = exp(-x * x) + 0.18 * exp(0.5 * min(x, 0.0)) * step(x, 0.0);   // sharp poleward edge, soft equatorward skirt
  float lon = atan(pd.z, pd.x);
  float cur = (0.55 + 0.45 * sin(lon * 9.0 + uTime * 0.55 + 2.0 * sin(lon * 3.0 - uTime * 0.3))) * (0.6 + 0.4 * sin(lon * 31.0 - uTime * 1.7 + am * 0.7));
  vec3 n = normalize(vN), v = normalize(vV);
  float night = smoothstep(0.3, -0.3, dot(n, uLight));
  float view = 1.0 + 1.6 * pow(1.0 - abs(dot(n, v)), 2.0);
  float I = ring * cur * (0.12 + 0.88 * night) * view * uAmt * (0.7 + 1.3 * uStorm);
  vec3 col = mix(uC1, uC2, smoothstep(0.0, 1.0, x * 0.5 + 0.5));
  gl_FragColor = vec4(col * I, I);
}`;

export function addMagnetosphere(THREE, group, spec, profile, ctx) {
  const mag = profile && profile.mag; if (!mag) return null;
  const st = layers.state, DEG = Math.PI / 180;
  const tilt = (mag.tilt || 0) * DEG, offset = mag.offset || 0;
  const things = [];                                   // geometries / materials to dispose
  const track = o => (things.push(o), o);

  // ---- frames -------------------------------------------------------------------------------------------------------------------
  const pole = ctx.poleFrame || null;
  const root = pole || track(new THREE.Group());
  if (!pole) group.add(root);
  const wind = new THREE.Group(), dip = new THREE.Group(), tiltG = new THREE.Group();
  root.add(wind, dip); dip.add(tiltG); tiltG.rotation.z = tilt;
  tiltG.position.set(offset * 0.5, 0, 0);               // offset dipole (Uranus / Neptune), turns with the planet
  wind.visible = dip.visible = false;

  // ---- shared uniforms ----------------------------------------------------------------------------------------------------------
  const U = {
    uTime: { value: 0 }, uR0: { value: 10 }, uAlpha: { value: 0.58 }, uTail: { value: 80 }, uStorm: { value: 0 }, uM: { value: new THREE.Matrix3() },
  };
  const mat = (vs, fs, extra, o = {}) => track(new THREE.ShaderMaterial({
    vertexShader: vs, fragmentShader: fs, uniforms: { ...U, ...extra }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...o,
  }));
  const addMesh = (parent, obj, order) => { obj.frustumCulled = false; obj.renderOrder = order; parent.add(obj); return obj; };
  const grid = (nu, nv, uMax = 1, vMax = Math.PI * 2) => {
    const g = track(new THREE.BufferGeometry()), aU = [], aV = [], idx = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { aU.push(i / nu * uMax); aV.push(j / nv * vMax); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(aU.length * 3), 3));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1)); g.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1)); g.setIndex(idx);
    return g;
  };

  // ---- lazily built pieces ------------------------------------------------------------------------------------------------------
  const P = { mp: null, bow: null, lines: null, sheet: null, wind: null, belts: null, aurora: null };

  function buildField() {
    const gmax = 162 * DEG, bmax = 150 * DEG;
    const mpM = mat(SHELL_VS, SHELL_FS, { uRr: { value: 1 }, uGmax: { value: gmax }, uColor: { value: new THREE.Color(0.35, 0.7, 1.0) }, uAmt: { value: 1 }, uBase: { value: 0.045 } });
    const bowM = mat(SHELL_VS, SHELL_FS, { uRr: { value: 1.3 }, uGmax: { value: bmax }, uColor: { value: new THREE.Color(0.75, 0.6, 1.0) }, uAmt: { value: 0.8 }, uBase: { value: 0.03 }, uAlpha: { value: 0.75 } });
    const gShell = grid(56, 72);
    P.mp = addMesh(wind, new THREE.Mesh(gShell, mpM), 6); P.bow = addMesh(wind, new THREE.Mesh(gShell, bowM), 5);
    // field lines: nL log-spaced shells x nPhi meridians, each a closed dipole loop pole to pole
    const nL = 9, nP = 10, nS = 44, pos = [], aLr = [], aPhi = [], aT = [], aS = [];
    for (let l = 0; l < nL; l++) for (let p = 0; p < nP; p++) for (let s = 0; s < nS; s++) for (const k of [s, s + 1]) {
      const t = k / nS * 2 - 1; pos.push(0, 0, 0); aLr.push(l / (nL - 1)); aPhi.push((p + (l % 2) * 0.5) / nP * Math.PI * 2); aT.push(t); aS.push(k / nS);
    }
    const lg = track(new THREE.BufferGeometry());
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('aLr', new THREE.Float32BufferAttribute(aLr, 1));
    lg.setAttribute('aPhi', new THREE.Float32BufferAttribute(aPhi, 1)); lg.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); lg.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
    P.lines = addMesh(wind, new THREE.LineSegments(lg, mat(LINE_VS, LINE_FS, { uAmt: { value: 0.4 } })), 4);
    // plasma sheet: the dipole equatorial plane run through the same deformation
    const sg = track(new THREE.BufferGeometry()), nl = 28, np = 72, sp = [], sl = [], sa = [], si = [];
    for (let i = 0; i <= nl; i++) for (let j = 0; j <= np; j++) { sp.push(0, 0, 0); sl.push(i / nl); sa.push(j / np * Math.PI * 2); }
    for (let i = 0; i < nl; i++) for (let j = 0; j < np; j++) { const a = i * (np + 1) + j, b = a + np + 1; si.push(a, b, a + 1, b, b + 1, a + 1); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('aLr', new THREE.Float32BufferAttribute(sl, 1)); sg.setAttribute('aPhi', new THREE.Float32BufferAttribute(sa, 1)); sg.setIndex(si);
    P.sheet = addMesh(wind, new THREE.Mesh(sg, mat(SHEET_VS, SHEET_FS, { uAmt: { value: 0.16 } })), 3);
  }

  const N = 3600;
  let pPos, pMix, pAttr;
  const proj = { value: 800 }, V2 = new THREE.Vector2();
  function buildWind() {
    pPos = new Float32Array(N * 3); pMix = new Float32Array(N);
    const g = track(new THREE.BufferGeometry());
    pAttr = new THREE.Float32BufferAttribute(pPos, 3); pAttr.setUsage(THREE.DynamicDrawUsage);
    const mAttr = new THREE.Float32BufferAttribute(pMix, 1); mAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', pAttr); g.setAttribute('aMix', mAttr); pPos = pAttr.array; pMix = mAttr.array;
    P.wind = addMesh(wind, new THREE.Points(g, mat(PART_VS, PART_FS, { uSz: { value: 0.1 }, uProj: proj, uAmt: { value: 0.8 } })), 7);
    P.wind.onBeforeRender = (r, s, cam) => { r.getDrawingBufferSize(V2); proj.value = Math.abs(cam.projectionMatrix.elements[5]) * V2.y * 0.5; };
    for (let i = 0; i < N; i++) spawn(i, true);
  }
  function spawn(i, anywhere) {
    const r0 = r0s, rad = 4 * r0 * Math.sqrt(Math.random()), a = Math.random() * 6.2832;
    pPos[i * 3] = anywhere ? (Math.random() * 13.5 - 9) * r0 : (4.5 + Math.random() * 0.6) * r0;
    pPos[i * 3 + 1] = rad * Math.cos(a); pPos[i * 3 + 2] = rad * Math.sin(a); pMix[i] = 0;
  }
  function stepWind(dt, w, alpha) {
    const r0 = r0s, U0 = 2.2 * r0 * (w.speed / 400), a = 1.5 * r0, cx = -0.5 * r0, a3 = a * a * a;
    const lim2 = (5 * r0) * (5 * r0);
    for (let i = 0; i < N; i++) {
      let x = pPos[i * 3], y = pPos[i * 3 + 1], z = pPos[i * 3 + 2];
      const r = Math.hypot(x, y, z) || 1e-6, cg = x / r;
      const rmp = r0 * Math.pow(2 / (1 + Math.max(cg, -0.93)), alpha), rbs = 1.3 * r0 * Math.pow(2 / (1 + Math.max(cg, -0.9)), 0.75);
      const rx = x - cx, rr = Math.max(Math.hypot(rx, y, z), a * 0.9) || 1e-6, f = a3 / (2 * rr * rr * rr), inv2 = U0 / (rr * rr);
      const sx = -U0 + f * (-U0 + 3 * rx * rx * inv2), sy = f * 3 * rx * y * inv2, sz = f * 3 * rx * z * inv2;
      let s = (r / rbs - 0.9) * 10; s = s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s);   // 0 = shocked sheath, 1 = free stream
      const k = 0.55 * (1 - s);
      x += (sx * k - U0 * s) * dt; y += (sy * k) * dt; z += (sz * k) * dt;
      const r2 = Math.hypot(x, y, z) || 1e-6, rm2 = rmp * 1.03;
      if (r2 < rm2) { const q = rm2 / r2; x *= q; y *= q; z *= q; }
      pMix[i] = 1 - s;
      if (x < -9.5 * r0 || y * y + z * z > lim2 || x !== x) spawn(i, false);
      else { pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; }
    }
    pAttr.needsUpdate = true; P.wind.geometry.attributes.aMix.needsUpdate = true;
  }

  const beltGeo = () => grid(96, 28, Math.PI * 2, Math.PI * 2);
  function buildBelts() {
    const g = beltGeo(), b = mag.belts, mk = (range, color, amt) => {
      const [l1, l2] = range, M = (l1 + l2) / 2, m = mat(BELT_VS, BELT_FS, { uMajor: { value: M }, uRad: { value: (l2 - l1) / 2 }, uVert: { value: 0.36 * l2 }, uColor: { value: new THREE.Color(...color) }, uAmt: { value: amt } });
      const mesh = addMesh(tiltG, new THREE.Mesh(g, m), 8); mesh.userData = { M, rad: (l2 - l1) / 2, vert: 0.36 * l2, l2 }; return mesh;
    };
    P.belts = { inner: mk(b.inner, [1.0, 0.5, 0.18], 0.4), outer: mk(b.outer, [0.95, 0.22, 0.2], 0.35) };
  }

  const _qf = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _qz = new THREE.Quaternion();
  const _sun = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _ax = new THREE.Vector3(0, 1, 0), _az = new THREE.Vector3(0, 0, 1);

  function buildAurora() {
    const a = mag.aurora, m = mat(AUR_VS, AUR_FS, {
      uC1: { value: new THREE.Color(...a.color) }, uC2: { value: new THREE.Color(...(a.color2 || a.color)) }, uOff: { value: new THREE.Vector3(-offset * 0.5, 0, 0).multiplyScalar(1.0) },
      uLight: { value: ctx.lightView || new THREE.Vector3(0, 0, 1) }, uOval: { value: a.oval }, uExpand: { value: 0 }, uAmt: { value: 1.7 },
    }, { side: THREE.FrontSide });
    // the aurora shell is a planet-centred sphere: it lives under `dip` (spin) but not under the tilt/offset node; the shader works in tilt coordinates
    P.aurora = new THREE.Mesh(ctx.sphere(112), m); P.aurora.scale.setScalar(1.012); P.aurora.frustumCulled = false; P.aurora.renderOrder = 9;
    tiltG.add(P.aurora); P.aurora.position.set(-offset * 0.5, 0, 0);   // cancels the tilt node's offset so the shell stays centred on the planet
    P.aurora.material.uniforms.uOff.value.set(-offset * 0.5, 0, 0);
  }

  // ---- per-frame ----------------------------------------------------------------------------------------------------------------
  let r0s = 0, last = performance.now(), wasAny = false, stormS = 0;
  const hideAll = () => { wind.visible = dip.visible = false; };

  function tick() {
    const now = performance.now(), dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000)); last = now;
    const mOn = !!st.magnetosphere, wOn = !!st.wind, bOn = !!(st.belts && mag.belts), aOn = !!(st.aurora && mag.aurora);
    if (!(mOn || wOn || bOn || aOn)) { if (wasAny) { hideAll(); wasAny = false; } return; }
    wasAny = true;
    for (let o = root; o; o = o.parent) if (!o.visible) return;   // an ancestor is hidden by the app (wrong zoom level): nothing to draw or simulate
    if (!pole) root.rotation.y = -group.rotation.y;

    const dAU = ctx.helioAU(), w = layers.now(dAU, now);
    const r0 = layers.standoff(mag.Beq, dAU, now);
    r0s = r0s ? r0s + (r0 - r0s) * (1 - Math.exp(-dt / 0.7)) : r0;
    stormS += (w.storm - stormS) * (1 - Math.exp(-dt / 0.5));

    // Sun-aligned wind frame in the field frame
    root.getWorldQuaternion(_qf).invert();
    const ld = ctx.lightDir; _sun.copy(ld || _z.set(1, 0, 0)).applyQuaternion(_qf).normalize();
    _x.copy(_sun); _y.copy(_ax).addScaledVector(_x, -_ax.dot(_x)); if (_y.lengthSq() < 1e-4) _y.copy(_az).addScaledVector(_x, -_az.dot(_x));
    _y.normalize(); _z.crossVectors(_x, _y);
    _qw.setFromRotationMatrix(_m4.makeBasis(_x, _y, _z)); wind.quaternion.copy(_qw);
    const spin = ctx.spin(); dip.rotation.y = spin;
    _qy.setFromAxisAngle(_ax, spin); _qz.setFromAxisAngle(_az, tilt); _qd.copy(_qy).multiply(_qz);
    U.uM.value.setFromMatrix4(_m4.makeRotationFromQuaternion(_qw.clone().invert().multiply(_qd)));

    const alpha = 0.58 + 0.05 * stormS;
    U.uTime.value = (now / 1000) % 3600; U.uR0.value = r0s; U.uAlpha.value = alpha; U.uTail.value = 8 * r0s * (1 + 0.2 * stormS); U.uStorm.value = stormS;

    if (mOn && !P.mp) buildField();
    if (wOn && !P.wind) buildWind();
    if (bOn && !P.belts) buildBelts();
    if (aOn && !P.aurora) buildAurora();

    wind.visible = mOn || wOn;
    if (P.mp) {
      P.mp.visible = P.bow.visible = P.lines.visible = P.sheet.visible = mOn;
      if (mOn) {
        P.mp.material.uniforms.uRr.value = r0s; P.mp.material.uniforms.uAmt.value = 1 + 0.5 * stormS;
        P.bow.material.uniforms.uRr.value = 1.3 * r0s; P.bow.material.uniforms.uAmt.value = 0.8 + 0.4 * stormS;
        P.mp.material.uniforms.uAlpha.value = alpha;
      }
    }
    if (P.wind) {
      P.wind.visible = wOn;
      if (wOn) {
        const dn = Math.log2(1 + w.density / 3);
        P.wind.material.uniforms.uAmt.value = Math.min(1, 0.3 + 0.2 * dn); P.wind.material.uniforms.uSz.value = 0.05 * r0s;
        P.wind.geometry.setDrawRange(0, Math.floor(N * Math.min(1, 0.45 + 0.12 * dn)));
        stepWind(dt, w, alpha);
      }
    }
    dip.visible = bOn || aOn;
    if (P.belts) {
      P.belts.inner.visible = P.belts.outer.visible = bOn;
      if (bOn) {
        const o = P.belts.outer, i = P.belts.inner, f = Math.min(1, 0.72 * r0s / o.userData.l2) * (1 - 0.22 * stormS);
        o.scale.set(f, 1 - 0.1 * stormS, f); o.material.uniforms.uAmt.value = 0.35 + 0.5 * stormS;
        i.scale.setScalar(Math.min(1, 0.6 * r0s / i.userData.l2)); i.material.uniforms.uAmt.value = 0.4 + 0.1 * stormS;
        for (const b of [o, i]) b.material.uniforms.uTime.value = U.uTime.value;
      }
    }
    if (P.aurora) {
      P.aurora.visible = aOn;
      if (aOn) {
        const u = P.aurora.material.uniforms, press = Math.max(0, Math.min(1.5, Math.log10(w.pdyn / 1.5e-9 + 1e-3)));
        u.uStorm.value = stormS; u.uTime.value = U.uTime.value; u.uExpand.value = 9 * stormS + 2.2 * press;
      }
    }
  }

  return {
    tick,
    dispose() {
      for (const o of things) { try { o.dispose && o.dispose(); } catch { /* ignore */ } }
      for (const o of [wind, dip]) { root.remove(o); }
      if (!pole && root.parent) root.parent.remove(root);
    },
  };
}
