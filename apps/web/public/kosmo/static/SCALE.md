# Scale of things (`/kosmo/tools/scale`)

A carousel of the universe, largest object to smallest, drawn by the shared Kosmo 3D engine and
filtered by a timeline. The bottom of the page carries a live ruler for the selected object's true
extent and a log-size ladder of everything that passes the filter.

Files: `scale.html` (layout), `scale.js` (engine), `scale-catalog.js` (data + pure helpers),
`scale-catalog.test.mjs` (headless checks), plus `kosmo-models.js`, `models/spacex/manifest.json`,
`models/dinosaurs/*.glb` and `models/rockets/*.web.glb`.

## What the numbers mean

- **Order** is by `extent` in metres, largest first — diameter for round bodies, length for vehicles
  and animals, span for structures.
- **The 3D stage is normalised**, not to scale with the screen: every object is framed to fill a
  similar amount of the view, and the ruler reports the true extent. The stage says "drawn to fit".
- **Time** is signed years on the same axis as `kosmo_entities.time_start / time_end` (year 0 =
  1 BCE, negative = BCE / years ago). `from`/`to` are when the object exists, not when it was
  discovered; `to: null` means it still exists. Windows are approximate where the science is, and
  each entry carries a source.
- The filter is a log axis of years before present, from the Big Bang (13.8 Gya) to today. Presets:
  Today, Dinosaurs, Solar birth, First galaxies, Big Bang. The bar chart behind the slider counts
  the indexed objects that existed at each time; the warm line marks the selected object's span.
- The ladder is drawn on the same log axis as the ruler and also works as a scrubber: clicking a
  size jumps to the nearest object in the current filter.

## Performance and memory budget

The view is built to stay cheap on a laptop and in an embedded iframe:

- one `WebGLRenderer`, one scene and one camera for the whole page;
- **one live object** in the scene — a new object is built only after the previous one is released;
- raw GLBs are cached in a **3-entry LRU**; eviction disposes every geometry, material and texture
  in the scene. Clones share the cached GPU data, so moving back and forth is instant;
- procedural models (`createModel`) own their resources and are disposed with their object; no
  downloaded planet maps are used here;
- no shadows, no post-processing, pixel ratio capped at 2;
- the loop is capped at 30 fps and is stopped completely when the stage is off-screen
  (`IntersectionObserver`) or the tab is hidden;
- the timeline and ladder canvases redraw only on change; the ruler is the only per-frame 2D work.

The index is 67 hand-checked entries, not the 13 MB `catalog/objects.json`, so the view opens
without a catalogue download and filtering is a scan of a few dozen rows.

## Adding an object

Append to `SCALE_ENTRIES` in `scale-catalog.js`:

```js
{
  id: 'unique-slug',            // also the deep link: #unique-slug
  name: 'Display name', group: 'Planet',
  extent: 1.2e7, extentLabel: 'diameter',
  from: -4.5e9, to: null,       // signed years; null = still exists
  blurb: 'One sentence.',
  source: 'https://…', sourceLabel: 'source label',
  tint: '#9fb8ab',              // ladder dot
  model: proc({ name: 'Display name', type: 'planet', radius_m: 6e6 }),
  // or: model: glb('models/dinosaurs/<uid>.glb', 9, { uid, upright: false })
  // or: model: vehicle('falcon9-block5', 70) / engine('raptor', 3.1)
}
```

`proc` kinds are whatever `kosmo-models.js` supports (`planet`, `star`, `galaxy`, `nebula`,
`black_hole`, `cell`, `virus`, …). Vehicles and engines must have an entry in
`models/spacex/manifest.json`; the manifest supplies the file and orientation. GLB models are
normalised to the entry's `extent`, so a model does not need to be authored at world scale.

Keep `scale-catalog.js` DOM-free: it is imported by the Node test.

## Checks

```bash
node apps/web/public/kosmo/static/scale-catalog.test.mjs
# or, from apps/web:
pnpm test:kosmo
```

`run-tests.mjs` discovers `static/*.test.mjs`, so the new file runs with the existing Kosmo tests.
