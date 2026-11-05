---
id: KU-L01094
status: reviewed
reviewer: { name: claude-reviewer-upper, kind: agent }
reviewedAt: 2026-11-04
kind: reading
minutes: 40
concepts: [orbit, gravity]
original: true
author: { name: claude-drafter-gravity-upper, kind: agent }
sources: []
checks:
  - q: "How many equilibrium points does the circular restricted three-body problem have in the rotating frame, and which are linearly unstable?"
    a: "Five; L1, L2 and L3 are unstable"
    options: ["Five; L1, L2 and L3 are unstable", "Five; L4 and L5 are unstable", "Three; all are unstable", "Five; all are stable"]
  - q: "For what range of mass ratio mu is the linearised motion about L4 and L5 stable?"
    a: "mu < about 0.0385"
    options: ["mu < about 0.0385", "mu > about 0.0385", "mu < about 0.5", "Any mu"]
  - q: "Why do spacecraft at the Sun-Earth L2 point need station keeping?"
    a: "The collinear points are saddles, so small errors grow exponentially"
    options: ["The collinear points are saddles, so small errors grow exponentially", "Atmospheric drag slows the spacecraft", "L2 lies inside Earth's atmosphere", "The Sun's gravity vanishes there"]
  - q: "Which quantity is conserved in the rotating frame of the CR3BP?"
    a: "The Jacobi constant C = 2*Omega - v^2"
    options: ["The Jacobi constant C = 2*Omega - v^2", "Angular momentum about the barycentre", "Kinetic energy alone", "Nothing is conserved"]
  - q: "Using r ~ R (mu/3)^(1/3) with mu = 3.0e-6, what is the Sun-Earth L1 distance from Earth?"
    a: "About 1.5 million km"
    options: ["About 1.5 million km", "About 150 million km", "About 384,000 km", "About 15 million km"]
---
## Explanation

Take two massive bodies, m1 and m2 (Sun and Earth, say), on circular orbits about their common centre of mass, and a third body of negligible mass (a spacecraft) that does not disturb them. This is the circular restricted three-body problem (CR3BP). It has no closed-form solution, but it does have special points where the spacecraft can sit at rest relative to the two primaries.

Use normalised units: the primaries' separation is 1, their total mass is 1, and their angular rate is 1. Let mu = m2/(m1+m2), so m1 has mass 1 - mu and m2 has mass mu. Work in a frame rotating with the primaries, with the origin at the barycentre. The primaries sit on the x-axis at x = -mu and x = 1 - mu. With r1 and r2 the distances to the two primaries, the spacecraft obeys

x'' - 2y' = dOmega/dx
y'' + 2x' = dOmega/dy
z'' = dOmega/dz

where Omega = (x^2 + y^2)/2 + (1 - mu)/r1 + mu/r2. The terms 2y' and 2x' are the Coriolis acceleration, and the (x^2 + y^2)/2 term is the centrifugal potential. Omega is sometimes called the effective (pseudo-)potential, though its sign is the opposite of the usual convention.

Coriolis does no work, so the system has one integral of motion, the Jacobi constant C = 2 Omega - (x'^2 + y'^2 + z'^2). Angular momentum is not conserved separately in the rotating frame, but C is. Since the speed squared cannot be negative, the spacecraft can never enter the region where 2 Omega < C: the boundary is a zero-velocity surface.

Equilibria need all velocities and accelerations to be zero, so the gradient of Omega must vanish. This gives five solutions.

- L1, L2, L3 lie on the x-axis: L1 between the primaries, L2 beyond the smaller one, L3 beyond the larger one on the far side.
- L4 and L5 form equilateral triangles with the primaries, each sitting 60 degrees ahead of or behind m2 on its orbit. There r1 = r2 = 1.

Stability follows from linearising about each point. For a small displacement, the equations become a set with Omega_xx, Omega_yy (and Omega_xy at the triangular points) evaluated at the equilibrium. At the collinear points, Omega_xy = 0 and, writing c = (1 - mu)/r1^3 + mu/r2^3 > 1, Omega_xx = 1 + 2c and Omega_yy = 1 - c. The in-plane characteristic equation is

lambda^4 + (2 - c) lambda^2 + (1 + c - 2c^2) = 0

The constant term factors as -(2c + 1)(c - 1), which is negative when c > 1. Then the quadratic in lambda^2 has one positive and one negative root, so there is one real exponentially growing mode, one decaying mode, and an oscillatory pair. These points are saddle-by-centre: unstable. For the Sun-Earth system the growth time is a few weeks (roughly 23 days per e-fold at both L1 and L2).

At L4 and L5 the characteristic equation is lambda^4 + lambda^2 + (27/4) mu (1 - mu) = 0. All four roots are purely imaginary only if its discriminant is non-negative: 1 - 27 mu (1 - mu) >= 0, which gives mu <= (1 - sqrt(23/27))/2, about 0.0385. This is the Routh criterion. The Earth-Moon system (mu = 0.0121) and Sun-Jupiter (mu about 0.00095) satisfy it, and Jupiter's Trojan asteroids fill L4 and L5. This is linear stability only.

Why not park at L2 exactly? It is a saddle, so staying on it needs perfect knowledge. The solution is to fly a periodic orbit around the point. The linear oscillatory modes give planar and vertical motion with slightly different frequencies. At larger amplitudes the nonlinear terms bring the two frequencies together, and a family of three-dimensional periodic orbits appears: halo orbits. JWST flies a halo-type orbit about Sun-Earth L2 with a radius of a few hundred thousand km and a period near six months. Because the unstable mode is still present, the orbit is not truly stable. Small manoeuvres every few weeks cancel the growing error. This is station keeping, and it consumes a small, planned amount of propellant over the mission.

## Worked example

Estimate the distance from Earth to the Sun-Earth L1 and L2 points, using the leading-order balance known as the Hill approximation.

Setup. Close to the small primary, its pull is mu/r^2 (in normalised units) while the tidal and centrifugal terms from the larger body add up to approximately 3 r, where r is the distance from m2 and where (1 - mu) is taken as 1. At L1 and L2 these balance, giving mu / r^2 = 3 r, so

r^3 = mu / 3, and in physical units r = R (mu/3)^(1/3)

where R is the primaries' separation. This is an approximation valid for mu much less than 1, not an exact solution. The exact locations come from a quintic polynomial and differ at the 1 percent level or less for this mass ratio.

Numbers. mu = m_Earth / (m_Sun + m_Earth) = 3.0 x 10^-6, and R = 1 AU = 1.496 x 10^8 km.

1. mu / 3 = 1.0 x 10^-6.
2. (1.0 x 10^-6)^(1/3) = 1.0 x 10^-2 = 0.010.
3. r = 1.496 x 10^8 km x 0.010 = 1.496 x 10^6 km.

So L1 and L2 each lie about 1.5 million km from Earth, about 1 percent of the way to the Sun: L1 sunward of Earth and L2 on the far side. That is about four times the Moon's distance (384,000 km). The exact values are about 1.49 x 10^6 km (L1) and 1.50 x 10^6 km (L2).

## Activity

1. Using the same Hill estimate, compute the Earth-Moon L1 distance from the Moon. Use mu = 0.0121 and R = 384,400 km. (mu/3 = 4.03 x 10^-3, its cube root is about 0.159, so r is about 61,000 km.) The Hill approximation is much less accurate here because mu is not tiny. The exact distance is about 58,000 km, so compare and comment on the error (about 5 percent).
2. At L4 take mu = 0.0121. Evaluate the discriminant 1 - 27 mu (1 - mu). Show it is positive (about 0.677), so the point is linearly stable.
3. Find the largest mu for which 1 - 27 mu (1 - mu) = 0 (the Routh limit). Solve the quadratic 27 mu^2 - 27 mu + 1 = 0 and keep the smaller root: mu = 0.0385.
4. For the Sun-Earth L2, take the unstable mode to grow like e^(t/tau) with tau of about 23 days. By what factor does a small initial error grow in 69 days (three e-folds)? (A factor of e^3, about 20.) Discuss why this sets a station-keeping interval of weeks, not years.

## Summary

In the circular restricted three-body problem, the rotating-frame equations of motion have five equilibria. The collinear points L1, L2, L3 are saddle-by-centre and unstable, so they need station keeping. L4 and L5 are linearly stable when mu < 0.0385 (the Routh criterion). The Jacobi constant C = 2 Omega - v^2 is the one conserved quantity. The Hill estimate r = R (mu/3)^(1/3) puts Sun-Earth L1 and L2 about 1.5 million km from Earth. Spacecraft such as JWST fly halo orbits around L2 to avoid sitting on the unstable point itself, and use small periodic manoeuvres to hold the orbit.
