// Ad config with stub units, for tests. The live config has no units until an Adsterra account exists.
import { ADS } from '../../src/site.config.mjs';

export const STUB_ADS = {
  ...ADS,
  units: {
    'banner-320x50': { width: 320, height: 50, key: 'k320', src: 'https://ads.example.test/k320/invoke.js' },
    'banner-468x60': { width: 468, height: 60, key: 'k468', src: 'https://ads.example.test/k468/invoke.js?a=1&b="x"' },
    'box-300x250': { width: 300, height: 250, key: 'k300', src: 'https://ads.example.test/k300/invoke.js' },
  },
};
