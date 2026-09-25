import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, rawWith, run, defaultRaw } from '../src/lib/validate.mjs';
import { CALCULATORS } from '../src/calculators/index.mjs';
import paint from '../src/calculators/paint.mjs';
import soil from '../src/calculators/soil.mjs';
import concrete from '../src/calculators/concrete.mjs';
import tile from '../src/calculators/tile.mjs';

test('every calculator produces a result from its defaults in both unit systems', () => {
  for (const def of CALCULATORS) {
    for (const system of ['us', 'metric']) {
      const r = run(def, defaultRaw(def, system), system);
      assert.ok(r.ok, `${def.id} (${system}) failed: ${r.model.error}`);
    }
  }
});

test('empty required field blocks the result with a helpful message', () => {
  const v = validate(paint, rawWith(paint, { length: '' }));
  assert.equal(v.ok, false);
  assert.deepEqual(v.emptyRequired, ['length']);
  assert.equal(v.message, 'Enter the room length to see your estimate.');
  assert.equal(v.errors.length, 'Enter the room length.');
});

test('whitespace-only input counts as empty', () => {
  const v = validate(paint, rawWith(paint, { width: '   ' }));
  assert.equal(v.ok, false);
  assert.deepEqual(v.emptyRequired, ['width']);
});

test('zero and negative measurements are rejected', () => {
  assert.equal(validate(paint, rawWith(paint, { length: '0' })).errors.length, 'Room length must be more than 0.');
  assert.equal(validate(paint, rawWith(paint, { length: '-5' })).errors.length, 'Room length must be more than 0.');
  assert.equal(validate(paint, rawWith(paint, { doors: '-1' })).errors.doors, "Number of doors can't be negative.");
  assert.equal(validate(paint, rawWith(paint, { coats: '0' })).errors.coats, 'Number of coats must be at least 1.');
});

test('zero is allowed where it makes sense', () => {
  assert.ok(validate(paint, rawWith(paint, { doors: '0', windows: '0' })).ok);
  assert.ok(validate(paint, rawWith(paint, { waste: '0' })).ok);
  assert.ok(validate(paint, rawWith(paint, { doorArea: [0, 'ft2'] })).ok);
  assert.ok(validate(tile, rawWith(tile, { joint: '0' })).ok);
});

test('non-numbers and bad browser input are rejected', () => {
  assert.equal(validate(paint, rawWith(paint, { length: 'abc' })).errors.length, 'Room length must be a number.');
  const raw = rawWith(paint);
  raw.length = { text: '', unit: 'ft', bad: true };
  assert.equal(validate(paint, raw).errors.length, 'Room length must be a number.');
});

test('decimals are accepted for measurements, not for counts', () => {
  const v = validate(paint, rawWith(paint, { length: '12.75', height: '.5' }));
  assert.ok(v.ok);
  assert.ok(Math.abs(v.values.length - 12.75 * 0.3048) < 1e-12);
  assert.equal(validate(paint, rawWith(paint, { doors: '1.5' })).errors.doors, 'Number of doors must be a whole number.');
});

test('percentages are capped at 100', () => {
  assert.equal(validate(paint, rawWith(paint, { waste: '150' })).errors.waste, "Extra for waste and touch-ups can't be more than 100.");
  assert.ok(validate(paint, rawWith(paint, { waste: '100' })).ok);
});

test('optional fields may be left empty', () => {
  const r = run(soil, rawWith(soil, { bagSize: '' }));
  assert.ok(r.ok);
  assert.equal(r.result.hasBags, false);
});

test('hidden fields are not validated', () => {
  // The custom bag yield only shows when "Other" is chosen.
  assert.ok(validate(concrete, rawWith(concrete, { bag: 'lb80', bagYield: 'nonsense' })).ok);
  assert.equal(validate(concrete, rawWith(concrete, { bag: 'custom', bagYield: '' })).ok, false);
});

test('unknown select values fall back to the default', () => {
  const v = validate(concrete, rawWith(concrete, { bag: 'not-a-bag' }));
  assert.equal(v.values.bag, 'lb80');
});

test('unit values are converted to base units', () => {
  const v = validate(paint, rawWith(paint, { length: [3, 'm'], width: [300, 'cm'], height: [96, 'in'] }));
  assert.ok(Math.abs(v.values.length - 3) < 1e-12);
  assert.ok(Math.abs(v.values.width - 3) < 1e-12);
  assert.ok(Math.abs(v.values.height - 2.4384) < 1e-12);
});
