import { fmt, fmtUp, ceilTo, plural, withUnit } from '../lib/units.mjs';
import { lengthField, extraField, systemOf, other, len, area, pct, factor } from './_shared.mjs';

const TILE_UNITS = ['in', 'cm', 'mm', 'ft', 'm'];
const tileLen = (m, s) => withUnit(m, 'length', s === 'metric' ? 'cm' : 'in');
const jointLen = (m, s) => withUnit(m, 'length', s === 'metric' ? 'mm' : 'in', (x) => fmt(x, 3));
// Tile faces are small, so show them in in² / cm² rather than ft² / m².
const tileArea = (m2, s) => (s === 'metric' ? `${fmt(m2 * 1e4, 1)} cm²` : `${fmt(m2 / 0.00064516, 2)} in²`);

export default {
  id: 'tile',
  slug: 'tile-calculator',
  name: 'Tile Calculator',
  question: 'How many tiles do I need?',
  category: 'home',
  keywords: 'tile tiles tiling floor tiles wall tiles backsplash splashback bathroom kitchen shower grout joint boxes ceramic porcelain',
  title: 'Tile Calculator: How Many Tiles Do I Need? (With Grout & Waste)',
  description:
    'Free tile calculator for floors and walls. Enter the area, tile size and grout joint to see how many tiles and boxes you need, with a waste allowance for cuts.',
  summary: 'Number of tiles and boxes for a floor or wall, allowing for grout joints and cuts.',
  intro:
    'Enter the size of the area, the size of one tile and the grout joint width. The calculator works out how many tiles fit, adds a waste allowance for cuts and breakage, and rounds up to whole tiles and boxes.',
  groups: [
    { id: 'area', legend: 'Area to tile' },
    { id: 'tile', legend: 'Tile' },
  ],
  inputs: [
    lengthField('length', 'Area length', 10, 3, { group: 'area' }),
    lengthField('width', 'Area width', 8, 2.4, { group: 'area', help: 'For a wall, use its width and height.' }),
    {
      name: 'tileLength',
      group: 'tile',
      type: 'measure',
      dim: 'length',
      units: TILE_UNITS,
      label: 'Tile length',
      default: { us: [12, 'in'], metric: [30, 'cm'] },
    },
    {
      name: 'tileWidth',
      group: 'tile',
      type: 'measure',
      dim: 'length',
      units: TILE_UNITS,
      label: 'Tile width',
      default: { us: [12, 'in'], metric: [30, 'cm'] },
    },
    {
      name: 'joint',
      group: 'tile',
      type: 'measure',
      dim: 'length',
      units: ['in', 'mm', 'cm'],
      label: 'Grout joint width',
      min: 0,
      default: { us: [0.125, 'in'], metric: [3, 'mm'] },
      help: '1/8 in = 0.125 in (about 3 mm). Enter 0 to ignore joints.',
    },
    extraField('waste', 'Waste allowance', 10, 'About 10% for a straight layout; 15% or more for diagonal or patterned layouts.', {
      group: 'tile',
    }),
    { name: 'perBox', group: 'tile', type: 'count', label: 'Tiles per box', optional: true, default: 10, min: 1, help: 'Leave blank if you are buying single tiles.' },
  ],

  compute(v) {
    const surface = v.length * v.width;
    const tileFace = v.tileLength * v.tileWidth;
    const cell = (v.tileLength + v.joint) * (v.tileWidth + v.joint); // one tile plus its share of joint
    const tilesExact = surface / cell;
    const tilesWithWaste = tilesExact * (1 + v.waste / 100);
    const tiles = ceilTo(tilesWithWaste, 1);
    const hasBoxes = v.perBox != null;
    const boxes = hasBoxes ? ceilTo(tiles / v.perBox, 1) : null;
    return { ...v, surface, tileFace, cell, tilesExact, tilesWithWaste, tiles, hasBoxes, boxes };
  },

  present(r, ctx) {
    const s = systemOf(ctx);
    const o = other(s);
    const tileWord = plural(r.tiles, 'tile');
    const boxWord = r.hasBoxes ? plural(r.boxes, 'box', 'boxes') : '';
    const buyRows = [{ label: 'Tiles', value: `${fmt(r.tiles, 0)} ${tileWord}`, strong: true }];
    if (r.hasBoxes) {
      buyRows.push(
        { label: `Boxes (${r.perBox} per box)`, value: `${fmt(r.boxes, 0)} ${boxWord}`, strong: true },
        { label: 'Tiles in those boxes', value: fmt(r.boxes * r.perBox, 0) },
      );
    }
    const steps = [
      `Area = ${len(r.length, s)} × ${len(r.width, s)} = ${area(r.surface, s)}`,
      `Space per tile = (${tileLen(r.tileLength, s)} + ${jointLen(r.joint, s)}) × (${tileLen(r.tileWidth, s)} + ${jointLen(r.joint, s)}) = ${tileArea(r.cell, s)}`,
      `Tiles = ${area(r.surface, s)} (${tileArea(r.surface, s)}) ÷ ${tileArea(r.cell, s)} = ${fmt(r.tilesExact, 2)}`,
      `With ${pct(r.waste)} waste = ${fmt(r.tilesExact, 2)} × ${factor(r.waste)} = ${fmtUp(r.tilesWithWaste, 2)}, rounded up to ${fmt(r.tiles, 0)}`,
    ];
    if (r.hasBoxes) {
      const exact = r.tiles % r.perBox === 0;
      steps.push(
        `Boxes = ${fmt(r.tiles, 0)} ÷ ${r.perBox} per box = ${exact ? `${fmt(r.boxes, 0)} ${boxWord}` : `${fmtUp(r.tiles / r.perBox, 2)}, rounded up to ${fmt(r.boxes, 0)}`}`,
      );
    }
    return {
      headline: {
        label: 'Tiles to buy',
        value: r.hasBoxes ? `${fmt(r.boxes, 0)} ${boxWord}` : `${fmt(r.tiles, 0)} ${tileWord}`,
        detail: r.hasBoxes
          ? `${fmt(r.tiles, 0)} ${tileWord} needed, including ${pct(r.waste)} waste, for ${area(r.surface, s)}.`
          : `Includes ${pct(r.waste)} waste, for ${area(r.surface, s)}.`,
      },
      sections: [
        { title: 'Estimated amount to buy', kind: 'buy', rows: buyRows },
        {
          title: 'Calculated quantity (no waste)',
          kind: 'exact',
          rows: [
            { label: 'Area to tile', value: `${area(r.surface, s)} (${area(r.surface, o)})` },
            { label: 'Tile face', value: tileArea(r.tileFace, s) },
            { label: 'Tile plus joint', value: tileArea(r.cell, s) },
            { label: 'Tiles to cover the area', value: fmt(r.tilesExact, 2), strong: true },
          ],
        },
      ],
      steps,
      notes: ['Cut pieces at the edges can rarely be reused elsewhere, which is what the waste allowance covers.'],
    };
  },

  content: [
    {
      heading: 'How the tile calculation works',
      html: `<ol>
  <li><strong>Area</strong> = length × width of the floor or wall.</li>
  <li><strong>Space per tile</strong> = (tile length + joint width) × (tile width + joint width). Each tile effectively takes up its own face plus one joint on two sides.</li>
  <li><strong>Tiles</strong> = area ÷ space per tile.</li>
  <li><strong>Add waste</strong>: tiles × (1 + waste ÷ 100), then round up to a whole tile.</li>
  <li><strong>Boxes</strong> (optional) = tiles ÷ tiles per box, rounded up.</li>
</ol>
<p>All measurements are converted to the same unit first, so you can enter the room in feet and the tiles in inches, or the room in metres and the tiles in centimetres.</p>`,
    },
    {
      heading: 'Choosing a waste allowance',
      html: `<p>These are common rules of thumb:</p>
<ul>
  <li><strong>About 10%</strong> for a straight grid in a simple rectangular room.</li>
  <li><strong>15% or more</strong> for diagonal layouts, herringbone and other patterns, or rooms with many corners and obstacles.</li>
  <li><strong>More</strong> for large-format or fragile tiles, where one broken tile is a bigger share of the total.</li>
</ul>
<p>Keeping a few spare tiles from the same batch makes future repairs much easier, because colours can vary between production runs.</p>`,
    },
    {
      heading: 'Grout joint width',
      html: `<p>Joint widths typically range from about 1/16 in (1.5 mm) for tight wall tiles to 3/8 in (10 mm) or more for rustic floor tiles. Follow the tile manufacturer's recommendation. Wider joints mean slightly fewer tiles, and the calculator accounts for that. Enter 0 to ignore joints.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Tiles are rounded <em>up</em> to a whole tile after the waste allowance is added.</li>
  <li>Boxes are rounded <em>up</em> to a whole box.</li>
  <li>The exact number of tiles that covers the area, before waste and rounding, is shown separately.</li>
</ul>`,
    },
  ],
};
