# Image maps for Kosmopedia / Kosmographica models

Equirectangular (2:1) images listed in `index.json`, keyed by object name (case-insensitive) or by
`type:<type>` for a default per type:

```json
{ "Earth": "textures/2k_earth_daymap.jpg", "type:moon": "textures/moon-generic.jpg" }
```

The shader samples the map for colour and keeps its procedural relief and lighting; stars use the map as
an emissive layer. Bodies without a map (other moons, exoplanets, other stars) stay procedural.

## Files and credits

| File | Body | Source | Licence |
| --- | --- | --- | --- |
| `2k_sun.jpg` | Sun | Solar System Scope, `2k_sun.jpg` | CC BY 4.0 |
| `2k_mercury.jpg` | Mercury | Solar System Scope, `2k_mercury.jpg` (from NASA MESSENGER mosaics) | CC BY 4.0 |
| `2k_venus_surface.jpg` | Venus | Solar System Scope, `2k_venus_surface.jpg` (from NASA Magellan radar) | CC BY 4.0 |
| `2k_earth_daymap.jpg` | Earth | Solar System Scope, `2k_earth_daymap.jpg` (from NASA Blue Marble) | CC BY 4.0 |
| `2k_moon.jpg` | Moon | Solar System Scope, `2k_moon.jpg` (from NASA LRO) | CC BY 4.0 |
| `2k_mars.jpg` | Mars | Solar System Scope, `2k_mars.jpg` (from NASA/USGS Viking mosaics) | CC BY 4.0 |
| `2k_jupiter.jpg` | Jupiter | Solar System Scope, `2k_jupiter.jpg` (from NASA Cassini) | CC BY 4.0 |
| `2k_saturn.jpg` | Saturn | Solar System Scope, `2k_saturn.jpg` (from NASA Cassini) | CC BY 4.0 |
| `2k_saturn_ring_alpha.png` | Saturn's rings (alpha strip, not yet wired in) | Solar System Scope | CC BY 4.0 |
| `2k_uranus.jpg` | Uranus | Solar System Scope, `2k_uranus.jpg` | CC BY 4.0 |
| `2k_neptune.jpg` | Neptune | Solar System Scope, `2k_neptune.jpg` (from NASA Voyager 2) | CC BY 4.0 |
| `2k_pluto.jpg` | Pluto | Solar System Scope, `2k_pluto.jpg` (from NASA New Horizons) | CC BY 4.0 |

Textures by Solar System Scope (INOVE), https://www.solarsystemscope.com/textures/, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): free to use and adapt with attribution.
The underlying imagery is NASA / USGS public-domain data. Downloaded 2026-10-30, 2048×1024 px.

Public-domain alternatives at higher resolution: NASA Visible Earth (Blue Marble), USGS Astrogeology
planetary mosaics, NASA SVS CGI Moon Kit.
