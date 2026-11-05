#!/usr/bin/env python3
"""Build traced-v2-clean.html: regularised vector logos derived from the same source pixels as trace.py.

    venv/bin/pip install pillow numpy scipy potracer scikit-image
    venv/bin/python clean.py [--only 49,50] [--report refs/.clean-report.json]

Sheets and colour segmentation come from trace.py (edit SHEETS there). traced-v1.html is the page
template and is only read. For each logo:
  coloured shapes  -> lines + circular arcs, then regularised (shared angles, shared edges, even
                      band spacing, one centre for concentric arcs)
  black non-letter -> lines + Beziers, same line regularisation
  letters          -> lines + a few Beziers, word-level snapping of tops/bottoms, H lines and stems
  gradients        -> SVG linearGradient per shape; colour map only if that reads badly
Each shape is checked against its source mask (IoU) and falls back to a looser fit if it drifts.
"""
import argparse, colorsys, json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage.measure import find_contours
import trace as T

HERE = os.path.dirname(os.path.abspath(__file__))
GRAD = set(T.GRADIENT) | {'61'}      # shapes get a per-shape linear gradient
KEEP_MAP_DE = 13                     # mean colour error above which a logo keeps the sampled colour map
TOL_LETTER = .42                     # px in source units
TOL_GEOM = .62
DS = .25                             # contour resample step, px

# ---------- contour ----------
def resample(p, ds=DS):
    q = np.vstack([p, p[:1]]); seg = np.hypot(*np.diff(q, axis=0).T); L = np.r_[0, np.cumsum(seg)]
    if L[-1] < ds * 6:
        return p
    n = int(L[-1] / ds); s = np.linspace(0, L[-1], n, endpoint=False)
    return np.c_[np.interp(s, L, q[:, 0]), np.interp(s, L, q[:, 1])]

def contours(mask, ox, oy, U):
    sig = max(.3 * U, .9)
    f = ndi.gaussian_filter(np.pad(mask.astype(float), 6), sig)
    loops = []
    for c in find_contours(f, .5):
        if np.hypot(*(c[0] - c[-1])) > 1e-6 or len(c) < 8:
            continue
        p = np.c_[(c[:-1, 1] - 6 + .5) / U + ox, (c[:-1, 0] - 6 + .5) / U + oy]
        area = .5 * abs(np.dot(p[:, 0], np.roll(p[:, 1], 1)) - np.dot(p[:, 1], np.roll(p[:, 0], 1)))
        if area < 1.5:
            continue
        p = resample(p)
        p = np.c_[ndi.gaussian_filter1d(p[:, 0], 1.2, mode='wrap'), ndi.gaussian_filter1d(p[:, 1], 1.2, mode='wrap')]
        loops.append(p)
    return loops

def corners(p, k=7, thr=30):
    n = len(p)
    if n < 2 * k + 2:
        return []
    a = p - np.roll(p, k, 0); b = np.roll(p, -k, 0) - p
    ang = np.degrees(np.abs(np.arctan2(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0], (a * b).sum(1))))
    out = []
    for i in np.argsort(-ang):
        if ang[i] < thr:
            break
        if all(min(abs(i - j), n - abs(i - j)) > k for j in out):
            out.append(int(i))
    return sorted(out)

# ---------- primitive fits ----------
def tls(p):
    c = p.mean(0); u, s, vt = np.linalg.svd(p - c, full_matrices=False); d = vt[0]
    if d @ (p[-1] - p[0]) < 0:
        d = -d
    n = np.array([-d[1], d[0]])
    return c, d, np.abs((p - c) @ n).max()

def circle(p):
    A = np.c_[2 * p, np.ones(len(p))]; b = (p ** 2).sum(1)
    try:
        x = np.linalg.lstsq(A, b, rcond=None)[0]
    except np.linalg.LinAlgError:
        return None
    c = x[:2]; rr = x[2] + c @ c
    if rr <= 0:
        return None
    r = math.sqrt(rr)
    return c, r, np.abs(np.hypot(*(p - c).T) - r).max()

def bez_pts(b, n=16):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * b[0] + 3 * (1 - t) ** 2 * t * b[1] + 3 * (1 - t) * t ** 2 * b[2] + t ** 3 * b[3]

def fit_bez(p, t1, t2, tol, depth=0):
    """Schneider least-squares cubic; splits where the error peaks."""
    n = len(p)
    d = np.hypot(*(p[-1] - p[0]))
    if n < 3:
        return [np.array([p[0], p[0] + t1 * d / 3, p[-1] + t2 * d / 3, p[-1]])]
    u = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]; u = u / (u[-1] or 1)
    bez = None
    for it in range(4):
        b0, b1, b2, b3 = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
        A1 = t1[None] * b1[:, None]; A2 = t2[None] * b2[:, None]
        C = np.array([[(A1 * A1).sum(), (A1 * A2).sum()], [(A1 * A2).sum(), (A2 * A2).sum()]])
        tmp = p - (p[0][None] * (b0 + b1)[:, None] + p[-1][None] * (b2 + b3)[:, None])
        X = np.array([(A1 * tmp).sum(), (A2 * tmp).sum()])
        det = np.linalg.det(C)
        a1, a2 = np.linalg.solve(C, X) if abs(det) > 1e-9 else (d / 3, d / 3)
        if a1 < 1e-3 * d or a2 < 1e-3 * d:
            a1 = a2 = d / 3
        bez = np.array([p[0], p[0] + t1 * a1, p[-1] + t2 * a2, p[-1]])
        q = (1 - u)[:, None] ** 3 * bez[0] + (3 * u * (1 - u) ** 2)[:, None] * bez[1] + (3 * u * u * (1 - u))[:, None] * bez[2] + (u ** 3)[:, None] * bez[3]
        e = np.hypot(*(q - p).T); i = int(e.argmax())
        if e[i] < tol:
            return [bez]
        # Newton reparameterise
        d1 = 3 * ((1 - u) ** 2)[:, None] * (bez[1] - bez[0]) + (6 * u * (1 - u))[:, None] * (bez[2] - bez[1]) + 3 * (u ** 2)[:, None] * (bez[3] - bez[2])
        d2 = 6 * (1 - u)[:, None] * (bez[2] - 2 * bez[1] + bez[0]) + 6 * u[:, None] * (bez[3] - 2 * bez[2] + bez[1])
        num = ((q - p) * d1).sum(1); den = (d1 * d1).sum(1) + ((q - p) * d2).sum(1)
        u = np.clip(u - num / np.where(np.abs(den) < 1e-9, 1, den), 0, 1); u = np.maximum.accumulate(u); u[0] = 0; u[-1] = 1
    if depth > 7 or n < 8:
        return [bez]
    i = min(max(i, 3), n - 4)
    a = max(i - 4, 0); b = min(i + 4, n - 1)
    tc = p[a] - p[b]; tc = tc / (np.hypot(*tc) or 1)
    return fit_bez(p[:i + 1], t1, tc, tol, depth + 1) + fit_bez(p[i:], -tc, t2, tol, depth + 1)

def tangent_at(p, end, k=6):
    k = min(k, len(p) - 1)
    v = p[k] - p[0] if end == 0 else p[-1 - k] - p[-1]
    return v / (np.hypot(*v) or 1)

class L:   # line through p with unit direction d, in contour direction
    kind = 'L'
    def __init__(s, c, d, a, b): s.p, s.d, s.a, s.b = np.array(c, float), np.array(d, float), np.array(a, float), np.array(b, float)
class A:   # circular arc
    kind = 'A'
    def __init__(s, c, r, a, b, m): s.c, s.r, s.a, s.b, s.m = np.array(c, float), float(r), np.array(a, float), np.array(b, float), np.array(m, float)
class C:   # cubic
    kind = 'C'
    def __init__(s, b): s.bz = np.array(b, float)
    @property
    def a(s): return s.bz[0]
    @property
    def b(s): return s.bz[3]

def longest(p, i, fn, tol, step=4):
    n = len(p); j = i + step; best = None
    while j < n:
        f = fn(p[i:j + 1])
        if f is None or f[-1] > tol:
            break
        best = j; j += max(step, (j - i) // 3)
    if best is None:
        return i
    lo, hi = best, min(j, n - 1)
    while hi - lo > 1:
        m = (lo + hi) // 2; f = fn(p[i:m + 1])
        if f is not None and f[-1] <= tol: lo = m
        else: hi = m
    return lo

def sweep_of(q, c):
    a = np.unwrap(np.arctan2(q[:, 1] - c[1], q[:, 0] - c[0]))
    return abs(a[-1] - a[0])

def segment(q, mode, tol):
    """Split a corner-free run by curvature: truly straight stretches become lines, curved stretches become
    one circular arc (geom) or a few G1 cubics. Curves are never approximated by line segments."""
    n = len(q)
    c0, d0, dev0 = tls(q)
    if dev0 <= .33:
        return [L(c0, d0, q[0], q[-1])]
    k = 6; a = np.arange(n)
    tx = q[np.minimum(a + k, n - 1)] - q[np.maximum(a - k, 0)]
    th = np.unwrap(np.arctan2(tx[:, 1], tx[:, 0]))
    kap = ndi.gaussian_filter1d(np.gradient(th) / DS, 8, mode='nearest')
    straight = np.abs(kap) < 1 / 240.
    runs = []; i = 0; minrun = int(8 / DS)
    while i < n:
        if straight[i]:
            j = i
            while j + 1 < n and straight[j + 1]:
                j += 1
            if j - i >= minrun and tls(q[i:j + 1])[2] <= .42:
                runs.append((i, j))
            i = j + 1
        else:
            i += 1
    out = []; last = 0; prevd = None
    def curve(u, v, ta, tb):
        if v - u < 6:
            return
        seg = q[u:v + 1]
        if mode == 'geom':
            f = circle(seg)
            if f and f[2] <= tol * 1.25 and f[1] < 1500:
                out.append(A(f[0], f[1], seg[0], seg[-1], seg[len(seg) // 2])); return
        c, d, dv = tls(seg)
        if dv <= .22 and (v - u) * DS >= 6:
            out.append(L(c, d, seg[0], seg[-1])); return
        out.extend(C(z) for z in fit_bez(seg, ta if ta is not None else tangent_at(seg, 0), tb if tb is not None else tangent_at(seg, 1), max(tol, .45)))
    for (u, v) in runs:
        c, d, _ = tls(q[u:v + 1])
        curve(last, u, prevd, -d)
        out.append(L(c, d, q[u], q[v])); last = v; prevd = d
    curve(last, n - 1, prevd, None)
    return out

def fit_loop(p, mode, tol):
    cs = corners(p, thr=28 if mode == 'geom' else 33)
    n = len(p)
    if not cs:
        f = circle(p)
        if f and f[2] < max(tol * 1.4, .8):   # a whole circle
            return [A(f[0], f[1], p[0], p[n // 2], p[n // 4]), A(f[0], f[1], p[n // 2], p[0], p[3 * n // 4])], []
        # smooth outline: shared tangents at the seeds keep it G1
        seeds = sorted({int(p[:, 0].argmin()), int(p[:, 0].argmax()), int(p[:, 1].argmin()), int(p[:, 1].argmax())})
        if len(seeds) < 2:
            seeds = [0, n // 2]
        tan = {i: (lambda v: v / (np.hypot(*v) or 1))(p[(i + 6) % n] - p[(i - 6) % n]) for i in seeds}
        pcs = []
        for a, b in zip(seeds, seeds[1:] + [seeds[0] + n]):
            q = p[np.arange(a, b + 1) % n]
            pcs.extend(C(z) for z in fit_bez(q, tan[a % n], -tan[b % n], max(tol, .45)))
        return pcs, []
    pcs = []; trim = 3
    for a, b in zip(cs, cs[1:] + [cs[0] + n]):
        q = p[np.arange(a, b + 1) % n]
        if len(q) > 2 * trim + 6:
            q = q[trim:-trim]
        if len(q) >= 3:
            pcs.extend(segment(q, mode, tol))
    return pcs, []

# ---------- junctions ----------
def cross2(a, b):
    return a[0] * b[1] - a[1] * b[0]

def line_x(p1, d1, p2, d2):
    m = np.array([d1, -d2]).T
    if abs(np.linalg.det(m)) < 1e-6:
        return None
    t = np.linalg.solve(m, p2 - p1)
    return p1 + d1 * t[0]

def end_tan(pr, end):
    if pr.kind == 'L':
        return pr.d if end else -pr.d
    if pr.kind == 'C':
        v = pr.bz[3] - pr.bz[2] if end else pr.bz[0] - pr.bz[1]
        if np.hypot(*v) < 1e-6:
            v = pr.bz[3] - pr.bz[0] if end else pr.bz[0] - pr.bz[3]
        return v / np.hypot(*v)
    e = pr.b if end else pr.a
    rad = e - pr.c; t = np.array([-rad[1], rad[0]]); t = t / (np.hypot(*t) or 1)
    dirn = t if cross2(pr.a - pr.c, pr.m - pr.c) > 0 else -t
    return dirn if end else -dirn

def on_prim(pr, q):
    if pr.kind == 'L':
        return pr.p + pr.d * ((q - pr.p) @ pr.d)
    if pr.kind == 'A':
        v = q - pr.c
        return pr.c + v / (np.hypot(*v) or 1) * pr.r
    return q

def junction(a, b, corner):
    ea, sb = a.b, b.a; mid = (ea + sb) / 2
    if a.kind == 'L' and b.kind == 'L':
        x = line_x(a.p, a.d, b.p, b.d)
        if x is not None and np.hypot(*(x - mid)) < 4 and abs(a.d @ b.d) < .995:
            return x
    if corner or True:
        ta, tb = end_tan(a, 1), end_tan(b, 0)
        if abs(ta @ tb) < .985:
            x = line_x(ea, ta, sb, tb)
            if x is not None and np.hypot(*(x - mid)) < 3.2:
                return on_prim(b, on_prim(a, x)) if 'L' in (a.kind, b.kind) or a.kind == b.kind == 'A' else x
    return on_prim(b, on_prim(a, mid))

def build_d(loops):
    """prims -> SVG path + polyline for measuring."""
    d = []; polys = []
    for prims in loops:
        n = len(prims)
        if n == 0:
            continue
        v = [junction(prims[i - 1], prims[i], True) for i in range(n)]
        s = 'M%g %g' % tuple(np.round(v[0], 2)); poly = [v[0]]
        for i, pr in enumerate(prims):
            a = v[i]; b = v[(i + 1) % n]
            if pr.kind == 'L':
                ra, rb = np.round(a, 2), np.round(b, 2)
                if rb[1] == ra[1]: s += 'H%g' % rb[0]
                elif rb[0] == ra[0]: s += 'V%g' % rb[1]
                else: s += 'L%g %g' % tuple(rb)
                poly.append(b)
            elif pr.kind == 'A':
                a0 = math.atan2(*(a - pr.c)[::-1]); a1 = math.atan2(*(b - pr.c)[::-1])
                pos = cross2(pr.a - pr.c, pr.m - pr.c) > 0
                da = (a1 - a0) % (2 * math.pi) if pos else -((a0 - a1) % (2 * math.pi))
                if abs(da) < 1e-6: da = (2 * math.pi) * (1 if pos else -1)
                s += 'A%g %g 0 %d %d %g %g' % (round(pr.r, 2), round(pr.r, 2), abs(da) > math.pi, pos, *np.round(b, 2))
                for k in range(1, max(3, int(abs(da) * 14)) + 1):
                    th = a0 + da * k / max(3, int(abs(da) * 14)); poly.append(pr.c + pr.r * np.array([math.cos(th), math.sin(th)]))
            else:
                bz = pr.bz.copy(); bz[1] += a - bz[0]; bz[2] += b - bz[3]; bz[0] = a; bz[3] = b
                s += 'C%g %g %g %g %g %g' % tuple(np.round(bz[1:].ravel(), 2)); poly.extend(bez_pts(bz)[1:])
        d.append(s + 'Z'); polys.append(np.array(poly))
    return ''.join(d), polys

def raster(polys, shape, ox, oy, U):
    H, W = shape; acc = np.zeros((H, W), bool)
    for P in polys:
        im = Image.new('1', (W, H)); ImageDraw.Draw(im).polygon([tuple(q) for q in ((P - [ox, oy]) * U - .5).tolist()], fill=1)
        acc ^= np.asarray(im)
    return acc

# ---------- regularisation ----------
def run_regular(vals, weights=None, tol=.25):
    """Sorted offsets: where they form an even (or band+gap alternating) progression, make it exact."""
    v = np.array(vals, float); n = len(v); out = v.copy()
    if n < 4:
        return out
    # alternating band/gap first
    d = np.diff(v); i = 0
    while i < n - 3:
        best = None
        for j in range(n - 1, i + 2, -1):
            dd = d[i:j]; ev, od = dd[::2], dd[1::2]
            ok = lambda x: len(x) == 0 or (np.abs(x - np.median(x)) <= max(tol * np.median(x), .7)).all()
            if ok(ev) and ok(od):
                best = j; break
        if best:
            k = best - i + 1; X = np.zeros((k, 3)); s1 = s2 = 0
            for m in range(k):
                X[m] = [1, s1, s2]
                if m % 2 == 0: s1 += 1
                else: s2 += 1
            co = np.linalg.lstsq(X, v[i:best + 1], rcond=None)[0]
            out[i:best + 1] = X @ co; i = best + 1
        else:
            i += 1
    return out

def regularise_lines(prs, reg=True, cl=.9):
    ls = [p for p in prs if p.kind == 'L' and np.hypot(*(p.b - p.a)) > 2.5]
    if not ls:
        return
    angs = np.array([math.degrees(math.atan2(p.d[1], p.d[0])) % 180 for p in ls]); wts = np.array([np.hypot(*(p.b - p.a)) for p in ls])
    # snap near-H/V, otherwise cluster
    fam = {}
    order = np.argsort(-wts); centers = []
    for i in order:
        a = angs[i]
        for c in centers:
            if abs((a - c[0] + 90) % 180 - 90) < 2.6:
                c[1].append(i); break
        else:
            centers.append((a, [i]))
    fams = []
    for a0, ids in centers:
        dif = np.array([(angs[i] - a0 + 90) % 180 - 90 for i in ids]); mean = a0 + (dif * wts[ids]).sum() / wts[ids].sum()
        for t in (0, 90, 180):
            if abs(mean - t) < 3.5:
                mean = t
        fams.append([mean % 180, ids])
    # mirrored families share one absolute slant (chevrons, wedges)
    for i in range(len(fams)):
        for j in range(i + 1, len(fams)):
            a, b = fams[i][0], fams[j][0]
            if a in (0, 90) or b in (0, 90):
                continue
            if abs((a + b) - 180) < 3:
                wa, wb = wts[fams[i][1]].sum(), wts[fams[j][1]].sum()
                m = (min(a, b) * 1.0 if False else None)
                sl = ((a if a < 90 else 180 - a) * wa + (b if b < 90 else 180 - b) * wb) / (wa + wb)
                fams[i][0] = sl if a < 90 else 180 - sl; fams[j][0] = sl if b < 90 else 180 - sl
    for ang, ids in fams:
        th = math.radians(ang); dirv = np.array([math.cos(th), math.sin(th)]); nv = np.array([-dirv[1], dirv[0]])
        off = []
        for i in ids:
            p = ls[i]; p.d = dirv if p.d @ dirv > 0 else -dirv
            off.append(((p.a + p.b) / 2 @ nv if p.kind == 'L' else 0))
        off = np.array(off); w = wts[ids]
        idx = np.argsort(off); groups = [[idx[0]]]
        for k in idx[1:]:
            if off[k] - off[groups[-1][-1]] <= cl:
                groups[-1].append(k)
            else:
                groups.append([k])
        vals = np.array([(off[g] * w[g]).sum() / w[g].sum() for g in groups])
        if reg and len(vals) >= 4:
            vals = run_regular(vals)
        for g, val in zip(groups, vals):
            for k in g:
                p = ls[ids[k]]; m = (p.a + p.b) / 2
                p.p = m - nv * (m @ nv) + nv * val

def regularise_arcs(loops):
    arcs = [p for lp in loops for p in lp if p.kind == 'A']
    if not arcs:
        return
    arcs.sort(key=lambda a: -a.r); groups = []
    for a in arcs:
        for g in groups:
            if np.hypot(*(g['c'] - a.c)) < 4.5:
                g['a'].append(a); W = [x.r * sweep_of(np.array([x.a, x.m, x.b]), x.c) + 1 for x in g['a']]
                g['c'] = np.average([x.c for x in g['a']], axis=0, weights=W); break
        else:
            groups.append({'c': a.c.copy(), 'a': [a]})
    for g in groups:
        rs = sorted(x.r for x in g['a']); vals = []
        for r in rs:
            if vals and r - vals[-1][-1] < .9: vals[-1].append(r)
            else: vals.append([r])
        cen = np.array([np.mean(v) for v in vals])
        reg = run_regular(cen) if len(cen) >= 4 else cen
        for x in g['a']:
            x.c = g['c'].copy(); x.r = float(reg[int(np.abs(cen - x.r).argmin())])
    # lines tangent to an arc sit exactly at centre +/- r
    for lp in loops:
        n = len(lp)
        for i in range(n):
            a, b = lp[i], lp[(i + 1) % n]
            for ln, ar in ((a, b), (b, a)):
                if ln.kind == 'L' and ar.kind == 'A':
                    e = ar.a if ln is a else ar.b
                    rad = e - ar.c; rad = rad / (np.hypot(*rad) or 1)
                    if abs(rad @ ln.d) < .14:
                        nv = np.array([-ln.d[1], ln.d[0]]); sg = 1 if (ln.p - ar.c) @ nv > 0 else -1
                        m = ar.c + nv * sg * ar.r
                        ln.p = m + ln.d * ((ln.p - m) @ ln.d)

def warp_y(pr, f):
    if pr.kind == 'L':
        pr.a = np.array([pr.a[0], f(pr.a[1])]); pr.b = np.array([pr.b[0], f(pr.b[1])]); pr.p = np.array([pr.p[0], f(pr.p[1])])
        v = pr.b - pr.a
        if abs(pr.d[1]) > 1e-9 and abs(pr.d[0]) > 1e-9 and np.hypot(*v) > 0:
            pr.d = v / np.hypot(*v)
    elif pr.kind == 'C':
        pr.bz[:, 1] = [f(y) for y in pr.bz[:, 1]]

def loops_extent(loops):
    ys = []
    for lp in loops:
        for pr in lp:
            ys += [pr.a[1], pr.b[1]] if pr.kind != 'C' else list(bez_pts(pr.bz)[:, 1])
    return min(ys), max(ys)

def snap_words(items):
    """items: comps in one word row, each with .loops."""
    h = np.median([it['y1'] - it['y0'] for it in items]); tol = max(.7, .035 * h)
    def clusters(vals):
        o = np.argsort(vals); gs = [[o[0]]]
        for k in o[1:]:
            if vals[k] - vals[gs[-1][-1]] <= tol: gs[-1].append(k)
            else: gs.append([k])
        out = np.zeros(len(vals))
        for g in gs:
            out[g] = np.median(np.array(vals)[g]) if len(g) >= 2 else vals[g[0]]
        return out
    ext = [loops_extent(it['loops']) for it in items]
    tops = clusters([e[0] for e in ext]); bots = clusters([e[1] for e in ext])
    for it, (t, b), t2, b2 in zip(items, ext, tops, bots):
        if b - t < 1:
            continue
        f = lambda y, t=t, b=b, t2=t2, b2=b2: t2 + (y - t) * (b2 - t2) / (b - t)
        for lp in it['loops']:
            for pr in lp:
                warp_y(pr, f)
    # shared H lines, parallel stems
    prs = [p for it in items for lp in it['loops'] for p in lp]
    regularise_lines(prs, reg=False, cl=.7)
    # even out matching stems: vertical-edge pairs of similar width
    pairs = []
    for it in items:
        vs = [p for lp in it['loops'] for p in lp if p.kind == 'L' and abs(p.d[0]) < 1e-6 and abs(p.b[1] - p.a[1]) > .35 * h]
        for i, a in enumerate(vs):
            for b in vs[i + 1:]:
                w = abs(a.p[0] - b.p[0])
                ov = min(max(a.a[1], a.b[1]), max(b.a[1], b.b[1])) - max(min(a.a[1], a.b[1]), min(b.a[1], b.b[1]))
                if .03 * h < w < .45 * h and ov > .3 * h and a.d[1] * b.d[1] < 0:
                    pairs.append((w, a, b))
    if len(pairs) >= 3:
        med = np.median([w for w, _, _ in pairs])
        for w, a, b in pairs:
            if abs(w - med) <= .14 * med and abs(w - med) < 1.2:
                s = (med - w) / 2; l, r = (a, b) if a.p[0] < b.p[0] else (b, a)
                l.p = l.p - [s, 0]; r.p = r.p + [s, 0]

# ---------- gradient ----------
def gradient_for(rgb, m, ox_px=0):
    ys, xs = np.where(m)
    if len(xs) < 20:
        return None, 99
    cols = rgb[ys, xs].astype(float); lab = T.rgb2lab(cols)
    P = np.c_[xs, ys].astype(float); Pc = P - P.mean(0)
    co = np.linalg.lstsq(Pc, lab - lab.mean(0), rcond=None)[0]   # 2x3
    u, s, vt = np.linalg.svd(co, full_matrices=False); d = u[:, 0]
    if abs(d[0]) >= abs(d[1]):
        d = d if d[0] > 0 else -d
    else:
        d = d if d[1] > 0 else -d
    t = Pc @ d; lo, hi = np.percentile(t, .5), np.percentile(t, 99.5)
    if hi - lo < 1:
        hi = lo + 1
    tt = np.clip((t - lo) / (hi - lo), 0, 1); NB = 16; bins = np.minimum((tt * NB).astype(int), NB - 1)
    stops = []
    for b in range(NB):
        ok = bins == b
        if ok.sum() > 2:
            stops.append(((b + .5) / NB, np.median(cols[ok], axis=0)))
    if len(stops) < 2:
        return None, 99
    # drop stops that interpolate well (keep few)
    keep = [0, len(stops) - 1]
    def err(i, ks):
        ks = sorted(ks); j = np.searchsorted(ks, i); a, b = ks[j - 1], ks[j]
        f = (stops[i][0] - stops[a][0]) / (stops[b][0] - stops[a][0]); return np.abs(stops[a][1] * (1 - f) + stops[b][1] * f - stops[i][1]).max()
    while len(keep) < 9:
        rest = [i for i in range(len(stops)) if i not in keep]
        if not rest:
            break
        e = [err(i, keep) for i in rest]; k = int(np.argmax(e))
        if e[k] < 9:
            break
        keep.append(rest[k])
    keep = sorted(keep); xp = [stops[i][0] for i in keep]; fp = np.array([stops[i][1] for i in keep])
    pred = np.c_[[np.interp(tt, xp, fp[:, c]) for c in range(3)]].T
    de = float(np.linalg.norm(T.rgb2lab(pred) - lab, axis=1).mean())
    c0 = P.mean(0)
    g = {'x1': round(float((c0 + d * lo)[0]), 1), 'y1': round(float((c0 + d * lo)[1]), 1), 'x2': round(float((c0 + d * hi)[0]), 1), 'y2': round(float((c0 + d * hi)[1]), 1),
         's': [[round(float(x), 3), '#%02x%02x%02x' % tuple(int(round(v)) for v in c)] for x, c in zip(xp, fp)]}
    return g, de

# ---------- continuous shapes behind text ----------
REPAIR = {'28': 14, '36': 14, '51': 18, '34': 16, 'C04': 16, 'C06': 16, 'D06': 16, 'D10': 16, 'D11': 14}  # id: bridge radius px
RESTORE_MARK = {'29', '34', '56', 'D01', 'D11', '50'}  # black marks drawn as letterforms: keep the v1 outline
KEEP_V1_COLOUR = {'13', '55', '64'}                    # colour that is part of the lettering: keep v1 outlines and fill
SWOOP_ALPHA = .72            # 38: slope at the top as a share of the mean slope (rises smoothly below)

def to_canvas(c, shape, U):
    m = np.zeros(shape, bool); h, w = c['mask'].shape; x = int(round(c['ox'] * U)); y = int(round(c['oy'] * U))
    x0, y0 = max(x, 0), max(y, 0); x1, y1 = min(x + w, shape[1]), min(y + h, shape[0])
    if x1 > x0 and y1 > y0:
        m[y0:y1, x0:x1] = c['mask'][y0 - y:y1 - y, x0 - x:x1 - x]
    return m

def attach(recs, store, U):
    for m in recs:
        mk, x0, y0 = store[int(m['d'][1:])]
        m.update(mask=mk, ox=x0, oy=y0, U=U)
    return recs

def repair_bands(comps, rows, lid, shape, U, store):
    """Close each colour across letters that sit on top of it, so it is one continuous band. Any paper
    halo the source had around those letters comes back as a knock-out mask, not as a cut in the band."""
    Rpx = REPAIR[lid] * U
    letters = [c for r in rows for c in r]
    ink = np.zeros(shape, bool)
    for c in letters:
        ink |= to_canvas(c, shape, U)
    near = ndi.distance_transform_edt(~ink) <= 4 * U
    cols = [c for c in comps if c['k'] == 'col']
    fills = {c['f'] for c in cols}; newc = []; halo_vals = []; filled_all = np.zeros(shape, bool)
    for f in fills:
        M = np.zeros(shape, bool)
        for c in cols:
            if c['f'] == f:
                M |= to_canvas(c, shape, U)
        grown = ndi.distance_transform_edt(~M) <= Rpx
        closed = ndi.distance_transform_edt(grown) > Rpx
        new = closed & near & ~M
        # never eat a neighbouring colour
        others = np.zeros(shape, bool)
        for c in cols:
            if c['f'] != f:
                others |= to_canvas(c, shape, U)
        new &= ~others
        M2 = M | new
        F = new & ~ink
        if F.sum() > 20 * U * U:
            filled_all |= new
            halo_vals += list(ndi.distance_transform_edt(~ink)[F])
        newc += attach(T.comp_records(M2, lid, f, 'col', False, 8 * U * U), store, U)
    rest = [c for c in comps if c['k'] != 'col']
    halo = float(np.percentile(halo_vals, 85)) / U if halo_vals else 0
    touched = [c for c in letters if (to_canvas(c, shape, U) & ndi.binary_dilation(filled_all, iterations=int(2 * U))).any()]
    return newc + rest, halo, touched

def warp_x(pr, f):
    if pr.kind == 'L':
        a, b = np.array([f(pr.a[0]), pr.a[1]]), np.array([f(pr.b[0]), pr.b[1]])
        vert = abs(pr.d[0]) < 1e-6
        pr.p = np.array([f(pr.p[0]), pr.p[1]]); pr.a, pr.b = a, b
        if not vert and abs(pr.d[1]) > 1e-6 and np.hypot(*(b - a)) > 0:
            v = (b - a) / np.hypot(*(b - a)); pr.d = v if v @ pr.d > 0 else -v
    elif pr.kind == 'C':
        pr.bz[:, 0] = [f(x) for x in pr.bz[:, 0]]

def edges_at(mask_row):
    on = np.r_[False, mask_row, False].astype(int); return np.where(np.diff(on) != 0)[0].astype(float)

def align_split(rows, comps, shape, U):
    """Warp the lower half of a banded word in x so its strokes continue the upper half's strokes."""
    band = [c for c in comps if c['k'] == 'col']
    if not band or len(rows) < 2:
        return 0
    rows = sorted(rows, key=lambda r: np.mean([c['b'][1] for c in r]))
    top, bot = rows[0], rows[-1]
    Mt = np.zeros(shape, bool); Mb = np.zeros(shape, bool)
    for c in top: Mt |= to_canvas(c, shape, U)
    for c in bot: Mb |= to_canvas(c, shape, U)
    yt = np.where(Mt.any(1))[0].max() - 3 * U; yb = np.where(Mb.any(1))[0].min() + 3 * U
    Et, Eb = edges_at(Mt[yt]) / U, edges_at(Mb[yb]) / U
    n, m = len(Et), len(Eb); skip = 5.0
    D = np.zeros((n + 1, m + 1)); D[:, 0] = np.arange(n + 1) * skip; D[0, :] = np.arange(m + 1) * skip
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = min(D[i - 1, j - 1] + abs(Et[i - 1] - Eb[j - 1]), D[i - 1, j] + skip, D[i, j - 1] + skip)
    i, j = n, m; pairs = []
    while i and j:
        if D[i, j] == D[i - 1, j - 1] + abs(Et[i - 1] - Eb[j - 1]):
            pairs.append((Eb[j - 1], Et[i - 1])); i -= 1; j -= 1
        elif D[i, j] == D[i - 1, j] + skip: i -= 1
        else: j -= 1
    pairs.sort()
    if len(pairs) < 4:
        return 0
    xs = np.array([p[0] for p in pairs]); ys = np.maximum.accumulate(np.array([p[1] for p in pairs]))
    f = lambda x: float(np.interp(x, xs, ys, left=x + ys[0] - xs[0], right=x + ys[-1] - xs[-1]))
    for c in bot:
        c['nofall'] = True
        for lp in c['loops']:
            for pr in lp:
                warp_x(pr, f)
    return float(np.abs(xs - ys).max())

def rec_shape(f, d, pts, t, a, h=0):
    pts = np.array(pts); return {'f': f, 'k': 'col', 'd': d, 'b': [round(float(pts[:, 0].min()), 1), round(float(pts[:, 1].min()), 1), round(float(pts[:, 0].max()), 1), round(float(pts[:, 1].max()), 1)], 't': t, 'a': a, 'h': h}

def build_38(comps, shape, U):
    """Seven full-height bands: each edge is one smooth flare, top line to bottom line; a mask hides the word zone."""
    col = [c for c in comps if c['k'] == 'col' and c['a'] > 150]
    ink = [c for c in comps if c['k'] == 'ink']
    y_i0 = min(c['b'][1] for c in ink); y_i1 = max(c['b'][3] for c in ink); ymid = (y_i0 + y_i1) / 2
    up = sorted([c for c in col if c['b'][3] <= ymid], key=lambda c: c['b'][0]); lo = sorted([c for c in col if c['b'][1] >= ymid], key=lambda c: c['b'][0])
    y0 = float(np.median([c['b'][1] for c in up])); y1 = float(np.median([c['b'][3] for c in lo]))
    ya = float(np.median([c['b'][3] for c in up])); yb = float(np.median([c['b'][1] for c in lo]))
    def span(cs, at):
        vals = []
        for c in cs:
            m = to_canvas(c, shape, U); r = m[int(round(at * U))]
            if r.any():
                xx = np.where(r)[0]; vals += [xx.min() / U, (xx.max() + 1) / U]
        return min(vals), max(vals)
    tl, tr = span(up, y0 + 1.5); bl, br = span(lo, y1 - 1.5)
    ax = ((tl + tr) / 2 + (bl + br) / 2) / 2           # one centre axis
    TW, BW = (tr - tl) / 2, (br - bl) / 2
    ratio = 1 / 8.0                                    # gap : band, the same top and bottom so gaps taper with width
    N = 7; unit = 2 / (N + (N - 1) * ratio)            # share of half-width... band width in half-width units
    colours = [c['f'] for c in lo][:N]
    recs = []; ym = (y0 + y1) / 2
    def edge(u):                                       # u in [-1,1] across the fan
        xt, xb = ax + u * TW, ax + u * BW
        return xt, xb, xt + (xb - xt) * SWOOP_ALPHA / 2 # Q control: slope grows steadily from top to bottom
    for i in range(N):
        u0 = -1 + i * unit * (1 + ratio); u1 = u0 + unit
        (t0, b0, c0), (t1, b1, c1) = edge(u0), edge(u1)
        d = 'M%.2f %.2fQ%.2f %.2f %.2f %.2fH%.2fQ%.2f %.2f %.2f %.2fZ' % (t0, y0, c0, ym, b0, y1, b1, c1, ym, t1, y0)
        rc = rec_shape(colours[i] if i < len(colours) else '#888888', d, [(t0, y0), (t1, y0), (b0, y1), (b1, y1)], b1 - b0, int((t1 - t0 + b1 - b0) / 2 * (y1 - y0)))
        rc['bandv'] = [[t0, c0, b0], [t1, c1, b1], y0, ym, y1]
        recs.append(rc)
    return recs, [{'d': 'M0 %.2fH%dV%.2fH0Z' % (ya, shape[1], yb), 'sw': 0}]

def build_10(comps, shape, U):
    """Design change requested for v2: straight striped stem, exact arms. No J hook."""
    col = [c for c in comps if c['k'] == 'col']
    Xs = 128.0
    Ytop = float(np.median([c['b'][1] for c in col])); Ybot = max(float(np.median([c['b'][3] for c in col if c['b'][0] > Xs + 5])), 0)
    label = np.full(shape, -1); fills = sorted({c['f'] for c in col})
    for c in col:
        label[to_canvas(c, shape, U)] = fills.index(c['f'])
    rowT = label[int((Ytop + 2) * U)]; rowB = label[int((Ybot - 2) * U)]
    xsT = np.where(rowT >= 0)[0] / U
    stem0 = float(xsT[xsT < Xs].min()); arm = xsT[xsT > Xs + 2]; Xt0, Xt1 = float(arm.min()), float(arm.max())
    xsB = np.where(rowB >= 0)[0] / U; armB = xsB[xsB > Xs + 2]; Xb0, Xb1 = float(armB.min()), float(armB.max())
    Xend = (Xt1 + Xb1) / 2
    m = (Xb0 - Xs + Xend - Xs) / (Ybot - Ytop)     # one slope for both arms; the crotch lands exactly on the stem
    at = lambda row, x: fills[int(row[int(x * U)])] if row[int(x * U)] >= 0 else fills[0]
    recs = []
    W = (Xs - stem0) / 6
    stemF = [at(rowT, stem0 + (i + .5) * W) for i in range(6)]
    for i in range(6):
        a, b = stem0 + i * W, stem0 + (i + 1) * W
        recs.append(rec_shape(stemF[i], 'M%.2f %.2fH%.2fV%.2fH%.2fZ' % (a, Ytop, b, Ybot, a), [(a, Ytop), (b, Ybot)], W, int(W * (Ybot - Ytop))))
    dT = (Xend - Xt0) / 4; ys = lambda x: Ytop + (x - Xs) / m
    for i in range(4):
        a, b = Xt0 + i * dT, Xt0 + (i + 1) * dT
        f = at(rowT, (a + b) / 2)
        rc = rec_shape(f, 'M%.2f %.2fH%.2fL%.2f %.2fV%.2fZ' % (a, Ytop, b, Xs, ys(b), ys(a)), [(a, Ytop), (b, Ytop), (Xs, ys(b)), (Xs, ys(a))], dT / math.hypot(1, 1 / m), int(dT * (ys(a) - Ytop)))
        rc['cl'] = [round(Xs, 2), round((ys(a) + ys(b)) / 2, 2), round((a + b) / 2, 2), round(Ytop - 3, 2)]
        recs.append(rc)
    dB = (Xend - Xb0) / 6
    def meet(x):   # lower-arm edge running up from the base meets the upper arm's underside
        # underside: X = Xend - m (y - Ytop); edge: X = x - m (Ybot - y)
        y = (Xend + m * Ytop - x + m * Ybot) / (2 * m)
        return x - m * (Ybot - y), y
    for i in range(6):
        a, b = Xb0 + i * dB, Xb0 + (i + 1) * dB
        pa, pb = meet(a), meet(b); f = at(rowB, (a + b) / 2)
        rc = rec_shape(f, 'M%.2f %.2fL%.2f %.2fL%.2f %.2fH%.2fZ' % (pa[0], pa[1], pb[0], pb[1], b, Ybot, a), [pa, pb, (a, Ybot), (b, Ybot)], dB / math.hypot(1, 1 / m), int(dB * (Ybot - pa[1])))
        rc['cl'] = [round((pa[0] + pb[0]) / 2, 2), round((pa[1] + pb[1]) / 2, 2), round((a + b) / 2, 2), round(Ybot + 3, 2)]
        recs.append(rc)
    return recs

def build_D05(comps, shape, U, letters):
    """Six wedges, each one shape from top to bottom on shared vertical edges; a mask hides the word zone and its halo."""
    col = [c for c in comps if c['k'] == 'col']
    ink_y = [c['b'][1] for c in letters] + [c['b'][3] for c in letters]; ymid = float(np.median(ink_y))
    fills = {}
    for c in col:
        fills.setdefault(c['f'], []).append(c)
    groups = sorted(fills.items(), key=lambda kv: min(c['b'][0] for c in kv[1]))
    xs = []
    for f, g in groups:
        xs.append((min(c['b'][0] for c in g), max(c['b'][2] for c in g)))
    edges = [xs[0][0]] + [(xs[i][1] + xs[i + 1][0]) / 2 for i in range(len(xs) - 1)] + [xs[-1][1]]
    recs = []; ya = []; yb = []
    for i, (f, g) in enumerate(groups):
        M = np.zeros(shape, bool)
        for c in g: M |= to_canvas(c, shape, U)
        x0, x1 = edges[i], edges[i + 1]
        def prof(top):
            pts = []
            for x in np.linspace(x0 + 2, x1 - 2, 9):
                col_ = M[:, int(x * U)]; yy = np.where(col_)[0]
                if len(yy):
                    u_ = yy[yy < ymid * U]; l_ = yy[yy >= ymid * U]
                    v = (u_.min() if top and len(u_) else (l_.max() + 1 if not top and len(l_) else None))
                    if v is not None:
                        pts.append((x, v / U))
            pts = np.array(pts); k = np.polyfit(pts[:, 0], pts[:, 1], 1)
            return float(np.polyval(k, x0)), float(np.polyval(k, x1))
        tl, tr = prof(True); bl, br = prof(False)
        u = [c for c in g if (c['b'][1] + c['b'][3]) / 2 < ymid]; l = [c for c in g if (c['b'][1] + c['b'][3]) / 2 >= ymid]
        if u: ya.append(max(c['b'][3] for c in u))
        if l: yb.append(min(c['b'][1] for c in l))
        d = 'M%.2f %.2fL%.2f %.2fV%.2fL%.2f %.2fZ' % (x0, tl, x1, tr, br, x0, bl)
        recs.append(rec_shape(f, d, [(x0, tl), (x1, tr), (x1, br), (x0, bl)], x1 - x0, int((x1 - x0) * (bl - tl))))
    return recs, float(np.median(ya)), float(np.median(yb)), edges

# ---------- exact band builders ----------
def fill_masks(comps, shape, U):
    out = {}
    for c in comps:
        if c['k'] == 'col':
            out[c['f']] = out.get(c['f'], np.zeros(shape, bool)) | to_canvas(c, shape, U)
    return out

def lsq_line(v):
    x = np.arange(len(v)); k = np.polyfit(x, v, 1); return np.polyval(k, x)

def thickness(M, U):
    return float(np.percentile(ndi.distance_transform_edt(M)[ndi.binary_erosion(M)], 99.7)) * 2 / U

def build_turn(comps, shape, U, fx, fy, grad_top=0, outer=None, foot=None):
    """Bands: straight leg, exact quarter arc about one centre, straight leg, flat ends. The two legs may have
    different band widths in the source, so the arcs are elliptical where they differ (A rx ry)."""
    W, H = shape[1] / U, shape[0] / U
    ms = fill_masks(comps, shape, U); items = []
    for f, M in ms.items():
        m = M[::-1 if fy else 1, ::-1 if fx else 1]
        rows = np.where(m.any(1))[0]; cols = np.where(m.any(0))[0]
        items.append(dict(f=f, m=m, top=rows[0] / U, bot=(rows[-1] + 1) / U, left=cols[0] / U, right=(cols[-1] + 1) / U))
    wmax = max(i['right'] - i['left'] for i in items)
    items = [i for i in items if i['m'].sum() > 200 * U * U and i['right'] - i['left'] > .5 * wmax]
    med = np.median([i['m'].sum() for i in items]); items = [i for i in items if i['m'].sum() > .45 * med]
    items.sort(key=lambda i: i['top'])
    n = len(items)
    tops = lsq_line([i['top'] for i in items]); rights = lsq_line([i['right'] for i in items])
    # One thickness on the straight run and through the curve: bands are exact circles about ONE centre.
    p = abs(np.polyfit(range(n), tops, 1)[0])
    th = float(np.median([it['m'][:, int((it['left'] + (it['right'] - it['left']) * .35) * U)].sum() / U for it in items]))
    if th > .82 * p:
        th = p                          # bands touch: shared edges, no paper between them
    y0 = float(tops[0]); x0 = (W - outer if fx else outer) if outer is not None else float(rights[0])
    Yb_ = float(np.median([i['bot'] for i in items])) if foot is None else (H - foot if fy else foot)
    # tightest inner radius, reduced if the legs are short, so every foot still ends flat on the one line
    R_in = min(max(.6 * p, 5.0), max(Yb_ - y0 - (p * (n - 1) + th), 1.5))
    R0 = p * (n - 1) + th + R_in
    # keep a little straight foot if the height allows; never shrink the inner radius below R_in
    cx, cy = x0 - R0, y0 + R0
    Yb = float(np.median([i['bot'] for i in items])) if foot is None else (H - foot if fy else foot)
    # left ends: flat on one line unless the source cuts them on purpose (arrow tips)
    lefts = []
    for i, it in enumerate(items):
        m = it['m']; a = m[int((tops[i] + 1.5) * U)]; b = m[int((tops[i] + th - 1.5) * U)]
        lefts.append((np.argmax(a) / U if a.any() else it['left'], np.argmax(b) / U if b.any() else it['left']))
    lefts = np.array(lefts)
    flat = lefts.max() - lefts.min() < 5
    if flat:
        lefts[:] = float(np.median(lefts))
    mx = lambda x: W - x if fx else x
    my = lambda y: H - y if fy else y
    sw = lambda v: int(v) ^ int(fx) ^ int(fy)
    recs = []
    for i, it in enumerate(items):
        ax = ay = R0 - i * p; bx = by = ax - th; mxr = myr = (ax + bx) / 2
        xa, xb = lefts[i]
        d = 'M%.2f %.2fH%.2fA%.2f %.2f 0 0 %d %.2f %.2fV%.2fH%.2fV%.2fA%.2f %.2f 0 0 %d %.2f %.2fH%.2fZ' % (
            mx(xa), my(cy - ay), mx(cx), ax, ay, sw(1), mx(cx + ax), my(cy), my(Yb), mx(cx + bx), my(cy), bx, by, sw(0), mx(cx), my(cy - by), mx(xb))
        rc = rec_shape(it['f'], d, [(mx(min(xa, xb)), my(cy - ay)), (mx(cx + ax), my(cy)), (mx(cx + bx), my(Yb))], round(th, 1), int(it['m'].sum() / U / U))
        rc['cd'] = 'M%.2f %.2fH%.2fA%.2f %.2f 0 0 %d %.2f %.2fV%.2f' % (mx(min(xa, xb) - 6), my(cy - myr), mx(cx), mxr, myr, sw(1), mx(cx + mxr), my(cy), my(Yb + 6))
        if grad_top:
            y1, y2 = my(Yb), my(Yb - grad_top)
            rc['g'] = {'x1': 0, 'y1': round(y1, 1), 'x2': 0, 'y2': round(y2, 1), 's': [[0, '#0d0d10'], [1, it['f']]]}
        recs.append(rc)
    return recs

def rr_path(x0, y0, x1, y1, r):
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    return 'M%.2f %.2fH%.2fA%.2f %.2f 0 0 1 %.2f %.2fV%.2fA%.2f %.2f 0 0 1 %.2f %.2fH%.2fA%.2f %.2f 0 0 1 %.2f %.2fV%.2fA%.2f %.2f 0 0 1 %.2f %.2fZ' % (
        x0 + r, y0, x1 - r, r, r, x1, y0 + r, y1 - r, r, r, x1 - r, y1, x0 + r, r, r, x0, y1 - r, y0 + r, r, r, x0 + r, y0)

def build_rings(comps, shape, U, full=False):
    """Concentric rounded rectangles (or circles) about one centre, even bands, shared edges."""
    ms = fill_masks(comps, shape, U); items = []
    for f, M in ms.items():
        r = np.where(M.any(1))[0]; c = np.where(M.any(0))[0]
        if M.sum() < 100 * U * U:
            continue
        items.append(dict(f=f, m=M, x0=c[0] / U, x1=(c[-1] + 1) / U, y0=r[0] / U, y1=(r[-1] + 1) / U))
    items.sort(key=lambda i: -(i['x1'] - i['x0']))
    n = len(items)
    hw = lsq_line([(i['x1'] - i['x0']) / 2 for i in items]); hh = lsq_line([(i['y1'] - i['y0']) / 2 for i in items])
    cx = float(np.median([(i['x0'] + i['x1']) / 2 for i in items])); cy = float(np.median([(i['y0'] + i['y1']) / 2 for i in items]))
    px = abs(np.polyfit(range(n), hw, 1)[0]); py = abs(np.polyfit(range(n), hh, 1)[0])
    if full:
        R0 = float(hw[0]); px = py = (px + py) / 2
    else:
        m0 = items[0]['m']; xs = np.where(m0.any(0))[0]; yt = m0.argmax(0)[xs] / U; X = (xs + .5) / U
        y00 = cy - hh[0]; x00 = cx - hw[0]
        flat = X[(yt <= y00 + 1.0) & (X < cx)]
        R0 = float(flat.min() - x00) if len(flat) else hh[0] * .6
    recs = []
    for i, it in enumerate(items):
        a = hw[0] - i * px; b = hh[0] - i * py; Ro = max(R0 - i * (px + py) / 2, 2); Ri = max(Ro - (px + py) / 2, 1)
        if full and i == n - 1:
            # the last ring's hole is measured, not assumed
            ys, xs = np.where(it['m']); dist = np.hypot((xs + .5) / U - cx, (ys + .5) / U - cy); hole = float(np.percentile(dist, .5))
            ia, ib = hole, hole; Ri = hole
        else:
            ia, ib = a - px, b - py
        outer = rr_path(cx - a, cy - b, cx + a, cy + b, Ro); inner = rr_path(cx - ia, cy - ib, cx + ia, cy + ib, Ri)
        rc = rec_shape(it['f'], outer + inner, [(cx - a, cy - b), (cx + a, cy + b)], round((px + py) / 2, 1), int(it['m'].sum() / U / U))
        rc['cd'] = rr_path(cx - (a + ia) / 2, cy - (b + ib) / 2, cx + (a + ia) / 2, cy + (b + ib) / 2, max((Ro + Ri) / 2, 1))
        recs.append(rc)
    return recs

def build_arch(comps, shape, U):
    """Concentric arcs on one baseline with one centre and even bands: true circles when they fit, ellipses otherwise."""
    ms = fill_masks(comps, shape, U); items = []
    for f, M in ms.items():
        r = np.where(M.any(1))[0]; c = np.where(M.any(0))[0]
        if M.sum() < 30 * U * U:
            continue
        items.append(dict(f=f, m=M, x0=c[0] / U, x1=(c[-1] + 1) / U, y0=r[0] / U, y1=(r[-1] + 1) / U))
    items.sort(key=lambda i: -(i['x1'] - i['x0']))
    n = len(items)
    base = float(np.median([i['y1'] for i in items])); cx = float(np.median([(i['x0'] + i['x1']) / 2 for i in items]))
    pts = []
    for it in items:
        m = it['m']; xs = np.where(m.any(0))[0]; yt = m.argmax(0)[xs] / U; pts.append(np.c_[(xs + .5) / U, yt])
    # circle model: shared centre from the outer edges, radii along the crown
    fits = [circle(p) for p in pts if len(p) > 20]
    cy = float(np.median([f[0][1] for f in fits if f]))
    crown = lsq_line([i['y0'] for i in items]); R = cy - crown
    dt = float(R[0] - R[1]) if n > 1 else 10.0
    def rec_for(it, ro, ri, sx=1.0):
        h = base - cy
        xo = math.sqrt(max(ro * ro - h * h, .01)); xi = math.sqrt(max(ri * ri - h * h, .01))
        large = 1 if cy > base else 0
        d = 'M%.2f %.2fA%.2f %.2f 0 %d 1 %.2f %.2fH%.2fA%.2f %.2f 0 %d 0 %.2f %.2fZ' % (cx - xo, base, ro, ro, 0, cx + xo, base, cx + xi, ri, ri, 0, cx - xi, base)
        return rec_shape(it['f'], d, [(cx - xo, base), (cx + xo, base), (cx, cy - ro)], round(dt, 1), int(it['m'].sum() / U / U))
    circ = [rec_for(it, R[i], max(R[i] - dt, abs(base - cy) + .5)) for i, it in enumerate(items)] if (cy >= base - 3) else None
    # ellipse model
    rx = lsq_line([(i['x1'] - i['x0']) / 2 for i in items]); ry = lsq_line([base - i['y0'] for i in items])
    tx = abs(np.polyfit(range(n), rx, 1)[0]); ty = abs(np.polyfit(range(n), ry, 1)[0])
    ell = []
    for i, it in enumerate(items):
        ax, ay = rx[i], ry[i]; bx, by = max(ax - tx, .01), max(ay - ty, .01)
        d = 'M%.2f %.2fA%.2f %.2f 0 0 1 %.2f %.2fH%.2fA%.2f %.2f 0 0 0 %.2f %.2fZ' % (cx - ax, base, ax, ay, cx + ax, base, cx + bx, bx, by, cx - bx, base)
        ell.append(rec_shape(it['f'], d, [(cx - ax, base), (cx + ax, base), (cx, base - ay)], round((tx + ty) / 2, 1), int(it['m'].sum() / U / U)))
    def score(recs):
        I = Un = 0
        for rc, it in zip(recs, items):
            A_ = raster(flatten(rc['d']), shape, 0, 0, U); I += (A_ & it['m']).sum(); Un += (A_ | it['m']).sum()
        return I / max(Un, 1)
    if circ and score(circ) >= score(ell) - .01:
        return circ
    return ell

def build_fan(comps, shape, U):
    """Annular sectors about one hub, flat on the baseline, equal gaps."""
    ms = fill_masks(comps, shape, U); items = []
    allm = np.zeros(shape, bool)
    for M in ms.values():
        allm |= M
    r = np.where(allm.any(1))[0]; c = np.where(allm.any(0))[0]
    cx = (c[0] + c[-1] + 1) / 2 / U; by = (r[-1] + 1) / U
    for f, M in ms.items():
        ys, xs = np.where(M); X = (xs + .5) / U - cx; Y = by - (ys + .5) / U
        ang = np.arctan2(Y, X); dist = np.hypot(X, Y)
        if len(xs) < 30 * U * U:
            continue
        items.append(dict(f=f, a0=float(np.percentile(ang, 99.7)), a1=float(np.percentile(ang, .3)), R=float(np.percentile(dist, 99.5)), r=float(np.percentile(dist, .5)), area=len(xs) / U / U))
    items.sort(key=lambda i: -i['a0'])
    Rr = float(np.median([i['R'] for i in items])); rr = float(np.median([i['r'] for i in items]))
    gaps = [items[i]['a1'] - items[i + 1]['a0'] for i in range(len(items) - 1)]; g = max(float(np.median(gaps)), 0)
    bounds = [math.pi] + [(items[i]['a1'] + items[i + 1]['a0']) / 2 for i in range(len(items) - 1)] + [0.]
    pt = lambda R, a: (cx + R * math.cos(a), by - R * math.sin(a))
    recs = []
    for i, it in enumerate(items):
        a0 = bounds[i] - (g / 2 if i else 0); a1 = bounds[i + 1] + (g / 2 if i < len(items) - 1 else 0)
        P = [pt(Rr, a0), pt(Rr, a1), pt(rr, a1), pt(rr, a0)]
        d = 'M%.2f %.2fA%.2f %.2f 0 0 1 %.2f %.2fL%.2f %.2fA%.2f %.2f 0 0 0 %.2f %.2fZ' % (*P[0], Rr, Rr, *P[1], *P[2], rr, rr, *P[3])
        recs.append(rec_shape(it['f'], d, P + [pt(Rr, (a0 + a1) / 2)], round(Rr - rr, 1), int(it['area'])))
    return recs

BUILDERS = {'28': lambda c, s, U: build_turn(c, s, U, False, False), '36': lambda c, s, U: build_turn(c, s, U, True, False),
            'D11': lambda c, s, U: build_turn(c, s, U, False, False), 'C04': lambda c, s, U: build_turn(c, s, U, True, True, 16, outer=19.5, foot=160),
            '34': build_rings, '16': build_rings, 'D07': lambda c, s, U: build_rings(c, s, U, True),
            '49': build_arch, 'D12': build_arch, '32': build_fan}

def flatten(d):
    """SVG path -> polygons (for measuring only)."""
    polys = []; cur = []; p = np.zeros(2)
    for cmd, args in re.findall(r'([MLHVQCAZ])([^MLHVQCAZ]*)', d):
        n = [float(x) for x in re.findall(r'-?\d*\.?\d+(?:e-?\d+)?', args)]
        if cmd == 'M':
            if cur: polys.append(np.array(cur))
            p = np.array(n[:2]); cur = [p]
        elif cmd == 'L': p = np.array(n[:2]); cur.append(p)
        elif cmd == 'H': p = np.array([n[0], p[1]]); cur.append(p)
        elif cmd == 'V': p = np.array([p[0], n[0]]); cur.append(p)
        elif cmd == 'Q':
            c, e = np.array(n[:2]), np.array(n[2:4]); t = np.linspace(0, 1, 24)[1:, None]
            cur.extend(list((1 - t) ** 2 * p + 2 * (1 - t) * t * c + t * t * e)); p = e
        elif cmd == 'C':
            b = np.array([p, n[:2], n[2:4], n[4:6]], float); cur.extend(list(bez_pts(b, 20)[1:])); p = b[3]
        elif cmd == 'A':
            rx, ry, _, large, sweep, x, y = n; e = np.array([x, y])
            d2 = (p - e) / 2; lam = (d2[0] / rx) ** 2 + (d2[1] / ry) ** 2
            if lam > 1: rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
            num = max(rx * rx * ry * ry - rx * rx * d2[1] ** 2 - ry * ry * d2[0] ** 2, 0); den = rx * rx * d2[1] ** 2 + ry * ry * d2[0] ** 2 or 1
            co = math.sqrt(num / den) * (-1 if bool(large) == bool(sweep) else 1)
            cc = np.array([co * rx * d2[1] / ry, -co * ry * d2[0] / rx]) + (p + e) / 2
            a0 = math.atan2((p[1] - cc[1]) / ry, (p[0] - cc[0]) / rx); a1 = math.atan2((y - cc[1]) / ry, (x - cc[0]) / rx)
            da = a1 - a0
            if sweep and da < 0: da += 2 * math.pi
            if not sweep and da > 0: da -= 2 * math.pi
            for k in range(1, 41):
                th = a0 + da * k / 40; cur.append(cc + [rx * math.cos(th), ry * math.sin(th)])
            p = e
        elif cmd == 'Z':
            pass
    if cur: polys.append(np.array(cur))
    return polys

# ---------- per logo ----------
def word_rows(items):
    """Group comps into rows of similar-height shapes: >=4 in a row reads as lettering."""
    its = sorted(items, key=lambda c: (c['b'][1] + c['b'][3]) / 2); rows = []
    for c in its:
        h = c['b'][3] - c['b'][1]; placed = False
        for r in rows:
            ov = min(c['b'][3], r['y1']) - max(c['b'][1], r['y0'])
            if ov > .45 * min(h, r['h']) and .34 < h / r['h'] < 2.9:
                r['c'].append(c); r['y0'] = min(r['y0'], c['b'][1]); r['y1'] = max(r['y1'], c['b'][3])
                r['h'] = float(np.median([x['b'][3] - x['b'][1] for x in r['c']])); placed = True; break
        if not placed:
            rows.append({'c': [c], 'y0': c['b'][1], 'y1': c['b'][3], 'h': h})
    return [r['c'] for r in rows if len(r['c']) >= 4]

def fit_comp(c, mode, tol):
    loops = [fit_loop(p, mode, tol)[0] for p in contours(c['mask'], c['ox'], c['oy'], c['U'])]
    return [lp for lp in loops if len(lp) >= 2]

def iou(c, loops):
    d, polys = build_d(loops); r = raster(polys, c['mask'].shape, c['ox'], c['oy'], c['U']) if polys else np.zeros_like(c['mask'])
    inter = (r & c['mask']).sum(); uni = (r | c['mask']).sum()
    return inter / max(uni, 1), inter, uni, d, polys

def load_v1():
    h = open(os.path.join(HERE, 'traced-v1.html')).read()
    return json.loads(re.search(r'/\*TRACED_DATA_START\*/const TRACED=(.*?);/\*TRACED_DATA_END\*/', h, re.S).group(1))
V1 = None

def v1_match(lid, c):
    """The v1 record for this shape: same segmentation, so same box and kind."""
    for r in V1[lid]['comps']:
        if r['k'] == c['k'] and r['b'] == c['b'] and (c['k'] != 'col' or r['f'] == c['f'] or r['f'] == 'mesh'):
            return r
    return None

def close_gaps(comps, shape, U, lid, store):
    """Hairline paper between neighbouring colours is anti-aliasing, not design: give it to the nearest colour."""
    ms = fill_masks(comps, shape, U)
    if len(ms) < 2:
        return comps
    fills = list(ms); lab = np.full(shape, -1)
    for i, f in enumerate(fills):
        lab[ms[f]] = i
    ink = np.zeros(shape, bool)
    for c in comps:
        if c['k'] != 'col':
            ink |= to_canvas(c, shape, U)
    col = lab >= 0
    r = .9 * U
    closed = ndi.distance_transform_edt(ndi.distance_transform_edt(~col) <= r) > r
    gap = closed & ~col & ~ink
    if not gap.any():
        return comps
    idx = ndi.distance_transform_edt(~col, return_distances=False, return_indices=True)
    lab[gap] = lab[idx[0], idx[1]][gap]
    out = [c for c in comps if c['k'] != 'col']
    for i, f in enumerate(fills):
        out += attach(T.comp_records(lab == i, lid, f, 'col', False, 8 * U * U), store, U)
    return out

def process(lid, cell, lbox):
    T.U = T.UPSCALE.get(lid, 4); U = T.U
    store = []
    def fake_trace(mask, x0, y0):
        store.append((mask.copy(), x0, y0)); return 'T%d' % (len(store) - 1)
    T.trace_mask = fake_trace
    saveM = set(T.MESH_FILL); T.MESH_FILL = {'61'} if lid == '61' else set()
    comps, paper, mesh = T.trace_cell(cell, lid)
    T.MESH_FILL = saveM
    comps = [m for m in comps if not (m['b'][2] < lbox[0] and m['b'][3] < lbox[1] and m['a'] < 900)]
    comps = [m for m in comps if not (m['k'] == 'col' and m['a'] < (40 if lid in T.SOFT else 12))]
    attach(comps, store, U)
    canvas = (cell.shape[0] * U, cell.shape[1] * U)
    pool = [c for c in comps if c['k'] in ('ink', 'pap') or lid in T.SPLIT_COLOUR]
    rows = word_rows(pool); ids = {id(c) for r in rows for c in r}
    # dots of i, stray bits of a letter: anything small sitting inside a word row is lettering
    for r in rows:
        y0, y1 = min(c['b'][1] for c in r), max(c['b'][3] for c in r); x0, x1 = min(c['b'][0] for c in r), max(c['b'][2] for c in r); hr = np.median([c['b'][3] - c['b'][1] for c in r])
        for c in pool:
            if id(c) not in ids and c['b'][3] - c['b'][1] < .9 * hr and c['b'][1] > y0 - .4 * hr and c['b'][3] < y1 + .4 * hr and c['b'][0] > x0 - .4 * hr and c['b'][2] < x1 + .4 * hr:
                ids.add(id(c)); r.append(c)
    letters = [c for c in comps if id(c) in ids or c['k'] == 'pap' or (c['k'] == 'ink' and lid in RESTORE_MARK and c['b'][3] - c['b'][1] > 40) or (c['k'] == 'col' and lid in KEEP_V1_COLOUR) or (c['k'] == 'ink' and c['a'] < 120)]  # tiny black bits are letter fragments
    lid_set = {id(c) for c in letters}
    srcM = {}                                  # per-fill source masks for the shape score
    src_ink = np.zeros(canvas, bool)
    for c in comps:
        if id(c) in lid_set:
            src_ink |= to_canvas(c, canvas, U)
        elif c['k'] == 'col':
            srcM[c['f']] = srcM.get(c['f'], np.zeros(canvas, bool)) | to_canvas(c, canvas, U)
        else:
            srcM['ink'] = srcM.get('ink', np.zeros(canvas, bool)) | to_canvas(c, canvas, U)
    v1_recs = []; miss = 0
    for c in letters:
        r = v1_match(lid, c)
        if r is None:
            miss += 1; continue
        rr = dict(r); rr['v1'] = 1
        if r['k'] == 'col':
            rr['sw'] = .5
        v1_recs.append(rr); c['rec'] = rr
    keep_mesh = lid in KEEP_V1_COLOUR and any(r.get('f') == 'mesh' for r in v1_recs)
    rest = [c for c in comps if id(c) not in lid_set]
    halo = 0; halo_letters = []
    colpart = [c for c in rest if c['k'] == 'col']
    if colpart and lid not in T.GRADIENT and lid not in ('61',):
        rest = close_gaps(rest, canvas, U, lid, store)
    if lid in REPAIR:
        rest2, halo, halo_letters = repair_bands(rest, rows, lid, canvas, U, store)
        rest = rest2
    for c in rest:
        c['role'] = 'geom' if c['k'] == 'col' and lid not in GRAD else 'mark'
        c['loops'] = fit_comp(c, 'geom' if c['role'] == 'geom' else 'letter', TOL_GEOM if c['role'] == 'geom' else TOL_LETTER)
        c['raw'] = fit_comp(c, 'letter', TOL_LETTER)
    regularise_lines([p for c in rest if c['role'] == 'geom' for lp in c['loops'] for p in lp], reg=True)
    regularise_lines([p for c in rest if c['role'] == 'mark' for lp in c['loops'] for p in lp], reg=False)
    regularise_arcs([lp for c in rest if c['role'] == 'geom' for lp in c['loops']])
    out = []; fallback = 0
    for c in rest:
        v, inter, uni, d, polys = iou(c, c['loops'])
        vr, ir, ur, dr, pr = iou(c, c['raw'])
        if v < max(.72, vr - (.05 if c['a'] > 150 else .1)):
            v, d, polys = vr, dr, pr; fallback += 1
        if not polys:
            continue
        pts = np.vstack(polys)
        rec = {'f': c['f'], 'k': c['k'], 'd': d, 'b': [round(float(pts[:, 0].min()), 1), round(float(pts[:, 1].min()), 1), round(float(pts[:, 0].max()), 1), round(float(pts[:, 1].max()), 1)], 't': c['t'], 'a': c['a'], 'h': 0}
        if c['k'] == 'col' and c['f'] != 'mesh':
            rec['h'] = T.hue_rank(c)
        if c['k'] == 'col' and lid in GRAD:
            sm = np.zeros(cell.shape[:2], bool)
            ys, xs = np.where(ndi.binary_erosion(c['mask'], iterations=U) if c['a'] > 60 else c['mask'])
            sm[np.clip(((ys + .5) / U + c['oy']).astype(int), 0, cell.shape[0] - 1), np.clip(((xs + .5) / U + c['ox']).astype(int), 0, cell.shape[1] - 1)] = True
            rec['_sm'] = sm
        c['rec'] = rec; out.append(rec)
    use_map = False; des = []
    for rec in out:
        if '_sm' in rec:
            g, de = gradient_for(cell, rec['_sm']); des.append((de, rec['a'])); rec['g'] = g; rec['f'] = g['s'][0][1] if g else '#888888'
    if des:
        use_map = sum(a * b for a, b in des) / sum(b for _, b in des) > KEEP_MAP_DE
    gde = round(sum(a * b for a, b in des) / sum(b for _, b in des), 1) if des else None
    for rec in out:
        rec.pop('_sm', None)
        if use_map and rec['k'] == 'col':
            rec['f'] = 'mesh'; rec.pop('g', None)
    mesh = None
    if keep_mesh:
        mesh = V1[lid]['mesh']
    elif use_map:
        cm = np.zeros(cell.shape[:2], bool)
        for c in rest:
            if c['k'] == 'col':
                ys, xs = np.where(c['mask']); cm[np.clip(((ys + .5) / U + c['oy']).astype(int), 0, cell.shape[0] - 1), np.clip(((xs + .5) / U + c['ox']).astype(int), 0, cell.shape[1] - 1)] = True
        mesh = T.mesh_uri(cell, cm)
    # exact primitives, continuous shapes, knock-out masks
    knock = []; departs = None; builder = None
    if halo > .4 and halo_letters:
        knock += [{'d': c['rec']['d'], 'sw': round(2 * halo, 2)} for c in halo_letters if 'rec' in c]
    inkr = [r for r in out if r['k'] != 'col']
    if lid in BUILDERS:
        out = BUILDERS[lid](rest, canvas, U) + inkr; builder = lid
    if lid == '38':
        all_ = rest + [c for c in letters if c['k'] == 'ink']
        bands, knock = build_38(all_, canvas, U); out = bands + inkr; departs = 'smooth flare replaces the source wiggle'
    if lid == '10':
        out = build_10(rest, canvas, U) + inkr; departs = 'J hook removed on request; straight stem'
    if lid == 'D05':
        lets = [c for c in letters if 'rec' in c]
        bands, ya, yb, _ = build_D05(rest, canvas, U, lets); out = bands + inkr
        knock = [{'d': 'M0 %.2fH%dV%.2fH0Z' % (ya, cell.shape[1], yb), 'sw': 0}] + [{'d': c['rec']['d'], 'sw': 9} for c in lets]
    # shape score vs source: everything except the lettering (identical by construction) and its surroundings
    excl = ndi.distance_transform_edt(~src_ink) <= 3 * U
    Is = Us = 0
    for key, M in srcM.items():
        A_ = np.zeros(canvas, bool)
        for r_ in out:
            if (r_['k'] != 'col' and key == 'ink') or (r_['k'] == 'col' and (r_.get('_key', r_['f']) == key or lid in GRAD)):
                A_ |= raster(flatten(r_['d']), canvas, 0, 0, U)
        if lid in ('38', 'D05'):
            for k_ in knock:
                if not k_['sw']:
                    A_ &= ~raster(flatten(k_['d']), canvas, 0, 0, U)
        Is += ((A_ & M) & ~excl).sum(); Us += ((A_ | M) & ~excl).sum()
    all_recs = out + v1_recs
    bb = [min(m['b'][0] for m in all_recs), min(m['b'][1] for m in all_recs), max(m['b'][2] for m in all_recs), max(m['b'][3] for m in all_recs)]
    rep = {'id': lid, 'iou': round(float(Is) / max(float(Us), 1), 4) if Us else None, 'builder': bool(builder), 'departs': departs, 'halo': round(halo, 2), 'knock': len(knock), 'fallback': fallback,
           'v1letters': len(v1_recs), 'v1miss': miss, 'shapes': len(out), 'gradDE': gde, 'colourMap': use_map, 'keepMesh': keep_mesh}
    return {'id': lid, 'w': cell.shape[1], 'h': cell.shape[0], 'bb': bb, 'paper': T.lab2hex(paper), 'mesh': mesh, 'knock': knock, 'comps': out + v1_recs}, rep

CRT_JS = r"""const crtBox=document.getElementById('crt');
try{const v=localStorage.getItem('kosmo-crt');if(v!==null)crtBox.checked=v==='1'}catch(e){}
function applyCrt(el){
  const svg=el.querySelector('svg'),vb=svg.viewBox.baseVal,vw=vb.width,defs=svg.querySelector('defs'),m=vw*.08,id='crtf'+(++maskN);
  const f=svgEl('filter',{id,filterUnits:'userSpaceOnUse',x:vb.x-m,y:vb.y-m,width:vb.width+2*m,height:vb.height+2*m,'color-interpolation-filters':'sRGB'});
  const soft=svgEl('feGaussianBlur',{in:'SourceGraphic',stdDeviation:vw*.0012,result:'soft'}),glow=svgEl('feGaussianBlur',{in:'SourceGraphic',stdDeviation:vw*.012,result:'glow'}),
    cm=svgEl('feColorMatrix',{in:'glow',type:'matrix',values:'1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .45 0',result:'bloom'}),mg=svgEl('feMerge');
  mg.appendChild(svgEl('feMergeNode',{in:'bloom'}));mg.appendChild(svgEl('feMergeNode',{in:'soft'}));[soft,glow,cm,mg].forEach(n=>f.appendChild(n));defs.appendChild(f);
  const g=svgEl('g',{class:'crtg','data-f':id});[...svg.children].filter(c=>c!==defs).forEach(c=>g.appendChild(c));svg.appendChild(g);
  svg.style.overflow='visible';if(crtBox.checked)g.setAttribute('filter',`url(#${id})`);
}
crtBox.onchange=()=>{try{localStorage.setItem('kosmo-crt',crtBox.checked?'1':'0')}catch(e){}
  stage.querySelectorAll('g.crtg').forEach(g=>{if(crtBox.checked)g.setAttribute('filter',`url(#${g.dataset.f})`);else g.removeAttribute('filter')})};
"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--only'); ap.add_argument('--contact')
    a = ap.parse_args(); only = set(a.only.split(',')) if a.only else None
    cache = os.path.join(T.REFS, '.clean.json'); rpath = os.path.join(T.REFS, '.clean-report.json')
    data = json.load(open(cache)) if only and os.path.exists(cache) else {}
    report = json.load(open(rpath)) if only and os.path.exists(rpath) else {}
    global V1
    V1 = load_v1()
    for sh in T.SHEETS:
        path = os.path.join(T.REFS, sh['file'])
        if not os.path.exists(path):
            print('skip (missing)', path); continue
        rgb = np.asarray(Image.open(path).convert('RGB'))
        for lid, cell, lbox in T.cells(sh, rgb):
            if only and lid not in only:
                continue
            d, rep = process(lid, cell, lbox); data[lid] = d; report[lid] = rep
            print(lid, 'shapeIoU', rep['iou'], 'shapes', rep['shapes'], 'v1letters', rep['v1letters'], 'miss', rep['v1miss'], 'fallback', rep['fallback'], 'BUILD' if rep['builder'] else '', rep['departs'] or '', 'knock', rep['knock'], 'grad', rep['gradDE'], 'MAP' if rep['colourMap'] else '', flush=True)
    json.dump(data, open(cache, 'w')); json.dump(report, open(rpath, 'w'), indent=0)
    s = open(os.path.join(HERE, 'traced-v1.html')).read()   # read only: used for the player, styles and page shell
    head = s.index('/* ====', s.index('/*TRACED_DATA_END*/')); tail = s.index('/* every id in TRACED gets')
    s = s[:head] + open(os.path.join(HERE, 'clean-reveals.js')).read() + s[tail:]
    # CRT look: a player-level toggle; thumbnails and buildTraced stay plain
    s = s.replace('<label><input type="checkbox" id="loop"> Loop</label>', '<label><input type="checkbox" id="loop"> Loop</label>\n    <label><input type="checkbox" id="crt" checked> CRT</label>', 1)
    s = s.replace("const el=mk(L.build('s'+cur));stage.appendChild(el);", "const el=mk(L.build('s'+cur));stage.appendChild(el);applyCrt(el);", 1)
    s = s.replace('function show(i){', CRT_JS + 'function show(i){', 1)
    s = s.replace('<title>Kosmographica Traced Reveals</title>', '<title>Kosmographica Clean Reveals</title>')
    js = 'const TRACED=' + json.dumps(data, separators=(',', ':')) + ';'
    s = re.sub(r'/\*TRACED_DATA_START\*/.*?/\*TRACED_DATA_END\*/', lambda _: '/*TRACED_DATA_START*/' + js + '/*TRACED_DATA_END*/', s, flags=re.S)
    open(os.path.join(HERE, 'traced-v2-clean.html'), 'w').write(s)
    print('v2 KB', len(s) // 1024)

if __name__ == '__main__':
    main()
