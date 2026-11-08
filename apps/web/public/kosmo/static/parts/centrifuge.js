/* centrifuge.js -- how big a spin ring a crew needs, and what it costs.

   A rotating ring is the only way to give a crew weight without a planet, and its size is not a
   drawing choice. Gravity is omega^2 R, and comfort caps omega: above about 4 rpm the Coriolis
   cross-coupling starts to be felt in the inner ear on head movements, so 4 rpm (NASA's canonical
   figure) is the continuous-living limit and 6 rpm the short-stay one. That fixes the floor radius
   for 1 g at 55.9 m; a smaller ring has to spin faster.

   The ring is then sized the other way round: from the people. Long-duration deck area is taken as
   30 m2 per person -- 12 of quarters, 9 of work, 6 of social, 3 of medical and exercise, with the
   circulation inside those numbers -- and the tube diameter is grown until the decks inside it hold
   that area. Everything below is a stated assumption, not a measurement:

     deck ceiling 2.4 m, 0.6 m of structure between decks
     floor and outfitting 250 kg/m2, pressure shell 60 kg/m2
     lighting 20 W/m2, life support 100 W per person

   No DOM: imported by fleet.js, the catalogue and the node checks. */

import { G0 } from './parts.js';

export const DECK = { ceiling: 2.4, structure: 0.6, pitch: 3.0 };
export const AREA_PER_CREW_M2 = 30;
/* Where the 30 m2 goes. Shares of the total floor, so they add to one. */
export const ZONE_SHARE = { quarters: 0.4, work: 0.3, social: 0.2, medical: 0.1 };
export const AREAL_MASS = { floor: 250, shell: 60 };
export const POWER = { lighting: 20, perCrew: 100 };
export const COMFORT_RPM = { continuous: 4, short: 6 };

export const omega = (rpm) => (rpm * Math.PI * 2) / 60;
/** Floor radius that gives `g` at `rpm`: 1 g at 4 rpm is 55.9 m. */
export const radiusFor = (g, rpm) => g / omega(rpm) ** 2;
export const rpmFor = (g, radiusM) => (Math.sqrt(g / radiusM) * 60) / (Math.PI * 2);

/** Decks that fit in a tube of diameter D, and the floor each one carries. A circular tube's
 *  average usable chord is taken as 0.8 D. */
export function decksFor(D) {
  return Math.max(1, Math.floor((D - 1.2) / DECK.pitch));
}
export function floorAreaFor(radiusM, D) {
  return 2 * Math.PI * radiusM * 0.8 * D * decksFor(D);
}

/**
 * Size a ring for `crew` people at `g` and `rpm`. The radius is fixed by the gravity and the spin
 * rate; the tube is grown until the decks hold `crew * areaPerCrew`.
 */
export function ringFor({ crew, g = G0, rpm = COMFORT_RPM.continuous, areaPerCrew = AREA_PER_CREW_M2, tubeMin = 3, tubeMax = 40 }) {
  const R = radiusFor(g, rpm);
  const requiredArea = crew * areaPerCrew;
  let D = tubeMin;
  while (floorAreaFor(R, D) < requiredArea && D < tubeMax) D += 0.5;
  const decks = decksFor(D);
  const area = floorAreaFor(R, D);
  const shellArea = 2 * Math.PI * R * Math.PI * D;
  return {
    crew, g, rpm, R, D, decks, area, requiredArea,
    areaPerCrew: area / crew,
    floorPerDeck: area / decks,
    shellArea,
    mass: area * AREAL_MASS.floor + shellArea * AREAL_MASS.shell,
    omega: omega(rpm),
    rimSpeed: omega(rpm) * R,
    volume: area * DECK.ceiling,
    power: area * POWER.lighting + crew * POWER.perCrew,
    zones: Object.fromEntries(Object.entries(ZONE_SHARE).map(([k, share]) => [k, area * share])),
    satisfied: area >= requiredArea,
    comfortable: rpm <= COMFORT_RPM.continuous
  };
}

/** The rpm/radius trade for a crew: the same gravity, four spin rates, and what each costs. */
export function ringTrade({ crew, g = G0, rpms = [2, 3, 4, 6] }) {
  return rpms.map((rpm) => ringFor({ crew, g, rpm })).map((r) => ({
    rpm: r.rpm, radiusM: r.R, tubeD: r.D, decks: r.decks, area: r.area,
    massKg: r.mass, rimSpeed: r.rimSpeed, comfortable: r.comfortable, satisfied: r.satisfied
  }));
}

/** The deck layout: living and working decks alternate, because a ring is a loop and the two uses
 *  want to be interleaved rather than stacked in one place. */
export function deckLayout(ring) {
  const living = Math.max(1, Math.round(ring.decks / 2));
  const out = [];
  for (let i = 0; i < ring.decks; i += 1) {
    const use = i % 2 === 0 ? 'living' : 'work';
    out.push({
      deck: i + 1,
      use,
      floorM2: ring.floorPerDeck,
      /* Where the deck sits inside the tube: floors climb from the inner wall outward, so the
         outermost deck has the highest gravity. */
      radiusM: ring.R - ring.D / 2 + DECK.structure + DECK.ceiling / 2 + i * DECK.pitch,
      g: omega(ring.rpm) ** 2 * (ring.R - ring.D / 2 + DECK.structure + DECK.ceiling / 2 + i * DECK.pitch)
    });
  }
  return { livingDecks: living, workDecks: ring.decks - living, decks: out };
}
