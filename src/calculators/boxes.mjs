import { fmt, fmtUp, ceilTo, plural } from '../lib/units.mjs';
import { extraField, pct, factor, priceField, COST_GROUP } from './_shared.mjs';

// Planning assumptions for an averagely furnished home: boxes per room, and how each room's boxes
// usually split between sizes (kitchens are mostly small and medium boxes for heavy items; garages
// lean to large). These are rules of thumb, shown on the page, and the per-room totals are editable.
export const ROOMS = [
  { id: 'bedrooms', label: 'Bedrooms', perLabel: 'Boxes per bedroom', count: 2, per: 12, split: { small: 3, medium: 5, large: 3, wardrobe: 1 } },
  { id: 'bathrooms', label: 'Bathrooms', perLabel: 'Boxes per bathroom', count: 1, per: 4, split: { small: 3, medium: 1 } },
  { id: 'kitchens', label: 'Kitchens', perLabel: 'Boxes per kitchen', count: 1, per: 19, split: { small: 8, medium: 8, large: 3 } },
  { id: 'living', label: 'Living or family rooms', perLabel: 'Boxes per living room', count: 1, per: 10, split: { small: 2, medium: 5, large: 3 } },
  { id: 'dining', label: 'Dining rooms', perLabel: 'Boxes per dining room', count: 1, per: 6, split: { small: 2, medium: 3, large: 1 } },
  { id: 'offices', label: 'Home offices', perLabel: 'Boxes per home office', count: 0, per: 10, split: { small: 5, medium: 4, large: 1 } },
  { id: 'storage', label: 'Garages, basements or storage rooms', perLabel: 'Boxes per garage or storage room', count: 0, per: 15, split: { small: 3, medium: 6, large: 6 } },
];

const SIZES = [
  ['small', 'Small boxes', 'books, tins, heavy items'],
  ['medium', 'Medium boxes', 'kitchenware, toys, small appliances'],
  ['large', 'Large boxes', 'bedding, cushions, light bulky items'],
  ['wardrobe', 'Wardrobe boxes', 'hanging clothes'],
];

const STUFF = { light: 0.75, average: 1, full: 1.35 };
const BOXES_PER_TAPE_ROLL = 15;

export default {
  id: 'boxes',
  slug: 'moving-boxes-calculator',
  name: 'Moving Box Calculator',
  question: 'How many boxes do I need to move?',
  category: 'moving',
  keywords: 'moving boxes packing boxes cartons move house relocation apartment bedrooms tape packing supplies wardrobe',
  title: 'Moving Box Calculator: How Many Boxes Do I Need to Move?',
  description:
    'Free moving box calculator. Enter your rooms and how much stuff you have to see how many small, medium, large and wardrobe boxes to get, plus packing tape.',
  summary: 'Small, medium, large and wardrobe boxes for your move, based on your rooms.',
  intro:
    'Enter the rooms you are packing and roughly how much you own. The calculator uses per-room planning figures, which you can change, to estimate how many boxes of each size you need and how much tape.',
  groups: [
    { id: 'home', legend: 'Your home' },
    { id: 'per', legend: 'Boxes per room (change these if you like)' },
    { id: 'buy', legend: 'Buying' },
    COST_GROUP,
  ],
  inputs: [
    ...ROOMS.map((r) => ({ name: r.id, group: 'home', type: 'count', label: `Number of ${r.label.toLowerCase()}`, default: r.count, max: 50 })),
    {
      name: 'stuff',
      group: 'home',
      type: 'select',
      label: 'How much do you own?',
      default: 'average',
      wide: true,
      options: [
        { value: 'light', label: 'Less than most (minimalist, recently moved): 25% fewer boxes' },
        { value: 'average', label: 'About average' },
        { value: 'full', label: 'More than most (full cupboards, collections): 35% more boxes' },
      ],
    },
    ...ROOMS.map((r) => ({ name: `${r.id}Per`, group: 'per', type: 'count', label: r.perLabel, default: r.per, max: 500 })),
    extraField('extra', 'Extra boxes', 10, 'Spare boxes for the things you forgot. Unused flat-packed boxes are easy to store.', { group: 'buy' }),
    priceField('Price per box (average)'),
  ],

  cost: (r) => ({ count: r.total, unit: 'boxes' }),

  compute(v) {
    const factorStuff = STUFF[v.stuff];
    const exact = { small: 0, medium: 0, large: 0, wardrobe: 0 };
    const perRoom = [];
    for (const room of ROOMS) {
      const rooms = v[room.id];
      if (!rooms) continue;
      const boxes = rooms * v[`${room.id}Per`] * factorStuff;
      const splitTotal = Object.values(room.split).reduce((a, b) => a + b, 0);
      for (const [size, n] of Object.entries(room.split)) exact[size] += (boxes * n) / splitTotal;
      perRoom.push({ label: room.label, rooms, per: v[`${room.id}Per`], boxes });
    }
    const exactTotal = Object.values(exact).reduce((a, b) => a + b, 0);
    if (exactTotal <= 0) return { error: 'Enter at least one room to see an estimate.' };
    const buy = {};
    for (const size of Object.keys(exact)) buy[size] = ceilTo(exact[size] * (1 + v.extra / 100), 1);
    const total = Object.values(buy).reduce((a, b) => a + b, 0);
    const tape = ceilTo(total / BOXES_PER_TAPE_ROLL, 1);
    return { ...v, factorStuff, exact, exactTotal, buy, total, tape, perRoom };
  },

  present(r) {
    const buyRows = SIZES.filter(([size]) => r.buy[size] > 0).map(([size, label, hint]) => ({
      label: `${label} (${hint})`,
      value: fmt(r.buy[size], 0),
    }));
    buyRows.push(
      { label: 'Total boxes', value: fmt(r.total, 0), strong: true },
      { label: 'Packing tape', value: `${r.tape} ${plural(r.tape, 'roll')}` },
    );
    const steps = r.perRoom.map(
      (p) => `${p.label}: ${p.rooms} × ${p.per} boxes${r.factorStuff !== 1 ? ` × ${fmt(r.factorStuff, 2)}` : ''} = ${fmt(p.boxes, 2)}`,
    );
    steps.push(
      `Total before extra = ${fmt(r.exactTotal, 2)} boxes`,
      `Each size with ${pct(r.extra)} extra (× ${factor(r.extra)}), rounded up: ${SIZES.filter(([s]) => r.buy[s] > 0)
        .map(([s, label]) => `${label.replace(' boxes', '').toLowerCase()} ${fmtUp(r.exact[s] * (1 + r.extra / 100), 2)} → ${r.buy[s]}`)
        .join(', ')}`,
      `Tape = ${r.total} boxes ÷ about ${BOXES_PER_TAPE_ROLL} boxes per roll, rounded up = ${r.tape} ${plural(r.tape, 'roll')}`,
    );
    return {
      headline: {
        label: 'Boxes to get',
        value: `${fmt(r.total, 0)} ${plural(r.total, 'box', 'boxes')}`,
        detail: `${SIZES.filter(([s]) => r.buy[s] > 0)
          .map(([s, label]) => `${r.buy[s]} ${label.toLowerCase().replace(' boxes', '')}`)
          .join(', ')}, and ${r.tape} ${plural(r.tape, 'roll')} of tape.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: buyRows },
        {
          title: 'Calculated quantity (no extra)',
          kind: 'exact',
          rows: [
            ...r.perRoom.map((p) => ({ label: `${p.label} (${p.rooms})`, value: `${fmt(p.boxes, 2)} boxes` })),
            { label: 'Total', value: `${fmt(r.exactTotal, 2)} boxes`, strong: true },
          ],
        },
      ],
      steps,
      notes: [
        'Box counts for a move are rules of thumb, not measurements. Walk through your cupboards and adjust the per-room figures if a room is unusually full or empty.',
      ],
    };
  },

  content: [
    {
      heading: 'How the moving box calculation works',
      html: `<ol>
  <li>For each type of room, <strong>boxes = number of rooms × boxes per room</strong>.</li>
  <li>That is multiplied by how much you own: 0.75 for less than most, 1 for average, 1.35 for more than most.</li>
  <li>Each room's boxes are split between sizes in the proportions below, the sizes are added up across rooms, the extra is added, and each size is rounded up.</li>
  <li><strong>Tape</strong>: about one roll per ${BOXES_PER_TAPE_ROLL} boxes, rounded up.</li>
</ol>`,
    },
    {
      heading: 'The starting assumptions',
      html: `<p>There is no formula for how much people own, so the calculator starts from planning figures for an averagely furnished home. Change any "boxes per room" figure to match yours.</p>
<table class="data-table">
  <thead><tr><th scope="col">Room</th><th scope="col">Boxes</th><th scope="col">Small</th><th scope="col">Medium</th><th scope="col">Large</th><th scope="col">Wardrobe</th></tr></thead>
  <tbody>
${ROOMS.map((r) => `    <tr><th scope="row">${r.label}</th><td>${r.per}</td><td>${r.split.small || 0}</td><td>${r.split.medium || 0}</td><td>${r.split.large || 0}</td><td>${r.split.wardrobe || 0}</td></tr>`).join('\n')}
  </tbody>
</table>`,
    },
    {
      heading: 'Choosing box sizes',
      html: `<ul>
  <li><strong>Small boxes</strong> are for heavy things: books, tins, tools and records. A large box of books is too heavy to lift safely.</li>
  <li><strong>Medium boxes</strong> are the workhorse for kitchenware, toys, small appliances and most household items.</li>
  <li><strong>Large boxes</strong> are for light, bulky things like bedding, towels, cushions and lampshades.</li>
  <li><strong>Wardrobe boxes</strong> let clothes travel on their hangers.</li>
</ul>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Each box size is rounded <em>up</em> separately after the extra is added, so the total can be a few boxes more than the unrounded figure.</li>
  <li>Tape is rounded up to whole rolls.</li>
</ul>`,
    },
  ],
};
