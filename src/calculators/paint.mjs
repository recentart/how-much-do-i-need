import { fromBase, fmt, fmtUp, ceilTo, LITRES_PER_GALLON, plural } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, len, area, pct, factor } from './_shared.mjs';

// Smallest total of metric tins (10, 5, 2.5, 1 L) that covers the litres needed; ties go to fewer tins.
export function bestTins(litresNeeded) {
  let best = null;
  const minTens = Math.max(0, Math.floor(litresNeeded / 10) - 2);
  const maxTens = Math.ceil(litresNeeded / 10);
  for (let a = minTens; a <= maxTens; a++) {
    for (let b = 0; b <= 2; b++) {
      for (let c = 0; c <= 3; c++) {
        for (let d = 0; d <= 4; d++) {
          const total = a * 10 + b * 5 + c * 2.5 + d;
          if (total + 1e-9 < litresNeeded) continue;
          const count = a + b + c + d;
          if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && count < best.count)) {
            best = { total, count, tins: [[10, a], [5, b], [2.5, c], [1, d]].filter(([, n]) => n > 0) };
          }
        }
      }
    }
  }
  return best;
}

export function tinsText(best) {
  return best.tins.map(([size, n]) => `${n} × ${fmt(size, 1)} L`).join(' + ');
}

export function gallonsQuarts(quarts) {
  const g = Math.floor(quarts / 4);
  const q = quarts % 4;
  const gs = `${g} ${plural(g, 'gallon')}`;
  const qs = `${q} ${plural(q, 'quart')}`;
  if (g === 0) return qs;
  if (q === 0) return gs;
  return `${gs} + ${qs}`;
}

const gal = (litresValue) => `${fmt(litresValue / LITRES_PER_GALLON, 2, 2)} gal`;
const ltr = (litresValue) => `${fmt(litresValue, litresValue < 10 ? 2 : 1)} L`;
// The amount including extra is what gets rounded up to cans, so it is itself shown rounded up.
const galUp = (litresValue) => `${fmtUp(litresValue / LITRES_PER_GALLON, 2, 2)} gal`;
const ltrUp = (litresValue) => `${fmtUp(litresValue, litresValue < 10 ? 2 : 1)} L`;

export default {
  id: 'paint',
  slug: 'paint-calculator',
  name: 'Paint Calculator',
  question: 'How much paint do I need?',
  category: 'home',
  keywords: 'paint painting walls wall room ceiling gallons gallon quarts litres liters tins cans coats emulsion interior decorating primer',
  title: 'Paint Calculator: How Much Paint Do I Need for a Room?',
  description:
    'Free paint calculator. Enter the room size, doors, windows and coats to see how many gallons or litres of paint to buy, with an adjustable allowance for waste.',
  summary: 'Gallons or litres of wall paint for a room, after subtracting doors and windows.',
  intro:
    'Enter the size of the room and the coverage printed on your paint can. The calculator works out the wall area, takes off doors and windows, multiplies by the number of coats and adds a margin for waste, then rounds up to cans you can actually buy.',
  groups: [
    { id: 'room', legend: 'Room size' },
    { id: 'openings', legend: 'Doors and windows' },
    { id: 'paint', legend: 'Paint' },
  ],
  inputs: [
    lengthField('length', 'Room length', 12, 3.6, { group: 'room' }),
    lengthField('width', 'Room width', 10, 3, { group: 'room' }),
    lengthField('height', 'Wall height', 8, 2.4, { group: 'room', help: 'Floor to ceiling.' }),
    { name: 'ceiling', group: 'room', type: 'checkbox', label: 'Paint the ceiling too', default: false, wide: true },
    { name: 'doors', group: 'openings', type: 'count', label: 'Number of doors', default: 1, max: 100 },
    { name: 'windows', group: 'openings', type: 'count', label: 'Number of windows', default: 2, max: 200 },
    {
      name: 'doorArea',
      group: 'openings',
      type: 'measure',
      dim: 'area',
      units: ['ft2', 'm2'],
      label: 'Area of each door',
      default: { us: [20, 'ft2'], metric: [1.9, 'm2'] },
      min: 0,
      help: 'A common allowance is 20 ft² (about 1.9 m²) per door.',
    },
    {
      name: 'windowArea',
      group: 'openings',
      type: 'measure',
      dim: 'area',
      units: ['ft2', 'm2'],
      label: 'Area of each window',
      default: { us: [15, 'ft2'], metric: [1.4, 'm2'] },
      min: 0,
      help: 'A common allowance is 15 ft² (about 1.4 m²) per window.',
    },
    { name: 'coats', group: 'paint', type: 'count', label: 'Number of coats', default: 2, min: 1, max: 10 },
    {
      name: 'coverage',
      group: 'paint',
      type: 'measure',
      dim: 'coverage',
      units: ['ft2gal', 'm2L'],
      label: 'Coverage per coat',
      default: { us: [350, 'ft2gal'], metric: [8.6, 'm2L'] },
      help: 'Printed on the can. 350 ft² per gallon (8.6 m² per litre) is a cautious figure for interior wall paint.',
    },
    extraField('waste', 'Extra for waste and touch-ups', 10, 'Covers paint left in trays and rollers, spills and touch-ups.', { group: 'paint' }),
  ],

  compute(v) {
    const wallArea = 2 * (v.length + v.width) * v.height;
    const openings = v.doors * v.doorArea + v.windows * v.windowArea;
    const netWalls = wallArea - openings;
    if (netWalls <= 0) {
      return { error: 'The doors and windows add up to more than the wall area. Check the counts and sizes.' };
    }
    const ceilingArea = v.ceiling ? v.length * v.width : 0;
    const surface = netWalls + ceilingArea;
    const litresExact = (surface * v.coats) / v.coverage; // coverage is in m² per litre
    const litresWithExtra = litresExact * (1 + v.waste / 100);
    const quarts = ceilTo((litresWithExtra / LITRES_PER_GALLON) * 4, 1);
    const tins = bestTins(litresWithExtra);
    return { ...v, wallArea, openings, ceilingArea, surface, litresExact, litresWithExtra, quarts, tins };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const usBuy = gallonsQuarts(r.quarts);
    const metricBuy = tinsText(r.tins);
    const coverageText =
      s === 'metric'
        ? `${fmt(r.coverage, 2)} m² per litre`
        : `${fmt(fromBase(r.coverage, 'coverage', 'ft2gal'), 1)} ft² per gallon`;
    const paintText = (l) => (s === 'metric' ? ltr(l) : gal(l));
    const coatWord = plural(r.coats, 'coat');

    const headline =
      s === 'metric'
        ? {
            label: 'Paint to buy',
            value: `${fmt(r.tins.total, 1)} ${plural(r.tins.total, 'litre')}`,
            detail: `${metricBuy} ${plural(r.tins.count, 'tin')}. You need ${ltrUp(r.litresWithExtra)} including ${pct(r.waste)} extra.`,
          }
        : {
            label: 'Paint to buy',
            value: usBuy,
            detail: `You need ${galUp(r.litresWithExtra)} (${ltrUp(r.litresWithExtra)}) including ${pct(r.waste)} extra.`,
          };

    const exactRows = [
      { label: 'Wall area', value: area(r.wallArea, s) },
      { label: 'Doors and windows', value: `− ${area(r.openings, s)}` },
    ];
    if (r.ceilingArea) exactRows.push({ label: 'Ceiling', value: `+ ${area(r.ceilingArea, s)}` });
    exactRows.push(
      { label: 'Area to paint', value: area(r.surface, s) },
      { label: `Paint for ${r.coats} ${coatWord}`, value: `${gal(r.litresExact)} / ${ltr(r.litresExact)}`, strong: true },
    );

    const steps = [
      `Wall area = 2 × (${len(r.length, s)} + ${len(r.width, s)}) × ${len(r.height, s)} = ${area(r.wallArea, s)}`,
      `Doors and windows = ${r.doors} × ${area(r.doorArea, s)} + ${r.windows} × ${area(r.windowArea, s)} = ${area(r.openings, s)}`,
    ];
    if (r.ceilingArea) steps.push(`Ceiling = ${len(r.length, s)} × ${len(r.width, s)} = ${area(r.ceilingArea, s)}`);
    steps.push(
      `Area to paint = ${area(r.wallArea, s)} − ${area(r.openings, s)}${r.ceilingArea ? ` + ${area(r.ceilingArea, s)}` : ''} = ${area(r.surface, s)}`,
      `Paint = ${area(r.surface, s)} × ${r.coats} ${coatWord} ÷ ${coverageText} = ${paintText(r.litresExact)}`,
      `With ${pct(r.waste)} extra = ${paintText(r.litresExact)} × ${factor(r.waste)} = ${s === 'metric' ? ltrUp(r.litresWithExtra) : galUp(r.litresWithExtra)}`,
      s === 'metric'
        ? `Rounded up to the smallest mix of 1, 2.5, 5 and 10 litre tins that covers it: ${metricBuy} = ${fmt(r.tins.total, 1)} L`
        : `${galUp(r.litresWithExtra)} = ${fmtUp((r.litresWithExtra / LITRES_PER_GALLON) * 4, 2)} quarts, rounded up to ${r.quarts} ${plural(r.quarts, 'quart')}${r.quarts >= 4 ? ` = ${usBuy}` : ''}`,
    );

    const notes = [
      'Coverage depends on the surface and the paint. Bare plaster or drywall, rough textures and big colour changes can need more paint or a primer coat.',
    ];
    if (s === 'us' && r.quarts % 4 === 3) {
      const fullGallons = Math.ceil(r.quarts / 4);
      notes.push(`Three quarts is ¾ of a gallon. Buying ${fullGallons} full ${plural(fullGallons, 'gallon')} instead is often simpler.`);
    }

    return {
      headline,
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: 'US cans', value: usBuy, strong: s === 'us' },
            { label: 'Metric tins', value: `${metricBuy} (${fmt(r.tins.total, 1)} L)`, strong: s === 'metric' },
            { label: `Needed with ${pct(r.waste)} extra`, value: `${galUp(r.litresWithExtra)} / ${ltrUp(r.litresWithExtra)}` },
          ],
        },
        { title: 'Calculated quantity (no extra)', kind: 'exact', rows: exactRows },
      ],
      steps,
      notes,
    };
  },

  content: [
    {
      heading: 'How the paint calculation works',
      html: `<p>Paint is sold by volume but used by area, so the calculator first works out the area you are painting and then divides by how far the paint spreads:</p>
<ol>
  <li><strong>Wall area</strong> = perimeter × wall height = 2 × (length + width) × height.</li>
  <li><strong>Subtract openings</strong>: number of doors × area per door, plus number of windows × area per window.</li>
  <li><strong>Add the ceiling</strong> (length × width) if you are painting it.</li>
  <li><strong>Paint needed</strong> = area to paint × number of coats ÷ coverage per gallon (or per litre).</li>
  <li><strong>Add extra</strong> for waste and touch-ups: paint needed × (1 + extra ÷ 100).</li>
</ol>
<p>One US gallon is 3.785 litres. Coverage entered in square feet per gallon is converted exactly, so switching units gives the same answer for the same room.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li><strong>US cans:</strong> the amount including extra is rounded <em>up</em> to the next whole quart (¼ gallon) and shown as gallons plus quarts.</li>
  <li><strong>Metric tins:</strong> the amount including extra is rounded up to the smallest combination of 1, 2.5, 5 and 10 litre tins that covers it. When two combinations hold the same amount, the one with fewer tins is shown.</li>
  <li>The working shows figures rounded for reading, but every step uses the full, unrounded numbers.</li>
</ul>`,
    },
    {
      heading: 'What changes how much paint you need',
      html: `<p>The result is an estimate. The biggest variable is the coverage figure, so use the one printed on the paint you are buying. Interior wall paints commonly list somewhere around 350–400 ft² per gallon (roughly 8.5–10 m² per litre) per coat, and some list more.</p>
<ul>
  <li><strong>Porous or new surfaces</strong> such as fresh plaster, bare drywall and unpainted wood soak up paint. A primer or a thinned mist coat is often recommended first.</li>
  <li><strong>Rough textures</strong> like textured ceilings, brick or rough render have more surface than their flat measurements suggest.</li>
  <li><strong>Big colour changes</strong>, especially light over dark, may need an extra coat.</li>
  <li><strong>Spraying</strong> usually uses more paint than rolling because of overspray.</li>
</ul>
<p>Trim, doors and radiators are not included. If you are painting them in a different finish, estimate them separately.</p>`,
    },
    {
      heading: 'Worked example',
      html: `<p>A 12 ft × 10 ft room with 8 ft walls has 2 × (12 + 10) × 8 = 352 ft² of wall. Taking off one door (20 ft²) and two windows (2 × 15 ft²) leaves 302 ft². Two coats at 350 ft² per gallon need 302 × 2 ÷ 350 = 1.73 gallons. With 10% extra that becomes 1.90 gallons, which rounds up to 8 quarts: <strong>2 gallons</strong>.</p>`,
    },
  ],
};
