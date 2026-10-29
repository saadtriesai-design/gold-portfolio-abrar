// ── Lots API ──────────────────────────────────
// GET  → returns stored lots array
// POST → saves lots array, returns it back
//
// Storage: Netlify Blobs (cloud key-value, scoped to this site)
// The webpage and widget both use this as their shared source of truth.

const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

// Shown on first load before the user has saved anything
const DEFAULT_LOTS = [
  { id: 'default-1', name: 'Long-term hold', weight: 100, buyPrice: 300 },
  { id: 'default-2', name: 'Mid-term lot',   weight: 20,  buyPrice: 300 },
  { id: 'default-3', name: 'Short-term lot', weight: 5,   buyPrice: 300 },
];

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  const store = getStore('gold-lots');

  // ── GET: return current lots ──────────────────
  if (event.httpMethod === 'GET') {
    try {
      const lots = await store.get('lots', { type: 'json' });
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify(lots ?? DEFAULT_LOTS),
      };
    } catch (_) {
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify(DEFAULT_LOTS),
      };
    }
  }

  // ── POST: save lots (password-protected) ─────
  if (event.httpMethod === 'POST') {
    const envPw = process.env.LOTS_PASSWORD;
    if (envPw && event.headers['x-lots-password'] !== envPw) {
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    try {
      const lots = JSON.parse(event.body);
      if (!Array.isArray(lots)) throw new Error('Body must be a JSON array');
      await store.set('lots', JSON.stringify(lots));
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify(lots),
      };
    } catch (e) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: e.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: HEADERS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
