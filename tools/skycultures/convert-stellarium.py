#!/usr/bin/env python3
"""Convert Stellarium sky-culture index.json files into our skycultures/<id>.json schema.
Usage: convert-stellarium.py <stellarium_dir> <hyg_csv> <out_dir>
Inputs are downloaded to a scratch dir beforehand (see CULTURES for what is merged).
Run with: python3 -I convert-stellarium.py ...
"""
import csv, json, re, sys, html, os

SRC, HYG, OUT = sys.argv[1:4]
CON = json.load(open('apps/web/public/kosmo/static/constellations.json'))['stars']
BASE = 'https://github.com/Stellarium/stellarium/tree/master/skycultures/'

# output id -> metadata; parts = list of (stellarium dir, group label)
CULTURES = {
 'polynesian': dict(name='Polynesian', region='Polynesia and Aotearoa', era='Traditional, recorded 19th-21st c.', color='#2ec4b6',
   desc='Star lore and navigation star lines from Hawaii (Hawaiian Starlines as used by the Polynesian Voyaging Society), Aotearoa (Maori), the Society Islands (Ruanui sky of Tahiti), Samoa and Tonga.',
   parts=[('hawaiian_starlines','Hawaiian star lines'),('maori','Maori'),('ruanui_sky_tahiti_and_society_islands','Tahiti and Society Islands'),('samoan','Samoan'),('tongan','Tongan')]),
 'aboriginal': dict(name='Aboriginal Australian (Boorong)', region='Australia (north-west Victoria)', era='Recorded 1857', color='#d9822b',
   desc='The Boorong sky of Lake Tyrrell as written down by William Stanbridge in 1857 and identified by John Morieson. Other Aboriginal skies are documented but are not included here (see report).',
   parts=[('boorong','Boorong')]),
 'tupi': dict(name='Tupi-Guarani', region='Brazil', era='Traditional, documented 20th c.', color='#7cc242', desc='Tupi-Guarani constellations of Brazil, including the Ema (Guira-nhandu, rhea) drawn along the Milky Way, as compiled for Stellarium.', parts=[('tupi','Tupi-Guarani')]),
 'navajo': dict(name='Navajo (Dine)', region='North America (Southwest)', era='Traditional', color='#c0392b', desc='Navajo (Dine) star groups compiled for Stellarium.', parts=[('navajo','Navajo')]),
 'inuit': dict(name='Inuit', region='Arctic North America', era='Traditional', color='#6fb7e8', desc='Inuit star groups and star names compiled for Stellarium.', parts=[('inuit','Inuit')]),
 'maya': dict(name='Maya', region='Mesoamerica', era='Classic to colonial (historical)', color='#e0b100', desc='Maya constellations reconstructed from codices, inscriptions and ethnohistory, compiled for Stellarium.', parts=[('maya','Maya')]),
 'aztec': dict(name='Aztec (Mexica)', region='Central Mexico', era='Postclassic (historical)', color='#a64ca6', desc='Mexica (Aztec) constellations compiled for Stellarium from colonial sources.', parts=[('aztec','Aztec')]),
 'northern-andes': dict(name='Northern Andes', region='Ecuador and the Northern Andes', era='Modern reconstruction', color='#b5651d', desc='Star patterns and dark constellations proposed by Andean researchers (Guayasamin and colleagues) for the equatorial sky; the figure names honour modern researchers and are a contemporary reconstruction, not attested Inca names.', parts=[('northern_andes','Northern Andes')]),
 'melanesian': dict(name='Melanesian (Anuta and Vanuatu)', region='Solomon Islands and Vanuatu', era='Ethnographic', color='#33a1c9', desc='Star lore of Anuta (Solomon Islands) and the Netwar (Vanuatu) people compiled for Stellarium.', parts=[('anutan','Anuta'),('vanuatu_netwar','Netwar, Vanuatu')]),
 'seri': dict(name='Seri (Comcaac)', region='Sonora, Mexico', era='Traditional', color='#e86f9a', desc='Seri (Comcaac) constellations compiled for Stellarium.', parts=[('seri','Seri')]),
 'potawatomi': dict(name='Potawatomi (Neshnabe)', region='Great Lakes, North America', era='Traditional', color='#8fd0a0', desc='Potawatomi Star Knowledge (Neshnabe Nengosek Kenomagewen) compiled for Stellarium. Only line data are used here; the artwork is under a separate non-commercial licence and is not included.', parts=[('potawatomi','Potawatomi')]),
 'sami': dict(name='Sami', region='Northern Fennoscandia', era='Traditional', color='#5f8dd3', desc='Sami star groups compiled for Stellarium.', parts=[('sami','Sami')]),
 'norse': dict(name='Norse', region='Northern Europe', era='Medieval (incomplete)', color='#9aa7b8', desc='Norse star names and groups compiled for Stellarium; marked incomplete upstream.', parts=[('norse','Norse')]),
 'mongolian': dict(name='Mongolian', region='Mongolia', era='Traditional', color='#4e9f9f', desc='Mongolian star groups compiled for Stellarium.', parts=[('mongolian','Mongolian')]),
 'siberian': dict(name='Siberian (Russia)', region='Northern Asia', era='Ethnographic', color='#b8a1e3', desc='Star groups of Siberian peoples compiled for Stellarium.', parts=[('russian_siberian','Siberian')]),
 'tibetan': dict(name='Tibetan', region='Tibet', era='Traditional', color='#d94f30', desc='Tibetan zodiac signs and lunar mansions with Tibetan names, compiled for Stellarium. Upstream asks for specialist review.', parts=[('tibetan','Tibetan')]),
 'tikuna': dict(name='Tikuna', region='Upper Amazon', era='Ethnographic', color='#6aa84f', desc='Tikuna constellations compiled for Stellarium.', parts=[('tikuna','Tikuna')]),
 'tukano': dict(name='Tukano', region='North-west Amazon', era='Ethnographic', color='#c9a227', desc='Tukano constellations compiled for Stellarium.', parts=[('tukano','Tukano')]),
 'macedonian': dict(name='Macedonian (folk)', region='Balkans', era='Traditional', color='#cf6a87', desc='Macedonian folk star names and groups compiled for Stellarium.', parts=[('macedonian','Macedonian')]),
 'belarusian': dict(name='Belarusian (folk)', region='Eastern Europe', era='Traditional', color='#7d9c3a', desc='Belarusian folk constellations compiled for Stellarium.', parts=[('belarusian','Belarusian')]),
 'romanian': dict(name='Romanian (folk)', region='Eastern Europe', era='Traditional', color='#3d7ea6', desc='Romanian folk star names and groups compiled for Stellarium.', parts=[('romanian','Romanian')]),
 'sardinian': dict(name='Sardinian (folk)', region='Sardinia', era='Traditional', color='#e08e45', desc='Sardinian folk star names and groups compiled for Stellarium.', parts=[('sardinian','Sardinian')]),
}
ONLY = set(sys.argv[4:])

hyg = {}
with open(HYG, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        if r['hip']: hyg[int(r['hip'])] = r

def hyg_star(h):
    r = hyg.get(h)
    if not r: return None
    name = r['proper'] or (f"{r['bf']}".strip() if r['bf'] else '') or (f"HR {r['hr']}" if r['hr'] else f'HIP {h}')
    dist = float(r['dist']); dist = None if dist >= 99999 else round(dist, 2)
    return [round(float(r['ra'])*15, 4), round(float(r['dec']), 4), dist, round(float(r['mag']), 2), name, r['spect']]

def norm(s): return re.sub(r'[^a-z0-9]', '', html.unescape(re.sub(r'<[^>]+>', '', s)).lower())

def rows(md):
    out = []
    for line in md.splitlines():
        if line.count('|') >= 2 and not re.match(r'^\s*\|?\s*-', line):
            out.append([html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in line.strip().strip('|').split('|')])
    for tr in re.findall(r'<tr>(.*?)</tr>', md, re.S):
        out.append([html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)])
    return out

def authors(md):
    m = re.search(r'## Authors?\s*\n+(.*?)(\n## |\Z)', md, re.S)
    t = m.group(1).strip() if m else ''
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t); t = re.sub(r'\S+@\S+|\(at\)|\(\w+@[^)]*\)', '', t)
    return re.sub(r'\s+', ' ', t)[:300]

def license_of(md):
    m = re.search(r'## License\s*\n+(.*?)(\n## |\Z)', md, re.S)
    return re.sub(r'\s+', ' ', m.group(1)).strip()[:200] if m else ''

for cid, meta in CULTURES.items():
    if ONLY and cid not in ONLY: continue
    skipped_coord = [0]; figures = []; sources = []; lics = []; seen_ids = set(); missing = 0
    for d, group in meta['parts']:
        idx = json.load(open(f'{SRC}/{d}/index.json'))
        md = open(f'{SRC}/{d}/description.md', encoding='utf-8').read()
        rws = rows(md)
        au = authors(md)
        sources.append(f"Stellarium sky culture '{d}' ({BASE}{d}); contributed by: {au or 'see description.md'}")
        lics.append(f"{d}: {license_of(md)}")
        items = [(c, 'constellation') for c in idx.get('constellations', [])] + [(c, 'asterism') for c in idx.get('asterisms', [])]
        for c, kind in items:
            cn = c.get('common_name', {})
            native = cn.get('native') or ''; eng = cn.get('english') or ''
            latin = all(ord(ch) < 0x250 or 0x2000 <= ord(ch) < 0x2070 for ch in native)
            name = (native if native and latin else eng or native or cn.get('transliteration', ''))
            if not name or re.match(r'^(CON|AST)\b', name): continue
            if kind == 'asterism' and d == 'tibetan': kind = 'mansion'
            if d == 'tibetan' and kind == 'constellation': kind = 'zodiac'
            fid = re.sub(r'[^a-z0-9]+', '-', f"{cid}-{d.split('_')[0]}-{name}".lower()).strip('-')[:70]
            base = fid; n = 2
            while fid in seen_ids: fid = f'{base}-{n}'; n += 1
            seen_ids.add(fid)
            polygon = None
            lines = []
            for pl in c.get('lines', []):
                pts = [h for h in pl if isinstance(h, list)]
                if pts:
                    if len(pts) == len(pl) and len(pts) > 3 and pts[0] == pts[-1] and polygon is None:
                        polygon = [[round(((a % 24) * 15), 3), round(b, 3)] for a, b in pts]
                    else:
                        skipped_coord[0] += 1
                cur = []
                for h in pl:
                    if isinstance(h, int): cur.append(f'HIP{h}')
                    else:
                        if len(cur) > 1: lines.append(cur)
                        cur = []
                if len(cur) > 1: lines.append(cur)
            extra = {}
            for pl in lines:
                for s in pl:
                    if s not in CON and s not in extra:
                        st = hyg_star(int(s[3:]))
                        if st: extra[s] = st
                        else: missing += 1
            # drop segments with unresolved stars
            ok = lambda s: s in CON or s in extra
            clean = []
            for pl in lines:
                cur = []
                for s in pl:
                    if ok(s): cur.append(s)
                    else:
                        if len(cur) > 1: clean.append(cur)
                        cur = []
                if len(cur) > 1: clean.append(cur)
            if not clean and not polygon: continue
            keys = {norm(native), norm(eng)} - {''}
            story = ''
            for r in rws:
                if len(r) >= 2 and norm(r[0]) in keys or (len(r) >= 3 and norm(r[1]) in keys):
                    cells = [x for x in r if x and norm(x) not in keys and not re.fullmatch(r'[\d.]+', x)]
                    story = '; '.join(cells)[:300]; break
            if story: story = 'Stellarium description: ' + story + '. '
            story += f"Line pattern from the Stellarium '{d}' sky culture; see source for documentation."
            fig = dict(id=fid, name=name, kind=kind, group=group)
            if clean: fig['lines'] = clean
            if polygon:
                fig['kind'] = 'dark-cloud'; fig['polygon'] = polygon
                story += ' Outline is the RA/Dec polygon traced by Stellarium contributors, approximate.'
                if cid == 'aboriginal':
                    story = ('Tchingal, the emu of the Boorong (Lake Tyrrell, Victoria), recorded by William Stanbridge in 1857 as a dark space near the Cross. '
                             'The outline is the approximate RA/Dec polygon traced for Stellarium by John Morieson and Alex Cherney, running from the Coalsack through the dark lanes of the Milky Way towards Scorpius. '
                             'The widely known Emu in the Sky is documented in other Aboriginal communities (e.g. Euahlayi and Kamilaroi; Fuller, Norris and Trudgett 2014, Australian Aboriginal astronomy); those community datasets are not included here.')
            if native and native != name: fig['native'] = native
            if eng and eng != name: fig['meaning'] = eng
            tr = cn.get('transliteration')
            if tr: fig['romanized'] = tr
            if extra: fig['extraStars'] = extra
            fig['story'] = story
            figures.append(fig)
    doc = dict(id=cid, name=meta['name'], region=meta['region'], era=meta['era'], color=meta['color'], description=meta['desc'],
               source=sources + ['HYG Database v4.1 (https://github.com/astronexus/HYG-Database), CC BY-SA 4.0, for stars not in constellations.json'],
               license='Derived from Stellarium sky-culture data. Upstream licences: ' + ' | '.join(lics) + '. Redistributed with attribution; share-alike terms apply to derived data.',
               figures=figures)
    json.dump(doc, open(f'{OUT}/{cid}.json', 'w'), ensure_ascii=False, indent=1)
    print(cid, len(figures), 'figures', 'unresolved stars', missing, 'coord-lines skipped', skipped_coord[0])
