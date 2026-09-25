// Known-answer tests. Every expected value below was worked out by hand from the standard
// formula (shown in the comment), independently of the code under test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, rawWith, defaultRaw } from '../src/lib/validate.mjs';
import { fromBase } from '../src/lib/units.mjs';
import { CALCULATORS } from '../src/calculators/index.mjs';
import paint, { bestTins, gallonsQuarts } from '../src/calculators/paint.mjs';
import flooring from '../src/calculators/flooring.mjs';
import mulch from '../src/calculators/mulch.mjs';
import soil from '../src/calculators/soil.mjs';
import gravel from '../src/calculators/gravel.mjs';
import concrete from '../src/calculators/concrete.mjs';
import tile from '../src/calculators/tile.mjs';
import storage from '../src/calculators/storage.mjs';

const close = (actual, expected, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)), `${actual} is not close to ${expected}`);

function ok(def, overrides = {}, system = 'us') {
  const r = run(def, rawWith(def, overrides, system), system);
  assert.ok(r.ok, `${def.id} should succeed but got: ${r.model.error}`);
  return r;
}

// ---------- Paint ----------

test('paint: default US room', () => {
  // walls 2×(12+10)×8 = 352 ft²; minus 1×20 + 2×15 = 50 → 302 ft²
  // 302 × 2 coats ÷ 350 = 1.725714 gal; ×1.10 = 1.898286 gal → 7.59 quarts → 8 quarts = 2 gallons
  const { result: r, model } = ok(paint);
  close(fromBase(r.wallArea, 'area', 'ft2'), 352);
  close(fromBase(r.openings, 'area', 'ft2'), 50);
  close(fromBase(r.surface, 'area', 'ft2'), 302);
  close(r.litresExact / 3.785411784, 1.7257142857);
  close(r.litresWithExtra / 3.785411784, 1.8982857143);
  assert.equal(r.quarts, 8);
  assert.equal(model.headline.value, '2 gallons');
  // 7.186 L → smallest tin total ≥ 7.186 is 7.5 L (5 + 2.5)
  assert.equal(r.tins.total, 7.5);
});

test('paint: ceiling adds length × width', () => {
  // 302 + 120 = 422 ft² × 2 ÷ 350 = 2.411429 × 1.1 = 2.652571 gal → 10.61 → 11 quarts = 2 gal + 3 qt
  const { result: r, model } = ok(paint, { ceiling: true });
  close(fromBase(r.ceilingArea, 'area', 'ft2'), 120);
  assert.equal(r.quarts, 11);
  assert.equal(model.headline.value, '2 gallons + 3 quarts');
  assert.ok(model.notes.some((n) => n.includes('Buying 3 full gallons')));
});

test('paint: metric room', () => {
  // walls 2×(3.6+3)×2.4 = 31.68 m²; minus 1.9 + 2×1.4 = 4.7 → 26.98 m²
  // 26.98 × 2 ÷ 8.6 = 6.274419 L × 1.1 = 6.901860 L → tins: 5 + 1 + 1 = 7 L
  const { result: r, model } = ok(paint, {}, 'metric');
  close(r.surface, 26.98);
  close(r.litresWithExtra, 6.9018604651);
  assert.equal(r.tins.total, 7);
  assert.equal(model.headline.value, '7 litres');
});

test('paint: same room in different units gives the same paint', () => {
  const a = ok(paint, { length: [12, 'ft'], width: [10, 'ft'], height: [8, 'ft'] }).result;
  const b = ok(paint, { length: [144, 'in'], width: [120, 'in'], height: [96, 'in'] }).result;
  const c = ok(paint, { length: [3.6576, 'm'], width: [304.8, 'cm'], height: [2.4384, 'm'] }).result;
  close(a.litresExact, b.litresExact);
  close(a.litresExact, c.litresExact);
});

test('paint: coverage in m² per litre matches ft² per gallon', () => {
  const a = ok(paint, { coverage: [350, 'ft2gal'] }).result;
  const b = ok(paint, { coverage: [8.5898354, 'm2L'] }).result;
  close(a.litresExact, b.litresExact, 1e-5);
});

test('paint: waste percentage scales the purchase, not the exact amount', () => {
  const none = ok(paint, { waste: '0' }).result;
  const twenty = ok(paint, { waste: '20' }).result;
  close(none.litresExact, twenty.litresExact);
  close(twenty.litresWithExtra, none.litresExact * 1.2);
  assert.equal(none.quarts, 7); // 1.7257 gal → 6.9 quarts → 7
});

test('paint: openings larger than the walls is an error, not a negative result', () => {
  const r = run(paint, rawWith(paint, { height: '1' }));
  assert.equal(r.ok, false);
  assert.match(r.model.error, /doors and windows add up to more than the wall area/);
});

test('paint: tin and quart helpers', () => {
  assert.deepEqual(bestTins(0.3).tins, [[1, 1]]);
  assert.equal(bestTins(10).total, 10);
  assert.equal(bestTins(10).count, 1);
  assert.equal(bestTins(12.4).total, 12.5); // 10 + 2.5
  assert.equal(bestTins(47.2).total, 47.5);
  assert.equal(gallonsQuarts(1), '1 quart');
  assert.equal(gallonsQuarts(4), '1 gallon');
  assert.equal(gallonsQuarts(9), '2 gallons + 1 quart');
});

// ---------- Flooring ----------

test('flooring: default US room', () => {
  // 15 × 12 = 180 ft² × 1.1 = 198 ft² ÷ 20 = 9.9 → 10 boxes = 200 ft², 20 ft² spare
  const { result: r, model } = ok(flooring);
  close(fromBase(r.floorArea, 'area', 'ft2'), 180);
  close(fromBase(r.areaWithWaste, 'area', 'ft2'), 198);
  assert.equal(r.boxes, 10);
  close(fromBase(r.spare, 'area', 'ft2'), 20);
  assert.equal(model.headline.value, '10 boxes');
});

test('flooring: an exact fit does not round up an extra box', () => {
  // 10 × 10 = 100 ft², no waste, 20 ft² per box → exactly 5 boxes
  const { result: r } = ok(flooring, { length: '10', width: '10', waste: '0', boxCoverage: [20, 'ft2'] });
  assert.equal(r.boxes, 5);
});

test('flooring: metric room', () => {
  // 4.5 × 3.6 = 16.2 m² × 1.1 = 17.82 ÷ 2 = 8.91 → 9 boxes
  const { result: r } = ok(flooring, {}, 'metric');
  close(r.floorArea, 16.2);
  assert.equal(r.boxes, 9);
});

test('flooring: decimals and waste', () => {
  // 12.5 × 10.25 = 128.125 ft² × 1.15 = 147.34375 ÷ 23.4 = 6.2967 → 7 boxes
  const { result: r } = ok(flooring, { length: '12.5', width: '10.25', waste: '15', boxCoverage: [23.4, 'ft2'] });
  close(fromBase(r.areaWithWaste, 'area', 'ft2'), 147.34375);
  assert.equal(r.boxes, 7);
});

// ---------- Mulch ----------

test('mulch: default US bed', () => {
  // 20 × 10 × 0.25 ft = 50 ft³ (1.851852 yd³); × 1.05 = 52.5 ft³ ÷ 2 = 26.25 → 27 bags
  // bulk: 52.5 ÷ 27 = 1.944 yd³ → 2 yd³
  const { result: r, model } = ok(mulch);
  close(fromBase(r.vol, 'volume', 'ft3'), 50);
  close(fromBase(r.vol, 'volume', 'yd3'), 50 / 27);
  assert.equal(r.bags, 27);
  assert.equal(model.headline.value, '27 bags');
  assert.match(model.headline.detail, /or 2 yd³ in bulk/);
});

test('mulch: metric bed', () => {
  // 6 × 3 × 0.075 = 1.35 m³ × 1.05 = 1.4175 m³ = 1417.5 L ÷ 50 = 28.35 → 29 bags; bulk 1.5 m³
  const { result: r, model } = ok(mulch, {}, 'metric');
  close(r.vol, 1.35);
  assert.equal(r.bags, 29);
  assert.match(model.headline.detail, /1\.5 m³ in bulk/);
});

test('mulch: depth in centimetres with area in feet', () => {
  // 10 ft × 10 ft = 9.290304 m²; × 0.05 m = 0.4645152 m³ = 16.4042 ft³, 0% extra, 3 ft³ bags → 5.47 → 6
  const { result: r } = ok(mulch, { length: '10', width: '10', depth: [5, 'cm'], extra: '0', bagSize: [3, 'ft3'] });
  close(r.vol, 0.4645152);
  assert.equal(r.bags, 6);
});

// ---------- Soil ----------

test('soil: default raised bed with bags', () => {
  // 8 × 4 × 1 ft = 32 ft³ × 1.1 = 35.2 ft³ ÷ 1.5 = 23.47 → 24 bags; bulk 35.2/27 = 1.304 → 1.5 yd³
  const { result: r, model } = ok(soil);
  close(fromBase(r.vol, 'volume', 'ft3'), 32);
  assert.equal(r.bags, 24);
  assert.equal(model.headline.value, '24 bags');
});

test('soil: no bag size gives a bulk answer', () => {
  const { model } = ok(soil, { bagSize: '' });
  assert.equal(model.headline.value, '1.5 yd³');
});

test('soil: metric bed', () => {
  // 2.4 × 1.2 × 0.3 = 0.864 m³ × 1.1 = 0.9504 m³ = 950.4 L ÷ 50 = 19.008 → 20 bags; bulk 1 m³
  const { result: r } = ok(soil, {}, 'metric');
  close(r.vol, 0.864);
  assert.equal(r.bags, 20);
});

// ---------- Gravel ----------

test('gravel: default US area', () => {
  // 30 × 10 × 0.25 = 75 ft³ = 2.777778 yd³ × 1.05 = 2.916667 yd³ × 1.4 t/yd³ = 4.083333 tons → 4.25 tons
  const { result: r, model } = ok(gravel);
  close(fromBase(r.vol, 'volume', 'yd3'), 75 / 27);
  close(fromBase(r.massWithExtra, 'mass', 'ton'), 4.0833333333);
  assert.equal(model.headline.value, '4.25 tons');
  assert.match(model.headline.detail, /About 3 yd³/);
});

test('gravel: metric area', () => {
  // 9 × 3 × 0.075 = 2.025 m³ × 1.05 = 2.12625 m³ × 1.66 t/m³ = 3.529575 t → 3.75 tonnes
  const { result: r, model } = ok(gravel, {}, 'metric');
  close(r.vol, 2.025);
  close(fromBase(r.massWithExtra, 'mass', 't'), 3.529575);
  assert.equal(model.headline.value, '3.75 tonnes');
});

test('gravel: density in lb per ft³', () => {
  // 100 ft³ at 100 lb/ft³, no extra = 10,000 lb = 5 US tons exactly
  const { result: r, model } = ok(gravel, { length: '10', width: '10', depth: [1, 'ft'], extra: '0', density: [100, 'lbft3'] });
  close(fromBase(r.massWithExtra, 'mass', 'lb'), 10000);
  assert.equal(model.headline.value, '5 tons');
});

// ---------- Concrete ----------

test('concrete: default 10 × 10 ft slab, 4 in thick', () => {
  // 10 × 10 × 1/3 = 33.333 ft³ = 1.234568 yd³; × 1.1 = 1.358025 yd³ → 1.5 yd³
  // bags: 36.6667 ft³ ÷ 0.6 = 61.11 → 62 × 80 lb
  const { result: r, model } = ok(concrete);
  close(fromBase(r.vol, 'volume', 'ft3'), 100 / 3);
  close(fromBase(r.vol, 'volume', 'yd3'), 100 / 81);
  assert.equal(r.bags, 62);
  assert.equal(model.headline.value, '1.5 yd³');
});

test('concrete: other bag sizes', () => {
  assert.equal(ok(concrete, { bag: 'lb60' }).result.bags, 82); // 36.667 ÷ 0.45 = 81.48
  assert.equal(ok(concrete, { bag: 'lb40' }).result.bags, 123); // 36.667 ÷ 0.30 = 122.2
  assert.equal(ok(concrete, { bag: 'custom', bagYield: [0.5, 'ft3'] }).result.bags, 74); // 73.33
});

test('concrete: metric slab', () => {
  // 3 × 3 × 0.1 = 0.9 m³ × 1.1 = 0.99 m³ → 1 m³; bags 0.99 ÷ 0.016990 = 58.27 → 59
  const { result: r, model } = ok(concrete, {}, 'metric');
  close(r.vol, 0.9);
  assert.equal(r.bags, 59);
  assert.equal(model.headline.value, '1 m³');
});

test('concrete: waste of zero keeps the exact volume', () => {
  // 27 ft³ exactly = 1 yd³ → order stays at 1 yd³
  const { model } = ok(concrete, { length: '9', width: '9', depth: [4, 'in'], extra: '0' });
  assert.equal(model.headline.value, '1 yd³');
});

// ---------- Tile ----------

test('tile: default 10 × 8 ft floor, 12 in tiles, 1/8 in joints', () => {
  // 80 ft² = 11,520 in² ÷ (12.125²) = 147.015625 in² → 78.36 tiles × 1.1 = 86.195 → 87 tiles; 10 per box → 9 boxes
  const { result: r, model } = ok(tile);
  close(r.tilesExact, 11520 / 147.015625);
  assert.equal(r.tiles, 87);
  assert.equal(r.boxes, 9);
  assert.equal(model.headline.value, '9 boxes');
});

test('tile: no joints and an exact fit', () => {
  // 11,520 ÷ 144 = 80 exactly; × 1.1 = 88 (not 89)
  const { result: r } = ok(tile, { joint: '0' });
  assert.equal(r.tiles, 88);
});

test('tile: no box size gives a tile count', () => {
  const { model } = ok(tile, { perBox: '' });
  assert.equal(model.headline.value, '87 tiles');
});

test('tile: metric floor', () => {
  // 3 × 2.4 = 7.2 m² ÷ (0.303 × 0.303 = 0.091809) = 78.424 × 1.1 = 86.27 → 87 tiles
  const { result: r } = ok(tile, {}, 'metric');
  assert.equal(r.tiles, 87);
});

test('tile: rectangular tiles in mixed units', () => {
  // 2 m × 1 m = 2 m²; tiles 60 × 30 cm with 2 mm joints: 0.602 × 0.302 = 0.181804 m² → 11.0009 → 10% → 12.1 → 13
  const { result: r } = ok(tile, {
    length: [2, 'm'],
    width: [100, 'cm'],
    tileLength: [60, 'cm'],
    tileWidth: [300, 'mm'],
    joint: [2, 'mm'],
  });
  close(r.tilesExact, 2 / 0.181804);
  assert.equal(r.tiles, 13);
});

// ---------- Storage ----------

test('storage: default library', () => {
  // 5000 × 3 MB = 15 GB; 100 × 150 MB = 15 GB; total 30 GB; keeping 20% of the drive free: 30 ÷ 0.8 = 37.5 GB → 64 GB
  const { result: r, model } = ok(storage);
  close(r.total, 30e9);
  close(r.needed, 37.5e9);
  assert.equal(r.recommendedGb, 64);
  assert.equal(model.headline.value, '64 GB');
});

test('storage: units and a result landing exactly on a size', () => {
  // 1,000 photos × 128 MB = 128 GB, no headroom → exactly 128 GB
  const { result: r } = ok(storage, { photos: '1000', photoSize: [128, 'MB'], videos: '0', headroom: '0' });
  assert.equal(r.recommendedGb, 128);
  // 2 TB of other files with 10% of the drive free = 2 ÷ 0.9 = 2.22 TB → 4 TB
  const big = ok(storage, { photos: '0', videos: '0', otherFiles: [2, 'TB'], headroom: '10' });
  assert.equal(big.result.recommendedGb, 4000);
  assert.equal(big.model.headline.value, '4 TB');
});

test('storage: nothing entered is an error, not zero', () => {
  const r = run(storage, rawWith(storage, { photos: '0', videos: '0', songs: '0', otherFiles: [0, 'GB'] }));
  assert.equal(r.ok, false);
  assert.match(r.model.error, /at least one photo/);
});

test('storage: more than the largest standard size', () => {
  const { result: r, model } = ok(storage, { photos: '0', videos: '0', otherFiles: [30, 'TB'] });
  assert.equal(r.recommendedGb, null);
  assert.equal(model.headline.value, '37.5 TB'); // 30 ÷ 0.8
});

// ---------- All calculators ----------

// Small deterministic pseudo-random generator so the fuzz test is repeatable.
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test('no calculator ever shows NaN, Infinity or undefined', () => {
  const rand = prng(42);
  const bad = /NaN|Infinity|undefined|null|\[object/;
  for (const def of CALCULATORS) {
    for (let i = 0; i < 300; i++) {
      const system = rand() < 0.5 ? 'us' : 'metric';
      const raw = defaultRaw(def, system);
      for (const f of def.inputs) {
        if (f.type === 'checkbox') raw[f.name] = rand() < 0.5;
        else if (f.type === 'select') raw[f.name] = f.options[Math.floor(rand() * f.options.length)].value;
        else {
          const pick = rand();
          let text;
          if (pick < 0.05) text = '';
          else if (pick < 0.1) text = '0';
          else if (pick < 0.15) text = '-3';
          else if (pick < 0.2) text = '1e6';
          else if (f.type === 'count') text = String(Math.floor(rand() * 50));
          else if (f.type === 'percent') text = String(Math.round(rand() * 1000) / 10);
          else text = String(Math.round(rand() * 5000) / 100);
          raw[f.name] = { ...raw[f.name], text };
          if (f.type === 'measure') raw[f.name].unit = f.units[Math.floor(rand() * f.units.length)];
        }
      }
      const r = run(def, raw, system);
      const text = JSON.stringify(r.model);
      if (bad.test(text)) assert.fail(`${def.id} showed ${text.match(bad)[0]} for ${JSON.stringify(raw)}`);
      if (r.ok) {
        assert.ok(r.model.headline && r.model.headline.value, `${def.id} missing headline`);
        assert.ok(r.model.sections.some((s) => s.kind === 'buy'), `${def.id} missing buy section`);
        assert.ok(r.model.sections.some((s) => s.kind === 'exact'), `${def.id} missing exact section`);
      } else {
        assert.ok(r.model.error, `${def.id} failed without a message`);
      }
    }
  }
});

test('every calculator has the page content it needs', () => {
  const ids = new Set();
  for (const def of CALCULATORS) {
    assert.ok(!ids.has(def.id), `duplicate id ${def.id}`);
    ids.add(def.id);
    for (const key of ['id', 'slug', 'name', 'question', 'category', 'keywords', 'title', 'description', 'summary', 'intro']) {
      assert.ok(typeof def[key] === 'string' && def[key].length, `${def.id} missing ${key}`);
    }
    assert.match(def.slug, /^[a-z0-9-]+$/);
    assert.ok(def.content.length >= 3, `${def.id} needs explanatory content`);
    assert.ok(def.content.some((s) => /rounding/i.test(s.heading)), `${def.id} must explain its rounding`);
    assert.ok(def.content.some((s) => /how .* works/i.test(s.heading)), `${def.id} must explain its formula`);
  }
});
