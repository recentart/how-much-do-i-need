import { fmt, fmtAuto, fmtUp, fromBase, ceilTo, withUnit } from '../lib/units.mjs';
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
  BULK_STEP,
} from './_shared.mjs';

const weight = (kg, s) => (s === 'metric' ? withUnit(kg, 'mass', 't') : withUnit(kg, 'mass', 'ton'));
const densityText = (kgm3, s) =>
  s === 'metric' ? `${fmt(fromBase(kgm3, 'density', 'tm3'), 3)} tonnes per m³` : `${fmt(fromBase(kgm3, 'density', 'tyd3'), 3)} tons per yd³`;

export default {
  id: 'gravel',
  slug: 'gravel-calculator',
  name: 'Gravel Calculator',
  question: 'How much gravel do I need?',
  category: 'garden',
  keywords: 'gravel crushed stone pea gravel rock aggregate driveway path patio base tons tonnes cubic yards weight landscaping',
  title: 'Gravel Calculator: How Much Gravel Do I Need? (Tons & Cubic Yards)',
  description:
    'Free gravel calculator for driveways, paths and beds. Enter the area and depth to get cubic yards or cubic metres and the approximate weight in tons or tonnes.',
  summary: 'Cubic yards and tons (or m³ and tonnes) of gravel for a driveway, path or bed.',
  intro:
    'Enter the area and depth of gravel you want. The calculator works out the volume, then uses a typical density to estimate the weight, which is how gravel is usually sold.',
  groups: [
    { id: 'area', legend: 'Area to cover' },
    { id: 'material', legend: 'Material' },
    COST_GROUP,
  ],
  areas: AREAS,
  inputs: [
    lengthField('length', 'Area length', 30, 9, { group: 'area' }),
    lengthField('width', 'Area width', 10, 3, { group: 'area' }),
    depthField('depth', 'Gravel depth', 3, 7.5, { group: 'area' }),
    {
      name: 'density',
      group: 'material',
      type: 'measure',
      dim: 'density',
      units: ['tyd3', 'lbft3', 'tm3', 'kgm3'],
      label: 'Gravel density',
      default: { us: [1.4, 'tyd3'], metric: [1.66, 'tm3'] },
      help: 'About 1.4 US tons per yd³ (1.66 tonnes per m³) is typical for loose gravel. Your supplier can give the figure for their stone.',
    },
    extraField('extra', 'Extra allowance', 5, 'For uneven ground and spreading. Raise it if you will compact the gravel.', { group: 'material' }),
    priceField('Price per ton', 'Price per tonne'),
  ],

  cost: (r, ctx) => {
    const s = ctx.system === 'metric' ? 'metric' : 'us';
    return { count: ceilTo(fromBase(r.massWithExtra, 'mass', s === 'metric' ? 't' : 'ton'), BULK_STEP), unit: s === 'metric' ? 'tonnes' : 'tons' };
  },

  compute(v) {
    const surface = totalArea(v);
    const vol = surface * v.depth;
    const volWithExtra = vol * (1 + v.extra / 100);
    const mass = vol * v.density; // kg
    const massWithExtra = volWithExtra * v.density;
    return { ...v, surface, vol, volWithExtra, mass, massWithExtra };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const bulk = bulkOrder(r.volWithExtra, s);
    const tonsOrder = ceilTo(fromBase(r.massWithExtra, 'mass', s === 'metric' ? 't' : 'ton'), BULK_STEP);
    const orderUnit = s === 'metric' ? 'tonnes' : 'tons';
    return {
      headline: {
        label: 'Gravel to order',
        value: `${fmt(tonsOrder, 2)} ${orderUnit}`,
        detail: `About ${bulk.text} by volume, including ${pct(r.extra)} extra. The weight depends on the stone.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: 'By weight', value: `${fmt(tonsOrder, 2)} ${orderUnit}`, strong: true },
            { label: 'By volume', value: bulk.text },
            { label: `Weight with ${pct(r.extra)} extra`, value: `${weight(r.massWithExtra, s)} (${fmt(fromBase(r.massWithExtra, 'mass', s === 'metric' ? 'kg' : 'lb'), 0)} ${s === 'metric' ? 'kg' : 'lb'})` },
          ],
        },
        {
          title: 'Calculated quantity (no extra)',
          kind: 'exact',
          rows: [
            { label: 'Area covered', value: area(r.surface, s) },
            ...volumeRows(r.vol),
            { label: 'Weight (US tons)', value: withUnit(r.mass, 'mass', 'ton') },
            { label: 'Weight (tonnes)', value: withUnit(r.mass, 'mass', 't') },
          ],
        },
      ],
      steps: [
        areaStep(r, s),
        `Volume = ${area(r.surface, s)} × ${depth(r.depth, s)} deep = ${volumeSimple(r.vol, s)}${s === 'us' ? ` = ${fmtAuto(cuYd(r.vol))} yd³` : ''}`,
        `With ${pct(r.extra)} extra = ${volume(r.vol, s)} × ${factor(r.extra)} = ${volume(r.volWithExtra, s)}`,
        `Weight = ${s === 'metric' ? `${fmtAuto(r.volWithExtra)} m³` : `${fmtAuto(cuYd(r.volWithExtra))} yd³`} × ${densityText(r.density, s)} = ${weight(r.massWithExtra, s)}`,
        `Order weight = ${fmtUp(fromBase(r.massWithExtra, 'mass', s === 'metric' ? 't' : 'ton'), 2)} ${orderUnit}, rounded up to the next quarter ${s === 'metric' ? 'tonne' : 'ton'} = ${fmt(tonsOrder, 2)} ${orderUnit}`,
        `Order volume = ${bulkNeed(r.volWithExtra, s)}, rounded up to the next quarter ${s === 'metric' ? 'm³' : 'yd³'} = ${bulk.text}`,
      ],
      notes: [
        'A US ton is 2,000 lb (907 kg). A metric tonne is 1,000 kg (2,205 lb).',
        'Density varies with stone type, size and moisture, so the weight is approximate. Ask your supplier how they measure and sell it.',
      ],
    };
  },

  content: [
    {
      heading: 'How the gravel calculation works',
      html: `<ol>
  <li><strong>Area</strong> = length × width.</li>
  <li><strong>Volume</strong> = area × depth, with all measurements in the same unit.</li>
  <li><strong>Add extra</strong>: volume × (1 + extra ÷ 100).</li>
  <li><strong>Weight</strong> = volume × density.</li>
</ol>
<p>Gravel is often sold by weight (tons or tonnes), but you measure the space by volume, so density links the two. The default of 1.4 US tons per cubic yard (about 1,660 kg per m³) is a common planning figure for loose gravel. Real values typically fall somewhere around 1.2–1.5 tons per cubic yard (roughly 1,400–1,800 kg/m³), depending on the stone, its size and how wet it is. If your supplier quotes a density, enter that instead.</p>`,
    },
    {
      heading: 'Choosing a depth',
      html: `<p>The right depth depends on the job. Decorative beds and garden paths are often laid 2–3 inches (5–7.5 cm) deep. Driveways and other surfaces that carry vehicles usually need a deeper, compacted sub-base built up in layers. Follow local guidance or a contractor's specification for those, because the base matters more than the top layer.</p>
<p>Compacting crushed stone reduces its volume, so if you will compact the gravel, allow more than the default extra. Your supplier can advise how much.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>The order weight is rounded <em>up</em> to the next 0.25 ton (US) or 0.25 tonne (metric).</li>
  <li>The order volume is rounded <em>up</em> to the next 0.25 yd³ or 0.25 m³.</li>
  <li>Exact volume and weight, before extra and rounding, are shown separately.</li>
</ul>`,
    },
    {
      heading: 'Useful conversions',
      html: `<ul>
  <li>1 cubic yard = 27 cubic feet ≈ 0.765 m³</li>
  <li>1 US ton = 2,000 lb ≈ 0.907 tonnes</li>
  <li>1 ton per cubic yard ≈ 1,187 kg per m³ ≈ 74 lb per ft³</li>
</ul>`,
    },
  ],
};
