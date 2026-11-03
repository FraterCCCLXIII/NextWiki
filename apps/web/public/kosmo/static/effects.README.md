# effects.json: realism-effects database for the 3D atlas

148 entries describing every visual effect we want to replicate so the atlas looks like real astronomy imagery. It is the work list we iterate on one effect at a time. Viewer: `effects.html`. Served at `/kosmo/static/effects.json` (from the `kosmo_datasets` table; see wiring below).

## Schema (one object per effect)

| field | meaning |
|---|---|
| id | kebab-case, unique |
| category | galaxy, star, stellar-population, nebula, remnant, compact-object, cluster, cosmic-web, lensing, planet, moon, small-body, optics, post-process, environment, motion |
| name, description | what it looks like in real imagery |
| physics | why it looks that way |
| visualSignature | 3-6 concrete features to match |
| references | list of {title, url, credit}, pages I opened with WebFetch (an effect may have none when no page was opened for it) |
| objects | example catalogue objects |
| implementationIdeas | three.js technique |
| engineHooks | parts of the engine touched |
| difficulty, impact | 1-5 (impact = perceived realism) |
| status | not-started, partial, done, judged by reading the code |
| dependencies | other effect ids |
| testScene | where to see it, as `universe-timeline.html#go=<catalogue name>` (some names may need a catalogue entry) |
| notes | caveats and what the code currently does |

## How it was built

Sources: the NASA Science gallery "Universe - Galaxies" (38 items, read in full as a list) and the Hubble Galaxies and Hubble Solar System galleries, plus about 45 individual NASA / Chandra / JPL / ESA pages for Webb, Hubble, Chandra, Spitzer, Swift, Planck, Fermi, Cassini and EHT imagery (Pillars of Creation, SMACS 0723, Southern Ring, Cas A, Crab, Cartwheel, Bullet Cluster, Einstein rings, 30 Doradus, Omega Centauri, V838 Mon, Eta Carinae, Sombrero, Illustris, Saturn, Jupiter GRS, Io, Enceladus, Borisov, WASP-39 b and others). Status was judged by reading `universe-timeline.html` (fxPatch, fxStarTexture, galaxy/black-hole/solar-system code), `kosmo-models.js` (createModel cases, BH_FRAG) and `cosmic-web.js`. Key findings: there is no post-process pass at all; galaxies are ~9000 additive points; stars have sprite shapes (round, cross, jwst, eight, streak, pixel), halo, twinkle and inverse-square dimming; black holes are ray-traced; nebulae are 5-7 fbm sprites.

Caveats: physics statements not given on the pages are from general astrophysics and marked as such in notes where it matters. Reference credits not visible in what I fetched say "credit line as given on the page". Pages that failed to open: `science.nasa.gov/gallery/universe-nebulae/`, `universe-black-holes/`, `universe-stars/`, `universe-exoplanets/`, `solar-system-planets/`, `universe-nebulae-and-star-clusters/` (all 404; the gallery index exposes only Hubble's Galaxies and Hubble's Solar System in the Universe/Solar System space) and `image-detail/web-first-images-release/` (404). Items listed in galleries but not individually opened (WISE sky, Fermi all-sky, NuSTAR, Planck 4-channel, Hubble Titan/Uranus/Neptune/Pluto pages other than those cited) are not cited as references. Several other agents are working on `nebula-lab.html` and `telescope-fx.html`; these entries do not edit them.

## Counts

| category | total | done | partial | not-started |
|---|---|---|---|---|
| galaxy | 21 | 0 | 7 | 14 |
| nebula | 15 | 0 | 2 | 13 |
| star | 13 | 3 | 3 | 7 |
| optics | 13 | 4 | 2 | 7 |
| planet | 12 | 1 | 6 | 5 |
| compact-object | 10 | 3 | 3 | 4 |
| post-process | 9 | 0 | 0 | 9 |
| lensing | 8 | 0 | 0 | 8 |
| environment | 8 | 0 | 0 | 8 |
| remnant | 7 | 0 | 2 | 5 |
| cosmic-web | 7 | 3 | 0 | 4 |
| motion | 7 | 3 | 3 | 1 |
| stellar-population | 5 | 0 | 2 | 3 |
| moon | 5 | 0 | 1 | 4 |
| cluster | 4 | 0 | 2 | 2 |
| small-body | 4 | 0 | 3 | 1 |
| **all** | **148** | **17** | **36** | **95** |

## Top 15 by impact versus difficulty (suggested order)

1. `pp-hdr-tonemap` (impact 5, difficulty 3, not-started)
2. `pp-tone-stretch-asinh` (impact 5, difficulty 2, not-started)
3. `optics-psf-halo-wings` (impact 4, difficulty 1, partial)
4. `galaxy-smooth-disc-light` (impact 5, difficulty 3, not-started)
5. `extinction-reddening-dust` (impact 5, difficulty 3, not-started)
6. `galaxy-dust-lanes` (impact 5, difficulty 4, not-started)
7. `galaxy-hii-knots` (impact 4, difficulty 2, not-started)
8. `planet-gas-giant-bands` (impact 5, difficulty 2, partial)
9. `planet-rings` (impact 5, difficulty 3, partial)
10. `galaxy-spiral-arms-log` (impact 4, difficulty 2, partial)
11. `nebula-volumetric-raymarch` (impact 5, difficulty 5, not-started)
12. `nebula-emission-ha` (impact 5, difficulty 4, partial)
13. `lensing-deflection-warp-pass` (impact 4, difficulty 4, not-started)
14. `optics-bloom` (impact 4, difficulty 2, not-started)
15. `pop-sky-field-stars` (impact 4, difficulty 2, not-started)

## Suggested iteration order

1. **Foundation**: HDR render target + tone map, then asinh stretch (`pp-hdr-tonemap`, `pp-tone-stretch-asinh`). Everything below benefits, and bloom/PSF halos need it.
2. **Stars and optics**: PSF power-law halo, bloom, wavelength-scaled JWST spikes, field-star layer.
3. **Galaxies**: smooth unresolved disc light with point LOD, HII knots, dust lanes + reddening (a multiplicative absorber layer), edge-on silhouettes.
4. **Planets**: gas-giant bands and vortices, ring shadows and scattering, atmosphere scattering.
5. **Nebulae and remnants**: volumetric raymarched nebula (coordinate with `nebula-lab.html`), then emission/pillars/planetary/SNR looks, narrowband and IR palettes.
6. **Lensing**: screen-space lens-warp pass (reuses the BH_FRAG idea), then Einstein rings and cluster arcs.
7. **Deep-field and cosmology**: redshift colour, Tolman dimming, early-galaxy billboards, two-component cosmic-web render.
8. **Polish**: grain, noise, mosaic artefacts, light echoes, time-lapse motion.

## Wiring

- `apps/web/next.config.ts`: rewrite `/kosmo/static/effects.json` -> `/api/kosmo/data/effects.json`.
- `packages/db/src/seeds/kosmo/datasets.ts`: key `effects.json` added to the dataset list.
- Re-seed after editing the file: from `packages/db`, `pnpm db:seed:kosmo` (note: re-running overwrites the DB row with the file).
