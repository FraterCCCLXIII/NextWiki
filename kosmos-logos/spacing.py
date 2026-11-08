#!/usr/bin/env python3
"""Open a gap between a logo's mark and its wordmark.

build.py applies overrides/<crop>.json through rebuild(), so the spacing stays reproducible instead
of living in hand-edited logos.json. When the tracer did not tag a wordmark row, the split is found
from the layout: rows are clustered by vertical overlap and the bottom cluster is the wordmark.
"""
import math
import re

NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')
CMD = re.compile(r'([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)')
ARGS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7, 'Z': 0}


def translate(d, dx=0.0, dy=0.0):
    """Move a path by (dx, dy). Everything comes back as absolute commands, which is the same
    geometry and keeps the parser honest about mixed absolute/relative input."""
    x = y = sx = sy = 0.0
    out = []
    for m in CMD.finditer(d):
        cmd = m.group(1)
        vals = [float(v) for v in NUM.findall(m.group(2))]
        rel = cmd.islower()
        c = cmd.upper()
        n = ARGS[c]
        if n == 0:
            x, y = sx, sy
            out.append('Z')
            continue
        for i in range(0, len(vals), n):
            v = vals[i:i + n]
            if c == 'H':
                x = (x + v[0]) if rel else v[0]
                out.append('L%.2f %.2f' % (x + dx, y + dy))
                continue
            if c == 'V':
                y = (y + v[0]) if rel else v[0]
                out.append('L%.2f %.2f' % (x + dx, y + dy))
                continue
            if c == 'A':
                ax, ay = ((x + v[5], y + v[6]) if rel else (v[5], v[6]))
                x, y = ax, ay
                out.append('A%.2f %.2f %.2f %d %d %.2f %.2f' % (v[0], v[1], v[2], v[3], v[4], x + dx, y + dy))
                continue
            pts = [((x + v[j], y + v[j + 1]) if rel else (v[j], v[j + 1])) for j in range(0, n, 2)]
            x, y = pts[-1]
            if c == 'M':
                sx, sy = x, y
                out.append('M%.2f %.2f' % (pts[0][0] + dx, pts[0][1] + dy))
                if len(pts) > 1:
                    out.append('L' + ' '.join('%.2f %.2f' % (px + dx, py + dy) for px, py in pts[1:]))
            else:
                out.append(c + ' ' + ' '.join('%.2f %.2f' % (px + dx, py + dy) for px, py in pts))
    return ''.join(out)


def _rows(parts):
    """Parts grouped into rows by vertical overlap, top to bottom."""
    rows = []
    for p in sorted(parts, key=lambda p: p['b'][1]):
        for r in rows:
            if p['b'][1] < r['bot'] - 1:
                r['parts'].append(p)
                r['bot'] = max(r['bot'], p['b'][3])
                break
        else:
            rows.append({'parts': [p], 'bot': p['b'][3]})
    return [r['parts'] for r in rows]


def rebuild(parts, gap=0, h=None):
    """Move the wordmark down until the mark above it clears `gap` pixels; returns the parts and
    the viewBox height they now need."""
    rows = _rows(parts)
    if len(rows) < 2:
        raise SystemExit('spacing: could not separate a mark from a wordmark')
    words = [p for p in parts if p.get('r') == 'w'] or rows[-1]
    marks = [p for p in parts if p not in words]
    if not words or not marks:
        raise SystemExit('spacing: no wordmark found below the mark')
    cur = min(p['b'][1] for p in words) - max(p['b'][3] for p in marks)
    dy = gap - cur
    if dy <= 0.5:
        return parts, h
    for p in words:
        p['d'] = translate(p['d'], 0, dy)
        p['b'] = [p['b'][0], round(p['b'][1] + dy, 1), p['b'][2], round(p['b'][3] + dy, 1)]
        if p.get('L'):
            p['L'] = [[c, translate(dd, 0, dy) if dd else dd] for c, dd in p['L']]
    bottom = max(p['b'][3] for p in parts)
    return parts, max(h or 0, math.ceil(bottom + 4))
