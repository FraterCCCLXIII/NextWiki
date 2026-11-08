/* origami.js -- the fold laws: one rotational flasher for the sail, pleated strips for the wings.

   The sail used to be a square pleat pack -- five straight hinges, six panels, folded on the axes.
   That stows to half a side, which is a map fold, and its stowed envelope (0.4 m x 4 m) had nothing
   to do with the fold it claimed. The film is now a hexagonal flasher (parts/flasher.js): six gores
   around a hex hub, a pinwheel shoulder ring whose radius is SOLVED for flat-foldability, a rotation
   stage and then a radial expansion. The stowed pack comes out of that law: 1/sqrt(lambda) of the
   span across, one film thickness per layer.

   The solar wings and radiators are still accordion strips, because that is what they are: a
   pleated blanket whose hinge angles alternate in sign and which folds flat into 1/n of its length.

   No DOM and no three.js, so the node checks fold the same numbers the model draws.

   Provenance and assumptions for the flasher are stated at the top of parts/flasher.js: the 2025
   Springer chapter that motivates it is paywalled, so lambda is our projected-area fraction, the
   stage boundaries are the figures', and the twist limit is the 60 degree self-overlap bound. */

import { FLASHER, flasherRadius, stowedSpan } from './flasher.js';

export {
  FLASHER, SECTOR, LAMBDA_FOLD, LAMBDA_TWIST, SHOULDER, flasherRadius, deploy, faces, creases,
  maekawa, kawasakiResidual, solveShoulder, twistAt, buckleAt, stowedSpan, stowedEnvelope,
  foldRatio, lambdaFor, report
} from './flasher.js';

/** Side of the square film that carries the measured sail area. The beam trade needs one length for
 *  a film, and an equal-area square is the convention the aperture calculation already uses. */
export function sailSquareSide(areaM2) {
  return Math.sqrt(Math.max(0, areaM2));
}

/** Footprint of the stowed pack for a film of `areaM2`: the flasher's own span, both directions. */
export function sailFoldedFootprint(areaM2) {
  const w = stowedSpan(flasherRadius(areaM2));
  return { w, h: w };
}

/** Hinge angles for a pleated strip of `segments` panels: 1 is flat, 0 is the pack. The sign
 *  alternates so the panels zig-zag instead of all folding one way. Hinge 0 is the root attachment
 *  and does not fold: the first panel stays on its mount and the others stack onto it, outward. (Until
 *  the QA pass the root hinge folded too, which laid every half-deployed wing back over the module it
 *  hung from -- the sweep check in parts/geometry-audit.js is what caught it.) */
export function accordionAngles(k, segments) {
  const t = Math.min(1, Math.max(0, k));
  const n = Math.max(0, Math.round(segments));
  return Array.from({ length: n }, (_, i) => (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.PI * Math.pow(1 - t, 1 + 0.12 * (i - 1))));
}

/** Length of the folded strip: one panel deep, whatever the deployed length. */
export function accordionFootprint(lengthM, segments) {
  return segments > 0 ? lengthM / segments : lengthM;
}
