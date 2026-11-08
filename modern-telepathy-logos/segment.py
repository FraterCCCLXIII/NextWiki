#!/usr/bin/env python3
"""Cut the 10 x 10 Modern Telepathy sheet into one clean crop per logo: grid lines and cell numbers removed, trimmed to the art.
Writes .cache/crops/mt_NN.png and .cache/crops.json."""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
CROPS = os.path.join(CACHE, 'crops')
# grid line centres, measured on the sheet; rows differ in height
XS = [3, 144, 279, 415, 543, 680, 814, 942, 1068, 1180, 1286]
YS = [4, 156, 291, 435, 562, 680, 797, 910, 1023, 1103, 1214]
LABEL_W, LABEL_H = 36, 22   # the cell number sits inside this corner
EDGE = 4                    # grid lines can drift this far into a cell
# Crops are doubled before tracing, which keeps small lettering much cleaner. These came out worse that way (fringes, colour flecks), so they stay at size.
AT_SIZE = {3, 13, 14, 34, 54, 58, 70, 89}
PANELS = {28, 71, 89}       # logos that fill a black panel
DARK_LABEL = {89}           # the number is on a white patch inside a black logo, so that patch becomes black


def main():
    os.makedirs(CROPS, exist_ok=True)
    src = np.array(Image.open(os.path.join(HERE, 'refs', 'sheet.png')).convert('RGB'))
    crops = []
    for n in range(1, 101):
        r, c = (n - 1) // 10, (n - 1) % 10
        x0, x1, y0, y1 = XS[c] + 1, XS[c + 1] - 1, YS[r] + 1, YS[r + 1] - 1
        a = src[y0:y1, x0:x1].copy()
        # a panel logo fills its cell, so its median would be the panel colour rather than the paper
        paper = np.array([254, 254, 249], np.uint8) if n in PANELS else np.median(a.reshape(-1, 3), axis=0).astype(np.uint8)
        # grid lines: pale grey pixels in the edge band
        g = a.astype(int)
        pale = (g.min(axis=2) > 150) & (g.max(axis=2) - g.min(axis=2) < 24)
        band = np.ones(a.shape[:2], bool); band[EDGE:-EDGE, EDGE:-EDGE] = False
        a[band & pale] = paper
        # cell number: small dark pieces wholly inside the corner box; anything reaching outside it is logo
        if n in DARK_LABEL:
            a[:LABEL_H, :LABEL_W] = np.median(a[LABEL_H:LABEL_H + 6, 4:LABEL_W].reshape(-1, 3), axis=0).astype(np.uint8)
        else:
            ink = np.asarray(a.astype(int).min(axis=2) < 225)
            lab, k = ndi.label(ink, structure=np.ones((3, 3)))
            for i, sl in enumerate(ndi.find_objects(lab), 1):
                if sl[0].stop <= LABEL_H and sl[1].stop <= LABEL_W:
                    a[ndi.binary_dilation(lab == i, iterations=2)] = paper
        # a logo that is a dark panel: its frame and number sit outside the panel, so cut to the panel and put paper around it
        if n in PANELS:
            lab, k = ndi.label(a.astype(int).max(axis=2) < 90)
            sizes = ndi.sum(lab > 0, lab, range(1, k + 1))
            sl = ndi.find_objects(lab)[int(np.argmax(sizes))]
            panel = a[sl]
            a = np.tile(paper, (panel.shape[0] + 12, panel.shape[1] + 12, 1))
            a[6:-6, 6:-6] = panel
            x0, y0 = x0 + sl[1].start - 6, y0 + sl[0].start - 6
        ink = a.astype(int).min(axis=2) < 225
        ys, xs = np.where(ink)
        m = 6
        by0, by1, bx0, bx1 = max(0, ys.min() - m), min(a.shape[0], ys.max() + m + 1), max(0, xs.min() - m), min(a.shape[1], xs.max() + m + 1)
        name = 'mt_%02d' % n
        im = Image.fromarray(a[by0:by1, bx0:bx1])
        if n not in AT_SIZE:
            im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
        im.save(os.path.join(CROPS, name + '.png'))
        crops.append({'name': name, 'sheet': 'mt', 'pos': n, 'row': r, 'col': c, 'decade': None, 'box': [int(x0 + bx0), int(y0 + by0), int(x0 + bx1), int(y0 + by1)]})
    json.dump(crops, open(os.path.join(CACHE, 'crops.json'), 'w'), indent=0)
    print(len(crops), 'crops')


if __name__ == '__main__':
    main()
