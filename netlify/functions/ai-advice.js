const https = require('https');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
  if (!apiKey) {
    return { statusCode: 400, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing x-api-key header' }) };
  }

  return new Promise((resolve) => {
    const body = event.body || '{}';
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: data,
        });
      });
    });

    req.on('error', (e) => {
      resolve({
        statusCode: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: e.message }),
      });
    });

    req.write(body);
    req.end();
  });
};
