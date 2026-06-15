// Static site origins allowed to call this Worker. Keep this tight — it stops
// the Worker being an open proxy for the world.
export const ALLOWED_ORIGINS = [
  'https://whatadewitt.com',
  'https://www.whatadewitt.com',
];

// Default NFL season (the year the season starts).
export const NFL_SEASON = 2025;

// api.nfl.com public web client credentials (the same ones nfl.com itself uses
// on page load). Public, not secret — but keep them server-side anyway.
export const NFL_CLIENT_KEY = '4cFUW6DmwJpzT9L7LrG3qRAcABG5s04g';
export const NFL_CLIENT_SECRET = 'CZuvCL49d9OwfGsR';

// Return true if this Origin may use the Worker. Allow the configured origins,
// plus any localhost / 127.0.0.1 (dev), plus this Worker's own *.workers.dev.
export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  let u;
  try { u = new URL(origin); } catch { return false; }
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
  if (u.hostname.endsWith('.dewittl.workers.dev')) return true;
  return false;
}
