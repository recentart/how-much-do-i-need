// Unit definitions and number formatting shared by the build and the browser.
// Every dimension has one base unit; `f` is how many base units one of this unit is.
// All factors are exact by definition (international yard and pound, 1959; US gallon = 231 in³).

const IN = 0.0254;
const FT = 0.3048;
const YD = 0.9144;
const FT2 = FT * FT;
const YD2 = YD * YD;
const FT3 = FT * FT * FT;
const YD3 = YD * YD * YD;
const GAL_L = 3.785411784; // litres in one US liquid gallon
const LB = 0.45359237; // kg
const SHORT_TON = 2000 * LB; // kg

export const UNITS = {
  // base: metre
  length: {
    ft: { f: FT, label: 'ft', name: 'feet', system: 'us' },
    in: { f: IN, label: 'in', name: 'inches', system: 'us' },
    yd: { f: YD, label: 'yd', name: 'yards', system: 'us' },
    m: { f: 1, label: 'm', name: 'metres', system: 'metric' },
    cm: { f: 0.01, label: 'cm', name: 'centimetres', system: 'metric' },
    mm: { f: 0.001, label: 'mm', name: 'millimetres', system: 'metric' },
  },
  // base: square metre
  area: {
    ft2: { f: FT2, label: 'ft²', name: 'square feet', system: 'us' },
    yd2: { f: YD2, label: 'yd²', name: 'square yards', system: 'us' },
    m2: { f: 1, label: 'm²', name: 'square metres', system: 'metric' },
  },
  // base: cubic metre
  volume: {
    ft3: { f: FT3, label: 'ft³', name: 'cubic feet', system: 'us' },
    yd3: { f: YD3, label: 'yd³', name: 'cubic yards', system: 'us' },
    gal: { f: GAL_L / 1000, label: 'US gal', name: 'US gallons', system: 'us' },
    qt: { f: GAL_L / 4000, label: 'US qt', name: 'US quarts', system: 'us' },
    m3: { f: 1, label: 'm³', name: 'cubic metres', system: 'metric' },
    L: { f: 0.001, label: 'L', name: 'litres', system: 'metric' },
  },
  // base: square metres covered per litre
  coverage: {
    ft2gal: { f: FT2 / GAL_L, label: 'ft² per gallon', name: 'square feet per US gallon', system: 'us' },
    m2L: { f: 1, label: 'm² per litre', name: 'square metres per litre', system: 'metric' },
  },
  // base: kilograms per cubic metre
  density: {
    tyd3: { f: SHORT_TON / YD3, label: 'tons per yd³', name: 'US tons per cubic yard', system: 'us' },
    lbft3: { f: LB / FT3, label: 'lb per ft³', name: 'pounds per cubic foot', system: 'us' },
    tm3: { f: 1000, label: 'tonnes per m³', name: 'tonnes per cubic metre', system: 'metric' },
    kgm3: { f: 1, label: 'kg per m³', name: 'kilograms per cubic metre', system: 'metric' },
  },
  // base: kilogram
  mass: {
    lb: { f: LB, label: 'lb', name: 'pounds', system: 'us' },
    ton: { f: SHORT_TON, label: 'US tons', name: 'US tons (2,000 lb)', system: 'us' },
    kg: { f: 1, label: 'kg', name: 'kilograms', system: 'metric' },
    t: { f: 1000, label: 'tonnes', name: 'metric tonnes (1,000 kg)', system: 'metric' },
  },
  // base: byte (decimal prefixes, as used by drive and phone makers)
  data: {
    KB: { f: 1e3, label: 'KB', name: 'kilobytes', system: 'any' },
    MB: { f: 1e6, label: 'MB', name: 'megabytes', system: 'any' },
    GB: { f: 1e9, label: 'GB', name: 'gigabytes', system: 'any' },
    TB: { f: 1e12, label: 'TB', name: 'terabytes', system: 'any' },
  },
};

export const LITRES_PER_GALLON = GAL_L;

export function unitInfo(dim, unit) {
  const u = UNITS[dim] && UNITS[dim][unit];
  if (!u) throw new Error(`Unknown unit "${unit}" for ${dim}`);
  return u;
}

export const toBase = (value, dim, unit) => value * unitInfo(dim, unit).f;
export const fromBase = (value, dim, unit) => value / unitInfo(dim, unit).f;
export const convert = (value, dim, from, to) => fromBase(toBase(value, dim, from), dim, to);
export const unitLabel = (dim, unit) => unitInfo(dim, unit).label;

// Round up to a step without floating-point noise pushing an exact value up a whole step
// (e.g. 0.1 * 3 / 0.1 = 3.0000000000000004 must stay 3, not become 4).
export function ceilTo(value, step = 1) {
  const n = Math.max(0, Math.ceil(value / step - 1e-9));
  // Whole steps are already exact; cleaning them would round huge counts to 12 digits (possibly down).
  return Number.isInteger(step) ? n * step : roundClean(n * step);
}

// Remove binary floating-point residue: 0.30000000000000004 -> 0.3
export const roundClean = (x) => Number(x.toPrecision(12));

const nfCache = new Map();
function nf(min, max) {
  const key = `${min}-${max}`;
  if (!nfCache.has(key)) {
    nfCache.set(key, new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }));
  }
  return nfCache.get(key);
}

// Fixed number of decimals at most (trailing zeros dropped unless minDecimals says otherwise).
export function fmt(value, maxDecimals = 2, minDecimals = 0) {
  if (!Number.isFinite(value)) return '–';
  const out = nf(minDecimals, maxDecimals).format(value);
  return out === '-0' ? '0' : out;
}

// For a figure that is about to be rounded up: never let display rounding make it look like a whole
// number it isn't. 6.0025 shows as "6.01" (not "6", which would read as "6, rounded up to 7").
export function fmtUp(value, maxDecimals = 2, minDecimals = 0) {
  if (!Number.isFinite(value)) return '–';
  const p = 10 ** maxDecimals;
  const up = Math.ceil(roundClean(value * p) - 1e-9) / p;
  return fmt(up, maxDecimals, minDecimals);
}

// Precision that suits the size of the number: big numbers need no decimals, small ones need more.
export function fmtAuto(value) {
  const a = Math.abs(value);
  if (a >= 1000) return fmt(value, 0);
  if (a >= 100) return fmt(value, 1);
  if (a >= 1) return fmt(value, 2);
  if (a === 0) return '0';
  return fmt(value, 3);
}

// Format a base-unit value in a display unit, e.g. withUnit(10, 'area', 'ft2') -> "107.64 ft²"
export function withUnit(baseValue, dim, unit, formatter = fmtAuto) {
  return `${formatter(fromBase(baseValue, dim, unit))} ${unitLabel(dim, unit)}`;
}

export function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many;
}
