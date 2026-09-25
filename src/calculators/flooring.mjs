import { fmt, fmtUp, ceilTo, plural } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, other, area, pct, factor, AREAS, totalArea, areaStep, priceField, COST_GROUP } from './_shared.mjs';

export default {
  id: 'flooring',
  slug: 'flooring-calculator',
  name: 'Flooring Calculator',
  question: 'How much flooring do I need?',
  category: 'home',
  keywords: 'flooring floor laminate vinyl lvp hardwood engineered wood carpet tiles boxes square feet sq ft sqft square footage square metres area room',
  title: 'Flooring Calculator: How Much Flooring Do I Need? (Boxes & Sq Ft)',
  description:
    'Free flooring calculator for laminate, vinyl and wood. Enter the room size, box coverage and waste to see the square footage and how many boxes to buy.',
  summary: 'Square footage and boxes of laminate, vinyl or wood flooring for a room.',
  intro:
    'Enter the room size and the coverage printed on the flooring box. The calculator works out the floor area, adds a waste allowance for cuts and offcuts, and rounds up to whole boxes.',
  groups: [
    { id: 'room', legend: 'Room size' },
    { id: 'product', legend: 'Flooring' },
    COST_GROUP,
  ],
  areas: AREAS,
  inputs: [
    lengthField('length', 'Room length', 15, 4.5, { group: 'room' }),
    lengthField('width', 'Room width', 12, 3.6, { group: 'room' }),
    {
      name: 'boxCoverage',
      group: 'product',
      type: 'measure',
      dim: 'area',
      units: ['ft2', 'm2'],
      label: 'Coverage per box',
      default: { us: [20, 'ft2'], metric: [2, 'm2'] },
      help: 'Printed on the box or product page, e.g. "20.06 sq ft per carton".',
    },
    extraField(
      'waste',
      'Waste allowance',
      10,
      'About 5–10% for a straight lay in a simple room; more for diagonal or herringbone patterns and rooms with many corners.',
      { group: 'product' },
    ),
    priceField('Price per box'),
  ],

  cost: (r) => ({ count: r.boxes, unit: 'boxes' }),

  compute(v) {
    const floorArea = totalArea(v);
    const areaWithWaste = floorArea * (1 + v.waste / 100);
    const boxesExact = areaWithWaste / v.boxCoverage;
    const boxes = ceilTo(boxesExact, 1);
    const areaBought = boxes * v.boxCoverage;
    return { ...v, floorArea, areaWithWaste, boxesExact, boxes, areaBought, spare: areaBought - floorArea };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const o = other(s);
    const boxWord = plural(r.boxes, 'box', 'boxes');
    return {
      headline: {
        label: 'Flooring to buy',
        value: `${fmt(r.boxes, 0)} ${boxWord}`,
        detail: `${area(r.areaBought, s)} of flooring, for ${area(r.floorArea, s)} of floor plus ${pct(r.waste)} waste.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: 'Boxes', value: `${fmt(r.boxes, 0)} ${boxWord}`, strong: true },
            { label: `Area with ${pct(r.waste)} waste`, value: area(r.areaWithWaste, s) },
            { label: 'Coverage you will buy', value: `${area(r.areaBought, s)} (${area(r.areaBought, o)})` },
            { label: 'Left over after fitting', value: area(r.spare, s) },
          ],
        },
        {
          title: 'Calculated quantity (no waste)',
          kind: 'exact',
          rows: [
            { label: 'Floor area', value: `${area(r.floorArea, s)} (${area(r.floorArea, o)})`, strong: true },
            { label: 'Boxes with no waste', value: fmtUp(r.floorArea / r.boxCoverage, 2) },
          ],
        },
      ],
      steps: [
        areaStep(r, s, 'Floor area'),
        `With ${pct(r.waste)} waste = ${area(r.floorArea, s)} × ${factor(r.waste)} = ${area(r.areaWithWaste, s)}`,
        `Boxes = ${area(r.areaWithWaste, s)} ÷ ${area(r.boxCoverage, s)} per box = ${fmtUp(r.boxesExact, 2)}`,
        `Rounded up to whole boxes = ${fmt(r.boxes, 0)} ${boxWord}`,
      ],
      notes: [
        'For L-shaped or irregular rooms, split the floor into rectangles, work out each one, and add them together.',
      ],
    };
  },

  content: [
    {
      heading: 'How the flooring calculation works',
      html: `<ol>
  <li><strong>Floor area</strong> = room length × room width.</li>
  <li><strong>Add waste</strong>: floor area × (1 + waste ÷ 100). Waste covers the offcuts at the ends of rows, cuts around door frames and pieces with defects.</li>
  <li><strong>Boxes</strong> = area including waste ÷ coverage per box, rounded up to a whole box.</li>
</ol>
<p>Flooring is only sold in whole boxes, so the coverage you buy is almost always a little more than the area including waste. The calculator shows how much will be left over.</p>`,
    },
    {
      heading: 'Choosing a waste percentage',
      html: `<p>These are common rules of thumb. Your installer or the flooring manufacturer may recommend something different.</p>
<ul>
  <li><strong>5–10%</strong>: straight-lay planks or tiles in a simple rectangular room.</li>
  <li><strong>10–15%</strong>: rooms with lots of corners, closets, doorways or pipes, or a diagonal layout.</li>
  <li><strong>15–20%</strong>: herringbone, chevron and other patterned layouts that need many angled cuts.</li>
</ul>
<p>Many people keep a spare box after fitting, so a damaged board can later be replaced with one from the same production batch.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Boxes are always rounded <em>up</em>: 13.2 boxes means buying 14.</li>
  <li>Areas are shown to two decimal places (or fewer for large numbers). Every step uses the full, unrounded figures.</li>
</ul>`,
    },
    {
      heading: 'Measuring the room',
      html: `<p>Measure the longest and widest points of the room, wall to wall. Include the space under anything that is fixed after the floor goes down, such as some kitchen appliances, and exclude areas under fitted cabinets if the floor won't go under them. For rooms that aren't rectangular, split the floor into rectangles, calculate each, and add the results.</p>`,
    },
  ],
};
