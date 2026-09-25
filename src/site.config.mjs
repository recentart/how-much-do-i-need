// Site-wide settings. Change SITE_URL when the site moves to a custom domain, then rebuild:
// canonical links, Open Graph URLs, robots.txt and sitemap.xml all come from it.

export const SITE = {
  url: 'https://how-much-do-i-need.freewebtoolss.workers.dev',
  name: 'How Much Do I Need?',
  tagline: 'Simple calculators for figuring out how much material, space, or quantity you need.',
  repo: 'https://github.com/recentart/how-much-do-i-need',
  themeColor: '#1d4ed8',
};

// Advertising slots. Off in V1: every slot renders nothing. To add ads later, set enabled to true,
// put the ad markup for each slot below, and update the Content-Security-Policy in src/static/_headers
// and the privacy page. Slots are placed where an ad can't push the calculator or its result around.
export const ADS = {
  enabled: false,
  slots: {
    'below-result': '',
    'in-content': '',
    sidebar: '',
  },
};
