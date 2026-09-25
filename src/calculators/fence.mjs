import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import { lengthField, depthField, extraField, systemOf, len, pct, factor, priceField, COST_GROUP } from './_shared.mjs';

const SMALL = ['in', 'cm', 'mm', 'ft', 'm'];
const small = (m, s) => withUnit(m, 'length', s === 'metric' ? 'cm' : 'in', (x) => fmt(x, 2));
const bagVol = (m3, s) => withUnit(m3, 'volume', s === 'metric' ? 'L' : 'ft3', (x) => fmt(x, 2));

export default {
  id: 'fence',
  slug: 'fence-calculator',
  name: 'Fence Calculator',
  question: 'How much fencing do I need?',
  category: 'garden',
  keywords: 'fence fencing posts panels pickets rails boards garden fence privacy fence post holes concrete post mix',
  title: 'Fence Calculator: How Many Posts, Panels and Pickets Do I Need?',
  description:
    'Free fence calculator. Enter the fence length and post spacing to see how many posts, panels or pickets and rails you need, plus concrete for the post holes.',
  summary: 'Posts, panels or pickets and rails, and concrete for the post holes.',
  intro:
    'Enter the length of the fence and how far apart the posts go. The calculator works out the sections and posts, then panels or pickets and rails, and the concrete to set each post.',
  groups: [
    { id: 'fence', legend: 'Fence' },
    { id: 'pickets', legend: 'Pickets and rails' },
    { id: 'posts', legend: 'Post holes' },
    COST_GROUP,
  ],
  inputs: [
    lengthField('length', 'Total fence length', 100, 30, { group: 'fence' }),
    lengthField('spacing', 'Post spacing', 8, 2.4, { group: 'fence', help: 'Centre to centre. Match your panel width, often 6 or 8 ft (1.8 or 2.4 m).' }),
    { name: 'runs', group: 'fence', type: 'count', label: 'Separate straight runs', default: 1, min: 1, max: 100, help: 'A fence with a corner is two runs. Each run needs its own end post.' },
    {
      name: 'style',
      group: 'fence',
      type: 'select',
      label: 'Fence style',
      default: 'panels',
      options: [
        { value: 'panels', label: 'Ready-made panels' },
        { value: 'pickets', label: 'Pickets or boards on rails' },
      ],
    },
    {
      name: 'picketWidth',
      group: 'pickets',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Picket width',
      default: { us: [3.5, 'in'], metric: [9, 'cm'] },
      showIf: (raw) => raw.style === 'pickets',
    },
    {
      name: 'gap',
      group: 'pickets',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Gap between pickets',
      min: 0,
      default: { us: [1, 'in'], metric: [2.5, 'cm'] },
      help: 'Enter 0 for a closed privacy fence.',
      showIf: (raw) => raw.style === 'pickets',
    },
    { name: 'rails', group: 'pickets', type: 'count', label: 'Rails per section', default: 2, min: 1, max: 10, showIf: (raw) => raw.style === 'pickets' },
    {
      name: 'holeDiameter',
      group: 'posts',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Hole diameter',
      default: { us: [10, 'in'], metric: [25, 'cm'] },
      help: 'Often about three times the post width.',
    },
    depthField('holeDepth', 'Hole depth', 24, 60, { group: 'posts', help: 'Often a third to a half of the post height above ground; deeper where the ground freezes.' }),
    {
      name: 'postWidth',
      group: 'posts',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Post width (square posts)',
      default: { us: [3.5, 'in'], metric: [9, 'cm'] },
      help: 'A "4×4" post is actually 3.5 in (about 9 cm) across.',
    },
    {
      name: 'bagYield',
      group: 'posts',
      type: 'measure',
      dim: 'volume',
      units: ['ft3', 'L'],
      label: 'Concrete yield per bag',
      default: { us: [0.6, 'ft3'], metric: [17, 'L'] },
      help: 'An 80 lb bag of concrete mix makes about 0.6 ft³ (17 L). Check the bag.',
    },
    extraField('waste', 'Extra allowance', 5, 'For damaged pickets and spilled concrete.', { group: 'posts' }),
    priceField('Price per post'),
  ],

  cost: (r) => ({ count: r.posts, unit: 'posts' }),

  compute(v) {
    // Each extra run can need one extra (part) section, and each run needs its own end post.
    const sectionsExact = v.length / v.spacing;
    const sections = ceilTo(sectionsExact, 1) + (v.runs - 1);
    const posts = sections + v.runs;
    const holeVolume = Math.PI * (v.holeDiameter / 2) ** 2 * v.holeDepth;
    const postVolume = v.postWidth ** 2 * v.holeDepth;
    if (postVolume >= holeVolume) return { error: 'The post is as wide as the hole. Make the hole wider than the post.' };
    const concretePerPost = holeVolume - postVolume;
    const concrete = concretePerPost * posts;
    const bags = ceilTo((concrete * (1 + v.waste / 100)) / v.bagYield, 1);
    let pickets = null;
    let railCount = null;
    let picketsExact = null;
    if (v.style === 'pickets') {
      picketsExact = v.length / (v.picketWidth + v.gap);
      pickets = ceilTo(picketsExact * (1 + v.waste / 100), 1);
      railCount = sections * v.rails;
    }
    return { ...v, sectionsExact, sections, posts, holeVolume, postVolume, concretePerPost, concrete, bags, pickets, picketsExact, railCount };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const panels = r.style === 'panels';
    const buyRows = [{ label: 'Posts', value: fmt(r.posts, 0), strong: true }];
    if (panels) buyRows.push({ label: 'Panels', value: fmt(r.sections, 0), strong: true });
    else {
      buyRows.push(
        { label: 'Pickets', value: fmt(r.pickets, 0), strong: true },
        { label: `Rails (${len(r.spacing, s)} long)`, value: fmt(r.railCount, 0) },
      );
    }
    buyRows.push({ label: `Concrete bags (${bagVol(r.bagYield, s)} each)`, value: fmt(r.bags, 0) });

    const steps = [
      `Sections = ${len(r.length, s)} ÷ ${len(r.spacing, s)} = ${fmtUp(r.sectionsExact, 2)}, rounded up to ${ceilTo(r.sectionsExact, 1)}${r.runs > 1 ? `, plus ${r.runs - 1} for the extra ${plural(r.runs - 1, 'run')} = ${r.sections}` : ''}`,
      `Posts = ${r.sections} sections + ${r.runs} end ${plural(r.runs, 'post')} = ${r.posts}`,
    ];
    if (!panels) {
      steps.push(
        `Pickets = ${len(r.length, s)} ÷ (${small(r.picketWidth, s)} + ${small(r.gap, s)} gap) = ${fmt(r.picketsExact, 2)}; with ${pct(r.waste)} extra = ${fmtUp(r.picketsExact * (1 + r.waste / 100), 2)}, rounded up to ${r.pickets}`,
        `Rails = ${r.sections} sections × ${r.rails} per section = ${r.railCount}`,
      );
    }
    steps.push(
      `Concrete per hole = π × (${small(r.holeDiameter, s)} ÷ 2)² × ${small(r.holeDepth, s)} − the post (${small(r.postWidth, s)}² × ${small(r.holeDepth, s)}) = ${bagVol(r.concretePerPost, s)}`,
      `Bags = ${r.posts} posts × ${bagVol(r.concretePerPost, s)} × ${factor(r.waste)} ÷ ${bagVol(r.bagYield, s)} per bag = ${fmtUp((r.concrete * (1 + r.waste / 100)) / r.bagYield, 2)}, rounded up to ${r.bags}`,
    );

    return {
      headline: {
        label: 'Fence materials',
        value: panels ? `${r.posts} posts, ${r.sections} panels` : `${r.posts} posts, ${r.pickets} pickets`,
        detail: `${panels ? '' : `${r.railCount} rails, `}${r.bags} ${plural(r.bags, 'bag')} of concrete for the posts.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: buyRows },
        {
          title: 'Calculated quantity (no extra)',
          kind: 'exact',
          rows: [
            { label: 'Sections', value: fmt(r.sections, 0) },
            ...(panels ? [] : [{ label: 'Pickets to cover the length', value: fmt(r.picketsExact, 2) }]),
            { label: 'Concrete per post', value: bagVol(r.concretePerPost, s) },
            { label: 'Concrete for all posts', value: bagVol(r.concrete, s), strong: true },
          ],
        },
      ],
      steps,
      notes: [
        'Gates: subtract each gate opening from the fence length, and add the gate posts, which are often heavier.',
        'Check where buried cables and pipes run before digging, and any local rules on fence height.',
      ],
    };
  },

  content: [
    {
      heading: 'How the fence calculation works',
      html: `<ol>
  <li><strong>Sections</strong> = fence length ÷ post spacing, rounded up. Each extra straight run adds one more section, because a run rarely ends exactly on a full panel.</li>
  <li><strong>Posts</strong> = sections + one end post per run.</li>
  <li><strong>Panels</strong> = sections. For a picket fence, <strong>pickets</strong> = length ÷ (picket width + gap), plus the extra, and <strong>rails</strong> = sections × rails per section.</li>
  <li><strong>Concrete per post</strong> = the volume of the hole (π × radius² × depth) minus the part of the post inside it.</li>
  <li><strong>Bags</strong> = concrete for all posts, plus the extra, ÷ the yield of one bag, rounded up.</li>
</ol>`,
    },
    {
      heading: 'Setting posts',
      html: `<p>A common rule of thumb is a hole about three times the width of the post, and deep enough to bury a third to a half of the post's height above ground, often 2 ft (60 cm) or more for a 6 ft fence. Where the ground freezes, holes usually go below the frost line. Many people put a few inches of gravel in the bottom of each hole for drainage, which slightly reduces the concrete needed.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Sections, pickets and bags are rounded <em>up</em>.</li>
  <li>With several runs, the count allows a part section at the end of every run, so it may leave you a spare panel or rails.</li>
</ul>`,
    },
  ],
};
