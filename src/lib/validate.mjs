// Turns raw form values into validated numbers in base units.
// Pure (no DOM), so the build, the browser and the tests all share it.
//
// Raw value shapes, keyed by field name:
//   measure:           { text: '12', unit: 'ft', bad: false }
//   count/percent/num: { text: '2', bad: false }
//   select:            'value'
//   checkbox:          true | false
// `bad` is the browser's validity.badInput (text typed into a number box that isn't a number).

import { toBase, fmt } from './units.mjs';

export function fieldDefault(field, system = 'us') {
  if (field.type === 'checkbox') return Boolean(field.default);
  if (field.type === 'select') return field.default;
  if (field.type === 'measure') {
    const d = field.default[system] || field.default.us || field.default.any;
    return { text: String(d[0]), unit: d[1] };
  }
  return { text: field.default == null ? '' : String(field.default) };
}

export function defaultRaw(def, system = 'us') {
  const raw = {};
  for (const f of def.inputs) raw[f.name] = fieldDefault(f, system);
  return raw;
}

export const isVisible = (field, raw) => !field.showIf || Boolean(field.showIf(raw));

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function checkNumber(f, text, bad) {
  const label = f.label;
  if (bad) return { error: `${label} must be a number.` };
  if (text === '') {
    if (f.optional) return { value: null };
    return { error: `Enter the ${lowerFirst(label)}.`, empty: true };
  }
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };

  const min = f.min ?? 0;
  // Measurements must be above zero unless the field says otherwise (a 0 ft room makes no sense).
  const exclusive = f.gt ?? (f.type === 'measure' && f.min === undefined);
  if (exclusive && n <= min) return { error: `${label} must be more than ${fmt(min, 4)}.` };
  if (n < min) return { error: n < 0 ? `${label} can't be negative.` : `${label} must be at least ${fmt(min, 4)}.` };
  // Generous ceilings that still keep every result a finite, printable number.
  const max = f.max ?? { percent: 100, measure: 1e6, count: 1e9 }[f.type];
  if (max !== undefined && n > max) return { error: `${label} can't be more than ${fmt(max, 4)}.` };
  const integer = f.integer ?? f.type === 'count';
  if (integer && !Number.isInteger(n)) return { error: `${label} must be a whole number.` };
  return { value: n };
}

// Returns { ok, values, units, errors, emptyRequired, message }.
// values are in base units (metres, m², m³, m²/L, kg/m³, bytes) for measures; plain numbers otherwise.
export function validate(def, raw) {
  const values = {};
  const units = {};
  const errors = {};
  const emptyRequired = [];
  let message = null;

  for (const f of def.inputs) {
    if (!isVisible(f, raw)) continue;
    const r = raw[f.name];

    if (f.type === 'checkbox') {
      values[f.name] = Boolean(r);
      continue;
    }
    if (f.type === 'select') {
      values[f.name] = f.options.some((o) => o.value === r) ? r : f.default;
      continue;
    }

    const text = r && r.text != null ? String(r.text).trim() : '';
    const res = checkNumber(f, text, Boolean(r && r.bad));
    if (res.error) {
      errors[f.name] = res.error;
      if (res.empty) emptyRequired.push(f.name);
      if (!message) message = res.empty ? `Enter the ${lowerFirst(f.label)} to see your estimate.` : res.error;
      continue;
    }
    if (f.type === 'measure') {
      const unit = f.units.includes(r && r.unit) ? r.unit : fieldDefault(f).unit;
      units[f.name] = unit;
      values[f.name] = res.value === null ? null : toBase(res.value, f.dim, unit);
    } else {
      values[f.name] = res.value;
    }
  }

  return { ok: Object.keys(errors).length === 0, values, units, errors, emptyRequired, message };
}

const TOO_BIG = 'Those numbers are too large to calculate. Check the values you entered.';

// compute + present, with a backstop: a result that isn't a finite number is never shown.
export function calculate(def, values, ctx) {
  const result = def.compute(values, ctx);
  if (result.error) return { ok: false, result, model: { error: result.error } };
  const nonFinite = Object.values(result).some((x) => typeof x === 'number' && !Number.isFinite(x));
  if (nonFinite) return { ok: false, result, model: { error: TOO_BIG } };
  return { ok: true, result, model: def.present(result, ctx) };
}

// Convenience for tests and the build: validate + compute + present in one go.
export function run(def, raw, system = 'us') {
  const v = validate(def, raw);
  if (!v.ok) return { ok: false, validation: v, model: { error: v.message } };
  return { validation: v, ...calculate(def, v.values, { system, units: v.units }) };
}

// Build a raw object from defaults with some fields overridden.
// Overrides: measure -> [value, unit] or value; others -> value.
export function rawWith(def, overrides = {}, system = 'us') {
  const raw = defaultRaw(def, system);
  for (const [name, val] of Object.entries(overrides)) {
    const f = def.inputs.find((x) => x.name === name);
    if (!f) throw new Error(`No field "${name}" in ${def.id}`);
    if (f.type === 'checkbox' || f.type === 'select') raw[name] = val;
    else if (Array.isArray(val)) raw[name] = { text: String(val[0]), unit: val[1] };
    else raw[name] = { ...raw[name], text: val == null ? '' : String(val) };
  }
  return raw;
}
