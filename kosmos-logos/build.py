#!/usr/bin/env python3
"""Assemble logos.json (the vector data a logo reel loads) and sheet-numbers.json
from .cache/traced/*.json. Run via build.sh (segment -> trace -> build)."""
import json, os

import paint
import spacing

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
KEEP = ('k', 'f', 'd', 'L', 'b', 'a', 'r', 'row', 'gm', 'ang', 'fr', 'rule', 't')


def slim(p):
    o = {}
    for k in KEEP:
        if k in p and p[k] not in (None, '', 0) or (k in ('row',) and k in p):
            o[k] = p[k]
    if p.get('k') == 'c' and 'L' not in p:
        o['k'] = 'c'
    if 'f' in o and o.get('k') == 'p':
        del o['f']
    return o


def main():
    crops = json.load(open(os.path.join(CACHE, 'crops.json')))
    logos, numbers, n = {}, {}, 0
    for c in crops:
        path = os.path.join(CACHE, 'traced', c['name'] + '.json')
        if not os.path.exists(path):
            print('skip %s: not traced' % c['name'])
            continue
        info = json.load(open(path))
        if not info.get('parts'):
            print('skip %s: nothing traced' % c['name'])
            continue
        n += 1
        parts, height = [slim(p) for p in info['parts']], info['h']
        ov = os.path.join(HERE, 'overrides', c['name'] + '.json')
        if os.path.exists(ov):
            o = json.load(open(ov))
            if 'gap' in o:
                parts, height = spacing.rebuild(parts, h=height, gap=o['gap'])
            if 'paint' in o:
                parts = paint.rebuild(parts, **o['paint'])
            print('%s: overrides/%s applied' % (c['name'], os.path.basename(ov)))
        logos[n] = {'w': info['w'], 'h': height, 'p': parts}
        numbers[str(n)] = {'sheet': c['sheet'], 'position': c['position'], 'row': c['row'], 'col': c['col'],
                           'cropBox': c['box'], 'mode': info['mode'], 'iou': info['iou'],
                           'parts': len(info['parts']),
                           'exactGeometryParts': sum(1 for p in info['parts'] if p.get('gm'))}
    out = os.path.join(HERE, 'logos.json')
    json.dump(logos, open(out, 'w'), separators=(',', ':'))
    json.dump({'total': n, 'logos': numbers}, open(os.path.join(HERE, 'sheet-numbers.json'), 'w'), indent=1)
    print('%d KOSMOS logos, logos.json KB %d' % (n, os.path.getsize(out) // 1024))


if __name__ == '__main__':
    main()
