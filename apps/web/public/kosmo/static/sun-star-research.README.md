# Sun surface + stellar-type rendering: research and build plan

Status legend: [S] = confirmed by a source this session, [K] = from general astrophysics knowledge, not re-verified here (check before hard-coding).

## 1. What we have now

`kosmo-models.js` `STAR_FRAG` (line ~92): one fbm layer for granulation, one for spots, `mix(uColor2, uColor, g)`, limb term `0.35 + 0.65*mu^0.6`. Colour comes from `blackbody(T)` (Tanner-Helland style polynomial, ~line 645) and `starTemperature()` maps spectral letter to a single T. Corona is an additive sprite. One shader for stars, white dwarfs, pulsars. There is a `2k_sun.jpg` texture. No wavelength concept at all.

Gaps against "as photoreal as possible, plus UV/other spectra":
- colour is RGB-native, so there is nothing to re-tint for UV/EUV/IR;
- limb darkening is a fudge, identical for every star and every wavelength;
- granulation is plain fbm: no cell/lane structure, no lifetime, no intensity statistics;
- no sunspot structure (umbra/penumbra/filaments), faculae, network, chromosphere, prominences, or realistic corona;
- every star type shares the same texture scale.

## 2. Architecture recommendation: spectral, not RGB

Render each pixel as a **band-limited intensity**, then map bands to display colour at the end.

1. Define a set of bands: visible (computed as CIE XYZ), plus UV-A/B/C-ish, 1600/1700 A (AIA UV continuum), He II 304, Fe 171/193/211/335/94/131 A (EUV), H-alpha 656 nm, Ca II K 393 nm, near-IR, and a soft X-ray proxy.
2. For each band the shader needs: (a) a per-layer emissivity as function of local temperature/height, (b) limb-darkening or brightening coefficients, (c) the false-colour ramp.
3. "Photo" mode = integrate XYZ over the visible bands and convert to sRGB (see 5). "Instrument" mode = single band through the NASA-style colour table.
4. Everything is a toggle on one shader/UBO, so the UI is a spectrum slider or band picker, not separate renderers.

Because the Sun is not one thing in each band, model **layers as separate shells** and composite per band:

| Layer | Approx. height | Dominant look | Bands where it is the star of the show |
|---|---|---|---|
| Photosphere | 0 km | granulation, spots, faculae | visible, near-IR, 1700 A |
| Temperature minimum / low chromosphere | ~250-500 km [S] (1600/1700 A at median 356/368 km) | network, plage, bright points | 1600, 1700, Ca II K |
| Chromosphere | ~860 km for 304 A [S]; spicules to ~10 Mm [K] | fibrils, spicules, filaments, limb "fur" | H-alpha, 304, Ca II K |
| Transition region / low corona | 1.2-1.5 Mm for 131/171 [S] | loops, moss | 131, 171 |
| Corona | out to several R_sun | loops, streamers, holes, flares | 171-335, 94, X-ray, white light (K+F) |

AIA 94/131/171/193/211/335 span roughly 0.6 MK to >16 MK, with 94 and 131 being the hot ones [S]. Each channel also picks up lines from other ions, so a pure "temperature -> brightness" lookup is an approximation [S].

## 3. Solar photosphere: what to model

**Limb darkening** [S/K]
- Linear law, I(mu)/I(1) = 1 - u(1 - mu), common u ~ 0.6 for visible [S]. Quadratic or higher is better; Claret (2000) says the linear law is only marginal near 5500 K [S].
- Neckel & Labs (1994) fit 5th-order polynomials in mu over many wavelengths; Neckel (1996) found the coefficients vary smoothly with wavelength and are roughly linear in 1/lambda or 1/lambda^5 [S].
- Implication: coefficient is a function of **wavelength and Teff**, strongly stronger in blue/UV. Use a small table keyed by band and Teff; interpolate. Pull the actual numbers from Claret & Bloemen (2011) / Neckel (2005); I did not retrieve the tables.
- Limb brightening happens in some UV/EUV lines (the chromosphere/corona is optically thin, so limb path length goes up) [K]. Needs a separate optically-thin shell, not the same law.

**Granulation** [K unless noted]
- Granule size ~1000 km (~1.4 arcsec), lifetime ~5-10 min, intergranular lanes dark, bright rims, small intensity std ~ 14-15% rms bolometric contrast for a G star in MURaM [S: Beeck et al., G type contrast 14.9%, M type 2.30%].
- Structure to emulate: a **Voronoi/cellular pattern advected by a divergent flow** (upwelling at cell centre, downflow in lanes), not fbm. Implement as animated 3D Worley noise with per-cell phase so cells brighten, expand, fragment and fade; warp with a low-frequency flow field. Add exploding granules and bright points in lane junctions.
- Reversed granulation: ~130-140 km above the base the pattern inverts (granules cooler than lanes) [S]. This is the reason UV (1700 A, higher formation) looks different from continuum.
- Mesogranulation (~5-10 Mm) and supergranulation (~30 Mm, 1 day, mostly visible in Doppler and the chromospheric network) layered as larger-scale modulation [K].
- Must be computed on the sphere, so cells foreshorten toward the limb. Use 3D position noise, not UV [S: blog sources agree].

**Sunspots** [S/K]
- Umbra ~4000 K, penumbra ~5500 K [K], spots dark in continuum because the field suppresses convection.
- Penumbra = radial filaments: spines (stronger, more vertical field, darker) alternating with intraspines (weaker, more horizontal, brighter), Evershed outflow radially outward along filaments [S].
- Shader: polar-coordinate stripe noise around spot centre, filament brightness from along-radius gradient, bright penumbral grains near the inner edge, umbral dots in umbra. Spawn from a data-driven spot list (can later be driven from real NOAA active-region data).
- Faculae/plage: bright, near spots and toward the limb (visible in white light mostly near limb, because we see through magnetic flux tubes' evacuated walls) [K]. Bright in Ca II K, 1600 A.

**Chromosphere / corona**
- Spicules at the limb, fibrils on disk (H-alpha: dense slender fibrils cover most of the disk in line centre) [S]. Filaments/prominences as dark ribbons on disk, bright against the sky off-limb [K].
- White-light corona: K-corona (Thomson scattering, dominant under ~4 R_sun) + F-corona (dust, dominates farther out; falloff ~R^-2.5 equatorial, ~R^-2.8 polar) [S]. K-corona polarization ~0.6-0.65 [S]. Electron density via Baumbach: n(r) = 1e8 (2.99 r^-16 + 1.55 r^-6 + 0.036 r^-1.5) cm^-3 for roughly 1.05-3 R_sun [S, Allen later corrected for dust, coefficients not retrieved]. Shape: streamers near equator at solar minimum, polar plumes, coronal holes [K].
- EUV corona = loops. Cheaper than MHD: place magnetic dipole pairs under each active region, trace field lines (potential-field source-surface model, PFSS) and draw bright thin tubes, or ray-march a density cube built from PFSS. Real PFSS inputs (GONG/HMI synoptic magnetograms) are public.
- Flares/CMEs: event-driven overlays (ribbons, post-flare loops, expanding shells) rather than simulation.

## 4. Other star types

Per-type drivers, mostly [K]. Colours come from Teff via section 5, not hand-picked.

| Class | Teff (K) | Surface look | Rendering notes |
|---|---|---|---|
| O/B | 10k-40k+ | no convective envelope, near-featureless, very strong limb darkening in UV, intense UV/EUV | almost no granulation; radiation-driven winds; huge UV band, tiny visible; core of the "UV mode" story |
| A | 7.5-10k | thin convection zone, weak granulation, some have chemical spots (Ap stars) | low contrast; optional spot map from Doppler-imaging |
| F | 6-7.5k | granulation present, larger/hotter, higher contrast than Sun | cells bigger and more contrasty; faculae weaker |
| G (Sun) | 5-6k | full solar set | as section 3 |
| K | 3.9-5.2k | smaller cells, bigger/darker spots, more heavy faculae-less activity | cooler, more orange; stronger star-spot coverage |
| M dwarf | 2.4-3.9k | very low contrast granulation (2.3% for M2 vs 14.9% for G) [S]; magnetic structure differs qualitatively from solar [S]; huge starspots, frequent flares | molecular absorption (TiO, VO) bands darken the visible and shift colour; strong flare events; near-IR much brighter than visible |
| L/T brown dwarf | <2.4k | cloud bands, dust/methane absorption, very red/magenta to near-black in visible | Jupiter-like bands, not granulation; mostly IR emitter |
| Red giants / supergiants | 3-4.5k | few huge convective cells; Betelgeuse surface shows small/medium (5-15 mas) structure plus one ~30 mas cell, cells >15-30% of radius, "only a few at once" [S] | 3D noise at very low frequency, large amplitude, slowly evolving; extended dusty, mottled envelope; strong mass loss |
| White dwarf | 5k-100k+ | featureless, tiny, huge gravity, extreme limb darkening depending on H/He atmosphere | essentially a uniform disc with a hot glow; strong UV |
| WR | 30k-200k | no true surface; dense wind photosphere | opaque emission-line wind shell, not a surface |

Typical scale rule of thumb [K]: granule size scales roughly with pressure scale height, so about proportional to Teff / g. Dwarfs: smaller cells and lower contrast toward M; giants: cells approach the stellar radius.

## 5. Colour: do it properly

Pipeline:
1. Spectrum S(lambda) = Planck(T) times a **departure from blackbody** correction by band (line blanketing in the UV and blue, TiO in M stars, Balmer jump in A stars). First pass: pure Planck; second pass: bake a small grid of model-atmosphere spectra (ATLAS/PHOENIX/Kurucz) into a 2D (Teff x lambda) texture.
2. Multiply by the limb-darkening law for that wavelength to get intensity at mu.
3. Integrate against CIE 1931 colour-matching functions to get XYZ (use an analytic fit, e.g. Wyman 2013 multi-lobe Gaussian, to keep it GPU-cheap).
4. Convert XYZ to linear sRGB. **Do not chromatically adapt a star to D65 and call it done**: a G star at ~5800 K should read close to white under a neutral exposure, and everything else should be relative to that. Treat the chosen white as an exposure/white-balance parameter (Sun-calibrated, with an "as seen by eye" and a "raw physical" option).
5. Gamut: blackbodies below ~1934 K lie outside sRGB [S]; clamp or desaturate toward the luminance-preserving gamut boundary rather than clipping channels.
6. Energy-vs-photon weighting changes where white appears (quantal puts white nearer 5300 K, energy-weighted nearer 6700 K) [S]. Pick one and document it.
7. HDR: render in linear float, apply exposure, then a filmic tonemap and bloom. Star brightness spans orders of magnitude, so display needs a manual exposure slider plus a "perceptual" auto mode.
8. Eye vs camera: at normal brightness real stars look saturated only when the camera overexposes. For naked-eye accuracy, desaturate bright discs toward white (mimics cone saturation) and keep saturation for faint ones.

Non-visible bands to display:
- UV (200-400 nm): no true colour exists. Offer **false colour** ramps (violet to white), default per-instrument.
- AIA bands: use NASA's published tables: 94 green, 131 teal, 171 gold/yellow, 193 bronze/orange-brown, 211 purple, 304 red, 335 blue, 1600 and 1700 olive/gold-ish, 4500 white-light [K, general knowledge; fetch of NASA channel page timed out so verify].
- Infrared: map to a thermal ramp (black-red-white) or shift into the red channel.
- X-ray: log-scaled grey with white-blue ramp.
- Spectral slider: sweep a window through the spectrum and recompute the sphere through the same layer model so you can **see the Sun's disc change shape** (disc shrinks and the limb brightens as you go EUV, only corona remains in X-ray).

## 6. Performance and engineering plan

- Shader-only approach (as in current code) is enough for photosphere. Use **layered passes**: (1) photosphere sphere, (2) chromosphere shell, (3) corona ray-march or billboards in a full-screen quad, (4) post: bloom + tonemap.
- Precompute: spot-pattern atlas, PFSS-derived loop geometry, limb-darkening LUT (Teff x lambda x mu) and Planck/XYZ LUT as small textures.
- Real data hooks (optional, later): SDO/AIA and HMI images as a texture per band when "Live Sun" is on. The current Earth, atmosphere and layers code already has a layers pattern (`layers.js`, `planet-layers.js`); mirror it for a `star-layers.js`.
- Spectral type scaling: expose granule size, contrast, spot fraction and flare rate as a per-type parameter table, derived from Teff and log g, so any catalog star (the catalog already has `spectral_type`) is covered automatically.
- Validation: compare disc profile against Neckel-Labs; compare colour against known stars (Sun, Vega, Sirius, Betelgeuse, Proxima); compare AIA-band renders against NASA AIA images of the same date.

## 7. Suggested build order

1. Replace `blackbody()` with the spectral pipeline (Planck, XYZ, sRGB, exposure) and wavelength-dependent limb darkening. Biggest realism gain per line of code; also enables band selection.
2. Real granulation (advected Worley cells, intergranular lanes, lifetime, bright points) + spot/penumbra structure + faculae.
3. Layered chromosphere (H-alpha, Ca II K, 1600/1700, 304) with spicules and filaments.
4. Corona: white-light K+F model, then EUV loop field via PFSS.
5. Per-spectral-type parameter table (A/F/K/M, giants, white dwarfs) driving the same shader.
6. Optional live SDO texture mode and flare/CME events.

## 8. What I could not confirm

- Exact quadratic limb-darkening coefficients (Claret & Bloemen 2011, Neckel 2005 tables).
- NASA AIA false-colour table and characteristic temperatures (the NASA channels page fetch timed out).
- Mitchell Charity's blackbody datafile did not surface in search; the CIE pipeline in section 5 does not require it.
- Granulation size vs Teff/log g across the Stagger grid (that fetch returned the wrong paper). Section 4 scaling is from general knowledge.
- Umbra/penumbra temperature numbers and faculae behaviour are from memory.

## Sources

- Godot sun shader: https://godotshaders.com/shader/2d-sun-with-bloom-filter-coronal-flares/
- 3D solar system blog: https://buildingbetter.tech/p/building-a-3d-solar-system-that-actually
- WebGL eclipse rebuild: https://raxxo.shop/blogs/lab/i-rebuilt-a-solar-eclipse-in-webgl-no-photographs
- Ahlers, real-time eclipse shadows (limb darkening): https://serwiss.bib.hs-hannover.de/files/2556/Ahlers_Real_Time.pdf
- AIA channels / temperature response: https://sdo.gsfc.nasa.gov/data/channels.php , https://arxiv.org/pdf/1509.07546
- AIA formation heights: https://arxiv.org/pdf/2409.10451
- Neckel & Labs limb darkening and Claret: https://ar5iv.labs.arxiv.org/html/2206.06641 , https://articles.adsabs.harvard.edu/pdf/2000A%26A...363.1081C
- Beeck, Schuessler, Reiners (MURaM F3-M2): https://arxiv.org/abs/1101.3848
- Reversed granulation: https://arxiv.org/abs/astro-ph/0612464
- Betelgeuse convection: https://arxiv.org/pdf/1811.10362 , https://ar5iv.arxiv.org/html/1003.1407
- Corona K/F model: https://arxiv.org/pdf/1112.3850 , https://arxiv.org/pdf/2001.05925
- Penumbra / Evershed: https://arxiv.org/pdf/1709.07386
- Spicules / fibrils: https://arxiv.org/pdf/1604.03116
- Blackbody to sRGB: https://scratchapixel.com/lessons/cg-gems/blackbody/blackbody.html , https://en.wikipedia.org/wiki/Planckian_locus , https://scipython.com/blog/converting-a-spectrum-to-a-colour/
