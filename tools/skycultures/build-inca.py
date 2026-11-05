#!/usr/bin/env python3
"""Build skycultures/inca.json: Quechua/Inca dark-cloud figures with schematic polygons.
Polygons are defined in Galactic (l, b) and converted to J2000 RA/Dec. They are APPROXIMATE and
schematic: the Inca figures are shapes within the dark lanes of the Milky Way, and the (l,b) boxes
below are this builder's coarse placement along the lane, not a measured outline."""
import json, math, sys
OUT = sys.argv[1]
NGP_RA, NGP_DEC, L_NCP = map(math.radians, (192.85948, 27.12825, 122.93192))
def gal2eq(l, b):
    l, b = math.radians(l), math.radians(b)
    sd = math.sin(b)*math.sin(NGP_DEC) + math.cos(b)*math.cos(NGP_DEC)*math.cos(L_NCP - l)
    dec = math.asin(sd)
    y = math.cos(b)*math.sin(L_NCP - l)
    x = math.sin(b)*math.cos(NGP_DEC) - math.cos(b)*math.sin(NGP_DEC)*math.cos(L_NCP - l)
    ra = (NGP_RA + math.atan2(y, x)) % (2*math.pi)
    return [round(math.degrees(ra), 2), round(math.degrees(dec), 2)]
def poly(pts): 
    p = [gal2eq(l, b) for l, b in pts]; return p + [p[0]]
SRC = 'Urton, G. (1981) At the Crossroads of the Earth and the Sky: An Andean Cosmology, University of Texas Press (Quechua dark-cloud constellations, Misminay, Cuzco region)'
NOTE = ' The outline is a schematic, approximate region of the Milky Way dark lane, not a measured boundary; consult the source for the figure itself.'
figs = [
 ('yacana', 'Yacana', 'Yakana', 'The Llama', 'Dark-cloud llama of the Milky Way lane, with its head toward the Coalsack. Described in Quechua tradition by Urton (1981) and earlier chroniclers.',
  [(299,2),(308,3.5),(320,4),(335,4),(348,5),(352,2),(348,-2),(335,-3.5),(320,-4),(308,-4),(299,-3)]),
 ('yutu', "Yutu", 'Yutu', 'The Tinamou', 'Dark-cloud tinamou (partridge-like bird) near the Southern Cross, per Urton (1981).',
  [(290,-4),(299,-4),(299,3),(290,3)]),
 ('hanpatu', "Hanp'atu", "Hanp'atu", 'The Toad', 'Dark-cloud toad toward the Scorpius end of the lane, per Urton (1981).',
  [(350,-9),(358,-9),(358,-3),(350,-3)]),
 ('atoq', 'Atoq', 'Atuq', 'The Fox', 'Dark-cloud fox in the Scorpius-Ophiuchus region of the lane, per Urton (1981).',
  [(355,2),(5,2),(5,9),(355,9)]),
 ('machacuay', "Mach'acuay", "Mach'aqway", 'The Serpent', 'Dark-cloud serpent lying alongside the llama, per Urton (1981).',
  [(322,5),(336,5),(336,10),(322,10)]),
]
figures = []
for fid, name, native, meaning, story, pts in figs:
    figures.append(dict(id='inca-' + fid, name=name, native=native, meaning=meaning, kind='dark-cloud', group='Dark constellations (yana phuyu)',
                        polygon=poly(pts), story=story + NOTE, status='variant'))
for f in figures: f.pop('status')
doc = dict(id='inca', name='Inca (Quechua)', region='Andes (Cuzco region)', era='Inca and modern Quechua tradition', color='#cc7a00',
  description='Quechua dark constellations: animal shapes seen in the dark lanes of the Milky Way rather than among bright stars. Polygons are schematic approximations.',
  source=[SRC, 'Positions: Galactic-to-equatorial conversion (J2000) by tools/skycultures/build-inca.py'],
  license='Original compilation (CC0 for the coordinates); factual references only, no text copied from the sources',
  figures=figures)
json.dump(doc, open(OUT + '/inca.json', 'w'), ensure_ascii=False, indent=1)
print('inca', len(figures))
