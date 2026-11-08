# The Sail Fold: a Hexagonal Flasher

The Centauri sails used to stow as a square pleat pack: five straight hinges, six panels, fold along
the axes. It stows to half a side, which is a map fold, and the stowed envelope in the catalogue
(`0.4 m x 4 m`) had nothing to do with the fold that produced it. The film is now a **hexagonal
rotational flasher**, which is the pattern the recent deployment literature uses for thin-film sails.

## What the sources actually say

The design comes from a 2025 Springer chapter, *Research on Solar Sail Design and Control Based on
Origami* (doi `10.1007/978-981-96-2256-6_31`). Its accessible abstract reports an origami sail
simulated in Origami Simulator, a ground prototype, and four folding patterns compared by folding
ratio and characteristic acceleration. **The full text is paywalled**, so the chapter's exact crease
coordinates, mountain/valley assignment and the definition of its deployment parameter are not
available. Nothing below pretends otherwise.

The rest of the literature supplies the family, not that paper's numbers:

| source | what it establishes |
| --- | --- |
| Lang, Magleby & Howell, *Single Degree-of-Freedom Rigidly Foldable Cut Origami Flashers* (ASME JMR 2016) | the flasher family: an m-sided hub with m rotationally repeated gores; a cut pattern can be single-DOF; red = mountain, blue = valley in its diagrams |
| NASA, six-sided flasher array prototype (NTRS 20150008719) | 9.2:1 stowed/deployed **diameter** ratio on a 1.25 m array; a real flasher that size is not single-DOF because of joint clearance |
| Chen et al., elastic flasher + scissor ring (2019) | the observed sequence: the flasher substrate first unwinds in rotation, then a ring expands radially; 0.05 to 0.5 m2 in under 40 s |
| Bai, MIT thesis (2024), n = 6, h = 3 flasher | an idealized area ratio of 3.214 for that particular geometry |
| Chen et al. (2025), square flasher + CFRP boom sail | a square hub suits a sail; the flasher is treated as the single-DOF rotational deployment mechanism |

What none of them give: a closed-form `lambda -> (rotation angle, radius)` law for a hexagonal sail.
That has to be constructed, so it is stated as ours.

## The mechanics we implement

`parts/flasher.js`. A regular hexagon of outer circumradius `R`, a hexagonal hub of circumradius
`rho R` (`rho = 0.14`), and a shoulder ring at `r1` offset by a pinwheel angle `delta` (18°).

**The pattern is flat-foldable by construction, not by luck.** Every interior vertex is a shoulder
vertex with four creases: two spokes and two shoulder-ring edges. Its radius `r1` is *solved* by
bisecting Kawasaki's residual

```
a1 + a3 = a2 + a4 = pi
```

so the condition holds to 1e-15 for any pinwheel offset. The mountain/valley assignment follows
Maekawa's rule (`|M - V| = 2`): three mountains and one valley at each of the six interior vertices,
with the shoulder edges alternating. That is the only flat-foldable assignment for a degree-4 vertex,
which is why it is not a free choice.

**lambda is our parameter**: the projected film-area fraction, `lambda = A(lambda)/A(1)`. Defined that
way because it reproduces the source figures' own stage list — a stowed state at `lambda = 0.026` is
`1/sqrt(lambda) = 6.2:1` across, which is what their folded state shows — and because area is the one
quantity a deployment can be checked against without a kinematic model.

**Two stages**, exactly as the figures show:

| lambda | stage | twist | what happens |
| --- | --- | --- | --- |
| 0.026 | stowed | 60° | hub wound one gore pitch; the pack is 6.2:1 across |
| 0.064 | rotation | 45° | gores unwinding, rim still |
| 0.178 | end of rotation | 0° | twist fully taken out |
| 0.402 | expansion 1 | 0° | similar growth |
| 0.543 | expansion 2 | 0° | similar growth |
| 1.000 | deployed | 0° | flat film |

During rotation the hub ring turns by `theta`, the shoulder ring by `theta/2` and the rim not at all.
That difference cannot be absorbed in plane without stretching the film, so each gore leaves the
plane: the buckle amplitude is `0.12 R sin(theta)` on the first antisymmetric mode, which is the
twisted star of the deployment sequence and is zero when the film is flat. During expansion
`theta = 0` and every radius scales with `sqrt(lambda)`, so the hexagon grows similarity-wise.

`theta_max = 60°` is the self-overlap bound (one gore pitch), not a measured value — the paper's is
unknown.

## Geometry closures

The film area is the hexagon minus the hub:

```
A = (3 sqrt(3) / 2) R^2 (1 - rho^2)
```

so for a measured film area `A`, `R = sqrt(A / (2.598 (1 - rho^2)))`. The stowed pack follows from the
same law instead of being asserted:

```
span_stowed = 2 R sqrt(lambda_fold)          (6.2:1 across)
depth       = layers x film thickness        (three layers of 100 nm SiN)
fold ratio  = 1 / lambda_fold = 38.5 in area
```

At full stow the pack is `0.161 R` across against a hub of `0.14 R`, so the film winds down onto its
own hub — which is the check that the two numbers belong to the same mechanism.

## Where it lives

- `parts/flasher.js` — the pattern, the solver, the two-stage kinematics, the stowed envelope.
- `parts/origami.js` — re-exports the flasher; keeps the pleated-strip laws for the wings/radiators.
- `parts/parts.js` — `sail()` now takes its `stowed` envelope from `stowedEnvelope()`.
- `parts/centauri-models.js` — `sailFilm()` draws the 18-vertex, 12-facet flasher and recomputes the
  vertex buffer from `deploy(lambda)` on every deployment step; the six rim booms scale with it.
- `centauri-fleet.test.mjs` — Kawasaki exact, Maekawa at all six vertices, the six source states
  monotone in span, `lambda` equal to the projected area fraction, the stowed span from the law, and
  the equal-area square convention kept for the beam trade.

## What is still not modelled

The real thing has finite-thickness hinges (the sources are explicit that thickness accommodation
changes the packing), cable or boom tension in the deployed film, and self-intersection during the
winding. None of those are here: this is a zero-thickness kinematic model with a buckling mode, sized
so the numbers agree with the reported fold ratio. The ribbon/boom structure that holds the flat film
taut is still the mast's problem, and the audit's finding F8 (mast mass versus film mass) still stands.
