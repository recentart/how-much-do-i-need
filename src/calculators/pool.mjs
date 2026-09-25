import { fmt, fromBase, withUnit } from '../lib/units.mjs';
import { lengthField, depthField, extraField, systemOf, len, depth, pct, priceField, COST_GROUP } from './_shared.mjs';

const IMPERIAL_GALLON_L = 4.54609;
const gallons = (m3) => fromBase(m3, 'volume', 'gal');
const litresOf = (m3) => m3 * 1000;
const bigVolume = (m3, s) => (s === 'metric' ? `${fmt(litresOf(m3), 0)} litres` : `${fmt(gallons(m3), 0)} gallons`);

export default {
  id: 'pool',
  slug: 'pool-volume-calculator',
  name: 'Pool and Water Tank Volume Calculator',
  question: 'How much water does my pool hold?',
  category: 'garden',
  keywords: 'pool volume gallons litres swimming pool hot tub pond water tank fill time how much water above ground round oval rectangular',
  title: 'Pool Volume Calculator: How Many Gallons or Litres to Fill It?',
  description:
    'Free pool volume calculator for rectangular, round and oval pools, ponds and tanks. Get gallons, litres and cubic metres, plus how long it takes to fill.',
  summary: 'Gallons or litres of water in a pool, pond or tank, and how long it takes to fill.',
  intro:
    'Choose the shape, enter the size and the depth at the shallow and deep ends. The calculator works out the volume of water, shows it in every common unit and, if you add your hose flow rate, how long it will take to fill.',
  groups: [
    { id: 'shape', legend: 'Shape and size' },
    { id: 'fill', legend: 'Filling' },
    COST_GROUP,
  ],
  inputs: [
    {
      name: 'shape',
      group: 'shape',
      type: 'select',
      label: 'Shape',
      default: 'rect',
      options: [
        { value: 'rect', label: 'Rectangle or square' },
        { value: 'round', label: 'Round' },
        { value: 'oval', label: 'Oval' },
      ],
    },
    lengthField('length', 'Length', 30, 9, { group: 'shape', showIf: (raw) => raw.shape !== 'round' }),
    lengthField('width', 'Width', 15, 4.5, { group: 'shape', showIf: (raw) => raw.shape !== 'round' }),
    lengthField('diameter', 'Diameter', 18, 5.5, { group: 'shape', showIf: (raw) => raw.shape === 'round' }),
    lengthField('shallow', 'Water depth at the shallow end', 3.5, 1, { group: 'shape' }),
    lengthField('deep', 'Water depth at the deep end', 6, 1.8, { group: 'shape', help: 'Enter the same depth twice if the floor is flat.' }),
    extraField('fill', 'Fill level', 100, 'How full, as a percentage of the depths above. Leave at 100% if you measured the water depth.', { group: 'fill', min: 1 }),
    {
      name: 'flow',
      group: 'fill',
      type: 'measure',
      dim: 'flow',
      units: ['gpm', 'Lmin'],
      label: 'Hose or pump flow rate',
      optional: true,
      default: { us: [10, 'gpm'], metric: [38, 'Lmin'] },
      help: 'Time how long your hose takes to fill a bucket. Leave blank to skip the fill time.',
    },
    priceField('Water price per 1,000 gallons', 'Water price per cubic metre'),
  ],

  cost: (r, ctx) => (ctx.system === 'metric' ? { count: r.volume, unit: 'm³' } : { count: gallons(r.volume) / 1000, unit: 'thousand gallons' }),

  compute(v) {
    const avgDepth = (v.shallow + v.deep) / 2;
    let surface;
    if (v.shape === 'round') surface = Math.PI * (v.diameter / 2) ** 2;
    else if (v.shape === 'oval') surface = Math.PI * (v.length / 2) * (v.width / 2);
    else surface = v.length * v.width;
    const full = surface * avgDepth;
    const volume = full * (v.fill / 100);
    const minutes = v.flow != null ? litresOf(volume) / v.flow : null; // flow is litres per minute
    return { ...v, avgDepth, surface, full, volume, minutes };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const shapeStep =
      r.shape === 'round'
        ? `Surface = π × (${len(r.diameter, s)} ÷ 2)² = ${withUnit(r.surface, 'area', s === 'metric' ? 'm2' : 'ft2')}`
        : r.shape === 'oval'
          ? `Surface = π × (${len(r.length, s)} ÷ 2) × (${len(r.width, s)} ÷ 2) = ${withUnit(r.surface, 'area', s === 'metric' ? 'm2' : 'ft2')}`
          : `Surface = ${len(r.length, s)} × ${len(r.width, s)} = ${withUnit(r.surface, 'area', s === 'metric' ? 'm2' : 'ft2')}`;
    const vol = (m3) => (s === 'metric' ? `${fmt(m3, 2)} m³` : `${fmt(fromBase(m3, 'volume', 'ft3'), 1)} ft³`);
    const steps = [
      shapeStep,
      `Average depth = (${len(r.shallow, s)} + ${len(r.deep, s)}) ÷ 2 = ${len(r.avgDepth, s)}`,
      `Volume = surface × average depth = ${vol(r.full)}${r.fill !== 100 ? ` × ${pct(r.fill)} full = ${vol(r.volume)}` : ''}`,
      s === 'metric'
        ? `${vol(r.volume)} × 1,000 litres per m³ = ${bigVolume(r.volume, s)}`
        : `${vol(r.volume)} × 7.48 gallons per ft³ = ${bigVolume(r.volume, s)}`,
    ];
    const buyRows = [{ label: 'Water to fill', value: bigVolume(r.volume, s), strong: true }];
    if (r.minutes != null) {
      const hours = r.minutes / 60;
      buyRows.push({ label: 'Time to fill', value: hours >= 1 ? `${fmt(hours, 1)} hours` : `${fmt(r.minutes, 0)} minutes` });
      steps.push(
        `Fill time = ${bigVolume(r.volume, s)} ÷ ${withUnit(r.flow, 'flow', s === 'metric' ? 'Lmin' : 'gpm', (x) => fmt(x, 2))} = ${fmt(r.minutes, 0)} minutes (${fmt(r.minutes / 60, 1)} hours)`,
      );
    }
    return {
      headline: {
        label: 'Water volume',
        value: bigVolume(r.volume, s),
        detail: `${s === 'metric' ? `${fmt(gallons(r.volume), 0)} US gallons` : `${fmt(litresOf(r.volume), 0)} litres`}${r.minutes != null ? `. About ${fmt(r.minutes / 60, 1)} hours to fill.` : '.'}`,
      },
      sections: [
        { title: 'Estimated amount needed', kind: 'buy', rows: buyRows },
        {
          title: 'Calculated volume',
          kind: 'exact',
          rows: [
            { label: 'US gallons', value: fmt(gallons(r.volume), 0), strong: s === 'us' },
            { label: 'Imperial (UK) gallons', value: fmt(litresOf(r.volume) / IMPERIAL_GALLON_L, 0) },
            { label: 'Litres', value: fmt(litresOf(r.volume), 0), strong: s === 'metric' },
            { label: 'Cubic metres', value: fmt(r.volume, 2) },
            { label: 'Cubic feet', value: fmt(fromBase(r.volume, 'volume', 'ft3'), 1) },
            { label: 'Average depth', value: `${depth(r.avgDepth, s)}` },
          ],
        },
      ],
      steps,
      notes: [
        'Water weighs about 8.34 lb per US gallon (1 kg per litre). Check that a raised deck or indoor floor can carry a hot tub or tank before filling it.',
        'Pool chemical doses are based on this volume, so a close estimate matters. Follow the product label.',
      ],
    };
  },

  content: [
    {
      heading: 'How the pool volume calculation works',
      html: `<ol>
  <li><strong>Surface area</strong>: rectangle = length × width; round = π × radius²; oval = π × (length ÷ 2) × (width ÷ 2).</li>
  <li><strong>Average depth</strong> = (shallow end + deep end) ÷ 2. For a pool with a flat floor, both depths are the same.</li>
  <li><strong>Volume</strong> = surface area × average depth × fill level.</li>
  <li><strong>Units</strong>: 1 ft³ = 7.48 US gallons = 28.32 litres; 1 m³ = 1,000 litres = 264.17 US gallons; 1 imperial gallon = 4.546 litres.</li>
  <li><strong>Fill time</strong> = volume ÷ flow rate.</li>
</ol>`,
    },
    {
      heading: 'Pools with sloped floors',
      html: `<p>Averaging the shallow and deep ends is exact for a floor that slopes evenly from one end to the other. Pools with a steep drop to a deep "hopper" section hold somewhat less than the average suggests, so for those it's more accurate to split the pool into sections and add them up.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Volumes are shown to the nearest gallon or litre and are not rounded up. There is nothing to buy in whole units, and chemical doses need the real figure.</li>
  <li>Fill time is shown to one decimal place of an hour.</li>
</ul>`,
    },
  ],
};
