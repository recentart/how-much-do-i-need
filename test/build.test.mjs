// Builds the site into a temporary folder and checks the output: SEO tags, links, sitemap,
// scripts and the Content-Security-Policy constraints.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { SITE } from '../src/site.config.mjs';
import { CALCULATORS } from '../src/calculators/index.mjs';

let out;
let pages;
const html = {};

before(() => {
  out = mkdtempSync(path.join(tmpdir(), 'hmdin-build-'));
  pages = build({ outDir: out, quiet: true }).pages;
  for (const p of pages) html[p] = readFileSync(path.join(out, p, 'index.html'), 'utf8');
});

after(() => rmSync(out, { recursive: true, force: true }));

const attr = (h, re) => (h.match(re) || [])[1];

test('builds every expected page', () => {
  const expected = ['/', '/calculators/', '/about/', '/privacy/', ...CALCULATORS.map((d) => `/${d.slug}/`)];
  assert.deepEqual([...pages].sort(), expected.sort());
  assert.ok(existsSync(path.join(out, '404.html')));
});

test('every page has unique, complete SEO metadata', () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const p of pages) {
    const h = html[p];
    const title = attr(h, /<title>([^<]+)<\/title>/);
    const desc = attr(h, /<meta name="description" content="([^"]+)">/);
    assert.ok(title, `${p} title`);
    assert.ok(desc, `${p} description`);
    assert.ok(!titles.has(title), `${p} duplicate title`);
    assert.ok(!descriptions.has(desc), `${p} duplicate description`);
    titles.add(title);
    descriptions.add(desc);
    assert.equal(attr(h, /<link rel="canonical" href="([^"]+)">/), `${SITE.url}${p}`, `${p} canonical`);
    assert.equal(attr(h, /<meta property="og:url" content="([^"]+)">/), `${SITE.url}${p}`, `${p} og:url`);
    assert.equal(attr(h, /<meta property="og:title" content="([^"]+)">/), title, `${p} og:title`);
    assert.ok(attr(h, /<meta property="og:description" content="([^"]+)">/), `${p} og:description`);
    assert.equal(attr(h, /<meta property="og:image" content="([^"]+)">/), `${SITE.url}/og-image.png`);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, `${p} must have exactly one h1`);
    assert.match(h, /<html lang="en">/);
    assert.match(h, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  }
});

test('calculator pages carry their own title, H1 and question', () => {
  for (const def of CALCULATORS) {
    const h = html[`/${def.slug}/`];
    assert.ok(h.includes(`<h1>${def.name}</h1>`), `${def.id} h1`);
    assert.ok(h.includes(def.question), `${def.id} question`);
    assert.match(h, /<form class="calc-form" id="calc-form"/);
    assert.match(h, /id="calc-result"/);
    assert.match(h, /class="result-value"/, `${def.id} has a pre-rendered default result`);
    assert.match(h, /data-action="reset"/, `${def.id} reset button`);
    assert.ok(h.includes(`src="/assets/js/entry/${def.id}.mjs"`), `${def.id} entry script`);
  }
});

test('headings go in order (no skipped levels)', () => {
  for (const p of pages) {
    const levels = [...html[p].matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i] <= levels[i - 1] + 1, `${p}: h${levels[i - 1]} followed by h${levels[i]}`);
    }
  }
});

test('every internal link and asset exists', () => {
  const files = [...pages.map((p) => [p, html[p]]), ['/404.html', readFileSync(path.join(out, '404.html'), 'utf8')]];
  for (const [p, h] of files) {
    for (const m of h.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      const url = m[1].split('?')[0].split('#')[0];
      const target = url.endsWith('/') ? path.join(out, url, 'index.html') : path.join(out, url);
      assert.ok(existsSync(target), `${p} links to missing ${m[1]}`);
    }
  }
});

test('JavaScript modules import files that exist', () => {
  const entries = CALCULATORS.map((d) => path.join(out, 'assets/js/entry', `${d.id}.mjs`));
  const seen = new Set();
  const queue = [...entries, path.join(out, 'assets/js/lib/search.mjs')];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    assert.ok(existsSync(file), `missing module ${file}`);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/from '(\.[^']+)'/g)) queue.push(path.resolve(path.dirname(file), m[1]));
  }
  assert.ok(seen.size >= 10);
});

test('no inline scripts or inline styles (so the strict CSP works)', () => {
  for (const p of pages) {
    const h = html[p];
    for (const m of h.matchAll(/<script([^>]*)>/g)) {
      const attrs = m[1];
      assert.ok(/src="/.test(attrs) || /type="application\/ld\+json"/.test(attrs), `${p} has an inline script: <script${attrs}>`);
    }
    assert.ok(!/\sstyle="/.test(h), `${p} has an inline style attribute`);
    assert.ok(!/\son[a-z]+="/.test(h), `${p} has an inline event handler`);
  }
});

test('structured data is valid JSON', () => {
  for (const p of pages) {
    for (const m of html[p].matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(m[1]);
      assert.equal(data['@context'], 'https://schema.org');
    }
  }
});

test('sitemap and robots.txt', () => {
  const sitemap = readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
  for (const p of pages) assert.ok(sitemap.includes(`<loc>${SITE.url}${p}</loc>`), `sitemap missing ${p}`);
  assert.ok(!sitemap.includes('404'));
  const robots = readFileSync(path.join(out, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent: \*/);
  assert.ok(robots.includes(`Sitemap: ${SITE.url}/sitemap.xml`));
});

test('404 page is not indexed and has no canonical', () => {
  const h = readFileSync(path.join(out, '404.html'), 'utf8');
  assert.match(h, /<meta name="robots" content="noindex">/);
  assert.ok(!/rel="canonical"/.test(h));
});

test('no ads, trackers or third-party requests', () => {
  for (const p of pages) {
    const h = html[p];
    assert.ok(!/class="ad-slot/.test(h), `${p} renders an ad slot`);
    for (const m of h.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
      const allowed = m[1].startsWith(SITE.url) || m[1].startsWith(SITE.repo) || m[1].startsWith('https://www.cloudflare.com/privacypolicy');
      assert.ok(allowed, `${p} references external ${m[1]}`);
    }
    assert.ok(!/<script[^>]+src="https?:/.test(h), `${p} loads a third-party script`);
  }
});
