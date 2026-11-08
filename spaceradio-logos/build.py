#!/usr/bin/env python3
"""Assemble sheet.html (single self-contained file) and sheet-numbers.json from .cache/traced/*.json.
Run via build.sh (segment -> trace -> build) or on its own after trace.py."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
SHEETS = [('12', 'Black and white', 'sheet 12'), ('13', 'Colour', 'sheet 13'), ('14', 'Decades', 'sheet 14'),
          ('15', 'Colour, set 2', 'sheet 15'), ('16', 'Colour, set 3', 'sheet 16')]
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
    data, numbers, body, nav = {}, {}, [], []
    n = 0
    sheet_counts = {}
    for key, title, label in SHEETS:
        cs = [c for c in crops if c['sheet'] == key]
        first = n + 1
        def tile(c):
            nonlocal n
            n += 1
            info = json.load(open(os.path.join(CACHE, 'traced', c['name'] + '.json')))
            data[n] = {'w': info['w'], 'h': info['h'], 'p': [slim(p) for p in info['parts']]}
            numbers[str(n)] = {'sheet': key, 'sheetFile': 'refs/%s.webp' % key, 'sheetTitle': title, 'position': c['pos'], 'row': c['row'], 'col': c['col'],
                               'decade': c['decade'], 'cropBoxInSheet': c['box'], 'mode': info['mode'], 'iou': info['iou'], 'colourErrorDE': info.get('de'),
                               'parts': len(info['parts']), 'exactGeometryParts': sum(1 for p in info['parts'] if p.get('gm'))}
            return '<figure class="tile" tabindex="0" role="button" data-n="%d" aria-label="Play logo %d"><span class="num">%d</span><div class="art"></div></figure>' % (n, n, n)
        if key == '14':
            parts = []
            for dec in sorted({c['decade'] for c in cs}):
                dc = [c for c in cs if c['decade'] == dec]
                a = n + 1
                tiles = ''.join(tile(c) for c in dc)
                parts.append('<h3>%s<small>%d–%d</small></h3><div class="grid">%s</div>' % (dec, a, n, tiles))
            inner = ''.join(parts)
        else:
            inner = '<div class="grid">%s</div>' % ''.join(tile(c) for c in cs)
        sheet_counts[key] = len(cs)
        body.append('<section id="s%s"><h2>%s<small>source sheet %s · logos %d–%d · %d logos</small></h2>%s</section>' % (key, title, key, first, n, len(cs), inner))
        nav.append('<a href="#s%s">%s<span>%d–%d</span></a>' % (key, title, first, n))
    tpl = open(os.path.join(HERE, 'sheet.template.html')).read()
    js = json.dumps(data, separators=(',', ':'))
    sound = open(os.path.join(HERE, '..', 'tools', 'logo-sound.js')).read() + open(os.path.join(HERE, '..', 'tools', 'logo-backdrop.js')).read()
    html = tpl.replace('__SOUND__', sound).replace('__COUNT__', str(n)).replace('__NAV__', ''.join(nav)).replace('__BODY__', ''.join(body)).replace('__DATA__', js)
    open(os.path.join(HERE, 'sheet.html'), 'w').write(html)
    json.dump({'total': n, 'sheets': {k: {'title': t, 'file': 'refs/%s.webp' % k, 'count': sheet_counts[k]} for k, t, _ in SHEETS}, 'logos': numbers},
              open(os.path.join(HERE, 'sheet-numbers.json'), 'w'), indent=1)
    print('logos', n, 'sheet.html KB', len(html) // 1024)


if __name__ == '__main__':
    main()
