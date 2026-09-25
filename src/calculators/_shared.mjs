// Field factories and display helpers shared by the calculator definitions.

import { fromBase, fmt, fmtAuto, fmtUp, ceilTo, withUnit } from '../lib/units.mjs';

export const LENGTH_UNITS = ['ft', 'in', 'yd', 'm', 'cm'];
export const DEPTH_UNITS = ['in', 'ft', 'cm', 'mm', 'm'];

// Room/area side, e.g. lengthField('length', 'Length', 12, 3.6)
export function lengthField(name, label, us, metric, extra = {}) {
  return {
    name,
    label,
    type: 'measure',
    dim: 'length',
    units: LENGTH_UNITS,
    default: { us: [us, 'ft'], metric: [metric, 'm'] },
    ...extra,
  };
}

// Thickness or depth, defaulting to inches / centimetres.
export function depthField(name, label, usInches, metricCm, extra = {}) {
  return {
    name,
    label,
    type: 'measure',
    dim: 'length',
    units: DEPTH_UNITS,
    default: { us: [usInches, 'in'], metric: [metricCm, 'cm'] },
    ...extra,
  };
}

export function extraField(name, label, value, help, extra = {}) {
  return { name, label, type: 'percent', default: value, min: 0, max: 100, help, ...extra };
}

export const systemOf = (ctx) => (ctx && ctx.system === 'metric' ? 'metric' : 'us');
export const other = (s) => (s === 'metric' ? 'us' : 'metric');

const LEN = { us: 'ft', metric: 'm' };
const AREA = { us: 'ft2', metric: 'm2' };

export const len = (m, s) => withUnit(m, 'length', LEN[s]);
export const area = (m2, s) => withUnit(m2, 'area', AREA[s]);
// Depths read better in inches / centimetres.
export const depth = (m, s) => withUnit(m, 'length', s === 'metric' ? 'cm' : 'in');

export const cuFt = (m3) => fromBase(m3, 'volume', 'ft3');
export const cuYd = (m3) => fromBase(m3, 'volume', 'yd3');
export const litres = (m3) => fromBase(m3, 'volume', 'L');

// "1.48 yd³ (40 ft³)" or "1.13 m³ (1,133 L)"
export function volume(m3, s) {
  if (s === 'metric') return `${fmtAuto(m3)} m³ (${fmt(litres(m3), 0)} L)`;
  return `${fmtAuto(cuYd(m3))} yd³ (${fmtAuto(cuFt(m3))} ft³)`;
}

// The volume shown in the dimension-by-dimension working: ft³ or m³.
export function volumeSimple(m3, s) {
  return s === 'metric' ? `${fmtAuto(m3)} m³` : `${fmtAuto(cuFt(m3))} ft³`;
}

// Loose material sold in bulk is rounded up to the next quarter cubic yard / quarter cubic metre.
export const BULK_STEP = 0.25;
export function bulkOrder(m3, s) {
  if (s === 'metric') return { value: ceilTo(m3, BULK_STEP), unit: 'm³', text: `${fmt(ceilTo(m3, BULK_STEP), 2)} m³` };
  const yd = ceilTo(cuYd(m3), BULK_STEP);
  return { value: yd, unit: 'yd³', text: `${fmt(yd, 2)} yd³` };
}

// The amount about to be rounded up to a bulk order, itself shown rounded up (1.2501 -> "1.26 yd³").
export function bulkNeed(m3, s) {
  return s === 'metric' ? `${fmtUp(m3, 2)} m³` : `${fmtUp(cuYd(m3), 2)} yd³`;
}

export const pct = (p) => `${fmt(p, 2)}%`;
export const factor = (p) => fmt(1 + p / 100, 4);

export function volumeRows(m3) {
  return [
    { label: 'Cubic yards', value: `${fmtAuto(cuYd(m3))} yd³` },
    { label: 'Cubic feet', value: `${fmtAuto(cuFt(m3))} ft³` },
    { label: 'Cubic metres', value: `${fmtAuto(m3)} m³` },
    { label: 'Litres', value: `${fmt(litres(m3), 0)} L` },
  ];
}

// ---- several rectangles added together (main length × width plus "Area 2", "Area 3", …) ----

export const AREAS = { length: 'length', width: 'width' };

export function areaParts(v) {
  return [[v.length, v.width], ...(v.extraAreas || []).map((a) => [a.length, a.width])];
}

export function totalArea(v) {
  return areaParts(v).reduce((sum, [l, w]) => sum + l * w, 0);
}

// "Area = 12 ft × 10 ft + 5 ft × 4 ft = 140 ft²"
export function areaStep(v, s, label = 'Area') {
  const parts = areaParts(v);
  const terms = parts.map(([l, w]) => `${len(l, s)} × ${len(w, s)}`).join(' + ');
  return `${label} = ${terms} = ${area(totalArea(v), s)}`;
}

// ---- optional price ----

export const COST_GROUP = { id: 'cost', legend: 'Cost (optional)' };

export function priceField(label, labelMetric) {
  return {
    name: 'price',
    group: 'cost',
    type: 'money',
    label,
    labelMetric,
    optional: true,
    default: null,
    min: 0,
    help: 'Add the price to see an estimated total.',
  };
}
