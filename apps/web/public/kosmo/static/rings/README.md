# Ring system data

Rings are drawn by `../ring-system.js`; `../ring-lab.html` is a precision-safe viewer for the near-camera particle tier.

## What is data and what is modelled

| Piece | Basis |
| --- | --- |
| Ring, gap and ringlet radii (Saturn, Uranus, Neptune, Jupiter) | Hand-encoded from published Cassini / Voyager results. Not raw PDS occultation profiles; the fine radial texture between the named features is seeded noise. |
| Optical depth, albedo, colour per band | Representative regional values (D, C, B, Cassini Division, A, F, G; Uranus rings by name; Neptune's Adams ring and arcs; Jupiter's dust rings). |
| Density-wave radii | Computed: Lindblad resonances m(Omega - n) = j kappa with J2-corrected Omega and kappa and the moons' real periods. Mimas 2:1 lands at 117,528 km against the observed B-ring edge at 117,507 km. Wave amplitudes are schematic. |
| Gap-edge waves (Pan, Daphnis) | Wavelength 3 pi times the moon-to-edge distance; amplitudes a few km. |
| Neptune's arcs | Approximate longitudes held by Galatea's 42:43 resonance; pattern speed 820.1118 deg/day. |
| Self-gravity wakes | `wake_tile.json`: a shear-periodic density tile from `tools/ring-wakes/shearing-box.mjs` (about 6,100 particles, r_h = 1, tau = 0.5, 64 / Omega). Re-run the script to regenerate it (about 5 minutes). |
| Particle sizes | Power law n(s) ~ s^-3 from 1 cm to 13 m, one instanced layer per octave; counts follow tau(r). |

Dust rings (Saturn's G, Jupiter's rings, Neptune's Galle) are drawn with a brightness boost so they show when backlit, as in long-exposure images.

## Limits

The main Kosmographica focus is an absolute galactic coordinate (about 65 km resolution), and its Solar level is hidden below roughly a 60 m view, so the particle tier cannot be flown to smoothly there. Use `ring-lab.html`.
