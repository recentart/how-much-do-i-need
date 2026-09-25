// Known-answer tests for the second batch of calculators and the shared features (extra areas,
// price). Each expected value was worked out by hand from the formula in the comment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, rawWith, validate } from '../src/lib/validate.mjs';
import { fromBase } from '../src/lib/units.mjs';
import boxes from '../src/calculators/boxes.mjs';
import wallpaper from '../src/calculators/wallpaper.mjs';
import fence from '../src/calculators/fence.mjs';
import deck from '../src/calculators/deck.mjs';
import drywall from '../src/calculators/drywall.mjs';
import lawn from '../src/calculators/lawn.mjs';
import roofing from '../src/calculators/roofing.mjs';
import brick from '../src/calculators/brick.mjs';
import paver from '../src/calculators/paver.mjs';
import insulation from '../src/calculators/insulation.mjs';
import retainingWall from '../src/calculators/retaining-wall.mjs';
import party from '../src/calculators/party.mjs';
import pool from '../src/calculators/pool.mjs';
import truck from '../src/calculators/truck.mjs';
import internet from '../src/calculators/internet.mjs';
import flooring from '../src/calculators/flooring.mjs';
import soil from '../src/calculators/soil.mjs';
import paint from '../src/calculators/paint.mjs';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} is not close to ${b}`);
const ok = (def, o = {}, s = 'us') => {
  const r = run(def, rawWith(def, o, s), s);
  assert.ok(r.ok, `${def.id}: ${r.model.error}`);
  return r;
};

test('moving boxes: default two-bedroom home', () => {
  // small 6+3+8+2+2 = 21, medium 10+1+8+5+3 = 27, large 6+3+3+1 = 13, wardrobe 2 → 63 boxes
  // +10%: 23.1→24, 29.7→30, 14.3→15, 2.2→3 = 72; tape 72/15 = 4.8 → 5 rolls
  const { result: r, model } = ok(boxes);
  close(r.exactTotal, 63);
  assert.deepEqual(r.buy, { small: 24, medium: 30, large: 15, wardrobe: 3 });
  assert.equal(r.total, 72);
  assert.equal(r.tape, 5);
  assert.equal(model.headline.value, '72 boxes');
});

test('moving boxes: stuff level, editable per-room figures and no rooms', () => {
  close(ok(boxes, { stuff: 'full' }).result.exactTotal, 63 * 1.35);
  close(ok(boxes, { bedroomsPer: '20', bathrooms: '0', kitchens: '0', living: '0', dining: '0' }).result.exactTotal, 40);
  const none = run(boxes, rawWith(boxes, { bedrooms: '0', bathrooms: '0', kitchens: '0', living: '0', dining: '0' }));
  assert.equal(none.ok, false);
  assert.match(none.model.error, /at least one room/);
});

test('wallpaper: default room, exact drop count', () => {
  // 2 × (12 + 10) − 3 = 41 ft = 492 in ÷ 20.5 = exactly 24 drops; drop 96 + 4 = 100 in; 396 ÷ 100 → 3 per roll
  // 24 ÷ 3 = 8 rolls; +10% = 8.8 → 9
  const { result: r, model } = ok(wallpaper);
  assert.equal(r.drops, 24);
  assert.equal(r.dropsPerRoll, 3);
  assert.equal(r.rollsBase, 8);
  assert.equal(model.headline.value, '9 rolls');
});

test('wallpaper: pattern repeat and a feature wall', () => {
  // 21 in repeat: 100 in → 5 repeats = 105 in; 396 ÷ 105 = 3.77 → 3 per roll
  assert.equal(ok(wallpaper, { repeat: [21, 'in'] }).result.dropLength.toFixed(4), (105 * 0.0254).toFixed(4));
  // one 12 ft wall, no openings: 144 ÷ 20.5 = 7.02 → 8 drops → 3 rolls; +10% = 3.3 → 4
  const one = ok(wallpaper, { walls: 'one', openings: '0' }).result;
  assert.equal(one.drops, 8);
  assert.equal(one.rolls, 4);
  assert.equal(run(wallpaper, rawWith(wallpaper, { height: '40' })).ok, false); // taller than a roll
});

test('fence: panels, posts and concrete', () => {
  // 100 ÷ 8 = 12.5 → 13 sections, 14 posts
  // hole π·5²·24 = 1884.956 in³ − 3.5²·24 = 294 → 1590.956 in³ = 0.920692 ft³ × 14 = 12.8897 ft³
  // × 1.05 ÷ 0.6 = 22.557 → 23 bags
  const { result: r, model } = ok(fence);
  assert.equal(r.sections, 13);
  assert.equal(r.posts, 14);
  close(fromBase(r.concretePerPost, 'volume', 'ft3'), 1590.9563 / 1728, 1e-5);
  assert.equal(r.bags, 23);
  assert.equal(model.headline.value, '14 posts, 13 panels');
});

test('fence: pickets, rails and several runs', () => {
  // 1200 in ÷ (3.5 + 1) = 266.67 × 1.05 = exactly 280 (not 281)
  const r = ok(fence, { style: 'pickets' }).result;
  assert.equal(r.pickets, 280);
  assert.equal(r.railCount, 26);
  // 3 runs: 13 + 2 = 15 sections, 18 posts
  const runs = ok(fence, { runs: '3' }).result;
  assert.equal(runs.sections, 15);
  assert.equal(runs.posts, 18);
});

test('deck: boards and screws', () => {
  // 144 in ÷ 5.6875 = 25.32 → 26 rows; 16 ft boards on a 16 ft deck → 26 boards × 1.1 = 28.6 → 29
  // joists 192 ÷ 16 + 1 = 13; screws 26 × 13 × 2 = 676 × 1.1 = 743.6 → 744
  const { result: r } = ok(deck);
  assert.equal(r.rows, 26);
  assert.equal(r.boards, 29);
  assert.equal(r.joists, 13);
  assert.equal(r.screws, 744);
  // 20 ft deck with 16 ft boards: 26 × 1.25 = 32.5 → 33 → × 1.1 = 36.3 → 37
  assert.equal(ok(deck, { length: '20' }).result.boards, 37);
});

test('drywall: walls, openings and ceiling', () => {
  // 352 − 35 + 120 = 437 ft² ÷ 32 = 13.66 × 1.1 = 15.02 → 16 sheets; screws 16 × 32 = 512
  const { result: r, model } = ok(drywall);
  close(fromBase(r.surface, 'area', 'ft2'), 437);
  assert.equal(r.sheets, 16);
  assert.equal(r.screws, 512);
  assert.equal(model.headline.value, '16 sheets');
});

test('lawn: seed and sod', () => {
  // 1,000 ft² × 6 lb/1,000 ft² = 6 lb × 1.05 = 6.3 lb ÷ 5 = 1.26 → 2 bags
  const seed = ok(lawn).result;
  close(fromBase(seed.seedExact, 'mass', 'lb'), 6);
  assert.equal(seed.bags, 2);
  // sod: 1,050 ft² ÷ 10 = 105 rolls; 1,050 ÷ 450 = 2.33 → 3 pallets
  const sod = ok(lawn, { method: 'sod' }).result;
  assert.equal(sod.rolls, 105);
  assert.equal(sod.pallets, 3);
});

test('roofing: pitch in rise-in-12 and degrees agree', () => {
  // 1,200 ft² × √1.25 = 1,341.64 ft² = 13.4164 squares × 1.1 × 3 = 44.27 → 45 bundles
  const { result: r } = ok(roofing);
  close(r.factorSlope, Math.sqrt(1.25));
  assert.equal(r.bundles, 45);
  const deg = ok(roofing, { pitch: String((Math.atan(0.5) * 180) / Math.PI), pitchUnit: 'deg' }).result;
  close(deg.factorSlope, r.factorSlope, 1e-9);
  assert.equal(run(roofing, rawWith(roofing, { pitch: '85', pitchUnit: 'deg' })).ok, false);
  assert.equal(ok(roofing, { pitch: '0' }).result.factorSlope, 1);
});

test('bricks: per-area rates and an exact result', () => {
  // 80 ft² = 11,520 in² ÷ (8 × 2.625 = 21 in²) = 548.57 × 1.05 = exactly 576
  const { result: r } = ok(brick);
  assert.equal(r.bricks, 576);
  // UK: 1 m² ÷ (0.225 × 0.075) = 59.26 per m²
  close(ok(brick, {}, 'metric').result.perArea, 1 / (0.225 * 0.075));
  assert.equal(ok(brick, { wythes: '2' }).result.bricks, 1152);
});

test('pavers: count, base and sand', () => {
  // 17,280 in² ÷ (8.125 × 4.125) = 515.58 × 1.05 = 541.36 → 542
  const { result: r, model } = ok(paver);
  assert.equal(r.pavers, 542);
  close(fromBase(r.base, 'volume', 'ft3'), 40);
  close(fromBase(r.sand, 'volume', 'ft3'), 10);
  const buy = model.sections.find((s) => s.kind === 'buy').rows;
  assert.equal(buy.find((x) => x.label.startsWith('Base')).value, '1.5 yd³');
  assert.equal(buy.find((x) => x.label.startsWith('Bedding')).value, '0.5 yd³');
});

test('insulation: packs, layers and depth for an R-value', () => {
  // 600 ft² ÷ 40 = 15 × 1.05 = 15.75 → 16; two layers → 31.5 → 32
  assert.equal(ok(insulation).result.packs, 16);
  assert.equal(ok(insulation, { layers: '2' }).result.packs, 32);
  close(ok(insulation, { targetR: '38' }).result.depthIn, 38 / 3.2);
});

test('retaining wall: courses, blocks, caps and gravel', () => {
  // 24 in ÷ 4 = 6 + 1 buried = 7 courses; 240 ÷ 12 = 20 per course; 140 × 1.05 = 147; caps 21
  // gravel: base 20 × 2 × 0.5 = 20 ft³ + drain 20 × 2.333 × 1 = 46.67 → 66.67 × 1.05 = 70 ft³ = 2.59 yd³ → 2.75
  const { result: r, model } = ok(retainingWall);
  assert.equal(r.courses, 7);
  assert.equal(r.blocks, 147);
  assert.equal(r.caps, 21);
  close(fromBase(r.gravel, 'volume', 'ft3'), 70);
  assert.equal(model.sections[0].rows.find((x) => x.label.startsWith('Gravel')).value, '2.75 yd³');
});

test('party: pizzas, drinks and ice', () => {
  // 20 × 3 + 5 × 2 = 70 slices × 1.1 ÷ 8 = 9.63 → 10 pizzas
  // drinks 25 × (2 + 2 × 1) = 100 × 1.1 = exactly 110; ice 25 lb × 1.1 ÷ 10 = 2.75 → 3 bags
  const { result: r } = ok(party);
  assert.equal(r.pizzas, 10);
  assert.equal(r.drinks, 110);
  assert.equal(r.iceBags, 3);
  assert.equal(r.napkins, 83);
  assert.equal(run(party, rawWith(party, { adults: '0', kids: '0' })).ok, false);
});

test('pool: shapes, units and fill time', () => {
  // 30 × 15 × 4.75 = 2,137.5 ft³ = 15,989.6 US gal; at 10 gal/min: 1,599 min
  const { result: r, model } = ok(pool);
  close(fromBase(r.volume, 'volume', 'gal'), 2137.5 * 7.480519480519);
  assert.equal(model.headline.value, '15,990 gallons');
  close(r.minutes, (2137.5 * 7.480519480519) / 10, 1e-6);
  // round 18 ft × 4 ft flat: π × 81 × 4 = 1,017.88 ft³
  close(fromBase(ok(pool, { shape: 'round', shallow: '4', deep: '4' }).result.volume, 'volume', 'ft3'), Math.PI * 81 * 4);
  // oval is π/4 of the rectangle
  close(ok(pool, { shape: 'oval' }).result.volume, ok(pool).result.volume * (Math.PI / 4));
});

test('truck: sizes and more than one truck', () => {
  // 4 rooms × 150 = 600 ft³ ÷ 0.85 = 705.9 → 15 ft truck (760)
  assert.equal(ok(truck).model.headline.value, '15 ft truck');
  // 15 rooms × 150 × 1.25 = 2,812.5 ÷ 0.85 = 3,308.8 → 1.97 → 2 × 26 ft
  assert.equal(ok(truck, { bedrooms: '10', otherRooms: '5', stuff: 'full' }).model.headline.value, '2 × 26 ft truck');
});

test('internet: monthly data and speed', () => {
  // daily 9 + 1 + 1.5 + 0.1 + 0.3 + 0.3 = 12.2 GB × 30.4167 + 20 = 391.08 × 1.25 = 488.85 → 489 GB
  // speed 5 + 3 + 4 + 0.5 + 1 = 13.5 × 1.25 = 16.9 → 25 Mbps
  const { result: r, model } = ok(internet);
  close(r.dailyGb, 12.2);
  assert.equal(r.dataPlanGb, 489);
  close(r.peakMbps, 13.5);
  assert.equal(r.tier, 25);
  assert.equal(model.headline.value, '25 Mbps · 489 GB a month');
});

test('extra areas add up and are validated', () => {
  // 15 × 12 + 5 × 4 = 200 ft² × 1.1 = 220 ÷ 20 = exactly 11 boxes
  const r = ok(flooring, { extraAreas: [{ length: [5, 'ft'], width: [4, 'ft'] }] });
  close(fromBase(r.result.floorArea, 'area', 'ft2'), 200);
  assert.equal(r.result.boxes, 11);
  assert.ok(r.model.steps[0].startsWith('Floor area = 15 ft × 12 ft + 5 ft × 4 ft = 200 ft²'));
  // mixed units in the extra area
  close(ok(soil, { extraAreas: [{ length: [1, 'm'], width: [100, 'cm'] }] }).result.surface, 8 * 4 * 0.09290304 + 1);
  // an empty extra area blocks the result with a message naming it
  const v = validate(flooring, rawWith(flooring, { extraAreas: [{ length: ['', 'ft'], width: [4, 'ft'] }] }));
  assert.equal(v.ok, false);
  assert.equal(v.message, 'Enter the area 2 length to see your estimate.');
  assert.equal(validate(flooring, rawWith(flooring, { extraAreas: [{ length: [-2, 'ft'], width: [4, 'ft'] }] })).errors.xa2_length, 'Area 2 length must be more than 0.');
});

test('price adds an estimated cost, and only when entered', () => {
  const none = ok(flooring).model;
  assert.ok(!none.sections.some((s) => s.kind === 'cost'));
  const withPrice = ok(flooring, { price: '45.5' }).model;
  const cost = withPrice.sections.find((s) => s.kind === 'cost');
  assert.equal(cost.rows[0].label, '10 boxes × 45.50');
  assert.equal(cost.rows[0].value, '455.00');
  // paint: US price per gallon applies to gallons bought (8 quarts = 2 gallons)
  assert.equal(ok(paint, { price: '40' }).model.sections.find((s) => s.kind === 'cost').rows[0].value, '80.00');
  // metric price per litre applies to litres of tins
  assert.equal(ok(paint, { price: '10' }, 'metric').model.sections.find((s) => s.kind === 'cost').rows[0].value, '70.00');
  // soil without bags has nothing to price
  assert.ok(!ok(soil, { bagSize: '', price: '5' }).model.sections.some((s) => s.kind === 'cost'));
  assert.equal(validate(flooring, rawWith(flooring, { price: '-1' })).ok, false);
});
