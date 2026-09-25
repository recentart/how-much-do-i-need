# How Much Do I Need?

Free practical calculators for estimating how much material, space, or quantity you need.

**Live site:** https://how-much-do-i-need.freewebtoolss.workers.dev

Each calculator asks for a few measurements and shows three things: the exact calculated quantity, a sensible amount to buy (with an adjustable allowance for waste, rounded up to real product sizes), and the working behind both.

| Calculator | URL |
| --- | --- |
| Paint Calculator | [/paint-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/paint-calculator/) |
| Wallpaper Calculator | [/wallpaper-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/wallpaper-calculator/) |
| Flooring Calculator | [/flooring-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/flooring-calculator/) |
| Tile Calculator | [/tile-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/tile-calculator/) |
| Drywall Calculator | [/drywall-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/drywall-calculator/) |
| Insulation Calculator | [/insulation-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/insulation-calculator/) |
| Mulch Calculator | [/mulch-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/mulch-calculator/) |
| Soil Calculator | [/soil-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/soil-calculator/) |
| Gravel Calculator | [/gravel-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/gravel-calculator/) |
| Grass Seed and Sod Calculator | [/grass-seed-sod-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/grass-seed-sod-calculator/) |
| Fence Calculator | [/fence-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/fence-calculator/) |
| Deck Board Calculator | [/deck-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/deck-calculator/) |
| Paver Calculator | [/paver-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/paver-calculator/) |
| Retaining Wall Block Calculator | [/retaining-wall-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/retaining-wall-calculator/) |
| Pool and Water Tank Volume Calculator | [/pool-volume-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/pool-volume-calculator/) |
| Concrete Calculator | [/concrete-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/concrete-calculator/) |
| Brick Calculator | [/brick-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/brick-calculator/) |
| Roofing Shingle Calculator | [/roofing-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/roofing-calculator/) |
| Moving Box Calculator | [/moving-boxes-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/moving-boxes-calculator/) |
| Moving Truck Size Calculator | [/moving-truck-size-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/moving-truck-size-calculator/) |
| Party Food and Drink Calculator | [/party-food-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/party-food-calculator/) |
| Storage Calculator | [/storage-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/storage-calculator/) |
| Internet Speed and Data Calculator | [/internet-speed-data-calculator/](https://how-much-do-i-need.freewebtoolss.workers.dev/internet-speed-data-calculator/) |

## Features on every calculator

- **US or metric units**, with a unit menu on every measurement. Values convert when you switch, and the choice is remembered on your device.
- **Several areas added together**: split L-shaped or irregular spaces into rectangles with *Add another area* (area-based calculators).
- **Optional price** per box, bag, gallon and so on, for an estimated total cost.
- **Copy link to this result**: the link carries every input, so a partner or contractor opens the same calculation.
- **Print shopping list**: a printable checklist of what to buy, the cost, and the inputs it was based on.

## How it works

- **Static site.** No backend, database, accounts, analytics, trackers or third-party requests. Every calculation runs in the browser and keeps working offline once a page has loaded.
- **No dependencies.** The build is a small Node script. Wrangler is fetched by `npx` only to deploy.
- **Pre-rendered.** Each calculator page is generated with its form and its default result already in the HTML, so it reads well to search engines and works before JavaScript runs. The browser then recalculates live as values change.
- **One source of truth.** The same calculator modules run in the build, in the browser and in the tests.

```
src/
  calculators/        one file per calculator + index.mjs registry
    _shared.mjs       field factories and display helpers
  lib/
    units.mjs         exact unit definitions, rounding, number formatting
    validate.mjs      input validation (pure), run() helper
    render.mjs        form and result HTML (build + browser)
    engine.mjs        browser runtime: live results, US/Metric switch, reset
    search.mjs        calculator search/filter on the home and list pages
  pages/templates.mjs page layouts (home, all calculators, calculator, about, privacy, 404)
  static/             CSS, icons, social image, _headers (security headers)
  site.config.mjs     site URL, name, ad slot settings
scripts/
  build.mjs           generates dist/ (pages, sitemap.xml, robots.txt, browser JS)
  serve.mjs           local server that mimics Cloudflare's URL handling
  make-images.mjs     re-renders the PNG icons and og-image.png with headless Chrome
test/
  *.test.mjs          unit + build tests (node --test)
  e2e/run.mjs         browser tests in headless Chrome over the DevTools protocol
```

## Commands

Requires Node 20 or newer (Node 22+ for the browser tests).

```bash
npm run build        # generate dist/
npm test             # formula, validation and build tests
npm run test:e2e     # build, then test every page in headless Chrome
npm run serve        # build, then serve dist/ at http://localhost:8788
npx wrangler deploy  # build, then deploy dist/ to Cloudflare
```

The browser tests look for Chrome in the usual places; set `CHROME_PATH` to use another Chromium-based browser. To test the live site instead of a local build: `BASE_URL=https://how-much-do-i-need.freewebtoolss.workers.dev node test/e2e/run.mjs`.

## Deployment

`wrangler.jsonc` configures an assets-only Cloudflare Worker (no Worker script). Wrangler runs `node scripts/build.mjs` first (the `build.command`), then uploads `dist/`, which is the folder the build writes the finished static site into. `html_handling: "auto-trailing-slash"` gives clean URLs such as `/paint-calculator/`, and `not_found_handling: "404-page"` serves `dist/404.html` with a 404 status.

If the site moves to a custom domain, change `SITE.url` in `src/site.config.mjs` and redeploy. Canonical links, Open Graph URLs, `robots.txt` and `sitemap.xml` all come from it.

## Adding a calculator

1. Create `src/calculators/<name>.mjs` exporting a definition: `id`, `slug`, `name`, `question`, `category`, `keywords`, `title`, `description`, `summary`, `intro`, `groups`, `inputs`, `compute(values)`, `present(result, ctx)` and `content` (explanatory sections, including how it works and the rounding rules). Copy an existing one as a starting point.
2. Import it in `src/calculators/index.mjs` and add it to `CALCULATORS`.
3. Add known-answer tests to `test/calculators.test.mjs`, then run `npm test` and `npm run test:e2e`.

The build creates the page, the links, the search entry and the sitemap entry. It fails if a title or description is missing, duplicated or too long, or if the default inputs don't produce a result.

`compute()` receives every measurement in SI base units (metres, m², m³, m² per litre, kg/m³, bytes), so it never has to deal with unit conversion. `present()` turns the result into the display model: a headline, an "Estimated amount to buy" section, a "Calculated quantity" section, the step-by-step working and notes.

## Advertising (not enabled)

V1 has no ads. Three slots are reserved in the templates: below the calculator result, between explanatory sections, and at the bottom of the desktop sidebar. While `ADS.enabled` is `false` in `src/site.config.mjs` they render nothing at all. To enable ads later: add the markup per slot in `ADS.slots`, set `enabled: true`, update the Content-Security-Policy in `src/static/_headers` to allow the ad network, and update the privacy page.

## Accuracy

Unit conversions use exact definitions (1 in = 2.54 cm, 1 ft = 0.3048 m, 1 US gal = 3.785411784 L, 1 lb = 0.45359237 kg). Results are estimates. The pages explain what can change them and why the waste allowances exist. Found a mistake? Please [open an issue](https://github.com/recentart/how-much-do-i-need/issues).

## License

MIT
