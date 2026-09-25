// Builds the static site into dist/ (or the directory given). No dependencies: plain Node.
//   node scripts/build.mjs            -> dist/
//   OUT_DIR=some/dir node scripts/build.mjs
// Wrangler runs this automatically before `npx wrangler deploy` (see wrangler.jsonc).

import { mkdirSync, rmSync, writeFileSync, readFileSync, cpSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { SITE } from '../src/site.config.mjs';
import { CALCULATORS } from '../src/calculators/index.mjs';
import { run, defaultRaw } from '../src/lib/validate.mjs';
import * as T from '../src/pages/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

// Browser modules copied as-is. The calculators import ../lib/*.mjs, which keeps working
// because the same relative layout is recreated under /assets/js/.
const BROWSER_LIB = ['units.mjs', 'validate.mjs', 'render.mjs', 'engine.mjs', 'search.mjs'];

function write(outDir, rel, content) {
  const file = path.join(outDir, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function checkMeta(pages) {
  const problems = [];
  const seen = { title: new Map(), description: new Map(), path: new Map() };
  for (const p of pages) {
    for (const key of ['title', 'description', 'path']) {
      if (seen[key].has(p[key])) problems.push(`Duplicate ${key} on ${p.path} and ${seen[key].get(p[key])}`);
      seen[key].set(p[key], p.path);
    }
    if (p.title.length > 70) problems.push(`Title over 70 characters on ${p.path} (${p.title.length})`);
    if (p.description.length < 70 || p.description.length > 160) {
      problems.push(`Description should be 70–160 characters on ${p.path} (${p.description.length})`);
    }
    const h1s = (p.html.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) problems.push(`${p.path} has ${h1s} <h1> elements`);
  }
  return problems;
}

export function build({ outDir = path.join(ROOT, 'dist'), quiet = false } = {}) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // Static files: CSS, icons, _headers.
  cpSync(path.join(SRC, 'static'), outDir, { recursive: true });

  // Browser JavaScript.
  for (const f of BROWSER_LIB) {
    write(outDir, `assets/js/lib/${f}`, readFileSync(path.join(SRC, 'lib', f)));
  }
  for (const f of readdirSync(path.join(SRC, 'calculators'))) {
    if (!f.endsWith('.mjs') || f === 'index.mjs') continue;
    write(outDir, `assets/js/calculators/${f}`, readFileSync(path.join(SRC, 'calculators', f)));
  }

  const css = readFileSync(path.join(SRC, 'static', 'assets', 'css', 'styles.css'));
  const ctx = {
    stylesheet: `/assets/css/styles.css?v=${createHash('sha256').update(css).digest('hex').slice(0, 10)}`,
    siteScript: '/assets/js/lib/search.mjs',
  };

  const pages = [];
  const extract = (html, re) => (html.match(re) || [])[1] || '';
  const addPage = (pathName, file, html) => {
    write(outDir, file, html);
    pages.push({
      path: pathName,
      html,
      title: extract(html, /<title>([^<]*)<\/title>/),
      description: extract(html, /<meta name="description" content="([^"]*)">/),
    });
  };

  addPage('/', 'index.html', T.homePage(ctx));

  for (const def of CALCULATORS) {
    const entry = `/assets/js/entry/${def.id}.mjs`;
    write(outDir, entry.slice(1), `import def from '../calculators/${def.id}.mjs';\nimport { mount } from '../lib/engine.mjs';\n\nmount(def);\n`);
    const defaults = run(def, defaultRaw(def));
    if (!defaults.ok) throw new Error(`${def.id}: default values don't produce a result: ${defaults.model.error}`);
    const html = T.calculatorPage(def, {
      ...ctx,
      entry,
      defaultModel: defaults.model,
      preload: [
        '/assets/js/lib/engine.mjs',
        '/assets/js/lib/validate.mjs',
        '/assets/js/lib/render.mjs',
        '/assets/js/lib/units.mjs',
        `/assets/js/calculators/${def.id}.mjs`,
        '/assets/js/calculators/_shared.mjs',
      ],
    });
    addPage(T.calcPath(def), `${def.slug}/index.html`, html);
  }

  addPage('/calculators/', 'calculators/index.html', T.allCalculatorsPage(ctx));
  addPage('/about/', 'about/index.html', T.aboutPage(ctx));
  addPage('/privacy/', 'privacy/index.html', T.privacyPage(ctx));

  write(outDir, '404.html', T.notFoundPage(ctx));

  const problems = checkMeta(pages);
  if (problems.length) throw new Error(`Page checks failed:\n  ${problems.join('\n  ')}`);

  const urls = pages
    .map((p) => `  <url>\n    <loc>${SITE.url}${p.path}</loc>\n  </url>`)
    .join('\n');
  write(outDir, 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  write(outDir, 'robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);

  if (!quiet) console.log(`Built ${pages.length + 1} pages into ${path.relative(process.cwd(), outDir) || '.'}`);
  return { outDir, pages: pages.map((p) => p.path) };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  build({ outDir: process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : undefined });
}
