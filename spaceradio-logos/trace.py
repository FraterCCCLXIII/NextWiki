#!/usr/bin/env python3
"""Trace every SpaceRadio crop (.cache/crops) into layered vector parts (.cache/traced/<name>.json).

Method (see also ../kosmographica-logos/trace.py):
  * crop upscaled 4x (Lanczos) so potrace sees smooth edges
  * flat logos: Lab k-means colours from low-gradient pixels, every pixel goes to the nearest colour or paper
    (the boundary lands halfway between two colours), anti-alias slivers between colours are handed back
  * gradient / chrome logos: many more colours (stacked layers) over a silhouette base layer, so no seams
  * each connected piece is traced with potrace (real curve fitting, no polygonising)
  * pieces that sit under a smaller piece are extended beneath it ("behind the text") so they never look
    broken while the text is still hidden
  * geometry pass: straight-sided pieces become exact polygons, round pieces exact ellipses/rings, with shared
    angles and shared edges snapped across the logo; every fit is checked against the traced mask (IoU) and
    falls back to the plain trace when it scores low
Usage: venv/bin/python trace.py [--only 14_05,12_01] [--force] [-j N]
"""
import argparse, json, math, os, subprocess, sys
os.environ.setdefault("DYLD_FALLBACK_LIBRARY_PATH", "/opt/homebrew/lib")
from multiprocessing import Pool
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi
from scipy.cluster.vq import kmeans2

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
CROPS = os.path.join(CACHE, 'crops')
OUT = os.path.join(CACHE, 'traced')
POTRACE = '/opt/homebrew/bin/potrace'
U = 4                                  # upscale before tracing

# forced mode per logo ('grad' = stacked-layer logo); everything else is decided automatically
# chrome / gradient logos that the automatic score may call flat: the 1980s, 2000s and 2020s rows of sheet 14 plus a few 1990s ones
SIGMA = {'14_40': .9}               # per-logo smoothing (4x px) for hairline lettering
GRAD = {'14_%02d' % n for n in list(range(19, 25)) + list(range(31, 37)) + list(range(43, 49)) + [7, 18, 25, 26, 27, 29]} | {'13_01', '13_27', '15_02', '15_08', '15_13'}
FLAT = set()
GEOM_IOU = .985                        # minimum IoU for a polygon / ellipse to replace the plain trace
BLEED = .3                             # src px an under-layer is extended beneath its neighbour

# ---------------------------------------------------------------- colour helpers

def rgb2lab(a):
    a = a / 255.0
    a = np.where(a > .04045, ((a + .055) / 1.055) ** 2.4, a / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    xyz = a @ M.T / np.array([.9505, 1, 1.089])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1).astype(np.float32)


def lab2hex(lab):
    fy = (lab[0] + 16) / 116; fx = lab[1] / 500 + fy; fz = fy - lab[2] / 200
    d = lambda t: t ** 3 if t ** 3 > .008856 else (t - 16 / 116) / 7.787
    xyz = np.array([d(fx) * .9505, d(fy), d(fz) * 1.089])
    M = np.array([[3.2406, -1.5372, -.4986], [-.9689, 1.8758, .0415], [.0557, -.204, 1.057]])
    c = np.clip(M @ xyz, 0, 1)
    c = np.where(c > .0031308, 1.055 * c ** (1 / 2.4) - .055, 12.92 * c)
    return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)

# ---------------------------------------------------------------- potrace

def fnum(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    if s in ('-0', ''):
        s = '0'
    if s.startswith('0.'):
        s = s[1:]
    elif s.startswith('-0.'):
        s = '-' + s[2:]
    return s


def join_nums(vals):
    out = ''
    for v in vals:
        s = fnum(v)
        out += s if (not out or s[0] == '-') else ' ' + s
        if out and not out[-1].isspace() and False:
            pass
    return out


def potrace_path(mask, ox, oy):
    """Trace a boolean mask (4x pixels) whose top-left is at pixel (ox, oy) of the upscaled image.
    Returns an SVG path d in source-crop px, using potrace's fitted Beziers (corners stay corners)."""
    m = np.pad(mask, 2)
    H, W = m.shape
    pbm = b'P4\n%d %d\n' % (W, H) + np.packbits(m, axis=1).tobytes()
    r = subprocess.run([POTRACE, '-b', 'svg', '-t', '6', '-a', '1.0', '-O', '0.4', '-u', '10', '-o', '-', '-'],
                       input=pbm, capture_output=True)
    svg = r.stdout.decode()
    a = svg.find(' d="')
    if a < 0:
        return ''
    d = svg[a + 4:svg.index('"', a + 4)].replace('\n', ' ')
    import re
    toks = re.findall(r'[MmCcLlZz]|-?\d+(?:\.\d+)?', d)
    # potrace units: 1/10 of an (upscaled) pixel, y flipped
    def pt(X, Y):
        return ((X * .1 - 2 + ox) / U, ((H - Y * .1) - 2 + oy) / U)
    out, cur, start, cmd, i = [], (0., 0.), (0., 0.), None, 0
    rx = ry = None
    def emit_abs(p):
        return round(p[0], 2), round(p[1], 2)
    last = (0., 0.)
    res = []
    while i < len(toks):
        t = toks[i]
        if t in 'MmCcLlZz' and not t[0].isdigit() and t[0] != '-':
            cmd = t; i += 1
            if cmd in 'Zz':
                res.append('z'); cur = start; last = emit_abs(pt(*start)) if False else last
                continue
        if cmd in 'Mm':
            x, y = float(toks[i]), float(toks[i + 1]); i += 2
            if cmd == 'm':
                x += cur[0]; y += cur[1]
            cur = (x, y); start = cur
            a_ = emit_abs(pt(x, y))
            res.append('M' + join_nums(a_)); last = a_
            cmd = 'l' if cmd == 'm' else 'L'
        elif cmd in 'Ll':
            x, y = float(toks[i]), float(toks[i + 1]); i += 2
            if cmd == 'l':
                x += cur[0]; y += cur[1]
            cur = (x, y)
            a_ = emit_abs(pt(x, y))
            res.append('l' + join_nums((a_[0] - last[0], a_[1] - last[1]))); last = a_
        else:  # curve
            v = [float(toks[i + k]) for k in range(6)]; i += 6
            if cmd == 'c':
                p = [(cur[0] + v[0], cur[1] + v[1]), (cur[0] + v[2], cur[1] + v[3]), (cur[0] + v[4], cur[1] + v[5])]
            else:
                p = [(v[0], v[1]), (v[2], v[3]), (v[4], v[5])]
            q = [emit_abs(pt(*pp)) for pp in p]
            res.append('c' + join_nums([q[0][0] - last[0], q[0][1] - last[1], q[1][0] - last[0], q[1][1] - last[1], q[2][0] - last[0], q[2][1] - last[1]]))
            last = q[2]; cur = p[2]
        # after z the next 'm' is relative to the subpath start: handled by cur = start above
    return ''.join(res)

# ---------------------------------------------------------------- small utils

def smooth_mask(m, sigma):
    if not m.any():
        return m
    ys, xs = np.where(m)
    pad = int(sigma * 4) + 2
    y0, y1 = max(0, ys.min() - pad), min(m.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(m.shape[1], xs.max() + 1 + pad)
    f = ndi.gaussian_filter(m[y0:y1, x0:x1].astype(np.float32), sigma)
    out = np.zeros_like(m)
    out[y0:y1, x0:x1] = f > .5
    return out


def bbox_of(mask):
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def edt_thick(m):
    return 2 * float(ndi.distance_transform_edt(np.pad(m, 1)).max()) / U

# ---------------------------------------------------------------- text rows / roles

def detect_roles(items):
    """Mark items that sit in a row of letters ('w') versus marks ('m'). Rows get an index."""
    for it in items:
        it['r'] = 'm'; it['row'] = -1
    cand = [it for it in items if not it.get('rule')]
    cand.sort(key=lambda it: (it['b'][1] + it['b'][3]) / 2)
    groups = []
    for it in cand:
        b = it['b']; h = b[3] - b[1]; cy = (b[1] + b[3]) / 2
        placed = False
        for g in groups:
            gcy = float(np.median([(x['b'][1] + x['b'][3]) / 2 for x in g['items']]))
            gh = float(np.median([x['b'][3] - x['b'][1] for x in g['items']]))
            if abs(cy - gcy) <= .5 * max(min(h, gh * 1.6), gh * .6):
                g['items'].append(it); placed = True
                break
        if not placed:
            groups.append({'items': [it]})
    row_no = 0
    for g in groups:
        its = sorted(g['items'], key=lambda it: it['b'][0])
        if len(its) < 3:
            continue
        side = 0
        for a, b in zip(its, its[1:]):
            ov = min(a['b'][2], b['b'][2]) - max(a['b'][0], b['b'][0])
            if ov < .45 * min(a['b'][2] - a['b'][0], b['b'][2] - b['b'][0]):
                side += 1
        if side < .7 * (len(its) - 1):
            continue
        ws = np.array([it['b'][2] - it['b'][0] for it in its]); hs = np.array([it['b'][3] - it['b'][1] for it in its])
        if len(its) >= 4 and ws.std() / ws.mean() < .12 and hs.std() / hs.mean() < .12:
            continue                      # evenly sized repeats (ticks, checks, dots) are marks, not letters
        for it in its:
            it['r'] = 'w'; it['row'] = row_no
        row_no += 1
    return items

# ---------------------------------------------------------------- geometry (polygons / ellipses)

def line_from_pts(P):
    c = P.mean(0)
    u, s, vt = np.linalg.svd(P - c, full_matrices=False)
    d = vt[0]
    th = math.atan2(d[1], d[0]) % math.pi
    n = np.array([-math.sin(th), math.cos(th)])
    return th, float(c @ n)


def intersect(l1, l2):
    th1, c1 = l1; th2, c2 = l2
    n1 = np.array([-math.sin(th1), math.cos(th1)]); n2 = np.array([-math.sin(th2), math.cos(th2)])
    A = np.array([n1, n2]); det = np.linalg.det(A)
    if abs(det) < .05:
        return None
    return np.linalg.solve(A, np.array([c1, c2]))


def _wrap(a):
    return (a + math.pi) % (2 * math.pi) - math.pi


def fit_polygon_contour(cnt, w=4, straight_deg=11., min_run=6., max_curved=.18):
    """Split a closed pixel contour into straight runs (constant tangent) joined by corners / curves.
    Returns [(theta, c)] lines in order, or None when the outline is not mostly straight."""
    pts = cnt.reshape(-1, 2).astype(float)
    if len(pts) < 30:
        return None
    q = np.vstack([pts, pts[:1]])
    seg = np.hypot(*np.diff(q, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    L = s[-1]
    M = int(L)
    if M < 30:
        return None
    t = np.linspace(0, L, M, endpoint=False)
    P = np.stack([np.interp(t, s, q[:, 0]), np.interp(t, s, q[:, 1])], 1)
    k = 5
    ker = np.ones(k) / k
    P = np.stack([np.convolve(np.r_[P[-k:, 0], P[:, 0], P[:k, 0]], ker, 'same')[k:-k],
                  np.convolve(np.r_[P[-k:, 1], P[:, 1], P[:k, 1]], ker, 'same')[k:-k]], 1)
    idx = np.arange(M)
    fw = P[(idx + w) % M] - P; bw = P - P[(idx - w) % M]
    af = np.arctan2(fw[:, 1], fw[:, 0]); ab = np.arctan2(bw[:, 1], bw[:, 0])
    straight = np.abs(_wrap(af - ab)) < math.radians(straight_deg)
    if straight.sum() < (1 - max_curved) * M * .5:
        return None
    # circular runs of straight points
    if straight.all():
        return None
    start = int(np.argmin(straight))            # a non-straight index to rotate to
    order = np.roll(idx, -start)
    runs, cur = [], []
    for i in order:
        if straight[i]:
            cur.append(i)
        elif cur:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    lines = []
    for r in runs:
        if len(r) < min_run:
            continue
        R = P[r[2:-2]] if len(r) > 14 else P[r]
        th, c = line_from_pts(R)
        dv = P[r[-1]] - P[r[0]]
        trav = math.atan2(dv[1], dv[0])           # travel direction (keeps antiparallel sides apart)
        lines.append({'th': th, 'c': c, 'first': r[0], 'last': r[-1], 'n': len(r), 'trav': trav})
    if len(lines) < 3:
        return None
    # merge neighbours that continue the same line (noise broke the run)
    merged = True
    while merged and len(lines) > 3:
        merged = False
        for i in range(len(lines)):
            a, b = lines[i], lines[(i + 1) % len(lines)]
            dth = abs(_wrap(a['trav'] - b['trav']))
            nb = np.array([-math.sin(a['th']), math.cos(a['th'])])
            ptb = (P[b['first']] + P[b['last']]) / 2
            if dth < math.radians(4) and abs(float(ptb @ nb) - a['c']) < 2.0:
                R = np.vstack([P[a['first']:a['last'] + 1] if a['first'] <= a['last'] else np.vstack([P[a['first']:], P[:a['last'] + 1]]),
                               P[b['first']:b['last'] + 1] if b['first'] <= b['last'] else np.vstack([P[b['first']:], P[:b['last'] + 1]])])
                th, c = line_from_pts(R)
                lines[i] = {'th': th, 'c': c, 'first': a['first'], 'last': b['last'], 'n': a['n'] + b['n'], 'trav': a['trav']}
                del lines[(i + 1) % len(lines)]
                merged = True
                break
    # curved share: contour not covered by the kept runs
    cov = sum(l['n'] for l in lines)
    if cov < (1 - max_curved) * M:
        return None
    if not 3 <= len(lines) <= 14:
        return None
    return [(l['th'], l['c']) for l in lines]


def rect_lines(m_u8):
    """minAreaRect of the largest contour as four lines."""
    cs, _ = cv2.findContours(m_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return None
    c = max(cs, key=cv2.contourArea)
    (cx, cy), (rw, rh), ang = cv2.minAreaRect(c)
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    vx, vy = -uy, ux
    corners = [(cx + sx * rw / 2 * ux + sy * rh / 2 * vx, cy + sx * rw / 2 * uy + sy * rh / 2 * vy) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    ls = []
    for i in range(4):
        p, q_ = np.array(corners[i]), np.array(corners[(i + 1) % 4])
        d = q_ - p
        th = math.atan2(d[1], d[0]) % math.pi
        n = np.array([-math.sin(th), math.cos(th)])
        ls.append((th, float(p @ n)))
    return ls


def lines_to_poly(ls):
    V = []
    for i in range(len(ls)):
        v = intersect(ls[i - 1], ls[i])
        if v is None:
            return None
        V.append(v)
    return np.array(V)


def poly_path(V):
    s = 'M' + join_nums((V[0] / U).tolist())
    for v in V[1:]:
        s += 'L' + join_nums((v / U).tolist())
    return s + 'Z'


def poly_area(V):
    x, y = V[:, 0], V[:, 1]
    return .5 * (np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def raster_polys(polys, shape, off):
    img = np.zeros(shape, np.uint8)
    tmp = np.zeros(shape, np.uint8)
    for P in polys:
        tmp[:] = 0
        cv2.fillPoly(tmp, [np.round((P - off) * 16).astype(np.int32).reshape(-1, 1, 2)], 1, shift=4)
        img ^= tmp
    return img.astype(bool)


def ellipse_path(cx, cy, rx, ry, rot):
    cx, cy, rx, ry = cx / U, cy / U, rx / U, ry / U
    a = math.radians(rot)
    ux, uy = math.cos(a) * rx, math.sin(a) * rx
    p0 = (cx - ux, cy - uy); p1 = (cx + ux, cy + uy)
    r = '%s %s %s' % (fnum(rx), fnum(ry), fnum(rot))
    return 'M%s A%s 1 1 %s A%s 1 1 %s Z' % (join_nums(p0), r, join_nums(p1), r, join_nums(p0))


def iou(a, b):
    u = (a | b).sum()
    return float((a & b).sum()) / u if u else 0.


def fit_geometry(item, owner, z):
    """Try polygon (then ellipse/ring) for one item. Fills item['geo'] = dict or None."""
    m = item['m']; ox, oy = item['o']
    mu = np.pad(m, 3).astype(np.uint8)
    cnts, hier = cv2.findContours(mu, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if not cnts or len(cnts) > 4:
        return None
    off = np.array([ox - 3, oy - 3], float)
    holes = [i for i in range(len(cnts)) if hier[0][i][3] >= 0]
    outers = [i for i in range(len(cnts)) if hier[0][i][3] < 0]
    if len(outers) != 1:
        return None
    # --- polygon
    all_lines = []
    ok = True
    for ci in outers + holes:
        c = cnts[ci].reshape(-1, 2).astype(float) + off
        ls = fit_polygon_contour(c - off)
        if ls is None and len(cnts) == 1:
            ls = rect_lines(mu)
            if ls is not None:
                ls = [(t_, c_ + (np.array([-math.sin(t_), math.cos(t_)]) @ off)) for t_, c_ in ls]
        elif ls is not None:
            ls = [(t_, c_ + (np.array([-math.sin(t_), math.cos(t_)]) @ off)) for t_, c_ in ls]
        if ls is None:
            ok = False; break
        all_lines.append((ci in holes, ls, c))
    if ok:
        polys = []
        for ci_, (ishole, ls, c) in enumerate(all_lines):
            V = lines_to_poly(ls)
            if V is None and len(all_lines) == 1:
                rl = rect_lines(mu)
                if rl is not None:
                    ls = [(t_, c_ + (np.array([-math.sin(t_), math.cos(t_)]) @ off)) for t_, c_ in rl]
                    all_lines[ci_] = (ishole, ls, c)
                    V = lines_to_poly(ls)
            if V is None:
                ok = False; break
            polys.append(V)
        if ok:
            ras = raster_polys(polys, mu.shape, off)
            sc = iou(ras, mu.astype(bool))
            # corner sharpness: vertices must sit near the real contour
            dev = corner_excess(polys, [c for _, _, c in all_lines])
            if sc >= GEOM_IOU and dev <= 1.0:
                return {'t': 'p', 'lines': [ls for _, ls, _ in all_lines], 'lines0': [list(ls) for _, ls, _ in all_lines], 'holes': [h for h, _, _ in all_lines],
                        'iou': sc, 'off': off, 'conts': [c for _, _, c in all_lines]}
    # --- ellipse / ring (no straight edges)
    if len(outers) == 1 and len(holes) <= 1:
        fits = []
        for ci in outers + holes:
            c = cnts[ci].reshape(-1, 2).astype(np.float32)
            if len(c) < 20:
                return None
            (cx, cy), (ma, mi), ang = cv2.fitEllipse(c)
            fits.append((cx + off[0], cy + off[1], ma / 2, mi / 2, ang))
        img = np.zeros(mu.shape, np.uint8); tmp = np.zeros(mu.shape, np.uint8)
        for (cx, cy, rx, ry, ang) in fits:
            tmp[:] = 0
            cv2.ellipse(tmp, (int(round((cx - off[0]) * 16)), int(round((cy - off[1]) * 16))), (int(round(rx * 16)), int(round(ry * 16))), ang, 0, 360, 1, -1, cv2.LINE_8, 4)
            img ^= tmp
        sc = iou(img.astype(bool), mu.astype(bool))
        if sc >= GEOM_IOU and min(r for f in fits for r in f[2:4]) > 3:
            return {'t': 'e', 'fits': fits, 'iou': sc, 'off': off}
    return None


def corner_excess(polys, conts, rmax=7.0):
    """How far real corners are from sharp: vertex-to-contour distance beyond what a rounding of radius rmax
    (4x px, ~1.2 src px, i.e. blur and anti-aliasing) would explain. <= 0 means all corners are sharp enough to snap."""
    worst = -9.
    for V, c in zip(polys, conts):
        k = len(V)
        for i in range(k):
            a, b, d = V[i - 1] - V[i], V[(i + 1) % k] - V[i], None
            ca = float(a @ b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)
            phi = math.acos(max(-1, min(1, ca)))
            allowed = rmax * (1 / max(math.sin(phi / 2), .2) - 1)
            dist = float(np.min(np.hypot(c[:, 0] - V[i][0], c[:, 1] - V[i][1])))
            worst = max(worst, dist - allowed)
    return worst


def snap_lines(items):
    """Share angles (and axis alignment) between all polygon edges of a logo, then share edge offsets of parallel edges."""
    edges = []   # (item, polyidx, lineidx)
    for it in items:
        g = it.get('geo')
        if g and g['t'] == 'p':
            for pi, ls in enumerate(g['lines']):
                for li in range(len(ls)):
                    edges.append((it, pi, li))
    if not edges:
        return
    # lengths for weighting
    def length(e):
        it, pi, li = e
        ls = it['geo']['lines'][pi]
        V = lines_to_poly(ls)
        return float(np.linalg.norm(V[li] - V[(li + 1) % len(V)]))
    edges = [e for e in edges if lines_to_poly(e[0]['geo']['lines'][e[1]]) is not None]
    if not edges:
        return
    L = np.array([length(e) for e in edges])
    th = np.array([e[0]['geo']['lines'][e[1]][li][0] if False else e[0]['geo']['lines'][e[1]][e[2]][0] for e in edges])
    # axis snap
    TOL = math.radians(2.0)
    new_th = th.copy()
    for ax in (0., math.pi / 2, math.pi):
        sel = np.abs(th - ax) < TOL
        new_th[sel] = ax % math.pi
    # cluster the rest
    order = np.argsort(new_th)
    free = [i for i in order if not any(abs(new_th[i] - a) < 1e-9 for a in (0., math.pi / 2))]
    cl = []
    for i in free:
        if cl and new_th[i] - np.average(new_th[cl[-1]], weights=L[cl[-1]]) < math.radians(1.8):
            cl[-1].append(i)
        else:
            cl.append([i])
    for c in cl:
        m_ = np.average(new_th[c], weights=L[c])
        for i in c:
            new_th[i] = m_
    # apply angle changes keeping each edge's centre point fixed
    for e, t_new in zip(edges, new_th):
        it, pi, li = e
        ls = it['geo']['lines'][pi]
        t0, c0 = ls[li]
        if abs(t0 - t_new) > 1e-9:
            n0 = np.array([-math.sin(t0), math.cos(t0)]); d0 = np.array([math.cos(t0), math.sin(t0)])
            V = lines_to_poly(ls)
            mid = (V[li] + V[(li + 1) % len(V)]) / 2
            n1 = np.array([-math.sin(t_new), math.cos(t_new)])
            ls[li] = (t_new, float(mid @ n1))
    # offsets of parallel edges within a logo: equal-angle edges whose offsets are within tolerance share one value
    TOLC = 3.0   # 4x px = .75 src px
    byang = {}
    for e in edges:
        it, pi, li = e
        t = round(it['geo']['lines'][pi][li][0], 5)
        byang.setdefault(t, []).append(e)
    for t, es in byang.items():
        cs = [(e[0]['geo']['lines'][e[1]][e[2]][1], e) for e in es]
        # offsets are signed by the direction of n, which is the same for equal theta
        cs.sort(key=lambda v: v[0])
        grp = []
        for c, e in cs:
            if grp and c - grp[-1][-1][0] < TOLC:
                grp[-1].append((c, e))
            else:
                grp.append([(c, e)])
        for g in grp:
            if len(g) < 2:
                continue
            # only share between different items
            if len({id(e[0]) for _, e in g}) < 2:
                continue
            w = np.array([length(e) for _, e in g]); cv = np.array([c for c, _ in g])
            mean = float(np.average(cv, weights=w))
            for _, e in g:
                it, pi, li = e
                it['geo']['lines'][pi][li] = (it['geo']['lines'][pi][li][0], mean)


def build_polys(it, owner_map, line_sets, gate_iou, max_disp):
    """Bleed shared edges, validate against the mask. Returns (polys, iou) or None."""
    g = it['geo']; m = it['m']
    mu = np.pad(m, 3).astype(np.uint8); off = g['off']
    polys = [lines_to_poly(ls) for ls in line_sets]
    if any(P is None for P in polys):
        return None
    ls_out = []
    for ls, V in zip(line_sets, polys):
        ls2 = list(ls)
        for li in range(len(ls)):
            mid = (V[li] + V[(li + 1) % len(V)]) / 2
            th = ls[li][0]
            n = np.array([-math.sin(th), math.cos(th)])
            def inside(p):
                q = np.round(p - off).astype(int)
                return 0 <= q[1] < mu.shape[0] and 0 <= q[0] < mu.shape[1] and mu[q[1], q[0]] > 0
            out_n = n if not inside(mid + n * 3) else (-n if not inside(mid - n * 3) else None)
            if out_n is None:
                continue
            p = np.round(mid + out_n * 5).astype(int)
            if 0 <= p[1] < owner_map.shape[0] and 0 <= p[0] < owner_map.shape[1] and owner_map[p[1], p[0]] > it['z']:
                ls2[li] = (ls[li][0], ls[li][1] + float(out_n @ n) * BLEED * U)
        ls_out.append(ls2)
    polys2 = [lines_to_poly(ls) for ls in ls_out]
    if any(P is None for P in polys2):
        return None
    ras = raster_polys(polys, mu.shape, off)        # score the un-bled shape against the mask
    sc = iou(ras, mu.astype(bool))
    disp = max(float(np.min(np.hypot(c[:, 0] - v[0], c[:, 1] - v[1]))) for P, c in zip(polys, g['conts']) for v in P)
    if sc < gate_iou or disp > max_disp:
        return None
    return polys2, sc


def finish_geometry(items, owner_map, bounds):
    """Snapped polygon if it still matches the mask, else the unsnapped fit, else the plain trace."""
    for it in items:
        g = it.get('geo')
        if not g:
            continue
        if g['t'] == 'p':
            res = build_polys(it, owner_map, g['lines'], .955, 7.0) or build_polys(it, owner_map, g['lines0'], GEOM_IOU - .005, 9.0)
            if res is None:
                it['geo'] = None
                continue
            polys, sc = res
            it['d'] = ''.join(poly_path(P) for P in polys)
            it['gm'] = 'p'; it['giou'] = round(sc, 4)
            P = polys[0]
            es = [(np.linalg.norm(P[(i + 1) % len(P)] - P[i]), i) for i in range(len(P))]
            ang = lambda i: math.degrees(math.atan2(*(P[(i + 1) % len(P)] - P[i])[::-1])) % 180
            Lmax, imax = max(es)
            th = ang(imax)
            it['ang'] = round(th, 1)
            cap = [(l, i) for l, i in es if abs(((ang(i) - th + 90) % 180) - 90) > 25]
            if cap:
                it['fr'] = round(ang(min(cap)[1]), 1)
        else:
            ps = []
            for (cx, cy, rx, ry, ang) in g['fits']:
                if abs(rx - ry) / max(rx, ry) < .035:
                    rx = ry = (rx + ry) / 2; ang = 0
                ps.append((cx, cy, rx, ry, ang))
            (cx, cy, rx, ry, ang) = ps[0]
            touch = 0; n = 24
            for k in range(n):
                a = 2 * math.pi * k / n
                ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
                px = cx + (rx + 5) * math.cos(a) * ca - (ry + 5) * math.sin(a) * sa
                py = cy + (rx + 5) * math.cos(a) * sa + (ry + 5) * math.sin(a) * ca
                p = np.round([px, py]).astype(int)
                if 0 <= p[1] < owner_map.shape[0] and 0 <= p[0] < owner_map.shape[1] and owner_map[p[1], p[0]] > it['z']:
                    touch += 1
            if touch >= n * .25:
                ps[0] = (cx, cy, rx + BLEED * U, ry + BLEED * U, ang)
            it['d'] = ''.join(ellipse_path(*p) for p in ps)
            it['gm'] = 'r' if len(ps) == 2 else 'e'; it['giou'] = round(g['iou'], 4)
            it['ang'] = round(ps[0][4] % 180, 1)


# ---------------------------------------------------------------- the main per-logo routine

def moments_angle(m):
    ys, xs = np.where(m)
    if len(xs) < 5:
        return 0.
    c = np.cov(np.stack([xs, ys]))
    w, v = np.linalg.eigh(c)
    d = v[:, 1]
    return math.degrees(math.atan2(d[1], d[0])) % 180


def drop_rim_centres(merged, lab_s, paper):
    """Anti-aliasing between a colour and paper (or two colours) produces intermediate k-means centres.
    A centre is dropped when it lies between two others in Lab AND its pixels are almost all within a pixel of
    another region (a rim, not an area). Real pale colours have bulk pixels, so they stay."""
    merged = list(merged)
    for _ in range(4):
        C = np.stack([paper] + merged).astype(np.float32)
        d = np.linalg.norm(lab_s[:, :, None, :] - C[None, None], axis=-1)
        lab_i = d.argmin(-1)
        drop = None
        for ci in range(1, len(C)):
            mi = lab_i == ci
            if mi.sum() < 15:
                drop = ci; break
            edt_in = ndi.distance_transform_edt(np.pad(mi, 1))[1:-1, 1:-1]
            inter = float((edt_in[mi] >= 1.8).mean())
            if inter > .1:
                continue
            # neighbouring colours of this cluster; a rim is a mix of paper (or another neighbour) with one of them
            ring = ndi.binary_dilation(mi, iterations=3) & ~mi
            counts = np.bincount(lab_i[ring], minlength=len(C)) if ring.any() else np.zeros(len(C))
            nb = [k for k in range(len(C)) if k != ci and counts[k] >= .25 * ring.sum()]
            c = C[ci]
            between = False
            ends = [0] + [k for k in nb if k != 0]
            for a_ in ends:
                for b_ in ends:
                    if b_ <= a_ or ci in (a_, b_):
                        continue
                    ab = C[b_] - C[a_]
                    t = float((c - C[a_]) @ ab) / (float(ab @ ab) + 1e-9)
                    if .1 < t < .9 and np.linalg.norm(C[a_] + t * ab - c) < 7:
                        between = True; break
                if between:
                    break
            if between:
                drop = ci; break
        if drop is None:
            break
        del merged[drop - 1]
    return merged


def band_layers(m, ox, oy, lab_b, Ls_src=None):
    """Nested luminance bands for one piece of a gradient logo. m: bool crop at (ox, oy) in the 4x image.
    Returns [[hex, path], ...] (dark base first, lighter features nested above)."""
    st8 = np.ones((3, 3))
    h, w = m.shape
    labp = lab_b[oy:oy + h, ox:ox + w]
    lab0 = labp
    interior = ndi.binary_erosion(m, iterations=5)
    thin = m & ~ndi.binary_dilation(interior, iterations=6)
    interior |= ndi.binary_erosion(m, iterations=2) & thin
    if interior.sum() >= 10:
        idx = ndi.distance_transform_edt(~interior, return_distances=False, return_indices=True)
        labfix = labp[idx[0], idx[1]]
    else:
        labfix = labp
    labp = np.where(interior[..., None], labp, labfix)
    Lp = ndi.gaussian_filter(labfix[..., 0], 1.6)
    def tr(mask):
        ys_, xs_ = np.where(mask)
        if not len(ys_):
            return ''
        return potrace_path(mask[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1], ox + xs_.min(), oy + ys_.min())
    def clean(mask, min_area=5 * U * U):
        lc, nc = ndi.label(mask, structure=st8)
        if nc == 0:
            return mask
        sz = ndi.sum(mask, lc, np.arange(1, nc + 1))
        return np.concatenate([[False], sz >= min_area])[lc]
    stat = m & interior
    if stat.sum() < 60 or edt_thick(m) < 6.5 or m.sum() < 90 * U * U:
        dd = np.linalg.norm(lab0 - np.array([100., 0, 0], np.float32), axis=-1)[m]
        cut = np.percentile(dd, 65)
        return [[lab2hex(lab0[m][dd >= cut].mean(0)), None]]
    Lv = Lp[stat]
    lo, hi = np.percentile(Lv, 4), np.percentile(Lv, 96)
    nb = int(np.clip(round((hi - lo) / 3.6), 1, 14))
    ths = [-1e9] + [lo + (hi - lo) * j / nb for j in range(1, nb)] + [1e9]
    out, last = [], None
    for j in range(nb):
        band = m & (Lp >= ths[j])
        if j:
            band = clean(band)
            if not band.any():
                continue
        cm = stat & (Lp >= ths[j]) & (Lp < ths[j + 1])
        colr = labp[cm].mean(0) if cm.sum() > 12 else labp[m & (Lp >= ths[j])].mean(0)
        hx = lab2hex(colr)
        if hx == last:
            continue
        last = hx
        out.append([hx, None if j == 0 else tr(band)])
    return out


def process(name, sheet):
    rgb = np.asarray(Image.open(os.path.join(CROPS, name + '.png')).convert('RGB'))
    h, w = rgb.shape[:2]
    big = np.clip(np.asarray(Image.fromarray(rgb).resize((w * U, h * U), Image.LANCZOS)).astype(np.float32), 0, 255)
    H, W = big.shape[:2]
    bw = sheet == '12'
    info = {'n': name, 'w': w, 'h': h}
    items = []
    if bw:
        g = big.mean(2)
        g = ndi.gaussian_filter(g, .8)
        fg = g < 128
        # hairlines (thin serifs, rules) blur to a mid grey that never crosses 50%: keep them, but only where no stronger edge is near
        hair = (g < 176) & ~ndi.binary_dilation(fg, iterations=5)
        hair = ndi.binary_opening(hair, structure=np.ones((2, 2)))
        fg = fg | hair
        fg = ndi.binary_opening(fg, structure=np.ones((2, 2)))
        mode = 'bw'
        clusters = [('#111114', True)]
        lbl = np.where(fg, 1, 0)
        centres = [None, np.array([8., 0, 0])]
        paper = np.array([100., 0, 0])
        sigma = .9
    else:
        lab_b = rgb2lab(big)
        lab_s = rgb2lab(rgb.astype(np.float32))
        paper = np.array([100., 0., 0.])
        dps = np.linalg.norm(lab_s - paper, axis=-1)
        fg_s = dps > (6 if name in GRAD else 10)       # flat logos: a faint grey halo around shapes is not a colour
        gm = np.abs(ndi.sobel(lab_s[..., 0], 0)) + np.abs(ndi.sobel(lab_s[..., 0], 1)) + np.abs(ndi.sobel(lab_s[..., 1], 0)) + np.abs(ndi.sobel(lab_s[..., 1], 1)) + np.abs(ndi.sobel(lab_s[..., 2], 0)) + np.abs(ndi.sobel(lab_s[..., 2], 1))
        gm = ndi.maximum_filter(gm, 3)
        core = fg_s & (gm < 55)
        if core.sum() < 200:
            core = fg_s & (gm < 140)
        # thin strokes never have low-gradient pixels: take the most saturated pixel of each neighbourhood as well
        ridge = fg_s & (dps >= ndi.maximum_filter(dps, 5)) & (dps > 25)
        core = core | ridge
        pts = lab_s[core]
        rng = np.random.RandomState(3)
        if len(pts) > 30000:
            pts = pts[rng.choice(len(pts), 30000, replace=False)]
        # gradient-ness: distance of well-inside pixels to the nearest of 8 centres
        k8 = min(8, max(1, len(pts) // 50))
        c8, _ = kmeans2(pts, k8, minit='++', seed=7, iter=25)
        inside = ndi.binary_erosion(fg_s, iterations=2)
        ip = lab_s[inside]
        if len(ip) > 6000:
            ip = ip[rng.choice(len(ip), 6000, replace=False)]
        dmin = np.min(np.linalg.norm(ip[:, None, :] - c8[None], axis=-1), axis=1) if len(ip) else np.zeros(1)
        gscore = float((dmin > 11).mean())
        info['gscore'] = round(gscore, 3)
        grad = name in GRAD          # automatic score (info['gscore']) is only advisory: it cannot tell pale text from chrome
        mode = 'grad' if grad else 'flat'
        K = 9 if grad else 12
        if grad:
            pts = lab_s[inside] if inside.sum() > 200 else lab_s[fg_s]
            if len(pts) > 40000:
                pts = pts[rng.choice(len(pts), 40000, replace=False)]
        k = min(K, max(1, len(pts) // 40))
        cs, li = kmeans2(pts, k, minit='++', seed=7, iter=30)
        pop = np.bincount(li, minlength=k)
        keep = sorted([(pop[i], cs[i]) for i in range(k) if pop[i] > max(8, (.0015 if grad else .003) * len(pts))], key=lambda v: -v[0])
        merged = []
        for _, v in keep:
            if all(np.linalg.norm(v - m_) > (24 if grad else 18) for m_ in merged):
                merged.append(v)
        if not grad:
            # near-white 'colours' are the paper with a little noise or colour bleed (white lettering on a plate): not a colour
            merged = [m_ for m_ in merged if np.linalg.norm(m_ - paper) > 13]
        merged = drop_rim_centres(merged, lab_s, paper)
        centres = [None] + merged
        C = np.stack([paper] + merged).astype(np.float32)
        # nearest centre per pixel (paper is index 0); rows in chunks to limit memory
        lbl = np.zeros((H, W), np.int32)
        for r0 in range(0, H, 128):
            blk = lab_b[r0:r0 + 128]
            d = np.linalg.norm(blk[:, :, None, :] - C[None, None], axis=-1)
            lbl[r0:r0 + 128] = d.argmin(-1)
        # slivers between two colours: pixels of a thin colour strip that touch other colours go to the nearest solid colour
        nonp = lbl > 0
        solid = np.zeros_like(nonp)
        se = np.ones((5, 5), bool)
        for i in range(1, len(C)):
            mi = lbl == i
            if not mi.any():
                continue
            op = ndi.binary_opening(mi, structure=se)
            removed = mi & ~op
            near_other = ndi.binary_dilation(nonp & ~mi, iterations=3)
            solid |= op | (mi & ~near_other)
        idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
        newl = lbl[idx[0], idx[1]]
        lbl = np.where(solid, lbl, np.where(nonp, newl, 0))
        sigma = SIGMA.get(name, 1.8 if grad else 1.5)
        clusters = [(lab2hex(c), c[0] < 36 and math.hypot(c[1], c[2]) < 26) for c in merged]
        if not merged:
            return {'n': name, 'w': w, 'h': h, 'mode': mode, 'parts': [], 'iou': 0}
    # ---------------- union silhouette + per-cluster masks
    nonpaper = lbl > 0
    if not bw:
        ref_mask = np.linalg.norm(lab_b - paper.astype(np.float32), axis=-1) > 5
    else:
        ref_mask = nonpaper
    fgU = smooth_mask(nonpaper, sigma)
    if not bw:
        # enclosed "paper" that is not white (pale chrome highlights, tiny specks) belongs to the shape
        holes = ndi.binary_fill_holes(fgU) & ~fgU
        if holes.any():
            dpb = np.linalg.norm(lab_b - paper.astype(np.float32), axis=-1)
            hl, nh = ndi.label(holes)
            for i_, s2 in enumerate(ndi.find_objects(hl), 1):
                hm = hl[s2] == i_
                core = ndi.binary_erosion(hm, iterations=2)
                small = max(s2[0].stop - s2[0].start, s2[1].stop - s2[1].start) <= 4.5 * U
                vals = dpb[s2][core] if core.any() else np.zeros(1)
                if small or (mode == 'grad' and core.any() and float(np.median(vals)) > 6.0 and float(np.percentile(vals, 20)) > 3.0):
                    fgU[s2] |= hm
    if not bw and len(clusters) > 1:
        newpix = fgU & ~nonpaper
        if newpix.any():
            Cn = np.stack(merged).astype(np.float32)
            dn = np.linalg.norm(lab_b[newpix][:, None, :] - Cn[None], axis=-1)
            lbl[newpix] = dn.argmin(-1) + 1
    masks = []
    if len(clusters) == 1:
        masks = [(1, fgU)]
    else:
        # smooth partition: argmax of blurred indicators inside the silhouette (no gaps, no overlap)
        best = np.full((H, W), -1., np.float32); arg = np.zeros((H, W), np.int32)
        ys, xs = np.where(fgU)
        y0, y1, x0, x1 = max(0, ys.min() - 8), min(H, ys.max() + 9), max(0, xs.min() - 8), min(W, xs.max() + 9)
        for i in range(1, len(clusters) + 1):
            f = ndi.gaussian_filter((lbl[y0:y1, x0:x1] == i).astype(np.float32), sigma if bw else 3.2)
            upd = f > best[y0:y1, x0:x1]
            best[y0:y1, x0:x1][upd] = f[upd]
            arg[y0:y1, x0:x1][upd] = i
        if mode == 'flat':
            # blotches: small pieces of one colour sitting inside/against another are shading, not shapes
            changed = np.zeros_like(arg)
            for i in range(1, len(clusters) + 1):
                lc, nc = ndi.label((arg == i) & fgU, structure=np.ones((3, 3)))
                for ci, s2 in enumerate(ndi.find_objects(lc), 1):
                    piece = lc[s2] == ci
                    if piece.sum() >= 40 * U * U:
                        continue
                    ring = ndi.binary_dilation(np.pad(piece, 3), iterations=3)[3:-3, 3:-3] & ~piece
                    nb = arg[s2][ring] if ring.shape == piece.shape else np.array([])
                    nb = nb[(nb > 0) & (nb != i)]
                    if len(nb) >= .35 * ring.sum() and ring.sum() > 0:
                        changed[s2][piece] = np.bincount(nb).argmax()
            arg = np.where(changed > 0, changed, arg)
        for i in range(1, len(clusters) + 1):
            mi = (arg == i) & fgU
            if mi.any():
                masks.append((i, mi))
    minA_ink, minA_col = (2.2 * U * U), (2.2 * U * U)
    # ---------------- items (one per connected piece)
    st8 = np.ones((3, 3))
    # ---------------- flat / bw
    raw = []
    for (i, mi) in masks:
        ink = clusters[i - 1][1]
        lc, nc = ndi.label(mi, structure=st8)
        for ci, s2 in enumerate(ndi.find_objects(lc), 1):
            piece = lc[s2] == ci
            if piece.sum() < (minA_ink if ink else minA_col):
                continue
            raw.append({'ci': i, 'm': piece, 'o': (s2[1].start, s2[0].start), 'ink': ink, 'f': clusters[i - 1][0], 'k': 'ink' if ink else 'col'})
    # plates: a big solid with many enclosed paper holes (white lettering) -> solid plate + paper parts
    paps = []
    for it in raw:
        m = it['m']
        hh, ww = m.shape
        a = float(m.sum())
        if a < 30 * U * U:
            continue
        solid = ndi.binary_fill_holes(m)
        holes = solid & ~m
        if not holes.any():
            continue
        hl, nh = ndi.label(holes, structure=st8)
        hs = [(i_, s2) for i_, s2 in enumerate(ndi.find_objects(hl), 1) if (hl[s2] == i_).sum() >= 12 * U * U]
        if len(hs) >= 5 and solid.sum() / (hh * ww) >= .42 and sum((hl[s2] == i_).sum() for i_, s2 in hs) >= .08 * solid.sum():
            # only holes that are really paper (not another colour inside)
            ox, oy = it['o']
            for i_, s2 in hs:
                piece = hl[s2] == i_
                gy0, gx0 = s2[0].start + oy, s2[1].start + ox
                region = lbl[gy0:gy0 + piece.shape[0], gx0:gx0 + piece.shape[1]]
                if (region[piece] == 0).mean() > .6:
                    paps.append({'ci': 0, 'm': piece, 'o': (gx0, gy0), 'ink': False, 'f': 'pap', 'k': 'pap'})
            it['m'] = solid
            it['plate'] = True
    raw += paps
    for it in raw:
        m = it['m']
        x0, y0, x1, y1 = bbox_of(m)
        it['m'] = m[y0:y1, x0:x1]
        it['o'] = (it['o'][0] + x0, it['o'][1] + y0)
        it['b'] = [round(it['o'][0] / U, 1), round(it['o'][1] / U, 1), round((it['o'][0] + it['m'].shape[1]) / U, 1), round((it['o'][1] + it['m'].shape[0]) / U, 1)]
        it['a'] = round(float(ndi.binary_fill_holes(it['m']).sum()) / U / U)
        bw_, bh_ = it['b'][2] - it['b'][0], it['b'][3] - it['b'][1]
        it['t'] = round(edt_thick(it['m']), 1)
        it['rule'] = max(bw_, bh_) / max(1., min(bw_, bh_)) >= 6 and it['t'] < 10
    raw.sort(key=lambda it: -it['a'])
    for z, it in enumerate(raw):
        it['z'] = z
    detect_roles([it for it in raw if it['k'] != 'pap'])
    for it in raw:
        if it['k'] == 'pap':
            it['r'] = 'w'; it['row'] = -1
    # owner map (index of the topmost = smallest item covering the pixel)
    owner = np.full((H, W), -1, np.int32)
    for it in raw:                     # big first, smaller overwrite
        ox, oy = it['o']; mh, mw = it['m'].shape
        sub = owner[oy:oy + mh, ox:ox + mw]
        sub[it['m']] = it['z']
    # geometry before extension (fit on the true masks)
    if mode in ('bw', 'flat'):
        for it in raw:
            it['geo'] = None
            if it['k'] == 'pap' or it.get('plate'):
                continue
            if it['r'] == 'w':
                continue
            try:
                it['geo'] = fit_geometry(it, owner, it['z'])
            except Exception as e:
                it['geo'] = None
        try:
            snap_lines(raw)
        except Exception:
            for it in raw:
                if it.get('geo') and it['geo']['t'] == 'p':
                    it['geo']['lines'] = [list(l) for l in it['geo']['lines0']]
        finish_geometry(raw, owner, None)
    # extension beneath upper items, then potrace for anything not replaced by geometry
    above = np.zeros((H, W), bool)
    r_close = 12 * U
    for it in sorted(raw, key=lambda it: it['z'], reverse=True):     # smallest first
        ox, oy = it['o']; mh, mw = it['m'].shape
        pad = r_close + 4
        y0, y1 = max(0, oy - pad), min(H, oy + mh + pad)
        x0, x1 = max(0, ox - pad), min(W, ox + mw + pad)
        full = np.zeros((y1 - y0, x1 - x0), bool)
        full[oy - y0:oy - y0 + mh, ox - x0:ox - x0 + mw] = it['m']
        ab = above[y0:y1, x0:x1]
        ext = full
        if ab.any() and it['k'] != 'pap':
            near = ndi.binary_dilation(full, iterations=int(BLEED * U + 1.5)) & ab
            if ab[full | near].any() or near.any():
                d1 = ndi.distance_transform_edt(~full) <= r_close
                clo = ndi.distance_transform_edt(d1) > r_close
                ext = full | (ab & (clo | near))
        if not it.get('d'):
            ys, xs = np.where(ext)
            it['d'] = potrace_path(ext[ys.min():ys.max() + 1, xs.min():xs.max() + 1], x0 + xs.min(), y0 + ys.min())
        if mode == 'grad' and it['k'] != 'pap':
            lay = band_layers(it['m'], ox, oy, lab_b)
            lay[0][1] = it['d']                  # the base is the (extended) silhouette of the piece
            if len(lay) == 1:
                it['f'] = lay[0][0]
            else:
                it['L'] = lay
                it['f'] = lay[0][0]
        # `above` accumulates the plain (un-extended) item masks
        above[oy:oy + mh, ox:ox + mw] |= it['m']
    parts = []
    for it in raw:
        if not it.get('d'):
            continue
        if it.get('L'):
            p = {'k': 'c', 'L': it['L'], 'b': it['b'], 'a': it['a'], 't': it['t'], 'r': it.get('r', 'm'), 'row': it.get('row', -1), 'gm': '', 'ang': round(moments_angle(it['m']), 1)}
            if it.get('rule'):
                p['rule'] = 1
            p['ci'] = it['ci']
            parts.append(p)
            continue
        p = {'k': it['k'][0], 'f': it['f'], 'd': it['d'], 'b': it['b'], 'a': it['a'], 't': it['t'], 'r': it.get('r', 'm'), 'row': it.get('row', -1),
             'gm': it.get('gm', ''), 'ang': it.get('ang', round(moments_angle(it['m']), 1))}
        if 'fr' in it:
            p['fr'] = it['fr']
        if 'giou' in it:
            p['gi'] = it['giou']
        if it.get('rule'):
            p['rule'] = 1
        p['ci'] = it['ci']
        parts.append(p)
    info.update({'mode': mode, 'parts': parts})
    return info, raw, nonpaper, lbl, rgb, big, fgU


def render_png(info, scale=4):
    from io import BytesIO
    import cairosvg
    w, h = info['w'], info['h']
    s = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d"><rect width="100%%" height="100%%" fill="#fff"/>' % (w * scale, h * scale, w, h)]
    for p in info['parts']:
        if 'L' in p:
            for f, d in p['L']:
                s.append('<path fill="%s" fill-rule="evenodd" d="%s"/>' % (f, d))
        else:
            s.append('<path fill="%s" fill-rule="evenodd" d="%s"/>' % ('#ffffff' if p['f'] == 'pap' else p['f'], p['d']))
    s.append('</svg>')
    png = cairosvg.svg2png(bytestring=''.join(s).encode())
    return np.asarray(Image.open(BytesIO(png)).convert('RGB'))


def score(info, nonpaper, rgb, big):
    r = render_png(info).astype(np.float32)
    if r.shape[:2] != nonpaper.shape:
        r = np.asarray(Image.fromarray(r.astype(np.uint8)).resize((nonpaper.shape[1], nonpaper.shape[0])))
    lab_r = rgb2lab(r)
    dr = np.linalg.norm(lab_r - np.array([100., 0, 0]), axis=-1)
    rend = dr > 5
    i = iou(rend, nonpaper)
    both = rend & nonpaper
    lab_b = rgb2lab(big)
    de = float(np.linalg.norm(lab_r[both] - lab_b[both], axis=-1).mean()) if both.any() else 0.
    return round(i, 4), round(de, 2)


def work(args):
    name, sheet = args
    try:
        res = process(name, sheet)
        if isinstance(res, dict):
            info = res
            info['iou'] = 0; info['de'] = 0
        else:
            info, raw, nonpaper, lbl, rgb, big, fgU = res
            info['iou'], info['de'] = score(info, nonpaper, rgb, big)
        # geometry bookkeeping
        info['geo'] = sum(1 for p in info['parts'] if p.get('gm'))
        json.dump(info, open(os.path.join(OUT, name + '.json'), 'w'), separators=(',', ':'))
        return name, info['mode'], len(info['parts']), info['geo'], info['iou'], info['de'], info.get('gscore')
    except Exception as e:
        import traceback
        return name, 'ERR', traceback.format_exc(), 0, 0, 0, 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only'); ap.add_argument('--force', action='store_true'); ap.add_argument('-j', type=int, default=12)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    crops = json.load(open(os.path.join(CACHE, 'crops.json')))
    only = set(a.only.split(',')) if a.only else None
    todo = [(c['name'], c['sheet']) for c in crops if (not only or c['name'] in only) and (a.force or only or not os.path.exists(os.path.join(OUT, c['name'] + '.json')))]
    with Pool(a.j) as p:
        for r in p.imap_unordered(work, todo):
            print(*r)
            sys.stdout.flush()


if __name__ == '__main__':
    main()
