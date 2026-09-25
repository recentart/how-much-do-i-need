import { fmt, fmtUp, ceilTo, fromBase, toBase, plural } from '../lib/units.mjs';
import { extraField, systemOf, pct, priceField, COST_GROUP } from './_shared.mjs';

// Approximate cargo space of common rental sizes. Figures vary by company and model.
export const TRUCKS = [
  { name: 'Cargo van', ft3: 245 },
  { name: '10 ft truck', ft3: 400 },
  { name: '15 ft truck', ft3: 760 },
  { name: '20 ft truck', ft3: 1015 },
  { name: '26 ft truck', ft3: 1680 },
];

const STUFF = { light: 0.8, average: 1, full: 1.25 };
const vol = (m3, s) => (s === 'metric' ? `${fmt(m3, 1)} m³` : `${fmt(fromBase(m3, 'volume', 'ft3'), 0)} ft³`);

export default {
  id: 'truck',
  slug: 'moving-truck-size-calculator',
  name: 'Moving Truck Size Calculator',
  question: 'What size moving truck do I need?',
  category: 'moving',
  keywords: 'moving truck size van rental truck cubic feet move house relocation 10 ft 15 ft 20 ft 26 ft bedrooms',
  title: 'Moving Truck Size Calculator: What Size Truck Do I Need?',
  description:
    'Free moving truck size calculator. Enter your rooms and how much you own to estimate the cubic feet of belongings and the smallest rental truck that fits.',
  summary: 'The volume of your belongings and the rental van or truck size that fits them.',
  intro:
    'Enter the rooms you are moving and roughly how much you own. The calculator estimates the volume of your furniture and boxes, allows for the space you can’t fill in a truck, and suggests a truck size.',
  groups: [
    { id: 'home', legend: 'Your home' },
    { id: 'assume', legend: 'Assumptions' },
    COST_GROUP,
  ],
  inputs: [
    { name: 'bedrooms', group: 'home', type: 'count', label: 'Number of bedrooms', default: 2, max: 50 },
    { name: 'otherRooms', group: 'home', type: 'count', label: 'Other furnished rooms', default: 2, max: 50, help: 'Living room, dining room, home office, and so on. The kitchen counts too if you are taking its furniture and appliances.' },
    { name: 'storage', group: 'home', type: 'count', label: 'Garages, sheds or storage rooms', default: 0, max: 20 },
    {
      name: 'stuff',
      group: 'home',
      type: 'select',
      label: 'How much do you own?',
      default: 'average',
      wide: true,
      options: [
        { value: 'light', label: 'Less than most: 20% less' },
        { value: 'average', label: 'About average' },
        { value: 'full', label: 'More than most: 25% more' },
      ],
    },
    {
      name: 'perRoom',
      group: 'assume',
      type: 'measure',
      dim: 'volume',
      units: ['ft3', 'm3'],
      label: 'Space per furnished room',
      default: { us: [150, 'ft3'], metric: [4.25, 'm3'] },
      help: 'A common rule of thumb is roughly 150–200 ft³ (4–6 m³) per furnished room, including its boxes.',
    },
    extraField('usable', 'Truck space you can actually fill', 85, 'Furniture and boxes never pack perfectly. 80–90% is typical for a careful load.', { group: 'assume', min: 1 }),
    priceField('Rental price per truck'),
  ],

  cost: (r) => ({ count: r.count, unit: plural(r.count, 'truck') }),

  compute(v) {
    const rooms = v.bedrooms + v.otherRooms + v.storage;
    if (rooms <= 0) return { error: 'Enter at least one room to see an estimate.' };
    const belongings = rooms * v.perRoom * STUFF[v.stuff];
    const needed = belongings / (v.usable / 100);
    const neededFt3 = fromBase(needed, 'volume', 'ft3');
    const fit = TRUCKS.find((t) => t.ft3 + 1e-9 >= neededFt3);
    const biggest = TRUCKS[TRUCKS.length - 1];
    const count = fit ? 1 : ceilTo(neededFt3 / biggest.ft3, 1);
    const truck = fit || biggest;
    return { ...v, rooms, belongings, needed, neededFt3, truck, count, truckVolume: toBase(truck.ft3, 'volume', 'ft3') };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const value = r.count === 1 ? r.truck.name : `${r.count} × ${r.truck.name}`;
    return {
      headline: {
        label: 'Truck to rent',
        value,
        detail: `Your belongings take about ${vol(r.belongings, s)}; allowing for gaps you need ${vol(r.needed, s)} of cargo space.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: 'Suggested size', value, strong: true },
            { label: 'Its approximate cargo space', value: `${vol(r.truckVolume, s)}${r.count > 1 ? ' each' : ''}` },
          ],
        },
        {
          title: 'Calculated quantity (no allowance)',
          kind: 'exact',
          rows: [
            { label: 'Rooms', value: fmt(r.rooms, 0) },
            { label: 'Belongings', value: vol(r.belongings, s), strong: true },
            { label: `Cargo space needed at ${pct(r.usable)} usable`, value: vol(r.needed, s) },
          ],
        },
      ],
      steps: [
        `Rooms = ${r.bedrooms} bedrooms + ${r.otherRooms} other + ${r.storage} storage = ${r.rooms}`,
        `Belongings = ${r.rooms} × ${vol(r.perRoom, s)}${STUFF[r.stuff] !== 1 ? ` × ${fmt(STUFF[r.stuff], 2)}` : ''} = ${vol(r.belongings, s)}`,
        `Space needed = ${vol(r.belongings, s)} ÷ ${pct(r.usable)} usable = ${vol(r.needed, s)}`,
        r.count === 1
          ? `Smallest size with at least ${vol(r.needed, s)}: ${r.truck.name} (about ${vol(r.truckVolume, s)})`
          : `More than one ${r.truck.name} holds: ${fmtUp(r.neededFt3 / r.truck.ft3, 2)}, rounded up to ${r.count} trucks or trips`,
      ],
      notes: [
        'Truck capacities are approximate and differ between rental companies. Check the cargo volume on the company’s website before booking.',
        'Large awkward items such as sectional sofas or pianos can need more space than their room suggests.',
      ],
    };
  },

  content: [
    {
      heading: 'How the truck size calculation works',
      html: `<ol>
  <li><strong>Belongings</strong> = number of furnished rooms × space per room × how much you own (0.8, 1 or 1.25).</li>
  <li><strong>Cargo space needed</strong> = belongings ÷ the share of the truck you can actually fill.</li>
  <li><strong>Truck</strong> = the smallest common size with at least that much space, or several of the largest size.</li>
</ol>`,
    },
    {
      heading: 'Approximate truck sizes',
      html: `<table class="data-table">
  <thead><tr><th scope="col">Size</th><th scope="col">Cargo space</th><th scope="col">Often suits</th></tr></thead>
  <tbody>
    <tr><th scope="row">Cargo van</th><td>about 245 ft³ (7 m³)</td><td>a studio or a few large items</td></tr>
    <tr><th scope="row">10 ft truck</th><td>about 400 ft³ (11 m³)</td><td>a studio or 1-bedroom home</td></tr>
    <tr><th scope="row">15 ft truck</th><td>about 760 ft³ (22 m³)</td><td>1 to 2 bedrooms</td></tr>
    <tr><th scope="row">20 ft truck</th><td>about 1,015 ft³ (29 m³)</td><td>2 to 3 bedrooms</td></tr>
    <tr><th scope="row">26 ft truck</th><td>about 1,680 ft³ (48 m³)</td><td>3 to 5 bedrooms</td></tr>
  </tbody>
</table>
<p>These are typical figures for rental trucks; exact capacities vary. If you are between sizes, the bigger truck is usually the safer choice. A second trip can cost more than the upgrade.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>The suggestion is always the next size <em>up</em> that holds the estimate.</li>
  <li>Past the largest common size, the number of trucks (or trips) is rounded up.</li>
</ul>`,
    },
  ],
};
