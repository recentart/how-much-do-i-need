import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import { lengthField, depthField, extraField, systemOf, len, volume, bulkOrder, bulkNeed, pct, factor, priceField, COST_GROUP } from './_shared.mjs';

const SMALL = ['in', 'cm', 'mm', 'ft', 'm'];
const small = (m, s) => withUnit(m, 'length', s === 'metric' ? 'cm' : 'in', (x) => fmt(x, 2));

export default {
  id: 'retaining-wall',
  slug: 'retaining-wall-calculator',
  name: 'Retaining Wall Block Calculator',
  question: 'How many retaining wall blocks do I need?',
  category: 'garden',
  keywords: 'retaining wall blocks segmental garden wall landscape blocks caps courses drainage gravel base raised bed wall',
  title: 'Retaining Wall Calculator: How Many Blocks Do I Need?',
  description:
    'Free retaining wall calculator. Enter the wall length and height and your block size to see how many blocks and caps to buy, plus base and drainage gravel.',
  summary: 'Blocks, caps and gravel for a segmental retaining wall or garden wall.',
  intro:
    'Enter the wall length and height and the face size of your blocks. The calculator counts courses and blocks per course, adds a buried first course and caps, and works out the gravel for the base and drainage.',
  groups: [
    { id: 'wall', legend: 'Wall' },
    { id: 'block', legend: 'Blocks' },
    { id: 'gravel', legend: 'Base and drainage gravel' },
    COST_GROUP,
  ],
  inputs: [
    lengthField('length', 'Wall length', 20, 6, { group: 'wall' }),
    lengthField('height', 'Wall height above ground', 2, 0.6, { group: 'wall' }),
    { name: 'buried', group: 'wall', type: 'count', label: 'Buried courses', default: 1, min: 0, max: 5, help: 'Most block makers call for at least one course below ground.' },
    { name: 'blockLength', group: 'block', type: 'measure', dim: 'length', units: SMALL, label: 'Block face length', default: { us: [12, 'in'], metric: [30, 'cm'] } },
    { name: 'blockHeight', group: 'block', type: 'measure', dim: 'length', units: SMALL, label: 'Block face height', default: { us: [4, 'in'], metric: [10, 'cm'] } },
    { name: 'caps', group: 'block', type: 'checkbox', label: 'Finish the top with cap blocks', default: true, wide: true },
    {
      name: 'capLength',
      group: 'block',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Cap length',
      default: { us: [12, 'in'], metric: [30, 'cm'] },
      showIf: (raw) => raw.caps === true,
    },
    extraField('waste', 'Extra allowance', 5, 'For cut and damaged blocks, and spilled gravel.', { group: 'block' }),
    depthField('baseDepth', 'Base gravel depth', 6, 15, { group: 'gravel', min: 0, help: 'Compacted crushed stone under the first course. Enter 0 to skip.' }),
    { name: 'baseWidth', group: 'gravel', type: 'measure', dim: 'length', units: SMALL, label: 'Base trench width', min: 0, default: { us: [24, 'in'], metric: [60, 'cm'] } },
    { name: 'drainWidth', group: 'gravel', type: 'measure', dim: 'length', units: SMALL, label: 'Drainage gravel behind the wall', min: 0, default: { us: [12, 'in'], metric: [30, 'cm'] }, help: 'Width of the clean gravel zone behind the blocks. Enter 0 to skip.' },
    priceField('Price per block'),
  ],

  cost: (r) => ({ count: r.blocks, unit: 'blocks' }),

  compute(v) {
    const coursesAbove = ceilTo(v.height / v.blockHeight, 1);
    const courses = coursesAbove + v.buried;
    const perCourseExact = v.length / v.blockLength;
    const perCourse = ceilTo(perCourseExact, 1);
    const blocksBase = courses * perCourse;
    const blocks = ceilTo(blocksBase * (1 + v.waste / 100), 1);
    const caps = v.caps ? ceilTo((v.length / v.capLength) * (1 + v.waste / 100), 1) : 0;
    const buriedHeight = v.buried * v.blockHeight;
    const base = v.length * v.baseWidth * v.baseDepth;
    const drain = v.length * (v.height + buriedHeight) * v.drainWidth;
    const gravel = (base + drain) * (1 + v.waste / 100);
    return { ...v, coursesAbove, courses, perCourseExact, perCourse, blocksBase, blocks, caps, buriedHeight, base, drain, gravel };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const buyRows = [{ label: 'Wall blocks', value: fmt(r.blocks, 0), strong: true }];
    if (r.caps) buyRows.push({ label: 'Cap blocks', value: fmt(r.caps, 0) });
    if (r.gravel > 0) buyRows.push({ label: 'Gravel (base + drainage)', value: bulkOrder(r.gravel, s).text });
    const steps = [
      `Courses above ground = ${len(r.height, s)} ÷ ${small(r.blockHeight, s)} = ${fmtUp(r.height / r.blockHeight, 2)}, rounded up to ${r.coursesAbove}; plus ${r.buried} buried = ${r.courses}`,
      `Blocks per course = ${len(r.length, s)} ÷ ${small(r.blockLength, s)} = ${fmtUp(r.perCourseExact, 2)}, rounded up to ${r.perCourse}`,
      `Blocks = ${r.courses} × ${r.perCourse} = ${r.blocksBase}; with ${pct(r.waste)} extra × ${factor(r.waste)} = ${fmtUp(r.blocksBase * (1 + r.waste / 100), 2)}, rounded up to ${r.blocks}`,
    ];
    if (r.caps) steps.push(`Caps = ${len(r.length, s)} ÷ ${small(r.capLength, s)} × ${factor(r.waste)}, rounded up = ${r.caps}`);
    if (r.base > 0) steps.push(`Base gravel = ${len(r.length, s)} × ${small(r.baseWidth, s)} × ${small(r.baseDepth, s)} = ${volume(r.base, s)}`);
    if (r.drain > 0) steps.push(`Drainage gravel = ${len(r.length, s)} × ${len(r.height + r.buriedHeight, s)} tall × ${small(r.drainWidth, s)} = ${volume(r.drain, s)}`);
    if (r.gravel > 0) steps.push(`Gravel with ${pct(r.waste)} extra = ${bulkNeed(r.gravel, s)}, rounded up to ${bulkOrder(r.gravel, s).text}`);
    return {
      headline: {
        label: 'Blocks to buy',
        value: `${fmt(r.blocks, 0)} ${plural(r.blocks, 'block')}`,
        detail: `${r.courses} courses of ${r.perCourse}${r.caps ? `, plus ${r.caps} ${plural(r.caps, 'cap')}` : ''}, including ${pct(r.waste)} extra.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: buyRows },
        {
          title: 'Calculated quantity (no extra)',
          kind: 'exact',
          rows: [
            { label: 'Courses (including buried)', value: fmt(r.courses, 0) },
            { label: 'Blocks per course', value: fmt(r.perCourse, 0) },
            { label: 'Blocks', value: fmt(r.blocksBase, 0), strong: true },
            ...(r.base > 0 ? [{ label: 'Base gravel', value: volume(r.base, s) }] : []),
            ...(r.drain > 0 ? [{ label: 'Drainage gravel', value: volume(r.drain, s) }] : []),
          ],
        },
      ],
      steps,
      notes: [
        'Taller retaining walls, often anything over about 3–4 ft (around 1 m), or walls holding back slopes, driveways or buildings, may need an engineered design and a permit. Check local rules.',
        'Follow the block maker’s installation guide for setback, geogrid and drainage pipe.',
      ],
    };
  },

  content: [
    {
      heading: 'How the retaining wall calculation works',
      html: `<ol>
  <li><strong>Courses</strong> = wall height above ground ÷ block height, rounded up, plus the buried courses.</li>
  <li><strong>Blocks per course</strong> = wall length ÷ block length, rounded up.</li>
  <li><strong>Blocks</strong> = courses × blocks per course, plus the extra, rounded up.</li>
  <li><strong>Caps</strong> = wall length ÷ cap length, plus the extra, rounded up.</li>
  <li><strong>Base gravel</strong> = wall length × trench width × base depth. <strong>Drainage gravel</strong> = wall length × full wall height (including buried courses) × drainage width.</li>
</ol>`,
    },
    {
      heading: 'Common starting points',
      html: `<p>The defaults follow typical guidance for small segmental block walls: one buried course, a 6 in (15 cm) compacted gravel base in a trench about twice the block depth, and a 12 in (30 cm) band of clean gravel behind the wall for drainage. Block makers publish exact requirements for their systems, including how far each course steps back, and those take priority.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Courses, blocks per course, blocks and caps are rounded <em>up</em>.</li>
  <li>Gravel is rounded <em>up</em> to the next 0.25 yd³ or 0.25 m³.</li>
  <li>Curved walls and corners change the count. Measure along the face of the wall and add a few extra blocks.</li>
</ul>`,
    },
  ],
};
