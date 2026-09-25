import { fmt, fmtAuto, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import {
  cuYd,
  lengthField,
  depthField,
  extraField,
  systemOf,
  len,
  area,
  depth,
  volume,
  volumeSimple,
  bulkOrder,
  bulkNeed,
  volumeRows,
  pct,
  factor,
} from './_shared.mjs';

const bagText = (m3, s) => withUnit(m3, 'volume', s === 'metric' ? 'L' : 'ft3', (x) => fmt(x, 2));

export default {
  id: 'soil',
  slug: 'soil-calculator',
  name: 'Soil Calculator',
  question: 'How much soil do I need?',
  category: 'garden',
  keywords: 'soil topsoil garden soil compost raised bed beds planter fill dirt cubic yards cubic feet litres bags',
  title: 'Soil Calculator: How Much Soil Do I Need for a Raised Bed or Garden?',
  description:
    'Free soil calculator for raised beds and gardens. Enter the length, width and depth to get cubic feet, cubic yards or cubic metres, plus how many bags to buy.',
  summary: 'Cubic feet, cubic yards or bags of soil to fill a raised bed or garden bed.',
  intro:
    'Enter the size of the bed and how deep you want to fill it. The calculator works out the volume of soil, adds an allowance for settling, and converts it to bags if you enter a bag size.',
  groups: [
    { id: 'area', legend: 'Bed size' },
    { id: 'buy', legend: 'Buying' },
  ],
  inputs: [
    lengthField('length', 'Bed length', 8, 2.4, { group: 'area' }),
    lengthField('width', 'Bed width', 4, 1.2, { group: 'area' }),
    depthField('depth', 'Soil depth', 12, 30, { group: 'area', help: 'For a raised bed, the depth you plan to fill.' }),
    extraField('extra', 'Extra for settling', 10, 'Loose soil settles once it is watered in. Set to 0 for the exact volume.', {
      group: 'buy',
    }),
    {
      name: 'bagSize',
      group: 'buy',
      type: 'measure',
      dim: 'volume',
      units: ['ft3', 'L'],
      label: 'Bag size',
      optional: true,
      default: { us: [1.5, 'ft3'], metric: [50, 'L'] },
      help: 'Leave blank if you are buying in bulk.',
    },
  ],

  compute(v) {
    const surface = v.length * v.width;
    const vol = surface * v.depth;
    const volWithExtra = vol * (1 + v.extra / 100);
    const hasBags = v.bagSize != null;
    const bagsExact = hasBags ? volWithExtra / v.bagSize : null;
    const bags = hasBags ? ceilTo(bagsExact, 1) : null;
    return { ...v, surface, vol, volWithExtra, hasBags, bagsExact, bags };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const bulk = bulkOrder(r.volWithExtra, s);
    const bagWord = r.hasBags ? plural(r.bags, 'bag') : '';
    const headline = r.hasBags
      ? {
          label: 'Soil to buy',
          value: `${fmt(r.bags, 0)} ${bagWord}`,
          detail: `${bagText(r.bagSize, s)} bags, or ${bulk.text} in bulk. That covers ${volume(r.volWithExtra, s)} including ${pct(r.extra)} extra.`,
        }
      : {
          label: 'Soil to buy',
          value: bulk.text,
          detail: `Covers ${volume(r.volWithExtra, s)} including ${pct(r.extra)} extra for settling.`,
        };

    const buyRows = [];
    if (r.hasBags) buyRows.push({ label: `Bags (${bagText(r.bagSize, s)} each)`, value: `${fmt(r.bags, 0)} ${bagWord}`, strong: true });
    buyRows.push(
      { label: r.hasBags ? 'Or in bulk' : 'In bulk', value: bulk.text, strong: !r.hasBags },
      { label: `Volume with ${pct(r.extra)} extra`, value: volume(r.volWithExtra, s) },
    );

    const steps = [
      `Area = ${len(r.length, s)} × ${len(r.width, s)} = ${area(r.surface, s)}`,
      `Volume = ${area(r.surface, s)} × ${depth(r.depth, s)} deep = ${volumeSimple(r.vol, s)}${s === 'us' ? ` = ${fmtAuto(cuYd(r.vol))} yd³ (27 ft³ per yd³)` : ''}`,
      `With ${pct(r.extra)} extra = ${volumeSimple(r.vol, s)} × ${factor(r.extra)} = ${volumeSimple(r.volWithExtra, s)}`,
    ];
    if (r.hasBags) {
      steps.push(`Bags = ${bagText(r.volWithExtra, s)} ÷ ${bagText(r.bagSize, s)} per bag = ${fmtUp(r.bagsExact, 2)}, rounded up to ${fmt(r.bags, 0)}`);
    }
    steps.push(`Bulk = ${bulkNeed(r.volWithExtra, s)}, rounded up to the next quarter ${s === 'metric' ? 'cubic metre' : 'cubic yard'} = ${bulk.text}`);

    return {
      headline,
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: buyRows },
        { title: 'Calculated quantity (no extra)', kind: 'exact', rows: [{ label: 'Bed area', value: area(r.surface, s) }, ...volumeRows(r.vol)] },
      ],
      steps,
      notes: ['Bagged soil is sold by volume, but the fill in a bag can be compacted or fluffed up. The bag count is a guide, not a guarantee.'],
    };
  },

  content: [
    {
      heading: 'How the soil calculation works',
      html: `<ol>
  <li><strong>Area</strong> = bed length × bed width.</li>
  <li><strong>Volume</strong> = area × depth, with everything in the same unit (12 inches = 1 ft; 30 cm = 0.3 m).</li>
  <li><strong>Add extra for settling</strong>: volume × (1 + extra ÷ 100).</li>
  <li><strong>Bags</strong> (optional) = volume including extra ÷ bag size, rounded up.</li>
</ol>
<p>Conversions used: 1 cubic yard = 27 cubic feet ≈ 0.765 m³; 1 cubic foot ≈ 28.3 litres; 1 m³ = 1,000 litres.</p>`,
    },
    {
      heading: 'Why add extra?',
      html: `<p>Loose soil and compost contain a lot of air. Once they are watered and walked on, they settle, so a bed filled exactly to the top ends up lower than you planned. The default 10% is a moderate allowance. Increase it for very fluffy mixes or deep beds, or set it to 0 to see the exact geometric volume.</p>`,
    },
    {
      heading: 'Filling deep raised beds',
      html: `<p>For very deep beds, some gardeners fill the bottom with other organic material and use bought soil only for the top layer. If you do that, enter only the depth you plan to fill with soil. Many vegetables grow well in 6–12 inches (15–30 cm) of good soil.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Bags are rounded <em>up</em> to a whole bag.</li>
  <li>Bulk amounts are rounded <em>up</em> to the next 0.25 yd³ (US) or 0.25 m³ (metric). Suppliers set their own minimums, so check before ordering.</li>
  <li>The calculated volume is shown separately, before the extra and before rounding.</li>
</ul>`,
    },
  ],
};
