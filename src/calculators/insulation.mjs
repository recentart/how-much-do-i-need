import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, area, pct, factor, AREAS, totalArea, areaStep, priceField, COST_GROUP } from './_shared.mjs';

// US R-value (ft²·°F·h/BTU) to metric RSI (m²·K/W)
const RSI_PER_R = 0.1761;

export default {
  id: 'insulation',
  slug: 'insulation-calculator',
  name: 'Insulation Calculator',
  question: 'How much insulation do I need?',
  category: 'home',
  keywords: 'insulation batts rolls attic loft walls fiberglass mineral wool R-value RSI thickness depth bags packs',
  title: 'Insulation Calculator: How Much Insulation Do I Need?',
  description:
    'Free insulation calculator for attics and walls. Enter the area and coverage per pack to see how many batts or rolls to buy, and the depth for an R-value.',
  summary: 'Packs of insulation batts or rolls for an attic or walls, and depth for an R-value.',
  intro:
    'Enter the area you are insulating and the coverage printed on the pack. The calculator works out how many packs you need for one or more layers. If you add a target R-value, it also shows how deep the insulation must be.',
  groups: [
    { id: 'area', legend: 'Area to insulate' },
    { id: 'product', legend: 'Insulation' },
    { id: 'rvalue', legend: 'Depth for an R-value (optional)' },
    COST_GROUP,
  ],
  areas: AREAS,
  inputs: [
    lengthField('length', 'Length', 30, 9, { group: 'area', help: 'For an attic or loft, the floor. For walls, the wall length.' }),
    lengthField('width', 'Width', 20, 6, { group: 'area', help: 'For walls, use the wall height.' }),
    {
      name: 'coverage',
      group: 'product',
      type: 'measure',
      dim: 'area',
      units: ['ft2', 'm2'],
      label: 'Coverage per pack',
      default: { us: [40, 'ft2'], metric: [5, 'm2'] },
      help: 'Printed on the pack. Thicker products cover less area per pack.',
    },
    { name: 'layers', group: 'product', type: 'count', label: 'Number of layers', default: 1, min: 1, max: 5, help: 'Attics are often insulated in two layers, the second laid across the first.' },
    extraField('waste', 'Waste allowance', 5, 'For cutting around joists, pipes and awkward corners.', { group: 'product' }),
    { name: 'targetR', group: 'rvalue', type: 'number', label: 'Target R-value (US)', optional: true, default: null, min: 0, max: 200, help: 'Local codes and energy programmes set the R-value to aim for.' },
    { name: 'rPerInch', group: 'rvalue', type: 'number', label: 'R-value per inch of the product', default: 3.2, gt: true, min: 0, max: 10, help: 'On the product. Fiberglass and mineral wool batts are often about 3–4.' },
    priceField('Price per pack'),
  ],

  cost: (r) => ({ count: r.packs, unit: 'packs' }),

  compute(v) {
    const surface = totalArea(v);
    const covered = surface * v.layers;
    const packsExact = covered / v.coverage;
    const packs = ceilTo(packsExact * (1 + v.waste / 100), 1);
    const depthIn = v.targetR != null ? v.targetR / v.rPerInch : null;
    return { ...v, surface, covered, packsExact, packs, depthIn };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const buyRows = [{ label: 'Packs', value: fmt(r.packs, 0), strong: true }];
    const exactRows = [
      { label: 'Area', value: area(r.surface, s) },
      { label: `Area × ${r.layers} ${plural(r.layers, 'layer')}`, value: area(r.covered, s) },
      { label: 'Packs', value: fmt(r.packsExact, 2), strong: true },
    ];
    const steps = [
      areaStep(r, s),
      `Packs = ${area(r.surface, s)} × ${r.layers} ${plural(r.layers, 'layer')} ÷ ${area(r.coverage, s)} per pack = ${fmt(r.packsExact, 2)}`,
      `With ${pct(r.waste)} waste = ${fmt(r.packsExact, 2)} × ${factor(r.waste)} = ${fmtUp(r.packsExact * (1 + r.waste / 100), 2)}, rounded up to ${r.packs}`,
    ];
    if (r.depthIn != null) {
      const depthText = `${fmt(r.depthIn, 1)} in (${withUnit(r.depthIn * 0.0254, 'length', 'cm', (x) => fmt(x, 1))})`;
      exactRows.push({ label: `Depth for R-${fmt(r.targetR, 1)} (RSI ${fmt(r.targetR * RSI_PER_R, 2)})`, value: depthText, strong: true });
      steps.push(`Depth = R-${fmt(r.targetR, 1)} ÷ R-${fmt(r.rPerInch, 2)} per inch = ${depthText}`);
    }
    return {
      headline: {
        label: 'Insulation to buy',
        value: `${fmt(r.packs, 0)} ${plural(r.packs, 'pack')}`,
        detail: `${area(r.coverage, s)} packs for ${area(r.covered, s)}${r.depthIn != null ? `, about ${fmt(r.depthIn, 1)} in deep for R-${fmt(r.targetR, 1)}` : ''}, including ${pct(r.waste)} waste.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: buyRows },
        { title: 'Calculated quantity (no waste)', kind: 'exact', rows: exactRows },
      ],
      steps,
      notes: [
        'Pack coverage is for the product at its stated thickness. Compressing insulation to fit a shallow space reduces its R-value.',
        'Keep insulation clear of recessed lights, flues and chimneys unless the product and fixtures are rated for contact, and keep eaves ventilation open.',
      ],
    };
  },

  content: [
    {
      heading: 'How the insulation calculation works',
      html: `<ol>
  <li><strong>Area</strong> = length × width. Add rectangles for L-shaped attics or several walls.</li>
  <li><strong>Packs</strong> = area × number of layers ÷ coverage per pack, plus the waste allowance, rounded up.</li>
  <li><strong>Depth</strong> (optional) = target R-value ÷ R-value per inch of the product.</li>
</ol>
<p>US R-values are converted to metric RSI (m²·K/W) by multiplying by 0.1761. For example, R-38 is about RSI 6.7.</p>`,
    },
    {
      heading: 'Batts, rolls and the coverage figure',
      html: `<p>Batts and rolls are sized to fit between standard joist and stud spacings, and the coverage on the pack is the area of wall or ceiling they fill, so you don't subtract the framing. Thicker, higher-R products cover less area per pack. Loose-fill (blown) insulation is sold differently: its bag chart gives the bags per 1,000 ft² needed for each R-value, and settled depth matters more than bag count.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Packs are rounded <em>up</em> to whole packs after the waste allowance.</li>
  <li>The depth for an R-value is shown to one decimal place.</li>
</ul>`,
    },
  ],
};
