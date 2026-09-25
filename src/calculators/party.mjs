import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import { extraField, systemOf, pct, factor, priceField, COST_GROUP } from './_shared.mjs';

const mass = (kg, s) => withUnit(kg, 'mass', s === 'metric' ? 'kg' : 'lb', (x) => fmt(x, 1));

export default {
  id: 'party',
  slug: 'party-food-calculator',
  name: 'Party Food and Drink Calculator',
  question: 'How much food and drink do I need for a party?',
  category: 'events',
  keywords: 'party food drinks pizza how many pizzas ice cups plates napkins guests birthday event catering',
  title: 'Party Calculator: How Much Pizza, Drinks and Ice for a Party?',
  description:
    'Free party food calculator. Enter your guests and how long the party lasts to see how many pizzas, drinks, bags of ice, plates, cups and napkins to get.',
  summary: 'Pizzas, drinks, ice, plates, cups and napkins for a party of any size.',
  intro:
    'Enter how many adults and children are coming and how long the party lasts. The calculator uses common catering rules of thumb, which you can change, to estimate pizzas, drinks, ice and tableware.',
  groups: [
    { id: 'guests', legend: 'Guests' },
    { id: 'food', legend: 'Pizza' },
    { id: 'drinks', legend: 'Drinks and ice' },
    { id: 'table', legend: 'Tableware' },
    COST_GROUP,
  ],
  inputs: [
    { name: 'adults', group: 'guests', type: 'count', label: 'Adults and teens', default: 20, max: 100000 },
    { name: 'kids', group: 'guests', type: 'count', label: 'Children', default: 5, max: 100000 },
    { name: 'hours', group: 'guests', type: 'number', label: 'Party length (hours)', default: 3, gt: true, min: 0, max: 24 },
    { name: 'slicesAdult', group: 'food', type: 'number', label: 'Slices per adult', default: 3, min: 0, max: 20 },
    { name: 'slicesKid', group: 'food', type: 'number', label: 'Slices per child', default: 2, min: 0, max: 20 },
    { name: 'slicesPerPizza', group: 'food', type: 'count', label: 'Slices per pizza', default: 8, min: 1, max: 32, help: 'A large pizza is usually cut into 8 slices.' },
    { name: 'drinksFirst', group: 'drinks', type: 'number', label: 'Drinks per person in the first hour', default: 2, min: 0, max: 20 },
    { name: 'drinksLater', group: 'drinks', type: 'number', label: 'Drinks per person each hour after', default: 1, min: 0, max: 20 },
    {
      name: 'ice',
      group: 'drinks',
      type: 'measure',
      dim: 'mass',
      units: ['lb', 'kg'],
      label: 'Ice per person',
      min: 0,
      default: { us: [1, 'lb'], metric: [0.5, 'kg'] },
      help: 'Around 1 lb (0.5 kg) per person; double it in hot weather or if ice also chills the drinks.',
    },
    { name: 'iceBag', group: 'drinks', type: 'measure', dim: 'mass', units: ['lb', 'kg'], label: 'Ice bag size', default: { us: [10, 'lb'], metric: [2, 'kg'] } },
    { name: 'plates', group: 'table', type: 'number', label: 'Plates per person', default: 2, min: 0, max: 20 },
    { name: 'cups', group: 'table', type: 'number', label: 'Cups per person', default: 2, min: 0, max: 20 },
    { name: 'napkins', group: 'table', type: 'number', label: 'Napkins per person', default: 3, min: 0, max: 20 },
    extraField('extra', 'Extra for unexpected guests', 10, 'Running out is worse than leftovers. 10% is a common cushion.', { group: 'table' }),
    priceField('Price per pizza'),
  ],

  cost: (r) => ({ count: r.pizzas, unit: 'pizzas' }),

  compute(v) {
    const people = v.adults + v.kids;
    if (people <= 0) return { error: 'Enter at least one guest to see an estimate.' };
    const k = 1 + v.extra / 100;
    const slices = v.adults * v.slicesAdult + v.kids * v.slicesKid;
    const pizzas = ceilTo((slices * k) / v.slicesPerPizza, 1);
    const drinksEach = v.drinksFirst + Math.max(0, v.hours - 1) * v.drinksLater;
    const drinksExact = people * drinksEach;
    const drinks = ceilTo(drinksExact * k, 1);
    const iceExact = people * v.ice;
    const iceBags = ceilTo((iceExact * k) / v.iceBag, 1);
    const plates = ceilTo(people * v.plates * k, 1);
    const cups = ceilTo(people * v.cups * k, 1);
    const napkins = ceilTo(people * v.napkins * k, 1);
    return { ...v, people, k, slices, pizzas, drinksEach, drinksExact, drinks, iceExact, iceBags, plates, cups, napkins };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const rows = [
      { label: `Pizzas (${r.slicesPerPizza} slices each)`, value: fmt(r.pizzas, 0), strong: true },
      { label: 'Drinks (cans, bottles or glasses)', value: fmt(r.drinks, 0), strong: true },
      { label: `Bags of ice (${mass(r.iceBag, s)})`, value: fmt(r.iceBags, 0) },
      { label: 'Plates', value: fmt(r.plates, 0) },
      { label: 'Cups', value: fmt(r.cups, 0) },
      { label: 'Napkins', value: fmt(r.napkins, 0) },
    ];
    return {
      headline: {
        label: `For ${fmt(r.people, 0)} ${plural(r.people, 'guest')}`,
        value: `${fmt(r.pizzas, 0)} ${plural(r.pizzas, 'pizza')}, ${fmt(r.drinks, 0)} ${plural(r.drinks, 'drink')}`,
        detail: `${fmt(r.iceBags, 0)} ${plural(r.iceBags, 'bag')} of ice for a ${fmt(r.hours, 1)}-hour party, including ${pct(r.extra)} extra.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows },
        {
          title: 'Calculated quantity (no extra)',
          kind: 'exact',
          rows: [
            { label: 'Guests', value: fmt(r.people, 0) },
            { label: 'Slices', value: fmt(r.slices, 1) },
            { label: 'Pizzas', value: fmt(r.slices / r.slicesPerPizza, 2), strong: true },
            { label: 'Drinks', value: fmt(r.drinksExact, 1), strong: true },
            { label: 'Ice', value: mass(r.iceExact, s) },
          ],
        },
      ],
      steps: [
        `Slices = ${r.adults} adults × ${fmt(r.slicesAdult, 2)} + ${r.kids} children × ${fmt(r.slicesKid, 2)} = ${fmt(r.slices, 1)}`,
        `Pizzas = ${fmt(r.slices, 1)} × ${factor(r.extra)} ÷ ${r.slicesPerPizza} slices = ${fmtUp((r.slices * r.k) / r.slicesPerPizza, 2)}, rounded up to ${r.pizzas}`,
        `Drinks per person = ${fmt(r.drinksFirst, 2)} in the first hour + ${fmt(Math.max(0, r.hours - 1), 2)} more hours × ${fmt(r.drinksLater, 2)} = ${fmt(r.drinksEach, 2)}`,
        `Drinks = ${r.people} × ${fmt(r.drinksEach, 2)} × ${factor(r.extra)} = ${fmtUp(r.drinksExact * r.k, 2)}, rounded up to ${r.drinks}`,
        `Ice = ${r.people} × ${mass(r.ice, s)} × ${factor(r.extra)} ÷ ${mass(r.iceBag, s)} per bag = ${fmtUp((r.iceExact * r.k) / r.iceBag, 2)}, rounded up to ${r.iceBags}`,
        `Plates, cups and napkins = ${r.people} guests × the number per person × ${factor(r.extra)}, rounded up`,
      ],
      notes: [
        'These are rules of thumb. Appetites depend on the time of day, what else is served and who is coming. A lunchtime party with lots of other food needs less pizza than a dinner.',
      ],
    };
  },

  content: [
    {
      heading: 'How the party calculation works',
      html: `<ol>
  <li><strong>Pizzas</strong> = (adults × slices per adult + children × slices per child) × the extra ÷ slices per pizza, rounded up.</li>
  <li><strong>Drinks</strong> = guests × (drinks in the first hour + drinks per hour after × the remaining hours) × the extra, rounded up.</li>
  <li><strong>Ice</strong> = guests × ice per person × the extra ÷ bag size, rounded up.</li>
  <li><strong>Plates, cups and napkins</strong> = guests × the number per person × the extra, rounded up.</li>
</ol>`,
    },
    {
      heading: 'The starting rules of thumb',
      html: `<p>The defaults follow common party-planning guidance, and every one can be changed:</p>
<ul>
  <li>About 3 slices of pizza per adult and 2 per child when pizza is the main food.</li>
  <li>About 2 drinks per person in the first hour and 1 per hour after that.</li>
  <li>About 1 lb (0.5 kg) of ice per person for drinks. Double it if the ice also has to chill bottles in a cooler.</li>
  <li>A couple of plates and cups and a few napkins per person, because people put them down and take new ones.</li>
</ul>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Every item is rounded <em>up</em> to a whole pizza, drink, bag or piece after the extra is added.</li>
  <li>The exact quantities, before extra and rounding, are shown separately.</li>
</ul>`,
    },
  ],
};
