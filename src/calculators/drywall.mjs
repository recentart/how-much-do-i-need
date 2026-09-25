import { fmt, fmtUp, ceilTo, fromBase, plural } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, len, area, pct, factor, priceField, COST_GROUP } from './_shared.mjs';

// A common rule of thumb for screwing drywall to framing: about one screw per square foot of board.
const SCREWS_PER_FT2 = 1;

export default {
  id: 'drywall',
  slug: 'drywall-calculator',
  name: 'Drywall Calculator',
  question: 'How many sheets of drywall do I need?',
  category: 'home',
  keywords: 'drywall plasterboard gypsum board sheetrock sheets panels 4x8 4x12 walls ceiling screws',
  title: 'Drywall Calculator: How Many Sheets of Drywall Do I Need?',
  description:
    'Free drywall (plasterboard) calculator. Enter the room size, openings and sheet size to see how many sheets to buy for the walls and ceiling, plus screws.',
  summary: 'Sheets of drywall or plasterboard for a room’s walls and ceiling.',
  intro:
    'Enter the size of the room and the sheet size you plan to hang. The calculator works out the wall area, takes off doors and windows, adds the ceiling if you want it, and rounds up to whole sheets.',
  groups: [
    { id: 'room', legend: 'Room size' },
    { id: 'openings', legend: 'Doors and windows' },
    { id: 'sheets', legend: 'Sheets' },
    COST_GROUP,
  ],
  inputs: [
    lengthField('length', 'Room length', 12, 3.6, { group: 'room' }),
    lengthField('width', 'Room width', 10, 3, { group: 'room' }),
    lengthField('height', 'Wall height', 8, 2.4, { group: 'room' }),
    { name: 'ceiling', group: 'room', type: 'checkbox', label: 'Include the ceiling', default: true, wide: true },
    { name: 'doors', group: 'openings', type: 'count', label: 'Number of doors', default: 1, max: 100 },
    { name: 'windows', group: 'openings', type: 'count', label: 'Number of windows', default: 1, max: 200 },
    {
      name: 'doorArea',
      group: 'openings',
      type: 'measure',
      dim: 'area',
      units: ['ft2', 'm2'],
      label: 'Area of each door',
      min: 0,
      default: { us: [20, 'ft2'], metric: [1.9, 'm2'] },
    },
    {
      name: 'windowArea',
      group: 'openings',
      type: 'measure',
      dim: 'area',
      units: ['ft2', 'm2'],
      label: 'Area of each window',
      min: 0,
      default: { us: [15, 'ft2'], metric: [1.4, 'm2'] },
    },
    lengthField('sheetWidth', 'Sheet width', 4, 1.2, { group: 'sheets' }),
    lengthField('sheetLength', 'Sheet length', 8, 2.4, { group: 'sheets', help: 'Common sizes: 4 × 8, 4 × 10 and 4 × 12 ft, or 1.2 × 2.4 m.' }),
    extraField('waste', 'Waste allowance', 10, 'For cuts around openings and damaged corners. 10–15% is common.', { group: 'sheets' }),
    priceField('Price per sheet'),
  ],

  cost: (r) => ({ count: r.sheets, unit: 'sheets' }),

  compute(v) {
    const wallArea = 2 * (v.length + v.width) * v.height;
    const openings = v.doors * v.doorArea + v.windows * v.windowArea;
    const walls = wallArea - openings;
    if (walls <= 0) return { error: 'The doors and windows add up to more than the wall area. Check the counts and sizes.' };
    const ceilingArea = v.ceiling ? v.length * v.width : 0;
    const surface = walls + ceilingArea;
    const sheetArea = v.sheetWidth * v.sheetLength;
    const sheetsExact = surface / sheetArea;
    const sheets = ceilTo(sheetsExact * (1 + v.waste / 100), 1);
    const screws = ceilTo(fromBase(sheets * sheetArea, 'area', 'ft2') * SCREWS_PER_FT2, 1);
    return { ...v, wallArea, openings, walls, ceilingArea, surface, sheetArea, sheetsExact, sheets, screws };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const sheetName = `${len(r.sheetWidth, s)} × ${len(r.sheetLength, s)}`;
    const steps = [
      `Wall area = 2 × (${len(r.length, s)} + ${len(r.width, s)}) × ${len(r.height, s)} = ${area(r.wallArea, s)}`,
      `Doors and windows = ${r.doors} × ${area(r.doorArea, s)} + ${r.windows} × ${area(r.windowArea, s)} = ${area(r.openings, s)}`,
    ];
    if (r.ceilingArea) steps.push(`Ceiling = ${len(r.length, s)} × ${len(r.width, s)} = ${area(r.ceilingArea, s)}`);
    steps.push(
      `Area to cover = ${area(r.wallArea, s)} − ${area(r.openings, s)}${r.ceilingArea ? ` + ${area(r.ceilingArea, s)}` : ''} = ${area(r.surface, s)}`,
      `Sheets = ${area(r.surface, s)} ÷ ${area(r.sheetArea, s)} per sheet = ${fmt(r.sheetsExact, 2)}`,
      `With ${pct(r.waste)} waste = ${fmt(r.sheetsExact, 2)} × ${factor(r.waste)} = ${fmtUp(r.sheetsExact * (1 + r.waste / 100), 2)}, rounded up to ${r.sheets}`,
      `Screws ≈ ${r.sheets} sheets × ${area(r.sheetArea, 'us')} × 1 per ft² = ${fmt(r.screws, 0)}`,
    );
    return {
      headline: {
        label: 'Drywall to buy',
        value: `${r.sheets} ${plural(r.sheets, 'sheet')}`,
        detail: `${sheetName} sheets for ${area(r.surface, s)}, including ${pct(r.waste)} waste.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: `Sheets (${sheetName})`, value: fmt(r.sheets, 0), strong: true },
            { label: 'Drywall screws (rule of thumb)', value: fmt(r.screws, 0) },
          ],
        },
        {
          title: 'Calculated quantity (no waste)',
          kind: 'exact',
          rows: [
            { label: 'Walls after openings', value: area(r.walls, s) },
            ...(r.ceilingArea ? [{ label: 'Ceiling', value: area(r.ceilingArea, s) }] : []),
            { label: 'Area to cover', value: area(r.surface, s), strong: true },
            { label: 'Sheets', value: fmt(r.sheetsExact, 2), strong: true },
          ],
        },
      ],
      steps,
      notes: ['Joint tape and compound are extra. Ceilings often use thicker or sag-resistant board; check local codes for fire-rated board in garages.'],
    };
  },

  content: [
    {
      heading: 'How the drywall calculation works',
      html: `<ol>
  <li><strong>Wall area</strong> = 2 × (length + width) × wall height.</li>
  <li><strong>Subtract</strong> doors and windows (count × area of each).</li>
  <li><strong>Add the ceiling</strong> (length × width) if you're boarding it.</li>
  <li><strong>Sheets</strong> = area ÷ area of one sheet, then the waste allowance, rounded up.</li>
  <li><strong>Screws</strong> are estimated with a common rule of thumb of about one screw per square foot of board (about 32 for a 4 × 8 sheet). Your fixing pattern and local code decide the real number.</li>
</ol>`,
    },
    {
      heading: 'Choosing sheet sizes',
      html: `<p>Longer sheets (10 or 12 ft) mean fewer joints to tape and a flatter finish, but they are heavier and harder to carry through a house. Hanging sheets horizontally on walls is common because it reduces joint length. The area-based count here doesn't depend on orientation, but very tall or narrow walls can create more offcuts, so raise the waste allowance for rooms with lots of corners.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Sheets are rounded <em>up</em> to whole sheets after the waste allowance.</li>
  <li>Screws are a rounded-up estimate.</li>
</ul>`,
    },
  ],
};
