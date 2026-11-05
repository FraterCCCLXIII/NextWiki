#!/usr/bin/env python3
"""Trace logo-sheet rasters into per-component vector paths for traced.html.

Re-run after saving more sheets into refs/ and adding them to SHEETS:
    python3 -m venv venv && venv/bin/pip install pillow numpy scipy potracer
    venv/bin/python trace.py [--contact DIR] [--only 49,50]
Output is inlined into traced.html between the TRACED_DATA markers. A new id appears
in the page with a default reveal; add a custom one to TR in traced.html if wanted.
"""
import argparse, base64, colorsys, io, json, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.cluster.vq import kmeans2
import potrace

HERE = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.join(HERE, 'refs')

# ---------------- grid config ----------------
# file: image in refs/ · labels: logo ids row by row · grid lines are auto-detected
SHEETS = [
    {'file': 'sheet-49-64.webp', 'rows': 4, 'cols': 4, 'labels': [str(n) for n in range(49, 65)]},
    {'file': 'sheet-28-36.webp', 'rows': 3, 'cols': 3, 'labels': [str(n) for n in range(28, 37)]},
    {'file': 'ref-03.webp', 'rows': 3, 'cols': 3, 'labels': [str(n) for n in range(10, 19)],
     'xlines': [5, 557, 1115, 1667], 'ylines': [7, 334, 613, 932]},
    # Decades sheet: left-hand label column sits outside xlines. D03/D05/D06 come from sharper crops below.
    {'file': 'ref-04.webp', 'rows': 5, 'cols': 3, 'labels': ['D%02d' % n for n in range(1, 16)], 'skip': {'D03', 'D05', 'D06'},
     'xlines': [90, 572, 1053, 1529], 'ylines': [10, 218, 423, 630, 826, 1012]},
    {'file': 'ref-07.webp', 'rows': 3, 'cols': 3, 'labels': ['C%02d' % n for n in range(1, 10)],
     'xlines': [0, 511, 1023, 1535], 'ylines': [0, 341, 682, 1023]},
    # Single crops: box = x0,y0,x1,y1 inside the image; label_box = area holding the gray number.
    {'file': 'ref-05.png', 'crops': [{'label': 'D05', 'box': [6, 4, 551, 234], 'label_box': (60, 45)}]},
    {'file': 'ref-06.png', 'crops': [{'label': 'D03', 'box': [2, 2, 533, 233], 'label_box': (55, 35)},
                                     {'label': 'D06', 'box': [2, 238, 533, 461], 'label_box': (55, 35)}]},
    {'file': 'ref-08.png', 'crops': [{'label': '42', 'box': [7, 4, 535, 195], 'label_box': (55, 35)}]},
    {'file': 'ref-09.png', 'crops': [{'label': 'Star', 'box': [0, 0, 618, 458], 'label_box': (0, 0)}]},
    {'file': 'ref-10.webp', 'crops': [{'label': '38', 'box': [5, 5, 626, 641], 'label_box': (95, 80)}]},
]
# Colour is a real gradient: colour areas become one silhouette filled by a small colour map
# sampled from the source (the outline is still vector).
GRADIENT = {'35', '51', '53', '55', '56', '58', '59', '60', '62', '64', 'C09'}
FILL_HOLES = {'60'}          # pale highlights inside a shape belong to the shape, not the paper
# Flat segmentation so parts animate apart, but keep the source's soft colour.
MESH_FILL = {'61', 'D03', 'D05', 'D06', 'D11', 'D13', 'D14', 'D15', '42', 'Star', '38', 'C07'}
# Paper-coloured shapes inside black: solidify the black and make the shapes their own layer.
PAPER_ON_INK = {'14': 50, 'Star': 150}  # id: only black components at least this tall (px), so letter counters stay put
K_COLOURS = {'61': 16, 'D06': 8, 'Star': 9}  # k-means colour count per logo (default DEFAULT_K)
DEFAULT_K = 9
SPLIT_COLOUR = {'55', '64'}  # split touching coloured letters as well as black ones
SPLIT_LOOSE = {'55'}         # letters overlap heavily: cut at shallower minima
NO_SPLIT = {'14'}            # solid label blocks are not letters
UPSCALE = {'D03': 6, 'D05': 6, 'D06': 6, '42': 6, 'Star': 6, '38': 6}  # default U
SOFT = {'D03', 'D05', 'D06', '42', 'Star', '38'}  # blurry sources: pre-smooth so edges trace clean
U = 4                        # upscale factor before tracing (set per logo)
LABEL_BOX = (72, 50)         # the sheet's gray number lives inside this corner (px)
SPLIT_MAX_H = 130            # only components shorter than this are treated as letters
SPLIT_H = {'C03': 170, 'C08': 100, '38': 180}  # per-logo override

# ---------------- colour helpers ----------------
def rgb2lab(a):
    a = a / 255.0
    a = np.where(a > .04045, ((a + .055) / 1.055) ** 2.4, a / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    xyz = a @ M.T / np.array([.9505, 1, 1.089])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def lab2hex(lab):
    fy = (lab[0] + 16) / 116; fx = lab[1] / 500 + fy; fz = fy - lab[2] / 200
    d = lambda t: t ** 3 if t ** 3 > .008856 else (t - 16 / 116) / 7.787
    xyz = np.array([d(fx) * .9505, d(fy), d(fz) * 1.089])
    M = np.array([[3.2406, -1.5372, -.4986], [-.9689, 1.8758, .0415], [.0557, -.204, 1.057]])
    c = np.clip(M @ xyz, 0, 1)
    c = np.where(c > .0031308, 1.055 * c ** (1 / 2.4) - .055, 12.92 * c)
    return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)

# ---------------- grid ----------------
def grid_lines(L, n, axis):
    """Thin, nearly full-span gray runs. Falls back to even spacing around any hit."""
    bg = np.median(L)
    frac = (L < bg - 14).mean(axis=axis)
    hits = np.where(frac > .72)[0]
    groups = np.split(hits, np.where(np.diff(hits) > 1)[0] + 1) if len(hits) else []
    lines = [int(g.mean()) for g in groups if len(g) and len(g) <= 5]
    size = L.shape[1 - axis]
    if len(lines) >= n + 1:
        # keep the n+1 lines closest to an even spread
        lo, hi = lines[0], lines[-1]
        want = [lo + (hi - lo) * i / n for i in range(n + 1)]
        return [min(lines, key=lambda v: abs(v - w)) for w in want]
    print('  grid: only', lines, 'found; using even spacing', file=sys.stderr)
    return [int(size * i / n) for i in range(n + 1)]

# ---------------- tracing ----------------
def trace_mask(mask, x0, y0):
    bm = potrace.Bitmap(~mask.astype(bool))  # potracer inverts its input
    pl = bm.trace(turdsize=6, alphamax=1.05, opticurve=True, opttolerance=.5)
    f = lambda p: '%g %g' % (round(p.x / U + x0, 2), round(p.y / U + y0, 2))
    out = []
    for c in pl:
        s = 'M' + f(c.start_point)
        for seg in c.segments:
            if seg.is_corner:
                s += 'L' + f(seg.c) + 'L' + f(seg.end_point)
            else:
                s += 'C' + f(seg.c1) + ' ' + f(seg.c2) + ' ' + f(seg.end_point)
        out.append(s + 'Z')
    return ''.join(out)

def split_letters(m, loose=False):
    """Cut a merged word at vertical minima. Pieces overlap slightly, so no seam shows."""
    h, w = m.shape
    if w / h < 1.25:
        return [m]
    p = ndi.gaussian_filter1d(m.sum(0).astype(float), U * .6)
    cuts, gap = [], max(int(h * (.14 if loose else .22)), 3 * U)
    lim, prom = (.8, .05) if loose else (.42, .15)
    for x in range(gap, w - gap):
        win = p[x - gap:x + gap + 1]
        if p[x] == win.min() and p[x] < lim * h and min(win[:gap].max(), win[gap:].max()) > p[x] + prom * h:
            if not cuts or x - cuts[-1] >= gap:
                cuts.append(x)
    parts, last = [], 0
    for c in cuts + [w]:
        pm = np.zeros_like(m)
        pm[:, max(0, last - 1):min(w, c + 1)] = m[:, max(0, last - 1):min(w, c + 1)]
        if pm.any():
            parts.append(pm)
        last = c
    return parts or [m]

def comp_records(mask, lid, fill, kind, split, min_area):
    out = []
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        m = lab[sl] == i
        if m.sum() < min_area:
            continue
        H = m.shape[0] / U
        pieces = split_letters(m, lid in SPLIT_LOOSE) if split and H < SPLIT_H.get(lid, SPLIT_MAX_H) else [m]
        for pm in pieces:
            ys, xs = np.where(pm)
            if len(xs) < min_area / 3:
                continue
            crop = pm[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            ox, oy = sl[1].start + xs.min(), sl[0].start + ys.min()
            pad = np.pad(crop, 2)
            d = trace_mask(pad, (ox - 2) / U, (oy - 2) / U)
            if not d:
                continue
            t = 2 * ndi.distance_transform_edt(pad).max() / U
            b = [round(ox / U, 1), round(oy / U, 1), round((ox + crop.shape[1]) / U, 1), round((oy + crop.shape[0]) / U, 1)]
            out.append({'f': fill, 'k': kind, 'd': d, 'b': b, 't': round(float(t), 1), 'a': round(float(crop.sum()) / U / U)})
    return out

def mesh_uri(rgb, mask):
    """Tiny colour map of the source's gradient, used as a pattern fill for vector silhouettes."""
    core = ndi.binary_erosion(mask, iterations=2) if mask.sum() > 400 else mask
    if not core.any():
        core = mask
    idx = ndi.distance_transform_edt(~core, return_distances=False, return_indices=True)
    filled = rgb[idx[0], idx[1]].astype(np.uint8)
    im = Image.fromarray(filled)
    im = im.resize((max(8, im.width // 2), max(8, im.height // 2)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=88, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def trace_cell(rgb, lid):
    h, w = rgb.shape[:2]
    big = np.asarray(Image.fromarray(rgb).resize((w * U, h * U), Image.BICUBIC)).astype(float)
    if lid in SOFT:
        big = ndi.gaussian_filter(big, (U * .3, U * .3, 0))
    lab = rgb2lab(big)
    sl = rgb2lab(rgb.astype(float))
    paper = np.median(np.concatenate([sl[:6].reshape(-1, 3), sl[-6:].reshape(-1, 3), sl[:, :6].reshape(-1, 3), sl[:, -6:].reshape(-1, 3)]), axis=0)
    dp = np.linalg.norm(lab - paper, axis=-1)
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    # Low-chroma pixels are the black/paper anti-alias ramp: cut it at the midpoint, never call it a colour.
    grey = chroma < 24
    black = grey & (lab[..., 0] < (paper[0] + 8) / 2)
    fg = (dp > 18) & ~grey | black
    if lid in GRADIENT:
        # darker soft colours (deep violet edges etc.) stay colour because of the chroma test
        col = fg & ~black
        col = ndi.binary_opening(col, iterations=2)
        if lid in FILL_HOLES:
            col = ndi.binary_fill_holes(col) & ~black
        comps = comp_records(col, lid, 'mesh', 'col', lid in SPLIT_COLOUR, 12 * U * U)
        comps += comp_records(black, lid, '#0d0d10', 'ink', True, 2 * U * U)
        return comps, paper, mesh_uri(rgb, np.asarray(Image.fromarray(col.astype(np.uint8) * 255).resize((w, h), Image.BILINEAR)) > 127)
    # flat logo: k-means colour centres from low-gradient pixels only
    small = rgb2lab(rgb.astype(float))
    grad = ndi.maximum_filter(np.abs(ndi.sobel(small[..., 0], 0)) + np.abs(ndi.sobel(small[..., 0], 1)) +
                              np.abs(ndi.sobel(small[..., 1], 0)) + np.abs(ndi.sobel(small[..., 1], 1)), 3)
    sdp = np.linalg.norm(small - paper, axis=-1)
    schroma = np.hypot(small[..., 1], small[..., 2])
    core = (grad < 45) & (sdp > 22) & (schroma >= 24)
    if core.sum() < 200:  # thin coloured lines never have low-gradient pixels
        core = schroma >= 34
    centres = np.zeros((0, 3))
    if core.sum() > 30:
        pts = small[core]
        k = min(K_COLOURS.get(lid, DEFAULT_K), max(1, len(pts) // 20))
        c, lab_i = kmeans2(pts, k, minit='++', seed=7, iter=30)
        pop = np.bincount(lab_i, minlength=k)
        keep = sorted([(pop[i], c[i]) for i in range(k) if pop[i] > max(10, .004 * len(pts))], key=lambda v: -v[0])
        merged = []
        for _, v in keep:
            if all(np.linalg.norm(v - m) > 13 for m in merged):
                merged.append(v)
        centres = np.array(merged) if merged else centres
    col = fg & ~black
    out = []
    if len(centres):
        d = np.linalg.norm(lab[..., None, :] - centres, axis=-1)
        lbl = d.argmin(-1)
        # kill anti-alias slivers between neighbouring colours, then give pixels back to the neighbour
        solid = np.zeros_like(col)
        for i in range(len(centres)):
            solid |= ndi.binary_opening((lbl == i) & col, structure=np.ones((5, 5)))
        idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
        lbl = lbl[idx[0], idx[1]]
        for i in range(len(centres)):
            m = (lbl == i) & col
            out += comp_records(m, lid, 'mesh' if lid in MESH_FILL else lab2hex(centres[i]), 'col', False, 8 * U * U)
    if lid in PAPER_ON_INK:
        lab_i, _ = ndi.label(black, structure=np.ones((3, 3)))
        big = np.zeros_like(black)
        for i, sl in enumerate(ndi.find_objects(lab_i), 1):
            if (sl[0].stop - sl[0].start) / U >= PAPER_ON_INK[lid]:
                big[sl] |= lab_i[sl] == i
        solid = ndi.binary_fill_holes(big)
        holes = ndi.binary_opening(solid & ~big, iterations=1)
        black = black | solid
        out += comp_records(holes, lid, lab2hex(paper), 'pap', False, 2 * U * U)
    out += comp_records(black, lid, '#0d0d10', 'ink', lid not in NO_SPLIT, 2 * U * U)
    mesh = mesh_uri(rgb, np.asarray(Image.fromarray(col.astype(np.uint8) * 255).resize((w, h), Image.BILINEAR)) > 127) if lid in MESH_FILL else None
    return out, paper, mesh

def hue_rank(c):
    if c['f'] == 'mesh' or c['k'] != 'col':
        return 0
    r, g, b = [int(c['f'][i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return round(colorsys.rgb_to_hsv(r, g, b)[0], 3)

def cells(sh, rgb):
    """Yield (id, cell pixels, number-label box) for a grid sheet or a list of single crops."""
    if 'crops' in sh:
        for c in sh['crops']:
            x0, y0, x1, y1 = c['box']
            yield c['label'], rgb[y0:y1, x0:x1], c.get('label_box', LABEL_BOX)
        return
    L = rgb.mean(2)
    xs = sh.get('xlines') or grid_lines(L, sh['cols'], 0)
    ys = sh.get('ylines') or grid_lines(L, sh['rows'], 1)
    print(sh['file'], 'x', xs, 'y', ys)
    for i, lid in enumerate(sh['labels']):
        if lid in sh.get('skip', ()):
            continue
        r, c = divmod(i, sh['cols'])
        yield lid, rgb[ys[r] + 3:ys[r + 1] - 2, xs[c] + 3:xs[c + 1] - 2], LABEL_BOX

def main():
    global U
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact'); ap.add_argument('--only')
    a = ap.parse_args()
    only = set(a.only.split(',')) if a.only else None
    cache = os.path.join(REFS, '.traced.json')
    data = json.load(open(cache)) if only and os.path.exists(cache) else {}
    for sh in SHEETS:
        path = os.path.join(REFS, sh['file'])
        if not os.path.exists(path):
            print('skip (missing)', path); continue
        rgb = np.asarray(Image.open(path).convert('RGB'))
        for lid, cell, lbox in cells(sh, rgb):
            if only and lid not in only:
                continue
            U = UPSCALE.get(lid, 4)
            if a.contact:
                Image.fromarray(cell).save(os.path.join(a.contact, f'src-{lid}.png'))
            comps, paper, mesh = trace_cell(cell, lid)
            # drop the sheet's gray number
            comps = [m for m in comps if not (m['b'][2] < lbox[0] and m['b'][3] < lbox[1] and m['a'] < 900)]
            # stray colour specks along anti-aliased edges
            comps = [m for m in comps if not (m['k'] == 'col' and m['a'] < (40 if lid in SOFT else 12))]
            for m in comps:
                m['h'] = hue_rank(m)
            bb = [min(m['b'][0] for m in comps), min(m['b'][1] for m in comps), max(m['b'][2] for m in comps), max(m['b'][3] for m in comps)]
            data[lid] = {'id': lid, 'w': cell.shape[1], 'h': cell.shape[0], 'bb': bb, 'paper': lab2hex(paper), 'mesh': mesh, 'comps': comps}
            print(' ', lid, 'comps', len(comps), 'ink', sum(m['k'] == 'ink' for m in comps), 'colours', len({m['f'] for m in comps}), 'KB', sum(len(m['d']) for m in comps) // 1024)
    json.dump(data, open(cache, 'w'))
    js = 'const TRACED=' + json.dumps(data, separators=(',', ':')) + ';'
    page = os.path.join(HERE, 'traced.html')
    if os.path.exists(page):
        s = open(page).read()
        s2 = re.sub(r'/\*TRACED_DATA_START\*/.*?/\*TRACED_DATA_END\*/', lambda _: '/*TRACED_DATA_START*/' + js + '/*TRACED_DATA_END*/', s, flags=re.S)
        open(page, 'w').write(s2)
    print('total KB', len(js) // 1024)

if __name__ == '__main__':
    main()
