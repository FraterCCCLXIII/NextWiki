#!/usr/bin/env python3
"""Assemble sheet.html and sheet-numbers.json, plus logos.json (the vector payload the logo reel
loads), from .cache/traced/*.json, using the SpaceRadio sheet and viewer as the player.
Order: segment.py, trace_all.py, fit_fonts.py, build.py. Serve from the repository root, since sound comes from ../spaceradio-logos/audio."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SR = os.path.join(HERE, '..', 'spaceradio-logos')
CACHE = os.path.join(HERE, '.cache')
KEEP = ('k', 'f', 'd', 'L', 'b', 'a', 'r', 'row', 'gm', 'ang', 'fr', 'rule', 't')


def slim(p):
    o = {k: p[k] for k in KEEP if (k in p and p[k] not in (None, '', 0)) or (k == 'row' and k in p)}
    if 'f' in o and o.get('k') == 'p':
        del o['f']
    return o


def main():
    crops = json.load(open(os.path.join(CACHE, 'crops.json')))
    data, numbers, tiles = {}, {}, []
    for c in crops:
        fonted = os.path.join(CACHE, 'fonted', c['name'] + '.json')
        n, info = c['pos'], json.load(open(fonted if os.path.exists(fonted) else os.path.join(CACHE, 'traced', c['name'] + '.json')))
        data[n] = {'w': info['w'], 'h': info['h'], 'p': [slim(p) for p in info['parts']]}
        numbers[str(n)] = {'cropBoxInSheet': c['box'], 'mode': info['mode'], 'iou': info['iou'], 'colourErrorDE': info.get('de'), 'parts': len(info['parts']), 'wordmarkFont': info.get('font')}
        tiles.append('<figure class="tile" tabindex="0" role="button" data-n="%d" aria-label="Play logo %d"><span class="num">%d</span><div class="art"></div></figure>' % (n, n, n))
    tpl = open(os.path.join(SR, 'sheet.template.html')).read()
    for a, b in [('<title>SpaceRadio Logo Sheet</title>', '<title>Modern Telepathy Logo Sheet</title>'),
                 ('<h1>SpaceRadio logos, traced to vector</h1>', '<h1>Modern Telepathy logos, traced to vector</h1>'),
                 ("createJinglePlayer('audio/')", "createJinglePlayer('../spaceradio-logos/audio/')"),
                 ('spaceradio-sound-bag', 'modern-telepathy-sound-bag'), ("SOUND_KEY='spaceradio-sound'", "SOUND_KEY='modern-telepathy-sound'"),
                 ("const KEY='spaceradio-viewer'", "const KEY='modern-telepathy-viewer'")]:
        if tpl.count(a) != 1:
            sys.exit('template changed: ' + a)
        tpl = tpl.replace(a, b)
    tpl, k = re.subn(r'__COUNT__ logos from five source sheets[^<]*', '__COUNT__ logos from one low-resolution source sheet, so small lettering is soft. Click a tile to play its reveal, or use the corner button to open it full screen.', tpl, count=1)
    if k != 1:
        sys.exit('template changed: lead text')
    sound = open(os.path.join(HERE, '..', 'tools', 'logo-sound.js')).read() + open(os.path.join(HERE, '..', 'tools', 'logo-backdrop.js')).read()
    html = tpl.replace('__SOUND__', sound).replace('__COUNT__', str(len(data))).replace('__NAV__', '').replace('__BODY__', '<section><div class="grid">%s</div></section>' % ''.join(tiles)).replace('__DATA__', json.dumps(data, separators=(',', ':')))
    open(os.path.join(HERE, 'sheet.html'), 'w').write(html)
    out = os.path.join(HERE, 'logos.json')
    json.dump(data, open(out, 'w'), separators=(',', ':'))
    json.dump({'total': len(data), 'source': 'refs/sheet.png', 'logos': numbers}, open(os.path.join(HERE, 'sheet-numbers.json'), 'w'), indent=1)
    print('logos', len(data), 'sheet.html KB %d, logos.json KB %d' % (len(html) // 1024, os.path.getsize(out) // 1024))


if __name__ == '__main__':
    main()
