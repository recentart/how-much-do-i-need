import { fmt, fmtAuto, fmtUp, ceilTo, plural, toBase, withUnit } from '../lib/units.mjs';
import {
  cuFt,
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

// Yields printed on common US premixed concrete bags.
export const BAGS = {
  lb80: { label: '80 lb (36 kg) bag: 0.60 ft³ (17 L)', short: '80 lb', yield: toBase(0.6, 'volume', 'ft3') },
  lb60: { label: '60 lb (27 kg) bag: 0.45 ft³ (12.7 L)', short: '60 lb', yield: toBase(0.45, 'volume', 'ft3') },
  lb40: { label: '40 lb (18 kg) bag: 0.30 ft³ (8.5 L)', short: '40 lb', yield: toBase(0.3, 'volume', 'ft3') },
};

const bagYieldText = (m3, s) => withUnit(m3, 'volume', s === 'metric' ? 'L' : 'ft3');

export default {
  id: 'concrete',
  slug: 'concrete-calculator',
  name: 'Concrete Calculator',
  question: 'How much concrete do I need?',
  category: 'building',
  keywords: 'concrete cement slab patio footing pad driveway walkway pour ready mix readymix bags cubic yards cubic feet cubic metres',
  title: 'Concrete Calculator: How Much Concrete Do I Need? (Yards & Bags)',
  description:
    'Free concrete calculator for slabs, patios and pads. Get cubic yards, cubic feet and cubic metres, plus bags of premix, with an adjustable waste allowance.',
  summary: 'Cubic yards, cubic feet or bags of concrete for a slab, patio or pad.',
  intro:
    'Enter the size and thickness of the slab. The calculator gives the exact volume, adds a waste allowance, and shows the amount to order as ready-mix or as bags of premixed concrete.',
  groups: [
    { id: 'slab', legend: 'Slab size' },
    { id: 'buy', legend: 'Buying' },
  ],
  inputs: [
    lengthField('length', 'Length', 10, 3, { group: 'slab' }),
    lengthField('width', 'Width', 10, 3, { group: 'slab' }),
    depthField('depth', 'Thickness (depth)', 4, 10, { group: 'slab', help: '4 in (10 cm) is common for patios and walkways.' }),
    extraField('extra', 'Waste allowance', 10, 'Covers spillage, uneven ground and forms that bow. 5–10% is common.', { group: 'buy' }),
    {
      name: 'bag',
      group: 'buy',
      type: 'select',
      label: 'Bag size (for bagged concrete)',
      default: 'lb80',
      options: [
        ...Object.entries(BAGS).map(([value, b]) => ({ value, label: b.label })),
        { value: 'custom', label: 'Other: enter the yield from the bag' },
      ],
      wide: true,
    },
    {
      name: 'bagYield',
      group: 'buy',
      type: 'measure',
      dim: 'volume',
      units: ['ft3', 'L'],
      label: 'Yield per bag',
      default: { us: [0.6, 'ft3'], metric: [12, 'L'] },
      help: 'The volume one bag makes once mixed, printed on the bag.',
      showIf: (raw) => raw.bag === 'custom',
    },
  ],

  compute(v) {
    const surface = v.length * v.width;
    const vol = surface * v.depth;
    const volWithExtra = vol * (1 + v.extra / 100);
    const bagYield = v.bag === 'custom' ? v.bagYield : BAGS[v.bag].yield;
    const bagsExact = volWithExtra / bagYield;
    const bags = ceilTo(bagsExact, 1);
    return { ...v, surface, vol, volWithExtra, bagYield, bagsExact, bags };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const order = bulkOrder(r.volWithExtra, s);
    const bagName = r.bag === 'custom' ? `${bagYieldText(r.bagYield, s)} bags` : `${BAGS[r.bag].short} bags`;
    const bagWord = plural(r.bags, 'bag');
    return {
      headline: {
        label: 'Concrete to order',
        value: s === 'metric' ? `${fmt(order.value, 2)} m³` : `${fmt(order.value, 2)} yd³`,
        detail: `Or ${fmt(r.bags, 0)} × ${bagName}. You need ${volume(r.volWithExtra, s)} including ${pct(r.extra)} waste.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: 'Ready-mix order', value: order.text, strong: true },
            { label: `Premixed ${bagName}`, value: `${fmt(r.bags, 0)} ${bagWord}` },
            { label: `Volume with ${pct(r.extra)} waste`, value: `${fmtAuto(cuYd(r.volWithExtra))} yd³ · ${fmtAuto(cuFt(r.volWithExtra))} ft³ · ${fmtAuto(r.volWithExtra)} m³` },
          ],
        },
        { title: 'Calculated volume (no waste)', kind: 'exact', rows: [{ label: 'Slab area', value: area(r.surface, s) }, ...volumeRows(r.vol)] },
      ],
      steps: [
        `Area = ${len(r.length, s)} × ${len(r.width, s)} = ${area(r.surface, s)}`,
        `Volume = ${area(r.surface, s)} × ${depth(r.depth, s)} thick = ${volumeSimple(r.vol, s)}${s === 'us' ? ` = ${fmtAuto(cuYd(r.vol))} yd³ (27 ft³ per yd³)` : ''}`,
        `With ${pct(r.extra)} waste = ${volumeSimple(r.vol, s)} × ${factor(r.extra)} = ${volumeSimple(r.volWithExtra, s)}${s === 'us' ? ` (${fmtAuto(cuYd(r.volWithExtra))} yd³)` : ''}`,
        `Ready-mix = ${bulkNeed(r.volWithExtra, s)}, rounded up to the next quarter ${s === 'metric' ? 'cubic metre' : 'cubic yard'} = ${order.text}`,
        `Bags = ${bagYieldText(r.volWithExtra, s)} ÷ ${bagYieldText(r.bagYield, s)} per bag = ${fmtUp(r.bagsExact, 2)}, rounded up to ${fmt(r.bags, 0)}`,
      ],
      notes: [
        'This is a volume estimate, not a structural design. Slab thickness, base preparation and reinforcement depend on the load and on local building codes.',
      ],
    };
  },

  content: [
    {
      heading: 'How the concrete calculation works',
      html: `<ol>
  <li><strong>Volume</strong> = length × width × thickness, with all three in the same unit (4 inches = 0.333 ft; 10 cm = 0.1 m).</li>
  <li><strong>Cubic yards</strong> = cubic feet ÷ 27. <strong>Cubic metres</strong> = cubic feet × 0.0283.</li>
  <li><strong>Add waste</strong>: volume × (1 + waste ÷ 100).</li>
  <li><strong>Bags</strong> = volume including waste ÷ the yield of one bag, rounded up.</li>
</ol>
<p>For example, a 10 ft × 10 ft slab 4 inches thick is 10 × 10 × 0.333 = 33.3 ft³, or 1.23 yd³. With 10% waste that is 1.36 yd³, so you would order 1.5 yd³ of ready-mix or 62 bags of 80 lb premix.</p>`,
    },
    {
      heading: 'Why add a waste allowance?',
      html: `<p>Running short in the middle of a pour is far worse than having a little left over. Ground that isn't perfectly level, forms that flex outwards, spillage and concrete left in the mixer or wheelbarrow all use extra. 5–10% is a common allowance for simple slabs. Increase it if the sub-base is uneven.</p>`,
    },
    {
      heading: 'Ready-mix or bags?',
      html: `<p>Premixed bags are practical for small jobs like post holes, steps and small pads. The yields used here are those printed on common US bags: about 0.60 ft³ for an 80 lb bag, 0.45 ft³ for 60 lb and 0.30 ft³ for 40 lb. Check your bag, and choose "Other" to enter a different yield. For larger slabs, ordering ready-mixed concrete delivered by truck is usually more practical than mixing dozens of bags. Suppliers often have minimum order sizes.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Ready-mix is rounded <em>up</em> to the next 0.25 yd³ (US) or 0.25 m³ (metric). Your supplier may use different increments.</li>
  <li>Bags are rounded <em>up</em> to a whole bag.</li>
  <li>The exact volume, before waste and rounding, is shown separately in cubic yards, cubic feet, cubic metres and litres.</li>
</ul>`,
    },
  ],
};
