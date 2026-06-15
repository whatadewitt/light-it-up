// GET /nhl/<path> -> transparent proxy to https://api-web.nhle.com/<path>.
// Locked to that single upstream host (not an open proxy).
export async function handleNhl(pathParts, searchParams) {
  const path = pathParts.map(encodeURIComponent).join('/');
  const qs = searchParams.toString();
  const upstream = `https://api-web.nhle.com/${path}${qs ? `?${qs}` : ''}`;
  const resp = await fetch(upstream, { headers: { accept: 'application/json' } });
  // Re-wrap so we control the headers (CORS is added by the caller in index.js).
  return new Response(resp.body, {
    status: resp.status,
    headers: { 'content-type': resp.headers.get('content-type') || 'application/json' },
  });
}
