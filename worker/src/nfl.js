import { NFL_SEASON } from './config.js';
import { makeTokenCache } from './nfl-token.js';
import { aggregateWeek } from './nfl-aggregate.js';

const WEEKS = 18; // NFL regular season weeks (a team plays 17 + one bye)
const tokenCache = makeTokenCache();

function weekUrl(season, week) {
  return `https://api.nfl.com/football/v2/experience/weekly-game-details` +
    `?season=${season}&type=REG&week=${week}&includeStandings=false` +
    `&includeDriveChart=true&includeReplays=false`;
}

// Fetch + aggregate one week, cached at the edge (data for a finished season is
// static; 6h TTL is plenty and keeps upstream calls rare).
async function getAggregatedWeek(season, week) {
  const cacheKey = new Request(`https://cache.lightitup/nfl/${season}/${week}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit.json();

  const fetchWeek = async () => {
    const token = await tokenCache.get();
    return fetch(weekUrl(season, week), { headers: { Authorization: `Bearer ${token}` } });
  };
  // Up to 2 attempts: tolerate a transient non-OK / network blip on any single
  // week so one bad fetch doesn't 502 the whole 18-week season request. A 401
  // invalidates the cached token before retrying.
  let resp = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      resp = await fetchWeek();
    } catch {
      continue; // network error -> retry once
    }
    if (resp.status === 401) { tokenCache.invalidate(); continue; }
    if (resp.ok) break;
  }
  if (!resp || !resp.ok) throw new Error(`weekly-game-details ${week} failed: ${resp ? resp.status : 'network error'}`);

  const agg = aggregateWeek(await resp.json());
  await cache.put(cacheKey, new Response(JSON.stringify(agg), {
    headers: { 'content-type': 'application/json', 'Cache-Control': 'max-age=21600' },
  }));
  return agg;
}

// GET /nfl/player/<gsisId>?season=2025 -> { gsisId, season, weeks: { "<n>": { quarters:[..] } } }
export async function handleNfl(pathParts, searchParams) {
  if (pathParts[0] !== 'player' || !pathParts[1]) {
    return new Response(JSON.stringify({ error: 'use /nfl/player/<gsisId>' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  const gsisId = decodeURIComponent(pathParts[1]);
  const season = Number(searchParams.get('season')) || NFL_SEASON;

  const weeks = {};
  for (let w = 1; w <= WEEKS; w++) {
    const agg = await getAggregatedWeek(season, w);
    const p = agg.players[gsisId];
    if (p) weeks[w] = { quarters: p.quarters };
  }
  return new Response(JSON.stringify({ gsisId, season, weeks }), {
    headers: { 'content-type': 'application/json' },
  });
}
