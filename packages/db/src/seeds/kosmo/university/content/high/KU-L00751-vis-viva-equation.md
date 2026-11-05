---
id: KU-L00751
status: reviewed
reviewer: { name: claude-reviewer-upper, kind: agent }
reviewedAt: 2026-11-04
kind: reading
minutes: 25
concepts: [orbit, gravity]
original: true
author: { name: claude-drafter-gravity-upper, kind: agent }
sources: []
checks:
  - q: "In the vis-viva equation v^2 = GM(2/r - 1/a), what does a stand for?"
    a: "The semi-major axis of the orbit"
    options: ["The semi-major axis of the orbit", "The altitude above the surface", "The acceleration of the spacecraft", "The distance to the nearest planet"]
  - q: "For a circular orbit, what does the vis-viva equation reduce to?"
    a: "v = sqrt(GM/r)"
    options: ["v = sqrt(GM/r)", "v = sqrt(2GM/r)", "v = GM/r", "v = 0"]
  - q: "A spacecraft in an elliptical orbit moves from its closest point to its farthest point from Earth. What happens to its speed?"
    a: "It decreases, because kinetic energy is traded for gravitational potential energy"
    options: ["It decreases, because kinetic energy is traded for gravitational potential energy", "It increases, because gravity is weaker far away", "It stays the same, because the total energy is constant", "It drops to zero at the farthest point"]
  - q: "A satellite circles a planet at radius r. A second satellite circles at radius 4r. How do their speeds compare?"
    a: "The second one moves at half the speed of the first"
    options: ["The second one moves at half the speed of the first", "The second one moves at a quarter of the speed", "The second one moves at the same speed", "The second one moves twice as fast"]
---
## Explanation

Orbits are not magic. A satellite is falling toward its planet all the time, but it also moves sideways fast enough that it keeps missing. One equation links the satellite's speed to where it is on its path. It is called the vis-viva equation, from the Latin for "living force", an old name for energy:

v^2 = GM (2/r - 1/a)

Here is what each symbol means.

- v is the speed of the small body (the satellite) at this moment, in metres per second.
- G is the gravitational constant, and M is the mass of the body being orbited. They always appear together as the product GM. For Earth, GM is about 3.986 x 10^14 m^3/s^2. For the Sun it is about 1.327 x 10^20 m^3/s^2.
- r is the distance from the centre of the big body to the satellite right now. It is measured from the centre, not from the surface.
- a is the semi-major axis of the orbit: half of the longest width of the ellipse. It describes the size of the whole orbit, not where you are on it.

Where does it come from? The idea is conservation of energy. Gravity is an inverse-square force, so the energy stored in the gravitational field is -GMm/r for a satellite of mass m. Add the kinetic energy and you get a total that never changes in a pure two-body orbit:

(1/2) m v^2 - GMm/r = constant

Divide by m/2 and rearrange: v^2 = 2GM/r + 2 x (constant per unit mass). So the speed depends on r through the 2GM/r term, and the only thing left to decide is the constant. That constant fixes the size of the orbit. It can be shown, using the geometry of ellipses and conservation of angular momentum, that the last term (2 x the constant) equals -GM/a. Putting it in gives the vis-viva equation. In words: a satellite with a bigger orbit has more total energy, and the energy of an orbit depends on a alone, not on how stretched the ellipse is.

The most useful special case is a circle. Then the distance never changes, so r = a. The equation becomes v^2 = GM (2/r - 1/r) = GM/r, so

v = sqrt(GM / r)

Notice that the mass of the satellite does not appear. A tiny bolt and a space station at the same height move at the same speed. Notice also that higher orbits are slower: quadruple r and the speed halves.

For an ellipse, r changes as the satellite goes round. When r is small (closest approach, or periapsis) the term 2/r is large and v is large. When r is big (apoapsis) v is small. This matches the energy picture: climbing away from the planet costs kinetic energy, and falling back gives it back.

## Worked example

Find the speed of the International Space Station, in a nearly circular orbit about 400 km above Earth.

Known values: Earth's radius R = 6371 km, altitude h = 400 km, and GM = 3.986 x 10^14 m^3/s^2.

Step 1. The distance from Earth's centre is r = R + h = 6371 km + 400 km = 6771 km. In metres, r = 6.771 x 10^6 m.

Step 2. The orbit is circular, so a = r and v = sqrt(GM/r).

Step 3. GM / r = (3.986 x 10^14 m^3/s^2) / (6.771 x 10^6 m) = 5.887 x 10^7 m^2/s^2.

Step 4. v = sqrt(5.887 x 10^7 m^2/s^2) = 7673 m/s, which is about 7.67 km/s.

Check: the circumference is 2 x pi x 6.771 x 10^6 m = 4.254 x 10^7 m. Dividing by 7673 m/s gives 5545 s, or about 92.4 minutes per lap. That matches the real ISS period of roughly 92 minutes, and it means the station circles the planet about 15.6 times a day. In kilometres per hour the speed is 7.673 x 3600 = about 27,600 km/h.

## Activity

You will need a calculator. Use GM_sun = 1.327 x 10^20 m^3/s^2.

Earth's orbit is a slightly stretched ellipse with semi-major axis a = 1.496 x 10^11 m and eccentricity e = 0.0167. The closest distance to the Sun is r_p = a(1 - e) and the farthest is r_a = a(1 + e).

1. Compute r_p and r_a. (Answers: about 1.471 x 10^11 m and 1.521 x 10^11 m.)
2. Use the vis-viva equation to find Earth's speed at perihelion (closest) and at aphelion (farthest). Write 2/r and 1/a as separate numbers first, subtract, multiply by GM, then take the square root. (Answers: about 30.29 km/s and 29.29 km/s.)
3. Compute the speed of a perfectly circular orbit at r = a using v = sqrt(GM/a). Is it between your two answers? (Answer: about 29.78 km/s, yes.)
4. Self-check: angular momentum conservation says r x v is the same at both ends. Multiply each r by its v. The two products should agree to about 3 significant figures (about 4.455 x 10^15 m^2/s).
5. Stretch: a spacecraft leaves Earth's orbit to travel to Mars on an ellipse whose closest point is 1.496 x 10^11 m and farthest point is 2.279 x 10^11 m. Then a = (1.496 + 2.279) / 2 x 10^11 m = 1.8875 x 10^11 m. Use vis-viva at r = 1.496 x 10^11 m to find the speed it needs there (about 32.73 km/s). How much faster is that than Earth's own circular speed? (About 2.94 km/s, ignoring Earth's own gravity.)

## Summary

The vis-viva equation, v^2 = GM (2/r - 1/a), gives a body's speed at any point on its orbit from its distance r and the orbit's semi-major axis a. It comes from conservation of energy in an inverse-square gravitational field. For a circle r = a and it reduces to v = sqrt(GM/r), independent of the satellite's mass: the ISS at 400 km altitude travels at about 7.67 km/s. Closer means faster, farther means slower, and an ellipse is fastest at periapsis and slowest at apoapsis.
