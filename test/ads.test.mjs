// Ads: the consent rules, unit choice, and what the build outputs with ad units configured.
// The real site config has no ad units until an Adsterra account exists, so the build part uses
// the stub config in fixtures/stub-ads.mjs.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { ADS, adsEnabled } from '../src/site.config.mjs';
import { CALCULATORS } from '../src/calculators/index.mjs';
import { decide, needsConsent, pickUnit } from '../src/lib/ads.mjs';
import { parseHeaders } from '../scripts/serve.mjs';
import { STUB_ADS } from './fixtures/stub-ads.mjs';

test('consent is asked for in EU, EEA, UK and Swiss time zones only', () => {
  for (const tz of ['Europe/Berlin', 'Europe/London', 'Europe/Zurich', 'Europe/Dublin', 'Atlantic/Canary', 'Asia/Nicosia', 'Atlantic/Reykjavik']) {
    assert.ok(needsConsent(tz), tz);
  }
  for (const tz of ['America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'Asia/Tokyo', 'UTC', '', undefined]) {
    assert.ok(!needsConsent(tz), String(tz));
  }
});

test('a stored choice always wins over the time zone', () => {
  assert.equal(decide(null, 'Europe/Paris'), 'ask');
  assert.equal(decide(null, 'America/Chicago'), 'show');
  assert.equal(decide('yes', 'Europe/Paris'), 'show');
  assert.equal(decide('no', 'America/Chicago'), 'hide');
  assert.equal(decide('garbage', 'Europe/Paris'), 'ask');
});

test('the widest unit that fits is chosen, or none', () => {
  const units = [{ width: 468 }, { width: 320 }];
  assert.equal(pickUnit(units, 700).width, 468);
  assert.equal(pickUnit(units, 468).width, 468);
  assert.equal(pickUnit(units, 467).width, 320);
  assert.equal(pickUnit(units, 288), null);
});

test('the live config is on, and every filled-in unit is complete', () => {
  assert.equal(adsEnabled(ADS), true);
  for (const [id, u] of Object.entries(ADS.units)) {
    if (!u.key && !u.src) continue;
    assert.match(u.src, /^https:\/\/[^/]+\/.+/, `${id}: script URL`);
    assert.match(u.key, /^[0-9a-f]{32}$/, `${id}: key`);
    assert.ok(u.src.includes(u.key), `${id}: script URL doesn't match its key`);
  }
});

let out;
let pages;
before(() => {
  out = mkdtempSync(path.join(tmpdir(), 'hmdin-ads-'));
  pages = build({ outDir: out, quiet: true, ads: STUB_ADS }).pages;
});
after(() => rmSync(out, { recursive: true, force: true }));

const read = (rel) => readFileSync(path.join(out, rel), 'utf8');
const pageHtml = (p) => read(path.join(p, 'index.html'));

test('calculator pages get two hidden slots and no ad between the form and the result', () => {
  for (const def of CALCULATORS) {
    const h = pageHtml(`/${def.slug}/`);
    const slots = [...h.matchAll(/<aside class="ad-slot[^"]*" data-ad-slot="([^"]+)"[^>]*\bhidden>/g)].map((m) => m[1]);
    assert.deepEqual(slots, ['below-result', 'sidebar'], def.id);
    assert.ok(h.indexOf('data-ad-slot="below-result"') > h.indexOf('id="calc-result"'), `${def.id}: ad above the result`);
    assert.ok(!h.includes('in-content'), `${def.id}: in-content slot still present`);
    assert.match(h, /data-min-viewport="1100"/);
  }
});

test('slots list their units widest first, pointing at local frame pages', () => {
  const h = pageHtml('/paint-calculator/');
  const units = JSON.parse(h.match(/data-ad-slot="below-result" data-ad-units="([^"]+)"/)[1].replace(/&quot;/g, '"'));
  assert.deepEqual(units, [
    { frame: '/ads/banner-468x60.html', width: 468, height: 60 },
    { frame: '/ads/banner-320x50.html', width: 320, height: 50 },
  ]);
});

test('every page loads the ad script, the consent bar and the Ad choices button, but no third-party code', () => {
  for (const p of pages) {
    const h = pageHtml(p);
    assert.match(h, /<script type="module" src="\/assets\/js\/lib\/ads\.mjs"><\/script>/, p);
    assert.match(h, /<div id="ad-consent" class="ad-consent" role="region" aria-label="Ad choices" hidden>/, p);
    assert.match(h, /data-ad-choices hidden>Ad choices<\/button>/, p);
    assert.ok(!/<script[^>]+src="https?:/.test(h), `${p} loads a third-party script directly`);
    assert.ok(!h.includes('ads.example.test'), `${p} mentions the ad network's script`);
  }
  assert.ok(existsSync(path.join(out, 'assets/js/lib/ads.mjs')));
});

test('each unit gets a frame page with its options and the escaped network script', () => {
  const h = read('ads/banner-468x60.html');
  assert.match(h, /<script src="\/ads\/banner-468x60\.js"><\/script>\n<script src="https:\/\/ads\.example\.test\/k468\/invoke\.js\?a=1&amp;b=&quot;x&quot;"><\/script>/);
  assert.match(h, /<meta name="robots" content="noindex">/);
  assert.equal(read('ads/banner-468x60.js'), 'window.atOptions = {"key":"k468","format":"iframe","height":60,"width":468,"params":{}};\n');
  assert.ok(existsSync(path.join(out, 'ads/frame.css')));
});

test('privacy, about and home pages describe the ads once they are on', () => {
  const privacy = pageHtml('/privacy/');
  assert.match(privacy, /<h2 id="ads">Advertising<\/h2>/);
  assert.match(privacy, /Adsterra/);
  assert.match(privacy, /href="https:\/\/adsterra\.com\/privacy-policy\/"/);
  assert.ok(!/sets no cookies\.<\/li>\s*<li>There are no analytics, tracking pixels, advertising scripts/.test(privacy));
  assert.ok(!pageHtml('/').includes('no ads'));
  assert.match(pageHtml('/about/'), /ads from Adsterra/);
});

test('the ad frames get their own policy; every other page keeps the strict one', () => {
  const headersFor = parseHeaders(read('_headers'));
  const page = headersFor('/paint-calculator/');
  assert.match(page['Content-Security-Policy'], /script-src 'self';/);
  assert.equal(page['X-Frame-Options'], 'DENY');
  const frame = headersFor('/ads/banner-320x50.html');
  assert.match(frame['Content-Security-Policy'], /frame-ancestors 'self'/);
  assert.ok(!frame['Content-Security-Policy'].includes(','), 'two policies were merged');
  assert.equal(frame['X-Frame-Options'], 'SAMEORIGIN');
});
