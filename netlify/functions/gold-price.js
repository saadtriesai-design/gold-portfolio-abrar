const https = require('https');

exports.handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  const sources = [
    () => fetchJson('https://data-asg.goldprice.org/dbXRates/USD')
      .then(d => d.items[0].xauPrice),
    () => fetchJson('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD')
      .then(d => d[0].spreadProfilePrices[0].bid),
  ];

  for (const source of sources) {
    try {
      const usdPerOz = await source();
      if (!usdPerOz || usdPerOz <= 0) throw new Error('bad value');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ usdPerOz }),
      };
    } catch (_) {}
  }

  return { statusCode: 502, headers, body: JSON.stringify({ error: 'All price sources failed' }) };
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
