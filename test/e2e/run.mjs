// End-to-end tests in real headless Chrome.
//   node test/e2e/run.mjs                      -> builds nothing; serves dist/ locally and tests it
//   BASE_URL=https://example.com node test/e2e/run.mjs   -> tests a deployed site
// Screenshots are written to test/e2e/screenshots/ for a visual check.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { createStaticServer } from '../../scripts/serve.mjs';
import { CALCULATORS } from '../../src/calculators/index.mjs';
import { run, rawWith, defaultRaw } from '../../src/lib/validate.mjs';
import { hasSystemToggle } from '../../src/lib/render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

let server;
let BASE = process.env.BASE_URL && process.env.BASE_URL.replace(/\/$/, '');
if (!BASE) {
  server = createStaticServer(path.join(HERE, '..', '..', 'dist'));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${server.address().port}`;
}
console.log(`Testing ${BASE}\n`);

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`  ✖ ${name}\n      ${e.message.split('\n').join('\n      ')}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const eq = (actual, expected, what) => expect(actual === expected, `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// What the tested Node code says for exactly what the form currently holds.
const nodeFromPage = (def, raw) => {
  const r = run(def, raw, raw._system || 'us');
  return r.ok ? r.model.headline.value : r.model.error;
};

const nodeHeadline = (def, overrides = {}, system = 'us') => {
  const r = run(def, rawWith(def, overrides, system), system);
  return r.ok ? r.model.headline.value : r.model.error;
};

const browser = await launch();
const page = await browser.newPage();
await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });

// ---- page helpers (run inside the browser) ----
const js = {
  set: (name, value) =>
    `(() => { const el = document.querySelector('#calc-form [name="${name}"]'); el.value = ${JSON.stringify(String(value))}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  setUnit: (name, unit) =>
    `(() => { const el = document.querySelector('#calc-form [name="${name}__unit"]'); el.value = ${JSON.stringify(unit)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`,
  select: (name, value) =>
    `(() => { const el = document.querySelector('#calc-form [name="${name}"]'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`,
  blur: (name) => `(() => { const el = document.querySelector('#calc-form [name="${name}"]'); el.focus(); el.blur(); })()`,
  headline: `(document.querySelector('#calc-result .result-value') || {}).textContent || null`,
  emptyMessage: `(document.querySelector('#calc-result .result-empty') || {}).textContent?.trim() || null`,
  fieldError: (name) =>
    `(() => { const b = document.getElementById('f-${name}-error'); const el = document.querySelector('#calc-form [name="${name}"]'); return { visible: !!b && !b.hidden, text: b ? b.textContent : '', invalid: el.getAttribute('aria-invalid') === 'true', describedBy: el.getAttribute('aria-describedby') || '' }; })()`,
  bodyText: `document.body.innerText`,
  raw: (def) => `(() => {
    const form = document.getElementById('calc-form');
    const fields = ${JSON.stringify(def.inputs.map((i) => ({ name: i.name, type: i.type })))};
    const raw = {};
    for (const x of fields) {
      const el = form.elements.namedItem(x.name);
      if (x.type === 'checkbox') raw[x.name] = el.checked;
      else if (x.type === 'select') raw[x.name] = el.value;
      else raw[x.name] = { text: el.value, bad: el.validity.badInput, unit: x.type === 'measure' ? form.elements.namedItem(x.name + '__unit').value : undefined };
    }
    const sys = form.querySelector('input[name="_system"]:checked');
    raw._system = sys ? sys.value : 'us';
    return raw;
  })()`,
  overflow: `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
};

async function open(pathName) {
  page.consoleErrors.length = 0;
  await page.goto(`${BASE}${pathName}`);
}

async function waitFor(expr, timeoutMs = 3000) {
  const start = Date.now();
  for (;;) {
    const v = await page.eval(expr);
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for: ${expr}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

// ---------------- HTTP-level checks ----------------

console.log('Site and navigation');

await check('every sitemap URL returns 200', async () => {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(urls.length === 4 + CALCULATORS.length, `sitemap has ${urls.length} URLs`);
  for (const u of urls) {
    const res = await fetch(`${BASE}${new URL(u).pathname}`);
    eq(res.status, 200, u);
  }
});

await check('every internal link on every page resolves (crawl)', async () => {
  const seen = new Set();
  const queue = ['/'];
  while (queue.length) {
    const p = queue.shift();
    if (seen.has(p)) continue;
    seen.add(p);
    const res = await fetch(`${BASE}${p}`);
    eq(res.status, 200, `status of ${p}`);
    if (!(res.headers.get('content-type') || '').includes('text/html')) continue;
    const html = await res.text();
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      const link = m[1];
      if (!seen.has(link) && !queue.includes(link)) queue.push(link);
    }
  }
  expect(seen.size > 30, `only crawled ${seen.size} URLs`);
});

await check('calculator URLs without a trailing slash redirect to the canonical URL', async () => {
  for (const def of CALCULATORS) {
    const res = await fetch(`${BASE}/${def.slug}`, { redirect: 'manual' });
    expect([301, 302, 307, 308].includes(res.status), `/${def.slug} returned ${res.status}`);
    const loc = res.headers.get('location');
    expect(loc && new URL(loc, BASE).pathname === `/${def.slug}/`, `/${def.slug} redirected to ${loc}`);
  }
});

await check('unknown URLs return the 404 page with a 404 status', async () => {
  const res = await fetch(`${BASE}/definitely-not-a-page/`);
  eq(res.status, 404, 'status');
  expect((await res.text()).includes('Page not found'), '404 page content');
});

await check('robots.txt and sitemap.xml are served', async () => {
  const robots = await fetch(`${BASE}/robots.txt`);
  eq(robots.status, 200, 'robots status');
  expect((await robots.text()).includes('Sitemap:'), 'robots has sitemap line');
  const sm = await fetch(`${BASE}/sitemap.xml`);
  eq(sm.status, 200, 'sitemap status');
});

// ---------------- Home and search ----------------

console.log('\nHome page and search');

await check('home page explains the site and lists every calculator', async () => {
  await open('/');
  const text = await page.eval(js.bodyText);
  expect(text.includes('How Much Do I Need?'), 'H1');
  expect(text.includes('Simple calculators for figuring out how much material, space, or quantity you need.'), 'tagline');
  eq(await page.eval(`document.querySelectorAll('[data-search]:not([hidden])').length`), CALCULATORS.length, 'visible cards');
  eq(page.consoleErrors.length, 0, `console errors: ${page.consoleErrors.join(' | ')}`);
});

await check('search filters as you type', async () => {
  await page.typeInto('#calc-search', 'gravel');
  eq(await page.eval(`[...document.querySelectorAll('[data-search]:not([hidden]) .calc-card-name')].map(e => e.textContent).join()`), 'Gravel Calculator', 'gravel results');
  expect((await page.eval(`document.getElementById('calc-search-status').textContent`)).includes('1 calculator found'), 'status message');
  await page.typeInto('#calc-search', 'photos');
  eq(await page.eval(`[...document.querySelectorAll('[data-search]:not([hidden]) .calc-card-name')].map(e => e.textContent).join()`), 'Storage Calculator', 'photos results');
  await page.typeInto('#calc-search', 'litres');
  expect((await page.eval(`document.querySelectorAll('[data-search]:not([hidden])').length`)) >= 1, 'litres finds paint');
  await page.typeInto('#calc-search', 'zzqxv');
  eq(await page.eval(`document.getElementById('no-results').hidden`), false, 'no-results shown');
  eq(await page.eval(`document.querySelectorAll('[data-group]:not([hidden])').length`), 0, 'empty groups hidden');
  await page.typeInto('#calc-search', ' ');
  eq(await page.eval(`document.querySelectorAll('[data-search]:not([hidden])').length`), CALCULATORS.length, 'all cards back');
});

await check('pressing Enter on a single match opens that calculator', async () => {
  await open('/');
  await page.typeInto('#calc-search', 'concrete');
  const nav = page.conn.waitFor((m) => m.sessionId === page.sessionId && m.method === 'Page.loadEventFired');
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await nav;
  expect((await page.eval('location.pathname')) === '/concrete-calculator/', `ended at ${await page.eval('location.pathname')}`);
});

await check('All calculators page honours ?q= and links to every calculator', async () => {
  await open('/calculators/?q=soil');
  eq(await page.eval(`document.querySelectorAll('[data-search]:not([hidden])').length`), 1, 'filtered by q');
  await open('/calculators/');
  for (const def of CALCULATORS) {
    expect(await page.eval(`!!document.querySelector('a[href="/${def.slug}/"]')`), `link to ${def.slug}`);
  }
});

await check('header navigation works', async () => {
  await open('/about/');
  eq(await page.eval(`document.querySelector('.site-nav a[href="/about/"]').getAttribute('aria-current')`), 'page', 'aria-current on About');
  for (const href of ['/', '/calculators/', '/about/', '/privacy/']) {
    expect(await page.eval(`!!document.querySelector('a[href="${href}"]')`), `link to ${href}`);
  }
});

// ---------------- Each calculator ----------------

for (const def of CALCULATORS) {
  console.log(`\n${def.name} (/${def.slug}/)`);
  const url = `/${def.slug}/`;
  const firstMeasure = def.inputs.find((f) => f.type === 'measure' && !f.optional);
  const firstNumber = def.inputs.find((f) => ['measure', 'count', 'percent'].includes(f.type) && !f.optional);

  await check('loads without errors and becomes interactive', async () => {
    await open(url);
    await page.eval(`try { localStorage.clear() } catch {}`);
    await open(url);
    await waitFor(`document.getElementById('calc-form').classList.contains('is-live')`);
    eq(page.consoleErrors.length, 0, `console errors: ${page.consoleErrors.join(' | ')}`);
    eq(await page.eval(`document.title`), def.title, 'title');
  });

  await check('default result matches the tested formula', async () => {
    eq(await page.eval(js.headline), nodeHeadline(def), 'headline');
    const text = await page.eval(`document.getElementById('calc-result').innerText`);
    expect(/Estimated amount to buy|Suggested storage/.test(text), 'buy section');
    expect(/Calculated (quantity|volume|total)/.test(text), 'exact section');
    expect(text.includes('How this was calculated'), 'working shown');
  });

  await check('empty input asks for a value and shows the field error after leaving it', async () => {
    const f = firstNumber;
    await page.eval(js.set(f.name, ''));
    const msg = await page.eval(js.emptyMessage);
    expect(msg && msg.startsWith('Enter the'), `result message was ${JSON.stringify(msg)}`);
    eq((await page.eval(js.fieldError(f.name))).visible, false, 'error hidden before blur');
    await page.eval(js.blur(f.name));
    const err = await page.eval(js.fieldError(f.name));
    expect(err.visible && err.invalid, `error after blur: ${JSON.stringify(err)}`);
    expect(err.describedBy.includes(`f-${f.name}-error`), 'error linked with aria-describedby');
  });

  await check('negative and zero values are rejected with a message', async () => {
    const f = firstNumber;
    await page.eval(js.set(f.name, '-5'));
    const err = await page.eval(js.fieldError(f.name));
    expect(err.visible && /negative|more than 0/.test(err.text), `negative error: ${JSON.stringify(err)}`);
    expect(await page.eval(js.emptyMessage), 'result replaced by a message');
    if (f.type === 'measure') {
      await page.eval(js.set(f.name, '0'));
      expect((await page.eval(js.fieldError(f.name))).text.includes('more than 0'), 'zero rejected');
    }
    const text = await page.eval(js.bodyText);
    expect(!/NaN|Infinity|undefined/.test(text), 'no NaN/Infinity/undefined on the page');
  });

  await check('decimal values calculate the same as the tested formula', async () => {
    const f = firstNumber;
    const value = f.type === 'count' ? '37' : '12.75';
    await page.eval(js.set(f.name, value));
    eq(await page.eval(js.headline), nodeHeadline(def, { [f.name]: value }), 'headline');
    eq((await page.eval(js.fieldError(f.name))).visible, false, 'error cleared');
  });

  if (firstMeasure && firstMeasure.dim === 'length') {
    await check('changing the unit of a measurement converts correctly', async () => {
      // 12.75 ft entered as 153 in must give the same answer
      const f = firstMeasure;
      await page.eval(js.set(f.name, '153'));
      await page.eval(js.setUnit(f.name, 'in'));
      eq(await page.eval(js.headline), nodeHeadline(def, { [f.name]: [153, 'in'] }), 'headline in inches');
      eq(await page.eval(js.headline), nodeHeadline(def, { [f.name]: [12.75, 'ft'] }), 'same as 12.75 ft');
    });
  }

  await check('waste / extra percentage changes the amount to buy', async () => {
    const pctField = def.inputs.find((f) => f.type === 'percent');
    await page.eval(js.set(pctField.name, '0'));
    const at0 = await page.eval(js.headline);
    eq(at0, nodeFromPage(def, await page.eval(js.raw(def))), 'headline at 0% matches the formula for the form as it stands');
    await page.eval(js.set(pctField.name, '100'));
    const at100 = await page.eval(js.headline);
    expect(at0 !== at100, `0% and 100% gave the same result (${at0})`);
    await page.eval(js.set(pctField.name, '101'));
    expect((await page.eval(js.fieldError(pctField.name))).visible, 'over 100% rejected');
  });

  await check('reset restores the defaults', async () => {
    await page.eval(`document.querySelector('[data-action="reset"]').click()`);
    eq(await page.eval(js.headline), nodeHeadline(def), 'headline after reset');
    eq(await page.eval(`document.querySelectorAll('.field-error:not([hidden])').length`), 0, 'no visible errors');
  });

  if (def.id === 'concrete') {
    await check('"Other" bag size reveals the yield field', async () => {
      eq(await page.eval(`document.querySelector('[data-field="bagYield"]').hidden`), true, 'hidden by default');
      await page.eval(js.select('bag', 'custom'));
      eq(await page.eval(`document.querySelector('[data-field="bagYield"]').hidden`), false, 'shown for custom');
      eq(await page.eval(js.headline), nodeHeadline(def, { bag: 'custom' }), 'custom yield headline');
      await page.eval(js.select('bag', 'lb80'));
    });
  }

  if (hasSystemToggle(def)) {
    await check('US / Metric switch converts the form and remembers the choice', async () => {
      await page.eval(`document.querySelector('label[for="sys-metric"]').click()`);
      eq(await page.eval(js.headline), nodeHeadline(def, {}, 'metric'), 'metric headline');
      eq(await page.eval(`document.querySelector('[name="${firstMeasure.name}__unit"]').value`), firstMeasure.default.metric[1], 'unit switched');
      eq(await page.eval(`localStorage.getItem('hmdin-unit-system')`), 'metric', 'stored preference');
      await open(url);
      await waitFor(`document.getElementById('calc-form').classList.contains('is-live')`);
      eq(await page.eval(`document.getElementById('sys-metric').checked`), true, 'metric remembered after reload');
      eq(await page.eval(js.headline), nodeHeadline(def, {}, 'metric'), 'metric headline after reload');
      // A typed value is converted, not reset: 5 m -> 16.4 ft
      await page.eval(js.set(firstMeasure.name, '5'));
      await page.eval(`document.querySelector('label[for="sys-us"]').click()`);
      eq(await page.eval(`document.querySelector('[name="${firstMeasure.name}"]').value`), '16.4', 'converted value');
      await page.eval(`document.querySelector('[data-action="reset"]').click()`);
      eq(await page.eval(js.headline), nodeHeadline(def), 'US defaults after reset');
    });
  }

  await check('keeps calculating with the network offline', async () => {
    await open(url);
    await waitFor(`document.getElementById('calc-form').classList.contains('is-live')`);
    const before = page.requests.length;
    await page.offline(true);
    try {
      const f = firstNumber;
      const value = f.type === 'count' ? '12' : '7.5';
      await page.eval(js.set(f.name, value));
      eq(await page.eval(js.headline), nodeHeadline(def, { [f.name]: value }), 'offline headline');
      eq(page.requests.length, before, 'no network requests while calculating');
    } finally {
      await page.offline(false);
    }
  });

  await check('mobile layout has no horizontal scrolling', async () => {
    await page.setViewport(375, 812, true);
    await open(url);
    eq(await page.eval(js.overflow), 0, 'horizontal overflow (px)');
    await page.screenshot(path.join(SHOTS, `${def.id}-mobile.png`));
    await page.setViewport(1280, 900, false);
    await open(url);
    eq(await page.eval(js.overflow), 0, 'desktop horizontal overflow (px)');
    await page.screenshot(path.join(SHOTS, `${def.id}-desktop.png`));
  });
}

// ---------------- Regressions from the pre-launch review ----------------

console.log('\nReview regressions');
const paintDef = CALCULATORS.find((d) => d.id === 'paint');

await check('Back navigation (without the back/forward cache) never shows a stale result', async () => {
  const p2 = await browser.newPage();
  try {
    // An unload listener makes Chrome skip the back/forward cache, forcing form restoration.
    await p2.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.addEventListener("unload", () => {})' });
    await p2.goto(`${BASE}/paint-calculator/`);
    await p2.eval(js.set('length', '23'));
    await p2.eval(js.set('width', '19'));
    const typed = await p2.eval(js.headline);
    eq(typed, nodeHeadline(paintDef, { length: '23', width: '19' }), 'result after typing');
    await p2.goto(`${BASE}/about/`);
    const back = p2.conn.waitFor((m) => m.sessionId === p2.sessionId && m.method === 'Page.loadEventFired');
    await p2.eval('history.back()');
    await back;
    await new Promise((r) => setTimeout(r, 300));
    const raw = await p2.eval(js.raw(paintDef));
    eq(await p2.eval(js.headline), nodeFromPage(paintDef, raw), `result matches the restored form (length ${raw.length.text})`);
  } finally {
    await browser.closePage(p2);
  }
});

await check('first click on "How this was calculated" works while a field is focused', async () => {
  await open('/paint-calculator/');
  await page.typeInto('#f-length', '13');
  const rect = await page.eval(`(() => { const r = document.querySelector('.result-working summary').getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; })()`);
  await page.eval(`document.querySelector('.result-working summary').scrollIntoView({ block: 'center' })`);
  const r2 = await page.eval(`(() => { const r = document.querySelector('.result-working summary').getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', { type, x: r2.x, y: r2.y, button: 'left', clickCount: 1 });
  }
  expect(rect, 'summary found');
  eq(await page.eval(`document.querySelector('.result-working').open`), false, 'details closed after one click');
});

await check('a collapsed working section stays collapsed through an empty field', async () => {
  await page.eval(js.set('length', ''));
  await page.eval(js.set('length', '14'));
  eq(await page.eval(`document.querySelector('.result-working').open`), false, 'still collapsed');
});

await check('US → Metric → US restores exactly what was typed', async () => {
  await open('/paint-calculator/');
  await page.eval(js.set('length', '7'));
  await page.eval(`document.querySelector('label[for="sys-metric"]').click()`);
  eq(await page.eval(`document.querySelector('[name="length"]').value`), '2.13', 'converted to metres');
  await page.eval(`document.querySelector('label[for="sys-us"]').click()`);
  eq(await page.eval(`document.querySelector('[name="length"]').value`), '7', 'back to exactly 7');
  eq(await page.eval(`document.querySelector('[name="length__unit"]').value`), 'ft', 'back to feet');
});

await check('screen readers hear the new result after Reset', async () => {
  await page.eval(js.set('length', '20'));
  await page.eval(`document.querySelector('[data-action="reset"]').click()`);
  await new Promise((r) => setTimeout(r, 900));
  const live = await page.eval(`document.getElementById('result-live').textContent`);
  expect(live.startsWith('Values reset to the defaults.') && live.includes(nodeHeadline(paintDef)), `live region: ${live}`);
});

await check('huge values show a validation message, not Infinity', async () => {
  await open('/mulch-calculator/');
  await page.eval(js.set('length', '1e200'));
  const text = await page.eval(js.bodyText);
  expect(!/Infinity|NaN/.test(text), 'no Infinity/NaN');
  expect((await page.eval(js.fieldError('length'))).text.includes("can't be more than"), 'max error shown');
});

// ---------------- Whole-site checks ----------------

console.log('\nWhole site');

await check('no page scrolls sideways on a 320 px phone', async () => {
  await page.setViewport(320, 640, true);
  for (const p of ['/', '/calculators/', '/about/', '/privacy/', '/nope/', ...CALCULATORS.map((d) => `/${d.slug}/`)]) {
    await open(p);
    eq(await page.eval(js.overflow), 0, `overflow on ${p}`);
  }
  await open('/');
  await page.screenshot(path.join(SHOTS, 'home-mobile.png'));
  await page.setViewport(1280, 900, false);
  await open('/');
  await page.screenshot(path.join(SHOTS, 'home-desktop.png'));
});

await check('pages only request files from this site', async () => {
  page.requests.length = 0;
  for (const p of ['/', '/paint-calculator/', '/storage-calculator/', '/privacy/']) await open(p);
  const external = page.requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:'));
  eq(external.length, 0, `external requests: ${external.join(', ')}`);
});

await check('calculators still show a result with JavaScript turned off', async () => {
  await page.send('Emulation.setScriptExecutionDisabled', { value: true });
  try {
    await open('/tile-calculator/');
    eq(await page.eval(js.headline), nodeHeadline(CALCULATORS.find((d) => d.id === 'tile')), 'pre-rendered headline');
  } finally {
    await page.send('Emulation.setScriptExecutionDisabled', { value: false });
  }
});

await check('dark mode renders (screenshot)', async () => {
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await open('/paint-calculator/');
  await page.screenshot(path.join(SHOTS, 'paint-dark.png'));
  const bg = await page.eval(`getComputedStyle(document.body).backgroundColor`);
  expect(bg !== 'rgb(246, 247, 249)', `dark background not applied (${bg})`);
  await page.send('Emulation.setEmulatedMedia', { features: [] });
});

// WCAG 2.1 contrast, measured on the rendered page: text 4.5:1 (3:1 when large), input borders 3:1.
const CONTRAST = `(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
  const fails = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && el.tagName !== 'BODY') continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const cs = getComputedStyle(el);
    if (own && !el.closest('.visually-hidden')) {
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      const r = ratio(parse(cs.color), bgOf(el));
      if (r < need) fails.push(el.tagName.toLowerCase() + '.' + el.className + ' "' + el.textContent.trim().slice(0, 30) + '" ' + r.toFixed(2));
    }
    if ((el.matches('input.input, select.unit-select, .search-field input')) && cs.borderTopStyle !== 'none') {
      const r = ratio(parse(cs.borderTopColor), bgOf(el.parentElement));
      if (r < 3) fails.push('border of ' + el.name + ' ' + r.toFixed(2));
    }
  }
  return fails;
})()`;

for (const scheme of ['light', 'dark']) {
  await check(`text and input borders meet WCAG contrast (${scheme} mode)`, async () => {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    const all = [];
    for (const p of ['/', '/calculators/', '/about/', '/privacy/', '/paint-calculator/', '/concrete-calculator/', '/storage-calculator/']) {
      await open(p);
      for (const f of await page.eval(CONTRAST)) all.push(`${p} ${f}`);
    }
    // Error state too: red text on the tinted field background
    await page.eval(js.set('photos', '-1'));
    for (const f of await page.eval(CONTRAST)) all.push(`error state ${f}`);
    await page.send('Emulation.setEmulatedMedia', { features: [] });
    eq(all.length, 0, `contrast failures:\n${all.slice(0, 15).join('\n')}`);
  });
}

await check('keyboard focus is visible on both US/Metric segments', async () => {
  await open('/paint-calculator/');
  for (const id of ['sys-us', 'sys-metric']) {
    const shadow = await page.eval(`(() => { const r = document.getElementById('${id}'); r.focus({ focusVisible: true }); return getComputedStyle(r.nextElementSibling).boxShadow; })()`);
    expect(shadow && shadow !== 'none', `${id}: no focus ring (${shadow})`);
  }
});

await check('skip link is the first thing keyboard users reach', async () => {
  await open('/paint-calculator/');
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  eq(await page.eval(`document.activeElement.className`), 'skip-link', 'first focus');
});

await check('every form control has an accessible label', async () => {
  for (const def of CALCULATORS) {
    await open(`/${def.slug}/`);
    const unlabeled = await page.eval(`[...document.querySelectorAll('#calc-form input, #calc-form select')].filter(el => {
      if (el.getAttribute('aria-label')) return false;
      return !(el.id && document.querySelector('label[for="' + el.id + '"]'));
    }).map(el => el.name)`);
    eq(unlabeled.length, 0, `${def.id} unlabeled: ${unlabeled.join(', ')}`);
  }
});

await browser.close();
if (server) server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed (${results.length} checks)`);
if (failed.length) process.exitCode = 1;
