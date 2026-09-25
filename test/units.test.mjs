import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBase, fromBase, convert, ceilTo, fmt, fmtAuto, roundClean } from '../src/lib/units.mjs';

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)), `${actual} is not close to ${expected}`);

test('length conversions use exact definitions', () => {
  close(toBase(1, 'length', 'ft'), 0.3048);
  close(toBase(1, 'length', 'in'), 0.0254);
  close(toBase(1, 'length', 'yd'), 0.9144);
  close(convert(12, 'length', 'in', 'ft'), 1);
  close(convert(3, 'length', 'ft', 'yd'), 1);
  close(convert(100, 'length', 'cm', 'm'), 1);
  close(convert(1, 'length', 'm', 'ft'), 3.280839895);
});

test('area and volume conversions', () => {
  close(convert(1, 'area', 'yd2', 'ft2'), 9);
  close(convert(1, 'area', 'm2', 'ft2'), 10.763910417);
  close(convert(1, 'volume', 'yd3', 'ft3'), 27);
  close(convert(1, 'volume', 'ft3', 'L'), 28.316846592);
  close(convert(1, 'volume', 'gal', 'L'), 3.785411784);
  close(convert(1, 'volume', 'gal', 'qt'), 4);
  close(convert(1, 'volume', 'm3', 'yd3'), 1.307950619);
});

test('coverage, density, mass and data conversions', () => {
  // 350 ft² per US gallon = 350 × 0.09290304 m² ÷ 3.785411784 L = 8.5898354 m² per litre
  close(convert(350, 'coverage', 'ft2gal', 'm2L'), 8.5898354, 1e-7);
  // 1 US ton per cubic yard = 907.18474 kg ÷ 0.764554857984 m³ = 1186.5528 kg/m³ (= 74.07 lb/ft³)
  close(convert(1, 'density', 'tyd3', 'kgm3'), 1186.5528425, 1e-9);
  close(convert(1, 'density', 'tyd3', 'lbft3'), 2000 / 27);
  close(convert(1, 'mass', 'ton', 'lb'), 2000);
  close(convert(1, 'mass', 't', 'kg'), 1000);
  close(convert(1, 'data', 'TB', 'GB'), 1000);
  close(fromBase(1.5e9, 'data', 'GB'), 1.5);
});

test('ceilTo rounds up without floating-point noise', () => {
  assert.equal(ceilTo(3.0000000000000004, 1), 3);
  assert.equal(ceilTo(80 * 1.1, 1), 88); // 88.00000000000001 in floating point
  assert.equal(ceilTo(3.01, 1), 4);
  assert.equal(ceilTo(1.2346, 0.25), 1.25);
  assert.equal(ceilTo(1.25, 0.25), 1.25);
  assert.equal(ceilTo(1.2500001, 0.25), 1.5);
  assert.equal(ceilTo(0.1 + 0.2, 0.1), 0.3);
  assert.equal(ceilTo(0, 1), 0);
  assert.equal(ceilTo(-2, 1), 0);
});

test('number formatting', () => {
  assert.equal(fmt(1234.567, 2), '1,234.57');
  assert.equal(fmt(2, 2), '2');
  assert.equal(fmt(2, 2, 2), '2.00');
  assert.equal(fmt(-0.0001, 2), '0');
  assert.equal(fmt(NaN), '–');
  assert.equal(fmtAuto(1523.4), '1,523');
  assert.equal(fmtAuto(352.46), '352.5');
  assert.equal(fmtAuto(1.23456), '1.23');
  assert.equal(fmtAuto(0.03456), '0.035');
  assert.equal(fmtAuto(0), '0');
  assert.equal(roundClean(0.1 + 0.2), 0.3);
});
