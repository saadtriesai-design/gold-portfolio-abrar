const https = require('https');
const { getStore } = require('@netlify/blobs');

const SAR_RATE = 3.75 / 31.1035; // USD/troy-oz → SAR/gram

const FALLBACK_LOTS = [
  { id: 'default-1', name: 'Long-term hold', weight: 100, buyPrice: 300 },
  { id: 'default-2', name: 'Mid-term lot',   weight: 20,  buyPrice: 300 },
  { id: 'default-3', name: 'Short-term lot', weight: 5,   buyPrice: 300 },
];

exports.handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  const sources = [
    () => fetchJson('https://data-asg.goldprice.org/dbXRates/USD', {
        'User-Agent': 'Mozilla/5.0',
        'Accept':     'application/json',
        'Origin':     'https://goldprice.org',
        'Referer':    'https://goldprice.org/',
      }).then(d => ({
        usdPerOz: d.items[0].xauPrice,
        chgPct:   d.items[0].pcXau,
      })),
    () => fetchJson('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD')
      .then(d => ({
        usdPerOz: d[0].spreadProfilePrices[0].bid,
        chgPct:   0,
      })),
  ];

  for (const source of sources) {
    try {
      const { usdPerOz, chgPct } = await source();
      if (!usdPerOz || usdPerOz <= 0) throw new Error('bad value');

      const sar24k = usdPerOz * SAR_RATE;

      // Read lots from Blobs so the widget stays in sync with the webpage
      let lots = FALLBACK_LOTS;
      try {
        const store = getStore('gold-lots');
        lots = await store.get('lots', { type: 'json' }) ?? FALLBACK_LOTS;
      } catch (_) {}

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          usdPerOz:  Math.round(usdPerOz * 100) / 100,
          chgPct:    Math.round(chgPct * 100) / 100,
          sar24k:    Math.round(sar24k * 100) / 100,
          sar22k:    Math.round(sar24k * 22/24 * 100) / 100,
          sar21k:    Math.round(sar24k * 21/24 * 100) / 100,
          sar18k:    Math.round(sar24k * 18/24 * 100) / 100,
          lots,
          updatedAt: new Date().toISOString(),
        }),
      };
    } catch (_) {}
  }

  return { statusCode: 502, headers, body: JSON.stringify({ error: 'Price fetch failed' }) };
};

function fetchJson(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const hdrs = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', ...extraHeaders };
    https.get(url, { headers: hdrs }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
