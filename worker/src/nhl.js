// GET /nhl/<path> -> edge-cached transparent proxy to api-web.nhle.com.
// Locked to that single upstream host (not an open proxy). Cached because
// api-web returns 429 on concurrent bursts and its data changes rarely.
export async function handleNhl(pathParts, searchParams) {
  const path = pathParts.map(encodeURIComponent).join('/');
  const qs = searchParams.toString();
  const upstream = `https://api-web.nhle.com/${path}${qs ? `?${qs}` : ''}`;
  const cache = caches.default;
  const key = new Request(upstream);
  const hit = await cache.match(key);
  if (hit) return hit;

  const resp = await fetch(upstream, { headers: { accept: 'application/json' } });
  const ct = resp.headers.get('content-type') || 'application/json';
  const body = await resp.arrayBuffer();
  if (resp.ok) {
    await cache.put(key, new Response(body, {
      status: 200,
      headers: { 'content-type': ct, 'Cache-Control': 'max-age=3600' },
    }));
  }
  return new Response(body, { status: resp.status, headers: { 'content-type': ct } });
}
