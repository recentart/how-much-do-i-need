import { fmt, fmtUp, ceilTo, fromBase, plural } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, len, area, pct, factor, priceField, COST_GROUP } from './_shared.mjs';

const SQUARE_FT2 = 100; // a roofing "square" covers 100 ft²

export function slopeFactor(pitch, unit) {
  if (unit === 'deg') return 1 / Math.cos((pitch * Math.PI) / 180);
  return Math.sqrt(1 + (pitch / 12) ** 2);
}

export default {
  id: 'roofing',
  slug: 'roofing-calculator',
  name: 'Roofing Shingle Calculator',
  question: 'How many bundles of shingles do I need?',
  category: 'building',
  keywords: 'roof roofing shingles bundles squares asphalt shingles roof pitch slope reroof roof area',
  title: 'Roofing Calculator: How Many Bundles of Shingles Do I Need?',
  description:
    'Free roofing calculator. Enter the house footprint and roof pitch to get the true roof area, roofing squares and bundles of shingles, with a waste allowance.',
  summary: 'Roof area, squares and bundles of shingles from the footprint and pitch.',
  intro:
    'Enter the length and width of the roof as seen from above, including the overhangs, and the roof pitch. The calculator turns that flat footprint into the real sloped area, then into squares and bundles.',
  groups: [
    { id: 'roof', legend: 'Roof' },
    { id: 'shingles', legend: 'Shingles' },
    COST_GROUP,
  ],
  inputs: [
    lengthField('length', 'Roof length (from above, with overhangs)', 40, 12, { group: 'roof' }),
    lengthField('width', 'Roof width (from above, with overhangs)', 30, 9, { group: 'roof' }),
    { name: 'pitch', group: 'roof', type: 'number', label: 'Roof pitch', default: 6, min: 0, max: 89, help: 'Inches of rise per 12 inches of run (e.g. 6 for a 6/12 roof), or degrees.' },
    {
      name: 'pitchUnit',
      group: 'roof',
      type: 'select',
      label: 'Pitch is in',
      default: 'rise12',
      options: [
        { value: 'rise12', label: 'Rise in 12 (e.g. 6/12)' },
        { value: 'deg', label: 'Degrees' },
      ],
    },
    { name: 'bundlesPerSquare', group: 'shingles', type: 'count', label: 'Bundles per square', default: 3, min: 1, max: 10, help: 'Most asphalt shingles are 3 bundles per 100 ft². Check the wrapper.' },
    extraField('waste', 'Waste allowance', 10, 'About 10% for simple gable roofs, 15% or more for hips, valleys and dormers.', { group: 'shingles' }),
    priceField('Price per bundle'),
  ],

  cost: (r) => ({ count: r.bundles, unit: 'bundles' }),

  compute(v) {
    if (v.pitchUnit === 'deg' && v.pitch >= 80) return { error: 'A pitch of 80 degrees or more is a wall, not a roof. Check the pitch.' };
    const footprint = v.length * v.width;
    const factorSlope = slopeFactor(v.pitch, v.pitchUnit);
    const roofArea = footprint * factorSlope;
    const squaresExact = fromBase(roofArea, 'area', 'ft2') / SQUARE_FT2;
    const squaresWithWaste = squaresExact * (1 + v.waste / 100);
    const bundles = ceilTo(squaresWithWaste * v.bundlesPerSquare, 1);
    return { ...v, footprint, factorSlope, roofArea, squaresExact, squaresWithWaste, bundles, squaresBought: bundles / v.bundlesPerSquare };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const pitchText = r.pitchUnit === 'deg' ? `${fmt(r.pitch, 2)}°` : `${fmt(r.pitch, 2)}/12`;
    return {
      headline: {
        label: 'Shingles to buy',
        value: `${fmt(r.bundles, 0)} ${plural(r.bundles, 'bundle')}`,
        detail: `${fmt(r.squaresBought, 2)} squares for a ${area(r.roofArea, s)} roof, including ${pct(r.waste)} waste.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: 'Bundles of shingles', value: fmt(r.bundles, 0), strong: true },
            { label: 'Squares (100 ft² each)', value: fmt(r.squaresBought, 2) },
          ],
        },
        {
          title: 'Calculated quantity (no waste)',
          kind: 'exact',
          rows: [
            { label: 'Footprint', value: area(r.footprint, s) },
            { label: `Slope factor for ${pitchText}`, value: fmt(r.factorSlope, 4) },
            { label: 'Roof area', value: `${area(r.roofArea, s)} (${area(r.roofArea, s === 'metric' ? 'us' : 'metric')})`, strong: true },
            { label: 'Squares', value: fmt(r.squaresExact, 2), strong: true },
          ],
        },
      ],
      steps: [
        `Footprint = ${len(r.length, s)} × ${len(r.width, s)} = ${area(r.footprint, s)}`,
        r.pitchUnit === 'deg'
          ? `Slope factor = 1 ÷ cos(${pitchText}) = ${fmt(r.factorSlope, 4)}`
          : `Slope factor = √(1 + (${fmt(r.pitch, 2)} ÷ 12)²) = ${fmt(r.factorSlope, 4)}`,
        `Roof area = ${area(r.footprint, s)} × ${fmt(r.factorSlope, 4)} = ${area(r.roofArea, s)}`,
        `Squares = ${area(r.roofArea, 'us')} ÷ 100 = ${fmt(r.squaresExact, 2)}; with ${pct(r.waste)} waste × ${factor(r.waste)} = ${fmtUp(r.squaresWithWaste, 2)}`,
        `Bundles = ${fmtUp(r.squaresWithWaste, 2)} × ${r.bundlesPerSquare} per square = ${fmtUp(r.squaresWithWaste * r.bundlesPerSquare, 2)}, rounded up to ${r.bundles}`,
      ],
      notes: [
        'Starter strips, ridge caps, underlayment, drip edge and flashing are extra. Many roofers buy ridge-cap shingles separately.',
        'Roof work is dangerous. Use proper fall protection, or hire a roofer.',
      ],
    };
  },

  content: [
    {
      heading: 'How the roofing calculation works',
      html: `<ol>
  <li><strong>Footprint</strong> = length × width of the roof seen from directly above, including the overhangs.</li>
  <li><strong>Slope factor</strong> = √(1 + (rise ÷ 12)²) for a pitch given as rise in 12, or 1 ÷ cos(angle) for degrees. A 6/12 roof has a factor of 1.118, so it has about 12% more surface than its footprint.</li>
  <li><strong>Roof area</strong> = footprint × slope factor. This works for any roof where every face has the same pitch, including simple gable and hip roofs.</li>
  <li><strong>Squares</strong> = roof area in square feet ÷ 100, plus the waste allowance.</li>
  <li><strong>Bundles</strong> = squares × bundles per square, rounded up.</li>
</ol>`,
    },
    {
      heading: 'Finding your roof pitch',
      html: `<p>Pitch is how many inches the roof rises for every 12 inches it runs horizontally. You can measure it from the attic with a level and tape, or from the ground with a phone app. Common pitches: 4/12 (18.4°), 6/12 (26.6°), 8/12 (33.7°) and 12/12 (45°). If parts of your roof have different pitches, calculate each part separately.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Bundles are rounded <em>up</em> after the waste allowance is added.</li>
  <li>"Squares to buy" is the rounded bundle count ÷ bundles per square.</li>
</ul>`,
    },
  ],
};
