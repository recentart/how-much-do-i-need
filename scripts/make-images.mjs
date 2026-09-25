// Renders the PNG icons and the social sharing image into src/static/ using headless Chrome.
// Run after changing favicon.svg or the site's name/tagline: node scripts/make-images.mjs
// The PNGs are committed, so a normal build doesn't need Chrome.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../test/e2e/cdp.mjs';
import { SITE } from '../src/site.config.mjs';
import { CALCULATORS } from '../src/calculators/index.mjs';
import { icon } from '../src/pages/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = path.join(ROOT, 'src', 'static');
const svg = readFileSync(path.join(STATIC, 'favicon.svg'), 'utf8');

const dataUrl = (html) => `data:text/html;base64,${Buffer.from(html).toString('base64')}`;

async function render(page, html, width, height, file, transparent = false) {
  await page.setViewport(width, height);
  await page.send('Emulation.setDefaultBackgroundColorOverride', transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
  await page.goto(dataUrl(html));
  await page.screenshot(path.join(STATIC, file), { fullPage: false });
  console.log(`wrote src/static/${file}`);
}

const iconPage = (size, bg) =>
  `<!doctype html><html><body style="margin:0;background:${bg}"><div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg style="width:${size}px;height:${size}px;display:block" `)}</div></body></html>`;

const chips = CALCULATORS.map(
  (d) => `<span class="chip">${icon(d.id, 'ic')}${d.name.replace(' Calculator', '')}</span>`,
).join('');

const ogHtml = `<!doctype html><html><head><style>
  body { margin:0; width:1200px; height:630px; font-family: 'Segoe UI', system-ui, sans-serif; background:#f6f7f9; color:#17202c; }
  .wrap { box-sizing:border-box; height:630px; padding:72px 80px; display:flex; flex-direction:column; justify-content:space-between;
          background: linear-gradient(135deg, #ffffff 0%, #eef4ff 100%); border-top: 14px solid #1d4ed8; }
  .brand { display:flex; align-items:center; gap:20px; font-size:30px; font-weight:700; color:#1e40af; }
  .brand svg { width:64px; height:64px; }
  h1 { margin:0; font-size:84px; line-height:1.05; letter-spacing:-1.5px; }
  p { margin:18px 0 0; font-size:34px; line-height:1.3; color:#4a5566; max-width:980px; }
  .chips { display:flex; flex-wrap:wrap; gap:12px; }
  .chip { display:inline-flex; align-items:center; gap:10px; padding:10px 18px; border-radius:999px; background:#fff;
          border:2px solid #c7d7fb; font-size:24px; font-weight:600; color:#1e40af; }
  .ic { width:26px; height:26px; }
</style></head><body><div class="wrap">
  <div class="brand">${svg}<span>Free, private calculators</span></div>
  <div><h1>${SITE.name}</h1><p>${SITE.tagline}</p></div>
  <div class="chips">${chips}</div>
</div></body></html>`;

const browser = await launch();
try {
  const page = await browser.newPage();
  await render(page, iconPage(180, '#1d4ed8'), 180, 180, 'apple-touch-icon.png');
  await render(page, iconPage(32, 'transparent'), 32, 32, 'favicon-32.png', true);
  await render(page, ogHtml, 1200, 630, 'og-image.png');
} finally {
  await browser.close();
}
