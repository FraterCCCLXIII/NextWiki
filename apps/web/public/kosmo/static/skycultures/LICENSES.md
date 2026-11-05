# Sources and licences

Every data source behind the Kosmo sky-culture layer. Other agents: append one row per new source to the table below (keep it a simple table, one row per source).

| Source | Used for | Licence | Share-alike? | Where |
|---|---|---|---|---|
| HYG Database v4.1 (David Nash; from Hipparcos, Yale Bright Star, Gliese) | `stars` dict of `constellations.json`: positions, magnitudes, spectral types, distances | CC BY-SA 4.0 | Yes | https://github.com/astronexus/HYG-Database |
| d3-celestial (Olaf Frohn) `constellations.lines.json` | IAU stick figures in `constellations.json` | BSD-3-Clause | No (keep copyright notice) | https://github.com/ofrohn/d3-celestial |
| Wikipedia: IAU designated constellations, by solid angle, constellation family | names, abbreviations, genitives, meanings, areas, origin years | CC BY-SA 4.0 | Yes | https://en.wikipedia.org/wiki/IAU_designated_constellations |
| IAU / E. Delporte (1930) constellation boundaries | `skycultures/boundaries.json`, constellation assignment | Public (factual data, boundaries adopted by the IAU) | No | https://www.iau.org/public/themes/constellations/ |
| Gaia DR3 (ESA/Gaia/DPAC) and Bailer-Jones et al. 2021 geometric distances (VizieR I/352) | distances for 17 stars missing in HYG | CC BY-SA 3.0 IGO (Gaia); CDS/VizieR terms with attribution (B-J) | Yes (Gaia) | https://gea.esac.esa.int/archive/ , https://cdsarc.cds.unistra.fr/viz-bin/cat/I/352 |
| Hipparcos, the New Reduction (van Leeuwen 2007; VizieR I/311) | cross-check of parallaxes | CDS/VizieR terms, attribution required | No | https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311 |
| Argyle et al. 2015 (orbit of Beta Phoenicis) | distance of Beta Phe (17.93 mas) | Published literature value (fact, cited) | No | via https://en.wikipedia.org/wiki/Beta_Phoenicis |
| Constellation `story`, `origin`, `year`, Serpens `parts` text (this project) | `constellations.json` | MIT (repository licence, `LICENSE.md`); original wording paraphrasing Wikipedia, I. Ridpath's Star Tales, Ptolemy, Bayer, Hevelius, Lacaille | No | `tools/skycultures/constellation_lore.py` |
| Stellarium skycultures: western (Stellarium team) | cross-check of IAU figures | Text and data CC BY-SA; illustrations Free Art License | Yes | https://github.com/Stellarium/stellarium-skycultures |
| Stellarium skycultures: western_SnT, western_rey | alternative western figures | CC BY-SA 2.0; CC BY-SA | Yes | same repository |
| Stellarium skycultures: western_hlad | alternative western figures | GNU GPL v2.0 | Copyleft (GPL), not compatible with MIT redistribution without care | same repository |
| Stellarium skycultures: chinese, chinese_contemporary, indian, mongolian, norse, sami, siberian, romanian, ruelle, belarusian, tukano, anutan, blackfoot, bugis, hawaiian_starlines, mandar, maori, tongan, japanese_moon_stations, boorong | culture figures | CC BY-SA (check each `description.md`; some images Public Domain or Free Art License) | Yes | same repository |
| Stellarium skycultures: aztec, egyptian, korean, macedonian, navajo, northern_andes, sardinian, tupi, inuit | culture figures | GNU GPL v2.0 | Copyleft (GPL) | same repository |
| Stellarium skycultures: arabic_al-sufi, arabic_ancient, arabic_arabian_peninsula, arabic_lunar_stations | culture figures | CC BY-ND 4.0 (special permission only to Stellarium) | No derivatives allowed: do not redistribute adapted figures | same repository |
| Stellarium skycultures: kamilaroi | culture figures | CC BY-NC-ND 4.0 (special permission only to Stellarium) | No commercial use, no derivatives | same repository |
| Stellarium skycultures: lokono | culture figures | CC BY-NC (special permission only to Stellarium) | No commercial use | same repository |

Licences above are read from the "License" section of each culture's `description.md` in the Stellarium repository (checked in this session). Licences can differ per file in that repository, so confirm in the culture's own file before reuse.

## What share-alike means here

- CC BY-SA 4.0 (HYG, Wikipedia-derived data, most Stellarium cultures) lets anyone copy, adapt and redistribute, even commercially, but requires (1) attribution to the source, (2) a link to the licence and a note of changes, and (3) that the adapted data is released under the same or a compatible licence.
- Therefore the `stars` dict of `constellations.json`, the star distances and anything derived from them (for example the computed 3D-spread sentence of each story) stay CC BY-SA 4.0 when redistributed, including inside the database seed. This is why `constellations.json` carries the `licenses` object.
- The original story text, `origin` and `year` are under the repository's MIT licence. A consumer who copies the whole file must still honour CC BY-SA for the data portions; copying only the text fields does not trigger share-alike.
- Showing the data in the app (a web page) is a use, not a redistribution of an adaptation; the site should still credit HYG, Wikipedia and the Stellarium cultures it displays (an "About the data" or credits page that links this file is enough).
- GPL v2 cultures: derived files should be treated as GPL v2, which is not compatible with CC BY-SA or MIT redistribution of the same file. Keep them in their own culture files and note the licence in each file's `license` field.
- CC BY-ND and NC cultures (Arabic, Kamilaroi, Lokono): Stellarium has permission that we do not. Use only as read-only references; do not ship converted figures from them.
