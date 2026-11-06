#!/usr/bin/env python3
"""Cut the five SpaceRadio logo sheets into one crop per logo by whitespace.

Row bands: the N-1 widest empty horizontal runs. Within a band: the M-1 widest empty vertical runs.
Writes .cache/crops/<sheet>_<nn>.png and .cache/crops.json (sheet, position, box).
Run: venv/bin/python segment.py   (SPACERADIO_PY or the scratchpad venv)
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.join(HERE, 'refs')
CACHE = os.path.join(HERE, '.cache')
CROPS = os.path.join(CACHE, 'crops')

DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']
SHEETS = [
    {'key': '12', 'title': 'Black and white', 'rows': 8, 'cols': 5},
    {'key': '13', 'title': 'Colour', 'rows': 6, 'cols': 6},
    {'key': '14', 'title': 'Decades', 'rows': 8, 'cols': 6, 'label_col': True, 'grid': True},
    {'key': '15', 'title': 'Colour, set 2', 'rows': 4, 'cols': 4},
    {'key': '16', 'title': 'Colour, set 3', 'rows': 4, 'cols': 4},
]
# manual cuts if whitespace alone is wrong: {sheet: {'rows': [y...], 'cols': {row: [x...]}}}
OVERRIDE = {}
THR = 238      # a pixel is ink if any channel is below this
SPECK = 2      # ignore profile counts at or below this


def runs(empty):
    """[(start, end_exclusive)] of True runs."""
    out, s = [], None
    for i, e in enumerate(empty):
        if e and s is None:
            s = i
        if not e and s is not None:
            out.append((s, i)); s = None
    if s is not None:
        out.append((s, len(empty)))
    return out


def cut_points(profile, n, lo=0):
    """n-1 cut positions: centres of the widest empty runs strictly inside the content."""
    empty = profile <= SPECK
    nz = np.where(~empty)[0]
    a, b = nz.min(), nz.max()
    rs = [r for r in runs(empty) if r[0] > a and r[1] <= b]
    rs.sort(key=lambda r: r[1] - r[0], reverse=True)
    pick = sorted(rs[:n - 1])
    return [lo + (s + e) // 2 for s, e in pick], [(e - s) for s, e in sorted(rs[:n - 1])], sorted(rs[n - 1:n], key=lambda r: r[0])


def cut_points_grid(profile, n, lo=0, tol=.32):
    """Fallback when logos touch: in a window around each expected even cut, take the widest empty run,
    else the minimum of the smoothed profile."""
    nz = np.where(profile > SPECK)[0]
    a, b = nz.min(), nz.max() + 1
    cell = (b - a) / n
    sm = np.convolve(profile.astype(float), np.ones(5) / 5, 'same')
    cuts, info = [], []
    for i in range(1, n):
        c = a + cell * i
        w0, w1 = int(c - tol * cell), int(c + tol * cell)
        seg = profile[w0:w1] <= SPECK
        rs = runs(seg)
        if rs:
            s, e = max(rs, key=lambda r: r[1] - r[0])
            cuts.append(lo + w0 + (s + e) // 2); info.append(e - s)
        else:
            m = int(np.argmin(sm[w0:w1])); cuts.append(lo + w0 + m); info.append(-int(profile[w0 + m]))
    return cuts, info


def main():
    os.makedirs(CROPS, exist_ok=True)
    out = []
    for sh in SHEETS:
        rgb = np.asarray(Image.open(os.path.join(REFS, sh['key'] + '.webp')).convert('RGB'))
        H, W = rgb.shape[:2]
        ink = (rgb.min(2) < THR)
        x_start = 0
        if sh.get('label_col'):
            prof = ink.sum(0)
            x_start = 100 + int(np.argmin(prof[100:125]))   # label bars end ~107; logos start ~112
            print('sheet 14 label column ends at x =', x_start, 'min profile', prof[x_start])
        body = ink[:, x_start:]
        rowcuts, gaps, nxt = cut_points(body.sum(1), sh['rows'])
        print(sh['key'], 'row gaps', gaps, 'next best gap', [r[1] - r[0] for r in nxt])
        ys = [0] + rowcuts + [H]
        # cell map from the cuts, then give every connected piece of ink wholly to the cell holding most of it,
        # so a neighbour's stray tip crossing a cut line goes home instead of sitting in this crop
        cellmap = np.zeros((H, W), np.int32)
        for r in range(sh['rows']):
            band = body[ys[r]:ys[r + 1]]
            if sh.get('grid'):
                cc, g = cut_points_grid(band.sum(0), sh['cols'])
                print('  row', r + 1, 'col cuts (neg = min ink count, no empty gap)', g)
            else:
                cc, g, nxt = cut_points(band.sum(0), sh['cols'])
                print('  row', r + 1, 'col gaps', g, 'next best', [q[1] - q[0] for q in nxt])
            xs = [0] + cc + [band.shape[1]]
            for c in range(sh['cols']):
                cellmap[ys[r]:ys[r + 1], x_start + xs[c]:x_start + xs[c + 1]] = r * sh['cols'] + c + 1
        inkb = ink.copy(); inkb[:, :x_start] = False
        lab, nl = ndi.label(ndi.binary_dilation(inkb, iterations=2), structure=np.ones((3, 3)))
        assign = np.zeros((H, W), np.int32)
        for i, sl in enumerate(ndi.find_objects(lab), 1):
            m = lab[sl] == i
            cm = cellmap[sl][m]
            cnt = np.bincount(cm, minlength=sh['rows'] * sh['cols'] + 1)
            top = int(cnt.argmax())
            if cnt[top] >= .75 * cnt.sum():
                assign[sl][m] = top
            else:
                assign[sl][m] = cm
        for k in range(1, sh['rows'] * sh['cols'] + 1):
            mk = assign == k
            yy, xx = np.where(mk & inkb)
            pad = 6
            y0, y1 = max(0, yy.min() - pad), min(H, yy.max() + 1 + pad)
            x0, x1 = max(x_start, xx.min() - pad), min(W, xx.max() + 1 + pad)
            crop = rgb[y0:y1, x0:x1].copy()
            other = (assign[y0:y1, x0:x1] != k) & (assign[y0:y1, x0:x1] != 0)
            crop[other] = 255
            idx = k
            name = f"{sh['key']}_{idx:02d}"
            Image.fromarray(crop).save(os.path.join(CROPS, name + '.png'))
            r, c = divmod(k - 1, sh['cols'])
            out.append({'sheet': sh['key'], 'pos': idx, 'row': r + 1, 'col': c + 1, 'box': [int(x0), int(y0), int(x1), int(y1)],
                        'decade': DECADES[r] if sh.get('label_col') else None, 'name': name})
    json.dump(out, open(os.path.join(CACHE, 'crops.json'), 'w'), indent=0)
    print(len(out), 'crops')


if __name__ == '__main__':
    main()
