#!/usr/bin/env python3
"""Redraw a traced sunset dome: the source's arc wobbles and the whole mark runs tall, so the marks
above a wordmark are replaced by an exact arc over clean stripes.

The stripes sit *inside* the cap's springline and step in as they go down, which is what the source
does — bars wider than the cap read as a mushroom with a step under it, and slicing one ellipse
pinches the stripe ends into wedges.

build.py applies overrides/<crop>.json through rebuild(), so the redraw stays reproducible instead of
living in hand-edited logos.json. Sizes are in the crop's own pixels.
"""
import math


def _arc(cx, base, half, rise, steps=44):
    """Closed shape: an elliptical arc springing from (cx ± half, base) over to the apex."""
    pts = [(cx + half * math.cos(math.pi - math.pi * i / steps), base - rise * math.sin(math.pi - math.pi * i / steps)) for i in range(steps + 1)]
    pts += [(cx - half, base)]
    return pts


def _bar(cx, base, half, height):
    return [(cx + half, base), (cx + half, base - height), (cx - half, base - height), (cx - half, base)]


def _part(pts, fill, thickness):
    d = 'M%.2f %.2f' % pts[0] + ''.join('L%.2f %.2f' % p for p in pts[1:]) + 'Z'
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    area = abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2
    b = [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]
    return {'k': 'i', 'f': fill, 'd': d, 'b': b, 'a': round(area), 'r': 'm', 'row': -1, 't': round(thickness, 1), 'ang': 0}


def rebuild(parts, capHeight=117, barHeight=15, gap=8, barWidth=264, capWidth=272, taper=5):
    """Swap the marks stacked above the wordmark for an exact arc over evenly spaced stripes,
    keeping the source's colours, order and count."""
    word = [p for p in parts if p.get('r') == 'w']
    if not word:
        raise SystemExit('dome: no wordmark row to sit the dome above')
    top_word = min(p['b'][1] for p in word)
    keep = [p for p in parts if p.get('r') == 'w' or p['b'][3] > top_word + 1]
    dome = [p for p in parts if not (p.get('r') == 'w' or p['b'][3] > top_word + 1)]
    if len(dome) < 2:
        raise SystemExit('dome: expected a cap and stripes above the wordmark, found %d' % len(dome))
    base = max(p['b'][3] for p in dome)
    cx = (min(p['b'][0] for p in dome) + max(p['b'][2] for p in dome)) / 2
    dome.sort(key=lambda p: p['b'][1])
    cap, bars = dome[0], sorted(dome[1:], key=lambda p: -p['b'][1])     # bars bottom-up
    out = []
    y = base
    for i in range(len(bars)):
        idx = len(bars) - 1 - i                                          # 0 = top bar, narrowest at the bottom
        half = (barWidth - idx * taper) / 2
        out.append(_part(_bar(cx, y, half, barHeight), bars[i].get('f') or '#000000', barHeight))
        y -= barHeight + gap
    out.insert(0, _part(_arc(cx, y, capWidth / 2, capHeight), cap.get('f') or '#000000', capHeight))
    return out + keep
