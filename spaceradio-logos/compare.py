#!/usr/bin/env python3
"""Side-by-side source crop | vector render (cairo) for review. Usage: compare.py OUT.png name [name ...] [--cols N] [--w PX]"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import trace as T
args = sys.argv[1:]
out = args[0]; names = []; cols = 1; W = 560
i = 1
while i < len(args):
    if args[i] == '--cols': cols = int(args[i + 1]); i += 2
    elif args[i] == '--w': W = int(args[i + 1]); i += 2
    else: names.append(args[i]); i += 1
tiles = []
for n in names:
    info = json.load(open(os.path.join(T.OUT, n + '.json')))
    src = Image.open(os.path.join(T.CROPS, n + '.png')).convert('RGB')
    sc = W / src.width
    r = Image.fromarray(T.render_png(info, scale=4)).resize((W, int(src.height * sc)), Image.LANCZOS)
    s = src.resize((W, int(src.height * sc)), Image.LANCZOS)
    h = s.height + 18
    t = Image.new('RGB', (W * 2 + 6, h), '#777')
    t.paste(s, (0, 18)); t.paste(r, (W + 6, 18))
    ImageDraw.Draw(t).text((4, 3), '%s  %s iou=%s dE=%s parts=%d geo=%d' % (n, info['mode'], info['iou'], info['de'], len(info['parts']), info.get('geo', 0)), fill='#fff')
    tiles.append(t)
rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
RH = [max(t.height for t in r) for r in rows]
img = Image.new('RGB', (cols * (W * 2 + 6) + (cols - 1) * 8, sum(RH) + 8 * len(rows)), '#444')
y = 0
for r, rh in zip(rows, RH):
    for c, t in enumerate(r):
        img.paste(t, (c * (W * 2 + 14), y))
    y += rh + 8
img.save(out)
