# Kosmographica legacy top nav (stashed design)

The original pages carried their own top navigation: the Kosmographica wordmark
("a map of everything, to scale") on the left and the ten section links on the
right (Kosmographica, Kosmopedia, University, Math, Physics, Philosophy, Models,
Chemistry, Simulator, Oracle), with the current page underlined. See `top-nav.webp`
and `oracle-page-with-both-navs.webp`.

Inside NextWiki the site header (with the Kosmographica menu) replaces it, so the
embedded copies hide this bar when they run in an iframe. Nothing here is loaded;
it is kept as the reference for a React `AtlasTopNav` component.

| File | What it is |
|---|---|
| `atlas-nav.js` | Builds the grouped menu (Atlas / Study / Domains / Tools / Lab) into `#logo` and `#menu` on the root pages |
| `atlas-nav.css` | `#navbar`, `#logo`, `.lockup`, `.navgroup`, `#menu` rules from `kosmographica.css` (lines 84-262) |
| `oracle-atlasbar.js` | The "atlas band" `oracle/theme.js` builds above every Oracle page |
| `oracle-atlasbar.css` | `.atlasbar`, `.atlasnav`, `.atlas-mark` rules from `oracle/styles.css` |
| `top-nav.webp`, `oracle-page-with-both-navs.webp` | Screenshots of the bar and of an Oracle page showing both navs |

## How it is hidden when embedded

- Root pages (`university`, `universe-timeline`, `chemistry`, `contraption-sim`): a
  one-line script in `<head>` adds `class="embedded"` to `<html>` when
  `window.top !== window.self`; `kosmographica.css` hides `#logo` and `#menu` for
  `html.embedded`, and hides `#navbar` entirely unless it holds page controls
  (the timeline's clock and Chronicle button).
- Oracle pages: `oracle/theme.js` still builds the band but sets `display:none`
  on it when embedded, so `--atlas-h` measures 0 and the sticky offsets stay correct.

The unmodified originals remain in the `kosmographica-app` repo. To restore a bar
here, delete those guards (search for `embedded` / `window.top`).

## Oracle section nav (now a left rail)

The Oracle pages also carried a two-row horizontal nav of their five groups
(Machine, Earth, Conflict, Minds, Time), built by `oracle/theme.js` into the sticky
`.topbar` (`oracle-section-nav.webp`). Inside NextWiki it is the left rail
`components/kosmo/oracle-rail.tsx`, fed by `lib/kosmo/oracle-nav.ts`; the iframe's own
`.topbar` is hidden when embedded. The group list in `theme.js` is the original.
