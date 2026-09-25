import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import {
  lengthField,
  depthField,
  extraField,
  systemOf,
  area,
  depth,
  volume,
  bulkOrder,
  bulkNeed,
  pct,
  factor,
  AREAS,
  totalArea,
  areaStep,
  priceField,
  COST_GROUP,
} from './_shared.mjs';

const SMALL = ['in', 'mm', 'cm'];
const small = (m, s) => withUnit(m, 'length', s === 'metric' ? 'mm' : 'in', (x) => fmt(x, 3));
const face = (m2, s) => (s === 'metric' ? `${fmt(m2 * 1e4, 1)} cm²` : `${fmt(m2 / 0.00064516, 2)} in²`);

export default {
  id: 'paver',
  slug: 'paver-calculator',
  name: 'Paver Calculator',
  question: 'How many pavers do I need?',
  category: 'garden',
  keywords: 'pavers paving slabs patio blocks block paving walkway driveway base gravel bedding sand joints',
  title: 'Paver Calculator: How Many Pavers, Base Gravel and Sand Do I Need?',
  description:
    'Free paver calculator for patios, paths and driveways. Enter the area and paver size to see how many pavers you need, plus the base gravel and bedding sand.',
  summary: 'Pavers or paving slabs for a patio or path, plus base gravel and bedding sand.',
  intro:
    'Enter the area to pave and the size of one paver. The calculator counts the pavers, allowing for joints and cuts, and works out the compacted base and bedding sand that go underneath.',
  groups: [
    { id: 'area', legend: 'Area to pave' },
    { id: 'paver', legend: 'Pavers' },
    { id: 'base', legend: 'Base and sand' },
    COST_GROUP,
  ],
  areas: AREAS,
  inputs: [
    lengthField('length', 'Area length', 12, 3.6, { group: 'area' }),
    lengthField('width', 'Area width', 10, 3, { group: 'area' }),
    { name: 'paverLength', group: 'paver', type: 'measure', dim: 'length', units: SMALL, label: 'Paver length', default: { us: [8, 'in'], metric: [200, 'mm'] } },
    { name: 'paverWidth', group: 'paver', type: 'measure', dim: 'length', units: SMALL, label: 'Paver width', default: { us: [4, 'in'], metric: [100, 'mm'] } },
    {
      name: 'joint',
      group: 'paver',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Joint width',
      min: 0,
      default: { us: [0.125, 'in'], metric: [3, 'mm'] },
      help: 'Interlocking pavers usually have narrow sand joints of about 1/8 in (3 mm).',
    },
    extraField('waste', 'Waste allowance', 5, 'About 5% for straight edges; 10–15% for curves, borders and herringbone.', { group: 'paver' }),
    depthField('baseDepth', 'Compacted base depth', 4, 10, { group: 'base', min: 0, help: 'Often 4–6 in (10–15 cm) for patios and paths, deeper for driveways. Enter 0 to skip.' }),
    depthField('sandDepth', 'Bedding sand depth', 1, 3, { group: 'base', min: 0, help: 'Usually about 1 in (2.5–3 cm). Enter 0 to skip.' }),
    priceField('Price per paver'),
  ],

  cost: (r) => ({ count: r.pavers, unit: 'pavers' }),

  compute(v) {
    const paved = totalArea(v);
    const cell = (v.paverLength + v.joint) * (v.paverWidth + v.joint);
    const paversExact = paved / cell;
    const pavers = ceilTo(paversExact * (1 + v.waste / 100), 1);
    const base = paved * v.baseDepth;
    const sand = paved * v.sandDepth;
    return { ...v, paved, cell, paversExact, pavers, base, sand };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const buyRows = [{ label: 'Pavers', value: fmt(r.pavers, 0), strong: true }];
    if (r.base > 0) buyRows.push({ label: 'Base gravel (compacted volume)', value: bulkOrder(r.base, s).text });
    if (r.sand > 0) buyRows.push({ label: 'Bedding sand', value: bulkOrder(r.sand, s).text });
    const steps = [
      areaStep(r, s),
      `Space per paver = (${small(r.paverLength, s)} + ${small(r.joint, s)}) × (${small(r.paverWidth, s)} + ${small(r.joint, s)}) = ${face(r.cell, s)}`,
      `Pavers = ${area(r.paved, s)} (${face(r.paved, s)}) ÷ ${face(r.cell, s)} = ${fmt(r.paversExact, 2)}`,
      `With ${pct(r.waste)} waste = ${fmt(r.paversExact, 2)} × ${factor(r.waste)} = ${fmtUp(r.paversExact * (1 + r.waste / 100), 2)}, rounded up to ${r.pavers}`,
    ];
    if (r.base > 0) steps.push(`Base = ${area(r.paved, s)} × ${depth(r.baseDepth, s)} = ${volume(r.base, s)}; ${bulkNeed(r.base, s)} rounded up to ${bulkOrder(r.base, s).text}`);
    if (r.sand > 0) steps.push(`Sand = ${area(r.paved, s)} × ${depth(r.sandDepth, s)} = ${volume(r.sand, s)}; ${bulkNeed(r.sand, s)} rounded up to ${bulkOrder(r.sand, s).text}`);
    return {
      headline: {
        label: 'Pavers to buy',
        value: `${fmt(r.pavers, 0)} ${plural(r.pavers, 'paver')}`,
        detail: `For ${area(r.paved, s)}, including ${pct(r.waste)} waste.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: buyRows },
        {
          title: 'Calculated quantity (no waste)',
          kind: 'exact',
          rows: [
            { label: 'Area to pave', value: area(r.paved, s) },
            { label: 'Pavers', value: fmt(r.paversExact, 2), strong: true },
            ...(r.base > 0 ? [{ label: 'Base volume', value: volume(r.base, s) }] : []),
            ...(r.sand > 0 ? [{ label: 'Sand volume', value: volume(r.sand, s) }] : []),
          ],
        },
      ],
      steps,
      notes: [
        'Base material shrinks when it is compacted, so you need more loose gravel than the compacted volume shown. Ask your supplier how much to order for your compacted depth.',
        'Jointing sand, edge restraints and a weed membrane are extra.',
      ],
    };
  },

  content: [
    {
      heading: 'How the paver calculation works',
      html: `<ol>
  <li><strong>Area</strong> = length × width. Add rectangles for L-shaped patios or paths.</li>
  <li><strong>Space per paver</strong> = (paver length + joint) × (paver width + joint).</li>
  <li><strong>Pavers</strong> = area ÷ space per paver, plus the waste allowance, rounded up.</li>
  <li><strong>Base</strong> and <strong>bedding sand</strong> = area × depth for each layer.</li>
</ol>`,
    },
    {
      heading: 'What goes under pavers',
      html: `<p>Pavers are usually laid on a compacted base of crushed stone, then a thin, level bed of sharp sand. The base spreads the load and drains water, so its depth depends on use and ground conditions: a few inches for a garden path, more for a patio, and more again for a driveway that carries cars. The volumes here are for the finished, compacted layers. Loose material settles when compacted, so order more than the compacted volume.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Pavers are rounded <em>up</em> to whole pavers after the waste allowance. Pavers are often sold by the square foot, metre or pallet, so round up again to your supplier's unit.</li>
  <li>Base and sand are rounded <em>up</em> to the next 0.25 yd³ or 0.25 m³.</li>
</ul>`,
    },
  ],
};
