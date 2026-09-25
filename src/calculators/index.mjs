// The calculator registry. To add a calculator: create its definition file next to this one,
// import it here and add it to CALCULATORS. The build creates its page, links and sitemap entry.

import paint from './paint.mjs';
import wallpaper from './wallpaper.mjs';
import flooring from './flooring.mjs';
import tile from './tile.mjs';
import drywall from './drywall.mjs';
import insulation from './insulation.mjs';
import mulch from './mulch.mjs';
import soil from './soil.mjs';
import gravel from './gravel.mjs';
import lawn from './lawn.mjs';
import fence from './fence.mjs';
import deck from './deck.mjs';
import paver from './paver.mjs';
import retainingWall from './retaining-wall.mjs';
import pool from './pool.mjs';
import concrete from './concrete.mjs';
import brick from './brick.mjs';
import roofing from './roofing.mjs';
import boxes from './boxes.mjs';
import truck from './truck.mjs';
import party from './party.mjs';
import storage from './storage.mjs';
import internet from './internet.mjs';

export const CATEGORIES = [
  { id: 'home', name: 'Home and DIY', blurb: 'Paint, wallpaper, flooring, tiles, drywall and insulation for rooms, floors and walls.' },
  { id: 'garden', name: 'Garden and landscaping', blurb: 'Mulch, soil, gravel, lawns, fences, decks, paving, walls and pools.' },
  { id: 'building', name: 'Building', blurb: 'Concrete, bricks and roofing.' },
  { id: 'moving', name: 'Moving house', blurb: 'Boxes and the right size of truck.' },
  { id: 'events', name: 'Parties and events', blurb: 'Food, drinks and supplies for your guests.' },
  { id: 'digital', name: 'Digital', blurb: 'Storage space and internet speed and data.' },
];

export const CALCULATORS = [
  paint,
  wallpaper,
  flooring,
  tile,
  drywall,
  insulation,
  mulch,
  soil,
  gravel,
  lawn,
  fence,
  deck,
  paver,
  retainingWall,
  pool,
  concrete,
  brick,
  roofing,
  boxes,
  truck,
  party,
  storage,
  internet,
];
