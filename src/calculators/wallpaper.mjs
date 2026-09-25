import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, len, area, pct, factor, priceField, COST_GROUP } from './_shared.mjs';

const SMALL = ['in', 'cm', 'mm', 'ft', 'm'];
const small = (m, s) => withUnit(m, 'length', s === 'metric' ? 'cm' : 'in', (x) => fmt(x, 2));

export default {
  id: 'wallpaper',
  slug: 'wallpaper-calculator',
  name: 'Wallpaper Calculator',
  question: 'How much wallpaper do I need?',
  category: 'home',
  keywords: 'wallpaper wall paper rolls double roll single roll pattern repeat drops strips feature wall room decorating',
  title: 'Wallpaper Calculator: How Many Rolls of Wallpaper Do I Need?',
  description:
    'Free wallpaper calculator. Enter the room, wall height, roll size and pattern repeat to see how many rolls to buy, worked out drop by drop like a decorator.',
  summary: 'Rolls of wallpaper for a room or feature wall, allowing for pattern repeat.',
  intro:
    'Enter the walls you are papering, the roll size and the pattern repeat from the label. The calculator works out how many full-height strips (drops) you need and how many you can cut from each roll, then rounds up to whole rolls.',
  groups: [
    { id: 'room', legend: 'Walls' },
    { id: 'roll', legend: 'Wallpaper roll' },
    COST_GROUP,
  ],
  inputs: [
    lengthField('length', 'Room length', 12, 3.6, { group: 'room' }),
    lengthField('width', 'Room width', 10, 3, { group: 'room', showIf: (raw) => raw.walls === 'all' }),
    {
      name: 'walls',
      group: 'room',
      type: 'select',
      label: 'Walls to paper',
      default: 'all',
      options: [
        { value: 'all', label: 'All four walls' },
        { value: 'one', label: 'One wall (a feature wall as long as the room length)' },
      ],
    },
    lengthField('height', 'Wall height', 8, 2.4, { group: 'room', help: 'From the top of the skirting board or floor to the ceiling.' }),
    lengthField('openings', 'Width of doors and windows to skip', 3, 0.9, {
      group: 'room',
      min: 0,
      help: 'Add up the widths of doors and large windows. Leave small windows in: the paper above and below still has to be cut from full drops.',
    }),
    {
      name: 'rollWidth',
      group: 'roll',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Roll width',
      default: { us: [20.5, 'in'], metric: [53, 'cm'] },
      help: 'Common sizes: 20.5 in (US) or 53 cm (European standard).',
    },
    lengthField('rollLength', 'Roll length', 33, 10.05, {
      group: 'roll',
      help: 'A US double roll is usually about 33 ft; a European roll is 10.05 m. Check the label.',
    }),
    {
      name: 'repeat',
      group: 'roll',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Pattern repeat',
      min: 0,
      default: { us: [0, 'in'], metric: [0, 'cm'] },
      help: 'On the label. Enter 0 for plain or random-match paper.',
    },
    {
      name: 'trim',
      group: 'roll',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Trim allowance per drop',
      min: 0,
      default: { us: [4, 'in'], metric: [10, 'cm'] },
      help: 'Extra at top and bottom for trimming. 4 in (10 cm) is typical.',
    },
    extraField('extra', 'Extra for mistakes', 10, 'Spare paper for a mistake or a later repair, from the same batch.', { group: 'roll' }),
    priceField('Price per roll'),
  ],

  cost: (r) => ({ count: r.rolls, unit: 'rolls' }),

  compute(v) {
    const wallWidth = v.walls === 'all' ? 2 * (v.length + v.width) : v.length;
    const paperWidth = wallWidth - v.openings;
    if (paperWidth <= 0) return { error: 'The doors and windows are wider than the walls. Check the widths.' };
    const needed = v.height + v.trim;
    // With a pattern, every drop must start at the same point in the pattern, so each drop uses a
    // whole number of repeats.
    const dropLength = v.repeat > 0 ? ceilTo(needed / v.repeat, 1) * v.repeat : needed;
    const dropsPerRoll = Math.floor(v.rollLength / dropLength + 1e-9);
    if (dropsPerRoll < 1) return { error: 'One roll is shorter than a single drop. Check the wall height and roll length.' };
    const drops = ceilTo(paperWidth / v.rollWidth, 1);
    const rollsBase = ceilTo(drops / dropsPerRoll, 1);
    const rolls = ceilTo(rollsBase * (1 + v.extra / 100), 1);
    const wallArea = paperWidth * v.height;
    const rollArea = v.rollWidth * v.rollLength;
    return { ...v, wallWidth, paperWidth, needed, dropLength, dropsPerRoll, drops, rollsBase, rolls, wallArea, rollArea };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const rollWord = plural(r.rolls, 'roll');
    const steps = [
      r.walls === 'all'
        ? `Wall width = 2 × (${len(r.length, s)} + ${len(r.width, s)}) − ${len(r.openings, s)} of openings = ${len(r.paperWidth, s)}`
        : `Wall width = ${len(r.length, s)} − ${len(r.openings, s)} of openings = ${len(r.paperWidth, s)}`,
      `Drops = ${len(r.paperWidth, s)} ÷ ${small(r.rollWidth, s)} roll width = ${fmtUp(r.paperWidth / r.rollWidth, 2)}, rounded up to ${r.drops}`,
      r.repeat > 0
        ? `Drop length = ${small(r.needed, s)} (height + trim), rounded up to whole ${small(r.repeat, s)} repeats = ${small(r.dropLength, s)}`
        : `Drop length = ${len(r.height, s)} + ${small(r.trim, s)} trim = ${small(r.dropLength, s)}`,
      `Drops per roll = ${len(r.rollLength, s)} ÷ ${small(r.dropLength, s)} = ${fmt(r.rollLength / r.dropLength, 2)}, rounded down to ${r.dropsPerRoll}`,
      `Rolls = ${r.drops} drops ÷ ${r.dropsPerRoll} per roll = ${fmtUp(r.drops / r.dropsPerRoll, 2)}, rounded up to ${r.rollsBase}`,
      `With ${pct(r.extra)} extra = ${r.rollsBase} × ${factor(r.extra)} = ${fmtUp(r.rollsBase * (1 + r.extra / 100), 2)}, rounded up to ${r.rolls}`,
    ];
    return {
      headline: {
        label: 'Wallpaper to buy',
        value: `${r.rolls} ${rollWord}`,
        detail: `${r.drops} drops of ${small(r.dropLength, s)}, ${r.dropsPerRoll} from each roll, plus ${pct(r.extra)} extra.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: 'Rolls', value: `${r.rolls} ${rollWord}`, strong: true },
            { label: 'Rolls with no extra', value: fmt(r.rollsBase, 0) },
          ],
        },
        {
          title: 'Calculated quantity (no extra)',
          kind: 'exact',
          rows: [
            { label: 'Width to paper', value: len(r.paperWidth, s) },
            { label: 'Wall area', value: area(r.wallArea, s) },
            { label: 'Drops (full-height strips)', value: fmt(r.drops, 0), strong: true },
            { label: 'Drops you can cut per roll', value: fmt(r.dropsPerRoll, 0) },
            { label: 'Rolls by area alone (for comparison)', value: fmtUp(r.wallArea / r.rollArea, 2) },
          ],
        },
      ],
      steps,
      notes: [
        'The drop count is more reliable than dividing the wall area by the roll area, because the offcut at the end of each roll is usually too short to use.',
        'Buy every roll from the same batch (lot) number: colours can differ slightly between batches.',
      ],
    };
  },

  content: [
    {
      heading: 'How the wallpaper calculation works',
      html: `<p>Decorators count wallpaper in <strong>drops</strong>: full-height strips cut from the roll.</p>
<ol>
  <li><strong>Width to paper</strong> = the walls' total width (2 × (length + width) for a whole room) minus doors and large windows.</li>
  <li><strong>Drops</strong> = width to paper ÷ roll width, rounded up.</li>
  <li><strong>Drop length</strong> = wall height + trim allowance. With a patterned paper this is rounded up to a whole number of pattern repeats, so each strip lines up with the next.</li>
  <li><strong>Drops per roll</strong> = roll length ÷ drop length, rounded <em>down</em>, because a short leftover piece can't make a full drop.</li>
  <li><strong>Rolls</strong> = drops ÷ drops per roll, rounded up, then the extra is added and rounded up again.</li>
</ol>`,
    },
    {
      heading: 'Why pattern repeat matters',
      html: `<p>A large pattern repeat can use a lot more paper. For example, with 8 ft (2.44 m) walls and a 21 in (53 cm) repeat, each drop must be long enough for five repeats, 105 in (2.67 m), even though the wall only needs about 100 in with trim. A 33 ft (396 in) roll then gives three drops, leaving an 81 in offcut that is too short for a fourth.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Drops are rounded <em>up</em>; drops per roll are rounded <em>down</em>.</li>
  <li>Rolls are rounded <em>up</em>, before and after the extra is added.</li>
  <li>Measurements are converted exactly, so you can enter the room in feet and the roll width in centimetres.</li>
</ul>`,
    },
  ],
};
