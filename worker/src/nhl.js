const NHL_TRICODES = ['ANA', 'BOS', 'BUF', 'CGY', 'CAR', 'CHI', 'COL', 'CBJ', 'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NSH', 'NJD', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SJS', 'SEA', 'STL', 'TBL', 'TOR', 'VAN', 'VGK', 'WSH', 'WPG', 'UTA'];

// GET /nhl/<path> -> edge-cached transparent proxy to api-web.nhle.com (single host).
// Cached because api-web 429s on bursts and its data changes rarely.
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
    await cache.put(key, new Response(body, { status: 200, headers: { 'content-type': ct, 'Cache-Control': 'max-age=3600' } }));
  }
  return new Response(body, { status: resp.status, headers: { 'content-type': ct } });
}

// Fetch one team's roster (cache-aware, gentle retry on 429/5xx/network error).
// Never throws — returns parsed JSON, or null if it can't be fetched.
async function fetchRosterCached(tri) {
  const cache = caches.default;
  const upstream = `https://api-web.nhle.com/v1/roster/${tri}/current`;
  const key = new Request(upstream);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(upstream, { headers: { accept: 'application/json' } });
      if (resp.ok) {
        const body = await resp.arrayBuffer();
        await cache.put(key, new Response(body, { status: 200, headers: { 'content-type': 'application/json', 'Cache-Control': 'max-age=86400' } }));
        return JSON.parse(new TextDecoder().decode(body));
      }
      if (resp.status !== 429 && resp.status < 500) return null;
    } catch {
      // network/parse error -> fall through to retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

// GET /nhl-players -> combined skater list across all teams, fetched SEQUENTIALLY
// (gentle, no burst) and cached 24h. Shape: [{id, fullName, teamId, teamAbbrev}].
export async function handleNhlPlayers() {
  const cache = caches.default;
  const key = new Request('https://cache.lightitup/nhl-players');
  const hit = await cache.match(key);
  if (hit) return hit;
  const players = [];
  for (const tri of NHL_TRICODES) {
    const r = await fetchRosterCached(tri);
    if (!r) continue;
    for (const p of [...(r.forwards || []), ...(r.defensemen || [])]) {
      const fullName = `${(p.firstName && p.firstName.default) || ''} ${(p.lastName && p.lastName.default) || ''}`.trim();
      players.push({ id: p.id, fullName, teamId: tri, teamAbbrev: tri });
    }
  }
  const out = new Response(JSON.stringify(players), { headers: { 'content-type': 'application/json', 'Cache-Control': 'max-age=86400' } });
  await cache.put(key, out.clone());
  return out;
}
