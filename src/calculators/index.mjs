// The calculator registry. To add a calculator: create its definition file next to this one,
// import it here and add it to CALCULATORS. The build creates its page, links and sitemap entry.

import paint from './paint.mjs';
import flooring from './flooring.mjs';
import tile from './tile.mjs';
import mulch from './mulch.mjs';
import soil from './soil.mjs';
import gravel from './gravel.mjs';
import concrete from './concrete.mjs';
import storage from './storage.mjs';

export const CATEGORIES = [
  { id: 'home', name: 'Home and DIY', blurb: 'Paint, flooring and tiles for rooms, floors and walls.' },
  { id: 'garden', name: 'Garden and landscaping', blurb: 'Mulch, soil and gravel for beds, paths and yards.' },
  { id: 'building', name: 'Building', blurb: 'Concrete for slabs, patios and pads.' },
  { id: 'digital', name: 'Digital storage', blurb: 'Space for photos, videos, music and files.' },
];

export const CALCULATORS = [paint, flooring, tile, mulch, soil, gravel, concrete, storage];
