#!/usr/bin/env python3
"""Second cleanup pass for the logos the loader uses. Refits coloured shapes (and frames) with true straight
edges, sharp corners and smooth curves, then lines their edges up across the logo. Lettering is never touched.
Needs svgpathtools, numpy, shapely. Writes refs/.refined.json, which tools/build-logo-loader.mjs uses."""
import json, math, os, re, sys
import numpy as np
from svgpathtools import parse_path
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
def traced(f):
    return json.loads(re.search(r'const TRACED=(\{.*\})', open(os.path.join(HERE, f)).read()).group(1))
V1, V2 = traced('traced-v1.html'), traced('traced-v2-clean.html')

# id: (data, ids of ink shapes that are frames rather than letters are found by width)
TARGETS = {'50': V1, '12': V1, '36': V1, 'D10': V1, '33': V1, '30': V1, '31': V1, 'C05': V1, 'D02': V1, '15': V1,
           '18': V2, 'C03': V2, '42': V2}
FRAME_MIN_W = 300
STEP = 0.5
LINE_DEV, CURVE_TOL = 0.9, 0.55
ANGLE_TOL, HV_TOL = math.radians(2.5), math.radians(2.0)
OFFSET_TOL = 1.2
SHORT_EDGE, SHORT_ANGLE_TOL, SHORT_OFFSET_TOL = 35, math.radians(7), 3.5
MIN_IOU = 0.93


def rings_of(d):
    rings = []
    for sub in parse_path(d).continuous_subpaths():
        pts = []
        for seg in sub:
            n = max(2, int(seg.length() / STEP) + 1)
            pts += [seg.point(t / n) for t in range(n)]
        if len(pts) >= 8:
            rings.append(np.array([[p.real, p.imag] for p in pts]))
    return rings


def turn(v1, v2):
    return abs(math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1 @ v2))


def corners(P):
    """A corner turns sharply while both sides of it stay fairly straight, which is what separates it from a tight curve."""
    n = len(P)
    k = max(2, min(6, n // 16))
    score = np.zeros(n)
    for i in range(n):
        centre = turn(P[i] - P[(i - k) % n], P[(i + k) % n] - P[i])
        left = turn(P[(i - k) % n] - P[(i - 2 * k) % n], P[(i - k // 2) % n] - P[(i - k) % n]) if k > 2 else 0
        right = turn(P[(i + k // 2) % n] - P[i], P[(i + 2 * k) % n] - P[(i + k) % n]) if k > 2 else 0
        before = turn(P[(i - 2 * k) % n] - P[(i - 3 * k) % n], P[(i - k) % n] - P[(i - 2 * k) % n])
        after = turn(P[(i + 2 * k) % n] - P[(i + k) % n], P[(i + 3 * k) % n] - P[(i + 2 * k) % n])
        if centre > math.radians(28) and max(before, after) < 0.45 * centre:
            score[i] = centre
    picks = []
    for i in np.argsort(-score):
        if score[i] <= 0:
            break
        if all(min(abs(i - j), n - abs(i - j)) > 2 * k for j in picks):
            picks.append(int(i))
    return sorted(picks)


def fit_line(Q):
    c = Q.mean(0)
    _, _, vt = np.linalg.svd(Q - c)
    d = vt[0]
    dev = np.abs((Q - c) @ np.array([-d[1], d[0]])).max()
    return c, d, dev


# ---------- cubic Bezier fitting (Schneider) ----------
def bez(c, t):
    t = np.asarray(t)[..., None]
    return (1 - t) ** 3 * c[0] + 3 * (1 - t) ** 2 * t * c[1] + 3 * (1 - t) * t ** 2 * c[2] + t ** 3 * c[3]


def fit_cubic(Q, t1, t2, tol, depth=0):
    if len(Q) < 3:
        d = np.linalg.norm(Q[-1] - Q[0]) / 3
        return [[Q[0], Q[0] + t1 * d, Q[-1] + t2 * d, Q[-1]]]
    u = np.r_[0, np.cumsum(np.linalg.norm(np.diff(Q, axis=0), axis=1))]
    u = u / u[-1]
    c = None
    for _ in range(5):
        A1 = (3 * (1 - u) ** 2 * u)[:, None] * t1
        A2 = (3 * (1 - u) * u ** 2)[:, None] * t2
        base = ((1 - u) ** 3 + 3 * (1 - u) ** 2 * u)[:, None] * Q[0] + (u ** 3 + 3 * (1 - u) * u ** 2)[:, None] * Q[-1]
        r = Q - base
        M = np.array([[(A1 * A1).sum(), (A1 * A2).sum()], [(A1 * A2).sum(), (A2 * A2).sum()]])
        b = np.array([(A1 * r).sum(), (A2 * r).sum()])
        span = np.linalg.norm(Q[-1] - Q[0])
        try:
            a = np.linalg.solve(M, b)
        except np.linalg.LinAlgError:
            a = np.array([span / 3, span / 3])
        if a[0] < 1e-3 * span or a[1] < 1e-3 * span:
            a = np.array([span / 3, span / 3])
        c = [Q[0], Q[0] + t1 * a[0], Q[-1] + t2 * a[1], Q[-1]]
        p = bez(c, u)
        d1 = 3 * ((1 - u) ** 2)[:, None] * (c[1] - c[0]) + 6 * ((1 - u) * u)[:, None] * (c[2] - c[1]) + 3 * (u ** 2)[:, None] * (c[3] - c[2])
        d2 = 6 * (1 - u)[:, None] * (c[2] - 2 * c[1] + c[0]) + 6 * u[:, None] * (c[3] - 2 * c[2] + c[1])
        num = ((p - Q) * d1).sum(1)
        den = (d1 * d1).sum(1) + ((p - Q) * d2).sum(1)
        u = np.clip(u - np.where(np.abs(den) > 1e-9, num / den, 0), 0, 1)
    err = np.linalg.norm(bez(c, u) - Q, axis=1)
    if err.max() <= tol or depth > 7 or len(Q) < 8:
        return [c]
    m = int(np.clip(err.argmax(), 3, len(Q) - 4))
    w = min(5, m, len(Q) - 1 - m)
    tm = Q[m - w] - Q[m + w]
    tm = tm / (np.linalg.norm(tm) or 1)
    return fit_cubic(Q[:m + 1], t1, tm, tol, depth + 1) + fit_cubic(Q[m:], -tm, t2, tol, depth + 1)


def end_tangent(Q, start):
    w = min(8, len(Q) - 1)
    t = Q[w] - Q[0] if start else Q[-1 - w] - Q[-1]
    return t / (np.linalg.norm(t) or 1)


# ---------- shape model: each ring is a list of edges, lines kept as angle + offset so they can be aligned ----------
class Line:
    def __init__(self, c, d, length):
        if d[0] < 0 or (abs(d[0]) < 1e-9 and d[1] < 0):
            d = -d
        self.theta = math.atan2(d[1], d[0])
        self.len = length
        self.rho = self.normal() @ c

    def normal(self):
        return np.array([-math.sin(self.theta), math.cos(self.theta)])

    def direction(self):
        return np.array([math.cos(self.theta), math.sin(self.theta)])


def intersect(a, b):
    M = np.array([a.normal(), b.normal()])
    if abs(np.linalg.det(M)) < 0.15:
        return None
    return np.linalg.solve(M, np.array([a.rho, b.rho]))


def split_ring(P):
    # plain blocks and bars: take the exact rectangle
    x0, x1 = np.percentile(P[:, 0], [2, 98])
    y0, y1 = np.percentile(P[:, 1], [2, 98])
    fill = Polygon(P).buffer(0).area / max(1, (x1 - x0) * (y1 - y0))
    near = lambda cx, cy: np.hypot(P[:, 0] - cx, P[:, 1] - cy).min() < 4.5
    square = all(near(cx, cy) for cx in (x0, x1) for cy in (y0, y1))  # a slanted bar misses its box's corners
    if (max(x1 - x0, y1 - y0) < 60 and fill > 0.82) or (fill > 0.9 and square):
        box = [np.array(v, float) for v in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
        edges = [{'pts': np.vstack([box[i], box[(i + 1) % 4]]), 'line': Line((box[i] + box[(i + 1) % 4]) / 2, (box[(i + 1) % 4] - box[i]) / np.linalg.norm(box[(i + 1) % 4] - box[i]), np.linalg.norm(box[(i + 1) % 4] - box[i]))} for i in range(4)]
        return edges, box
    cs = corners(P)
    n = len(P)
    if not cs:
        return [{'pts': np.r_[P, P[:1]], 'line': None}], []
    edges = []
    for a, b in zip(cs, cs[1:] + [cs[0] + n]):
        Q = P[np.arange(a, b + 1) % n]
        m = min(5, max(0, (len(Q) - 4) // 3))
        trim = Q[m:len(Q) - m] if m else Q
        c, d, dev = fit_line(trim)
        edges.append({'pts': Q, 'line': Line(c, d, np.linalg.norm(Q[-1] - Q[0])) if dev <= LINE_DEV else None})
    return edges, [P[c] for c in cs]


def align(lines):
    """Same angle for nearly parallel edges, one shared line for nearly collinear ones, even spacing for even stacks."""
    wrap = lambda t: (t + math.pi / 2) % math.pi - math.pi / 2
    for l in lines:
        for hv in (0.0, math.pi / 2):
            if abs(wrap(l.theta - hv)) < HV_TOL:
                c = l.normal() * l.rho
                l.theta = hv
                l.rho = l.normal() @ c
    groups = []
    for l in sorted(lines, key=lambda x: -x.len):
        tol = ANGLE_TOL if l.len >= SHORT_EDGE else SHORT_ANGLE_TOL  # short edges have noisy angles
        g = next((g for g in groups if abs(wrap(l.theta - g[0].theta)) < tol), None)
        if g:
            g.append(l)
        else:
            groups.append([l])
    for g in groups:
        ref = g[0].theta
        fixed = ref if ref in (0.0, math.pi / 2) else ref + sum(wrap(l.theta - ref) * l.len for l in g) / sum(l.len for l in g)
        for l in g:
            c = l.normal() * l.rho
            l.theta = fixed
            l.rho = l.normal() @ c
        g.sort(key=lambda l: l.rho)
        tiers = [[g[0]]]
        for l in g[1:]:
            short = l.len < SHORT_EDGE and tiers[-1][-1].len < SHORT_EDGE  # e.g. the cut ends of a stack of stripes
            if l.rho - tiers[-1][-1].rho < (SHORT_OFFSET_TOL if short else OFFSET_TOL):
                tiers[-1].append(l)
            else:
                tiers.append([l])
        rhos = [sum(l.rho * l.len for l in t) / sum(l.len for l in t) for t in tiers]
        if len(rhos) >= 4:
            diffs = np.diff(rhos)
            same = np.abs(diffs - np.median(diffs)) < 0.1 * np.median(diffs)
            odd, even = diffs[::2], diffs[1::2]
            if same.all():
                rhos = list(np.linspace(rhos[0], rhos[-1], len(rhos)))
            elif len(even) >= 2 and (np.abs(odd - np.median(odd)) < 0.1 * np.median(odd)).all() and (np.abs(even - np.median(even)) < 0.15 * np.median(even)).all():
                scale = (rhos[-1] - rhos[0]) / (np.median(odd) * len(odd) + np.median(even) * len(even))
                r, out = rhos[0], [rhos[0]]
                for i in range(len(diffs)):
                    r += scale * (np.median(odd) if i % 2 == 0 else np.median(even))
                    out.append(r)
                rhos = out
        for t, r in zip(tiers, rhos):
            for l in t:
                l.rho = r


def fmt(v):
    return f'{v[0]:.2f} {v[1]:.2f}'


def build_ring(edges, corner_pts):
    if not corner_pts:
        Q = edges[0]['pts']
        t = Q[8] - Q[-9]
        t = t / np.linalg.norm(t)
        parts = fit_cubic(Q, t, -t, CURVE_TOL)
        return 'M' + fmt(parts[0][0]) + ''.join(f'C{fmt(c[1])} {fmt(c[2])} {fmt(c[3])}' for c in parts) + 'Z'
    n = len(edges)
    verts = []
    for i in range(n):
        a, b = edges[i - 1], edges[i]
        v = corner_pts[i]
        if a['line'] and b['line']:
            x = intersect(a['line'], b['line'])
            if x is not None and np.linalg.norm(x - v) < 7:
                v = x
        elif a['line'] or b['line']:
            l = a['line'] or b['line']
            v = v + l.normal() * (l.rho - l.normal() @ v)
        verts.append(np.array(v))
    d = 'M' + fmt(verts[0])
    for i in range(n):
        e, end = edges[i], verts[(i + 1) % n]
        if e['line']:
            d += 'L' + fmt(end)
        else:
            Q = e['pts'].copy()
            m = min(4, (len(Q) - 3) // 3) if len(Q) > 12 else 0
            inner = Q[m:len(Q) - m] if m else Q
            Q2 = np.vstack([verts[i], inner, end])
            for c in fit_cubic(Q2, end_tangent(Q2, True), end_tangent(Q2, False), CURVE_TOL):
                d += f'C{fmt(c[1])} {fmt(c[2])} {fmt(c[3])}'
    return d + 'Z'


def frame_path(d):
    """A frame is two nested rounded rectangles; the radius comes from how much area the corners give up."""
    rings = sorted(rings_of(d), key=lambda r: -Polygon(r).buffer(0).area)[:2]
    out = ''
    for r in rings:
        x0, x1 = np.percentile(r[:, 0], [0.5, 99.5])
        y0, y1 = np.percentile(r[:, 1], [0.5, 99.5])
        spare = max(0, (x1 - x0) * (y1 - y0) - Polygon(r).buffer(0).area)
        rad = math.sqrt(spare / (4 - math.pi))
        rad = 0 if rad < 2 else min(rad, (y1 - y0) / 2)
        if rad:
            out += f'M{x0 + rad:.2f} {y0:.2f}H{x1 - rad:.2f}A{rad:.2f} {rad:.2f} 0 0 1 {x1:.2f} {y0 + rad:.2f}V{y1 - rad:.2f}A{rad:.2f} {rad:.2f} 0 0 1 {x1 - rad:.2f} {y1:.2f}H{x0 + rad:.2f}A{rad:.2f} {rad:.2f} 0 0 1 {x0:.2f} {y1 - rad:.2f}V{y0 + rad:.2f}A{rad:.2f} {rad:.2f} 0 0 1 {x0 + rad:.2f} {y0:.2f}Z'
        else:
            out += f'M{x0:.2f} {y0:.2f}H{x1:.2f}V{y1:.2f}H{x0:.2f}Z'
    return out


def poly(d):
    out = None
    for r in rings_of(d):
        p = Polygon(r).buffer(0)
        out = p if out is None else out.symmetric_difference(p)
    return out if out is not None else Polygon()


def refine(L):
    shapes, lines, frames = [], [], []
    for i, c in enumerate(L['comps']):
        is_frame = c['k'] == 'ink' and c['b'][2] - c['b'][0] >= FRAME_MIN_W and c['b'][3] - c['b'][1] >= 60
        if c['k'] != 'col' and not is_frame:
            continue
        if is_frame:
            frames.append(i)
            continue
        rs = [split_ring(r) for r in rings_of(c['d'])]
        shapes.append((i, rs))
        for edges, _ in rs:
            lines += [e['line'] for e in edges if e['line']]
    for l in lines:
        l.own = (l.theta, l.rho)
    align(lines)
    comps, report = [dict(c) for c in L['comps']], []
    for i, rs in shapes:
        old = L['comps'][i]
        d = ''.join(build_ring(e, cp) for e, cp in rs)
        a, b = poly(old['d']), poly(d)
        iou = a.intersection(b).area / max(1, a.union(b).area)
        if iou < MIN_IOU:  # lining up moved this one too far: use its own straightened edges instead
            for edges, _ in rs:
                for e in edges:
                    if e['line']:
                        e['line'].theta, e['line'].rho = e['line'].own
            d = ''.join(build_ring(e, cp) for e, cp in rs)
            b = poly(d)
            iou = a.intersection(b).area / max(1, a.union(b).area)
        if iou < MIN_IOU or not b.is_valid or b.is_empty:
            report.append((i, round(iou, 3), 'kept'))
            continue
        minx, miny, maxx, maxy = b.bounds
        comps[i].update(d=d, b=[round(minx, 1), round(miny, 1), round(maxx, 1), round(maxy, 1)])
        report.append((i, round(iou, 3), 'ok'))
    for i in frames:
        comps[i]['d'] = frame_path(L['comps'][i]['d'])
        a, b = poly(L['comps'][i]['d']), poly(comps[i]['d'])
        report.append((i, round(a.intersection(b).area / max(1, a.union(b).area), 3), 'frame'))
    return {**L, 'comps': comps}, report


out = {}
for lid, src in TARGETS.items():
    L, rep = refine(src[lid])
    out[lid] = L
    kept = [r for r in rep if r[2] == 'kept']
    size = lambda X: sum(len(c['d']) for c in X['comps'] if c['k'] == 'col')
    print(lid, 'shapes', len(rep), 'lowest IoU', min((r[1] for r in rep), default=None), 'kept', kept, 'path bytes', size(src[lid]), '->', size(L))
    assert [c['d'] for c in src[lid]['comps'] if c['k'] == 'ink' and c['b'][2] - c['b'][0] < FRAME_MIN_W] == [c['d'] for c in L['comps'] if c['k'] == 'ink' and c['b'][2] - c['b'][0] < FRAME_MIN_W], 'lettering changed'


def box_comp(f, x0, y0, x1, y1):
    return {'f': f, 'k': 'col', 'd': f'M{x0:g} {y0:g}H{x1:g}V{y1:g}H{x0:g}Z', 'b': [x0, y0, x1, y1], 't': round(min(x1 - x0, y1 - y0), 1), 'a': round((x1 - x0) * (y1 - y0)), 'h': 0}


def pixels_42():
    """Logo 42 is a pixel grid, so it is redrawn as one: exact flat squares read off the source, each its own shape."""
    R, O, Y, G, B = '#e5463f', '#ee903c', '#f5d147', '#78c362', '#4281e5'
    x = lambda k: 149 + k * 21.5
    y = lambda m: 91.5 - m * 21.5
    cells = [(0, 0, R), (1, 0, O), (2, 0, Y), (3, 0, G), (4, 0, B),
             (1, 1, R), (2, 1, O), (3, 1, Y), (4, 1, G), (5, 1, B),
             (2, 2, R), (3, 2, O), (5, 2, G), (6, 2, B),
             (4, 3, Y)]
    grid = [box_comp(f, x(k), y(m), x(k + 1), y(m - 1)) for k, m, f in cells]
    loose = [box_comp('#565fd5', 301, 28, 320, 47), box_comp('#7933bb', 322, 48.5, 342, 68.5),
             box_comp('#453fc0', 301, 70, 320, 89), box_comp('#7933bb', 344, 14, 363, 33)]
    L = V2['42']
    return {**L, 'mesh': None, 'comps': grid + loose + [c for c in L['comps'] if c['k'] != 'col']}


def ramp_D02():
    """D02's bars: equal widths and gaps, one flat base, and tops that all sit on one straight ramp."""
    L = V1['D02']
    bars = sorted([c for c in L['comps'] if c['k'] == 'col'], key=lambda c: c['b'][0])
    n, x0, x1 = len(bars), bars[0]['b'][0], bars[-1]['b'][2]
    gap = float(np.median([b['b'][0] - a['b'][2] for a, b in zip(bars, bars[1:])]))
    w = (x1 - x0 - gap * (n - 1)) / n
    base = float(np.median([c['b'][3] for c in bars]))
    slope, icpt = np.polyfit([c['b'][2] for c in bars], [c['b'][1] for c in bars], 1)
    top = lambda v: slope * v + icpt
    made = {}
    for i, c in enumerate(bars):
        a, e = x0 + i * (w + gap), x0 + i * (w + gap) + w
        made[id(c)] = {**c, 'd': f'M{a:.2f} {top(a):.2f}L{e:.2f} {top(e):.2f}V{base:.2f}H{a:.2f}Z', 'b': [round(a, 1), round(min(top(a), top(e)), 1), round(e, 1), round(base, 1)]}
    return {**L, 'comps': [made.get(id(c), c) for c in L['comps']]}


# ---------- constructed groups: one set of shared edges, angles and spacing, and every bar is built from it ----------
from shapely.geometry import LineString, box as sbox

def cols(L):
    return [c for c in L['comps'] if c['k'] == 'col']

def put(L, made):
    """made: list of (comp, path). Bounds come from the new path; everything else on the comp is kept."""
    swap = {}
    for c, d in made:
        x0, y0, x1, y1 = poly(d).bounds
        swap[id(c)] = {**c, 'd': d, 'b': [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)]}
    return {**L, 'comps': [swap.get(id(c), c) for c in L['comps']]}

def pts(*p):
    return 'M' + 'L'.join(f'{x:.2f} {y:.2f}' for x, y in p) + 'Z'

def even(a, b, n, gap):
    w = (b - a - gap * (n - 1)) / n
    return [(a + i * (w + gap), a + i * (w + gap) + w) for i in range(n)]

def gaps(sorted_vals):
    g = float(np.median([b[0] - a[1] for a, b in zip(sorted_vals, sorted_vals[1:])]))
    return 0.0 if g < 1.6 else g

def row_of_blocks(L, group=None):
    bars = sorted(group or cols(L), key=lambda c: c['b'][0])
    y0, y1 = float(np.median([c['b'][1] for c in bars])), float(np.median([c['b'][3] for c in bars]))
    xs = even(bars[0]['b'][0], bars[-1]['b'][2], len(bars), gaps([(c['b'][0], c['b'][2]) for c in bars]))
    return [(c, f'M{a:.2f} {y0:.2f}H{e:.2f}V{y1:.2f}H{a:.2f}Z') for c, (a, e) in zip(bars, xs)]

def stack_of_blocks(L):
    bars = sorted(cols(L), key=lambda c: c['b'][1])
    x0, x1 = float(np.median([c['b'][0] for c in bars])), float(np.median([c['b'][2] for c in bars]))
    ys = even(bars[0]['b'][1], bars[-1]['b'][3], len(bars), gaps([(c['b'][1], c['b'][3]) for c in bars]))
    return [(c, f'M{x0:.2f} {a:.2f}H{x1:.2f}V{e:.2f}H{x0:.2f}Z') for c, (a, e) in zip(bars, ys)]

def span_at(c, y):
    """Left and right edge of a shape at height y."""
    hit = poly(c['d']).intersection(LineString([(-2000, y), (4000, y)]))
    return hit.bounds[0], hit.bounds[2]

def slanted_row(L, group, clip=False):
    """Side-by-side parallelograms: one top line, one base line, one slant, even widths."""
    bars = sorted(group, key=lambda c: c['b'][0])
    y0, y1 = float(np.median([c['b'][1] for c in bars])), float(np.median([c['b'][3] for c in bars]))
    h = y1 - y0
    inner = bars[1:-1] if clip and len(bars) > 3 else bars
    hi, lo = y0 + h * 0.15, y1 - h * 0.15
    slopes = []
    for c in inner:
        (a1, e1), (a2, e2) = span_at(c, hi), span_at(c, lo)
        slopes += [(a2 - a1) / (lo - hi), (e2 - e1) / (lo - hi)]
    slope = float(np.median(slopes))
    top = lambda c, v: v - slope * (span_y - y0)
    tops = []
    for c in bars:
        span_y = y0 + h * 0.5
        a, e = span_at(c, span_y)
        tops.append((a - slope * (span_y - y0), e - slope * (span_y - y0)))
    xs = even(tops[0][0], tops[-1][1], len(bars), gaps(tops))
    made, x_min, x_max = [], min(c['b'][0] for c in bars), max(c['b'][2] for c in bars)
    for c, (a, e) in zip(bars, xs):
        p = [(a, y0), (e, y0), (e + slope * h, y1), (a + slope * h, y1)]
        if clip:
            g = Polygon(p).intersection(sbox(x_min, y0, x_max, y1))
            p = list(g.exterior.coords)[:-1]
        made.append((c, pts(*p)))
    return made

def slanted_stack(L):
    """Stacked stripes: even heights, and every cut end on one shared line."""
    bars = sorted(cols(L), key=lambda c: c['b'][1])
    ys = even(bars[0]['b'][1], bars[-1]['b'][3], len(bars), gaps([(c['b'][1], c['b'][3]) for c in bars]))
    left, right = [], []
    for c, (a, e) in zip(bars, ys):
        m = (a + e) / 2
        l, r = span_at(c, m)
        left.append((m, l)); right.append((m, r))
    sl, il = np.polyfit(*zip(*left), 1)
    sr, ir = np.polyfit(*zip(*right), 1)
    # both ends take the same angle, so every band is a true parallelogram
    sl = sr = (sl + sr) / 2
    il = float(np.mean([x - sl * y for y, x in left])); ir = float(np.mean([x - sr * y for y, x in right]))
    return [(c, pts((sl * a + il, a), (sr * a + ir, a), (sr * e + ir, e), (sl * e + il, e))) for c, (a, e) in zip(bars, ys)]

def chevrons(L):
    """Nested chevrons: one top line, one base line, one vertex height, shared arm angles, even thickness."""
    bars = sorted(cols(L), key=lambda c: c['b'][0])
    T, B = float(np.median([c['b'][1] for c in bars])), float(np.median([c['b'][3] for c in bars]))
    rows = np.linspace(T + 3, B - 3, 81)
    spans = [np.array([span_at(c, y) for y in rows]) for c in bars]
    point_left = np.median([s[:, 0][len(rows) // 2] - (s[0, 0] + s[-1, 0]) / 2 for s in spans]) < 0
    edge = 0 if point_left else 1
    Yv = float(np.median([rows[(s[:, edge].argmin() if point_left else s[:, edge].argmax())] for s in spans]))
    up = rows < Yv - 6; dn = rows > Yv + 6
    su = float(np.median([np.polyfit(rows[up], s[up, k], 1)[0] for s in spans for k in (0, 1)]))
    sd = float(np.median([np.polyfit(rows[dn], s[dn, k], 1)[0] for s in spans for k in (0, 1)]))
    if abs(abs(su) - abs(sd)) < 0.06:  # same angle above and below, mirrored
        m = (abs(su) + abs(sd)) / 2
        su, sd = math.copysign(m, su), math.copysign(m, sd)
    # where each edge would reach the vertex height, read from both arms
    at_v = lambda s, k: float(np.mean(np.r_[s[up, k] + su * (Yv - rows[up]), s[dn, k] - sd * (rows[dn] - Yv)]))
    lefts, rights = [at_v(s, 0) for s in spans], [at_v(s, 1) for s in spans]
    xs = even(lefts[0], rights[-1], len(bars), gaps(list(zip(lefts, rights))))
    made = []
    for c, (a, e) in zip(bars, xs):
        ax, ex = (lambda x: x + su * (T - Yv)), (lambda x: x + sd * (B - Yv))
        made.append((c, pts((ax(a), T), (ax(e), T), (e, Yv), (ex(e), B), (ex(a), B), (a, Yv))))
    return made

def corner_turn(L):
    """Stripes turning a corner: concentric elliptical arcs, even thickness on each run, flat ends on shared lines."""
    bars = sorted(cols(L), key=lambda c: c['b'][1])
    n = len(bars)
    X = float(np.median([c['b'][2] for c in bars])); Y = float(np.median([c['b'][3] for c in bars]))
    tops = [c['b'][1] for c in bars]; lefts = [c['b'][0] for c in bars]
    ty = float(np.polyfit(range(n), tops, 1)[0]); tx = float(np.polyfit(range(n), lefts, 1)[0])
    y0 = float(np.median([t - i * ty for i, t in enumerate(tops)])); x0 = float(np.median([l - i * tx for i, l in enumerate(lefts)]))
    def path(i, R, k):
        rx = lambda j: max(3.0, R - j * tx); ry = lambda j: max(3.0, R * k - j * ty)
        xa, ya, xb, yb = x0 + i * tx, y0 + i * ty, x0 + (i + 1) * tx, y0 + (i + 1) * ty
        return (f'M{X:.2f} {ya:.2f}H{xa + rx(i):.2f}A{rx(i):.2f} {ry(i):.2f} 0 0 0 {xa:.2f} {ya + ry(i):.2f}V{Y:.2f}H{xb:.2f}'
                f'V{yb + ry(i + 1):.2f}A{rx(i + 1):.2f} {ry(i + 1):.2f} 0 0 1 {xb + rx(i + 1):.2f} {yb:.2f}H{X:.2f}Z')
    src = [poly(c['d']) for c in bars]
    best = None
    for R in np.arange(n * tx + 4, n * tx + 90, 3):
        for k in (0.9, 1.0, 1.1, 1.25):
            score = 0
            for i, a in enumerate(src):
                b = poly(path(i, R, k))
                score += a.intersection(b).area / max(1, a.union(b).area)
            if best is None or score > best[0]:
                best = (score, R, k)
    return [(c, path(i, best[1], best[2])) for i, c in enumerate(bars)]

def snap_right_ends(L):
    """Long stripes ending on the right: every end on one vertical line."""
    bars = cols(L)
    long_ = [c for c in bars if c['b'][2] - c['b'][0] > 100]
    X = float(np.median([c['b'][2] for c in long_]))
    made = []
    for c in long_:
        def fix(m):
            x = float(m.group(1))
            return f'{X:.2f} {m.group(2)}' if abs(x - c['b'][2]) < 6 else m.group(0)
        made.append((c, re.sub(r'(-?\d+\.\d+) (-?\d+\.\d+)', fix, c['d'])))
    return made

def two_rows(L):
    bars = cols(L)
    mid = (min(c['b'][1] for c in bars) + max(c['b'][3] for c in bars)) / 2
    return slanted_row(L, [c for c in bars if c['b'][3] < mid + 1]) + slanted_row(L, [c for c in bars if c['b'][1] > mid - 1])

BUILD = {'30': (V1, row_of_blocks), 'C03': (V2, row_of_blocks), '12': (V1, row_of_blocks), '31': (V1, stack_of_blocks),
         '33': (V1, slanted_stack), '18': (V2, two_rows), 'C05': (V1, lambda L: slanted_row(L, cols(L), clip=True)),
         '50': (V1, chevrons), '15': (V1, chevrons), '36': (V1, corner_turn)}
for lid, (src, fn) in BUILD.items():
    base = {**src[lid], 'comps': out[lid]['comps']}  # frames already cleaned; coloured shapes rebuilt from the source below
    made = fn(src[lid])
    index = {id(c): i for i, c in enumerate(src[lid]['comps'])}
    comps = list(base['comps'])
    rep = []
    for c, d in made:
        i = index[id(c)]
        a, b = poly(c['d']), poly(d)
        rep.append(round(a.intersection(b).area / max(1, a.union(b).area), 3))
        x0, y0, x1, y1 = b.bounds
        comps[i] = {**c, 'd': d, 'b': [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)]}
    out[lid] = {**base, 'comps': comps}
    print('built', lid, 'shapes', len(made), 'IoU', min(rep), '-', max(rep))
out['D10'] = put(out['D10'], snap_right_ends(out['D10']))
out['42'] = pixels_42()
out['D02'] = ramp_D02()
open(os.path.join(HERE, 'refs/.refined.json'), 'w').write(json.dumps(out, separators=(',', ':')))
