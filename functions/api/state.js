/**
 * Family App State API
 * Cloudflare Pages Function
 *
 * KV Binding required:
 *   TRIP_STATE
 *
 * Example:
 *   GET  /api/state?trip=tokyo2026
 *   POST /api/state?trip=tokyo2026
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const trip = cleanKey(url.searchParams.get('trip') || 'default');
  const stateKey = `state_${trip}`;

  if (!env.TRIP_STATE) {
    return json({
      ok: false,
      error: 'Missing KV binding: TRIP_STATE',
    }, 500);
  }

  if (request.method === 'GET' && url.searchParams.get('action') === 'test') {
    try {
      const testKey = `_test_${Date.now()}`;
      await env.TRIP_STATE.put(testKey, '1');
      const value = await env.TRIP_STATE.get(testKey);
      await env.TRIP_STATE.delete(testKey);

      return json({
        ok: value === '1',
        kv_read: value === '1',
        kv_write: true,
        binding: 'present',
        trip,
        stateKey,
        ts: new Date().toISOString(),
      });
    } catch (e) {
      return json({
        ok: false,
        error: e.message,
        binding: 'present but failed',
      }, 500);
    }
  }

  if (request.method === 'GET') {
    try {
      const data = await env.TRIP_STATE.get(stateKey);
      return json(data ? JSON.parse(data) : {});
    } catch (e) {
      return json({ error: 'KV read failed: ' + e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.text();
      JSON.parse(body);
      await env.TRIP_STATE.put(stateKey, body);
      return json({ ok: true, trip, stateKey });
    } catch (e) {
      return json({ error: 'KV write failed: ' + e.message }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}

function cleanKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
    },
  });
}