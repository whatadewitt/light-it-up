const PWHL_KEY = '446521baf8c38984';
// GET /pwhl?<feed/view/params> -> edge-cached proxy to HockeyTech (LeagueStat), which
// is not CORS-open. key + client_code injected server-side (key is public). Single host.
export async function handlePwhl(searchParams) {
  const params = new URLSearchParams(searchParams);
  params.set('key', PWHL_KEY);
  params.set('client_code', 'pwhl');
  const upstream = `https://lscluster.hockeytech.com/feed/index.php?${params.toString()}`;
  const cache = caches.default;
  const k = new Request(upstream);
  const hit = await cache.match(k);
  if (hit) return hit;
  const resp = await fetch(upstream, { headers: { accept: 'application/json,text/javascript,*/*' } });
  const ct = resp.headers.get('content-type') || 'application/json';
  const body = await resp.arrayBuffer();
  if (resp.ok) await cache.put(k, new Response(body, { status: 200, headers: { 'content-type': ct, 'Cache-Control': 'max-age=3600' } }));
  return new Response(body, { status: resp.status, headers: { 'content-type': ct } });
}
