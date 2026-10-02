// Browser tests for ads, against a build with stub ad units (the real config has none until an
// Adsterra account exists). The ad network's script is answered by a local stub through the
// DevTools Fetch domain, so nothing leaves the machine.
//   node test/e2e/ads.mjs

import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launch } from './cdp.mjs';
import { createStaticServer } from '../../scripts/serve.mjs';
import { build } from '../../scripts/build.mjs';
import { STUB_ADS } from '../fixtures/stub-ads.mjs';

const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const out = mkdtempSync(path.join(tmpdir(), 'hmdin-ads-e2e-'));
build({ outDir: out, quiet: true, ads: STUB_ADS });
const server = createStaticServer(out);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
console.log(`Testing ads on ${BASE}\n`);

// Stands in for Adsterra's invoke.js: writes a box of the configured size, and tries to reach
// into the page and to navigate it, which the sandbox must stop.
const STUB = `
document.write('<div id="stub-ad" style="width:' + atOptions.width + 'px;height:' + atOptions.height + 'px;background:#fc0">AD ' + atOptions.key + '</div>');
try { parent.document.body.dataset.leak = 'yes'; } catch (e) {}
try { localStorage.setItem('leak', 'yes'); } catch (e) {}
try { top.location.href = 'https://example.org/'; } catch (e) {}
`;

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`  ✖ ${name}\n      ${e.message.split('\n').join('\n      ')}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const eq = (actual, expected, what) => expect(actual === expected, `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launch();
const page = await browser.newPage();
// Sandboxed frames run out of process, so they are separate DevTools targets: attach to each one
// as it starts, answer its requests for the ad network's script with the stub, then let it run.
const frameSessions = new Set();
const fulfill = (sid, requestId) =>
  page.conn.send('Fetch.fulfillRequest', {
    requestId,
    responseCode: 200,
    responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }],
    body: Buffer.from(STUB).toString('base64'),
  }, sid).catch(() => {});
page.conn.listeners.add((msg) => {
  if (msg.method === 'Target.attachedToTarget' && msg.sessionId === page.sessionId) {
    const sid = msg.params.sessionId;
    frameSessions.add(sid);
    page.conn
      .send('Fetch.enable', { patterns: [{ urlPattern: 'https://ads.example.test/*' }] }, sid)
      .then(() => page.conn.send('Runtime.runIfWaitingForDebugger', {}, sid))
      .catch(() => {});
  }
  if (msg.method === 'Target.detachedFromTarget') frameSessions.delete(msg.params.sessionId);
  if (msg.method === 'Fetch.requestPaused' && (msg.sessionId === page.sessionId || frameSessions.has(msg.sessionId))) {
    fulfill(msg.sessionId, msg.params.requestId);
  }
});
await page.send('Fetch.enable', { patterns: [{ urlPattern: 'https://ads.example.test/*' }] });
await page.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });

async function waitFor(expr, timeoutMs = 4000) {
  const start = Date.now();
  for (;;) {
    const v = await page.eval(expr);
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for: ${expr}`);
    await sleep(25);
  }
}

async function fresh(tz, width = 1280, height = 900) {
  await page.send('Emulation.setTimezoneOverride', { timezoneId: tz });
  await page.setViewport(width, height, width < 768);
  await page.goto(`${BASE}/about/`);
  await page.eval('localStorage.clear()');
}

const open = async (p) => {
  page.consoleErrors.length = 0;
  await page.goto(`${BASE}${p}`);
};

const frames = `[...document.querySelectorAll('.ad-frame iframe')].map(f => f.getAttribute('src'))`;
const scrollTo = (sel) => page.eval(`document.querySelector('${sel}').scrollIntoView({ block: 'center' })`);
const barShown = `!document.getElementById('ad-consent').hidden`;

// Text inside an ad frame, read through DevTools (the page itself can't see into it).
async function frameText(src) {
  for (const sid of frameSessions) {
    try {
      const r = await page.conn.send('Runtime.evaluate', {
        expression: `location.pathname === ${JSON.stringify(src)} ? (document.getElementById('stub-ad') || {}).textContent || '' : null`,
        returnByValue: true,
      }, sid);
      if (r.result && typeof r.result.value === 'string') return r.result.value;
    } catch {
      // Frame already gone.
    }
  }
  return null;
}

await check('outside Europe: no consent bar, both ads load in sandboxed frames as they come into view', async () => {
  await fresh('America/New_York');
  await open('/paint-calculator/');
  expect(!(await page.eval(barShown)), 'consent bar shown');
  eq(await page.eval(`document.querySelector('[data-ad-choices]').hidden`), false, 'Ad choices button hidden');
  await scrollTo('[data-ad-slot="below-result"]');
  await waitFor(`document.querySelector('[data-ad-slot="below-result"] iframe')`);
  await scrollTo('[data-ad-slot="sidebar"]');
  await waitFor(`document.querySelector('[data-ad-slot="sidebar"] iframe')`);
  const srcs = await page.eval(frames);
  eq(JSON.stringify(srcs), JSON.stringify(['/ads/banner-468x60.html', '/ads/box-300x250.html']), 'frames');
  const sandbox = await page.eval(`document.querySelector('.ad-frame iframe').getAttribute('sandbox')`);
  expect(!sandbox.includes('allow-same-origin') && !sandbox.includes('allow-top-navigation'), `sandbox too loose: ${sandbox}`);
  let text = '';
  for (let i = 0; i < 80 && !text; i++) {
    text = await frameText('/ads/banner-468x60.html');
    if (!text) await sleep(50);
  }
  eq(text, 'AD k468', 'stub ad rendered inside the frame');
  let side = '';
  for (let i = 0; i < 80 && !side; i++) {
    side = await frameText('/ads/box-300x250.html');
    if (!side) await sleep(50);
  }
  eq(side, 'AD k300', 'sidebar stub ad');
  await page.screenshot(path.join(SHOTS, 'ads-desktop.png'));
  eq(await page.eval(`document.querySelector('[data-ad-slot="below-result"] .ad-label').offsetHeight > 0`), true, 'Advertisement label visible');
});

await check('the ad code can\'t touch the page, its storage, or navigate it', async () => {
  await sleep(300);
  eq(await page.eval('location.pathname'), '/paint-calculator/', 'page navigated');
  eq(await page.eval('document.body.dataset.leak || null'), null, 'ad wrote into the page');
  eq(await page.eval(`localStorage.getItem('leak')`), null, 'ad wrote to the site storage');
  // The calculator still works with ads on.
  eq(await page.eval(`!!document.querySelector('#calc-result .result-value')`), true, 'result missing');
  const errs = page.consoleErrors.filter((e) => !/Blocked|sandbox|navigat|SecurityError|origin/i.test(e));
  eq(errs.length, 0, `console errors: ${errs.join(' | ')}`);
});

await check('the ads are small: the result-banner is 60 px tall and nothing is above the result', async () => {
  const h = await page.eval(`document.querySelector('[data-ad-slot="below-result"] iframe').getBoundingClientRect().height`);
  eq(h, 60, 'banner height');
  eq(await page.eval(`document.querySelector('#calc-result').compareDocumentPosition(document.querySelector('[data-ad-slot="below-result"]')) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : 0`), 1, 'ad after result');
});

await check('on a phone: a 320×50 banner, no sidebar ad, no sideways scrolling', async () => {
  await fresh('America/Chicago', 375, 812);
  await open('/mulch-calculator/');
  await scrollTo('[data-ad-slot="below-result"]');
  await waitFor(`document.querySelector('[data-ad-slot="below-result"] iframe')`);
  await scrollTo('[data-ad-slot="sidebar"]');
  await sleep(300);
  eq(JSON.stringify(await page.eval(frames)), JSON.stringify(['/ads/banner-320x50.html']), 'frames');
  await scrollTo('[data-ad-slot="below-result"]');
  await sleep(300);
  await page.screenshot(path.join(SHOTS, 'ads-phone.png'), { fullPage: false });
  eq(await page.eval(`document.querySelector('[data-ad-slot="sidebar"] .ad-label').offsetHeight`), 0, 'sidebar label showing');
  eq(await page.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`), 0, 'horizontal overflow');
});

await check('on a 320 px screen there is no room for a banner, so none is shown', async () => {
  await fresh('America/Chicago', 320, 700);
  await open('/mulch-calculator/');
  await scrollTo('[data-ad-slot="below-result"]');
  await sleep(300);
  eq(JSON.stringify(await page.eval(frames)), '[]', 'frames');
  eq(await page.eval(`document.querySelector('[data-ad-slot="below-result"]').hidden`), true, 'empty slot visible');
  eq(await page.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`), 0, 'horizontal overflow');
});

await check('in Europe: ads wait for consent, then load after "Allow ads" and on later pages', async () => {
  await fresh('Europe/Berlin');
  await open('/tile-calculator/');
  await waitFor(barShown);
  await scrollTo('[data-ad-slot="below-result"]');
  await sleep(300);
  eq(JSON.stringify(await page.eval(frames)), '[]', 'ads loaded before consent');
  eq(await page.eval(`document.querySelector('[data-ad-slot="below-result"]').hidden`), true, 'empty slot visible before consent');
  await page.eval(`document.querySelector('[data-ad-consent="yes"]').click()`);
  eq(await page.eval(barShown), false, 'bar still shown');
  await waitFor(`document.querySelectorAll('.ad-frame iframe').length >= 1`);
  await open('/gravel-calculator/');
  eq(await page.eval(barShown), false, 'bar shown again after allowing');
  await scrollTo('[data-ad-slot="below-result"]');
  await waitFor(`document.querySelector('[data-ad-slot="below-result"] iframe')`);
});

await check('"Ad choices" → "No thanks" removes the ads now and on later pages', async () => {
  await page.eval(`document.querySelector('[data-ad-choices]').click()`);
  await waitFor(barShown);
  await page.eval(`document.querySelector('[data-ad-consent="no"]').click()`);
  eq(JSON.stringify(await page.eval(frames)), '[]', 'frames left after declining');
  eq(await page.eval(`[...document.querySelectorAll('[data-ad-slot]')].every(s => s.hidden)`), true, 'slots still visible');
  eq(await page.eval(`document.activeElement.hasAttribute('data-ad-choices')`), true, 'focus not returned to Ad choices');
  await open('/gravel-calculator/');
  await scrollTo('[data-ad-slot="below-result"]');
  await sleep(300);
  eq(await page.eval(barShown), false, 'bar shown after declining');
  eq(JSON.stringify(await page.eval(frames)), '[]', 'ads loaded after declining');
});

await check('declining outside Europe works too, and the consent bar is usable on a phone', async () => {
  await fresh('America/Denver', 375, 812);
  await open('/paint-calculator/');
  await page.eval(`document.querySelector('[data-ad-choices]').click()`);
  await waitFor(barShown);
  await page.screenshot(path.join(SHOTS, 'ads-consent-phone.png'), { fullPage: false });
  const fits = await page.eval(`(() => { const r = document.getElementById('ad-consent').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height < 200; })()`);
  eq(fits, true, 'bar too tall or off screen');
  eq(await page.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`), 0, 'horizontal overflow');
  await page.eval(`document.querySelector('[data-ad-consent="no"]').click()`);
  eq(await page.eval(`localStorage.getItem('hmdin-ad-consent')`), 'no', 'choice not stored');
});

await check('ads are left out of the printed shopping list', async () => {
  await fresh('America/New_York');
  await open('/paint-calculator/');
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  const shown = await page.eval(`[...document.querySelectorAll('.ad-slot, .ad-consent')].some(el => getComputedStyle(el).display !== 'none')`);
  await page.send('Emulation.setEmulatedMedia', { media: '' });
  eq(shown, false, 'ad visible in print');
});

await browser.close();
server.close();
rmSync(out, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed (${results.length} checks)`);
if (failed.length) process.exitCode = 1;
