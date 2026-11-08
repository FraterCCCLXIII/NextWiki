#!/usr/bin/env python3
"""Cut the KOSMOS sheet into one crop per logo.

The logos sit on white with clean gutters, so the cuts are the widest empty runs between
them (rows first, then columns inside each row band) rather than equal cells: equal thirds
slice through the taller logos and pick up a neighbour's ink. Every cell is then trimmed
to its ink with a little paper kept around it.

Writes .cache/crops/<name>.png and .cache/crops.json.
Run: venv/bin/python segment.py
"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.join(HERE, 'refs')
CACHE = os.path.join(HERE, '.cache')
CROPS = os.path.join(CACHE, 'crops')

ROWS, COLS = 3, 2
THR = 238      # a pixel is ink if any channel is below this
MIN_GAP = 8    # px: an empty run this wide can take a cut
PAD = 8        # px of blank paper kept around the ink
SHEET = 'kosmos'
EXTS = ('png', 'webp', 'jpg', 'jpeg')


def source():
    for f in sorted(os.listdir(REFS)):
        if f.lower().rsplit('.', 1)[-1] in EXTS:
            return os.path.join(REFS, f)
    raise SystemExit('no sheet image in refs/ (png, webp or jpg)')


def runs(empty):
    """[(start, end)) of True runs."""
    out, s = [], None
    for i, e in enumerate(empty):
        if e and s is None:
            s = i
        if not e and s is not None:
            out.append((s, i)); s = None
    if s is not None:
        out.append((s, len(empty)))
    return out


def cuts(profile, n):
    """n-1 cut positions: the centres of the widest empty runs inside the content."""
    empty = profile <= 1
    nz = np.where(~empty)[0]
    if not len(nz) or n < 2:
        return []
    a, b = nz.min(), nz.max() + 1
    rs = [r for r in runs(empty) if r[0] > a and r[1] < b and r[1] - r[0] >= MIN_GAP]
    if len(rs) < n - 1:
        raise SystemExit('only %d gutters for %d cuts; the logos touch (raise ROWS/COLS or lower MIN_GAP)' % (len(rs), n - 1))
    rs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return [(s + e) // 2 for s, e in sorted(rs[:n - 1])]


def main():
    os.makedirs(CROPS, exist_ok=True)
    src = source()
    rgb = np.asarray(Image.open(src).convert('RGB'))
    h, w = rgb.shape[:2]
    ink = rgb.min(2) < THR
    ycuts = cuts(ink.sum(1), ROWS)
    ybands = [(0 if i == 0 else ycuts[i - 1], h if i == len(ycuts) else ycuts[i]) for i in range(len(ycuts) + 1)]
    out, n = [], 0
    for r, (y0, y1) in enumerate(ybands, 1):
        xcuts = cuts(ink[y0:y1].sum(0), COLS)
        xbands = [(0 if i == 0 else xcuts[i - 1], w if i == len(xcuts) else xcuts[i]) for i in range(len(xcuts) + 1)]
        for c, (x0, x1) in enumerate(xbands, 1):
            cell = rgb[y0:y1, x0:x1]
            ys, xs = np.where(cell.min(2) < THR)
            if not len(ys):
                continue
            n += 1
            by0, by1 = max(0, ys.min() - PAD), min(cell.shape[0], ys.max() + 1 + PAD)
            bx0, bx1 = max(0, xs.min() - PAD), min(cell.shape[1], xs.max() + 1 + PAD)
            name = 'kos_%02d' % n
            Image.fromarray(cell[by0:by1, bx0:bx1]).save(os.path.join(CROPS, name + '.png'))
            out.append({'name': name, 'sheet': SHEET, 'position': n, 'row': r, 'col': c,
                        'box': [int(x0 + bx0), int(y0 + by0), int(x0 + bx1), int(y0 + by1)]})
    json.dump(out, open(os.path.join(CACHE, 'crops.json'), 'w'), indent=1)
    print('%d crops from %s  row cuts %s' % (len(out), os.path.basename(src), ycuts))


if __name__ == '__main__':
    main()
