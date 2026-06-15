import { NFL_CLIENT_KEY, NFL_CLIENT_SECRET } from './config.js';

const SAFETY_MS = 60_000; // re-mint a minute before real expiry

// Base64 of a fixed desktop deviceInfo blob (atob/btoa exist in Workers).
function deviceInfoB64() {
  return btoa(JSON.stringify({ model: 'desktop', version: 'Chrome', osName: 'Windows', osVersion: '10.0' }));
}

// Real network mint against api.nfl.com. Returns { accessToken, ttlMs }.
export async function mintToken(deviceId = crypto.randomUUID()) {
  const resp = await fetch('https://api.nfl.com/identity/v3/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientKey: NFL_CLIENT_KEY,
      clientSecret: NFL_CLIENT_SECRET,
      deviceId,
      deviceInfo: deviceInfoB64(),
      networkType: 'other',
    }),
  });
  if (!resp.ok) throw new Error(`token mint failed: ${resp.status}`);
  const json = await resp.json();
  // TTL is hardcoded to 1h: api.nfl.com tokens last exactly 3600s, and the
  // response's `expiresIn` is an absolute Unix timestamp (NOT a duration), so
  // it must not be used directly as a TTL. The 401-retry in nfl.js is the
  // backstop if a token is ever invalidated early.
  return { accessToken: json.accessToken, ttlMs: 3600_000 };
}

// Cache wrapper. Inject `mint`/`now` for tests; defaults use the real mint + Date.
export function makeTokenCache({ mint = mintToken, now = () => Date.now() } = {}) {
  let token = null;
  let expiresAt = 0;
  let inflight = null; // shared promise so concurrent callers mint only once
  return {
    async get() {
      if (token && now() < expiresAt - SAFETY_MS) return token;
      if (inflight) return inflight;
      inflight = (async () => {
        const { accessToken, ttlMs } = await mint();
        token = accessToken;
        expiresAt = now() + ttlMs;
        return token;
      })().finally(() => { inflight = null; });
      return inflight;
    },
    invalidate() { token = null; expiresAt = 0; },
  };
}
