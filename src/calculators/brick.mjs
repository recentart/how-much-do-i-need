import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, area, pct, factor, AREAS, totalArea, areaStep, priceField, COST_GROUP } from './_shared.mjs';

const SMALL = ['in', 'mm', 'cm'];
const small = (m, s) => withUnit(m, 'length', s === 'metric' ? 'mm' : 'in', (x) => fmt(x, 3));
const face = (m2, s) => (s === 'metric' ? `${fmt(m2 * 1e4, 1)} cm²` : `${fmt(m2 / 0.00064516, 2)} in²`);

export default {
  id: 'brick',
  slug: 'brick-calculator',
  name: 'Brick Calculator',
  question: 'How many bricks do I need?',
  category: 'building',
  keywords: 'bricks brick wall brickwork masonry mortar joints modular brick wythe skin garden wall',
  title: 'Brick Calculator: How Many Bricks Do I Need for a Wall?',
  description:
    'Free brick calculator. Enter the wall size, brick size and mortar joint to see how many bricks you need per square foot or metre, and in total with waste.',
  summary: 'Number of bricks for a wall, allowing for mortar joints and waste.',
  intro:
    'Enter the length and height of the wall, the size of one brick and the mortar joint. The calculator works out how many bricks fill the wall face, multiplies by the number of layers, and adds a waste allowance.',
  groups: [
    { id: 'wall', legend: 'Wall' },
    { id: 'brick', legend: 'Bricks' },
    COST_GROUP,
  ],
  areas: { ...AREAS, widthWord: 'height' },
  inputs: [
    lengthField('length', 'Wall length', 20, 6, { group: 'wall' }),
    lengthField('width', 'Wall height', 4, 1.2, { group: 'wall' }),
    { name: 'wythes', group: 'wall', type: 'count', label: 'Layers of brick (wythes)', default: 1, min: 1, max: 4, help: 'A single-skin garden wall is 1; a solid double-thickness wall is 2.' },
    {
      name: 'brickLength',
      group: 'brick',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Brick length',
      default: { us: [7.625, 'in'], metric: [215, 'mm'] },
      help: 'US modular brick: 7 5/8 in. UK standard: 215 mm.',
    },
    {
      name: 'brickHeight',
      group: 'brick',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Brick height',
      default: { us: [2.25, 'in'], metric: [65, 'mm'] },
    },
    {
      name: 'joint',
      group: 'brick',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Mortar joint',
      min: 0,
      default: { us: [0.375, 'in'], metric: [10, 'mm'] },
      help: 'Usually 3/8 in (0.375 in) or 10 mm.',
    },
    extraField('waste', 'Waste allowance', 5, 'For broken bricks and cuts. 5–10% is common.', { group: 'brick' }),
    priceField('Price per brick'),
  ],

  cost: (r) => ({ count: r.bricks, unit: 'bricks' }),

  compute(v) {
    const wall = totalArea(v);
    const cell = (v.brickLength + v.joint) * (v.brickHeight + v.joint);
    const perArea = 1 / cell;
    const bricksExact = (wall / cell) * v.wythes;
    const bricks = ceilTo(bricksExact * (1 + v.waste / 100), 1);
    return { ...v, wall, cell, perArea, bricksExact, bricks };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const per = s === 'metric' ? `${fmt(r.perArea, 1)} per m²` : `${fmt(r.perArea * 0.09290304, 2)} per ft²`;
    return {
      headline: {
        label: 'Bricks to buy',
        value: `${fmt(r.bricks, 0)} ${plural(r.bricks, 'brick')}`,
        detail: `${per} of wall face, ${r.wythes} ${plural(r.wythes, 'layer')}, including ${pct(r.waste)} waste.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: [{ label: 'Bricks', value: fmt(r.bricks, 0), strong: true }] },
        {
          title: 'Calculated quantity (no waste)',
          kind: 'exact',
          rows: [
            { label: 'Wall face', value: area(r.wall, s) },
            { label: 'Bricks per unit of wall', value: per },
            { label: 'Bricks', value: fmt(r.bricksExact, 2), strong: true },
          ],
        },
      ],
      steps: [
        areaStep(r, s, 'Wall face'),
        `Space per brick = (${small(r.brickLength, s)} + ${small(r.joint, s)}) × (${small(r.brickHeight, s)} + ${small(r.joint, s)}) = ${face(r.cell, s)}, so ${per}`,
        `Bricks = ${area(r.wall, s)} × ${per}${r.wythes > 1 ? ` × ${r.wythes} layers` : ''} = ${fmt(r.bricksExact, 2)}`,
        `With ${pct(r.waste)} waste = ${fmt(r.bricksExact, 2)} × ${factor(r.waste)} = ${fmtUp(r.bricksExact * (1 + r.waste / 100), 2)}, rounded up to ${r.bricks}`,
      ],
      notes: [
        'Openings: subtract windows and doors by adding the wall as several rectangles around them.',
        'Mortar, wall ties, a damp-proof course and foundations are extra. Load-bearing and tall walls need proper design and may need approval.',
      ],
    };
  },

  content: [
    {
      heading: 'How the brick calculation works',
      html: `<ol>
  <li><strong>Wall face</strong> = length × height. Add extra rectangles for walls with steps or piers.</li>
  <li><strong>Space per brick</strong> = (brick length + joint) × (brick height + joint). Each brick takes up its own face plus one joint along its top and one at its end.</li>
  <li><strong>Bricks</strong> = wall face ÷ space per brick × number of layers.</li>
  <li><strong>Add waste</strong> and round up.</li>
</ol>
<p>With UK standard bricks (215 × 65 mm) and 10 mm joints that gives about 59 bricks per m², close to the usual "60 per m²". With US modular bricks (7 5/8 × 2 1/4 in) and 3/8 in joints it gives about 6.9 per ft². Trade tables often quote 6.75, because modular brick courses are designed to rise exactly 8 in every three courses.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Bricks are rounded <em>up</em> to whole bricks after the waste allowance.</li>
  <li>Bricks are often sold in packs or pallets; round up again to your supplier's pack size.</li>
</ul>`,
    },
    {
      heading: 'Before you build',
      html: `<p>A garden wall needs a proper concrete footing below the frost line, and taller or longer walls may need piers, movement joints or reinforcement. Check local building rules before building boundary or retaining walls.</p>`,
    },
  ],
};
