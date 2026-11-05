# Image maps for Kosmopedia / Kosmographica models

Equirectangular (2:1) images listed in `index.json`, keyed by object name (case-insensitive) or by
`type:<type>` for a default per type:

```json
{ "Earth": "textures/2k_earth_daymap.jpg", "type:moon": "textures/moon-generic.jpg" }
```

The shader samples the map for colour and keeps its procedural relief and lighting; stars use the map as
an emissive layer. Bodies without a map (other moons, exoplanets, other stars) stay procedural.

### Relief maps (optional)

An entry may also be an object instead of a string:

```json
{ "Mars": { "color": "textures/mars_color_8k.jpg", "normal": "textures/mars_normal_4k.jpg", "bump": 2 } }
```

- `color`: the colour map (same as the string form).
- `normal`: equirectangular tangent-space normal map (R = east, G = north, B = up, 0.5 = zero slope, linear
  not sRGB). It replaces the procedural noise relief and perturbs the diffuse lighting.
- `height`: alternative to `normal`: an 8-bit greyscale height map (red channel); the shader differentiates
  it per pixel. `relief` (default 0.01) is the height range at value 1 as a fraction of the body radius.
- `bump`: default relief strength (1 = the baked scale). At run time use `group.userData.setBump(v)` or
  `group.userData.bump.value = v` (present only on models that have a relief map).

The relief fades out within a few degrees of the poles, where equirectangular maps pinch.

Mars normal map bake: MOLA MEGDR 16 pixel/degree heights, resampled to 4096x2048, central differences in
metres (east spacing scaled by cos(latitude)), baked with 6x vertical exaggeration so 8 bits are enough,
stored as JPEG quality 90, 4:4:4. Longitude runs -180..180 like the colour map.

## Files and credits

| File | Body | Source | Licence |
| --- | --- | --- | --- |
| `2k_sun.jpg` | Sun | Solar System Scope, `2k_sun.jpg` | CC BY 4.0 |
| `2k_mercury.jpg` | Mercury | Solar System Scope, `2k_mercury.jpg` (from NASA MESSENGER mosaics) | CC BY 4.0 |
| `2k_venus_surface.jpg` | Venus | Solar System Scope, `2k_venus_surface.jpg` (from NASA Magellan radar) | CC BY 4.0 |
| `2k_earth_daymap.jpg` | Earth | Solar System Scope, `2k_earth_daymap.jpg` (from NASA Blue Marble) | CC BY 4.0 |
| `2k_moon.jpg` | Moon | Solar System Scope, `2k_moon.jpg` (from NASA LRO) | CC BY 4.0 |
| `2k_mars.jpg` | Mars | Solar System Scope, `2k_mars.jpg` (from NASA/USGS Viking mosaics) | CC BY 4.0 |
| `mars_color_8k.jpg` | Mars colour (8192x4096, 7.8 MB, used instead of `2k_mars.jpg`) | USGS Astrogeology, Viking MDIM 2.1 Colorized Global Mosaic, `Mars_Viking_MDIM21_ClrMosaic_1km.jpg` (https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m), resampled from 21339x10670 and given a mild display grade (brightness +20%, saturation +28%) | Public domain (NASA/USGS) |
| `mars_normal_4k.jpg` | Mars relief (4096x2048, 2.7 MB, tangent-space normal map) | Derived from NASA MGS MOLA MEGDR 16 ppd topography, `megt90n000eb.img` from the PDS Geosciences Node (https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/), 33 MB download | Public domain (NASA/PDS) |
| `jupiter_cassini_4k.jpg` | Jupiter colour (4096x2048, 1.1 MB; used instead of `2k_jupiter.jpg`) | NASA/JPL/Space Science Institute, PIA07782 "Cassini's Best Maps of Jupiter (Cylindrical Map)", Cassini ISS narrow-angle images of 11-12 Dec 2000 (https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map): native 3601x1801 TIFF, upsampled 1.14x to 4096x2048; the no-data rows at the poles (about 1 degree at the north pole, about 8 degrees at the south pole) were filled with a blurred copy of the nearest valid latitude, no detail invented. Great Red Spot is at the same position as in the 2k map (same source) | NASA, public domain (NASA/JPL/SSI) |
| `2k_jupiter.jpg` | Jupiter | Solar System Scope, `2k_jupiter.jpg` (from NASA Cassini) | CC BY 4.0 |
| `2k_saturn.jpg` | Saturn | Solar System Scope, `2k_saturn.jpg` (from NASA Cassini) | CC BY 4.0 |
| `2k_saturn_ring_alpha.png` | Saturn's rings (alpha strip, not yet wired in) | Solar System Scope | CC BY 4.0 |
| `2k_uranus.jpg` | Uranus | Solar System Scope, `2k_uranus.jpg` | CC BY 4.0 |
| `2k_neptune.jpg` | Neptune | Solar System Scope, `2k_neptune.jpg` (from NASA Voyager 2) | CC BY 4.0 |
| `2k_pluto.jpg` | Pluto | Solar System Scope, `2k_pluto.jpg` (from NASA New Horizons) | CC BY 4.0 |
| `earth_day_8k.jpg` | Earth colour (8192x4096) | NASA Earth Observatory, Blue Marble Next Generation with Topography and Bathymetry (April 2004, 21600x10800 original, downscaled): https://visibleearth.nasa.gov/images/73909 | NASA, public domain (credit: NASA Earth Observatory / Reto Stockli) |
| `earth_height_4k.png` | Earth relief height map (4096x2048, 8-bit; sea level = 128) | Built from NASA Blue Marble `gebco_08_rev_elev` (land elevation) and `gebco_08_rev_bath` (bathymetry), both from GEBCO 2008 via NASA Earth Observatory: https://visibleearth.nasa.gov/images/73934 ; land at full scale, seabed compressed to a gentle slope | NASA / GEBCO, public domain |
| `earth_lights_8k.jpg` | Earth city lights (8192x4096) | NASA Earth Observatory / NOAA-NASA Suomi NPP VIIRS "Earth at Night" 2012 (13500x6750 original, downscaled; blue base tint subtracted so only the lights remain): https://visibleearth.nasa.gov/images/79765 | NASA, public domain (credit: NASA Earth Observatory / NOAA NGDC) |
| `earth_ocean_mask_4k.png` | Earth ocean specular mask (4096x2048) | Derived: ocean = zero land elevation and below-sea-level bathymetry in the two GEBCO maps above, lightly blurred | NASA / GEBCO, public domain |

Textures by Solar System Scope (INOVE), https://www.solarsystemscope.com/textures/, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): free to use and adapt with attribution.
The underlying imagery is NASA / USGS public-domain data. Downloaded 2026-10-30, 2048×1024 px.

Public-domain alternatives at higher resolution: NASA Visible Earth (Blue Marble), USGS Astrogeology
planetary mosaics, NASA SVS CGI Moon Kit.

## Earth

`textures/index.json` maps Earth to `{ color: earth_day_8k.jpg, height: earth_height_4k.png, relief: 0.012 }`: the shared body shader
takes the real topography as a height map (relief is about 4x true scale, see `relief`). `earth-layers.js` adds the city lights (night
side only), an ocean sun-glint driven by `earth_ocean_mask_4k.png`, and a slowly drifting cloud shell. The cloud layer is procedural
(a latitude-weighted fbm shader), not a satellite cloud map. `earth_*` maps are NASA / GEBCO public-domain data (the 2k Solar System
Scope Earth map stays on disk as a fallback). Downloaded 2026-11-04.
