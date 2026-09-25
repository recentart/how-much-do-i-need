// Regression tests for the defects found in the independent pre-launch review.
// Each case is the reviewer's own reproduction.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, rawWith, validate } from '../src/lib/validate.mjs';
import { ceilTo, fmtUp } from '../src/lib/units.mjs';
import paint from '../src/calculators/paint.mjs';
import flooring from '../src/calculators/flooring.mjs';
import tile from '../src/calculators/tile.mjs';
import concrete from '../src/calculators/concrete.mjs';
import mulch from '../src/calculators/mulch.mjs';
import storage from '../src/calculators/storage.mjs';

const model = (def, o, s = 'us') => {
  const r = run(def, rawWith(def, o, s), s);
  assert.ok(r.ok, r.model.error);
  return r.model;
};

test('fmtUp never shows a value as a smaller whole number', () => {
  assert.equal(fmtUp(6.0025, 2), '6.01');
  assert.equal(fmtUp(9.9, 2), '9.9');
  assert.equal(fmtUp(6, 2), '6');
  assert.equal(fmtUp(86.195, 2), '86.2');
});

test('figures about to be rounded up are never shown as the whole number below', () => {
  const steps = (def, o) => model(def, o).steps.join(' | ');
  assert.match(steps(flooring, { length: '12', width: '11', boxCoverage: ['24.19', 'ft2'] }), /= 6\.01 \|/);
  assert.match(steps(tile, { length: ['61', 'in'], width: ['195', 'in'] }), /= 89\.01, rounded up to 90/);
  assert.match(steps(concrete, { length: '15.5', width: '12.5', depth: ['5', 'in'] }), /= 148\.01, rounded up to 149/);
  const p = model(paint, { length: '7.5', width: '7', height: '8', coverage: ['400', 'ft2gal'] });
  assert.equal(p.headline.value, '1 gallon + 1 quart');
  assert.match(p.headline.detail, /You need 1\.01 gal/);
});

test('flooring "no waste" section really excludes waste', () => {
  const sec = model(flooring, {}).sections.find((s) => s.kind === 'exact');
  assert.ok(!sec.rows.some((r) => /waste/i.test(r.label) && !/no waste/i.test(r.label)));
  assert.equal(sec.rows.find((r) => r.label === 'Boxes with no waste').value, '9');
});

test('paint pluralisation', () => {
  const m = model(paint, { length: ['1', 'm'], width: ['0.8', 'm'], height: ['2.4', 'm'], doors: '1', windows: '0', coats: '1' }, 'metric');
  assert.equal(m.headline.value, '1 litre');
  assert.match(m.headline.detail, /^1 × 1 L tin\./);
  const us = model(paint, { length: '5', width: '4', height: '8' });
  assert.equal(us.headline.value, '3 quarts');
  assert.ok(us.notes.some((n) => n.includes('Buying 1 full gallon instead')));
});

test('tile and concrete working steps use consistent units', () => {
  assert.ok(model(tile, {}).steps.some((s) => s.startsWith('Tiles = 80 ft² (11,520 in²) ÷ 147.02 in²')));
  assert.ok(model(tile, {}, 'metric').steps.some((s) => s.startsWith('Tiles = 7.2 m² (72,000 cm²) ÷ 918.1 cm²')));
  assert.ok(model(concrete, {}).steps.some((s) => s.includes('33.33 ft³ × 1.1 = 36.67 ft³ (1.36 yd³)')));
});

test('storage keeps the free space as a share of the drive', () => {
  // 52 GB must fit a drive with 20% of it free: 52 ÷ 0.8 = 65 GB → 128 GB (a 64 GB drive would be only 18.75% free)
  const r = run(storage, rawWith(storage, { photos: '0', videos: '0', otherFiles: ['52', 'GB'], headroom: '20' }));
  assert.equal(r.result.recommendedGb, 128);
  assert.equal(validate(storage, rawWith(storage, { headroom: '95' })).ok, false);
});

test('storage offers 6 TB, never shows "24 TB" when over the limit, and keeps typed precision', () => {
  assert.equal(model(storage, { photos: '0', videos: '0', otherFiles: ['5.5', 'TB'], headroom: '0' }).headline.value, '6 TB');
  assert.equal(model(storage, { photos: '0', videos: '0', otherFiles: ['19.21', 'TB'], headroom: '20' }).headline.value, '24.02 TB');
  assert.ok(model(storage, { photos: '10000', photoSize: ['2.75', 'MB'], videos: '0' }).steps[0].includes('10,000 × 2.75 MB = 27.5 GB'));
});

test('large counts get thousands separators', () => {
  assert.equal(model(mulch, { length: '1000', width: '100' }).headline.value, '13,125 bags');
});

test('absurdly large inputs are rejected instead of showing Infinity', () => {
  const v = validate(mulch, rawWith(mulch, { length: '1e200' }));
  assert.equal(v.ok, false);
  assert.match(v.errors.length, /can't be more than/);
  // Even at the limits, results stay finite
  const r = run(mulch, rawWith(mulch, { length: [1e6, 'yd'], width: [1e6, 'yd'], depth: [1e6, 'yd'], bagSize: [0.001, 'L'] }));
  assert.ok(!/Infinity|NaN/.test(JSON.stringify(r.model)));
});

test('ceilTo never rounds a huge count down', () => {
  assert.equal(ceilTo(1234567890123.4, 1), 1234567890124);
});
