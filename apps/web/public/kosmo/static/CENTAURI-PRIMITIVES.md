# Centauri primitives -- the parametric component library

`parts/primitives/` is the library the eight class builders are composed from, and the one the
shipyard can share. It is split so the numbers run in node and the geometry runs in the browser:

| File | What | Imports three? | Tested by |
| --- | --- | --- | --- |
| `spec.js` | pure functions: physical inputs -> envelope, mass, volume, mates, source | no | `centauri-primitives.test.mjs` (155 checks) |
| `materials.js` | PBR presets with procedural colour / roughness / normal maps, cached by kind and repeat | yes (falls back to colours without a DOM) | by use in every model |
| `mesh.js` | builders: a spec (or its numbers) -> a THREE.Group in the part frame; instanced where parts repeat | yes | by use; the catalogue models build every kind |

The master list of what the fleet needs and which primitive builds each row is
`CENTAURI-COMPONENT-INVENTORY.md`; the per-ship sizing is `CENTAURI-INVENTORY.md`.

## Conventions

- SI. +Y is the part axis; the origin is on the aft datum unless the spec says `origin: 'centre'`.
- Every spec returns `{ primitive, name, dims: { l, d }, mass, source, ... }` and, where another part
  can attach, `mates: [{ id, at, axis }]` with `axis` pointing out of the part. `volumeM3` or
  `volume: { pressurised, habitable }` where a volume is meaningful.
- `source` names the figure or the assumption behind the mass. Nothing is a bare number.
- Profiles are `[[r, y], ...]` from base to tip, ready for a lathe.
- A spec never knows about the fleet: the class builders in `parts/fleet-v4.js` decide what to ask for.

## spec.js

### Profiles
- `ogiveProfile(r, l, n)` tangent ogive, base to tip.
- `haackProfile(r, l, n, c = 0)` von Karman (LD-Haack) minimum-drag nose, base to tip.
- `domeProfile(r, h, n)` elliptical dome (h = 0.707 r is the sqrt-2 ellipsoid, h = r a hemisphere).

### Tankage
- `tankSpec({ volumeM3, kind:'cyl'|'sphere', ldRatio, domeRatio, ullage, pressurePa, material, safety, minGaugeM, fittingsFraction, insulationKgM2 })`
  hoop gauge `p r SF / sigma` with a minimum gauge, +25 % for welds/PMD/bosses, insulation by area; returns `barrelL, domeH, gaugeM, areaM2, profile`.
- `copvSpec({ gasKg, gasKind, pressurePa, tempK, pv2mKgPaM3 })` ideal-gas volume, mass by performance factor (150 kJ/kg default).

### Hulls and decks
- `hullSegmentSpec({ d, l, endKind:'cone'|'dome', shellKgM2 = 45, fitOutKgM2 = 35 })` ISS-class module by shell area; `volume.pressurised`.
- `torusDeckSpec({ R, D, decks, areaM2, floorKgM2, shellKgM2 })` the centrifuge laws as a part.

### Structure
- `trussSpec({ lengthM, widthM, axialLoadN, material, safety, bays })` four longerons at the load with a slenderness floor, +40 % members; `kgPerM`.
- `thrustFrameSpec({ dAft, dFore, lengthM, thrustN })` `max(50 kg, F/500 N per kg)`.

### Thermal and power
- `radiatorSpec({ heatW, tempK, emissivity, efficiency, twoSided, kgPerM2, maxLengthM, maxWidthM })` grey-body flux, panel count in pairs, `panelL, panelW, perSide`.
- `mliSpec({ areaM2, layers, kgPerM2 })`.
- `solarArraySpec({ powerW, fluxWm2, efficiency, packing, kgPerM2, aspect })`.
- `rtgSpec({ powerW, wePerKg = 2.4, yearsToEOL })` MMRTG class with Pu-238 decay.
- `reactorSpec({ powerWe, kgPerKWe = law, radiatorTempK, efficiency })` core + shield + conversion + its own radiator; specific mass `150 sqrt(40 kWe / P)`, floor 10.
- `powerStoreSpec({ energyWh, busW, whPerKg, pmadKgPerKw })`.

### Propulsion fittings
- `bellSpec({ thrustN, chamberPa, expansion, cf, thrustToWeight })` throat, exit, 80 % bell length, `profile`.
- `rcsQuadSpec({ thrustN, thrusters, thrusterKg })` R-4D class thruster mass x 6 for the pod.
- `kickStageSpec({ shipDryKg, dvMs, isp, tankFraction, bulkKgM3, thrustAccelG })` rocket equation with tanks as a fraction of propellant; returns `propKg, tankKg, engine (bellSpec), tank (tankSpec), closes`.

### Aero and landing
- `fairingSpec({ d, l | fineness, kind:'haack'|'ogive', shellKgM2, tpsKgM2 })`.
- `tpsSpec({ areaM2, kind:'tile'|'ablator'|'quilt' })`; `TPS_KIND` carries the kg/m2 and its reference.
- `gridFinSpec({ bodyD, count, material })` Falcon 9 fins scaled by body area.
- `landingLegSpec({ landedKg, bodyD, bodyL, g, count, massFraction })` span 2.45 D, hinge height, 4 % of landed mass.
- `parachuteSpec({ landedKg })`.

### Shielding
- `whippleSpec({ areaM2, kind:'stuffed'|'plain', standoffM })`.
- `dustShieldSpec({ areaM2, beta })` Daedalus-derived areal density scaled by beta^2, 5 kg/m2 floor.
- `stormShelterSpec({ crew, gPerCm2, m3PerPerson, waterFromStores })`.

### Avionics, comms, docking, fittings
- `dishSpec({ d, freqGHz, efficiency, kgPerM2, fD })` gain and mass.
- `laserCommSpec({ apertureM, powerW })`.
- `attitudeStoreSpec({ inertiaKgM2, slewRadS = law, count })` wheels below 50 N m s, CMGs above; slew requirement falls as 1/sqrt(I).
- `gncSpec({ crewed, scale })`.
- `dockingSpec({ kind })` with `DOCKING` (IDSS, CBM, lightband masses).
- `hatchSpec({ d })`, `windowSpec({ d, count })`.
- `crewFittingsSpec({ crew, days })` CQ, WHC, galley, exercise, medical, EVA suits (ISS masses).

### Sail systems
- `shroudLinesSpec`, `sailBoomSpec` (library: for boom-supported small sails).
- `sailCanisterSpec({ filmKg, filmDensity, packing })` the drum that holds the rolled film.
- `filmTemperatureK({ fluxWm2, absorptance = 1e-5, emissivity = 0.5 })`.
- `beaconSpec({ radiusM, count })`.
- `massOf(specs)`.

## inventory.js (built on spec.js)

- `RATES`, `CLOSURE`, `ECLSS_HW`, `VOLUME_PER_PERSON_M3`, `HOTEL_W_PER_PERSON`, `SPARES` -- the stated constants with their sources.
- `consumablesFor({ crew, days, closure, pressurisedM3 })` -> items, mass, gas and water masses, stores volume.
- `eclssFor({ crew, closure })` -> hardware mass and power, greenhouse area/mass/power.
- `deltaVBudget({ years, stop })` -> rows and total.
- `sailSystemsFor({ filmKg, areaM2, thrustN, deliveredW, hubbed })` -> canister, beacons, vanes, gimbal, film temperature, notes.
- `inventoryFor(mission)` -> every item with group, kg, m3, W and source, plus the roll-ups the checks hold.
- `inventoryPart({...})` -> a catalogue-shaped part carrying its `inventory` list.

## materials.js

- `surface(kind, { repeat, side, opacity })` -> a cached `MeshStandardMaterial` (or `MeshBasicMaterial` for lights). Kinds: `white`, `offwhite`, `stainless`, `tps`, `tpsHalf` (u < 0.5 windward), `mli`, `cell`, `radiator`, `glass`, `dark`, `grey`, `gold`, `copper`, `chrome`, `hatch`, `tank`, `accent`, `bell`, `film`, `navRed`, `navGreen`, `navWhite`, `warm`.
- `repeatFor(circ, len, bay)` the repeat count that makes one panel bay about `bay` metres.
- `PRESETS`, `COLOURS` for anything that wants the numbers.
- Maps are painted on a canvas once per kind and the normal map is a Sobel of the height channel; a material at a new repeat clones the textures (same image, new repeat).

## mesh.js

Primitives: `put`, `cyl`, `box`, `tor`, `sph`, `lathe(profile, kind)`, `rod(g, a, b, r, kind)`, `ringXZ(R, tube, kind, y)`, `instances(geometry, kind, [{ p, q, s }])`.

Builders (each returns a Group in the part frame):
`tankMesh(spec)`, `fairingMesh(spec)`, `hullSegmentMesh({ d, l, endKind, skin, windows, racks, hatchSide, raceway, bands })`, `torusDeckMesh({ R, D, decks, arc, windows, spokes, skin })`, `trussMesh({ lengthM, widthM, bays, kind, section })`, `accordionStrip(len, width, thick, segments, kind, angles)`, `radiatorMesh({ panelL, panelW, panels, angles })`, `solarArrayMesh({ L, W, angles })`, `dishMesh({ d, fD })`, `bellMesh(spec)`, `rcsQuadMesh({ d })`, `gridFinMesh({ finW, finH, finT, count, R, y })`, `landingLegMesh({ count, R0, hingeH, spanM, footY })` (with `userData.update(k)`), `hatchMesh(d)`, `portRingMesh(d)`, `navLights(points)`, `copvClusterMesh({ d, count })`.

Deployables return `{ group, setDeploy(k) }`; everything else a Group.

## How a class is composed

`parts/fleet-v4.js` is the worked example: `hullV4(cls)` picks catalogue parts, calls the inventory
laws, turns groups of items into parts (`storesModules`, `systemsBay`, `trimStagePart`, `reactorPart`,
`radiatorPart`, `bolaPart`, ...), and returns parts + mates + the mount the mast stands on.
`assemblyV4()` adds the mast (a `trussSpec` sized from the sail thrust), the canister and the film,
iterating the film mass to the fixed point where film = everything it pushes. `parts/centauri-models.js`
then has one short builder per part kind, each a composition of `mesh.js` calls -- a new ship or variant
is mostly data.

## Sharing with the shipyard

`landingLegMesh` and `gridFinMesh` are the shipyard's leg and fin geometry, lifted into the library
with the same hinge geometry and `update(k)` pose; `shipyard.html` still carries its inline copies, and
switching it to the imports is a one-screen change left for a shipyard pass so this branch does not touch
a page it did not need to.
