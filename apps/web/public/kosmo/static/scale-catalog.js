// scale-catalog.js — the data behind /kosmo/tools/scale (the scale carousel).
//
// Why a hand-checked index instead of catalog/objects.json: the carousel needs only a name, a type,
// one true extent, an existence window and a model reference per object. The full catalogue is 13 MB;
// this file is a few KB, so the view opens without a catalogue download and a time filter is a scan
// of a few dozen rows. Add objects here, not by widening the runtime payload.
//
// Time is signed years on the same astronomical axis as kosmo_entities.time_start / time_end
// (year 0 = 1 BCE, negative = BCE / years ago). `from` and `to` say when the object exists, not when
// it was discovered. `to: null` means "still exists". A window is approximate where the physics is:
// the UI says so (see the timeline note), and each entry carries its source.
//
// Size is the object's characteristic extent in metres: diameter for round bodies, length for
// vehicles and animals, span for structures. The ruler names the kind of measurement.

export const PRESENT_YEAR = 2026;
const AU = 1.495978707e11;          // m, IAU 2012
const LY = 9.4607304725808e15;      // m
const SOLAR_START = -4.603e9;       // years, the Sun's birth (4.6 Gyr ago)
const SOLAR_END = 8e9;              // years, the Sun's main-sequence end (order of magnitude)

const PLANET_SOURCE = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';

/** A procedural world drawn by kosmo-models.js. `radius_m` is the true radius, as in the catalogue. */
const proc = (spec) => ({ kind: 'proc', spec });

/** A real GLB from public/kosmo/static/models, measured to its true length. */
const glb = (url, lengthM, extra = {}) => ({ kind: 'glb', url, lengthM, ...extra });

/** A vehicle in models/spacex/manifest.json; the manifest supplies the file and orientation. */
const vehicle = (id, lengthM) => ({ kind: 'vehicle', id, lengthM });

/** An engine in models/spacex/manifest.json (file, orientation, exit diameter). */
const engine = (id, lengthM) => ({ kind: 'engine', id, lengthM });

const rocket = (id, name, lengthM, firstFlight, blurb) => ({
  id, name, group: 'Rocket', extent: lengthM, extentLabel: 'length',
  from: firstFlight, to: null, blurb,
  source: 'models/spacex/manifest.json',
  sourceLabel: 'the model manifest (length and first flight)',
  tint: '#9fb6c9',
  model: vehicle(id, lengthM),
});

const dinosaur = (id, name, maFrom, maTo, lengthM, uid, blurb) => ({
  id, name, group: 'Dinosaur', extent: lengthM, extentLabel: 'length',
  from: -maFrom * 1e6, to: -maTo * 1e6, blurb,
  source: `https://en.wikipedia.org/wiki/${name}`,
  sourceLabel: 'Wikipedia (adult length) · Paleobiology Database (age)',
  tint: '#bfa88a',
  model: glb(`models/dinosaurs/${uid}.glb`, lengthM, { uid, upright: false }),
});

export const SCALE_ENTRIES = [
  // ── the universe, and the largest structures we can draw ───────────────────────────────────────
  {
    id: 'observable-universe', name: 'The observable universe', group: 'Cosmos',
    extent: 8.8e26, extentLabel: 'diameter',
    from: -13.8e9, to: null,
    blurb: 'The sphere of space whose light has had time to reach us: 93 billion light-years across, and still expanding.',
    source: 'https://en.wikipedia.org/wiki/Observable_universe',
    tint: '#9db4d8',
    model: { kind: 'web' },
  },
  {
    id: 'laniakea', name: 'Laniakea Supercluster', group: 'Cosmos',
    extent: 5.2e24, extentLabel: 'diameter',
    from: -5e8, to: null,
    blurb: 'The basin of attraction that contains the Local Group: a hundred thousand galaxies flowing toward the Great Attractor.',
    source: 'https://en.wikipedia.org/wiki/Laniakea_Supercluster',
    tint: '#a8b6d8',
    model: proc({ name: 'Laniakea', type: 'galaxy_cluster', radius_m: 2.6e24, points: 2600 }),
  },
  {
    id: 'local-group', name: 'The Local Group', group: 'Cosmos',
    extent: 9.5e22, extentLabel: 'diameter',
    from: -1.2e10, to: null,
    blurb: 'More than fifty galaxies bound to ours, dominated by the Milky Way and Andromeda.',
    source: 'https://en.wikipedia.org/wiki/Local_Group',
    tint: '#a8b6d8',
    model: proc({ name: 'Local Group', type: 'galaxy_cluster', radius_m: 4.75e22, points: 1800 }),
  },
  {
    id: 'andromeda', name: 'Andromeda Galaxy', group: 'Galaxy',
    extent: 1.4e21, extentLabel: 'diameter',
    from: -1e10, to: null,
    blurb: 'Our nearest large neighbour, 2.5 million light-years away; on a collision course with the Milky Way.',
    source: 'https://en.wikipedia.org/wiki/Andromeda_Galaxy',
    tint: '#b4b8e0',
    model: proc({ name: 'Andromeda Galaxy', type: 'galaxy', radius_m: 7.0e20, notes: 'Spiral galaxy; morphology: SA(s)b', points: 7000 }),
  },
  {
    id: 'milky-way', name: 'The Milky Way', group: 'Galaxy',
    extent: 9.5e20, extentLabel: 'diameter',
    from: -13.2e9, to: null,
    blurb: 'Our barred spiral: a hundred billion stars, with a four-million-sun black hole at the centre.',
    source: 'https://en.wikipedia.org/wiki/Milky_Way',
    tint: '#c2c0d8',
    model: proc({ name: 'The Milky Way', type: 'galaxy', radius_m: 4.75e20, notes: 'Spiral galaxy; morphology: SB(rs)bc', points: 7000 }),
  },
  {
    id: 'great-hercules-cluster', name: 'Great Hercules Cluster', group: 'Star cluster',
    extent: 1.4e18, extentLabel: 'diameter',
    from: -1.15e10, to: null,
    blurb: 'Messier 13: several hundred thousand ancient stars bound in a ball about 145 light-years across.',
    source: 'https://en.wikipedia.org/wiki/Messier_13',
    tint: '#d8c9a8',
    model: proc({ name: 'Great Hercules Cluster', type: 'star_cluster', radius_m: 7.0e17, points: 2600 }),
  },
  {
    id: 'orion-nebula', name: 'The Orion Nebula', group: 'Nebula',
    extent: 2.3e17, extentLabel: 'diameter',
    from: -3e6, to: 5e7,
    blurb: 'A stellar nursery 24 light-years wide, close enough to see with the naked eye as a smudge in Orion’s sword.',
    source: 'https://en.wikipedia.org/wiki/Orion_Nebula',
    tint: '#c9a0b8',
    model: proc({ name: 'Orion Nebula', type: 'nebula', radius_m: 1.15e17, notes: 'Emission nebula and open cluster' }),
  },
  {
    id: 'crab-nebula', name: 'The Crab Nebula', group: 'Supernova remnant',
    extent: 1.0e17, extentLabel: 'diameter',
    from: 1054, to: 1e6,
    blurb: 'The wreck of the star that exploded in 1054, seen by Chinese and Japanese astronomers; a pulsar still powers its glow.',
    source: 'https://en.wikipedia.org/wiki/Crab_Nebula',
    tint: '#9fcfd8',
    model: proc({ name: 'Crab Nebula', type: 'supernova_remnant', radius_m: 5.0e16, notes: 'Crab Nebula supernova remnant with pulsar wind nebula' }),
  },
  {
    id: 'pillars-of-creation', name: 'Pillars of Creation', group: 'Nebula',
    extent: 3.8e16, extentLabel: 'height',
    from: -2e6, to: 1e6,
    blurb: 'Four-light-year columns of cold gas and dust in the Eagle Nebula, being eroded by the ultraviolet light of young stars.',
    source: 'https://en.wikipedia.org/wiki/Pillars_of_Creation',
    tint: '#c9a686',
    model: proc({ name: 'Pillars of Creation', type: 'nebula', radius_m: 1.9e16, notes: 'Pillars of Creation; Eagle Nebula M16 emission nebula' }),
  },
  {
    id: 'm87-star', name: 'M87*', group: 'Black hole',
    extent: 1.9e13, extentLabel: 'shadow diameter',
    from: -1e10, to: null,
    blurb: 'The 6.5-billion-solar-mass black hole imaged by the Event Horizon Telescope in 2019; its shadow is wider than the Solar System.',
    source: 'https://en.wikipedia.org/wiki/Messier_87',
    tint: '#d8a45f',
    model: proc({ name: 'M87*', type: 'black_hole', radius_m: 9.6e12, notes: 'Supermassive black hole; first image 2019' }),
  },
  {
    id: 'betelgeuse', name: 'Betelgeuse', group: 'Star',
    extent: 9.7e11, extentLabel: 'diameter',
    from: -8e6, to: 1.2e6,
    blurb: 'A red supergiant near the end of its life: if it sat at the Sun’s place, its surface would swallow the orbit of Mars.',
    source: 'https://en.wikipedia.org/wiki/Betelgeuse',
    tint: '#e08a5f',
    model: proc({ name: 'Betelgeuse', type: 'star', radius_m: 4.85e11, mass_kg: 3.3e31, temperature_K: 3600, spectral_type: 'M1-2Ia-ab' }),
  },
  {
    id: 'sagittarius-a', name: 'Sagittarius A*', group: 'Black hole',
    extent: 6.6e10, extentLabel: 'shadow diameter',
    from: -1e10, to: null,
    blurb: 'The four-million-solar-mass black hole at the centre of the Milky Way, imaged by the Event Horizon Telescope in 2022.',
    source: 'https://en.wikipedia.org/wiki/Sagittarius_A*',
    tint: '#d8a45f',
    model: proc({ name: 'Sagittarius A*', type: 'black_hole', radius_m: 1.27e10, notes: 'Supermassive black hole at the Galactic Centre' }),
  },
  {
    id: 'sirius-a', name: 'Sirius A', group: 'Star',
    extent: 2.38e9, extentLabel: 'diameter',
    from: -2.4e8, to: 1.2e9,
    blurb: 'The brightest star in the night sky, 25 times more luminous than the Sun and only 8.6 light-years away.',
    source: 'https://en.wikipedia.org/wiki/Sirius',
    tint: '#bcd4ff',
    model: proc({ name: 'Sirius A', type: 'star', radius_m: 1.19e9, mass_kg: 4.1e30, temperature_K: 9940, spectral_type: 'A1V' }),
  },
  {
    id: 'sun', name: 'The Sun', group: 'Star',
    extent: 1.3927e9, extentLabel: 'diameter',
    from: SOLAR_START, to: SOLAR_END,
    blurb: 'A G-type main-sequence star holding 99.86% of the Solar System’s mass; its light takes eight minutes to reach Earth.',
    source: 'https://en.wikipedia.org/wiki/Sun',
    tint: '#e8c37a',
    model: proc({ name: 'Sun', type: 'star', radius_m: 6.9634e8, mass_kg: 1.989e30, temperature_K: 5772, spectral_type: 'G2V' }),
  },
  {
    id: 'proxima-centauri', name: 'Proxima Centauri', group: 'Star',
    extent: 2.15e8, extentLabel: 'diameter',
    from: -4.85e9, to: 4e12,
    blurb: 'The nearest star to the Sun, a red dwarf 4.24 light-years away with at least one planet in its habitable zone.',
    source: 'https://en.wikipedia.org/wiki/Proxima_Centauri',
    tint: '#e09a7a',
    model: proc({ name: 'Proxima Centauri', type: 'star', radius_m: 1.07e8, mass_kg: 2.43e29, temperature_K: 3042, spectral_type: 'M5.5Ve' }),
  },
  {
    id: 'crab-pulsar', name: 'The Crab Pulsar', group: 'Neutron star',
    extent: 2.4e4, extentLabel: 'diameter',
    from: 1054, to: 1e9,
    blurb: 'A city-sized neutron star spinning about thirty times a second, sweeping a beam across the sky.',
    source: 'https://en.wikipedia.org/wiki/Crab_Pulsar',
    tint: '#a8c8ff',
    model: proc({ name: 'Crab Pulsar', type: 'pulsar', radius_m: 1.2e4, notes: 'Neutron star in the Crab Nebula' }),
  },

  // ── planets, moons and dwarf planets (NASA fact sheet radii) ──────────────────────────────────
  {
    id: 'jupiter', name: 'Jupiter', group: 'Planet',
    extent: 1.3982e8, extentLabel: 'diameter',
    from: SOLAR_START, to: SOLAR_END,
    blurb: 'The largest planet: a gas giant more massive than every other planet in the Solar System combined.',
    source: PLANET_SOURCE, tint: '#d8b48a',
    model: proc({ name: 'Jupiter', type: 'planet', radius_m: 7.15e7, mass_kg: 1.898e27, temperature_K: 165, segments: 56 }),
  },
  {
    id: 'saturn', name: 'Saturn', group: 'Planet',
    extent: 1.1646e8, extentLabel: 'diameter',
    from: SOLAR_START, to: SOLAR_END,
    blurb: 'A gas giant so light it would float in water, wrapped in rings of ice and rock.',
    source: PLANET_SOURCE, tint: '#e0c98a',
    model: proc({ name: 'Saturn', type: 'planet', radius_m: 5.8232e7, mass_kg: 5.683e26, temperature_K: 134, segments: 56 }),
  },
  {
    id: 'uranus', name: 'Uranus', group: 'Planet',
    extent: 5.0724e7, extentLabel: 'diameter',
    from: SOLAR_START, to: SOLAR_END,
    blurb: 'An ice giant knocked onto its side, so its poles take turns facing the Sun through an 84-year orbit.',
    source: PLANET_SOURCE, tint: '#9fd8dd',
    model: proc({ name: 'Uranus', type: 'planet', radius_m: 2.5362e7, mass_kg: 8.681e25, temperature_K: 76, segments: 56 }),
  },
  {
    id: 'neptune', name: 'Neptune', group: 'Planet',
    extent: 4.9244e7, extentLabel: 'diameter',
    from: SOLAR_START, to: SOLAR_END,
    blurb: 'The farthest planet, a deep-blue ice giant with the fastest winds measured anywhere.',
    source: PLANET_SOURCE, tint: '#7f9fe8',
    model: proc({ name: 'Neptune', type: 'planet', radius_m: 2.4622e7, mass_kg: 1.024e26, temperature_K: 72, segments: 56 }),
  },
  {
    id: 'earth', name: 'Earth', group: 'Planet',
    extent: 1.2742e7, extentLabel: 'diameter',
    from: -4.54e9, to: SOLAR_END,
    blurb: 'The only world known to carry life: 71% ocean, a thin breathable atmosphere and a protective magnetic field.',
    source: PLANET_SOURCE, tint: '#7fb0e8',
    model: proc({ name: 'Earth', type: 'planet', radius_m: 6.371e6, mass_kg: 5.972e24, temperature_K: 288, segments: 56 }),
  },
  {
    id: 'venus', name: 'Venus', group: 'Planet',
    extent: 1.2104e7, extentLabel: 'diameter',
    from: -4.54e9, to: SOLAR_END,
    blurb: 'A choked greenhouse world: 92 bars of carbon dioxide and clouds of sulphuric acid at 464 °C.',
    source: PLANET_SOURCE, tint: '#e3c48f',
    model: proc({ name: 'Venus', type: 'planet', radius_m: 6.052e6, mass_kg: 4.867e24, temperature_K: 737, segments: 56 }),
  },
  {
    id: 'mars', name: 'Mars', group: 'Planet',
    extent: 6.779e6, extentLabel: 'diameter',
    from: -4.54e9, to: SOLAR_END,
    blurb: 'A cold red desert with the tallest volcano and the deepest canyon in the Solar System.',
    source: PLANET_SOURCE, tint: '#d88f6a',
    model: proc({ name: 'Mars', type: 'planet', radius_m: 3.3895e6, mass_kg: 6.417e23, temperature_K: 208, segments: 56 }),
  },
  {
    id: 'titan', name: 'Titan', group: 'Moon',
    extent: 5.1496e6, extentLabel: 'diameter',
    from: -4.5e9, to: SOLAR_END,
    blurb: 'Saturn’s largest moon: a thick nitrogen atmosphere, methane rain and lakes of liquid hydrocarbons.',
    source: 'https://science.nasa.gov/saturn/moons/titan/',
    tint: '#d8b47a',
    model: proc({ name: 'Titan', type: 'moon', radius_m: 2.5748e6, mass_kg: 1.3452e23, temperature_K: 94, semi_major_axis_m: 1.2219e9, segments: 56 }),
  },
  {
    id: 'mercury', name: 'Mercury', group: 'Planet',
    extent: 4.879e6, extentLabel: 'diameter',
    from: -4.54e9, to: SOLAR_END,
    blurb: 'The smallest planet and the fastest: a cratered, iron-rich world with no atmosphere to speak of.',
    source: PLANET_SOURCE, tint: '#b8ad9a',
    model: proc({ name: 'Mercury', type: 'planet', radius_m: 2.4397e6, mass_kg: 3.301e23, temperature_K: 440, segments: 56 }),
  },
  {
    id: 'moon', name: 'The Moon', group: 'Moon',
    extent: 3.4748e6, extentLabel: 'diameter',
    from: -4.51e9, to: SOLAR_END,
    blurb: 'Earth’s companion, tidally locked so it always shows us the same face; born from a giant impact.',
    source: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    tint: '#c8c8c8',
    model: proc({ name: 'Moon', type: 'moon', radius_m: 1.7374e6, mass_kg: 7.342e22, segments: 56 }),
  },
  {
    id: 'pluto', name: 'Pluto', group: 'Dwarf planet',
    extent: 2.376e6, extentLabel: 'diameter',
    from: -4.56e9, to: SOLAR_END,
    blurb: 'A dwarf planet of nitrogen ice, mountains of water ice and a thin, escaping atmosphere.',
    source: 'https://science.nasa.gov/dwarf-planets/pluto/',
    tint: '#c9b49a',
    model: proc({ name: 'Pluto', type: 'dwarf_planet', radius_m: 1.188e6, mass_kg: 1.303e22, temperature_K: 44, segments: 48 }),
  },
  {
    id: 'ceres', name: 'Ceres', group: 'Dwarf planet',
    extent: 9.4e5, extentLabel: 'diameter',
    from: -4.56e9, to: SOLAR_END,
    blurb: 'The largest object in the asteroid belt, a water-rich dwarf planet with bright salt deposits.',
    source: 'https://science.nasa.gov/dwarf-planets/ceres/',
    tint: '#a8a8a0',
    model: proc({ name: 'Ceres', type: 'dwarf_planet', radius_m: 4.7e5, mass_kg: 9.38e20, temperature_K: 168, segments: 48 }),
  },

  // ── dinosaurs (ages from the Paleobiology Database; lengths are typical adult values) ───────────
  dinosaur('argentinosaurus', 'Argentinosaurus', 110.1, 106.3, 35, 'b13dc09245164fdc8985e9e070354bff', 'One of the largest land animals ever: a long-necked titanosaur from Cretaceous Patagonia.'),
  dinosaur('dreadnoughtus', 'Dreadnoughtus', 83.6, 72.2, 26, '71fd3c8c04a640e5b6ef5577cc8878be', 'A massive titanosaur known from a remarkably complete skeleton.'),
  dinosaur('brachiosaurus', 'Brachiosaurus', 157.9, 143.1, 22, '5c8127f0f136447888f3c73a8cac34bc', 'A tall sauropod that browsed high in the canopy, with longer front legs than hind legs.'),
  dinosaur('giraffatitan', 'Giraffatitan', 161.5, 143.1, 26, '36d5031b7d4a4f229dab5dcd68957a0c', 'A Late Jurassic sauropod from Tendaguru, long treated as an African Brachiosaurus.'),
  dinosaur('apatosaurus', 'Apatosaurus', 157.9, 143.1, 21, 'fecabec8e4ef42ef98b5480dbf50c57d', 'A bulky diplodocid with a long whip tail, formerly known as Brontosaurus.'),
  dinosaur('mamenchisaurus', 'Mamenchisaurus', 168.2, 113.2, 22, '69ce84f35719434faec32d1890ac0c31', 'A Chinese sauropod with one of the longest necks of any animal.'),
  dinosaur('therizinosaurus', 'Therizinosaurus', 72.2, 66, 10, '5c9921ab5cf742d38d54c8bcac6b9a7d', 'A bizarre theropod with metre-long claws, probably a plant eater.'),
  dinosaur('iguanodon', 'Iguanodon', 154.8, 66, 10, 'fa48e7e71245482fb933ecd9c94f53d9', 'A widespread herbivore with a thumb spike, among the first dinosaurs named.'),
  dinosaur('parasaurolophus', 'Parasaurolophus', 83.6, 72.2, 9.5, '76e4a8b9f9b84ea4b4aaaee7cc5b7fed', 'A duck-billed dinosaur whose hollow crest may have acted as a resonating chamber.'),
  dinosaur('triceratops', 'Triceratops', 83.6, 66, 9, 'e797b70c11fd4d3a91783ad41aa32893', 'A three-horned ceratopsian with a bony frill, common in the latest Cretaceous.'),
  dinosaur('stegosaurus', 'Stegosaurus', 161.5, 93.9, 9, '0b85ef7545974049b123592b0af74395', 'A plated Jurassic herbivore with a spiked tail and a tiny brain for its body.'),
  dinosaur('ankylosaurus', 'Ankylosaurus', 83.6, 66, 8, '2dac5acc3c31434d98532289b4ac08a8', 'An armoured tank of a dinosaur with a club at the end of its tail.'),
  dinosaur('plateosaurus', 'Plateosaurus', 227.3, 199.5, 8, 'b099245bdf1b4f74bcc27c960db72600', 'A Triassic prosauropod, an early relative of the giant sauropods.'),
  dinosaur('psittacosaurus', 'Psittacosaurus', 137.05, 100.5, 2, '75f9c22d5f2a41ed897bf163c60aaef4', 'A small, parrot-beaked early ceratopsian, known from dozens of specimens.'),

  // ── rockets (length and file from models/spacex/manifest.json; first flight from the records) ──
  rocket('starship-stack', 'Starship (full stack)', 121, 2023, 'The largest rocket ever flown: Super Heavy plus the Starship upper stage, 121 m tall.'),
  rocket('n1', 'N1', 105, 1969, 'The Soviet Moon rocket: four launch failures, and the largest rocket ever flown to failure.'),
  rocket('sls-block-1', 'Space Launch System', 98, 2022, 'NASA’s deep-space rocket, which sent Artemis I around the Moon uncrewed.'),
  rocket('new-glenn', 'New Glenn', 98, 2025, 'Blue Origin’s heavy-lift rocket, with a reusable first stage and a 7 m fairing.'),
  rocket('saturn-v', 'Saturn V', 88.1, 1967, 'The Moon rocket: 111 m with the Apollo spacecraft, and still the tallest fully successful launcher.'),
  rocket('falcon-heavy', 'Falcon Heavy', 70, 2018, 'Three Falcon 9 blocks bound together, with 27 Merlin engines at lift-off.'),
  rocket('falcon9-block5', 'Falcon 9 Block 5', 70, 2010, 'The workhorse of the modern launch industry, with a reusable first stage and landing legs.'),
  rocket('ariane-6', 'Ariane 6', 63, 2024, 'Europe’s new heavy launcher: a Vulcain core with two or four solid boosters.'),
  rocket('vulcan-centaur', 'Vulcan Centaur', 61.6, 2024, 'ULA’s successor to the Atlas V, designed to fly with BE-4 methane engines.'),
  rocket('atlas-v', 'Atlas V', 58.3, 2002, 'A reliable US launcher, most famous for carrying the Curiosity and Perseverance rovers to Mars.'),
  rocket('long-march-5', 'Long March 5', 56.97, 2016, 'China’s largest rocket, which launched the Tianwen-1 Mars mission and the lunar sample returner.'),
  rocket('space-shuttle-stack', 'Space Shuttle', 56.1, 1981, 'The orbiter, external tank and two solid rocket boosters: the first reusable orbital launch system.'),
  rocket('h-iia', 'H-IIA', 53, 2001, 'Japan’s workhorse launcher, which flew for more than two decades.'),
  rocket('soyuz-fg', 'Soyuz-FG', 49.5, 2001, 'The crewed Soyuz launcher used for every International Space Station rotation until 2019.'),
  rocket('pslv', 'PSLV', 44, 1993, 'India’s Polar Satellite Launch Vehicle, famous for carrying dozens of satellites at once.'),
  rocket('electron', 'Electron', 18, 2017, 'A small, carbon-fibre launcher with Rutherford engines, built for dedicated small-satellite rides.'),
  rocket('v-2', 'V-2', 14, 1944, 'The first ballistic missile and the first human-made object to reach space, in 1944.'),
  {
    id: 'raptor', name: 'Raptor engine', group: 'Engine',
    extent: 3.1, extentLabel: 'length', from: 2019, to: null,
    blurb: 'SpaceX’s full-flow staged-combustion methane engine, 33 of which power Super Heavy.',
    source: 'models/spacex/manifest.json', tint: '#b8b0a0',
    model: engine('raptor', 3.1),
  },
  {
    id: 'merlin-1d-vacuum', name: 'Merlin 1D Vacuum', group: 'Engine',
    extent: 4.1, extentLabel: 'length', from: 2013, to: null,
    blurb: 'The vacuum-optimised Merlin with a 2.4 m exhaust bell, which pushes the Falcon 9 second stage.',
    source: 'models/spacex/manifest.json', tint: '#b8b0a0',
    model: engine('merlin-1d-vacuum', 4.1),
  },
  {
    id: 'merlin-light', name: 'Merlin 1D', group: 'Engine',
    extent: 2.9, extentLabel: 'length', from: 2013, to: null,
    blurb: 'The sea-level Merlin: nine of them lift a Falcon 9 first stage.',
    source: 'models/spacex/manifest.json', tint: '#b8b0a0',
    model: engine('merlin-light', 2.9),
  },
  {
    id: 'j-2s', name: 'J-2S engine', group: 'Engine',
    extent: 3.38, extentLabel: 'length', from: 1969, to: null,
    blurb: 'An uprated, simplified J-2: the hydrogen engine that powered the Saturn V upper stages.',
    source: 'models/spacex/manifest.json', tint: '#b8b0a0',
    model: engine('j-2s', 3.38),
  },

  // ── life at the small end (procedural cell models) ─────────────────────────────────────────────
  {
    id: 'human-egg', name: 'Human egg cell', group: 'Cell',
    extent: 1e-4, extentLabel: 'diameter',
    from: -6e8, to: null,
    blurb: 'One of the largest human cells: about a tenth of a millimetre across, barely visible to the naked eye.',
    source: 'https://en.wikipedia.org/wiki/Egg_cell',
    tint: '#d8b8a8',
    model: proc({ name: 'Human egg cell', type: 'cell', cell: 'egg' }),
  },
  {
    id: 'red-blood-cell', name: 'Red blood cell', group: 'Cell',
    extent: 8e-6, extentLabel: 'diameter',
    from: -6e8, to: null,
    blurb: 'A biconcave disc packed with haemoglobin; about five million fit in a cubic millimetre of blood.',
    source: 'https://en.wikipedia.org/wiki/Red_blood_cell',
    tint: '#d88a7a',
    model: proc({ name: 'Red blood cell', type: 'cell', cell: 'rbc' }),
  },
  {
    id: 'e-coli', name: 'E. coli', group: 'Cell',
    extent: 2e-6, extentLabel: 'length',
    from: -1e8, to: null,
    blurb: 'A rod-shaped bacterium about two micrometres long: a single cell with no nucleus, and a model organism for biology.',
    source: 'https://en.wikipedia.org/wiki/Escherichia_coli',
    tint: '#a8c9a0',
    model: proc({ name: 'E. coli', type: 'cell', cell: 'bacterium' }),
  },
  {
    id: 'sars-cov-2', name: 'SARS-CoV-2', group: 'Virus',
    extent: 1e-7, extentLabel: 'diameter',
    from: 2019, to: null,
    blurb: 'The virus that caused COVID-19: a 100 nm particle wrapped in a lipid envelope, studded with spike proteins.',
    source: 'https://en.wikipedia.org/wiki/COVID-19_pandemic',
    tint: '#c9a0c9',
    model: proc({ name: 'SARS-CoV-2', type: 'virus' }),
  },
];

/** Reference marks on the ruler and ladder: familiar sizes that are not carousel entries. */
export const REFERENCE_MARKS = [
  { label: 'human', extent: 1.7, note: 'a person' },
  { label: 'Everest', extent: 8849, note: 'the mountain' },
  { label: 'Earth', extent: 1.2742e7, note: 'the planet' },
];

/** Era bands behind the timeline. Overlaps are deliberate: a dinosaur lives inside the Mesozoic. */
export const ERA_BANDS = [
  { name: 'Big Bang', from: -13.8e9, to: -13.6e9 },
  { name: 'First stars', from: -13.6e9, to: -13.0e9 },
  { name: 'Galaxies', from: -13.0e9, to: -4.6e9 },
  { name: 'Solar System', from: -4.6e9, to: -5.4e8 },
  { name: 'Animals', from: -5.4e8, to: -2.33e8 },
  { name: 'Dinosaurs', from: -2.33e8, to: -6.6e7 },
  { name: 'Mammals and humans', from: -6.6e7, to: 1957 },
  { name: 'Spaceflight', from: 1957, to: PRESENT_YEAR },
];

/** One-tap times on the logarithmic axis. */
export const TIMELINE_PRESETS = [
  { label: 'Today', year: PRESENT_YEAR },
  { label: 'Dinosaurs', year: -75e6 },
  { label: 'Solar birth', year: -4.55e9 },
  { label: 'First galaxies', year: -12.5e9 },
  { label: 'Big Bang', year: -13.79e9 },
];

// ── pure helpers (no DOM: unit-tested by scale-catalog.test.mjs) ────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const LOG_MAX = Math.log10(13.8e9 + 1);

/** Largest first; never mutates the input. */
export function sortBySize(entries) {
  return [...entries].sort((a, b) => b.extent - a.extent || a.name.localeCompare(b.name));
}

/** True when `year` falls inside the entry's existence window (open ends allowed). */
export function aliveAt(entry, year) {
  return (entry.from == null || year >= entry.from) && (entry.to == null || year <= entry.to);
}

/** The entries that exist at `year`, still in largest-to-smallest order. */
export function filterByTime(entries, year) {
  return entries.filter((e) => aliveAt(e, year));
}

/**
 * Slider position 0..1 ↔ signed year on a log axis of "years before present".
 * 0 is the Big Bang end of the axis, 1 is today. The log mapping keeps 13.8 Gyr and the
 * last century both reachable with one control.
 */
export function yearToSlider(year) {
  const ybp = Math.max(0, PRESENT_YEAR - year);
  return clamp(1 - Math.log10(ybp + 1) / LOG_MAX, 0, 1);
}

export function sliderToYear(t) {
  const ybp = Math.pow(10, (1 - clamp(t, 0, 1)) * LOG_MAX) - 1;
  return PRESENT_YEAR - ybp;
}

/** The entry in `list` whose log size is nearest to `entry`; 0 when there is no reference. */
export function nearestIndex(list, entry) {
  if (!list.length) return -1;
  if (!entry) return 0;
  const target = Math.log10(entry.extent);
  let best = 0;
  let bestD = Infinity;
  list.forEach((e, i) => {
    const d = Math.abs(Math.log10(e.extent) - target);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** 3–4 significant digits, with thousands separators where the number is large enough to read. */
function num(v) {
  const a = Math.abs(v);
  if (a >= 1000) return Math.round(v).toLocaleString('en-US');
  if (a >= 100) return String(Math.round(v));
  return Number(v.toPrecision(3)).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** A human-readable length, using the unit that keeps the number between about 1 and 999. */
export function formatLength(m) {
  if (!(m > 0)) return '—';
  if (m < 1e-6) return `${num(m * 1e9)} nm`;
  if (m < 1e-3) return `${num(m * 1e6)} µm`;
  if (m < 1) return `${num(m * 1e3)} mm`;
  if (m < 1e3) return `${num(m)} m`;
  if (m < 1e9) return `${num(m / 1e3)} km`;
  if (m < 1e12) return `${num(m / 1e9)} million km`;
  if (m < 0.05 * LY) return `${num(m / AU)} AU`;
  if (m < 1e3 * LY) return `${num(m / LY)} ly`;
  if (m < 1e6 * LY) return `${num(m / (1e3 * LY))} thousand ly`;
  if (m < 1e9 * LY) return `${num(m / (1e6 * LY))} million ly`;
  return `${num(m / (1e9 * LY))} billion ly`;
}

function scaleYears(a) {
  if (a >= 1e9) return `${num(a / 1e9)} billion years`;
  if (a >= 1e6) return `${num(a / 1e6)} million years`;
  if (a >= 1e3) return `${num(a / 1e3)} thousand years`;
  return `${Math.round(a)} years`;
}

/** A signed year as prose: "today", "1054 CE", "110 million years ago", "8 billion years from now". */
export function formatYear(y) {
  if (y == null) return '';
  if (y >= PRESENT_YEAR) return 'today';
  if (y > PRESENT_YEAR - 2) return 'today';
  if (y > 1e4) return `${Math.round(y).toLocaleString('en-US')} CE`;
  if (y > 0) return `${Math.round(y)} CE`;
  if (y > -1e4) return `${Math.max(1, Math.round(1 - y))} BCE`;
  return `${scaleYears(-y)} ago`;
}

/** The existence window as prose; open ends read as "today". */
export function formatSpan(from, to) {
  if (from == null && to == null) return 'all time';
  const start = from == null ? 'always' : formatYear(from);
  const end = to == null ? 'today' : formatYear(to);
  return `${start} – ${end}`;
}

/**
 * Ticks for a linear ruler of [0, max] at 1, 2 or 5 × a power of ten. Returns
 * { step, ticks } with the last tick not beyond max. Used by the bottom ruler.
 */
export function niceTicks(max, count = 5) {
  if (!(max > 0) || !Number.isFinite(max)) return { step: 1, ticks: [0] };
  const raw = max / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  const ticks = [];
  const limit = max * (1 + 1e-9);
  for (let i = 0; i < 64; i++) {
    const v = i * step;
    if (v > limit) break;
    ticks.push(v);
  }
  return { step, ticks };
}
