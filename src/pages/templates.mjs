// Page templates. Plain functions that return HTML strings; the build writes them to dist/.

import { SITE, ADS } from '../site.config.mjs';
import { CATEGORIES, CALCULATORS } from '../calculators/index.mjs';
import { esc, renderForm, renderResult } from '../lib/render.mjs';

// Change this when the privacy policy text changes.
const PRIVACY_UPDATED = '24 September 2026';

export const pageUrl = (path) => `${SITE.url}${path}`;
export const calcPath = (def) => `/${def.slug}/`;

// Text the search box matches against: name, question, keywords and category, lowercased.
export function searchText(def) {
  const cat = CATEGORIES.find((c) => c.id === def.category);
  return `${def.name} ${def.question} ${def.keywords} ${cat ? cat.name : ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ICONS = {
  paint: '<rect x="3" y="3" width="14" height="6" rx="1.5"/><path d="M17 6h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-7v3"/><rect x="10" y="15" width="4" height="6" rx="1"/>',
  flooring: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v6M15 9v6M9 15v6"/>',
  tile: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/>',
  mulch: '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z"/><path d="M5 19l8-8"/>',
  soil: '<path d="M12 20v-8"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6z"/><path d="M12 12c0-3 2-5 6-5 0 3-2 5-6 5z"/><path d="M4 20h16"/>',
  gravel: '<ellipse cx="7" cy="16" rx="4" ry="3"/><ellipse cx="16.5" cy="15" rx="4.5" ry="3.5"/><ellipse cx="11" cy="8" rx="4" ry="3"/>',
  concrete: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  storage: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18"/><circle cx="17" cy="17" r="1"/>',
};

export function icon(id, cls = 'icon') {
  const body = ICONS[id] || ICONS.tile;
  return `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Ad slots render nothing until ADS.enabled is switched on in site.config.mjs.
export function adSlot(name) {
  if (!ADS.enabled || !ADS.slots[name]) return '';
  return `<aside class="ad-slot ad-slot--${name}" aria-label="Advertisement">${ADS.slots[name]}</aside>`;
}

function jsonLdTag(data) {
  // JSON inside a script tag: escape "<" so a string can never close the tag early.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

export function layout({ title, description, path, body, jsonLd = [], scripts = [], preload = [], current = '', noindex = false, stylesheet }) {
  const url = pageUrl(path);
  const year = new Date().getUTCFullYear();
  const navLink = (href, label) =>
    `<li><a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a></li>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`}
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${SITE.themeColor}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${SITE.url}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="How Much Do I Need? Simple calculators for material, space and quantity.">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="${stylesheet}">
${preload.map((p) => `<link rel="modulepreload" href="${p}">`).join('\n')}
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
${jsonLd.map(jsonLdTag).join('\n')}
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/"${path === '/' ? ' aria-current="page"' : ''}>
      <img src="/favicon.svg" alt="" width="32" height="32">
      <span>How Much Do I Need?</span>
    </a>
    <nav class="site-nav" aria-label="Main">
      <ul>
        ${navLink('/calculators/', 'All calculators')}
        ${navLink('/about/', 'About')}
      </ul>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <nav aria-label="Footer">
      <ul class="footer-links">
        <li><a href="/">Home</a></li>
        <li><a href="/calculators/">All calculators</a></li>
        <li><a href="/about/">About</a></li>
        <li><a href="/privacy/">Privacy</a></li>
        <li><a href="${SITE.repo}">Source code</a></li>
      </ul>
    </nav>
    <p>Every calculation runs in your browser. Nothing you enter is sent anywhere.</p>
    <p>Results are estimates. Check quantities with your supplier or installer before you buy. © ${year} How Much Do I Need?</p>
  </div>
</footer>
</body>
</html>
`;
}

function calcCard(def, { headingLevel = 3 } = {}) {
  const h = `h${headingLevel}`;
  return `<li class="calc-card" data-search="${esc(searchText(def))}">
    <a class="calc-card-link" href="${calcPath(def)}">
      <span class="calc-card-icon">${icon(def.id)}</span>
      <span class="calc-card-body">
        <${h} class="calc-card-title">${esc(def.question)}</${h}>
        <span class="calc-card-name">${esc(def.name)}</span>
        <span class="calc-card-desc">${esc(def.summary)}</span>
      </span>
    </a>
  </li>`;
}

function calculatorDirectory({ headingLevel }) {
  const h = `h${headingLevel}`;
  const groups = CATEGORIES.map((cat) => {
    const defs = CALCULATORS.filter((d) => d.category === cat.id);
    if (!defs.length) return '';
    return `<section class="calc-group" data-group aria-labelledby="cat-${cat.id}">
      <${h} class="calc-group-title" id="cat-${cat.id}">${esc(cat.name)}</${h}>
      <p class="calc-group-blurb">${esc(cat.blurb)}</p>
      <ul class="calc-grid" role="list">${defs.map((d) => calcCard(d, { headingLevel: headingLevel + 1 })).join('')}</ul>
    </section>`;
  }).join('');
  return `<div class="calc-directory" id="calc-directory">
    ${groups}
    <p class="no-results" id="no-results" hidden>No calculator matches “<span data-query></span>”. Try a material like “paint” or “gravel”, or <a href="/calculators/">browse every calculator</a>.</p>
  </div>`;
}

function searchBox({ id = 'calc-search', label = 'Find a calculator', big = false } = {}) {
  return `<form class="search${big ? ' search--big' : ''}" role="search" action="/calculators/" method="get" data-search-form>
    <label class="search-label" for="${id}">${label}</label>
    <div class="search-field">
      <svg class="search-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="${id}" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="Try paint, gravel, tiles or photos" aria-describedby="${id}-status" data-search-input>
    </div>
    <p class="search-status" id="${id}-status" aria-live="polite" data-search-status></p>
  </form>`;
}

export function homePage(ctx) {
  const body = `
<section class="hero">
  <div class="container hero-inner">
    <h1>How Much Do I Need?</h1>
    <p class="hero-lead">${esc(SITE.tagline)}</p>
    ${searchBox({ big: true })}
  </div>
</section>
<div class="container">
  <section class="section" aria-labelledby="calculators-heading">
    <h2 id="calculators-heading" class="section-title">Calculators</h2>
    ${calculatorDirectory({ headingLevel: 3 })}
  </section>
  <section class="section how" aria-labelledby="how-heading">
    <h2 id="how-heading" class="section-title">How it works</h2>
    <ol class="steps-list">
      <li><strong>Pick what you're working out.</strong> Search above or choose a calculator.</li>
      <li><strong>Enter a few measurements</strong> in feet and inches or metres and centimetres. You can mix units.</li>
      <li><strong>Read the answer.</strong> You get the exact quantity, a sensible amount to buy, and the working behind both.</li>
    </ol>
  </section>
  <section class="section" aria-labelledby="trust-heading">
    <h2 id="trust-heading" class="section-title">Estimates you can check</h2>
    <ul class="feature-list">
      <li><h3>Standard formulas</h3><p>Every calculator uses the same area and volume formulas a builder or supplier would use, and shows each step with your numbers.</p></li>
      <li><h3>Exact amount and amount to buy</h3><p>You see the mathematical quantity separately from the amount to buy, which adds an adjustable allowance for waste and rounds up to real product sizes.</p></li>
      <li><h3>Private and fast</h3><p>No accounts, no tracking and no ads. Calculations happen on your device and keep working even if you lose your connection.</p></li>
    </ul>
  </section>
</div>`;
  return layout({
    title: 'How Much Do I Need? Free Material, Space & Quantity Calculators',
    description:
      'Free, simple calculators for how much paint, flooring, tile, mulch, soil, gravel, concrete or storage you need. Enter a few measurements, get a clear answer.',
    path: '/',
    body,
    current: '/',
    scripts: [ctx.siteScript],
    stylesheet: ctx.stylesheet,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE.name,
        url: `${SITE.url}/`,
        description: SITE.tagline,
      },
    ],
  });
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: pageUrl(path) })),
  };
}

export function allCalculatorsPage(ctx) {
  const body = `
<div class="container page">
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">All calculators</li></ol></nav>
  <header class="page-header">
    <h1>All calculators</h1>
    <p class="lead">Every calculator on the site, grouped by the kind of job. Each one explains its formula and rounding, so you can see exactly how the answer was reached.</p>
  </header>
  ${searchBox({ id: 'all-search', label: 'Filter calculators' })}
  ${calculatorDirectory({ headingLevel: 2 })}
</div>`;
  return layout({
    title: 'All Calculators | How Much Do I Need?',
    description:
      'Browse every How Much Do I Need? calculator: paint, flooring, tile, mulch, soil, gravel, concrete and digital storage. Free, private and simple to use.',
    path: '/calculators/',
    body,
    current: '/calculators/',
    scripts: [ctx.siteScript],
    stylesheet: ctx.stylesheet,
    jsonLd: [
      breadcrumbLd([
        ['Home', '/'],
        ['All calculators', '/calculators/'],
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: CALCULATORS.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.name, url: pageUrl(calcPath(d)) })),
      },
    ],
  });
}

export function calculatorPage(def, ctx) {
  const others = CALCULATORS.filter((d) => d.id !== def.id);
  const sections = def.content.map(
    (sec, i) => `<section class="content-section" aria-labelledby="sec-${i}">
      <h2 id="sec-${i}">${esc(sec.heading)}</h2>
      ${sec.html}
    </section>`,
  );
  // An in-content ad slot sits after the second explanatory section (renders nothing while ads are off).
  sections.splice(2, 0, adSlot('in-content'));

  const body = `
<div class="container page">
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/calculators/">Calculators</a></li><li aria-current="page">${esc(def.name)}</li></ol></nav>
  <div class="page-grid">
    <div class="page-main">
      <header class="page-header calc-header">
        <span class="calc-header-icon">${icon(def.id)}</span>
        <div>
          <h1>${esc(def.name)}</h1>
          <p class="calc-question">${esc(def.question)}</p>
        </div>
      </header>
      <p class="lead">${esc(def.intro)}</p>
      <div class="calc-panel">
        <div class="calc-inputs">
          <h2 class="visually-hidden">Your measurements</h2>
          ${renderForm(def)}
        </div>
        <section class="calc-results" aria-labelledby="result-heading">
          <h2 id="result-heading" class="results-title">Your estimate</h2>
          <div id="calc-result" class="result">${renderResult(ctx.defaultModel)}</div>
          <p id="result-live" class="visually-hidden" aria-live="polite" aria-atomic="true"></p>
        </section>
      </div>
      ${adSlot('below-result')}
      <article class="calc-content" aria-label="About this calculator">
        ${sections.join('\n')}
      </article>
    </div>
    <aside class="page-aside" aria-label="More calculators">
      <section class="aside-card">
        <h2>Other calculators</h2>
        <ul class="aside-links">
          ${others.map((d) => `<li><a href="${calcPath(d)}">${icon(d.id, 'icon icon--sm')}<span>${esc(d.name)}</span></a></li>`).join('')}
        </ul>
      </section>
      <section class="aside-card aside-card--quiet">
        <h2>Private by design</h2>
        <p>This calculator runs entirely in your browser. The numbers you enter are never sent anywhere or saved.</p>
      </section>
      ${adSlot('sidebar')}
    </aside>
  </div>
</div>`;

  return layout({
    title: def.title,
    description: def.description,
    path: calcPath(def),
    body,
    stylesheet: ctx.stylesheet,
    scripts: [ctx.entry],
    preload: ctx.preload,
    jsonLd: [
      breadcrumbLd([
        ['Home', '/'],
        ['Calculators', '/calculators/'],
        [def.name, calcPath(def)],
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: def.name,
        url: pageUrl(calcPath(def)),
        description: def.description,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript for live results',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    ],
  });
}

function simplePage({ ctx, path, title, description, h1, crumb, bodyHtml, current }) {
  const body = `
<div class="container page page--narrow">
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">${esc(crumb)}</li></ol></nav>
  <header class="page-header"><h1>${esc(h1)}</h1></header>
  <div class="prose">${bodyHtml}</div>
</div>`;
  return layout({
    title,
    description,
    path,
    body,
    current,
    stylesheet: ctx.stylesheet,
    jsonLd: [breadcrumbLd([['Home', '/'], [crumb, path]])],
  });
}

export function aboutPage(ctx) {
  return simplePage({
    ctx,
    path: '/about/',
    current: '/about/',
    title: 'About How Much Do I Need? | Simple, Honest Quantity Calculators',
    description:
      'Why How Much Do I Need? exists, how its calculators work, how accurate they are, and how the site keeps your data private.',
    h1: 'About How Much Do I Need?',
    crumb: 'About',
    bodyHtml: `
<p class="lead">How Much Do I Need? is a small collection of calculators for the practical question that comes up before almost every project: how much should I buy?</p>
<h2>What the calculators do</h2>
<p>Each calculator asks for a few measurements, then works out the answer with standard area and volume formulas. Alongside the result you'll see:</p>
<ul>
  <li><strong>The calculated quantity</strong>: the mathematical amount, with nothing added.</li>
  <li><strong>The estimated amount to buy</strong>: the calculated quantity plus an adjustable allowance for waste, rounded up to the sizes things are actually sold in.</li>
  <li><strong>The working</strong>: every step, with your numbers, so you can check it or redo it by hand.</li>
</ul>
<h2>How accurate are the results?</h2>
<p>The arithmetic is exact, and unit conversions use the official definitions (for example, 1 inch = 2.54 cm and 1 US gallon = 3.785411784 litres). The answer can only be as good as the inputs, though, and real jobs vary. Paint coverage depends on the surface, gravel weight depends on the stone, and every room has its awkward corners. That's why the extras for waste are adjustable and explained, and why each page says what could change the result.</p>
<p>Use the results to plan and budget, then check final quantities with your supplier, manufacturer or installer. For structural work such as foundations and load-bearing slabs, follow a professional's specification and your local building codes.</p>
<h2>Private by design</h2>
<p>There are no accounts, no cookies, no analytics and no tracking. The site is a set of static pages, and every calculation happens in your browser. Once a page has loaded, it keeps working even if you go offline. See the <a href="/privacy/">privacy policy</a> for details.</p>
<h2>Feedback and source code</h2>
<p>The site's source code is public on <a href="${SITE.repo}">GitHub</a>. If you spot a mistake in a formula, or there's a calculator you would find useful, please <a href="${SITE.repo}/issues">open an issue</a> there.</p>`,
  });
}

export function privacyPage(ctx) {
  return simplePage({
    ctx,
    path: '/privacy/',
    title: 'Privacy Policy | How Much Do I Need?',
    description:
      'How Much Do I Need? has no accounts, cookies, analytics or tracking. Calculations run in your browser and nothing you enter is sent anywhere.',
    h1: 'Privacy policy',
    crumb: 'Privacy',
    bodyHtml: `
<p class="lead">In short: this site doesn't collect personal information, doesn't use cookies, and doesn't track you.</p>
<p><em>Last updated: ${PRIVACY_UPDATED}</em></p>
<h2>What you enter stays on your device</h2>
<p>All calculations run in your web browser. Measurements and other numbers you type into a calculator are never sent to a server, stored or logged by this site.</p>
<h2>No accounts, cookies, analytics or tracking</h2>
<ul>
  <li>There are no user accounts or sign-ups.</li>
  <li>The site sets no cookies.</li>
  <li>There are no analytics, tracking pixels, advertising scripts or social media widgets.</li>
  <li>Every file the site uses, including fonts, comes from this site, so your browser doesn't contact any third parties to display it.</li>
</ul>
<h2>What is saved in your browser</h2>
<p>If you switch a calculator to metric (or back to US) units, that choice is remembered in your browser's local storage so the next calculator opens the same way. It is stored only on your device and is never sent to us. You can remove it at any time by clearing this site's data in your browser settings.</p>
<h2>Hosting</h2>
<p>The site is hosted on Cloudflare. Like any web host, Cloudflare processes technical information such as IP addresses when delivering pages, for example to keep the service secure and reliable. That processing is covered by <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>. This site doesn't use that information to identify or profile visitors.</p>
<h2>Changes to this policy</h2>
<p>If the site ever adds advertising or anything else that changes how data is handled, this page will be updated before that change goes live.</p>
<h2>Contact</h2>
<p>Questions about privacy can be raised by <a href="${SITE.repo}/issues">opening an issue on GitHub</a>.</p>`,
  });
}

export function notFoundPage(ctx) {
  const body = `
<div class="container page page--narrow">
  <header class="page-header"><h1>Page not found</h1></header>
  <p class="lead">There's no page at this address. It may have moved, or the link may be mistyped.</p>
  <ul class="calc-grid calc-grid--compact" role="list">${CALCULATORS.map((d) => calcCard(d, { headingLevel: 2 })).join('')}</ul>
  <p><a class="button" href="/">Go to the home page</a></p>
</div>`;
  return layout({
    title: 'Page not found | How Much Do I Need?',
    description: 'The page you were looking for could not be found.',
    path: '/404.html',
    body,
    noindex: true,
    stylesheet: ctx.stylesheet,
  });
}
