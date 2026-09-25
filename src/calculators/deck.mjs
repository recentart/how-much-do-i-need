import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, len, area, pct, factor, priceField, COST_GROUP } from './_shared.mjs';

const SMALL = ['in', 'mm', 'cm'];
const small = (m, s) => withUnit(m, 'length', s === 'metric' ? 'mm' : 'in', (x) => fmt(x, 3));

export default {
  id: 'deck',
  slug: 'deck-calculator',
  name: 'Deck Board Calculator',
  question: 'How many deck boards do I need?',
  category: 'garden',
  keywords: 'deck decking boards composite timber lumber joists screws fasteners patio deck lineal feet',
  title: 'Deck Board Calculator: How Many Deck Boards and Screws Do I Need?',
  description:
    'Free deck board calculator. Enter the deck size, board width, gap and board length to see how many decking boards and screws you need, with a waste allowance.',
  summary: 'Decking boards and screws for a rectangular deck, allowing for gaps and waste.',
  intro:
    'Enter the size of the deck, the width and length of your boards and the gap between them. The calculator works out how many rows of boards fit, the boards to buy and the screws to fix them to the joists.',
  groups: [
    { id: 'deck', legend: 'Deck' },
    { id: 'boards', legend: 'Boards and fixings' },
    COST_GROUP,
  ],
  inputs: [
    lengthField('length', 'Deck length (the way the boards run)', 16, 4.8, { group: 'deck' }),
    lengthField('width', 'Deck width (across the boards)', 12, 3.6, { group: 'deck' }),
    {
      name: 'boardWidth',
      group: 'boards',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Board width (actual)',
      default: { us: [5.5, 'in'], metric: [140, 'mm'] },
      help: 'A "6-inch" board is actually 5.5 in wide. Use the real width.',
    },
    {
      name: 'gap',
      group: 'boards',
      type: 'measure',
      dim: 'length',
      units: SMALL,
      label: 'Gap between boards',
      min: 0,
      default: { us: [0.1875, 'in'], metric: [5, 'mm'] },
      help: '3/16 in = 0.1875 in. Follow the board maker’s spacing.',
    },
    lengthField('boardLength', 'Board length', 16, 4.8, { group: 'boards' }),
    {
      name: 'joistSpacing',
      group: 'boards',
      type: 'measure',
      dim: 'length',
      units: ['in', 'cm', 'mm'],
      label: 'Joist spacing',
      default: { us: [16, 'in'], metric: [40, 'cm'] },
      help: 'Centre to centre. 16 in (40 cm) is common.',
    },
    { name: 'screwsPerJoist', group: 'boards', type: 'count', label: 'Screws per board at each joist', default: 2, min: 1, max: 6 },
    extraField('waste', 'Waste allowance', 10, 'For cuts, ends and boards with defects. Diagonal patterns need more.', { group: 'boards' }),
    priceField('Price per board'),
  ],

  cost: (r) => ({ count: r.boards, unit: 'boards' }),

  compute(v) {
    const rowsExact = v.width / (v.boardWidth + v.gap);
    const rows = ceilTo(rowsExact, 1); // the last row can be ripped narrower
    const boardsPerRow = Math.max(1, v.length / v.boardLength);
    const boardsBase = ceilTo(rows * boardsPerRow, 1);
    const boards = ceilTo(boardsBase * (1 + v.waste / 100), 1);
    const joists = Math.floor(v.length / v.joistSpacing + 1e-9) + 1;
    const screwsBase = rows * joists * v.screwsPerJoist;
    const screws = ceilTo(screwsBase * (1 + v.waste / 100), 1);
    const deckArea = v.length * v.width;
    return { ...v, rowsExact, rows, boardsPerRow, boardsBase, boards, joists, screwsBase, screws, deckArea, lineal: rows * v.length };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    return {
      headline: {
        label: 'Decking to buy',
        value: `${fmt(r.boards, 0)} ${plural(r.boards, 'board')}`,
        detail: `${len(r.boardLength, s)} boards, plus about ${fmt(r.screws, 0)} screws, including ${pct(r.waste)} extra.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: `Boards (${len(r.boardLength, s)} long)`, value: fmt(r.boards, 0), strong: true },
            { label: 'Deck screws', value: fmt(r.screws, 0) },
          ],
        },
        {
          title: 'Calculated quantity (no waste)',
          kind: 'exact',
          rows: [
            { label: 'Deck area', value: area(r.deckArea, s) },
            { label: 'Rows of boards', value: fmt(r.rows, 0) },
            { label: 'Total board length', value: len(r.lineal, s) },
            { label: 'Boards', value: fmt(r.boardsBase, 0), strong: true },
            { label: 'Joists crossed by each row', value: fmt(r.joists, 0) },
            { label: 'Screws', value: fmt(r.screwsBase, 0) },
          ],
        },
      ],
      steps: [
        `Rows = ${len(r.width, s)} ÷ (${small(r.boardWidth, s)} + ${small(r.gap, s)} gap) = ${fmtUp(r.rowsExact, 2)}, rounded up to ${r.rows}`,
        r.length > r.boardLength
          ? `Boards per row = ${len(r.length, s)} ÷ ${len(r.boardLength, s)} = ${fmt(r.boardsPerRow, 2)}; boards = ${r.rows} × ${fmt(r.boardsPerRow, 2)} = ${fmtUp(r.rows * r.boardsPerRow, 2)}, rounded up to ${r.boardsBase}`
          : `One board per row, because ${len(r.boardLength, s)} boards cover the ${len(r.length, s)} length: ${r.boardsBase} boards`,
        `With ${pct(r.waste)} waste = ${r.boardsBase} × ${factor(r.waste)} = ${fmtUp(r.boardsBase * (1 + r.waste / 100), 2)}, rounded up to ${r.boards}`,
        `Joists = ${len(r.length, s)} ÷ ${small(r.joistSpacing, s)} spacing, rounded down, + 1 = ${r.joists}`,
        `Screws = ${r.rows} rows × ${r.joists} joists × ${r.screwsPerJoist} = ${fmt(r.screwsBase, 0)}; with ${pct(r.waste)} extra = ${fmt(r.screws, 0)}`,
      ],
      notes: [
        'When the deck is longer than a board, the count assumes offcuts are reused in other rows. Joints must land on a joist, so plan the layout before buying.',
        'Hidden-fastener systems use clips instead of face screws; follow the maker’s count.',
      ],
    };
  },

  content: [
    {
      heading: 'How the deck board calculation works',
      html: `<ol>
  <li><strong>Rows</strong> = deck width ÷ (board width + gap), rounded up. The last row can be ripped narrower to fit.</li>
  <li><strong>Boards</strong> = rows × (deck length ÷ board length), with at least one board per row, rounded up. Then the waste allowance is added and rounded up again.</li>
  <li><strong>Joists</strong> = deck length ÷ joist spacing, rounded down, plus one.</li>
  <li><strong>Screws</strong> = rows × joists × screws per board at each joist, plus the extra.</li>
</ol>
<p>Use the board's <em>actual</em> width, not its nominal name: a "5/4 × 6" deck board is about 5.5 in (140 mm) wide.</p>`,
    },
    {
      heading: 'Gaps and spacing',
      html: `<p>Deck boards need gaps for drainage and movement. Wood that is still wet from treatment shrinks as it dries, so it is often laid tight, while kiln-dried and composite boards are usually spaced at around 1/8–1/4 in (3–6 mm). Composite makers publish exact gap and joist-spacing requirements, and they must be followed for the warranty.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Rows and boards are rounded <em>up</em>, before and after the waste allowance.</li>
  <li>Joists are counted by rounding the spacing division <em>down</em> and adding the end joist.</li>
  <li>Screws are rounded up to a whole screw. They are usually sold by the box or by weight.</li>
</ul>`,
    },
  ],
};
