#!/usr/bin/env python3
"""Cut the TempleOS sheet into one crop per logo.

The sheet is a grid of logos on white: equal thirds give one logo per cell, then every
cell is trimmed to its ink with a little paper kept around it, so trace.py sees a tight crop.

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

ROWS, COLS = 3, 3
THR = 238      # a pixel is ink if any channel is below this
PAD = 8        # px of blank paper kept around the ink
SHEET = 'templeos'
EXTS = ('png', 'webp', 'jpg', 'jpeg')


def source():
    for f in sorted(os.listdir(REFS)):
        if f.lower().rsplit('.', 1)[-1] in EXTS:
            return os.path.join(REFS, f)
    raise SystemExit('no sheet image in refs/ (png, webp or jpg)')


def main():
    os.makedirs(CROPS, exist_ok=True)
    src = source()
    rgb = np.asarray(Image.open(src).convert('RGB'))
    h, w = rgb.shape[:2]
    out, n = [], 0
    for r in range(ROWS):
        for c in range(COLS):
            y0, y1 = round(h * r / ROWS), round(h * (r + 1) / ROWS)
            x0, x1 = round(w * c / COLS), round(w * (c + 1) / COLS)
            cell = rgb[y0:y1, x0:x1]
            ys, xs = np.where(cell.min(2) < THR)
            if not len(ys):
                continue
            n += 1
            by0, by1 = max(0, ys.min() - PAD), min(cell.shape[0], ys.max() + 1 + PAD)
            bx0, bx1 = max(0, xs.min() - PAD), min(cell.shape[1], xs.max() + 1 + PAD)
            name = 'tos_%02d' % n
            Image.fromarray(cell[by0:by1, bx0:bx1]).save(os.path.join(CROPS, name + '.png'))
            out.append({'name': name, 'sheet': SHEET, 'position': n, 'row': r + 1, 'col': c + 1,
                        'box': [int(x0 + bx0), int(y0 + by0), int(x0 + bx1), int(y0 + by1)]})
    json.dump(out, open(os.path.join(CACHE, 'crops.json'), 'w'), indent=1)
    print('%d crops from %s' % (len(out), os.path.basename(src)))


if __name__ == '__main__':
    main()
