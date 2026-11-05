#!/usr/bin/env python3
"""Clean geometry for the Star logo (sheet 15): exact circles cut to the half-disc, with the traced letters kept.
Needs shapely. Writes refs/.star-clean.json, which tools/build-logo-loader.mjs uses."""
import json, math, re, os
from shapely.geometry import Point, box

HERE = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(HERE, 'traced-v2-clean.html')).read()
base = json.loads(re.search(r'const TRACED=(\{.*\})', s).group(1))['Star']

CX, CY, RV, RH = 308, 295, 280, 66
QUAD = 96


def circle(a, b, c):
    d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
    q = lambda p: p[0] ** 2 + p[1] ** 2
    x = (q(a) * (b[1] - c[1]) + q(b) * (c[1] - a[1]) + q(c) * (a[1] - b[1])) / d
    y = (q(a) * (c[0] - b[0]) + q(b) * (a[0] - c[0]) + q(c) * (b[0] - a[0])) / d
    return x, y, math.hypot(a[0] - x, a[1] - y)


KX, KY, KR = circle((148, 295), (250, 150), (440, 82))
COLS = ['#e23b2e', '#ec8a35', '#f2c83f', '#58b44a', '#3aa6e0', '#2f5fd0', '#6a2fa8']
RING = 27


def disc(x, y, r):
    return Point(x, y).buffer(max(r, 0.01), quad_segs=QUAD)


dome = disc(CX, CY, RV).difference(disc(CX, CY, RH)).intersection(box(0, -500, 700, CY))


def to_d(g):
    d = ''
    for p in getattr(g, 'geoms', [g]):
        if p.is_empty or p.area < 1:
            continue
        p = p.simplify(0.02)
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)[:-1]
            d += 'M' + 'L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + 'Z'
    return d


def comp(g, k, f, t=0):
    x0, y0, x1, y1 = [round(v, 1) for v in g.bounds]
    return {'f': f, 'k': k, 'd': to_d(g), 'b': [x0, y0, x1, y1], 't': t or round(min(x1 - x0, y1 - y0), 1), 'a': round(g.area), 'h': 0}


comps = [comp(dome.difference(disc(KX, KY, KR)), 'ink', '#0d0d10')]
for i, c in enumerate(COLS):
    ring = dome.intersection(disc(KX, KY, KR - i * RING)).difference(disc(KX, KY, KR - (i + 1) * RING))
    comps.append(comp(ring, 'col', c, RING))
inner = dome.intersection(disc(KX, KY, KR - len(COLS) * RING))
if inner.area > 1:
    comps.append(comp(inner, 'ink', '#0d0d10'))

letters = [c for c in base['comps'] if c['k'] == 'ink' and c['b'][1] > CY - 2]
comps += letters


def star(x, y, r, w):
    d = f'M{x} {y - r}Q{x + w} {y - w} {x + r} {y}Q{x + w} {y + w} {x} {y + r}Q{x - w} {y + w} {x - r} {y}Q{x - w} {y - w} {x} {y - r}Z'
    return {'f': '#fbf4e8', 'k': 'pap', 'd': d, 'b': [x - r, y - r, x + r, y + r], 't': w, 'a': round(r * w * 2), 'h': 0}


comps += [star(263, 97, 28, 4), star(130, 182, 33, 4.6), star(88, 240, 20, 3)]
xs = [c['b'] for c in comps]
out = {**base, 'mesh': None, 'knock': [], 'comps': comps, 'bb': [min(b[0] for b in xs), min(b[1] for b in xs), max(b[2] for b in xs), max(b[3] for b in xs)]}
open(os.path.join(HERE, 'refs/.star-clean.json'), 'w').write(json.dumps(out, separators=(',', ':')))
print('letters', len(letters), 'comps', len(comps), 'bb', out['bb'], 'centre', round(KX), round(KY), round(KR))
