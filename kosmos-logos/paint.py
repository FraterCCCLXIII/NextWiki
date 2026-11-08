#!/usr/bin/env python3
"""Repaint a traced logo as a flat white mark, optionally finishing one part with a gradient.

build.py applies overrides/<crop>.json through rebuild(), so the recolour stays reproducible.
The gradient goes on the bottom line of the mark: of the two largest parts, the one whose box
reaches furthest down. Layers ('L') are dropped so a banded piece doesn't keep its own colours.
"""
DEFAULT_TO = '#6f747c'


def _bottom_row(parts):
    """The lowest row of parts, by vertical overlap — the wordmark when the tracer didn't tag one."""
    rows = []
    for p in sorted(parts, key=lambda p: p['b'][1]):
        for r in rows:
            if p['b'][1] < r['bot'] - 1:
                r['parts'].append(p)
                r['bot'] = max(r['bot'], p['b'][3])
                break
        else:
            rows.append({'parts': [p], 'bot': p['b'][3]})
    return rows[-1]['parts'] if len(rows) > 1 else []


def rebuild(parts, white='#ffffff', gradient_to=DEFAULT_TO, pick='lowest', wordmark=None):
    """wordmark=<hex> only recolours the letters and leaves the mark as traced; otherwise the whole
    logo goes white with a gradient on the bottom line."""
    if wordmark:
        letters = [p for p in parts if p.get('r') == 'w'] or _bottom_row(parts)
        out = []
        for p in parts:
            q = dict(p)
            if any(p is l for l in letters):
                q['f'] = wordmark
                q.pop('L', None)
            out.append(q)
        return out
    marks = sorted(parts, key=lambda p: -(p.get('a') or 0))
    line = None
    if len(marks) >= 2:
        a, b = marks[0], marks[1]
        line = max((a, b), key=lambda p: p['b'][3]) if pick == 'lowest' else min((a, b), key=lambda p: p['b'][1])
    out = []
    for p in parts:
        q = dict(p)
        q.pop('L', None)
        q['k'] = 'c' if q.get('k') == 'c' else 'i'
        if line is not None and p is line:
            q['g'] = [white, gradient_to]
            q['gd'] = [p['b'][0], (p['b'][1] + p['b'][3]) / 2, p['b'][2], (p['b'][1] + p['b'][3]) / 2]
        else:
            q['f'] = white
        out.append(q)
    return out
