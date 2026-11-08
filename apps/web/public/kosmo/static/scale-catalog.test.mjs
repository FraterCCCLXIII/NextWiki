// Headless checks for the scale catalogue. Run by static/run-tests.mjs, or directly:
//   node public/kosmo/static/scale-catalog.test.mjs
import assert from 'node:assert/strict';
import {
  SCALE_ENTRIES, PRESENT_YEAR,
  sortBySize, filterByTime, aliveAt, nearestIndex,
  yearToSlider, sliderToYear, formatLength, formatYear, formatSpan, niceTicks,
} from './scale-catalog.js';

let checks = 0;
const ok = (cond, message) => { assert.ok(cond, message); checks++; };

// ── data integrity ──────────────────────────────────────────────────────────────────────────────
const sorted = sortBySize(SCALE_ENTRIES);
ok(sorted.length > 50, 'a useful number of objects is indexed');
ok(new Set(SCALE_ENTRIES.map((e) => e.id)).size === SCALE_ENTRIES.length, 'ids are unique');
ok(SCALE_ENTRIES.every((e) => e.name && e.group && e.model && e.extent > 0), 'every entry has a name, group, size and model');
ok(SCALE_ENTRIES.every((e) => e.source), 'every entry carries a source');
ok(sorted[0].id === 'observable-universe', 'the observable universe is the largest entry');
ok(sorted.at(-1).extent < 1e-5, 'the smallest entry is microscopic');

// sortBySize must not reorder the source module in place
ok(SCALE_ENTRIES[0].id === 'observable-universe', 'the source array is unchanged by sorting');

// every window is ordered (from <= to) where both ends exist
ok(SCALE_ENTRIES.every((e) => e.from == null || e.to == null || e.from <= e.to), 'existence windows are ordered');

// ── time filtering ─────────────────────────────────────────────────────────────────────────────
const today = filterByTime(sorted, PRESENT_YEAR);
ok(today.some((e) => e.id === 'earth'), 'Earth exists today');
ok(today.some((e) => e.id === 'falcon9-block5'), 'Falcon 9 is present today');
ok(!today.some((e) => e.id === 'triceratops'), 'non-avian dinosaurs are not present today');

const cretaceous = filterByTime(sorted, -75e6);
ok(cretaceous.some((e) => e.id === 'triceratops'), 'Triceratops exists 75 Ma');
ok(cretaceous.some((e) => e.id === 'tyrannosaurus') === false, 'an entry not in the index is absent');
ok(!cretaceous.some((e) => e.id === 'falcon9-block5'), 'Falcon 9 does not exist 75 Ma');

const early = filterByTime(sorted, -13e9);
ok(early.length >= 1 && early.some((e) => e.id === 'observable-universe'), 'the universe exists in the early universe');
ok(!early.some((e) => e.id === 'earth'), 'Earth does not exist 13 Gyr ago');

ok(aliveAt({ from: 10, to: 20 }, 10) && aliveAt({ from: 10, to: 20 }, 20), 'windows include both ends');
ok(!aliveAt({ from: 10, to: 20 }, 21), 'windows exclude the year after');
ok(aliveAt({ from: null, to: null }, -1e12), 'an open window is always alive');

// ── log time axis ───────────────────────────────────────────────────────────────────────────────
ok(Math.abs(sliderToYear(yearToSlider(PRESENT_YEAR)) - PRESENT_YEAR) < 1, 'today round-trips');
ok(Math.abs(sliderToYear(yearToSlider(-4.55e9)) - -4.55e9) < 2e7, 'the solar birth round-trips within a slider step');
ok(Math.abs(sliderToYear(0) - -13.8e9) < 2e6, 'the left end is the Big Bang');
ok(Math.abs(sliderToYear(1) - PRESENT_YEAR) < 1, 'the right end is today');
ok(yearToSlider(-75e6) > yearToSlider(-4.55e9), 'the slider moves forward with time');

// ── nearest selection ──────────────────────────────────────────────────────────────────────────
const earth = sorted.find((e) => e.id === 'earth');
ok(sorted[nearestIndex(sorted, earth)].id === 'earth', 'nearestIndex finds an entry that is in the list');
ok(nearestIndex([], earth) === -1, 'nearestIndex on an empty list is -1');
ok(nearestIndex(sorted, null) === 0, 'nearestIndex without a reference picks the largest');

// ── formatting ─────────────────────────────────────────────────────────────────────────────────
ok(formatLength(1.3982e8) === '139,820 km', 'Jupiter reads as 139,820 km');
ok(formatLength(1.2742e7) === '12,742 km', 'Earth reads as 12,742 km');
ok(formatLength(9.7e11) === '970 million km', 'Betelgeuse reads in million km');
ok(formatLength(1.9e13) === '127 AU', 'M87* shadow reads in AU');
ok(formatLength(3.8e16) === '4.02 ly', 'the Pillars read in light-years');
ok(formatLength(8.8e26) === '93 billion ly', 'the universe reads in billion light-years');
ok(formatLength(1e-7) === '100 nm', 'a virus reads in nanometres');
ok(formatYear(PRESENT_YEAR) === 'today', 'the present reads as today');
ok(formatYear(1054) === '1054 CE', 'a CE year keeps its number');
ok(formatYear(-66e6) === '66 million years ago', 'a deep past year reads in millions of years');
ok(formatSpan(-66e6, null).endsWith('today'), 'an open end reads as today');
ok(niceTicks(1.887e8).ticks.length >= 3, 'the ruler produces several ticks');
ok(niceTicks(1.887e8).ticks.at(-1) <= 1.887e8, 'ruler ticks never exceed the ruler maximum');
ok(niceTicks(0).ticks.length === 1, 'a zero-width ruler still has an origin tick');

console.log(`scale-catalog: ${checks} checks passed`);
