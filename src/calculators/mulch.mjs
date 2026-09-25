import { fmt, fmtAuto, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import {
  cuYd,
  lengthField,
  depthField,
  extraField,
  systemOf,
  AREAS,
  totalArea,
  areaStep,
  priceField,
  COST_GROUP,
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
  id: 'mulch',
  slug: 'mulch-calculator',
  name: 'Mulch Calculator',
  question: 'How much mulch do I need?',
  category: 'garden',
  keywords: 'mulch bark wood chips garden bed beds landscaping bags cubic yards cubic feet litres depth',
  title: 'Mulch Calculator: How Much Mulch Do I Need? (Bags & Cubic Yards)',
  description:
    'Free mulch calculator. Enter the bed size and mulch depth to get the volume in cubic feet, cubic yards or cubic metres and the number of bags to buy.',
  summary: 'Cubic yards or bags of mulch for a garden bed at the depth you want.',
  intro:
    'Enter the size of the bed and how deep you want the mulch. The calculator works out the volume, adds a small allowance, and tells you how many bags to buy or how much to order in bulk.',
  groups: [
    { id: 'area', legend: 'Area to cover' },
    { id: 'buy', legend: 'Buying' },
    COST_GROUP,
  ],
  areas: AREAS,
  inputs: [
    lengthField('length', 'Area length', 20, 6, { group: 'area' }),
    lengthField('width', 'Area width', 10, 3, { group: 'area' }),
    depthField('depth', 'Mulch depth', 3, 7.5, { group: 'area', help: 'Beds are commonly mulched 2–3 in (5–7.5 cm) deep.' }),
    {
      name: 'bagSize',
      group: 'buy',
      type: 'measure',
      dim: 'volume',
      units: ['ft3', 'L'],
      label: 'Bag size',
      default: { us: [2, 'ft3'], metric: [50, 'L'] },
      help: 'Check the bag. 2 ft³ is a common US size; metric bags are sold in litres.',
    },
    extraField('extra', 'Extra allowance', 5, 'For uneven ground and settling. Set to 0 for the exact amount.', { group: 'buy' }),
    priceField('Price per bag'),
  ],

  cost: (r) => ({ count: r.bags, unit: 'bags' }),

  compute(v) {
    const surface = totalArea(v);
    const vol = surface * v.depth;
    const volWithExtra = vol * (1 + v.extra / 100);
    const bagsExact = volWithExtra / v.bagSize;
    const bags = ceilTo(bagsExact, 1);
    return { ...v, surface, vol, volWithExtra, bagsExact, bags };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const bulk = bulkOrder(r.volWithExtra, s);
    const bagWord = plural(r.bags, 'bag');
    return {
      headline: {
        label: 'Mulch to buy',
        value: `${fmt(r.bags, 0)} ${bagWord}`,
        detail: `${bagText(r.bagSize, s)} bags, or ${bulk.text} in bulk. That covers ${volume(r.volWithExtra, s)} including ${pct(r.extra)} extra.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: `Bags (${bagText(r.bagSize, s)} each)`, value: `${fmt(r.bags, 0)} ${bagWord}`, strong: true },
            { label: 'Or in bulk', value: bulk.text },
            { label: `Volume with ${pct(r.extra)} extra`, value: volume(r.volWithExtra, s) },
          ],
        },
        {
          title: 'Calculated quantity (no extra)',
          kind: 'exact',
          rows: [{ label: 'Area covered', value: area(r.surface, s) }, ...volumeRows(r.vol)],
        },
      ],
      steps: [
        areaStep(r, s),
        `Volume = ${area(r.surface, s)} × ${depth(r.depth, s)} deep = ${volumeSimple(r.vol, s)}${s === 'us' ? ` = ${fmtAuto(cuYd(r.vol))} yd³ (27 ft³ per yd³)` : ''}`,
        `With ${pct(r.extra)} extra = ${volumeSimple(r.vol, s)} × ${factor(r.extra)} = ${volumeSimple(r.volWithExtra, s)}`,
        `Bags = ${bagText(r.volWithExtra, s)} ÷ ${bagText(r.bagSize, s)} per bag = ${fmtUp(r.bagsExact, 2)}, rounded up to ${fmt(r.bags, 0)}`,
        `Bulk = ${bulkNeed(r.volWithExtra, s)}, rounded up to the next quarter ${s === 'metric' ? 'cubic metre' : 'cubic yard'} = ${bulk.text}`,
      ],
      notes: ['Fresh mulch settles and breaks down over a season, so beds are often topped up each year rather than refilled.'],
    };
  },

  content: [
    {
      heading: 'How the mulch calculation works',
      html: `<ol>
  <li><strong>Area</strong> = length × width of the bed.</li>
  <li><strong>Volume</strong> = area × depth, with every measurement converted to the same unit first (3 inches is 0.25 ft; 7.5 cm is 0.075 m).</li>
  <li><strong>Add extra</strong>: volume × (1 + extra ÷ 100).</li>
  <li><strong>Bags</strong> = volume including extra ÷ bag size, rounded up.</li>
</ol>
<p>One cubic yard is 27 cubic feet (3 ft × 3 ft × 3 ft), or about 0.765 m³. One cubic metre is 1,000 litres. So a cubic yard of mulch is about 13.5 bags of 2 ft³.</p>`,
    },
    {
      heading: 'Bags or bulk?',
      html: `<p>Bags are easy to carry and store. For larger areas, mulch delivered loose by the cubic yard (or cubic metre) usually means far fewer trips. Suppliers set their own minimum orders and increments, so the bulk figure here is rounded up to the next quarter unit as a starting point. Check before you order.</p>`,
    },
    {
      heading: 'How deep should mulch be?',
      html: `<p>Garden guides commonly recommend about 2–3 inches (5–7.5 cm) for planting beds, with a little more on paths or where you want to suppress weeds. Deeper isn't always better. Keep mulch pulled back a few inches from plant stems and tree trunks. If you are topping up an existing layer, enter only the depth you are adding.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Bags are rounded <em>up</em> to a whole bag.</li>
  <li>Bulk amounts are rounded <em>up</em> to the next 0.25 yd³ (US) or 0.25 m³ (metric).</li>
  <li>The mathematical volume is shown separately, before any extra or rounding.</li>
</ul>`,
    },
  ],
};
