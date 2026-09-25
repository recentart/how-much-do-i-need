import { fmt, fmtUp, ceilTo, plural, fromBase, withUnit } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, area, pct, factor, AREAS, totalArea, areaStep, priceField, COST_GROUP } from './_shared.mjs';

const mass = (kg, s) => withUnit(kg, 'mass', s === 'metric' ? 'kg' : 'lb', (x) => fmt(x, 2));
const rate = (kgm2, s) =>
  s === 'metric' ? `${fmt(fromBase(kgm2, 'seedRate', 'gm2'), 1)} g per m²` : `${fmt(fromBase(kgm2, 'seedRate', 'lb1000'), 2)} lb per 1,000 ft²`;

export default {
  id: 'lawn',
  slug: 'grass-seed-sod-calculator',
  name: 'Grass Seed and Sod Calculator',
  question: 'How much grass seed or sod do I need?',
  category: 'garden',
  keywords: 'grass seed lawn seed sod turf rolls pallets new lawn overseed reseed seeding rate yard garden',
  title: 'Grass Seed and Sod Calculator: How Much Seed or Sod Do I Need?',
  description:
    'Free grass seed and sod calculator. Enter your lawn area to see how many pounds or kilograms of seed and bags, or how many rolls and pallets of sod, to buy.',
  summary: 'Pounds or kilograms of grass seed, or rolls and pallets of sod (turf), for a lawn.',
  intro:
    'Enter the size of the lawn and choose seed or sod. For seed, use the seeding rate on the bag. For sod, use the size of one roll. The calculator adds a margin and rounds up to bags, rolls or pallets.',
  groups: [
    { id: 'area', legend: 'Lawn area' },
    { id: 'product', legend: 'Seed or sod' },
    COST_GROUP,
  ],
  areas: AREAS,
  inputs: [
    lengthField('length', 'Lawn length', 40, 12, { group: 'area' }),
    lengthField('width', 'Lawn width', 25, 8, { group: 'area' }),
    {
      name: 'method',
      group: 'product',
      type: 'select',
      label: 'Seed or sod',
      default: 'seed',
      options: [
        { value: 'seed', label: 'Grass seed' },
        { value: 'sod', label: 'Sod (turf rolls)' },
      ],
    },
    {
      name: 'rate',
      group: 'product',
      type: 'measure',
      dim: 'seedRate',
      units: ['lb1000', 'gm2'],
      label: 'Seeding rate',
      default: { us: [6, 'lb1000'], metric: [30, 'gm2'] },
      help: 'From the bag, and it varies a lot by grass type. Overseeding an existing lawn usually uses about half the new-lawn rate.',
      showIf: (raw) => raw.method === 'seed',
    },
    {
      name: 'bagSize',
      group: 'product',
      type: 'measure',
      dim: 'mass',
      units: ['lb', 'kg'],
      label: 'Seed bag size',
      default: { us: [5, 'lb'], metric: [2, 'kg'] },
      showIf: (raw) => raw.method === 'seed',
    },
    {
      name: 'rollSize',
      group: 'product',
      type: 'measure',
      dim: 'area',
      units: ['ft2', 'm2'],
      label: 'Area of one sod roll',
      default: { us: [10, 'ft2'], metric: [1, 'm2'] },
      help: 'Often 2 × 5 ft (10 ft²) in the US, or 1 m² in the UK.',
      showIf: (raw) => raw.method === 'sod',
    },
    {
      name: 'pallet',
      group: 'product',
      type: 'measure',
      dim: 'area',
      units: ['ft2', 'm2'],
      label: 'Area covered by one pallet',
      optional: true,
      default: { us: [450, 'ft2'], metric: [40, 'm2'] },
      help: 'Ask your supplier. Leave blank to skip pallets.',
      showIf: (raw) => raw.method === 'sod',
    },
    extraField('extra', 'Extra allowance', 5, 'For edges, curves and cuts (sod) or uneven spreading (seed).', { group: 'product' }),
    priceField('Price per bag of seed or roll of sod'),
  ],

  cost: (r) => (r.method === 'seed' ? { count: r.bags, unit: 'bags' } : { count: r.rolls, unit: 'rolls' }),

  compute(v) {
    const lawn = totalArea(v);
    const covered = lawn * (1 + v.extra / 100);
    if (v.method === 'seed') {
      const seedExact = lawn * v.rate;
      const seed = covered * v.rate;
      const bags = ceilTo(seed / v.bagSize, 1);
      return { ...v, lawn, covered, seedExact, seed, bags };
    }
    const rollsExact = lawn / v.rollSize;
    const rolls = ceilTo(covered / v.rollSize, 1);
    const pallets = v.pallet != null ? ceilTo(covered / v.pallet, 1) : null;
    return { ...v, lawn, covered, rollsExact, rolls, pallets };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    if (r.method === 'seed') {
      return {
        headline: {
          label: 'Grass seed to buy',
          value: `${fmt(r.bags, 0)} ${plural(r.bags, 'bag')}`,
          detail: `${mass(r.bagSize, s)} bags: ${mass(r.seed, s)} of seed for ${area(r.lawn, s)}, including ${pct(r.extra)} extra.`,
        },
        sections: [
          {
            title: 'Estimated amount to buy',
            kind: 'buy',
            rows: [
              { label: `Bags (${mass(r.bagSize, s)} each)`, value: fmt(r.bags, 0), strong: true },
              { label: `Seed with ${pct(r.extra)} extra`, value: mass(r.seed, s) },
            ],
          },
          {
            title: 'Calculated quantity (no extra)',
            kind: 'exact',
            rows: [
              { label: 'Lawn area', value: area(r.lawn, s) },
              { label: 'Seed', value: `${mass(r.seedExact, s)} (${mass(r.seedExact, s === 'metric' ? 'us' : 'metric')})`, strong: true },
            ],
          },
        ],
        steps: [
          areaStep(r, s, 'Lawn area'),
          `Seed = ${area(r.lawn, s)} × ${rate(r.rate, s)} = ${mass(r.seedExact, s)}`,
          `With ${pct(r.extra)} extra = ${mass(r.seedExact, s)} × ${factor(r.extra)} = ${mass(r.seed, s)}`,
          `Bags = ${mass(r.seed, s)} ÷ ${mass(r.bagSize, s)} = ${fmtUp(r.seed / r.bagSize, 2)}, rounded up to ${r.bags}`,
        ],
        notes: ['Seeding rates differ widely between grass types, so the rate on your bag matters more than anything else here.'],
      };
    }
    const buyRows = [{ label: `Sod rolls (${area(r.rollSize, s)} each)`, value: fmt(r.rolls, 0), strong: true }];
    if (r.pallets != null) buyRows.push({ label: `Pallets (${area(r.pallet, s)} each)`, value: fmt(r.pallets, 0) });
    const steps = [
      areaStep(r, s, 'Lawn area'),
      `With ${pct(r.extra)} extra = ${area(r.lawn, s)} × ${factor(r.extra)} = ${area(r.covered, s)}`,
      `Rolls = ${area(r.covered, s)} ÷ ${area(r.rollSize, s)} = ${fmtUp(r.covered / r.rollSize, 2)}, rounded up to ${r.rolls}`,
    ];
    if (r.pallets != null) steps.push(`Pallets = ${area(r.covered, s)} ÷ ${area(r.pallet, s)} = ${fmtUp(r.covered / r.pallet, 2)}, rounded up to ${r.pallets}`);
    return {
      headline: {
        label: 'Sod to buy',
        value: `${fmt(r.rolls, 0)} ${plural(r.rolls, 'roll')}`,
        detail: `${area(r.covered, s)} of sod for ${area(r.lawn, s)}${r.pallets != null ? `, or ${r.pallets} ${plural(r.pallets, 'pallet')}` : ''}.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: buyRows },
        {
          title: 'Calculated quantity (no extra)',
          kind: 'exact',
          rows: [
            { label: 'Lawn area', value: area(r.lawn, s), strong: true },
            { label: 'Rolls', value: fmt(r.rollsExact, 2) },
          ],
        },
      ],
      steps,
      notes: ['Lay sod as soon as it arrives. Rolls left stacked can heat up and yellow within a day or two in warm weather.'],
    };
  },

  content: [
    {
      heading: 'How the seed and sod calculation works',
      html: `<ol>
  <li><strong>Lawn area</strong> = length × width. Add more rectangles for L-shaped or irregular lawns.</li>
  <li><strong>Seed</strong> = area × seeding rate, plus the extra. <strong>Bags</strong> = seed ÷ bag size, rounded up.</li>
  <li><strong>Sod</strong>: area plus the extra, ÷ the area of one roll, rounded up. Pallets are worked out the same way.</li>
</ol>
<p>Rates are converted exactly: 1 lb per 1,000 ft² is about 4.9 g per m².</p>`,
    },
    {
      heading: 'Seeding rates',
      html: `<p>How much seed to sow depends mostly on the grass. Fine, small-seeded grasses such as Kentucky bluegrass are sown at low rates (often around 2–3 lb per 1,000 ft²), while coarser grasses such as tall fescue need more (often around 6–8 lb). Mixes fall in between. Overseeding a thin lawn typically uses about half the new-lawn rate. Always follow the rate printed on your bag. The default of 6 lb per 1,000 ft² (about 30 g per m²) is only a starting point.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Bags, rolls and pallets are rounded <em>up</em> after the extra is added.</li>
  <li>The exact seed weight or roll count, before extra and rounding, is shown separately.</li>
</ul>`,
    },
  ],
};
