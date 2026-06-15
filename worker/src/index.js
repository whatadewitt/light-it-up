import { isAllowedOrigin } from './config.js';
import { handleNhl } from './nhl.js';
import { handleNfl } from './nfl.js';

function corsHeaders(origin) {
  const h = { 'Vary': 'Origin' };
  if (isAllowedOrigin(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  }
  return h;
}

function withCors(resp, origin) {
  const merged = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) merged.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: merged });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET') {
      return withCors(new Response('method not allowed', { status: 405 }), origin);
    }
    // Lockdown: only allowed origins may read responses. Browsers send Origin on
    // cross-origin fetches; block early so we are not an open proxy.
    if (origin && !isAllowedOrigin(origin)) {
      return new Response('forbidden origin', { status: 403 });
    }

    const parts = url.pathname.split('/').filter(Boolean); // ['nhl', ...]
    const [scope, ...rest] = parts;
    try {
      if (scope === 'nhl') return withCors(await handleNhl(rest, url.searchParams), origin);
      if (scope === 'nfl') return withCors(await handleNfl(rest, url.searchParams), origin);
      return withCors(new Response(JSON.stringify({ routes: ['/nhl/<path>', '/nfl/player/<gsisId>'] }),
        { headers: { 'content-type': 'application/json' } }), origin);
    } catch (err) {
      return withCors(new Response(JSON.stringify({ error: String(err) }),
        { status: 502, headers: { 'content-type': 'application/json' } }), origin);
    }
  },
};
